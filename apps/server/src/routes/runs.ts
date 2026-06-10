import { Router } from 'express';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Orchestrator } from '@alpha-agent/agent-core';
import {
  appendRunEvent,
  createMemory,
  createRun,
  createRunModelCall,
  getRun,
  listRunEvents,
  listRunModelCalls,
  listRuns,
  recallMemories,
  updateRunStatus
} from '../repositories/runRepository.js';
import { config } from '../config.js';
import { runArticleReadingStatsDemo } from '../services/l1DemoService.js';
import { agentModelInvoker } from '../services/agentModelInvoker.js';
import { subscribeRunEvents } from '../services/runEventBus.js';

const createRunSchema = z.object({
  title: z.string().min(1).optional(),
  requirement: z.string().min(1).optional(),
  async: z.boolean().optional().default(false)
});

const answerRunSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().min(1)
      }),
    )
    .min(1),
  async: z.boolean().optional().default(false)
});

const approvePlanSchema = z.object({
  approved: z.boolean().optional().default(true),
  note: z.string().max(1000).optional()
});

const replayRunSchema = z.object({
  fromStage: z.string().min(1).optional().default('plan'),
  overridePayload: z.unknown().optional(),
  async: z.boolean().optional().default(false)
});

const retryRunSchema = z.object({
  async: z.boolean().optional().default(true)
});

export const runsRouter = Router();

function isTerminalStreamEvent(type: string) {
  return (
    type === 'stage.completed' ||
    type === 'stage.failed' ||
    type === 'run.failed' ||
    type === 'clarify.questions' ||
    type === 'skill.match.requires_input' ||
    type === 'verify.requires_input' ||
    type === 'run.recovery_required'
  );
}

function createOrchestrator(runId: string) {
  const sandboxPath = resolveSandboxPath(config.CONDUIT_SANDBOX_PATH);

  return new Orchestrator({
    sandboxPath,
    maxRepairAttempts: config.MAX_REPAIR_ATTEMPTS,
    model: agentModelInvoker,
    eventSink: {
      setStatus: (status) => updateRunStatus(runId, status).then(() => undefined),
      append: (type, payload, stage) => appendRunEvent(runId, type, payload, stage).then(() => undefined),
      recallMemories: (query) => recallMemories(query),
      recordMemory: (memory) => createMemory(memory).then(() => undefined),
      recordModelCall: (call) => createRunModelCall(runId, call).then(() => undefined)
    }
  });
}

function resolveSandboxPath(configuredPath: string) {
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  const candidates = [
    path.resolve(process.cwd(), configuredPath),
    path.resolve(process.cwd(), '../..', configuredPath)
  ];
  const found = candidates.find((candidate) => existsSync(path.join(candidate, 'package.json')));

  if (!found) {
    throw new Error(`Conduit sandbox path not found: ${configuredPath}`);
  }

  return found;
}

function markAsyncRunRecoverable(runId: string, message: string) {
  return appendRunEvent(
    runId,
    'run.recovery_required',
    {
      message,
      recovery: [
        'The async run was paused instead of being hard-failed.',
        'Open Run detail to inspect the last event and replay from a safe stage.',
        'Retry the run after the Skill, Plan, or verification issue is corrected.'
      ]
    },
    'requires_input',
  ).then(() => updateRunStatus(runId, 'requires_input')).then(() => undefined);
}

runsRouter.get('/api/runs', async (_req, res, next) => {
  try {
    res.json({ runs: await listRuns() });
  } catch (error) {
    next(error);
  }
});

runsRouter.post('/api/runs', async (req, res, next) => {
  try {
    const input = createRunSchema.parse(req.body);
    const requirement = input.requirement ?? input.title;
    if (!requirement) {
      res.status(400).json({ error: 'title or requirement is required' });
      return;
    }

    const run = await createRun(requirement);
    const orchestrator = createOrchestrator(run.id);

    if (input.async) {
      void orchestrator.run(requirement).catch((error: unknown) =>
        markAsyncRunRecoverable(run.id, error instanceof Error ? error.message : 'Unexpected async run error'),
      );
      res.status(202).json({ run, result: { success: false, status: 'running' } });
      return;
    }

    const result = await orchestrator.run(requirement);
    const completedRun = await getRun(run.id);
    res.status(201).json({ run: completedRun, result });
  } catch (error) {
    next(error);
  }
});

runsRouter.post('/api/runs/:id/replay', async (req, res, next) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const input = replayRunSchema.parse(req.body ?? {});
    const replayedRun = await createRun(`[replay:${input.fromStage}] ${run.title}`);
    await appendRunEvent(
      replayedRun.id,
      'replay.started',
      {
        sourceRunId: run.id,
        fromStage: input.fromStage,
        hasOverridePayload: input.overridePayload !== undefined,
        overridePayload: input.overridePayload ?? null
      },
      'created',
    );

    const orchestrator = createOrchestrator(replayedRun.id);
    if (input.async) {
      void orchestrator.run(run.title, input).catch((error: unknown) =>
        markAsyncRunRecoverable(replayedRun.id, error instanceof Error ? error.message : 'Unexpected async replay run error'),
      );
      res.status(202).json({ run: replayedRun, result: { success: false, status: 'running' } });
      return;
    }

    const result = await orchestrator.run(run.title, input);
    const completedRun = await getRun(replayedRun.id);
    res.status(201).json({ run: completedRun, result });
  } catch (error) {
    next(error);
  }
});

runsRouter.post('/api/runs/:id/retry', async (req, res, next) => {
  try {
    const sourceRun = await getRun(req.params.id);
    if (!sourceRun) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const input = retryRunSchema.parse(req.body ?? {});
    const retryRun = await createRun(`[retry] ${sourceRun.title}`);
    await appendRunEvent(
      sourceRun.id,
      'run.retry_requested',
      { retryRunId: retryRun.id },
      sourceRun.status,
    );

    const orchestrator = createOrchestrator(retryRun.id);
    if (input.async) {
      void orchestrator.run(sourceRun.title).catch((error: unknown) =>
        markAsyncRunRecoverable(retryRun.id, error instanceof Error ? error.message : 'Unexpected async retry run error'),
      );
      res.status(202).json({ run: retryRun, result: { success: false, status: 'running' } });
      return;
    }

    const result = await orchestrator.run(sourceRun.title);
    const completedRun = await getRun(retryRun.id);
    res.status(201).json({ run: completedRun, result });
  } catch (error) {
    next(error);
  }
});

runsRouter.post('/api/runs/:id/answers', async (req, res, next) => {
  try {
    const sourceRun = await getRun(req.params.id);
    if (!sourceRun) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const input = answerRunSchema.parse(req.body);
    const answerText = input.answers
      .map((answer) => `${answer.questionId}: ${answer.answer}`)
      .join('\n');
    const continuedRequirement = `${sourceRun.title}\n\n人工补充澄清：\n${answerText}`;
    const continuedRun = await createRun(`[answered] ${sourceRun.title}`);
    await appendRunEvent(
      sourceRun.id,
      'clarify.answers.submitted',
      { continuedRunId: continuedRun.id, answers: input.answers },
      'requires_input',
    );
    await appendRunEvent(
      continuedRun.id,
      'clarify.answers.applied',
      { sourceRunId: sourceRun.id, answers: input.answers },
      'clarifying',
    );

    const orchestrator = createOrchestrator(continuedRun.id);

    if (input.async) {
      void orchestrator.run(continuedRequirement).catch((error: unknown) =>
        markAsyncRunRecoverable(continuedRun.id, error instanceof Error ? error.message : 'Unexpected async answered run error'),
      );
      res.status(202).json({ run: continuedRun, result: { success: false, status: 'running' } });
      return;
    }

    const result = await orchestrator.run(continuedRequirement);
    const completedRun = await getRun(continuedRun.id);
    res.status(201).json({ run: completedRun, result });
  } catch (error) {
    next(error);
  }
});

runsRouter.post('/api/runs/:id/approve-plan', async (req, res, next) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const input = approvePlanSchema.parse(req.body ?? {});
    await appendRunEvent(
      req.params.id,
      input.approved ? 'plan.approved' : 'plan.rejected',
      {
        approved: input.approved,
        note: input.note ?? '',
        statusAtApproval: run.status
      },
      run.status,
    );

    res.status(200).json(await getRun(req.params.id));
  } catch (error) {
    next(error);
  }
});

runsRouter.get('/api/runs/:id', async (req, res, next) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.json(run);
  } catch (error) {
    next(error);
  }
});

runsRouter.get('/api/runs/:id/events', async (req, res, next) => {
  try {
    res.json(await listRunEvents(req.params.id));
  } catch (error) {
    next(error);
  }
});

runsRouter.get('/api/runs/:id/model-calls', async (req, res, next) => {
  try {
    res.json({ modelCalls: await listRunModelCalls(req.params.id) });
  } catch (error) {
    next(error);
  }
});

runsRouter.post('/api/runs/:id/events', async (req, res, next) => {
  try {
    const event = await appendRunEvent(req.params.id, 'manual.event', req.body ?? {});
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

runsRouter.get('/api/runs/:id/stream', async (req, res, next) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let lastSeq = 0;
    const writeEvent = (event: { seq: number }) => {
      lastSeq = Math.max(lastSeq, event.seq);
      res.write(`event: run-event\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const events = await listRunEvents(req.params.id);
    for (const event of events) {
      writeEvent(event);
    }

    if (
      events.some((event) => isTerminalStreamEvent(event.type)) ||
      run.status === 'completed' ||
      run.status === 'failed' ||
      run.status === 'requires_input'
    ) {
      res.write('event: end\n');
      res.write('data: {}\n\n');
      res.end();
      return;
    }

    const unsubscribe = subscribeRunEvents(req.params.id, (event) => {
      if (event.seq > lastSeq) {
        writeEvent(event);
      }

      if (isTerminalStreamEvent(event.type)) {
        res.write('event: end\n');
        res.write('data: {}\n\n');
        unsubscribe();
        res.end();
      }
    });

    const heartbeat = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (error) {
    next(error);
  }
});

runsRouter.post('/api/demo/l1/article-reading-stats', async (_req, res, next) => {
  try {
    res.status(201).json(await runArticleReadingStatsDemo());
  } catch (error) {
    next(error);
  }
});
