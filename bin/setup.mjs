#!/usr/bin/env node
// One-command setup on any machine: register the golden marketplace, install
// every golden plugin at user scope but leave it disabled (projects enable the
// packs they use), and install the external plugins the workflow depends on
// unless a copy is already present (installed or synced from claude.ai).
//
//   node bin/setup.mjs                  dry run: print the plan, change nothing
//   node bin/setup.mjs --apply          do it
//   node bin/setup.mjs --apply --source <git-url>   register from a remote instead of this folder
//
// CLAUDE_BIN overrides the CLI path.

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const sourceIdx = args.indexOf('--source');
const marketplaceSource = sourceIdx !== -1 ? args[sourceIdx + 1] : repoRoot;

const marketplace = JSON.parse(readFileSync(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'));
const dependencies = JSON.parse(readFileSync(path.join(repoRoot, 'dependencies.json'), 'utf8')).plugins;

function runs(bin) {
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  return r.status === 0 && /Claude Code/i.test(r.stdout);
}

// The npm `claude` shim can exist without a working binary behind it, so each
// candidate is probed, not just located.
export function findClaude() {
  const candidates = [];
  if (process.env.CLAUDE_BIN) candidates.push(process.env.CLAUDE_BIN);
  candidates.push('claude');
  const extDir = path.join(homedir(), '.vscode', 'extensions');
  if (existsSync(extDir)) {
    const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
    readdirSync(extDir)
      .filter((d) => d.startsWith('anthropic.claude-code-'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .forEach((d) => candidates.push(path.join(extDir, d, 'resources', 'native-binary', exe)));
  }
  return candidates.find(runs) ?? null;
}

function cli(claude, cliArgs) {
  const r = spawnSync(claude, cliArgs, { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

function json(claude, cliArgs) {
  const r = cli(claude, [...cliArgs, '--json']);
  const start = r.out.indexOf('[');
  try {
    return start === -1 ? [] : JSON.parse(r.out.slice(start));
  } catch {
    return [];
  }
}

const baseName = (id) => id.split('@')[0];

export function planSteps({ installed, marketplaces, goldenName, goldenPlugins, deps, source }) {
  const steps = [];
  const known = new Set(marketplaces.map((m) => m.name));
  const has = (id) => installed.find((p) => p.id === id);

  if (!known.has(goldenName)) steps.push({ why: `register marketplace ${goldenName}`, args: ['plugin', 'marketplace', 'add', source] });
  for (const name of goldenPlugins) {
    const id = `${name}@${goldenName}`;
    const p = has(id);
    if (!p) steps.push({ why: `install ${id} (user scope)`, args: ['plugin', 'install', id, '--scope', 'user'] });
    if (!p || p.enabled) steps.push({ why: `disable ${id} at user scope — projects enable their packs`, args: ['plugin', 'disable', id, '--scope', 'user'] });
  }
  for (const dep of deps) {
    const present = installed.find((p) => baseName(p.id) === dep.name);
    if (present) continue;
    if (!known.has(dep.marketplace.name)) {
      steps.push({ why: `register marketplace ${dep.marketplace.name} (for ${dep.name})`, args: ['plugin', 'marketplace', 'add', dep.marketplace.source] });
      known.add(dep.marketplace.name);
    }
    steps.push({ why: `install dependency ${dep.name} — ${dep.usedBy}`, args: ['plugin', 'install', `${dep.name}@${dep.marketplace.name}`, '--scope', 'user'] });
  }
  return steps;
}

function main() {
  const claude = findClaude();
  if (!claude) {
    console.error('[setup] No working Claude Code CLI found. Install it, or set CLAUDE_BIN to the claude binary.');
    process.exit(1);
  }
  const installed = json(claude, ['plugin', 'list']);
  const marketplaces = json(claude, ['plugin', 'marketplace', 'list']);
  const steps = planSteps({
    installed,
    marketplaces,
    goldenName: marketplace.name,
    goldenPlugins: marketplace.plugins.map((p) => p.name),
    deps: dependencies,
    source: marketplaceSource,
  });

  console.log(`[setup] CLI: ${claude}`);
  for (const dep of dependencies) {
    const present = installed.find((p) => baseName(p.id) === dep.name);
    console.log(`[setup] dependency ${dep.name}: ${present ? `present (${present.id})` : 'missing'}`);
  }
  if (steps.length === 0) {
    console.log('[setup] Nothing to do — everything is installed.');
    return;
  }
  for (const s of steps) {
    console.log(`[setup] ${apply ? 'run ' : 'plan'}: ${s.why}\n          claude ${s.args.join(' ')}`);
    if (!apply) continue;
    const r = cli(claude, s.args);
    if (!r.ok) {
      console.error(`[setup] FAILED: ${s.why}\n${r.out}`);
      process.exit(1);
    }
  }
  console.log(apply
    ? '[setup] Done. Run /reload-plugins in open sessions.'
    : '[setup] Dry run only. Re-run with --apply to make these changes.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
