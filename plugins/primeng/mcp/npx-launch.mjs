// Starts an npx-hosted MCP server and forwards stdio and signals.
// On Windows `npx` is a .cmd shim that cannot be spawned without a shell,
// which is why MCP configs launch through this file instead of `npx` directly.
//
// `{primeng-major}` in an argument becomes the project's installed PrimeNG major,
// so the docs server answers for the version the project runs (plain `latest`
// would serve the newest major's APIs to an older project).

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const firstNumber = (s) => /(\d+)/.exec(s ?? '')?.[1] ?? null;

// Major of the installed primeng, else of the range package.json declares, else null —
// looked up from `cwd` upwards, so a session started in a sub-folder finds its project.
export function primengMajor(cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    const installed = path.join(dir, 'node_modules', 'primeng', 'package.json');
    if (existsSync(installed)) {
      const major = firstNumber(readJson(installed)?.version);
      if (major) return major;
    }
    const pkg = readJson(path.join(dir, 'package.json'));
    const declared = firstNumber(pkg?.dependencies?.primeng ?? pkg?.devDependencies?.primeng);
    if (declared) return declared;
    if (path.dirname(dir) === dir) return null;
  }
}

// @primeng/mcp is published from 21 on; an older project gets the closest docs server.
const FIRST_MCP_MAJOR = 21;

export function resolveArgs(args, cwd) {
  const installed = primengMajor(cwd);
  const major = installed === null ? 'latest' : String(Math.max(Number(installed), FIRST_MCP_MAJOR));
  return args.map((a) => a.replaceAll('{primeng-major}', major));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = ['-y', ...resolveArgs(process.argv.slice(2), process.env.CLAUDE_PROJECT_DIR ?? process.cwd())];
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
}
