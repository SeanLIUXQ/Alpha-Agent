import { type ZodSchema } from 'zod';
import { type AgentModelCall, type AgentModelInvoker, type AgentModelMessage, type AgentModelResult } from '../model.js';

export interface StructuredModelResult<T> {
  data: T;
  raw: AgentModelResult;
  repairAttempted: boolean;
  calls: AgentModelCall[];
}

export async function runStructuredJson<T>(
  model: AgentModelInvoker,
  options: {
    agentName: string;
    messages: AgentModelMessage[];
    schema: ZodSchema<T>;
    repairSystemPrompt: string;
    temperature?: number;
    maxCompletionTokens?: number;
  },
): Promise<StructuredModelResult<T>> {
  const first = await completeAndParse(model, options);
  if (first.data) {
    return {
      data: first.data,
      raw: first.raw,
      repairAttempted: false,
      calls: [first.call]
    };
  }

  const repair = await completeAndParse(model, {
    ...options,
    messages: [
      {
        role: 'system',
        content: options.repairSystemPrompt
      },
      {
        role: 'user',
        content: [
          'The previous JSON failed validation.',
          `Validation error: ${first.error}`,
          'Return a corrected JSON object only.',
          'Previous JSON:',
          first.raw.content
        ].join('\n')
      }
    ],
    temperature: 0
  });

  if (repair.data) {
    return {
      data: repair.data,
      raw: repair.raw,
      repairAttempted: true,
      calls: [first.call, repair.call]
    };
  }

  throw new Error(`Structured JSON validation failed after repair: ${repair.error}`);
}

async function completeAndParse<T>(
  model: AgentModelInvoker,
  options: {
    agentName: string;
    messages: AgentModelMessage[];
    schema: ZodSchema<T>;
    temperature?: number;
    maxCompletionTokens?: number;
  },
): Promise<
  | { data: T; raw: AgentModelResult; call: AgentModelCall; error?: never }
  | { data?: never; raw: AgentModelResult; call: AgentModelCall; error: string }
> {
  const raw = await model.completeJson({
    agentName: options.agentName,
    messages: options.messages,
    temperature: options.temperature,
    maxCompletionTokens: options.maxCompletionTokens
  });

  try {
    const parsed = JSON.parse(extractJsonObject(raw.content));
    return {
      data: options.schema.parse(parsed),
      raw,
      call: modelCallFromResult(options.agentName, raw, true)
    };
  } catch (error) {
    return {
      raw,
      call: modelCallFromResult(options.agentName, raw, false, error),
      error: error instanceof Error ? error.message : 'Unknown JSON validation error'
    };
  }
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return extractJsonObject(fenced[1]);
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error('Model response did not contain a JSON object');
}

function modelCallFromResult(agentName: string, result: AgentModelResult, success: boolean, error?: unknown): AgentModelCall {
  return {
    agentName,
    model: result.model,
    latencyMs: result.latencyMs,
    success,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    totalTokens: result.usage.totalTokens,
    error: success ? undefined : error instanceof Error ? error.message : 'Unknown structured JSON error'
  };
}
