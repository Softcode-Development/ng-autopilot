#!/usr/bin/env node
// Autopilot drift check for a project.
//
//   node bin/doctor.mjs <project-dir>
//
// Errors (exit 1): invalid autopilot.json, generated files edited/deleted/added,
// generated files out of date with the autopilot repo. Warnings: plugins not
// enabled, tiers without overrides, unfilled placeholders, broken doc links,
// missing devDependencies, legacy AI files, inactive git hooks. Notes (no effect
// on the verdict): test tiers the owner paused.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fingerprint, LOCK_PATH } from '../plugins/core/tooling/lock/fingerprint.mjs';
import { verifyAll } from '../plugins/core/tooling/lock/verify.mjs';
import { readPackageJson, stackDrift } from '../plugins/core/hooks/lib/stack-drift.mjs';
import { apiMissing, normaliseConfig, pausedTiers, pluginId, renderFiles, requiredDependencies, requiredDevDependencies, TIERS } from './lib/render.mjs';
import { brokenLinks } from './links.mjs';
import { prefixSource } from '../plugins/spartan/tooling/prefix.mjs';
import { presetHeaderVersion } from '../plugins/spartan/tooling/spartan-css.mjs';
import { AUTOPILOT_ROOT } from './sync.mjs';

const PLACEHOLDER = /<(?![!/]|https?:)[A-Za-z…][^<>\n]{2,}>/g;
const LEGACY = [
  '.claude/agents', '.claude/skills', '.claude/instructions', '.claude/prompts', '.claude/commands',
  '.github/copilot-instructions.md', '.github/prompts', '.github/instructions', '.github/agents',
  '.cursor', '.cursorrules', 'AGENTS.md', '.windsurfrules',
];

const CONTEXT = 8;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, '');

// Template placeholders the project still has verbatim. A placeholder counts only
// next to its template neighbours (a few characters either side on its line), so
// the project's own `<version>-<build>` or `features/<slug>` is not a hit.
// `## 4.2 Typography`, `## 9.N — Name` → `typography`, `name`.
const sectionTitle = (heading) => heading.replace(/^#{2,3}\s+/, '').replace(/^\d+(\.(\d+|N))*\.?\s*(—\s*)?/, '').trim().toLowerCase();
const headings = (text) => stripComments(text).split(/\r?\n/).filter((l) => /^#{2,3}\s/.test(l));

// Section headings (## / ###) of a template the project doc no longer has. Numbering and
// case don't matter; headings that are themselves fill-ins (<…>, {…}) are skipped; extra
// project sections never count.
export function missingSections(template, text) {
  const have = new Set(headings(text).map(sectionTitle));
  return headings(template)
    .filter((h) => !/[<{]/.test(h))
    .map((h) => [sectionTitle(h), h.replace(/^#{2,3}\s+/, '').replace(/^\d+(\.\d+)*\.?\s*/, '').trim()])
    .filter(([title]) => title && !have.has(title))
    .map(([, shown]) => shown);
}

// Example markup in a pre-filled template (`<section class="…">`, `<p-toast />`, `<label for>`)
// is content to keep, not a fill-in.
const ELEMENTS = 'html|body|head|section|div|span|p|form|label|i|a|button|input|select|textarea|ul|ol|li|nav|main|header|footer|aside|table|tr|td|th|img|script|style|template|ng-container|ng-template';
const MARKUP = new RegExp(`^<(?:[a-z][a-z0-9]*-[a-z0-9-]+|${ELEMENTS})(?=[\\s>/])|="|/>$`);

export function unfilledPlaceholders(template, text) {
  const hits = new Set();
  for (const line of stripComments(template).split('\n')) {
    for (const m of line.matchAll(PLACEHOLDER)) {
      if (MARKUP.test(m[0])) continue;
      const before = line.slice(Math.max(0, m.index - CONTEXT), m.index).trimStart();
      const after = line.slice(m.index + m[0].length, m.index + m[0].length + CONTEXT).trimEnd();
      const kept = before || after ? (before && text.includes(before + m[0])) || (after && text.includes(m[0] + after)) : text.includes(m[0]);
      if (kept) hits.add(m[0]);
    }
  }
  return [...hits];
}

const walkFiles = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []);
const staticDir = (glob) => glob.split('/').filter((_, i, parts) => !parts.slice(0, i + 1).some((p) => /[*?{[]/.test(p))).join('/');

// spartan starter: brand files, and in the legacy setup the prefixed generated code and preset copy.
function spartanChecks(projectRoot, config) {
  const out = [];
  for (const b of config.design.brands) {
    if (!existsSync(path.join(projectRoot, 'src', 'styles', 'brands', `${b}.css`))) out.push(`brand "${b}": src/styles/brands/${b}.css missing — run sync to create it`);
  }
  if (!config.design.legacyCss) return out;
  try {
    for (const dir of (config.lint.vendorGlobs ?? []).map(staticDir)) {
      const unprefixed = walkFiles(path.join(projectRoot, dir)).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts')).filter((f) => {
        const text = readFileSync(f, 'utf8');
        return prefixSource(text, 'tw', { from: projectRoot }) !== text;
      });
      if (unprefixed.length) out.push(`unprefixed classes in spartan-generated code (${unprefixed.length} file${unprefixed.length > 1 ? 's' : ''}) — run node tools/autopilot/spartan/prefix.mjs ${dir}`);
    }
  } catch (e) {
    out.push(`spartan prefix check skipped: ${e.message}`);
  }
  const presetFile = path.join(projectRoot, 'src', 'styles', 'spartan-preset.css');
  const brainFile = path.join(projectRoot, 'node_modules', '@spartan-ng', 'brain', 'package.json');
  const fix = 'node tools/autopilot/spartan/spartan-css.mjs preset src/styles/spartan-preset.css';
  if (!existsSync(presetFile)) {
    out.push(`src/styles/spartan-preset.css missing — run ${fix}`);
  } else if (existsSync(brainFile)) {
    const copied = presetHeaderVersion(readFileSync(presetFile, 'utf8'));
    const installed = readJson(brainFile).version;
    if (copied !== installed) out.push(`spartan-preset.css was copied from @spartan-ng/brain ${copied ?? 'an unknown version'}; installed ${installed} — run ${fix}`);
  }
  return out;
}

export function doctor(projectRoot) {
  const errors = [];
  const warnings = [];
  const notes = [];
  const configFile = path.join(projectRoot, '.claude', 'autopilot.json');
  if (!existsSync(configFile)) return { errors: ['.claude/autopilot.json missing — run /autopilot:install'], warnings, notes };

  let config;
  let raw;
  try {
    raw = readJson(configFile);
    config = normaliseConfig(raw);
  } catch (e) {
    return { errors: [`.claude/autopilot.json: ${e.message}`], warnings, notes };
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

  // Test tiers. A paused tier is a note, not a problem: the owner chose it.
  for (const tier of pausedTiers(config)) {
    notes.push(`test tier "${tier}" paused (testing.${tier}.enabled: false) — no new ${tier} specs; criteria that need it go to a hand-off in .claude/plans/handoff/; its existing specs still run in the checkpoint and final gate`);
  }
  for (const tier of TIERS.filter((t) => !config.testTiers.includes(t) && raw.testing?.[t])) {
    warnings.push(`testing.${tier} is set but "${tier}" is not in testTiers — the setting does nothing`);
  }
  for (const tier of config.testTiers) {
    for (const f of ['overrides.md', 'backlog.md']) {
      if (!existsSync(path.join(projectRoot, '.claude', `${tier}-testing`, f))) warnings.push(`test tier "${tier}": .claude/${tier}-testing/${f} missing`);
    }
  }

  // Unfilled placeholders in project-owned files: a template placeholder still present verbatim.
  // Templates write text that stays as written in {braces}, so only <angle> fill-ins count.
  for (const f of files.filter((x) => x.kind === 'once' && x.path.endsWith('.md'))) {
    const full = path.join(projectRoot, f.path);
    if (!existsSync(full)) {
      warnings.push(`${f.path} missing — run sync to create it`);
      continue;
    }
    const unfilled = unfilledPlaceholders(f.content.replaceAll('\r\n', '\n'), stripComments(readFileSync(full, 'utf8')));
    if (f.path === 'README.md' || f.path.startsWith('docs/')) {
      const missing = missingSections(f.content, readFileSync(full, 'utf8'));
      if (missing.length) warnings.push(`${f.path}: missing section(s) from its template: ${missing.join(', ')} — add them, or keep the heading with <!-- not applicable: reason -->`);
    }
    const short = (p) => (p.length > 40 ? `${p.slice(0, 38)}…>` : p);
    if (unfilled.length) warnings.push(`${f.path}: ${unfilled.length} unfilled <placeholder>(s): ${unfilled.map(short).join(' ')}`);
  }

  // Links between the project's own docs.
  for (const b of brokenLinks(projectRoot)) warnings.push(`broken link in ${b.file}: ${b.target}`);

  // devDependencies.
  const pkgFile = path.join(projectRoot, 'package.json');
  if (existsSync(pkgFile)) {
    const pkg = readJson(pkgFile);
    const have = { ...pkg.dependencies, ...pkg.devDependencies };
    const missingRuntime = requiredDependencies(readJson(configFile)).filter((d) => !have[d]);
    if (missingRuntime.length) warnings.push(`dependencies missing: ${missingRuntime.join(', ')}`);
    const missing = requiredDevDependencies(readJson(configFile)).filter((d) => !have[d]);
    if (missing.length) warnings.push(`devDependencies missing: ${missing.join(', ')}`);
  }

  // Design-system starter: Tailwind v4 through .postcssrc.json, or the classes silently stop.
  if ((config.packs.includes('primeng') || config.packs.includes('spartan')) && config.design.starter) {
    const installed = path.join(projectRoot, 'node_modules', 'tailwindcss', 'package.json');
    const version = existsSync(installed) ? readJson(installed).version : null;
    if (version && Number(version.split('.')[0]) < 4) warnings.push(`tailwindcss ${version} installed — the design-system starter needs Tailwind v4 (npm install -D tailwindcss@4 @tailwindcss/postcss)`);
    if (existsSync(path.join(projectRoot, 'postcss.config.json'))) {
      warnings.push('postcss.config.json shadows .postcssrc.json (Angular reads it first) — move "@tailwindcss/postcss" into it and delete .postcssrc.json, or delete it');
    }
  }

  if (apiMissing(config)) warnings.push('api.baseUrl / api.docsUrl not set — agents cannot verify endpoints; set them with /autopilot:install (reconfigure), or api.none for a project without a backend API');

  // Technology added since install.
  warnings.push(...stackDrift(readPackageJson(projectRoot), config).map((d) => `stack drift: ${d}`));

  // Legacy AI setup left behind. Official skills the packs install are expected, not leftovers.
  const officialSkills = config.packs.includes('spartan') ? ['spartan'] : [];
  for (const rel of LEGACY) {
    const full = path.join(projectRoot, rel);
    if (!existsSync(full)) continue;
    if (rel === '.claude/skills') {
      for (const skill of readdirSync(full)) {
        if (!officialSkills.includes(skill)) warnings.push(`legacy AI file/folder still present: ${rel}/${skill}`);
      }
    } else {
      warnings.push(`legacy AI file/folder still present: ${rel}`);
    }
  }
  for (const skill of officialSkills) {
    if (!existsSync(path.join(projectRoot, '.claude', 'skills', skill))) warnings.push(`${skill} skill missing — npx skills add spartan-ng/spartan -a claude-code -y --copy`);
  }

  if (config.packs.includes('spartan') && config.design.starter) warnings.push(...spartanChecks(projectRoot, config));
  const rulesDir = path.join(projectRoot, '.claude', 'rules');
  if (existsSync(rulesDir)) {
    for (const entry of readdirSync(rulesDir)) {
      if (entry !== 'autopilot' && entry !== 'project.md') warnings.push(`unexpected rule file .claude/rules/${entry} — project rules belong in .claude/rules/project.md`);
    }
  }

  // Git hooks active?
  const hooksPath = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: projectRoot, encoding: 'utf8' }).stdout.trim();
  if (!hooksPath.startsWith('.husky')) warnings.push('git hooks not active — run `npx husky` once (sets core.hooksPath to .husky/_)');

  return { errors, warnings, notes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node bin/doctor.mjs <project-dir>');
    process.exit(2);
  }
  const { errors, warnings, notes } = doctor(path.resolve(target));
  for (const e of errors) console.log(`ERROR    ${e}`);
  for (const w of warnings) console.log(`warning  ${w}`);
  for (const n of notes) console.log(`note     ${n}`);
  if (!errors.length && !warnings.length) console.log('ok — the project matches the ng-autopilot workspace');
  process.exit(errors.length ? 1 : 0);
}
