import { runAllowedCommand } from './commandRunner.js';

export function getGitStatus(cwd: string) {
  return runAllowedCommand(cwd, 'git', ['status', '--porcelain']);
}

export function getGitDiffStat(cwd: string) {
  return runAllowedCommand(cwd, 'git', ['diff', '--stat']);
}

export function getGitDiff(cwd: string) {
  return runAllowedCommand(cwd, 'git', ['diff']);
}
