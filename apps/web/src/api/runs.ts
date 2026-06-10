export interface DemoRunResponse {
  runId: string;
  success: boolean;
}

export interface RunResponse {
  id: string;
  title: string;
  status: string;
  currentStage: string;
  events: RunEventResponse[];
}

export interface CreateRunResponse {
  run: RunResponse;
  result: {
    success: boolean;
    status: string;
  };
}

export interface ClarifyAnswer {
  questionId: string;
  answer: string;
}

export interface RunEventResponse {
  id: string;
  runId: string;
  seq: number;
  type: string;
  stage: string | null;
  payloadJson: string;
  createdAt: string;
}

export interface SkillResponse {
  name: string;
  version: string;
  description?: string;
  tags: string[];
}

export interface ModelCallResponse {
  id: string;
  agentName: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
  success: boolean;
  error: string | null;
  createdAt: string;
}

export interface MemoryResponse {
  id: string;
  title: string;
  tags: string;
  payloadJson: string;
  score?: number;
}

export interface SandboxVerifyResponse {
  success: boolean;
  attempts: number;
  commands: Array<{
    command: string;
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>;
}

export interface ConduitRealDbFlowResponse {
  success: boolean;
  previewMode: boolean;
  username: string;
  publishedSlug: string;
  draftSlug: string;
  steps: Array<{
    name: string;
    ok: boolean;
    detail: string;
  }>;
}

export interface PullRequestPreflightResponse {
  ready: boolean;
  repoPath: string;
  repo?: { owner: string; repo: string } | null;
  base: string;
  branch: string;
  changedFiles: string[];
  selectedFiles: string[];
  ghAvailable: boolean;
  checks: Array<{
    key: string;
    ok: boolean;
    message: string;
  }>;
}

export interface PullRequestCreateResponse {
  created: boolean;
  blocked: boolean;
  reason?: string;
  prUrl?: string;
  branch?: string;
  base?: string;
  committedFiles?: string[];
  preflight?: PullRequestPreflightResponse;
}

async function toErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? `${fallback}: ${response.status}`;
  } catch {
    return `${fallback}: ${response.status}`;
  }
}

export async function startArticleReadingStatsDemo(): Promise<DemoRunResponse> {
  const response = await fetch('/api/demo/l1/article-reading-stats', { method: 'POST' });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Demo run failed'));
  }

  return (await response.json()) as DemoRunResponse;
}

export async function createRun(requirement: string): Promise<CreateRunResponse> {
  const response = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirement, async: true })
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Create run failed'));
  }

  return (await response.json()) as CreateRunResponse;
}

export async function fetchRun(runId: string): Promise<RunResponse> {
  const response = await fetch(`/api/runs/${runId}`);
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Fetch run failed'));
  }

  return (await response.json()) as RunResponse;
}

export async function fetchRunEvents(runId: string): Promise<RunEventResponse[]> {
  const response = await fetch(`/api/runs/${runId}/events`);
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Fetch run events failed'));
  }

  return (await response.json()) as RunEventResponse[];
}

export interface ReplayRunInput {
  fromStage?: string;
  overridePayload?: unknown;
  async?: boolean;
}

export async function replayRun(runId: string, input: string | ReplayRunInput = 'plan'): Promise<CreateRunResponse> {
  const payload = typeof input === 'string' ? { fromStage: input } : input;
  const response = await fetch(`/api/runs/${runId}/replay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Replay run failed'));
  }

  return (await response.json()) as CreateRunResponse;
}

export async function retryRun(runId: string): Promise<CreateRunResponse> {
  const response = await fetch(`/api/runs/${runId}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ async: true })
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Retry run failed'));
  }

  return (await response.json()) as CreateRunResponse;
}

export async function answerRun(runId: string, answers: ClarifyAnswer[]): Promise<CreateRunResponse> {
  const response = await fetch(`/api/runs/${runId}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, async: true })
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Submit clarification answers failed'));
  }

  return (await response.json()) as CreateRunResponse;
}

export async function approvePlan(runId: string, approved = true, note?: string): Promise<RunResponse> {
  const response = await fetch(`/api/runs/${runId}/approve-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved, note })
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Approve plan failed'));
  }

  return (await response.json()) as RunResponse;
}

export async function fetchSkills(): Promise<SkillResponse[]> {
  const response = await fetch('/api/skills');
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Fetch skills failed'));
  }

  return ((await response.json()) as { skills: SkillResponse[] }).skills;
}

export async function fetchModelCalls(runId: string): Promise<ModelCallResponse[]> {
  const response = await fetch(`/api/runs/${runId}/model-calls`);
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Fetch model calls failed'));
  }

  return ((await response.json()) as { modelCalls: ModelCallResponse[] }).modelCalls;
}

export async function fetchMemories(query?: string): Promise<MemoryResponse[]> {
  const response = await fetch(query ? `/api/memories?q=${encodeURIComponent(query)}` : '/api/memories');
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Fetch memories failed'));
  }

  return ((await response.json()) as { memories: MemoryResponse[] }).memories;
}

export async function verifySandbox(commands?: string[]): Promise<SandboxVerifyResponse> {
  const response = await fetch('/api/sandbox/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(commands ? { commands } : {})
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Sandbox verification failed'));
  }

  return (await response.json()) as SandboxVerifyResponse;
}

export async function runConduitRealDbFlow(): Promise<ConduitRealDbFlowResponse> {
  const response = await fetch('/api/sandbox/real-db-flow', { method: 'POST' });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Conduit real DB flow failed'));
  }

  return (await response.json()) as ConduitRealDbFlowResponse;
}

export async function fetchPullRequestPreflight(input: {
  title?: string;
  base?: string;
  files?: string[];
}): Promise<PullRequestPreflightResponse> {
  const params = new URLSearchParams();
  if (input.title) params.set('title', input.title);
  if (input.base) params.set('base', input.base);
  if (input.files?.length) params.set('files', input.files.join(','));

  const response = await fetch(`/api/pr/preflight?${params.toString()}`);
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Fetch PR preflight failed'));
  }

  return (await response.json()) as PullRequestPreflightResponse;
}

export async function createPullRequest(input: {
  title: string;
  body: string;
  base?: string;
  branch?: string;
  draft?: boolean;
  files?: string[];
}): Promise<PullRequestCreateResponse> {
  const response = await fetch('/api/pr/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error(await toErrorMessage(response, 'Create PR failed'));
  }

  return (await response.json()) as PullRequestCreateResponse;
}
