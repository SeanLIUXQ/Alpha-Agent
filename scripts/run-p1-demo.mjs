import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const defaultRequirement =
  '\u5728\u6587\u7ae0\u8be6\u60c5\u9875\u6b63\u6587\u4e0b\u65b9\u663e\u793a\u672c\u6587\u5b57\u6570\u548c\u9884\u8ba1\u9605\u8bfb\u65f6\u95f4\u3002';

function loadDotEnv(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= value;
  }
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
        ...(options.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`${options.method ?? 'GET'} ${url} failed: ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHealth(baseUrl, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await requestJson(`${baseUrl}/health`, { timeoutMs: 2000 });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
}

function startServer() {
  const child = spawn(process.execPath, ['apps/server/dist/index.js'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  return child;
}

function summarizeEvent(event) {
  let payload = {};
  try {
    payload = JSON.parse(event.payloadJson);
  } catch {
    payload = {};
  }

  if (event.type === 'plan.completed') {
    return `${event.seq}. ${event.type} - ${payload.plan?.summary ?? 'plan ready'}`;
  }

  if (event.type === 'locate.completed') {
    const files = payload.context?.files?.map((file) => file.path).join(', ');
    return `${event.seq}. ${event.type} - ${files ?? 'context packed'}`;
  }

  if (event.type === 'verify.completed') {
    const commands = payload.commands?.map((command) => `${command.command}: ${command.exitCode}`).join(', ');
    return `${event.seq}. ${event.type} - success=${payload.success}; ${commands ?? ''}`;
  }

  if (event.type === 'handoff.completed') {
    return `${event.seq}. ${event.type} - ${payload.summary ?? 'handoff ready'}`;
  }

  return `${event.seq}. ${event.type}`;
}

async function main() {
  try {
    await readFile('.env', 'utf8').then(loadDotEnv);
  } catch {
    // The server will report the exact missing env error if .env is absent.
  }

  const port = process.env.SERVER_PORT ?? '3002';
  const baseUrl = `http://localhost:${port}`;
  const requirement = process.argv.slice(2).join(' ').trim() || defaultRequirement;

  let serverProcess;
  try {
    await requestJson(`${baseUrl}/health`, { timeoutMs: 2000 });
    console.log(`Using existing Alpha Agent server at ${baseUrl}`);
  } catch {
    console.log(`Starting Alpha Agent server at ${baseUrl}`);
    serverProcess = startServer();
    await waitForHealth(baseUrl);
  }

  try {
    const created = await requestJson(`${baseUrl}/api/runs`, {
      method: 'POST',
      body: JSON.stringify({ requirement }),
      timeoutMs: 120000
    });
    const run = created.run;

    console.log('\nP1 demo completed');
    console.log(`Run ID: ${run.id}`);
    console.log(`Status: ${created.result.status}`);
    console.log(`Success: ${created.result.success}`);
    console.log(`Events: ${run.events.length}`);
    console.log('\nStage events:');
    for (const event of run.events) {
      console.log(`- ${summarizeEvent(event)}`);
    }

    if (!created.result.success) {
      process.exitCode = 1;
    }
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
