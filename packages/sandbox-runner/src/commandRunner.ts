import { spawn } from 'node:child_process';

export interface CommandResult {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

const allowedCommands = new Set(['git', 'npm']);
const allowedNpmScripts = new Set(['test', 'lint', 'build']);

function assertAllowed(command: string, args: string[]): void {
  if (!allowedCommands.has(command)) {
    throw new Error(`Command is not allowed: ${command}`);
  }

  if (command === 'git') {
    const gitSubcommand = args[0];
    if (!['status', 'diff'].includes(gitSubcommand ?? '')) {
      throw new Error(`Git subcommand is not allowed: ${gitSubcommand}`);
    }
  }

  if (command === 'npm') {
    const [run, script] = args;
    const extraArgs = args.slice(2);
    const allowedExtraArgs =
      extraArgs.length === 0 || (extraArgs.length === 2 && extraArgs[0] === '-w' && extraArgs[1] === 'frontend');

    if (run !== 'run' || !allowedNpmScripts.has(script ?? '') || !allowedExtraArgs) {
      throw new Error(`NPM script is not allowed: ${args.join(' ')}`);
    }
  }
}

export async function runAllowedCommand(
  cwd: string,
  command: string,
  args: string[],
): Promise<CommandResult> {
  assertAllowed(command, args);
  const executable = process.platform === 'win32' && command === 'npm' ? 'cmd.exe' : command;
  const spawnArgs =
    process.platform === 'win32' && command === 'npm' ? ['/d', '/s', '/c', 'npm.cmd', ...args] : args;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, spawnArgs, { cwd, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ command, args, exitCode, stdout, stderr });
    });
  });
}
