import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PatchSet } from '@alpha-agent/shared';

export interface ApplyPatchResult {
  changedFiles: string[];
}

function resolveSandboxFile(sandboxPath: string, relativePath: string): string {
  const root = path.resolve(sandboxPath);
  const resolved = path.resolve(root, relativePath);

  if (!resolved.startsWith(root)) {
    throw new Error(`Patch path escapes sandbox: ${relativePath}`);
  }

  return resolved;
}

export async function applyPatchSet(sandboxPath: string, patchSet: PatchSet): Promise<ApplyPatchResult> {
  const changedFiles: string[] = [];

  for (const operation of patchSet.operations) {
    if (operation.type !== 'replace-file') {
      throw new Error(`Unsupported patch operation: ${operation.type}`);
    }

    const targetPath = resolveSandboxFile(sandboxPath, operation.path);
    await assertNotAccidentalTruncation(targetPath, operation.path, operation.content);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, operation.content, 'utf8');
    changedFiles.push(operation.path);
  }

  return { changedFiles };
}

async function assertNotAccidentalTruncation(targetPath: string, relativePath: string, nextContent: string): Promise<void> {
  let currentContent = '';

  try {
    const fileStat = await stat(targetPath);
    if (!fileStat.isFile()) {
      return;
    }
    currentContent = await readFile(targetPath, 'utf8');
  } catch {
    return;
  }

  const currentLength = currentContent.trim().length;
  const nextLength = nextContent.trim().length;
  if (currentLength < 1000) {
    return;
  }

  const severeShrink = nextLength < currentLength * 0.35;
  const missingExistingSignature =
    relativePath.endsWith('.css') &&
    currentContent.includes('Alpha Agent ByteDance-style visual system') &&
    !nextContent.includes('Alpha Agent ByteDance-style visual system');

  if (severeShrink || missingExistingSignature) {
    throw new Error(
      `Refusing to replace ${relativePath}: generated content looks truncated (${nextLength}/${currentLength} chars).`,
    );
  }
}
