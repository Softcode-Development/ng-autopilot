// Starts an npx-hosted MCP server and forwards stdio and signals.
// On Windows `npx` is a .cmd shim that cannot be spawned without a shell,
// which is why MCP configs launch through this file instead of `npx` directly.

import { spawn } from 'node:child_process';

const args = ['-y', ...process.argv.slice(2)];
const child = process.platform === 'win32'
  ? spawn(`npx ${args.join(' ')}`, { stdio: 'inherit', shell: true })
  : spawn('npx', args, { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
child.on('error', (e) => {
  console.error(e.message);
  process.exit(1);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
