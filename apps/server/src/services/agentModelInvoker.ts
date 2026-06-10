import { DoubaoChatClient } from '@alpha-agent/model-provider';
import type { AgentModelInvoker } from '@alpha-agent/agent-core';
import { parseServerEnv } from '@alpha-agent/shared';
import { parse as parseDotenv } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function readLatestModelConfig() {
  const envPathCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../..', '.env')
  ];
  const envPath = envPathCandidates.find((candidate) => existsSync(candidate));
  const fileEnv = envPath ? parseDotenv(readFileSync(envPath)) : {};
  const mergedEnv = { ...process.env, ...fileEnv };
  const latest = parseServerEnv(mergedEnv);
  const timeoutMs = Number(mergedEnv.DOUBAO_TIMEOUT_MS ?? 15000);

  return {
    baseUrl: latest.DOUBAO_BASE_URL,
    model: latest.DOUBAO_MODEL,
    apiKey: latest.DOUBAO_API_KEY,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000
  };
}

function createClient() {
  const latest = readLatestModelConfig();
  return new DoubaoChatClient(latest);
}

export const agentModelInvoker: AgentModelInvoker = {
  async completeJson(request) {
    return createClient().complete({
      messages: request.messages,
      temperature: request.temperature ?? 0,
      maxCompletionTokens: request.maxCompletionTokens ?? 1200,
      thinking: 'disabled'
    });
  }
};
