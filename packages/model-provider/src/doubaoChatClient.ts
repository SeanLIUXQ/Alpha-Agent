import type {
  ChatCompletionRequest,
  ChatCompletionResult,
  ChatCompletionStreamEvent,
  ModelClient,
  TokenUsage
} from './types.js';

interface DoubaoChatClientOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}

interface ChatCompletionsResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

interface ChatCompletionsStreamChunk {
  model?: string;
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

export class DoubaoChatClient implements ModelClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: DoubaoChatClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
          max_completion_tokens: request.maxCompletionTokens,
          thinking: request.thinking ? { type: request.thinking } : undefined,
          response_format:
            request.responseFormat === 'json_object' ? { type: 'json_object' } : undefined
        })
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Doubao request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const body = (await this.readJsonResponse(response)) as ChatCompletionsResponse;

    if (!response.ok) {
      throw new Error(body.error?.message ?? `Doubao request failed with ${response.status}`);
    }

    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Doubao response did not contain assistant content');
    }

    return {
      content,
      model: body.model ?? this.model,
      latencyMs: Date.now() - startedAt,
      usage: {
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
        totalTokens: body.usage?.total_tokens
      }
    };
  }

  async *stream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionStreamEvent> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
          max_completion_tokens: request.maxCompletionTokens,
          thinking: request.thinking ? { type: request.thinking } : undefined,
          response_format:
            request.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
          stream: true,
          stream_options: { include_usage: true }
        })
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Doubao stream request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }

    if (!response.body) {
      throw new Error('Doubao stream response did not contain a body');
    }

    let content = '';
    let model = this.model;
    let usage: TokenUsage = {};
    const decoder = new TextDecoder();
    let buffer = '';
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const event = this.parseStreamLine(line.trim());
        if (!event) continue;
        if (event.model) model = event.model;
        if (event.usage) usage = event.usage;
        if (event.content) {
          content += event.content;
          yield { type: 'delta', content: event.content };
        }
      }
    }

    const tail = decoder.decode();
    if (tail) buffer += tail;

    const event = this.parseStreamLine(buffer.trim());
    if (event?.model) model = event.model;
    if (event?.usage) usage = event.usage;
    if (event?.content) {
      content += event.content;
      yield { type: 'delta', content: event.content };
    }

    if (!content) {
      throw new Error('Doubao stream response did not contain assistant content');
    }

    yield {
      type: 'done',
      content,
      model,
      latencyMs: Date.now() - startedAt,
      usage
    };
  }

  private async readErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await this.readJsonResponse(response)) as ChatCompletionsResponse;
      return body.error?.message ?? `Doubao request failed with ${response.status}`;
    } catch {
      return `Doubao request failed with ${response.status}`;
    }
  }

  private async readJsonResponse(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  private parseStreamLine(line: string): { content?: string; model?: string; usage?: TokenUsage } | null {
    if (!line.startsWith('data:')) return null;

    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return null;

    const chunk = JSON.parse(data) as ChatCompletionsStreamChunk;
    if (chunk.error?.message) {
      throw new Error(chunk.error.message);
    }

    return {
      content: chunk.choices?.[0]?.delta?.content,
      model: chunk.model,
      usage: chunk.usage
        ? {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens
          }
        : undefined
    };
  }
}
