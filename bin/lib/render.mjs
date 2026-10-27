// Turns a project's .claude/autopilot.json into the exact set of files sync
// writes. Pure: reads autopilot sources, returns { path, content, kind } items.
//   kind 'generated' — autopilot-owned, rewritten every sync, fingerprinted, protected
//   kind 'once'      — project-owned, created when missing, never overwritten
//   kind 'merge'     — merged into an existing file (settings.json, .mcp.json)

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const MARKETPLACE = 'ng-autopilot';

// Pack keys in autopilot.json are short; plugin ids carry the product name.
export const pluginId = (pack) => `${pack === 'core' ? 'autopilot' : `autopilot-${pack}`}@${MARKETPLACE}`;
export const PACKS = ['core', 'angular', 'testing', 'nestjs', 'spartan', 'primeng', 'openspec'];
export const TIERS = ['unit', 'integration', 'e2e'];
// The agents' browser (tools/autopilot/browser/, cloud/setup.sh): exact versions, so every
// project and the cloud setup's npx cache run the same build.
export const BROWSER_VERSIONS = { __PLAYWRIGHT_MCP__: '0.0.83', __PLAYWRIGHT__: '1.64.0' };

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

// The SessionStart hook that prepares a cloud session (cloud: true in autopilot.json).
export const CLOUD_HOOK = {
  matcher: 'startup|resume',
  hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/tools/autopilot/cloud/session-start.mjs"', timeout: 600 }],
};

export const TEST_PHASES = ['orchestrated', 'single-review'];

// testing: { unit: { enabled }, integration: { enabled }, e2e: { enabled }, phase }.
// A disabled tier is paused: no new specs at it, its existing specs still run.
function normaliseTesting(raw = {}) {
  const t = { phase: 'orchestrated', ...raw };
  for (const key of Object.keys(t)) {
    if (key !== 'phase' && !TIERS.includes(key)) throw new Error(`testing.${key}: unknown test tier (known: ${TIERS.join(', ')})`);
  }
  if (!TEST_PHASES.includes(t.phase)) throw new Error(`testing.phase: "${t.phase}" (known: ${TEST_PHASES.join(', ')})`);
  for (const tier of TIERS) {
    t[tier] = { enabled: true, ...(t[tier] ?? {}) };
    if (typeof t[tier].enabled !== 'boolean') throw new Error(`testing.${tier}.enabled must be true or false`);
  }
  return t;
}

// The project's tiers that take new specs, and the ones paused with testing.<tier>.enabled: false.
export const activeTiers = (c) => c.testTiers.filter((t) => c.testing[t].enabled);
export const pausedTiers = (c) => c.testTiers.filter((t) => !c.testing[t].enabled);

export function normaliseConfig(raw) {
  const c = structuredClone(raw ?? {});
  c.packs = [...new Set(['core', ...(c.packs ?? [])])];
  for (const p of c.packs) if (!PACKS.includes(p)) throw new Error(`Unknown pack "${p}" in autopilot.json (known: ${PACKS.join(', ')})`);
  c.planning ??= 'plan-file';
  c.testTiers ??= [];
  for (const t of c.testTiers) if (!TIERS.includes(t)) throw new Error(`Unknown test tier "${t}"`);
  c.testing = normaliseTesting(c.testing);
  c.limits = { parallelTestAgents: 3, ...(c.limits ?? {}) };
  if (!Number.isInteger(c.limits.parallelTestAgents) || c.limits.parallelTestAgents < 1) {
    throw new Error('limits.parallelTestAgents must be a whole number of at least 1');
  }
  c.packageManager ??= 'npm';
  c.lint = { strictScope: ['src/**'], testingToolkit: 'src/testing', ...(c.lint ?? {}) };
  c.commands = { typecheck: 'npx tsc -p tsconfig.app.json --noEmit --incremental', prePush: 'npm run lint && npm test', ...(c.commands ?? {}) };
  c.design = { starter: false, legacyCss: false, darkMode: true, brands: [], legacyLibraries: [], ...(c.design ?? {}) };
  for (const l of c.design.legacyLibraries) if (!['primeng', 'spartan'].includes(l)) throw new Error(`design.legacyLibraries: "${l}" — only a UI library kept for legacy screens (primeng, spartan)`);
  for (const key of ['brands', 'legacyLibraries']) if (!Array.isArray(c.design[key])) throw new Error(`design.${key} must be a list of names, e.g. ["a", "b"]`);
  for (const b of c.design.brands) if (!/^[a-z][a-z0-9-]*$/.test(b)) throw new Error(`design.brands: "${b}" — use a bare lowercase name (class brand-<name>)`);
  if (c.design.starter && c.packs.includes('primeng') && c.packs.includes('spartan')) {
    throw new Error('design.starter needs one UI library per project — primeng or spartan, not both');
  }
  c.stylelint = { scss: false, tailwind: c.design.starter, ...(c.stylelint ?? {}) };
  c.api ??= {};
  c.cloud ??= false;
  if (typeof c.cloud !== 'boolean') throw new Error('cloud must be true or false');
  return c;
}

// Conditional blocks in templates: `{{#flag}}…{{/flag}}` stays when the flag is true,
// `{{^flag}}…{{/flag}}` when it is false; the other is removed with its content.
export function fillBlocks(text, flags) {
  // A marker on its own line takes its line break with it. Repeated until stable, so a block
  // nested inside another flag's block resolves too.
  const once = (t) => t.replace(/\{\{([#^])(\w+)\}\}(?:\r?\n)?([\s\S]*?)\{\{\/\2\}\}(?:\r?\n)?/g, (_, kind, flag, body) => {
    const keep = kind === '#' ? Boolean(flags[flag]) : !flags[flag];
    return keep ? body : '';
  });
  let out = text;
  for (let prev = null; prev !== out;) [prev, out] = [out, once(out)];
  return out;
}

// Static directory part of a glob: 'src/app/features/**' → 'src/app/features'.
const globDir = (glob) => glob.split('/').filter((_, i, parts) => !parts.slice(0, i + 1).some((p) => /[*?{[]/.test(p))).join('/');

// Values for the design-system starter and the PrimeNG DESIGN_SYSTEM template.
export function designValues(c) {
  const legacy = c.design.legacyCss;
  return {
    __TW__: legacy ? 'tw:' : '',
    __DARK_CLASS__: c.packs.includes('spartan') ? 'dark' : 'app-dark',
    __BRAND_IMPORTS__: c.design.brands.map((b) => `@import './brands/${b}.css';`).join('\n'),
    __DARK_SELECTOR__: c.design.darkMode ? "'.app-dark'" : 'false',
    __CSS_LAYER__: legacy ? 'false' : "{ name: 'primeng', order: 'theme, base, primeng' }",
    // Legacy setup scans only new code — plus index.html, which carries the <body> classes.
    __SOURCES__: legacy ? [...new Set([...c.lint.strictScope.map(globDir), 'src/index.html'])].map((d) => `@source "${path.posix.relative('src/styles', d)}";`).join('\n') : '',
  };
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
  if (c.packs.includes('angular')) {
    const pack = c.packs.includes('spartan') ? 'spartan' : c.packs.includes('primeng') ? 'primeng' : 'angular';
    docs.push(['docs/DESIGN_SYSTEM.md', `plugins/${pack}/templates/docs/DESIGN_SYSTEM.md`]);
  }
  if (c.packs.includes('nestjs')) docs.push(['docs/DATA_MODEL.md', 'plugins/nestjs/templates/docs/DATA_MODEL.md']);
  return docs;
}

export const apiMissing = (c) => !c.api.none && (!c.api.baseUrl || !c.api.docsUrl);

function apiLine(c) {
  if (c.api.none) return 'none — the project calls no backend API.';
  if (apiMissing(c)) return '**not set** — before wiring any endpoint, ask the owner for the API base and docs URLs, then record them with `/autopilot:install` (reconfigure).';
  return `base \`${c.api.baseUrl}\` · docs ${c.api.docsUrl} — verify every endpoint, param and enum spelling in the docs before wiring; the docs win over existing code.`;
}

function tiersLine(c) {
  if (!c.testTiers.length) return 'none';
  const active = activeTiers(c);
  const paused = pausedTiers(c);
  const line = active.length ? active.join(', ') : 'none active';
  return paused.length
    ? `${line} (paused: ${paused.join(', ')} — no new specs there, criteria go to a hand-off; existing specs still run)`
    : line;
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
    ['core', 'tooling/server/listening.mjs', 'server/listening.mjs'],
    ['core', 'tooling/browser/mcp.mjs', 'browser/mcp.mjs'],
    ['core', 'tooling/browser/sign-in.mjs', 'browser/sign-in.mjs'],
  ];
  if (c.cloud) tooling.push(['core', 'tooling/cloud/setup.sh', 'cloud/setup.sh'], ['core', 'tooling/cloud/session-start.mjs', 'cloud/session-start.mjs']);
  if (c.packs.includes('angular')) {
    for (const f of walk(path.join(autopilotRoot, 'plugins/angular/tooling/eslint'))) tooling.push(['angular', `tooling/eslint/${f}`, `eslint/${f}`]);
    for (const f of walk(path.join(autopilotRoot, 'plugins/angular/tooling/stylelint'))) tooling.push(['angular', `tooling/stylelint/${f}`, `stylelint/${f}`]);
    tooling.push(['angular', 'tooling/i18n/hardcoded-ratchet.mjs', 'i18n/hardcoded-ratchet.mjs']);
    if (c.i18n?.sets?.length) for (const f of ['lib.mjs', 'i18n-validate.mjs', 'i18n-unused.mjs']) tooling.push(['angular', `tooling/i18n/${f}`, `i18n/${f}`]);
  }
  if (c.packs.includes('spartan')) for (const f of walk(path.join(autopilotRoot, 'plugins/spartan/tooling'))) tooling.push(['spartan', `tooling/${f}`, `spartan/${f}`]);
  if (c.packs.includes('openspec')) tooling.push(['openspec', 'tooling/tasks-gate.mjs', 'openspec/tasks-gate.mjs']);
  if (c.packs.includes('nestjs') && c.nestjs?.openapi) tooling.push(['nestjs', 'tooling/openapi.mjs', 'nestjs/openapi.mjs']);
  for (const [pack, src, dest] of tooling) add(`tools/autopilot/${dest}`, fill(read(`plugins/${pack}/${src}`), BROWSER_VERSIONS), 'generated');

  // Generated index and git hooks.
  add('CLAUDE.md', fill(read('plugins/core/templates/claude/CLAUDE.md'), {
    __PLANNING__: c.planning,
    __PACKS__: c.packs.join(', '),
    __TEST_TIERS__: tiersLine(c),
    __TEST_PHASE__: c.testing.phase,
    __PARALLEL__: String(c.limits.parallelTestAgents),
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
  const designFlags = { legacyCss: c.design.legacyCss, darkMode: c.design.darkMode, brands: c.design.brands.length > 0 };
  for (const [doc, template] of projectDocs(c)) add(doc, fill(fillBlocks(read(template), designFlags), designValues(c)), 'once');
  const ui = c.packs.includes('spartan') ? 'spartan' : c.packs.includes('primeng') ? 'primeng' : null;
  if (ui && c.design.starter) {
    const render = (src) => fill(fillBlocks(read(src), designFlags), designValues(c));
    const starter = (src, dest) => add(dest, render(`plugins/${ui}/templates/starter/${src}`), 'once');
    if (ui === 'primeng') {
      starter('app-preset.ts', 'src/app/core/theme/app-preset.ts');
      starter('primeng.providers.ts', 'src/app/core/theme/primeng.providers.ts');
    } else {
      for (const t of ['colors', 'app', 'typography', 'spacing', 'radius', 'motion', 'index']) starter(`tokens/${t}.css`, `src/styles/tokens/${t}.css`);
      for (const b of c.design.brands) add(`src/styles/brands/${b}.css`, render('plugins/spartan/templates/starter/brand.css').replaceAll('__BRAND__', b), 'once');
      if (c.design.brands.length) starter('brand.ts', 'src/app/core/theme/brand.ts');
    }
    if (c.design.darkMode) add('src/app/core/theme/theme.service.ts', render('plugins/core/templates/starter/theme.service.ts'), 'once');
    starter('tailwind.css', 'src/styles/tailwind.css');
    starter('postcssrc.json', '.postcssrc.json');
  }
  add('.claude/gates.md', read('plugins/core/templates/claude/gates.md'), 'once');
  add('.claude/plans/backlog.md', read('plugins/core/templates/plans/backlog.md'), 'once');
  add('.claude/reviews/.gitkeep', '', 'once');
  for (const tier of c.testTiers) {
    add(`.claude/${tier}-testing/overrides.md`, read(`plugins/testing/templates/${tier}-testing/overrides.md`), 'once');
    add(`.claude/${tier}-testing/backlog.md`, read(`plugins/testing/templates/${tier}-testing/backlog.md`), 'once');
  }
  if (c.packs.includes('angular')) {
    for (const glob of c.lint.strictScope.filter((g) => /(^|\/)shared\/modern\/\*\*$/.test(g))) {
      const dir = glob.replace(/\/\*\*$/, '');
      const up = '../'.repeat(dir.split('/').length);
      add(`${dir}/README.md`, fill(read('plugins/angular/templates/shared-modern/README.md'), { __ROOT__: up }), 'once');
    }
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
      'export default autopilotStylelint({ tailwind: Boolean(autopilot.design?.starter), ...autopilot.stylelint, strictScope: autopilot.lint?.strictScope ?? ["src/**"], vendorGlobs: autopilot.lint?.vendorGlobs ?? [] });',
      '',
    ].join('\n'), 'once');
  }

  // Settings: autopilot permissions, the packs enabled for this project, the agents' browser
  // approved, and with cloud: true the hook that prepares a cloud session.
  const settings = JSON.parse(read('plugins/core/templates/claude/settings.json'));
  settings.enabledPlugins = Object.fromEntries(c.packs.map((p) => [pluginId(p), true]));
  const pmPrefix = c.packageManager === 'pnpm' ? 'Bash(npm' : 'Bash(pnpm';
  for (const list of ['allow', 'ask']) settings.permissions[list] = settings.permissions[list].filter((e) => !e.startsWith(pmPrefix));
  settings.hooks = c.cloud ? { SessionStart: [CLOUD_HOOK] } : {};
  settings.enabledMcpjsonServers = ['playwright'];
  add('.claude/settings.json', settings, 'merge');
  add('.mcp.json', { mcpServers: { playwright: { command: 'node', args: ['tools/autopilot/browser/mcp.mjs'] } } }, 'merge');

  return { config: c, files };
}

export function requiredDevDependencies(rawConfig) {
  const c = normaliseConfig(rawConfig);
  const deps = ['husky', 'lint-staged', '@commitlint/cli', '@commitlint/config-conventional', 'prettier'];
  if (c.packs.includes('angular')) {
    deps.push('eslint', 'angular-eslint', 'typescript-eslint', 'eslint-plugin-import-x', 'eslint-plugin-security',
      'eslint-plugin-unicorn', 'eslint-config-prettier', 'stylelint', c.stylelint.scss ? 'stylelint-config-standard-scss' : 'stylelint-config-standard');
  }
  if (designStarter(c) && c.packs.includes('spartan')) deps.push('@spartan-ng/cli', 'tailwindcss', '@tailwindcss/postcss', 'tw-animate-css');
  else if (designStarter(c)) deps.push('tailwindcss', '@tailwindcss/postcss', 'tailwindcss-primeui');
  return deps;
}

const designStarter = (c) => (c.packs.includes('primeng') || c.packs.includes('spartan')) && c.design.starter;

// Runtime packages the presets need (dependencies, not devDependencies).
export function requiredDependencies(rawConfig) {
  const c = normaliseConfig(rawConfig);
  if (!designStarter(c)) return [];
  return c.packs.includes('spartan')
    ? ['@spartan-ng/brain', '@angular/cdk', '@ng-icons/core', '@ng-icons/lucide', 'class-variance-authority', 'clsx', 'tailwind-merge']
    : ['@primeuix/themes', '@fontsource-variable/inter', 'primeicons'];
}
