import path from 'node:path';
import { getGitDiffStat, runAllowedCommand } from '@alpha-agent/sandbox-runner';
import { config } from '../config.js';
import { appendRunEvent, createRun } from '../repositories/runRepository.js';

const demoRequirement = '在文章详情页正文下方显示本文字数和预计阅读时间。';

export async function runArticleReadingStatsDemo() {
  const run = await createRun(demoRequirement);
  const sandboxPath = path.resolve(process.cwd(), config.CONDUIT_SANDBOX_PATH);

  await appendRunEvent(run.id, 'clarify.completed', {
    requirement: demoRequirement,
    dsl: {
      level: 'L1',
      type: 'article-derived-metric',
      target: 'article-detail',
      dataSource: 'existing Article.body',
      metric: ['wordCount', 'estimatedReadingTime']
    }
  });

  await appendRunEvent(run.id, 'plan.completed', {
    summary: '纯前端改动：在文章详情页基于 Article.body 计算 word count 和 reading time。',
    verifyCommands: ['npm run test', 'npm run build -w frontend']
  });

  await appendRunEvent(run.id, 'locate.completed', {
    files: [
      {
        path: 'frontend/src/routes/Article/Article.jsx',
        reason: '文章详情页渲染 Article.body 的组件'
      },
      {
        path: 'frontend/src/styles.css',
        reason: 'Conduit 全局样式文件，包含 article-page 样式'
      }
    ]
  });

  await appendRunEvent(run.id, 'generate.completed', {
    patchSummary: '新增 getArticleReadingStats，并在正文下方展示 words/min read；新增对应样式。'
  });

  const diffStat = await getGitDiffStat(sandboxPath);
  await appendRunEvent(run.id, 'apply.completed', {
    changedFiles: ['frontend/src/routes/Article/Article.jsx', 'frontend/src/styles.css'],
    diffStat: diffStat.stdout.trim()
  });

  const testResult = await runAllowedCommand(sandboxPath, 'npm', ['run', 'test']);
  const buildResult = await runAllowedCommand(sandboxPath, 'npm', ['run', 'build', '-w', 'frontend']);
  const success = testResult.exitCode === 0 && buildResult.exitCode === 0;

  await appendRunEvent(run.id, 'verify.completed', {
    success,
    commands: [
      {
        command: 'npm run test',
        exitCode: testResult.exitCode,
        stdout: testResult.stdout.slice(-2000),
        stderr: testResult.stderr.slice(-2000)
      },
      {
        command: 'npm run build -w frontend',
        exitCode: buildResult.exitCode,
        stdout: buildResult.stdout.slice(-2000),
        stderr: buildResult.stderr.slice(-2000)
      }
    ]
  });

  await appendRunEvent(run.id, success ? 'handoff.completed' : 'handoff.failed', {
    summary: success
      ? '文章详情页已展示基于正文计算的字数和预计阅读时间，测试与前端构建通过。'
      : '文章详情页改动已应用，但验证失败，需要查看 verify 事件日志。',
    risk: '当前为纯前端派生展示，不涉及数据库或后端 API。'
  });

  return { runId: run.id, success };
}
