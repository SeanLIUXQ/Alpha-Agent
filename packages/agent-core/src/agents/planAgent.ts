import { type ImplementationPlan, type RequirementDsl, implementationPlanSchema } from '@alpha-agent/shared';
import type { Skill } from '@alpha-agent/skill-sdk';
import { type AgentModelCall, type AgentModelInvoker, type AgentRunMetadata } from '../model.js';
import { runStructuredJson } from './jsonModel.js';

export interface PlanResult {
  plan: ImplementationPlan;
  metadata?: AgentRunMetadata;
  modelCalls?: AgentModelCall[];
}

const planSystemPrompt = [
  'You are PlanAgent for Alpha Agent, an autonomous coding workflow for the local Conduit RealWorld app.',
  'Return one JSON object only. No Markdown.',
  'Produce a concrete ImplementationPlan JSON object that follows the provided Skill contract.',
  'Keep candidateFiles and verifyCommands exact and safe for the local sandbox.',
  'Do not invent unrelated files. Prefer the Skill fallback plan when uncertain.',
  'Output shape: ImplementationPlan with requirement, level, summary, impact, candidateFiles, searchHints, verifyCommands, risks.'
].join('\n');

const planRepairPrompt = `${planSystemPrompt}\nYou are repairing invalid JSON. Return valid ImplementationPlan JSON only.`;

export class PlanAgent {
  constructor(private readonly model?: AgentModelInvoker) {}

  async run(requirement: RequirementDsl, skill: Skill<RequirementDsl, ImplementationPlan>): Promise<ImplementationPlan> {
    return (await this.runWithMetadata(requirement, skill)).plan;
  }

  async runWithMetadata(requirement: RequirementDsl, skill: Skill<RequirementDsl, ImplementationPlan>): Promise<PlanResult> {
    const fallbackPlan = async (metadata?: AgentRunMetadata): Promise<PlanResult> => ({
      plan: implementationPlanSchema.parse(await skill.plan(requirement)),
      metadata: metadata ?? { source: 'fallback' }
    });

    if (!this.model) {
      return fallbackPlan();
    }

    try {
      const skillPlan = implementationPlanSchema.parse(await skill.plan(requirement));
      const structured = await runStructuredJson(this.model, {
        agentName: 'PlanAgent',
        messages: [
          { role: 'system', content: planSystemPrompt },
          {
            role: 'user',
            content: JSON.stringify(
              {
                requirement,
                selectedSkill: {
                  name: skill.name,
                  version: skill.version,
                  tags: skill.tags,
                  description: skill.description
                },
                fallbackPlan: skillPlan
              },
              null,
              2,
            )
          }
        ],
        schema: implementationPlanSchema,
        repairSystemPrompt: planRepairPrompt,
        temperature: 0,
        maxCompletionTokens: 1200
      });

      return {
        plan: implementationPlanSchema.parse({
          ...structured.data,
          requirement,
          level: requirement.level,
          // Keep the model useful for narrative planning, but do not let it
          // invent unsafe files or commands. The selected Skill owns the
          // executable contract.
          candidateFiles: skillPlan.candidateFiles,
          searchHints: Array.from(new Set([...skillPlan.searchHints, ...structured.data.searchHints])),
          verifyCommands: skillPlan.verifyCommands
        }),
        metadata: {
          source: 'model',
          model: structured.raw.model,
          repairAttempted: structured.repairAttempted
        },
        modelCalls: structured.calls
      };
    } catch (error) {
      return fallbackPlan({
        source: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown PlanAgent model error'
      });
    }
  }
}
