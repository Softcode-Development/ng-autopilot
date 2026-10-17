#!/usr/bin/env node
// Autopilot drift check for a project.
//
//   node bin/doctor.mjs <project-dir>
//
// Errors (exit 1): invalid autopilot.json, generated files edited/deleted/added,
// generated files out of date with the autopilot repo. Warnings: plugins not
// enabled, tiers without overrides, unfilled placeholders, broken doc links,
// missing devDependencies, legacy AI files, inactive git hooks.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fingerprint, LOCK_PATH } from '../plugins/core/tooling/lock/fingerprint.mjs';
import { verifyAll } from '../plugins/core/tooling/lock/verify.mjs';
import { readPackageJson, stackDrift } from '../plugins/core/hooks/lib/stack-drift.mjs';
import { apiMissing, normaliseConfig, pluginId, renderFiles, requiredDevDependencies } from './lib/render.mjs';
import { brokenLinks } from './links.mjs';
import { AUTOPILOT_ROOT } from './sync.mjs';

const PLACEHOLDER = /<(?![!/]|https?:)[A-Za-z…][^<>\n]{2,}>/g;
const LEGACY = [
  '.claude/agents', '.claude/skills', '.claude/instructions', '.claude/prompts', '.claude/commands',
  '.github/copilot-instructions.md', '.github/prompts', '.github/instructions', '.github/agents',
  '.cursor', '.cursorrules', 'AGENTS.md', '.windsurfrules',
];

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, '');

export function doctor(projectRoot) {
  const errors = [];
  const warnings = [];
  const configFile = path.join(projectRoot, '.claude', 'autopilot.json');
  if (!existsSync(configFile)) return { errors: ['.claude/autopilot.json missing — run /autopilot:install'], warnings };

  let config;
  try {
    config = normaliseConfig(readJson(configFile));
  } catch (e) {
    return { errors: [`.claude/autopilot.json: ${e.message}`], warnings };
  }

  // Generated files vs their fingerprints.
  errors.push(...verifyAll(projectRoot));

  // Generated files vs what the autopilot repo would generate now.
  const { files } = renderFiles(AUTOPILOT_ROOT, readJson(configFile));
  const lockFile = path.join(projectRoot, LOCK_PATH);
  const lock = existsSync(lockFile) ? readJson(lockFile) : { files: {} };
  const expected = Object.fromEntries(files.filter((f) => f.kind === 'generated').map((f) => [f.path, fingerprint(f.content)]));
  const stale = Object.keys(expected).filter((f) => lock.files[f] !== expected[f]);
  const extra = Object.keys(lock.files).filter((f) => !expected[f]);
  if (stale.length || extra.length) errors.push(`autopilot repo has changed since the last sync (${stale.length + extra.length} file(s)) — run sync`);

  // Plugins enabled for this project.
  const settingsFile = path.join(projectRoot, '.claude', 'settings.json');
  const enabled = existsSync(settingsFile) ? readJson(settingsFile).enabledPlugins ?? {} : {};
  for (const p of config.packs) if (enabled[pluginId(p)] !== true) warnings.push(`plugin ${pluginId(p)} not enabled in .claude/settings.json`);

  // Test tiers.
  for (const tier of config.testTiers) {
    for (const f of ['overrides.md', 'backlog.md']) {
      if (!existsSync(path.join(projectRoot, '.claude', `${tier}-testing`, f))) warnings.push(`test tier "${tier}": .claude/${tier}-testing/${f} missing`);
    }
  }

  // Unfilled placeholders in project-owned files: a template placeholder still present verbatim.
  // Angle brackets the project writes itself (`features/<domain>/`) are not placeholders.
  for (const f of files.filter((x) => x.kind === 'once' && x.path.endsWith('.md'))) {
    const full = path.join(projectRoot, f.path);
    if (!existsSync(full)) {
      warnings.push(`${f.path} missing — run sync to create it`);
      continue;
    }
    const text = stripComments(readFileSync(full, 'utf8'));
    const unfilled = [...new Set(stripComments(f.content).match(PLACEHOLDER) ?? [])].filter((p) => text.includes(p));
    if (unfilled.length) warnings.push(`${f.path}: ${unfilled.length} unfilled <placeholder>(s)`);
  }

  // Links between the project's own docs.
  for (const b of brokenLinks(projectRoot)) warnings.push(`broken link in ${b.file}: ${b.target}`);

  // devDependencies.
  const pkgFile = path.join(projectRoot, 'package.json');
  if (existsSync(pkgFile)) {
    const pkg = readJson(pkgFile);
    const have = { ...pkg.dependencies, ...pkg.devDependencies };
    const missing = requiredDevDependencies(readJson(configFile)).filter((d) => !have[d]);
    if (missing.length) warnings.push(`devDependencies missing: ${missing.join(', ')}`);
  }

  if (apiMissing(config)) warnings.push('api.baseUrl / api.docsUrl not set — agents cannot verify endpoints; set them with /autopilot:install (reconfigure), or api.none for a project without a backend API');

  // Technology added since install.
  warnings.push(...stackDrift(readPackageJson(projectRoot), config).map((d) => `stack drift: ${d}`));

  // Legacy AI setup left behind.
  for (const rel of LEGACY) {
    const full = path.join(projectRoot, rel);
    if (existsSync(full)) warnings.push(`legacy AI file/folder still present: ${rel}`);
  }
  const rulesDir = path.join(projectRoot, '.claude', 'rules');
  if (existsSync(rulesDir)) {
    for (const entry of readdirSync(rulesDir)) {
      if (entry !== 'autopilot' && entry !== 'project.md') warnings.push(`unexpected rule file .claude/rules/${entry} — project rules belong in .claude/rules/project.md`);
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
  if (!errors.length && !warnings.length) console.log('ok — the project matches the ng-autopilot workspace');
  process.exit(errors.length ? 1 : 0);
}
