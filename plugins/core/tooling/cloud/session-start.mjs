#!/usr/bin/env node
// Per-session setup in a Claude Code cloud session; run by the SessionStart hook sync adds
// to .claude/settings.json. Outside the cloud (CLAUDE_CODE_REMOTE is not "true") it does nothing.
//
//   node tools/autopilot/cloud/session-start.mjs
//
// 1. The project's Node: the version in .nvmrc / .node-version / an exact engines.node, put
//    first on PATH for the session's commands (CLAUDE_ENV_FILE). The image ships Node 20-22 in
//    /opt/node<major>; any other version is downloaded from nodejs.org (Trusted network list).
// 2. Dependencies: a clean install (commands.install in .claude/autopilot.json, else npm ci /
//    pnpm install --frozen-lockfile) when the manifest or lockfile changed since the last one.
// 3. Chrome: CHROME_BIN for the session, when the environment's setup script installed it.
//
// Prints one summary line, which the session sees as context; install output goes to
// .claude/tmp/cloud-session-start.log. Always exits 0: a failed step never blocks the session.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCKFILES = { npm: 'package-lock.json', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' };
const CHROME = ['/usr/local/bin/google-chrome', '/opt/chrome-linux64/chrome'];
const STAMP = 'node_modules/.autopilot-install.sha256';

const read = (root, rel) => (existsSync(path.join(root, rel)) ? readFileSync(path.join(root, rel), 'utf8') : null);

/** The exact Node version the project pins, or null when it pins none (a range is not a pin). */
export function pinnedNode(root) {
  for (const rel of ['.nvmrc', '.node-version']) {
    const v = read(root, rel)?.trim().replace(/^v/, '');
    if (v && /^\d+\.\d+\.\d+$/.test(v)) return v;
  }
  const engines = JSON.parse(read(root, 'package.json') ?? '{}').engines?.node?.trim().replace(/^v/, '');
  return engines && /^\d+\.\d+\.\d+$/.test(engines) ? engines : null;
}

/** Where that Node lives on the cloud image: a preinstalled /opt/node<major>, else a downloaded copy. */
export function nodeDir(version, exists = existsSync) {
  const preinstalled = `/opt/node${version.split('.')[0]}`;
  const versionOf = (dir) => spawnSync(path.join(dir, 'bin', 'node'), ['--version'], { encoding: 'utf8' }).stdout?.trim();
  if (exists(path.join(preinstalled, 'bin', 'node')) && versionOf(preinstalled) === `v${version}`) return { dir: preinstalled, download: false };
  return { dir: `/opt/node-v${version}-linux-x64`, download: !exists(`/opt/node-v${version}-linux-x64/bin/node`) };
}

/** The clean-install command for the project's package manager. */
export function installArgs(packageManager, hasLockfile) {
  if (packageManager === 'pnpm') return ['pnpm', hasLockfile ? ['install', '--frozen-lockfile'] : ['install']];
  if (packageManager === 'yarn') return ['yarn', hasLockfile ? ['install', '--frozen-lockfile'] : ['install']];
  return ['npm', hasLockfile ? ['ci'] : ['install']];
}

/** Hash of everything the install reads; a change means install again. */
export function installHash(root, packageManager) {
  const h = createHash('sha256');
  for (const rel of ['package.json', LOCKFILES[packageManager] ?? LOCKFILES.npm, '.npmrc']) h.update(`${rel}\0${read(root, rel) ?? ''}\0`);
  return h.digest('hex');
}

export function sessionStart(root, env = process.env) {
  if (env.CLAUDE_CODE_REMOTE !== 'true') return null;
  const done = [];
  const log = path.join(root, '.claude', 'tmp', 'cloud-session-start.log');
  mkdirSync(path.dirname(log), { recursive: true });
  writeFileSync(log, '');
  const run = (cmd, args, extraEnv = {}) => {
    const r = spawnSync(cmd, args, { cwd: root, env: { ...env, ...extraEnv }, encoding: 'utf8', shell: false });
    appendFileSync(log, `$ ${cmd} ${args.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `${r.error.message}\n` : ''}\n`);
    return r.status === 0;
  };
  const exports = [];
  let PATH = env.PATH ?? '';

  const version = pinnedNode(root);
  if (version) {
    const { dir, download } = nodeDir(version);
    const ok = !download || run('bash', ['-c', `curl -fsSL https://nodejs.org/dist/v${version}/node-v${version}-linux-x64.tar.xz | tar -xJ -C /opt`]);
    if (ok) {
      PATH = `${dir}/bin${path.delimiter}${PATH}`;
      exports.push(`export PATH="${dir}/bin:$PATH"`);
      done.push(`Node ${version} on PATH`);
    } else done.push(`Node ${version} download failed (using ${process.version})`);
  }

  const config = JSON.parse(read(root, '.claude/autopilot.json') ?? '{}');
  const pm = config.packageManager ?? 'npm';
  const hash = installHash(root, pm);
  if (read(root, STAMP)?.trim() === hash) done.push('dependencies up to date');
  else {
    // commands.install: a project whose clean install needs flags (npm ci --force) names it.
    const [cmd, args] = config.commands?.install ? ['bash', ['-c', config.commands.install]] : installArgs(pm, read(root, LOCKFILES[pm] ?? LOCKFILES.npm) !== null);
    if (run(cmd, args, { PATH })) {
      mkdirSync(path.join(root, path.dirname(STAMP)), { recursive: true });
      writeFileSync(path.join(root, STAMP), `${hash}\n`);
      done.push(`dependencies installed (${cmd} ${args.join(' ')})`);
    } else done.push(`${cmd} ${args.join(' ')} failed — see .claude/tmp/cloud-session-start.log`);
  }

  const chrome = CHROME.find((c) => existsSync(c));
  if (chrome && !env.CHROME_BIN) exports.push(`export CHROME_BIN="${chrome}"`);
  done.push(chrome ? `Chrome at ${chrome}` : 'no Chrome — add tools/autopilot/cloud/setup.sh as the environment setup script');

  if (env.CLAUDE_ENV_FILE && exports.length) appendFileSync(env.CLAUDE_ENV_FILE, `${exports.join('\n')}\n`);
  return `[autopilot] cloud session: ${done.join('; ')}.`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const summary = sessionStart(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
    if (summary) console.log(summary);
  } catch (e) {
    console.log(`[autopilot] cloud session setup failed: ${e.message}`);
  }
}
