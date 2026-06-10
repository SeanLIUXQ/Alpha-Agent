export type AgentModelRole = 'system' | 'user' | 'assistant';

export interface AgentModelMessage {
  role: AgentModelRole;
  content: string;
}

export interface AgentModelUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AgentModelResult {
  content: string;
  model: string;
  latencyMs: number;
  usage: AgentModelUsage;
}

export interface AgentModelInvoker {
  completeJson(request: {
    agentName: string;
    messages: AgentModelMessage[];
    temperature?: number;
    maxCompletionTokens?: number;
  }): Promise<AgentModelResult>;
}

export interface AgentModelCall {
  agentName: string;
  model: string;
  latencyMs: number;
  success: boolean;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  error?: string;
}

export interface AgentRunMetadata {
  source: 'model' | 'fallback' | 'replay-override';
  model?: string;
  repairAttempted?: boolean;
  error?: string;
}
