import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const logDir = resolve(root, '..', '..', 'data');
mkdirSync(logDir, { recursive: true });

function runPowerShell(command) {
  spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    cwd: root,
    stdio: 'inherit',
  });
}

function stopPort(port) {
  runPowerShell(
    `$pids = netstat -ano | Select-String 'LISTENING' | Select-String ':${port}' | ForEach-Object { ($_ -split '\\s+')[-1] } | Sort-Object -Unique; foreach ($pidValue in $pids) { Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue; Write-Output "stopped ${port}: $pidValue" }`,
  );
}

function start(name, args, env = {}) {
  const outPath = resolve(logDir, `${name}.out.log`);
  const errPath = resolve(logDir, `${name}.err.log`);
  appendFileSync(outPath, `\n--- restart ${new Date().toISOString()} ---\n`);
  appendFileSync(errPath, `\n--- restart ${new Date().toISOString()} ---\n`);

  const envAssignments = Object.entries(env)
    .map(([key, value]) => `$env:${key}='${String(value).replaceAll("'", "''")}'`)
    .join('; ');
  const argList = args.map((arg) => `'${arg.replaceAll("'", "''")}'`).join(',');
  const command = `${envAssignments ? `${envAssignments}; ` : ''}$p = Start-Process -FilePath npm.cmd -ArgumentList ${argList} -WorkingDirectory '${root.replaceAll("'", "''")}' -WindowStyle Hidden -PassThru -RedirectStandardOutput '${outPath.replaceAll("'", "''")}' -RedirectStandardError '${errPath.replaceAll("'", "''")}'; Write-Output '${name} pid=' + $p.Id`;

  runPowerShell(command);
}

stopPort(3000);
stopPort(3001);

start('conduit-backend', ['run', 'dev', '-w', 'backend'], {
  PORT: '3001',
});
start('conduit-frontend', ['run', 'dev', '-w', 'frontend']);

console.log('Conduit dev restart requested.');
console.log('Frontend: http://localhost:3000/');
console.log('Backend:  http://localhost:3001/');
