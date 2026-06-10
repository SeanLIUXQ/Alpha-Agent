import { runAllowedCommand } from '@alpha-agent/sandbox-runner';
import { type VerifyResult, verifyResultSchema } from '@alpha-agent/shared';

function parseCommand(commandLine: string): { command: string; args: string[] } {
  const [command = '', ...args] = commandLine.split(' ').filter(Boolean);
  return { command, args };
}

export async function verifySandbox(sandboxPath: string, commandLines: string[]): Promise<VerifyResult> {
  const commands = [];

  for (const commandLine of commandLines) {
    const { command, args } = parseCommand(commandLine);
    const result = await runAllowedCommand(sandboxPath, command, args);
    commands.push({
      command: commandLine,
      exitCode: result.exitCode,
      stdout: result.stdout.slice(-4000),
      stderr: result.stderr.slice(-4000)
    });
  }

  return verifyResultSchema.parse({
    success: commands.every((command) => command.exitCode === 0),
    commands,
    attempts: 1
  });
}
