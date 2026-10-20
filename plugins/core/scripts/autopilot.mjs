#!/usr/bin/env node
// Launcher for the autopilot repo's scripts, callable from the plugin:
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" sync <project-dir> [--dry-run]
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" doctor <project-dir>
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" links <project-dir>
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" template <project-dir> <path>
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" collisions <project-dir>
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" cleanup <project-dir> [--path <p>]... [--skip <p>]... [--delete]
// Finds the autopilot repo next to this plugin (local marketplace) or through the
// marketplace's clone that Claude Code keeps (git marketplace).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMANDS = { sync: 'bin/sync.mjs', doctor: 'bin/doctor.mjs', links: 'bin/links.mjs', template: 'bin/template.mjs', collisions: 'bin/css-collisions.mjs', cleanup: 'bin/cleanup.mjs' };

export function findAutopilotRoot() {
  if (process.env.AUTOPILOT_ROOT && existsSync(path.join(process.env.AUTOPILOT_ROOT, 'bin', 'sync.mjs'))) return process.env.AUTOPILOT_ROOT;
  for (let d = path.dirname(fileURLToPath(import.meta.url)); ; d = path.dirname(d)) {
    if (existsSync(path.join(d, '.claude-plugin', 'marketplace.json')) && existsSync(path.join(d, 'bin', 'sync.mjs'))) return d;
    if (path.dirname(d) === d) break;
  }
  try {
    const known = JSON.parse(readFileSync(path.join(homedir(), '.claude', 'plugins', 'known_marketplaces.json'), 'utf8'));
    const location = known['ng-autopilot']?.installLocation;
    if (location && existsSync(path.join(location, 'bin', 'sync.mjs'))) return location;
  } catch {
    // fall through
  }
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (!COMMANDS[command]) {
    console.error('usage: autopilot.mjs <sync|doctor|links|template|collisions|cleanup> <project-dir> [--dry-run | <path>]');
    process.exit(2);
  }
  const root = findAutopilotRoot();
  if (!root) {
    console.error('[autopilot] autopilot repo not found — run `npm run setup -- --apply` in it, or set AUTOPILOT_ROOT.');
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [path.join(root, COMMANDS[command]), ...args], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
