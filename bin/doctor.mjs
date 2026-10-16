#!/usr/bin/env node
// Golden drift check for a project.
//
//   node bin/doctor.mjs <project-dir>
//
// Errors (exit 1): invalid golden.json, generated files edited/deleted/added,
// generated files out of date with the golden repo. Warnings: plugins not
// enabled, tiers without overrides, unfilled placeholders, missing
// devDependencies, legacy AI files, inactive git hooks.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fingerprint, LOCK_PATH } from '../plugins/core/tooling/lock/fingerprint.mjs';
import { verifyAll } from '../plugins/core/tooling/lock/verify.mjs';
import { MARKETPLACE, normaliseConfig, renderFiles, requiredDevDependencies } from './lib/render.mjs';
import { GOLDEN_ROOT } from './sync.mjs';

const PLACEHOLDER = /<(?![!/]|https?:)[A-Za-z…][^<>\n]{2,}>/g;
const LEGACY = [
  '.claude/agents', '.claude/skills', '.claude/instructions', '.claude/prompts', '.claude/commands',
  '.github/copilot-instructions.md', '.github/prompts', '.github/instructions', '.github/agents',
  '.cursor', '.cursorrules', 'AGENTS.md', '.windsurfrules',
];

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

export function doctor(projectRoot) {
  const errors = [];
  const warnings = [];
  const configFile = path.join(projectRoot, '.claude', 'golden.json');
  if (!existsSync(configFile)) return { errors: ['.claude/golden.json missing — run /core:install'], warnings };

  let config;
  try {
    config = normaliseConfig(readJson(configFile));
  } catch (e) {
    return { errors: [`.claude/golden.json: ${e.message}`], warnings };
  }

  // Generated files vs their fingerprints.
  errors.push(...verifyAll(projectRoot));

  // Generated files vs what the golden repo would generate now.
  const { files } = renderFiles(GOLDEN_ROOT, readJson(configFile));
  const lockFile = path.join(projectRoot, LOCK_PATH);
  const lock = existsSync(lockFile) ? readJson(lockFile) : { files: {} };
  const expected = Object.fromEntries(files.filter((f) => f.kind === 'generated').map((f) => [f.path, fingerprint(f.content)]));
  const stale = Object.keys(expected).filter((f) => lock.files[f] !== expected[f]);
  const extra = Object.keys(lock.files).filter((f) => !expected[f]);
  if (stale.length || extra.length) errors.push(`golden repo has changed since the last sync (${stale.length + extra.length} file(s)) — run sync`);

  // Plugins enabled for this project.
  const settingsFile = path.join(projectRoot, '.claude', 'settings.json');
  const enabled = existsSync(settingsFile) ? readJson(settingsFile).enabledPlugins ?? {} : {};
  for (const p of config.packs) if (enabled[`${p}@${MARKETPLACE}`] !== true) warnings.push(`plugin ${p}@${MARKETPLACE} not enabled in .claude/settings.json`);

  // Test tiers.
  for (const tier of config.testTiers) {
    for (const f of ['overrides.md', 'backlog.md']) {
      if (!existsSync(path.join(projectRoot, '.claude', `${tier}-testing`, f))) warnings.push(`test tier "${tier}": .claude/${tier}-testing/${f} missing`);
    }
  }

  // Unfilled placeholders in project-owned files.
  const owned = ['.claude/rules/project.md', '.claude/gates.md', ...config.testTiers.map((t) => `.claude/${t}-testing/overrides.md`)];
  for (const rel of owned) {
    const full = path.join(projectRoot, rel);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const count = (text.match(PLACEHOLDER) ?? []).length;
    if (count) warnings.push(`${rel}: ${count} unfilled <placeholder>(s)`);
  }

  // devDependencies.
  const pkgFile = path.join(projectRoot, 'package.json');
  if (existsSync(pkgFile)) {
    const pkg = readJson(pkgFile);
    const have = { ...pkg.dependencies, ...pkg.devDependencies };
    const missing = requiredDevDependencies(readJson(configFile)).filter((d) => !have[d]);
    if (missing.length) warnings.push(`devDependencies missing: ${missing.join(', ')}`);
  }

  // Legacy AI setup left behind.
  for (const rel of LEGACY) {
    const full = path.join(projectRoot, rel);
    if (existsSync(full)) warnings.push(`legacy AI file/folder still present: ${rel}`);
  }
  const rulesDir = path.join(projectRoot, '.claude', 'rules');
  if (existsSync(rulesDir)) {
    for (const entry of readdirSync(rulesDir)) {
      if (entry !== 'golden' && entry !== 'project.md') warnings.push(`unexpected rule file .claude/rules/${entry} — project rules belong in .claude/rules/project.md`);
    }
  }

  // Git hooks active?
  const hooksPath = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: projectRoot, encoding: 'utf8' }).stdout.trim();
  if (!hooksPath.startsWith('.husky')) warnings.push('git hooks not active — run `npx husky` once (sets core.hooksPath to .husky/_)');

  return { errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node bin/doctor.mjs <project-dir>');
    process.exit(2);
  }
  const { errors, warnings } = doctor(path.resolve(target));
  for (const e of errors) console.log(`ERROR    ${e}`);
  for (const w of warnings) console.log(`warning  ${w}`);
  if (!errors.length && !warnings.length) console.log('ok — the project matches the golden workspace');
  process.exit(errors.length ? 1 : 0);
}
