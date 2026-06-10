import { prisma } from '../prisma.js';
import { publishRunEvent } from '../services/runEventBus.js';

export async function createRun(title: string) {
  return prisma.run.create({
    data: {
      title,
      status: 'created',
      currentStage: 'created',
      events: {
        create: {
          seq: 1,
          type: 'run.created',
          stage: 'created',
          payloadJson: JSON.stringify({ title })
        }
      }
    },
    include: { events: true }
  });
}

export async function listRuns(limit = 20) {
  return prisma.run.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { events: { orderBy: { seq: 'asc' } } }
  });
}

export async function getRun(runId: string) {
  return prisma.run.findUnique({
    where: { id: runId },
    include: { events: { orderBy: { seq: 'asc' } } }
  });
}

export async function updateRunStatus(runId: string, status: string) {
  return prisma.run.update({
    where: { id: runId },
    data: {
      status,
      currentStage: status
    }
  });
}

export async function appendRunEvent(
  runId: string,
  type: string,
  payload: unknown,
  stage?: string,
) {
  const lastEvent = await prisma.runEvent.findFirst({
    where: { runId },
    orderBy: { seq: 'desc' }
  });

  const event = await prisma.runEvent.create({
    data: {
      runId,
      seq: (lastEvent?.seq ?? 0) + 1,
      type,
      stage,
      payloadJson: JSON.stringify(payload)
    }
  });
  publishRunEvent(event);
  return event;
}

export async function listRunEvents(runId: string) {
  return prisma.runEvent.findMany({
    where: { runId },
    orderBy: { seq: 'asc' }
  });
}

export async function listRunModelCalls(runId: string) {
  return prisma.modelCall.findMany({
    where: { runId },
    orderBy: { createdAt: 'asc' }
  });
}

export async function createRunModelCall(
  runId: string,
  call: {
    agentName: string;
    model: string;
    latencyMs: number;
    success: boolean;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    error?: string;
  },
) {
  return prisma.modelCall.create({
    data: {
      runId,
      agentName: call.agentName,
      model: call.model,
      latencyMs: call.latencyMs,
      success: call.success,
      promptTokens: call.promptTokens,
      completionTokens: call.completionTokens,
      totalTokens: call.totalTokens,
      error: call.error
    }
  });
}

export async function createMemory(input: { title: string; tags: string[]; payload: unknown }) {
  return prisma.memory.create({
    data: {
      title: input.title,
      tags: input.tags.join(','),
      payloadJson: JSON.stringify(input.payload)
    }
  });
}

export async function listMemories(limit = 20) {
  return prisma.memory.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit
  });
}

export async function recallMemories(query: string, limit = 3) {
  const terms = query
    .toLowerCase()
    .split(/[\s,，。.!?！？]+/)
    .filter((term) => term.length >= 2);
  const memories = await listMemories(50);

  return memories
    .map((memory) => {
      const haystack = `${memory.title} ${memory.tags} ${memory.payloadJson}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { memory, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ memory, score }) => ({ ...memory, score }));
}
