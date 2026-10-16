#!/usr/bin/env node
// Launcher for the golden repo's scripts, callable from the plugin:
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/golden.mjs" sync <project-dir> [--dry-run]
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/golden.mjs" doctor <project-dir>
// Finds the golden repo next to this plugin (local marketplace) or through the
// marketplace's clone that Claude Code keeps (git marketplace).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMANDS = { sync: 'bin/sync.mjs', doctor: 'bin/doctor.mjs' };

export function findGoldenRoot() {
  if (process.env.GOLDEN_ROOT && existsSync(path.join(process.env.GOLDEN_ROOT, 'bin', 'sync.mjs'))) return process.env.GOLDEN_ROOT;
  for (let d = path.dirname(fileURLToPath(import.meta.url)); ; d = path.dirname(d)) {
    if (existsSync(path.join(d, '.claude-plugin', 'marketplace.json')) && existsSync(path.join(d, 'bin', 'sync.mjs'))) return d;
    if (path.dirname(d) === d) break;
  }
  try {
    const known = JSON.parse(readFileSync(path.join(homedir(), '.claude', 'plugins', 'known_marketplaces.json'), 'utf8'));
    const location = known['claude-golden']?.installLocation;
    if (location && existsSync(path.join(location, 'bin', 'sync.mjs'))) return location;
  } catch {
    // fall through
  }
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (!COMMANDS[command]) {
    console.error('usage: golden.mjs <sync|doctor> <project-dir> [--dry-run]');
    process.exit(2);
  }
  const root = findGoldenRoot();
  if (!root) {
    console.error('[golden] golden repo not found — run `npm run setup -- --apply` in it, or set GOLDEN_ROOT.');
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [path.join(root, COMMANDS[command]), ...args], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
