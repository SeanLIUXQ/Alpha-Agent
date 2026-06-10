import { useEffect, useMemo, useState } from 'react';
import { fetchHealth, type HealthResponse } from './api/health';
import {
  approvePlan,
  createRun,
  fetchModelCalls,
  fetchRun,
  fetchRunEvents,
  fetchSkills,
  replayRun,
  retryRun,
  type CreateRunResponse,
  type ModelCallResponse,
  type RunEventResponse,
  type SkillResponse
} from './api/runs';
import './styles.css';

type Route =
  | { name: 'home' }
  | { name: 'run-detail'; runId: string }
  | { name: 'skills' }
  | { name: 'settings' };

type HealthState =
  | { status: 'checking' }
  | { status: 'online'; data: HealthResponse }
  | { status: 'offline'; error: string };

const conduitBaseUrl = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CONDUIT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const conduitApiUrl = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CONDUIT_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const inputCostUsdPer1k = Number((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_MODEL_INPUT_USD_PER_1K ?? '0.00015');
const outputCostUsdPer1k = Number((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_MODEL_OUTPUT_USD_PER_1K ?? '0.00060');
const conduitDefaultPreviewHash = '#/';

const defaultRequirement = '在文章列表页每篇文章摘要后面显示“阅读全文”提示文案。';
const stageLabels = ['created', 'clarify', 'plan', 'locate', 'generate', 'apply', 'verify', 'repair', 'handoff'];
type WorkbenchStatus = 'idle' | 'creating' | 'running' | 'requires_input' | 'completed' | 'failed';
type EventTransport = 'idle' | 'sse' | 'polling';

interface WorkbenchSnapshot {
  requirement: string;
  runId: string | null;
  events: RunEventResponse[];
  status: WorkbenchStatus;
  error: string | null;
}

const workbenchSnapshotKey = 'alpha-agent-workbench-snapshot-v2';
const stageNames: Record<string, string> = {
  created: '创建',
  clarify: '澄清',
  plan: '规划',
  locate: '定位',
  generate: '生成',
  apply: '应用',
  verify: '验证',
  repair: '修复',
  handoff: '交付'
};

function currentRoute(): Route {
  const pathname = window.location.pathname;
  const runMatch = pathname.match(/^\/runs\/([^/]+)$/);
  if (runMatch) {
    return { name: 'run-detail', runId: decodeURIComponent(runMatch[1]) };
  }
  if (pathname === '/skills') return { name: 'skills' };
  if (pathname === '/settings') return { name: 'settings' };
  return { name: 'home' };
}

function formatError(error: unknown) {
  if (error instanceof TypeError) {
    return '无法连接到 alpha-agent-server，请确认服务已启动。';
  }
  return error instanceof Error ? error.message : '未知错误';
}

function defaultWorkbenchSnapshot(): WorkbenchSnapshot {
  return {
    requirement: defaultRequirement,
    runId: null,
    events: [],
    status: 'idle',
    error: null
  };
}

function isWorkbenchStatus(value: unknown): value is WorkbenchStatus {
  return value === 'idle' || value === 'creating' || value === 'running' || value === 'requires_input' || value === 'completed' || value === 'failed';
}

function isTerminalWorkbenchStatus(status: WorkbenchStatus) {
  return status === 'completed' || status === 'failed' || status === 'requires_input';
}

function statusFromRunEvent(event: RunEventResponse): WorkbenchStatus | null {
  if (event.type === 'stage.completed') return 'completed';
  if (event.type === 'stage.failed' || event.type === 'run.failed') return 'failed';
  if (
    event.type === 'clarify.questions' ||
    event.type === 'skill.match.requires_input' ||
    event.type === 'verify.requires_input' ||
    event.type === 'run.recovery_required'
  ) {
    return 'requires_input';
  }
  if (event.type === 'run.created' || event.type.startsWith('stage.')) return 'running';
  return null;
}

function mergeRunEvents(currentEvents: RunEventResponse[], incomingEvents: RunEventResponse[]) {
  const bySeq = new Map<number, RunEventResponse>();
  for (const event of currentEvents) {
    bySeq.set(event.seq, event);
  }
  for (const event of incomingEvents) {
    bySeq.set(event.seq, event);
  }
  return Array.from(bySeq.values()).sort((left, right) => left.seq - right.seq);
}

function readWorkbenchSnapshot(): WorkbenchSnapshot {
  try {
    const raw = window.sessionStorage.getItem(workbenchSnapshotKey);
    if (!raw) return defaultWorkbenchSnapshot();

    const parsed = JSON.parse(raw) as Partial<WorkbenchSnapshot>;
    const runId = typeof parsed.runId === 'string' ? parsed.runId : null;
    const status = isWorkbenchStatus(parsed.status) ? parsed.status : 'idle';
    const restoredStatus = runId ? status : 'idle';
    if (restoredStatus === 'requires_input' || restoredStatus === 'failed') {
      return {
        requirement: typeof parsed.requirement === 'string' ? parsed.requirement : defaultRequirement,
        runId: null,
        events: [],
        status: 'idle',
        error: null
      };
    }

    return {
      requirement: typeof parsed.requirement === 'string' ? parsed.requirement : defaultRequirement,
      runId,
      events: Array.isArray(parsed.events) ? parsed.events : [],
      status: restoredStatus,
      error: typeof parsed.error === 'string' ? parsed.error : null
    };
  } catch {
    window.sessionStorage.removeItem(workbenchSnapshotKey);
    return defaultWorkbenchSnapshot();
  }
}

function writeWorkbenchSnapshot(snapshot: WorkbenchSnapshot) {
  window.sessionStorage.setItem(workbenchSnapshotKey, JSON.stringify(snapshot));
}

function parsePayload<T>(event: RunEventResponse | undefined): T {
  if (!event) return {} as T;
  try {
    return JSON.parse(event.payloadJson) as T;
  } catch {
    return {} as T;
  }
}

function compactJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function eventTime(event: RunEventResponse | undefined) {
  return event ? new Date(event.createdAt).getTime() : undefined;
}

function durationBetween(start: RunEventResponse | undefined, end: RunEventResponse | undefined) {
  const startedAt = eventTime(start);
  const endedAt = eventTime(end);
  if (startedAt === undefined || endedAt === undefined || endedAt < startedAt) return undefined;
  return endedAt - startedAt;
}

function formatDuration(ms: number | undefined) {
  if (ms === undefined) return '暂无数据';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatPercent(value: number | undefined) {
  return value === undefined ? '暂无数据' : `${value.toFixed(0)}%`;
}

function formatUsd(value: number) {
  return `$${value.toFixed(value < 0.01 ? 5 : 2)}`;
}

function calculateRunObservability(events: RunEventResponse[], modelCalls: ModelCallResponse[]) {
  const promptTokens = modelCalls.reduce((sum, call) => sum + (call.promptTokens ?? 0), 0);
  const completionTokens = modelCalls.reduce((sum, call) => sum + (call.completionTokens ?? 0), 0);
  const totalTokens = modelCalls.reduce((sum, call) => sum + (call.totalTokens ?? 0), 0);
  const successfulCalls = modelCalls.filter((call) => call.success).length;
  const modelSuccessRate = modelCalls.length ? (successfulCalls / modelCalls.length) * 100 : undefined;
  const avgLatencyMs = modelCalls.length
    ? Math.round(modelCalls.reduce((sum, call) => sum + call.latencyMs, 0) / modelCalls.length)
    : undefined;
  const estimatedCostUsd =
    (promptTokens / 1000) * inputCostUsdPer1k +
    (completionTokens / 1000) * outputCostUsdPer1k;

  const verifyDurationMs = durationBetween(
    events.find((event) => event.type === 'stage.verifying'),
    events.find((event) => event.type === 'verify.completed'),
  );
  const repairAttempts = events.filter((event) => event.type === 'repair.reviewed').length;
  const runDurationMs = durationBetween(events[0], events[events.length - 1]);
  const stageEvents = events.filter((event) => event.type.startsWith('stage.'));
  const stageTrend = stageEvents
    .map((event, index) => ({
      label: event.type.replace('stage.', ''),
      durationMs: durationBetween(event, stageEvents[index + 1] ?? events[events.length - 1])
    }))
    .filter((item): item is { label: string; durationMs: number } => item.durationMs !== undefined);
  const maxStageDuration = Math.max(1, ...stageTrend.map((item) => item.durationMs));

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd,
    modelSuccessRate,
    avgLatencyMs,
    verifyDurationMs,
    repairAttempts,
    runDurationMs,
    stageTrend,
    maxStageDuration
  };
}

function progressPercent(events: RunEventResponse[]) {
  const completed = stageLabels.filter((stage) => events.some((event) => replayStageFor(event).startsWith(stage) || event.type.startsWith(stage))).length;
  return Math.round((completed / stageLabels.length) * 100);
}

function replayStageFor(event: RunEventResponse) {
  if (event.type === 'clarify.completed') return 'clarify';
  if (event.type === 'plan.completed') return 'plan';
  if (event.type.startsWith('locate')) return 'locate';
  if (event.type.startsWith('generate')) return 'generate';
  if (event.type.startsWith('apply')) return 'apply';
  if (event.type.startsWith('verify')) return 'verify';
  if (event.type.startsWith('repair')) return 'repair';
  if (event.type.startsWith('handoff')) return 'handoff';
  return event.stage ?? event.type.split('.')[0] ?? 'plan';
}

function replayDraftFor(event: RunEventResponse) {
  const payload = parsePayload<Record<string, unknown>>(event);
  if (event.type === 'clarify.completed' && payload.dsl) {
    return {
      mode: 'dsl' as const,
      title: '编辑 Clarify DSL',
      help: '可修改结构化需求，系统会从该阶段重新执行下游流程。',
      draft: prettyJson(payload.dsl)
    };
  }
  if (event.type === 'plan.completed' && payload.plan) {
    return {
      mode: 'plan' as const,
      title: '编辑 Plan',
      help: '可调整候选文件、验证命令或交付策略后重新执行。',
      draft: prettyJson(payload.plan)
    };
  }
  return {
    mode: 'stage' as const,
    title: `查看 ${event.type}`,
    help: '该阶段没有可编辑 DSL/Plan，将按当前事件状态创建 replay Run。',
    draft: prettyJson(payload)
  };
}

export function App() {
  const route = currentRoute();
  if (route.name === 'run-detail') return <RunDetailPage runId={route.runId} />;
  if (route.name === 'skills') return <SkillsPage />;
  if (route.name === 'settings') return <SettingsPage />;
  return <WorkbenchHome />;
}

function RouteHeader({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <section className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <nav className="top-links" aria-label="主导航">
          <a href="/">工作台</a>
          <a href="/skills">Skills</a>
          <a href="/settings">Settings</a>
          <a href={conduitBaseUrl} target="_blank" rel="noreferrer">Conduit 预览</a>
        </nav>
      </div>
    </section>
  );
}

function WorkbenchHome() {
  const [initialSnapshot] = useState(readWorkbenchSnapshot);
  const [requirement, setRequirement] = useState(initialSnapshot.requirement);
  const [runId, setRunId] = useState<string | null>(initialSnapshot.runId);
  const [events, setEvents] = useState<RunEventResponse[]>(initialSnapshot.events);
  const [status, setStatus] = useState<WorkbenchStatus>(initialSnapshot.status);
  const [error, setError] = useState<string | null>(initialSnapshot.error);
  const [eventTransport, setEventTransport] = useState<EventTransport>('idle');
  const [previewHash] = useState(conduitDefaultPreviewHash);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const previewUrl = `${conduitBaseUrl}/${previewHash}`;

  useEffect(() => {
    writeWorkbenchSnapshot({ requirement, runId, events, status, error });
  }, [requirement, runId, events, status, error]);

  useEffect(() => {
    if (!runId) return;

    let cancelled = false;
    const activeRunId = runId;
    async function refreshCurrentRun() {
      try {
        const [nextRun, nextEvents] = await Promise.all([fetchRun(activeRunId), fetchRunEvents(activeRunId)]);
        if (cancelled) return;

        setEvents(nextEvents);
        if (nextRun.status === 'completed' || nextRun.status === 'failed' || nextRun.status === 'requires_input') {
          setStatus(nextRun.status);
        } else {
          setStatus((currentStatus) => (currentStatus === 'creating' || currentStatus === 'idle' ? 'running' : currentStatus));
        }
      } catch (refreshError) {
        if (!cancelled) setError(formatError(refreshError));
      }
    }

    void refreshCurrentRun();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (!runId || isTerminalWorkbenchStatus(status)) {
      setEventTransport('idle');
      return;
    }

    let cancelled = false;
    let fallbackTimer: number | undefined;
    let source: EventSource | null = null;

    const refreshFromHttp = async () => {
      try {
        const [nextRun, nextEvents] = await Promise.all([fetchRun(runId), fetchRunEvents(runId)]);
        if (cancelled) return;
        setEvents(nextEvents);
        if (nextRun.status === 'completed' || nextRun.status === 'failed' || nextRun.status === 'requires_input') {
          setStatus(nextRun.status);
        } else {
          setStatus('running');
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(formatError(pollError));
        }
      }
    };

    const startPollingFallback = () => {
      if (fallbackTimer !== undefined || cancelled) return;
      source?.close();
      source = null;
      setEventTransport('polling');
      void refreshFromHttp();
      fallbackTimer = window.setInterval(() => {
        void refreshFromHttp();
      }, 1200);
    };

    if (typeof EventSource === 'undefined') {
      startPollingFallback();
      return () => {
        cancelled = true;
        if (fallbackTimer !== undefined) window.clearInterval(fallbackTimer);
      };
    }

    source = new EventSource(`/api/runs/${encodeURIComponent(runId)}/stream`);
    source.addEventListener('open', () => {
      if (cancelled) return;
      setEventTransport('sse');
      setError(null);
    });
    source.addEventListener('run-event', (message) => {
      if (cancelled) return;
      try {
        const event = JSON.parse((message as MessageEvent<string>).data) as RunEventResponse;
        setEvents((currentEvents) => mergeRunEvents(currentEvents, [event]));
        const nextStatus = statusFromRunEvent(event);
        if (nextStatus) setStatus(nextStatus);
      } catch (streamError) {
        setError(formatError(streamError));
        startPollingFallback();
      }
    });
    source.addEventListener('end', () => {
      source?.close();
      source = null;
      void refreshFromHttp();
    });
    source.onerror = () => {
      if (!cancelled) startPollingFallback();
    };

    return () => {
      cancelled = true;
      source?.close();
      if (fallbackTimer !== undefined) window.clearInterval(fallbackTimer);
    };
  }, [runId, status]);

  async function startRun() {
    setStatus('creating');
    setError(null);
    setEventTransport('idle');
    setEvents([]);
    setRunId(null);
    try {
      const response = await createRun(requirement);
      setRunId(response.run.id);
      setEvents(response.run.events ?? []);
      setStatus('running');
    } catch (createError) {
      setError(formatError(createError));
      setStatus('failed');
      setEventTransport('idle');
    }
  }

  async function retryCurrentRun() {
    if (!runId) return;

    setStatus('creating');
    setError(null);
    setEventTransport('idle');
    try {
      const response = await retryRun(runId);
      setRunId(response.run.id);
      setEvents(response.run.events ?? []);
      setStatus('running');
    } catch (retryError) {
      setError(formatError(retryError));
      setStatus('failed');
      setEventTransport('idle');
    }
  }

  function updateRequirement(nextRequirement: string) {
    setRequirement(nextRequirement);
    if (status !== 'creating' && status !== 'running') {
      setRunId(null);
      setEvents([]);
      setStatus('idle');
      setError(null);
      setEventTransport('idle');
    }
  }

  const latestEvent = events[events.length - 1];

  useEffect(() => {
    if (!latestEvent) return;
    if (
      latestEvent.type.startsWith('apply.') ||
      latestEvent.type.startsWith('repair.apply') ||
      latestEvent.type.startsWith('repair.verify') ||
      latestEvent.type.startsWith('verify.') ||
      latestEvent.type.startsWith('handoff.')
    ) {
      setPreviewRefreshKey((key) => key + 1);
    }
  }, [latestEvent]);

  return (
    <main className="shell">
      <RouteHeader title="需求交付控制台" eyebrow="Alpha Agent Workbench" />
      <section className="workspace visual-workspace">
        <section className="command-panel command-stack">
          <div className="section-heading">
            <span>01</span>
            <h2>输入需求</h2>
          </div>
          <textarea value={requirement} onChange={(event) => updateRequirement(event.target.value)} />
          <div className="button-row">
            <button type="button" disabled={status === 'creating' || status === 'running'} onClick={startRun}>
              {status === 'creating' || status === 'running' ? '运行中' : '创建 Run'}
            </button>
            {runId && (
              <a className="replay-link" href={`/runs/${runId}`}>
                打开详情
              </a>
            )}
            {runId && (status === 'requires_input' || status === 'failed') && (
              <button className="secondary-action" type="button" onClick={retryCurrentRun}>
                重试
              </button>
            )}
          </div>
          {error && <p className="inline-error">{error}</p>}
        </section>

        <section className="result-board delivery-stack">
          <div className="section-heading">
            <span>02</span>
            <h2>交付结果</h2>
          </div>
          <div className="summary-grid">
            <div>
              <span>状态</span>
              <strong>{status}</strong>
            </div>
            <div>
              <span>Run</span>
              <strong>{runId ?? '未创建'}</strong>
            </div>
            <div>
              <span>事件</span>
              <strong>{events.length}</strong>
            </div>
            <div>
              <span>事件通道</span>
              <strong>{eventTransport === 'sse' ? 'SSE' : eventTransport === 'polling' ? '轮询兜底' : '待命'}</strong>
            </div>
          </div>
          <div className="progress-track">
            <span style={{ transform: `scaleX(${progressPercent(events) / 100})` }} />
          </div>
          <ul className="stage-rail">
            {stageLabels.map((stage) => (
              <li className={events.some((event) => replayStageFor(event).startsWith(stage) || event.type.startsWith(stage)) ? 'done' : ''} key={stage}>
                <span>{stageNames[stage]}</span>
              </li>
            ))}
          </ul>
          <article className="visual-card wide">
            <h3>最新事件</h3>
            <p>{latestEvent ? `${latestEvent.seq}. ${latestEvent.type}` : '创建 Run 后显示事件流'}</p>
          </article>
        </section>

        <aside className="workspace-stack insights-stack">
          <section className="insight-block">
            <div className="section-heading compact">
              <span>03</span>
                <h2>Conduit 地址</h2>
            </div>
            <p>前端：{conduitBaseUrl}</p>
            <p>API?{conduitApiUrl}</p>
          </section>
          <section className="insight-block">
            <div className="section-heading compact">
              <span>04</span>
              <h2>断点重放</h2>
            </div>
            <p>Run 详情页支持从任意阶段重放，并可编辑 Clarify DSL 或 Plan 后继续执行下游。</p>
          </section>
        </aside>

        <section className="sandbox-preview">
          <div className="preview-toolbar">
            <div>
              <div className="section-heading compact">
                <span>03</span>
                <h2>Conduit 实时预览</h2>
              </div>
              <p>
                {previewUrl}
                <span className={`inline-status ${status === 'running' || status === 'creating' ? 'online' : ''}`}>
                  {status === 'running' || status === 'creating' ? 'Run 运行中，自动刷新预览' : `已刷新 ${previewRefreshKey} 次`}
                </span>
              </p>
            </div>
            <div className="preview-actions">
              <button type="button" onClick={() => setPreviewRefreshKey((key) => key + 1)}>
                刷新
              </button>
              <a href={previewUrl} target="_blank" rel="noreferrer">
                新窗口
              </a>
            </div>
          </div>
          <iframe
            key={`${previewHash}-${previewRefreshKey}`}
            allow="clipboard-read; clipboard-write"
            title="Conduit 实时预览"
            src={previewUrl}
          />
        </section>

        <section className="event-panel">
          <div className="section-heading">
            <span>05</span>
            <h2>事件日志</h2>
          </div>
          <pre>{events.map((event) => `${event.seq}. ${event.type}\n${compactJson(event.payloadJson)}`).join('\n\n') || '暂无事件'}</pre>
        </section>
      </section>
    </main>
  );
}

function RunDetailPage({ runId }: { runId: string }) {
  const [run, setRun] = useState<Awaited<ReturnType<typeof fetchRun>> | null>(null);
  const [events, setEvents] = useState<RunEventResponse[]>([]);
  const [modelCalls, setModelCalls] = useState<ModelCallResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [approvalState, setApprovalState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [selectedReplay, setSelectedReplay] = useState<{
    event: RunEventResponse;
    fromStage: string;
    mode: 'dsl' | 'plan' | 'stage';
    title: string;
    help: string;
  } | null>(null);
  const [replayDraft, setReplayDraft] = useState('');
  const [replayState, setReplayState] = useState<'idle' | 'running' | 'created' | 'failed'>('idle');
  const [replayResult, setReplayResult] = useState<CreateRunResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextRun, nextEvents, nextCalls] = await Promise.all([
          fetchRun(runId),
          fetchRunEvents(runId),
          fetchModelCalls(runId)
        ]);
        if (!cancelled) {
          setRun(nextRun);
          setEvents(nextEvents);
          setModelCalls(nextCalls);
        }
      } catch (loadError) {
        if (!cancelled) setError(formatError(loadError));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function submitApproval(approved: boolean) {
    setApprovalState('saving');
    try {
      const nextRun = await approvePlan(runId, approved);
      setRun(nextRun);
      setEvents(nextRun.events);
      setApprovalState('saved');
    } catch (approvalError) {
      setError(formatError(approvalError));
      setApprovalState('idle');
    }
  }

  function selectReplayPoint(event: RunEventResponse) {
    const draft = replayDraftFor(event);
    setSelectedReplay({
      event,
      fromStage: replayStageFor(event),
      mode: draft.mode,
      title: draft.title,
      help: draft.help
    });
    setReplayDraft(draft.draft);
    setReplayResult(null);
    setReplayState('idle');
  }

  async function submitReplay() {
    if (!selectedReplay) return;

    setReplayState('running');
    setReplayResult(null);
    try {
      let overridePayload: unknown;
      if (selectedReplay.mode === 'dsl' || selectedReplay.mode === 'plan') {
        overridePayload = JSON.parse(replayDraft);
      }
      const result = await replayRun(runId, {
        fromStage: selectedReplay.fromStage,
        overridePayload
      });
      setReplayResult(result);
      setReplayState('created');
    } catch (replayError) {
      setError(formatError(replayError));
      setReplayState('failed');
    }
  }

  const stages = useMemo(() => events.map((event) => ({ event, draft: replayDraftFor(event), stage: replayStageFor(event) })), [events]);
  const observability = useMemo(() => calculateRunObservability(events, modelCalls), [events, modelCalls]);

  return (
    <main className="shell route-shell">
      <RouteHeader title="Run 详情" eyebrow="Run Detail" />
      <section className="route-grid">
        <article className="visual-card wide">
          <h3>{run?.title ?? runId}</h3>
          <p>状态：{run?.status ?? '加载中'}，事件：{events.length}，模型调用：{modelCalls.length}</p>
          <div className="button-row">
            <button type="button" disabled={approvalState === 'saving'} onClick={() => submitApproval(true)}>
              {approvalState === 'saving' ? '保存中' : '批准 Plan'}
            </button>
            <button className="secondary-action" type="button" disabled={approvalState === 'saving'} onClick={() => submitApproval(false)}>
              拒绝 Plan
            </button>
          </div>
          {approvalState === 'saved' && <p className="hint">Plan 审批结果已保存到当前 Run。</p>}
          {error && <p className="inline-error">{error}</p>}
        </article>

        <article className="visual-card wide">
          <div className="replay-header">
            <div>
              <h3>成本与质量观测</h3>
              <p>汇总当前 Run 的模型成本、成功率、耗时和修复次数。</p>
            </div>
            <span className="result-badge">{formatDuration(observability.runDurationMs)}</span>
          </div>
          <div className="observability-grid">
            <div>
              <span>本次成本</span>
              <strong>{formatUsd(observability.estimatedCostUsd)}</strong>
              <small>{observability.totalTokens.toLocaleString()} tokens</small>
            </div>
            <div>
              <span>模型成功率</span>
              <strong>{formatPercent(observability.modelSuccessRate)}</strong>
              <small>{modelCalls.filter((call) => call.success).length}/{modelCalls.length} calls</small>
            </div>
            <div>
              <span>平均延迟</span>
              <strong>{formatDuration(observability.avgLatencyMs)}</strong>
              <small>模型调用平均值</small>
            </div>
            <div>
              <span>验证耗时</span>
              <strong>{formatDuration(observability.verifyDurationMs)}</strong>
              <small>stage.verifying ? verify.completed</small>
            </div>
            <div>
              <span>Repair 次数</span>
              <strong>{observability.repairAttempts}</strong>
              <small>repair.reviewed 事件数</small>
            </div>
            <div>
              <span>Token 用量</span>
              <strong>{observability.promptTokens.toLocaleString()} / {observability.completionTokens.toLocaleString()}</strong>
              <small>input / output</small>
            </div>
          </div>
          <div className="stage-duration-panel">
            <strong>阶段耗时趋势</strong>
            <ul>
              {observability.stageTrend.length === 0 ? (
                <li>
                  <span>暂无阶段耗时</span>
                  <em>暂无数据</em>
                </li>
              ) : (
                observability.stageTrend.map((item) => (
                  <li key={`${item.label}-${item.durationMs}`}>
                    <span>{item.label}</span>
                    <div>
                      <i style={{ transform: `scaleX(${Math.max(0.04, item.durationMs / observability.maxStageDuration)})` }} />
                    </div>
                    <em>{formatDuration(item.durationMs)}</em>
                  </li>
                ))
              )}
            </ul>
          </div>
        </article>

        <article className="visual-card wide">
          <div className="replay-header">
            <div>
              <h3>断点重放</h3>
              <p>选择任意阶段作为重放起点，可编辑 Clarify DSL 或 Plan 后重新执行下游。</p>
            </div>
            {replayResult && (
              <a className="replay-link" href={`/runs/${replayResult.run.id}`}>
                打开 Run
              </a>
            )}
          </div>
          <ol className="replay-timeline">
            {stages.length === 0 ? (
              <li className="replay-empty">暂无事件</li>
            ) : (
              stages.map(({ event, draft, stage }) => {
                const active = selectedReplay?.event.id === event.id;
                return (
                  <li className={`replay-row${active ? ' active' : ''}`} key={event.id}>
                    <div className="replay-node">
                      <strong>{event.seq}</strong>
                      <span>{stage}</span>
                    </div>
                    <div className="replay-main">
                      <div>
                        <strong>{event.type}</strong>
                        <small>{event.createdAt}</small>
                      </div>
                      <span className={`replay-badge ${draft.mode}`}>
                        {draft.mode === 'dsl' ? '编辑 DSL' : draft.mode === 'plan' ? '编辑 Plan' : '查看事件'}
                      </span>
                    </div>
                    <button className="secondary-action" type="button" onClick={() => selectReplayPoint(event)}>
                      从此处重放
                    </button>
                  </li>
                );
              })
            )}
          </ol>
          {selectedReplay && (
            <div className="replay-editor">
              <div>
                <h4>{selectedReplay.title}</h4>
                <p>{selectedReplay.help}</p>
              </div>
              <textarea
                value={replayDraft}
                readOnly={selectedReplay.mode === 'stage'}
                spellCheck={false}
                onChange={(event) => setReplayDraft(event.target.value)}
              />
              <div className="button-row">
                <button type="button" disabled={replayState === 'running'} onClick={submitReplay}>
                  {replayState === 'running' ? '重放中' : '创建 Replay Run'}
                </button>
                <button className="secondary-action" type="button" onClick={() => setSelectedReplay(null)}>
                  取消
                </button>
              </div>
              {replayState === 'created' && replayResult && <p className="hint">已创建 replay Run：{replayResult.run.id}</p>}
              {replayState === 'failed' && <p className="inline-error">重放失败，请确认 JSON 格式或 DSL/Plan 内容。</p>}
            </div>
          )}
        </article>

        <article className="visual-card wide">
          <h3>事件 JSON</h3>
          <pre className="diff-box">{events.map((event) => `${event.seq}. ${event.type}\n${compactJson(event.payloadJson)}`).join('\n\n') || '暂无事件'}</pre>
        </article>
      </section>
    </main>
  );
}

function SkillsPage() {
  const [skills, setSkills] = useState<SkillResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSkills().then(setSkills).catch((loadError: unknown) => setError(formatError(loadError)));
  }, []);

  return (
    <main className="shell route-shell">
      <RouteHeader title="Skill 列表" eyebrow="Skills" />
      {error && <p className="inline-error">{error}</p>}
      <section className="route-grid">
        {skills.map((skill) => (
          <article className="visual-card" key={skill.name}>
            <h3>{skill.name}</h3>
            <p>{skill.description ?? '暂无描述'}</p>
            <ul>
              {skill.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}

function SettingsPage() {
  const [health, setHealth] = useState<HealthState>({ status: 'checking' });

  useEffect(() => {
    fetchHealth()
      .then((data) => setHealth({ status: 'online', data }))
      .catch((error: unknown) => setHealth({ status: 'offline', error: formatError(error) }));
  }, []);

  return (
    <main className="shell route-shell">
      <RouteHeader title="系统设置" eyebrow="Settings" />
      <section className="route-grid">
        <article className="visual-card">
          <h3>服务状态</h3>
          <p>{health.status === 'online' ? `已连接：${health.data.service}` : health.status === 'checking' ? '检查中' : health.error}</p>
        </article>
        <article className="visual-card">
          <h3>Conduit</h3>
          <p>前端：{conduitBaseUrl}</p>
          <p>API：{conduitApiUrl}</p>
        </article>
      </section>
    </main>
  );
}
