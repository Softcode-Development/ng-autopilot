// Turns a project's .claude/autopilot.json into the exact set of files sync
// writes. Pure: reads autopilot sources, returns { path, content, kind } items.
//   kind 'generated' — autopilot-owned, rewritten every sync, fingerprinted, protected
//   kind 'once'      — project-owned, created when missing, never overwritten
//   kind 'merge'     — merged into an existing file (settings.json)

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const MARKETPLACE = 'ng-autopilot';

// Pack keys in autopilot.json are short; plugin ids carry the product name.
export const pluginId = (pack) => `${pack === 'core' ? 'autopilot' : `autopilot-${pack}`}@${MARKETPLACE}`;
export const PACKS = ['core', 'angular', 'testing', 'nestjs', 'spartan', 'primeng', 'openspec'];
export const TIERS = ['unit', 'integration', 'e2e'];

const posix = (p) => p.replace(/\\/g, '/');

function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'test') continue;
      out.push(...walk(full, base));
    } else {
      out.push(posix(path.relative(base, full)));
    }
  }
  return out.sort();
}

export function normaliseConfig(raw) {
  const c = structuredClone(raw ?? {});
  c.packs = [...new Set(['core', ...(c.packs ?? [])])];
  for (const p of c.packs) if (!PACKS.includes(p)) throw new Error(`Unknown pack "${p}" in autopilot.json (known: ${PACKS.join(', ')})`);
  c.planning ??= 'plan-file';
  c.testTiers ??= [];
  for (const t of c.testTiers) if (!TIERS.includes(t)) throw new Error(`Unknown test tier "${t}"`);
  c.packageManager ??= 'npm';
  c.lint = { strictScope: ['src/**'], testingToolkit: 'src/testing', ...(c.lint ?? {}) };
  c.commands = { typecheck: 'npx tsc -p tsconfig.app.json --noEmit --incremental', prePush: 'npm run lint && npm test', ...(c.commands ?? {}) };
  c.stylelint = { scss: false, tailwind: false, ...(c.stylelint ?? {}) };
  c.api ??= {};
  return c;
}

// What each project doc answers — the README's "Start here" table.
const DOC_NEEDS = {
  GETTING_STARTED: 'Set up, run, test, build',
  TECH_STACK: 'Stack and versions; branch model, env, versioning',
  ARCHITECTURE: 'Code layout, new vs legacy code, state, patterns to reuse',
  DOMAIN: 'Domain terms, API, auth, markets / tenants',
  FEATURES: 'Features and their status',
  DESIGN_SYSTEM: 'UI for new code: primitives, tokens, layout',
  DATA_MODEL: 'Database schema and data rules',
};

// The project doc set: path in the project → template in the autopilot repo.
export function projectDocs(c) {
  const docs = ['TECH_STACK', 'ARCHITECTURE', 'DOMAIN', 'FEATURES', 'GETTING_STARTED'].map((d) => [`docs/${d}.md`, `plugins/core/templates/docs/${d}.md`]);
  if (c.packs.includes('angular')) docs.push(['docs/DESIGN_SYSTEM.md', 'plugins/angular/templates/docs/DESIGN_SYSTEM.md']);
  if (c.packs.includes('nestjs')) docs.push(['docs/DATA_MODEL.md', 'plugins/nestjs/templates/docs/DATA_MODEL.md']);
  return docs;
}

export const apiMissing = (c) => !c.api.none && (!c.api.baseUrl || !c.api.docsUrl);

function apiLine(c) {
  if (c.api.none) return 'none — the project calls no backend API.';
  if (apiMissing(c)) return '**not set** — before wiring any endpoint, ask the owner for the API base and docs URLs, then record them with `/autopilot:install` (reconfigure).';
  return `base \`${c.api.baseUrl}\` · docs ${c.api.docsUrl} — verify every endpoint, param and enum spelling in the docs before wiring; the docs win over existing code.`;
}

const exec = (c) => (c.packageManager === 'pnpm' ? 'pnpm exec' : 'npx --no-install');

function huskySteps(c) {
  const pre = ['echo "[hook:pre-commit] autopilot fingerprints…"', 'node tools/autopilot/lock/verify.mjs --staged'];
  const msg = [];
  if (c.packs.includes('openspec') && c.planning === 'openspec') {
    pre.push('node tools/autopilot/openspec/tasks-gate.mjs --pre-commit');
    msg.push('node tools/autopilot/openspec/tasks-gate.mjs --commit-msg "$1"');
  }
  if (c.packs.includes('nestjs') && c.nestjs?.openapi) pre.push('node tools/autopilot/nestjs/openapi.mjs regenerate');
  return { pre, msg };
}

const fillSteps = (template, steps) => template.replace(
  /# >>> autopilot pack steps\n# <<< autopilot pack steps/,
  ['# >>> autopilot pack steps', ...steps, '# <<< autopilot pack steps'].join('\n'),
);

const fill = (s, values) => Object.entries(values).reduce((acc, [k, v]) => acc.split(k).join(v), s);

export function renderFiles(autopilotRoot, rawConfig) {
  const c = normaliseConfig(rawConfig);
  const read = (rel) => readFileSync(path.join(autopilotRoot, rel), 'utf8');
  const files = [];
  const add = (p, content, kind) => files.push({ path: p, content, kind });

  // Autopilot rules, one folder per pack.
  for (const pack of c.packs) {
    for (const f of walk(path.join(autopilotRoot, 'plugins', pack, 'rules'))) {
      add(`.claude/rules/autopilot/${pack}/${f}`, read(`plugins/${pack}/rules/${f}`), 'generated');
    }
  }

  // Autopilot tooling.
  const tooling = [
    ['core', 'tooling/commitlint/autopilot-base.cjs', 'commitlint/autopilot-base.cjs'],
    ['core', 'tooling/lock/verify.mjs', 'lock/verify.mjs'],
    ['core', 'tooling/lock/fingerprint.mjs', 'lock/fingerprint.mjs'],
    ['core', 'tooling/lint-staged/preset.mjs', 'lint-staged/preset.mjs'],
  ];
  if (c.packs.includes('angular')) {
    for (const f of walk(path.join(autopilotRoot, 'plugins/angular/tooling/eslint'))) tooling.push(['angular', `tooling/eslint/${f}`, `eslint/${f}`]);
    tooling.push(['angular', 'tooling/stylelint/preset.mjs', 'stylelint/preset.mjs']);
    if (c.i18n?.sets?.length) for (const f of ['lib.mjs', 'i18n-validate.mjs', 'i18n-unused.mjs']) tooling.push(['angular', `tooling/i18n/${f}`, `i18n/${f}`]);
  }
  if (c.packs.includes('openspec')) tooling.push(['openspec', 'tooling/tasks-gate.mjs', 'openspec/tasks-gate.mjs']);
  if (c.packs.includes('nestjs') && c.nestjs?.openapi) tooling.push(['nestjs', 'tooling/openapi.mjs', 'nestjs/openapi.mjs']);
  for (const [pack, src, dest] of tooling) add(`tools/autopilot/${dest}`, read(`plugins/${pack}/${src}`), 'generated');

  // Generated index and git hooks.
  add('CLAUDE.md', fill(read('plugins/core/templates/claude/CLAUDE.md'), {
    __PLANNING__: c.planning,
    __PACKS__: c.packs.join(', '),
    __TEST_TIERS__: c.testTiers.length ? c.testTiers.join(', ') : 'none',
    __STRICT_SCOPE__: c.lint.strictScope.map((g) => `\`${g}\``).join(', '),
    __API__: apiLine(c),
    __DOCS__: projectDocs(c).map(([p]) => `[${path.posix.basename(p)}](${p})`).join(' · '),
  }), 'generated');
  const steps = huskySteps(c);
  const values = { __EXEC__: exec(c), __TYPECHECK__: c.commands.typecheck, __PREPUSH__: c.commands.prePush };
  add('.husky/pre-commit', fill(fillSteps(read('plugins/core/tooling/husky/pre-commit'), steps.pre), values), 'generated');
  add('.husky/commit-msg', fill(fillSteps(read('plugins/core/tooling/husky/commit-msg'), steps.msg), values), 'generated');
  add('.husky/pre-push', fill(read('plugins/core/tooling/husky/pre-push'), values), 'generated');
  add('.claude/.gitignore', read('plugins/core/templates/claude/gitignore'), 'generated');

  // Project-owned files, created once.
  add('.claude/rules/project.md', read('plugins/core/templates/project/project.md'), 'once');
  const startHere = [...projectDocs(c)].sort(([a], [b]) => (a.endsWith('GETTING_STARTED.md') ? -1 : b.endsWith('GETTING_STARTED.md') ? 1 : 0))
    .map(([p]) => `| ${DOC_NEEDS[path.posix.basename(p, '.md')]} | [${p}](${p}) |`).join('\n');
  add('README.md', fill(read('plugins/core/templates/project/README.md'), { __START_HERE__: startHere }), 'once');
  for (const [doc, template] of projectDocs(c)) add(doc, read(template), 'once');
  add('.claude/gates.md', read('plugins/core/templates/claude/gates.md'), 'once');
  add('.claude/plans/backlog.md', read('plugins/core/templates/plans/backlog.md'), 'once');
  add('.claude/reviews/.gitkeep', '', 'once');
  for (const tier of c.testTiers) {
    add(`.claude/${tier}-testing/overrides.md`, read(`plugins/testing/templates/${tier}-testing/overrides.md`), 'once');
    add(`.claude/${tier}-testing/backlog.md`, read(`plugins/testing/templates/${tier}-testing/backlog.md`), 'once');
  }
  if (c.packs.includes('testing') && c.lint.testingToolkit) {
    add(`${c.lint.testingToolkit.replace(/\/$/, '')}/README.md`, read('plugins/testing/templates/toolkit/README.md'), 'once');
  }
  add('.lintstagedrc.mjs', [
    "import { readFileSync } from 'node:fs';",
    '',
    "import { autopilotLintStaged } from './tools/autopilot/lint-staged/preset.mjs';",
    '',
    "const autopilot = JSON.parse(readFileSync(new URL('./.claude/autopilot.json', import.meta.url), 'utf8'));",
    '',
    'export default {',
    '  ...autopilotLintStaged(autopilot),',
    '  // Project entries below.',
    '};',
    '',
  ].join('\n'), 'once');
  add('.prettierrc.json', read('plugins/core/tooling/prettier/prettierrc.json'), 'once');
  add('.prettierignore', read('plugins/core/tooling/prettier/prettierignore'), 'once');
  add('.editorconfig', read('plugins/core/tooling/editorconfig'), 'once');
  add('.gitleaks.toml', read('plugins/core/tooling/gitleaks.toml'), 'once');
  add('commitlint.config.cjs', [
    "module.exports = {",
    "  extends: ['./tools/autopilot/commitlint/autopilot-base.cjs'],",
    '  rules: {',
    "    // The project's capability slugs (docs/FEATURES.md), e.g. ['orders', 'auth', 'deps', 'ci']:",
    "    // 'scope-enum': [2, 'always', []],",
    '  },',
    '};',
    '',
  ].join('\n'), 'once');
  if (c.packs.includes('angular')) {
    add('eslint.config.mjs', [
      "import { readFileSync } from 'node:fs';",
      '',
      "import { autopilotAngular } from './tools/autopilot/eslint/preset.mjs';",
      '',
      "const autopilot = JSON.parse(readFileSync(new URL('./.claude/autopilot.json', import.meta.url), 'utf8'));",
      '',
      'export default [',
      '  ...autopilotAngular({ tsconfigRootDir: import.meta.dirname, ...autopilot.lint }),',
      '  // Project blocks below (outside the strict scope, or project-only rules).',
      '];',
      '',
    ].join('\n'), 'once');
    add('stylelint.config.mjs', [
      "import { readFileSync } from 'node:fs';",
      '',
      "import { autopilotStylelint } from './tools/autopilot/stylelint/preset.mjs';",
      '',
      "const autopilot = JSON.parse(readFileSync(new URL('./.claude/autopilot.json', import.meta.url), 'utf8'));",
      '',
      'export default autopilotStylelint({ ...autopilot.stylelint, strictScope: autopilot.lint.strictScope });',
      '',
    ].join('\n'), 'once');
  }

  // Settings: autopilot permissions + the packs enabled for this project.
  const settings = JSON.parse(read('plugins/core/templates/claude/settings.json'));
  settings.enabledPlugins = Object.fromEntries(c.packs.map((p) => [pluginId(p), true]));
  const pmPrefix = c.packageManager === 'pnpm' ? 'Bash(npm' : 'Bash(pnpm';
  for (const list of ['allow', 'ask']) settings.permissions[list] = settings.permissions[list].filter((e) => !e.startsWith(pmPrefix));
  add('.claude/settings.json', settings, 'merge');

  return { config: c, files };
}

export function requiredDevDependencies(rawConfig) {
  const c = normaliseConfig(rawConfig);
  const deps = ['husky', 'lint-staged', '@commitlint/cli', '@commitlint/config-conventional', 'prettier'];
  if (c.packs.includes('angular')) {
    deps.push('eslint', 'angular-eslint', 'typescript-eslint', 'eslint-plugin-import-x', 'eslint-plugin-security',
      'eslint-plugin-unicorn', 'eslint-config-prettier', 'stylelint', c.stylelint.scss ? 'stylelint-config-standard-scss' : 'stylelint-config-standard');
  }
  return deps;
}
