import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ContextRequest, PackedContext } from '@alpha-agent/shared';
import { searchWithRg } from './search.js';

function assertInside(rootPath: string, relativePath: string): string {
  const root = path.resolve(rootPath);
  const resolved = path.resolve(root, relativePath);

  if (!resolved.startsWith(root)) {
    throw new Error(`Context file escapes sandbox: ${relativePath}`);
  }

  return resolved;
}

export async function packContext(request: ContextRequest): Promise<PackedContext> {
  const files = new Map<string, string>();
  const searchedTerms: string[] = [];

  for (const candidate of request.candidateFiles) {
    files.set(candidate, 'candidate file from implementation plan');
  }

  for (const hint of request.searchHints) {
    searchedTerms.push(hint);
    const results = await searchWithRg(request.sandboxPath, hint, 8);
    for (const result of results) {
      if (!files.has(result.path)) {
        files.set(result.path, `matched search term "${hint}" at line ${result.line}`);
      }
    }
  }

  const packedFiles = [];
  for (const [filePath, reason] of files) {
    const fullPath = assertInside(request.sandboxPath, filePath);
    try {
      packedFiles.push({
        path: filePath,
        reason,
        content: await readFile(fullPath, 'utf8')
      });
    } catch {
      continue;
    }
  }

  return {
    files: packedFiles,
    constraints: [
      'Only files included in this context may be treated as evidence.',
      'Generated code must be written inside the sandbox path.'
    ],
    searchedTerms
  };
}
