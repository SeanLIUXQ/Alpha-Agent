import { packContext } from '@alpha-agent/context-engine';
import { applyPatchSet, getGitDiffStat } from '@alpha-agent/sandbox-runner';
import {
  type ImplementationPlan,
  type RequirementDsl,
  type RunStatus,
  implementationPlanSchema,
  requirementDslSchema,
  runStatusSchema
} from '@alpha-agent/shared';
import { type Skill } from '@alpha-agent/skill-sdk';
import { ClarifyAgent } from './agents/clarifyAgent.js';
import { CodeAgent } from './agents/codeAgent.js';
import { HandoffAgent } from './agents/handoffAgent.js';
import { PlanAgent } from './agents/planAgent.js';
import { ReviewTestAgent } from './agents/reviewTestAgent.js';
import { type AgentModelCall, type AgentModelInvoker } from './model.js';
import { createDefaultSkillRegistry } from './skillRegistry.js';
import { verifySandbox } from './verification.js';

export interface OrchestratorEventSink {
  setStatus(status: RunStatus): Promise<void>;
  append(type: string, payload: unknown, stage?: RunStatus): Promise<void>;
  recallMemories?(query: string): Promise<unknown[]>;
  recordMemory?(memory: { title: string; tags: string[]; payload: unknown }): Promise<void>;
  recordModelCall?(call: {
    agentName: string;
    model: string;
    latencyMs: number;
    success: boolean;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    error?: string;
  }): Promise<void>;
}

export interface OrchestratorOptions {
  sandboxPath: string;
  eventSink: OrchestratorEventSink;
  maxRepairAttempts?: number;
  model?: AgentModelInvoker;
}

export interface OrchestratorResult {
  success: boolean;
  status: RunStatus;
}

export interface OrchestratorReplayInput {
  fromStage?: string;
  overridePayload?: unknown;
}

interface ParsedReplayOverride {
  dsl?: RequirementDsl;
  plan?: ImplementationPlan;
  skillName?: string;
}

function parseReplayOverride(payload: unknown): ParsedReplayOverride {
  if (payload === undefined || payload === null) {
    return {};
  }

  const record = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  const skillName = typeof record.skill === 'string' ? record.skill : undefined;
  const planCandidate = record.plan ?? payload;
  const planResult = implementationPlanSchema.safeParse(planCandidate);
  if (planResult.success) {
    return {
      dsl: planResult.data.requirement,
      plan: planResult.data,
      skillName
    };
  }

  const dslCandidate = record.dsl ?? record.requirement ?? payload;
  const dslResult = requirementDslSchema.safeParse(dslCandidate);
  if (dslResult.success) {
    return { dsl: dslResult.data, skillName };
  }

  throw new Error('Replay override payload must be a valid clarify DSL or implementation plan JSON.');
}

export class Orchestrator {
  private readonly clarifyAgent: ClarifyAgent;
  private readonly planAgent: PlanAgent;
  private readonly codeAgent: CodeAgent;
  private readonly reviewTestAgent = new ReviewTestAgent();
  private readonly handoffAgent = new HandoffAgent();

  constructor(private readonly options: OrchestratorOptions) {
    this.clarifyAgent = new ClarifyAgent(options.model);
    this.planAgent = new PlanAgent(options.model);
    this.codeAgent = new CodeAgent(options.model);
  }

  async run(rawRequirement: string, replay?: OrchestratorReplayInput): Promise<OrchestratorResult> {
    try {
      const registry = await createDefaultSkillRegistry();
      const replayOverride = parseReplayOverride(replay?.overridePayload);
      await this.enter('clarifying');
      const memories = (await this.options.eventSink.recallMemories?.(rawRequirement)) ?? [];
      if (memories.length > 0) {
        await this.options.eventSink.append('memory.recalled', { memories }, 'clarifying');
      }
      const clarifyResult = replayOverride.dsl
        ? {
            dsl: replayOverride.dsl,
            questions: [],
            metadata: { source: 'replay-override' as const },
            modelCalls: []
          }
        : await this.clarifyAgent.run(rawRequirement);
      await this.recordModelCalls(clarifyResult.modelCalls);
      await this.options.eventSink.append(
        'clarify.completed',
        {
          dsl: clarifyResult.dsl,
          questions: clarifyResult.questions,
          source: clarifyResult.metadata?.source,
          model: clarifyResult.metadata?.model,
          repairAttempted: clarifyResult.metadata?.repairAttempted,
          fallbackError: clarifyResult.metadata?.error
        },
        'clarifying',
      );

      if (!clarifyResult.dsl) {
        await this.enter('requires_input');
        await this.options.eventSink.append('clarify.questions', {
          message: '需要补充信息后才能继续实现。',
          questions: clarifyResult.questions
        }, 'requires_input');
        return { success: false, status: 'requires_input' };
      }

      const replaySkill = replayOverride.skillName
        ? registry.list().find((candidate) => candidate.name === replayOverride.skillName)
        : undefined;
      const skillMatch = replaySkill
        ? {
            skill: replaySkill,
            match: {
              matched: true,
              score: 1,
              reason: 'Skill selected from replay payload.'
            }
          }
        : await registry.findBest(clarifyResult.dsl);
      if (!skillMatch) {
        await this.enter('requires_input');
        await this.options.eventSink.append(
          'skill.match.requires_input',
          {
            message: 'No registered Skill matched the clarified requirement with enough confidence.',
            dsl: clarifyResult.dsl,
            suggestions: [
              'Use a supported Conduit article/list/detail requirement.',
              'Open Run detail and replay from Clarify after editing the DSL.',
              'Add a new Skill file for this requirement pattern.'
            ]
          },
          'requires_input',
        );
        return { success: false, status: 'requires_input' };
      }
      const skill = skillMatch.skill as Skill<RequirementDsl, ImplementationPlan>;

      await this.enter('planned');
      const planResult = replayOverride.plan
        ? {
            plan: replayOverride.plan,
            metadata: { source: 'replay-override' as const },
            modelCalls: []
          }
        : await this.planAgent.runWithMetadata(clarifyResult.dsl, skill);
      const plan = planResult.plan;
      await this.recordModelCalls(planResult.modelCalls);
      await this.options.eventSink.append(
        'plan.completed',
        {
          plan,
          skill: skillMatch.skill.name,
          match: skillMatch.match,
          source: planResult.metadata?.source,
          model: planResult.metadata?.model,
          repairAttempted: planResult.metadata?.repairAttempted,
          fallbackError: planResult.metadata?.error
        },
        'planned',
      );

      await this.enter('located');
      const skillContext = (await skill.context?.(plan)) ?? {};
      const context = await packContext({
        sandboxPath: this.options.sandboxPath,
        candidateFiles: skillContext.candidateFiles ?? plan.candidateFiles,
        searchHints: skillContext.searchHints ?? plan.searchHints
      });
      await this.options.eventSink.append('locate.completed', { context }, 'located');

      await this.enter('generated');
      const codeCandidate = await this.codeAgent.proposeCandidatePatch(plan, context);
      await this.recordModelCalls(codeCandidate.modelCalls);
      await this.options.eventSink.append(
        'generate.candidate_patch',
        {
          candidate: codeCandidate.candidate,
          source: codeCandidate.metadata?.source,
          model: codeCandidate.metadata?.model,
          repairAttempted: codeCandidate.metadata?.repairAttempted,
          fallbackError: codeCandidate.metadata?.error,
          reviewDecision: '系统仅采纳候选 patch 的意图说明；最终落地由确定性 CodeAgent 生成并由沙箱验证审查。'
        },
        'generated',
      );
      const patchSet = await this.codeAgent.run({
        requirement: clarifyResult.dsl,
        plan,
        context,
        skill
      });
      await this.options.eventSink.append(
        'generate.completed',
        {
          patchSet,
          source: skill.generate ? 'skill-generate' : 'system-reviewed-rule-patch',
          reviewedCandidate: Boolean(codeCandidate.candidate)
        },
        'generated',
      );

      await this.enter('applied');
      const applyResult = await applyPatchSet(this.options.sandboxPath, patchSet);
      const diffStat = await getGitDiffStat(this.options.sandboxPath);
      await this.options.eventSink.append(
        'apply.completed',
        { changedFiles: applyResult.changedFiles, diffStat: diffStat.stdout.trim() },
        'applied',
      );

      await this.enter('verifying');
      let verifyResult = await verifySandbox(this.options.sandboxPath, plan.verifyCommands);
      await this.options.eventSink.append('verify.completed', verifyResult, 'verifying');

      if (!verifyResult.success) {
        verifyResult = await this.repairAndVerify(verifyResult, plan.verifyCommands, plan, skill);
      }

      if (!verifyResult.success) {
        await this.options.eventSink.append(
          'verify.requires_input',
          {
            message: 'Verification still failed after automatic repair attempts. The applied patch and failure logs are preserved for replay or manual adjustment.',
            commands: verifyResult.commands
          },
          'requires_input',
        );
        await this.enter('requires_input');
        return { success: false, status: 'requires_input' };
      }

      const handoff = await this.handoffAgent.run({
        patchSet,
        verifyResult,
        diffSummary: diffStat.stdout.trim(),
        risks: plan.risks,
        skill
      });
      await this.options.eventSink.append('handoff.completed', handoff, 'completed');
      await this.enter('completed');

      if (verifyResult.success) {
        await this.options.eventSink.recordMemory?.({
          title: clarifyResult.dsl.rawText,
          tags: [plan.level, skill.name, ...skill.tags],
          payload: {
            requirement: clarifyResult.dsl,
            skill: skill.name,
            changedFiles: patchSet.operations.map((operation) => operation.path),
            handoff
          }
        });
      }

      return {
        success: true,
        status: 'completed'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected orchestrator error';
      await this.enter('requires_input');
      await this.options.eventSink.append(
        'run.recovery_required',
        {
          message,
          recovery: [
            'The run was paused instead of being hard-failed.',
            'Use retry after the Skill/Plan issue is corrected.',
            'Use Run detail replay to edit Clarify DSL or Plan and rerun downstream.',
            'For a new unsupported pattern, add a Skill file and retry the same requirement.'
          ]
        },
        'requires_input',
      );
      return { success: false, status: 'requires_input' };
    }
  }

  private async enter(status: RunStatus): Promise<void> {
    const parsedStatus = runStatusSchema.parse(status);
    await this.options.eventSink.setStatus(parsedStatus);
    await this.options.eventSink.append(`stage.${parsedStatus}`, { status: parsedStatus }, parsedStatus);
  }

  private async fail(message: string, payload: Record<string, unknown>): Promise<void> {
    await this.options.eventSink.setStatus('failed');
    await this.options.eventSink.append('run.failed', { message, ...payload }, 'failed');
  }

  private async repairAndVerify(
    initialVerifyResult: Awaited<ReturnType<typeof verifySandbox>>,
    verifyCommands: string[],
    plan: ImplementationPlan,
    skill: Skill<RequirementDsl, ImplementationPlan>,
  ): Promise<Awaited<ReturnType<typeof verifySandbox>>> {
    let verifyResult = initialVerifyResult;
    const maxAttempts = this.options.maxRepairAttempts ?? 3;

    await this.enter('repairing');

    for (let attempt = 1; attempt <= maxAttempts && !verifyResult.success; attempt += 1) {
      const failureLogs = verifyResult.commands
        .map((command) => [
          `$ ${command.command}`,
          `exitCode: ${command.exitCode ?? 'unknown'}`,
          command.stdout,
          command.stderr
        ].filter(Boolean).join('\n'))
        .join('\n\n');
      const failureSummary = await this.reviewTestAgent.summarizeFailure(failureLogs);
      const skillRepairHints = (await skill.repairHints?.({ plan, error: failureLogs })) ?? [];
      await this.options.eventSink.append(
        'repair.reviewed',
        { summary: failureSummary, skillRepairHints, attempt, maxAttempts },
        'repairing',
      );

      const repairPatch = await this.reviewTestAgent.createRepairPatch({
        sandboxPath: this.options.sandboxPath,
        verifyResult,
        attempt,
        repairHints: skillRepairHints
      });

      if (!repairPatch) {
        await this.options.eventSink.append(
          'repair.skipped',
          {
            attempt,
            maxAttempts,
            decision: 'ReviewTestAgent 没有找到安全、确定的自动修复 patch，停止自动改补。'
          },
          'repairing',
        );
        break;
      }

      await this.options.eventSink.append('repair.generated', { patchSet: repairPatch, attempt }, 'repairing');
      const applyRepairResult = await applyPatchSet(this.options.sandboxPath, repairPatch);
      await this.options.eventSink.append(
        'repair.apply.completed',
        { changedFiles: applyRepairResult.changedFiles, attempt },
        'repairing',
      );
      verifyResult = await verifySandbox(this.options.sandboxPath, verifyCommands);
      await this.options.eventSink.append('repair.verify.completed', { ...verifyResult, attempt }, 'repairing');
    }

    return verifyResult;
  }

  private async recordModelCalls(calls: AgentModelCall[] | undefined): Promise<void> {
    if (!calls) return;

    for (const call of calls) {
      await this.options.eventSink.recordModelCall?.(call);
    }
  }
}
