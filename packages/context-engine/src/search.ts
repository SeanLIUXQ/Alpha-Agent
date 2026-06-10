import { spawn } from 'node:child_process';

export interface SearchResult {
  path: string;
  line: number;
  text: string;
}

const sourceSearchRoots = ['frontend/src', 'backend', 'src'];

export async function searchWithRg(rootPath: string, term: string, maxResults = 20): Promise<SearchResult[]> {
  return new Promise((resolve) => {
    const child = spawn(
      'rg',
      [
        '--line-number',
        '--color',
        'never',
        '--fixed-strings',
        '--glob',
        '!**/node_modules/**',
        '--glob',
        '!**/dist/**',
        '--glob',
        '!**/.git/**',
        term,
        ...sourceSearchRoots
      ],
      { cwd: rootPath, shell: false },
    );
    let stdout = '';
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      const results = stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(0, maxResults)
        .map((line) => {
          const [filePath = '', lineNumber = '0', ...rest] = line.split(':');
          return {
            path: filePath.replaceAll('\\', '/'),
            line: Number.parseInt(lineNumber, 10),
            text: rest.join(':').trim()
          };
        });

      resolve(results);
    };

    const timeout = setTimeout(() => {
      child.kill();
      finish();
    }, 1500);

    child.stdin.end();

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', () => undefined);

    child.on('error', () => finish());
    child.on('close', () => finish());
  });
}
