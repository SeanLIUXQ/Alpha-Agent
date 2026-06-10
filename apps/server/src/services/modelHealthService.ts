import { DoubaoChatClient } from '@alpha-agent/model-provider';
import { prisma } from '../prisma.js';
import { readLatestModelConfig } from './agentModelInvoker.js';

export async function checkModelHealth() {
  const modelConfig = readLatestModelConfig();
  const client = new DoubaoChatClient(modelConfig);
  const startedAt = Date.now();

  try {
    const result = await client.complete({
      messages: [{ role: 'user', content: 'Reply exactly: OK' }],
      temperature: 0,
      maxCompletionTokens: 8,
      thinking: 'disabled'
    });

    await prisma.modelCall.create({
      data: {
        agentName: 'model-health',
        model: result.model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        latencyMs: result.latencyMs,
        success: true
      }
    });

    return { ok: true, model: result.model, latencyMs: result.latencyMs };
  } catch (error) {
    await prisma.modelCall.create({
      data: {
        agentName: 'model-health',
        model: modelConfig.model,
        latencyMs: Date.now() - startedAt,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown model error'
      }
    });

    throw error;
  }
}
