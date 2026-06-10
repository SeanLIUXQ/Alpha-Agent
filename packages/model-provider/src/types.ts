export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  responseFormat?: 'text' | 'json_object';
  maxCompletionTokens?: number;
  thinking?: 'enabled' | 'disabled';
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  latencyMs: number;
  usage: TokenUsage;
}

export type ChatCompletionStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'done'; content: string; model: string; latencyMs: number; usage: TokenUsage };

export interface ModelClient {
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
  stream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionStreamEvent>;
}
