import path from 'node:path';

export function resolveSandboxPath(workspaceRoot: string, sandboxPath: string): string {
  const resolved = path.resolve(workspaceRoot, sandboxPath);
  const root = path.resolve(workspaceRoot);

  if (!resolved.startsWith(root)) {
    throw new Error('Sandbox path must stay inside the workspace');
  }

  return resolved;
}
