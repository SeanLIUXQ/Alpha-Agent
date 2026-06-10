import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export interface CreatePullRequestInput {
  title: string;
  body: string;
  base?: string;
  branch?: string;
  draft?: boolean;
  files?: string[];
}

interface PreflightCheck {
  key: string;
  ok: boolean;
  message: string;
}

interface GitHubRepo {
  owner: string;
  repo: string;
}

export async function getPullRequestPreflight(input: Partial<CreatePullRequestInput> = {}) {
  const cwd = resolveRepoPath();
  const checks: PreflightCheck[] = [];
  const ghAvailable = await commandExists('gh');
  const gitAvailable = await commandExists('git');
  const isGitRepo = existsSync(path.join(cwd, '.git'));
  const remote = isGitRepo ? await git(['remote', 'get-url', 'origin'], cwd) : null;
  const repo = remote?.exitCode === 0 ? parseGitHubRemote(remote.stdout.trim()) : null;
  const status = isGitRepo ? await git(['status', '--porcelain'], cwd) : null;
  const changedFiles = status?.exitCode === 0 ? parsePorcelainFiles(status.stdout) : [];
  const candidateFiles = normalizeFiles(input.files ?? changedFiles);

  checks.push({
    key: 'enabled',
    ok: config.ENABLE_PR_CREATE,
    message: config.ENABLE_PR_CREATE ? 'ENABLE_PR_CREATE=true' : 'ENABLE_PR_CREATE is not true.'
  });
  checks.push({
    key: 'token',
    ok: Boolean(config.GITHUB_TOKEN),
    message: config.GITHUB_TOKEN
      ? 'GITHUB_TOKEN is configured and will be used for authenticated push/API PR creation.'
      : 'GITHUB_TOKEN is not configured.'
  });
  checks.push({
    key: 'git',
    ok: gitAvailable,
    message: gitAvailable ? '`git` is available.' : '`git` is not installed or not on PATH.'
  });
  checks.push({
    key: 'repo',
    ok: isGitRepo,
    message: isGitRepo ? `Git repository: ${cwd}` : `No .git directory found at ${cwd}.`
  });
  checks.push({
    key: 'remote',
    ok: Boolean(repo),
    message: repo ? `GitHub remote: ${repo.owner}/${repo.repo}` : 'origin remote is not a GitHub repository.'
  });
  checks.push({
    key: 'changes',
    ok: candidateFiles.length > 0,
    message: candidateFiles.length > 0 ? `${candidateFiles.length} changed file(s) selected for PR.` : 'No changed files selected for PR.'
  });
  checks.push({
    key: 'creator',
    ok: ghAvailable || Boolean(config.GITHUB_TOKEN),
    message: ghAvailable
      ? '`gh` is available and will be preferred for PR creation.'
      : config.GITHUB_TOKEN
        ? '`gh` is unavailable; GitHub REST API will create the PR.'
        : '`gh` is unavailable; configure GITHUB_TOKEN to create PRs through the GitHub REST API.'
  });

  return {
    ready: checks.every((check) => check.ok),
    repoPath: cwd,
    repo,
    base: input.base ?? 'main',
    branch: input.branch ?? createBranchName(input.title ?? 'alpha-agent-run'),
    changedFiles,
    selectedFiles: candidateFiles,
    ghAvailable,
    checks
  };
}

export async function createPullRequest(input: CreatePullRequestInput) {
  const preflight = await getPullRequestPreflight(input);
  if (!preflight.ready || !preflight.repo) {
    return {
      created: false,
      blocked: true,
      reason: preflight.checks.find((check) => !check.ok)?.message ?? 'PR preflight failed.',
      preflight
    };
  }

  const cwd = preflight.repoPath;
  const base = input.base ?? preflight.base;
  const branch = input.branch ?? preflight.branch;
  const files = preflight.selectedFiles;

  const currentBranch = await mustGit(['branch', '--show-current'], cwd);
  const baseBranch = currentBranch.stdout.trim() || base;
  const existingBranch = await git(['rev-parse', '--verify', branch], cwd);
  if (existingBranch.exitCode === 0) {
    await mustGit(['checkout', branch], cwd);
  } else {
    await mustGit(['checkout', '-b', branch], cwd);
  }

  for (const file of files) {
    await mustGit(['add', '--', file], cwd);
  }

  const staged = await mustGit(['diff', '--cached', '--name-only'], cwd);
  if (!staged.stdout.trim()) {
    await mustGit(['checkout', baseBranch], cwd);
    return {
      created: false,
      blocked: true,
      reason: 'No staged changes after selecting Run files.',
      preflight
    };
  }

  await mustGit(['commit', '-m', input.title], cwd);
  await pushBranch(cwd, preflight.repo, branch);

  const created = preflight.ghAvailable
    ? await createWithGh({ title: input.title, body: input.body, base, branch, draft: input.draft ?? true }, cwd)
    : await createWithGitHubApi({
        repo: preflight.repo,
        title: input.title,
        body: input.body,
        base,
        branch,
        draft: input.draft ?? true
      });

  return {
    created: true,
    blocked: false,
    prUrl: created.url,
    branch,
    base,
    committedFiles: staged.stdout.trim().split(/\r?\n/).filter(Boolean),
    preflight
  };
}

function resolveRepoPath() {
  const candidates = [
    path.resolve(process.cwd(), config.CONDUIT_SANDBOX_PATH),
    path.resolve(process.cwd(), '../..', config.CONDUIT_SANDBOX_PATH),
    process.cwd(),
    path.resolve(process.cwd(), '../..')
  ];

  return candidates.find((candidate) => existsSync(path.join(candidate, '.git'))) ?? process.cwd();
}

function normalizeFiles(files: string[]) {
  return [...new Set(files.map((file) => file.replace(/\\/g, '/').trim()).filter(Boolean))].sort();
}

function parsePorcelainFiles(stdout: string) {
  return normalizeFiles(
    stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const renamed = line.match(/^R.\s+(.+?)\s+->\s+(.+)$/);
        if (renamed) return renamed[2];
        return line.replace(/^..?\s+/, '');
      }),
  );
}

function createBranchName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return `alpha-agent/${slug || 'run'}-${Date.now().toString(36)}`;
}

function parseGitHubRemote(remote: string): GitHubRepo | null {
  const httpsMatch = remote.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  const sshMatch = remote.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  return null;
}

async function pushBranch(cwd: string, repo: GitHubRepo, branch: string) {
  if (config.GITHUB_TOKEN) {
    const token = encodeURIComponent(config.GITHUB_TOKEN);
    const remoteUrl = `https://x-access-token:${token}@github.com/${repo.owner}/${repo.repo}.git`;
    const result = await git(['push', '-u', remoteUrl, branch], cwd);
    if (result.exitCode !== 0) {
      throw new Error(sanitizeSecret(result.stderr || result.stdout || `git push failed with exit ${result.exitCode}`));
    }

    return result;
  }

  return mustGit(['push', '-u', 'origin', branch], cwd);
}

async function createWithGh(
  input: { title: string; body: string; base: string; branch: string; draft: boolean },
  cwd: string,
) {
  const args = ['pr', 'create', '--title', input.title, '--body', input.body, '--base', input.base, '--head', input.branch];
  if (input.draft) args.push('--draft');
  const result = await runProcess('gh', args, cwd, { GITHUB_TOKEN: config.GITHUB_TOKEN });
  if (result.exitCode !== 0) {
    throw new Error(sanitizeSecret(result.stderr || result.stdout || `gh pr create failed with exit ${result.exitCode}`));
  }

  return { url: extractPrUrl(result.stdout) ?? result.stdout.trim() };
}

async function createWithGitHubApi(input: {
  repo: GitHubRepo;
  title: string;
  body: string;
  base: string;
  branch: string;
  draft: boolean;
}) {
  const response = await fetch(`https://api.github.com/repos/${input.repo.owner}/${input.repo.repo}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      base: input.base,
      head: input.branch,
      draft: input.draft
    })
  });
  const payload = (await response.json()) as { html_url?: string; message?: string };
  if (!response.ok || !payload.html_url) {
    throw new Error(payload.message ?? `GitHub PR API failed with ${response.status}`);
  }

  return { url: payload.html_url };
}

function extractPrUrl(stdout: string) {
  return stdout.match(/https:\/\/github\.com\/\S+\/pull\/\d+/)?.[0];
}

function sanitizeSecret(message: string) {
  if (!config.GITHUB_TOKEN) return message;
  return message
    .split(config.GITHUB_TOKEN)
    .join('***')
    .split(encodeURIComponent(config.GITHUB_TOKEN))
    .join('***');
}

async function commandExists(command: string) {
  const executable = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = await runProcess(executable, [command], process.cwd());
  return result.exitCode === 0;
}

async function git(args: string[], cwd: string) {
  return runProcess('git', args, cwd);
}

async function mustGit(args: string[], cwd: string) {
  const result = await git(args, cwd);
  if (result.exitCode !== 0) {
    throw new Error(sanitizeSecret(result.stderr || result.stdout || `git ${args.join(' ')} failed with exit ${result.exitCode}`));
  }

  return result;
}

function runProcess(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: { ...process.env, ...env }
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}
