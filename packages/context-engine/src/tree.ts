import { readdir } from 'node:fs/promises';
import path from 'node:path';

const ignoredNames = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.vite']);

export interface TreeEntry {
  path: string;
  type: 'file' | 'directory';
}

export async function readDirectoryTree(rootPath: string, maxEntries = 200): Promise<TreeEntry[]> {
  const root = path.resolve(rootPath);
  const entries: TreeEntry[] = [];

  async function walk(current: string) {
    if (entries.length >= maxEntries) {
      return;
    }

    const children = await readdir(current, { withFileTypes: true });
    for (const child of children) {
      if (entries.length >= maxEntries || ignoredNames.has(child.name)) {
        continue;
      }

      const fullPath = path.join(current, child.name);
      const relativePath = path.relative(root, fullPath).replaceAll(path.sep, '/');
      const type = child.isDirectory() ? 'directory' : 'file';
      entries.push({ path: relativePath, type });

      if (child.isDirectory()) {
        await walk(fullPath);
      }
    }
  }

  await walk(root);
  return entries;
}
