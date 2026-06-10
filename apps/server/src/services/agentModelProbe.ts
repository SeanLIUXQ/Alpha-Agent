import { DoubaoChatClient } from '@alpha-agent/model-provider';
import { config } from '../config.js';

const client = new DoubaoChatClient({
  baseUrl: config.DOUBAO_BASE_URL,
  model: config.DOUBAO_MODEL,
  apiKey: config.DOUBAO_API_KEY
});

export async function probeAgentModel(agentName: string, prompt: string) {
  const startedAt = Date.now();

  try {
    const result = await client.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an instrumentation probe. Reply exactly: OK'
        },
        {
          role: 'user',
          content: `${agentName}: ${prompt.slice(0, 600)}`
        }
      ],
      temperature: 0,
      maxCompletionTokens: 8,
      thinking: 'disabled'
    });

    return {
      model: result.model,
      latencyMs: result.latencyMs,
      success: true,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens
    };
  } catch (error) {
    return {
      model: config.DOUBAO_MODEL,
      latencyMs: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown model probe error'
    };
  }
}
