// Turns a project's .claude/golden.json into the exact set of files sync
// writes. Pure: reads golden sources, returns { path, content, kind } items.
//   kind 'generated' — golden-owned, rewritten every sync, fingerprinted, protected
//   kind 'once'      — project-owned, created when missing, never overwritten
//   kind 'merge'     — merged into an existing file (settings.json)

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const MARKETPLACE = 'claude-golden';
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
  for (const p of c.packs) if (!PACKS.includes(p)) throw new Error(`Unknown pack "${p}" in golden.json (known: ${PACKS.join(', ')})`);
  c.planning ??= 'plan-file';
  c.testTiers ??= [];
  for (const t of c.testTiers) if (!TIERS.includes(t)) throw new Error(`Unknown test tier "${t}"`);
  c.packageManager ??= 'npm';
  c.lint = { strictScope: ['src/**'], ...(c.lint ?? {}) };
  c.commands = { typecheck: 'npx tsc -p tsconfig.app.json --noEmit --incremental', prePush: 'npm run lint && npm test', ...(c.commands ?? {}) };
  c.stylelint = { scss: false, tailwind: false, ...(c.stylelint ?? {}) };
  return c;
}

const exec = (c) => (c.packageManager === 'pnpm' ? 'pnpm exec' : 'npx --no-install');

function huskySteps(c) {
  const pre = ['echo "[hook:pre-commit] golden fingerprints…"', 'node tools/golden/lock/verify.mjs --staged'];
  const msg = [];
  if (c.packs.includes('openspec')) {
    pre.push('node tools/golden/openspec/tasks-gate.mjs --pre-commit');
    msg.push('node tools/golden/openspec/tasks-gate.mjs --commit-msg "$1"');
  }
  if (c.packs.includes('nestjs') && c.nestjs?.openapi) pre.push('node tools/golden/nestjs/openapi.mjs regenerate');
  return { pre, msg };
}

const fillSteps = (template, steps) => template.replace(
  /# >>> golden pack steps\n# <<< golden pack steps/,
  ['# >>> golden pack steps', ...steps, '# <<< golden pack steps'].join('\n'),
);

function i18nGlob(c) {
  const files = (c.i18n?.sets ?? []).flatMap((s) => [s.source, ...s.locales]);
  if (files.length === 0) return null;
  const dirs = [...new Set(files.map((f) => path.posix.dirname(f)))];
  return dirs.length === 1 ? `${dirs[0]}/*.json` : `{${dirs.join(',')}}/*.json`;
}

const fill = (s, values) => Object.entries(values).reduce((acc, [k, v]) => acc.split(k).join(v), s);

export function renderFiles(goldenRoot, rawConfig) {
  const c = normaliseConfig(rawConfig);
  const read = (rel) => readFileSync(path.join(goldenRoot, rel), 'utf8');
  const files = [];
  const add = (p, content, kind) => files.push({ path: p, content, kind });

  // Golden rules, one folder per pack.
  for (const pack of c.packs) {
    for (const f of walk(path.join(goldenRoot, 'plugins', pack, 'rules'))) {
      add(`.claude/rules/golden/${pack}/${f}`, read(`plugins/${pack}/rules/${f}`), 'generated');
    }
  }

  // Golden tooling.
  const tooling = [
    ['core', 'tooling/commitlint/golden-base.cjs', 'commitlint/golden-base.cjs'],
    ['core', 'tooling/lock/verify.mjs', 'lock/verify.mjs'],
    ['core', 'tooling/lock/fingerprint.mjs', 'lock/fingerprint.mjs'],
  ];
  if (c.packs.includes('angular')) {
    for (const f of walk(path.join(goldenRoot, 'plugins/angular/tooling/eslint'))) tooling.push(['angular', `tooling/eslint/${f}`, `eslint/${f}`]);
    tooling.push(['angular', 'tooling/stylelint/preset.mjs', 'stylelint/preset.mjs']);
    if (c.i18n?.sets?.length) for (const f of ['lib.mjs', 'i18n-validate.mjs', 'i18n-unused.mjs']) tooling.push(['angular', `tooling/i18n/${f}`, `i18n/${f}`]);
  }
  if (c.packs.includes('openspec')) tooling.push(['openspec', 'tooling/tasks-gate.mjs', 'openspec/tasks-gate.mjs']);
  if (c.packs.includes('nestjs') && c.nestjs?.openapi) tooling.push(['nestjs', 'tooling/openapi.mjs', 'nestjs/openapi.mjs']);
  for (const [pack, src, dest] of tooling) add(`tools/golden/${dest}`, read(`plugins/${pack}/${src}`), 'generated');

  // Generated index and git hooks.
  add('CLAUDE.md', fill(read('plugins/core/templates/claude/CLAUDE.md'), {
    __PLANNING__: c.planning,
    __PACKS__: c.packs.join(', '),
    __TEST_TIERS__: c.testTiers.length ? c.testTiers.join(', ') : 'none',
    __STRICT_SCOPE__: c.lint.strictScope.map((g) => `\`${g}\``).join(', '),
  }), 'generated');
  const steps = huskySteps(c);
  const values = { __EXEC__: exec(c), __TYPECHECK__: c.commands.typecheck, __PREPUSH__: c.commands.prePush };
  add('.husky/pre-commit', fill(fillSteps(read('plugins/core/tooling/husky/pre-commit'), steps.pre), values), 'generated');
  add('.husky/commit-msg', fill(fillSteps(read('plugins/core/tooling/husky/commit-msg'), steps.msg), values), 'generated');
  add('.husky/pre-push', fill(read('plugins/core/tooling/husky/pre-push'), values), 'generated');
  add('.claude/.gitignore', read('plugins/core/templates/claude/gitignore'), 'generated');

  // Project-owned files, created once.
  add('.claude/rules/project.md', read('plugins/core/templates/project/project.md'), 'once');
  add('.claude/gates.md', read('plugins/core/templates/claude/gates.md'), 'once');
  add('.claude/plans/backlog.md', read('plugins/core/templates/plans/backlog.md'), 'once');
  add('.claude/reviews/.gitkeep', '', 'once');
  for (const tier of c.testTiers) {
    add(`.claude/${tier}-testing/overrides.md`, read(`plugins/testing/templates/${tier}-testing/overrides.md`), 'once');
    add(`.claude/${tier}-testing/backlog.md`, read(`plugins/testing/templates/${tier}-testing/backlog.md`), 'once');
  }
  const glob = i18nGlob(c);
  const lintStaged = JSON.parse(read('plugins/core/tooling/lint-staged/lintstagedrc.json'));
  if (glob) lintStaged[glob] = lintStaged.__I18N_GLOB__;
  delete lintStaged.__I18N_GLOB__;
  add('.lintstagedrc.json', `${JSON.stringify(lintStaged, null, 2)}\n`, 'once');
  add('.prettierrc.json', read('plugins/core/tooling/prettier/prettierrc.json'), 'once');
  add('.prettierignore', read('plugins/core/tooling/prettier/prettierignore'), 'once');
  add('.editorconfig', read('plugins/core/tooling/editorconfig'), 'once');
  add('.gitleaks.toml', read('plugins/core/tooling/gitleaks.toml'), 'once');
  add('commitlint.config.cjs', [
    "module.exports = {",
    "  extends: ['./tools/golden/commitlint/golden-base.cjs'],",
    '  rules: {',
    "    // The project's capability slugs (project rules § Product), e.g. ['orders', 'auth', 'deps', 'ci']:",
    "    // 'scope-enum': [2, 'always', []],",
    '  },',
    '};',
    '',
  ].join('\n'), 'once');
  if (c.packs.includes('angular')) {
    add('eslint.config.mjs', [
      "import { readFileSync } from 'node:fs';",
      '',
      "import { goldenAngular } from './tools/golden/eslint/preset.mjs';",
      '',
      "const golden = JSON.parse(readFileSync(new URL('./.claude/golden.json', import.meta.url), 'utf8'));",
      '',
      'export default [',
      '  ...goldenAngular({ tsconfigRootDir: import.meta.dirname, ...golden.lint }),',
      '  // Project blocks below (outside the strict scope, or project-only rules).',
      '];',
      '',
    ].join('\n'), 'once');
    add('stylelint.config.mjs', [
      "import { readFileSync } from 'node:fs';",
      '',
      "import { goldenStylelint } from './tools/golden/stylelint/preset.mjs';",
      '',
      "const golden = JSON.parse(readFileSync(new URL('./.claude/golden.json', import.meta.url), 'utf8'));",
      '',
      'export default goldenStylelint({ ...golden.stylelint, strictScope: golden.lint.strictScope });',
      '',
    ].join('\n'), 'once');
  }

  // Settings: golden permissions + the packs enabled for this project.
  const settings = JSON.parse(read('plugins/core/templates/claude/settings.json'));
  settings.enabledPlugins = Object.fromEntries(c.packs.map((p) => [`${p}@${MARKETPLACE}`, true]));
  const pmPrefix = c.packageManager === 'pnpm' ? 'Bash(npm' : 'Bash(pnpm';
  for (const list of ['allow', 'ask']) settings.permissions[list] = settings.permissions[list].filter((e) => !e.startsWith(pmPrefix));
  add('.claude/settings.json', settings, 'merge');

  return { config: c, files };
}

export function requiredDevDependencies(rawConfig) {
  const c = normaliseConfig(rawConfig);
  const deps = ['husky', 'lint-staged', '@commitlint/cli', '@commitlint/config-conventional', 'prettier'];
  if (c.packs.includes('angular')) {
    deps.push('eslint', 'angular-eslint', 'typescript-eslint', 'eslint-plugin-import', 'eslint-plugin-security',
      'eslint-plugin-unicorn', 'eslint-config-prettier', 'stylelint', c.stylelint.scss ? 'stylelint-config-standard-scss' : 'stylelint-config-standard');
  }
  return deps;
}
