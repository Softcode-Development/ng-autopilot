// Starts an npx-hosted MCP server and forwards stdio and signals.
// On Windows `npx` is a .cmd shim that cannot be spawned without a shell,
// which is why MCP configs launch through this file instead of `npx` directly.
// The same file ships in every pack that runs an npx-hosted MCP server.
//
// Placeholders in the arguments pick the server version the project needs, so the docs
// answer for what the project runs (plain `latest` would serve the newest release's APIs):
//   {major-of:<pkg>}    the installed major of <pkg> (raised to the first published server major)
//   {version-of:<pkg>}  the installed version of <pkg> when the server published it, else the
//                       server's newest release with the same major
// Anything unknown (package not installed, registry unreachable) falls back to `latest`.

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// First published major of a server whose versions follow the library's majors.
const FIRST_SERVER_MAJOR = { '@primeng/mcp': 21 };

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const versionIn = (range) => /(\d+(?:\.\d+){0,2})/.exec(range ?? '')?.[1] ?? null;
const majorOf = (version) => (version ? Number(version.split('.')[0]) : null);
const compareVersions = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

// Installed version of `pkg`, else the version its range names in package.json — looked up
// from `cwd` upwards, so a session started in a sub-folder finds its project.
export function installedVersion(pkg, cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    const installed = readJson(path.join(dir, 'node_modules', ...pkg.split('/'), 'package.json'));
    if (installed?.version) return installed.version;
    const project = readJson(path.join(dir, 'package.json'));
    const declared = versionIn(project?.dependencies?.[pkg] ?? project?.devDependencies?.[pkg]);
    if (declared) return declared;
    if (path.dirname(dir) === dir) return null;
  }
}

function npmVersions(name) {
  const r = spawnSync(`npm view ${name} versions --json`, { encoding: 'utf8', shell: true, timeout: 20000 });
  try {
    return r.status === 0 ? [].concat(JSON.parse(r.stdout)) : undefined;
  } catch {
    return undefined;
  }
}

// `view(name)` → published versions of `name` (array) or undefined.
export function resolveArgs(args, cwd, view = npmVersions) {
  return args.map((arg) => arg.replace(/^(.*)@\{(major|version)-of:([^}]+)\}$/, (all, target, kind, pkg) => {
    const version = installedVersion(pkg, cwd);
    if (!version) return `${target}@latest`;
    if (kind === 'major') return `${target}@${Math.max(majorOf(version), FIRST_SERVER_MAJOR[target] ?? 0)}`;
    const published = (view(target) ?? []).filter((v) => !v.includes('-'));
    if (published.includes(version)) return `${target}@${version}`;
    // Same major: the newest release not newer than the installed one, else the oldest newer one.
    const sameMajor = published.filter((v) => majorOf(v) === majorOf(version)).sort(compareVersions);
    const pick = sameMajor.filter((v) => compareVersions(v, version) <= 0).at(-1) ?? sameMajor[0];
    return `${target}@${pick ?? 'latest'}`;
  }));
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
