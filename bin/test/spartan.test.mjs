import { test } from 'node:test';
import assert from 'node:assert/strict';

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { extractTokens } from '../../plugins/spartan/tooling/spartan-css.mjs';
import { doctor } from '../doctor.mjs';
import { normaliseConfig, renderFiles, requiredDependencies, requiredDevDependencies } from '../lib/render.mjs';
import { AUTOPILOT_ROOT, sync } from '../sync.mjs';

const render = (config) => Object.fromEntries(renderFiles(AUTOPILOT_ROOT, config).files.map((f) => [f.path, f]));
const SPARTAN = { packs: ['angular', 'spartan'], design: { starter: true } };
const TOKENS = ['colors', 'app', 'typography', 'spacing', 'radius', 'motion', 'index'].map((t) => `src/styles/tokens/${t}.css`);

test('modern spartan starter: spartan\'s documented Tailwind setup, the package preset, tokens, base layer', () => {
  const files = render(SPARTAN);
  const css = files['src/styles/tailwind.css'].content;
  assert.match(css, /@layer theme, base, components, utilities;/);
  assert.match(css, /@import 'tailwindcss\/preflight\.css' layer\(base\);/);
  assert.match(css, /@import '@spartan-ng\/brain\/hlm-tailwind-preset\.css';/);
  assert.match(css, /@import '\.\/tokens\/index\.css';/);
  assert.match(css, /@layer base \{/);
  assert.doesNotMatch(css, /prefix\(tw\)|tailwindcss-primeui|@fontsource|spartan-styles|\{\{|__/);
  for (const f of [...TOKENS, 'src/styles/tailwind.css', '.postcssrc.json', 'src/app/core/theme/theme.service.ts']) assert.equal(files[f]?.kind, 'once', f);
});

test('tokens carry the default look\'s values', () => {
  const files = render(SPARTAN);
  assert.match(files['src/styles/tokens/typography.css'].content, /ui-sans-serif, system-ui, -apple-system, blinkmacsystemfont, 'Segoe UI', roboto, 'Helvetica Neue', arial,\s+'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'/);
  const radius = files['src/styles/tokens/radius.css'].content;
  assert.match(radius, /--radius: 0\.5rem;/);
  for (const r of ['--radius-sm: calc(var(--radius) - 4px)', '--radius-md: calc(var(--radius) - 2px)', '--radius-lg: var(--radius)', '--radius-xl: calc(var(--radius) + 4px)', '--radius-2xl: calc(var(--radius) + 8px)']) assert.ok(radius.includes(r), r);
  const motion = files['src/styles/tokens/motion.css'].content;
  for (const m of ['150ms', '200ms', '300ms', 'cubic-bezier(0.4, 0, 1, 1)', 'cubic-bezier(0, 0, 0.2, 1)', 'cubic-bezier(0.4, 0, 0.2, 1)']) assert.ok(motion.includes(m), m);
  assert.match(files['src/styles/tokens/app.css'].content, /--app-/);
  assert.match(files['src/styles/tokens/colors.css'].content, /ui-theme --theme=zinc/);
  const index = files['src/styles/tokens/index.css'].content;
  assert.ok(index.indexOf("@import './colors.css'") < index.indexOf("@import './radius.css'"), 'colours first: radius reads --radius');
});

test('legacy spartan starter: prefixed, no reset, the prefixed preset copy, strict scope + index.html scanned, no base layer', () => {
  const css = render({ ...SPARTAN, design: { starter: true, legacyCss: true }, lint: { strictScope: ['src/app/features/**'] } })['src/styles/tailwind.css'].content;
  assert.match(css, /prefix\(tw\)/);
  assert.match(css, /@import '\.\/spartan-preset\.css';/);
  assert.match(css, /@source "\.\.\/app\/features";/);
  assert.match(css, /@source "\.\.\/index\.html";/);
  assert.doesNotMatch(css, /preflight|@layer base|hlm-tailwind-preset/);
});

test('brands: one override file per brand, imported, and provideBrand; none without brands', () => {
  const files = render({ ...SPARTAN, design: { starter: true, brands: ['a', 'b'] } });
  assert.match(files['src/styles/brands/a.css'].content, /\.brand-a \{/);
  assert.match(files['src/styles/brands/b.css'].content, /\.brand-b \{/);
  assert.match(files['src/app/core/theme/brand.ts'].content, /export function provideBrand\(brand: string \| null\): EnvironmentProviders/);
  const css = files['src/styles/tailwind.css'].content;
  assert.match(css, /@import '\.\/brands\/a\.css';\n@import '\.\/brands\/b\.css';/);
  const plain = render(SPARTAN);
  assert.equal(plain['src/app/core/theme/brand.ts'], undefined);
  assert.ok(!Object.keys(plain).some((p) => p.startsWith('src/styles/brands/')));
  assert.doesNotMatch(plain['src/styles/tailwind.css'].content, /brands/);
});

test('brand names are bare lowercase words', () => {
  assert.deepEqual(normaliseConfig({}).design.brands, []);
  assert.throws(() => normaliseConfig({ design: { brands: ['Brand A'] } }), /brand/);
});

test('the theme service is shared: class dark for spartan, app-dark for PrimeNG', () => {
  assert.match(render(SPARTAN)['src/app/core/theme/theme.service.ts'].content, /const DARK_CLASS = 'dark';/);
  assert.match(render({ packs: ['angular', 'primeng'], design: { starter: true } })['src/app/core/theme/theme.service.ts'].content, /const DARK_CLASS = 'app-dark';/);
});

test('spartan pack: no PrimeNG starter files; the spartan tools are synced', () => {
  const files = render(SPARTAN);
  assert.equal(files['src/app/core/theme/app-preset.ts'], undefined);
  assert.equal(files['src/app/core/theme/primeng.providers.ts'], undefined);
  assert.equal(files['tools/autopilot/spartan/prefix.mjs']?.kind, 'generated');
  assert.equal(files['tools/autopilot/spartan/spartan-css.mjs']?.kind, 'generated');
});

test('one UI library per project when the starter is on', () => {
  assert.throws(() => normaliseConfig({ packs: ['primeng', 'spartan'], design: { starter: true } }), /one UI library/);
  assert.doesNotThrow(() => normaliseConfig({ packs: ['primeng', 'spartan'] }));
});

test('token extraction leaves the font to typography.css', () => {
  const out = extractTokens(":root {\n  color-scheme: light;\n\n  --font-sans:\n    -apple-system, BlinkMacSystemFont, 'Segoe UI';\n\n  --radius: 0.625rem;\n}\n");
  assert.doesNotMatch(out, /--font-sans|BlinkMacSystemFont/);
  assert.match(out, /--radius: 0\.625rem;/);
});

test('spartan pack: DESIGN_SYSTEM.md comes pre-filled from the spartan template', () => {
  const doc = render(SPARTAN)['docs/DESIGN_SYSTEM.md'].content;
  for (const h of ['### 4.1 Colour', '### 4.2 Typography', '### 4.3 Spacing', '### 4.4 Radius', '### 4.5 Motion', '### 4.6 Usage rule']) assert.ok(doc.includes(h), h);
  for (const s of ['spartan.ng/components', '@spartan-ng/helm/button', 'HlmButtonImports', '--app-', 'gap-*', 'size-*', 'class="flex', 'hlmField', 'ui-theme --theme=zinc', '"style": "nova"']) assert.ok(doc.includes(s), s);
  assert.doesNotMatch(doc, /__TW__|\{\{|PrimeNG|primeng/);
});

test('spartan legacy design system: tw: classes and the scanning note; single theme drops dark', () => {
  const doc = render({ ...SPARTAN, design: { starter: true, legacyCss: true, darkMode: false } })['docs/DESIGN_SYSTEM.md'].content;
  assert.match(doc, /class="tw:flex/);
  assert.match(doc, /only files inside `lint\.strictScope` and `src\/index\.html` are scanned/);
  assert.match(doc, /prefix\.mjs/);
  assert.doesNotMatch(doc, /tw:dark:|ThemeService/);
});

test('spartan design system names brands only when there are brands', () => {
  assert.match(render({ ...SPARTAN, design: { starter: true, brands: ['a'] } })['docs/DESIGN_SYSTEM.md'].content, /src\/styles\/brands\//);
  assert.doesNotMatch(render(SPARTAN)['docs/DESIGN_SYSTEM.md'].content, /src\/styles\/brands\//);
});

test('doctor: a fresh spartan design system reports only its real fill-ins', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'autopilot-spartan-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir });
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'app' }));
    mkdirSync(path.join(dir, '.claude'));
    writeFileSync(path.join(dir, '.claude', 'autopilot.json'), JSON.stringify(SPARTAN));
    sync(dir);
    const line = doctor(dir).warnings.find((w) => w.startsWith('docs/DESIGN_SYSTEM.md:') && w.includes('unfilled'));
    assert.match(line, /: 5 unfilled/);
    for (const markup of ['<hlm-field', '<label', '<ng-icon', '<form ', '<div', '<button', '<p ']) assert.ok(!line.includes(markup), markup);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('spartan dependencies: runtime and build packages; none of PrimeNG\'s', () => {
  assert.deepEqual(requiredDependencies(SPARTAN), ['@spartan-ng/brain', '@angular/cdk', '@ng-icons/core', '@ng-icons/lucide', 'class-variance-authority', 'clsx', 'tailwind-merge']);
  const dev = requiredDevDependencies(SPARTAN);
  for (const d of ['@spartan-ng/cli', 'tailwindcss', '@tailwindcss/postcss', 'tw-animate-css']) assert.ok(dev.includes(d), d);
  assert.ok(!dev.includes('tailwindcss-primeui'));
});

test('generated stylelint.config passes the vendor globs', () => {
  assert.match(render(SPARTAN)['stylelint.config.mjs'].content, /vendorGlobs: autopilot\.lint\?\.vendorGlobs \?\? \[\]/);
});

const project = (config) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'autopilot-spartan-doctor-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'app' }));
  mkdirSync(path.join(dir, '.claude'));
  writeFileSync(path.join(dir, '.claude', 'autopilot.json'), JSON.stringify(config));
  sync(dir);
  return dir;
};
const put = (dir, rel, text) => {
  mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  writeFileSync(path.join(dir, rel), text);
};

test('doctor: the official spartan skill is expected and allowed; other project skills are still leftovers', () => {
  const dir = project(SPARTAN);
  try {
    assert.match(doctor(dir).warnings.join('\n'), /spartan skill missing — npx skills add spartan-ng\/spartan -a claude-code -y --copy/);
    put(dir, '.claude/skills/spartan/SKILL.md', '---\nname: spartan\n---\n');
    let text = doctor(dir).warnings.join('\n');
    assert.doesNotMatch(text, /spartan skill missing|legacy AI file\/folder still present: \.claude\/skills/);
    put(dir, '.claude/skills/old-helper/SKILL.md', 'old');
    text = doctor(dir).warnings.join('\n');
    assert.match(text, /legacy AI file\/folder still present: \.claude\/skills\/old-helper/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('doctor (legacy spartan): unprefixed generated classes, a missing or stale preset copy, a missing brand file', () => {
  const dir = project({ ...SPARTAN, design: { starter: true, legacyCss: true, brands: ['a'] }, lint: { strictScope: ['src/app/features/**', 'src/app/shared/modern/**'], vendorGlobs: ['src/app/shared/modern/ui/**'] } });
  try {
    put(dir, 'src/app/shared/modern/ui/button/src/lib/hlm-button.ts', "export const v = cva('inline-flex rounded-md');\n");
    put(dir, 'node_modules/@spartan-ng/brain/package.json', JSON.stringify({ name: '@spartan-ng/brain', version: '1.9.0' }));
    rmSync(path.join(dir, 'src/styles/brands/a.css'));
    let text = doctor(dir).warnings.join('\n');
    assert.match(text, /unprefixed classes in spartan-generated code \(1 file\) — run node tools\/autopilot\/spartan\/prefix\.mjs src\/app\/shared\/modern\/ui/);
    assert.match(text, /src\/styles\/spartan-preset\.css missing — run node tools\/autopilot\/spartan\/spartan-css\.mjs preset src\/styles\/spartan-preset\.css/);
    assert.match(text, /brand "a": src\/styles\/brands\/a\.css missing/);
    put(dir, 'src/styles/spartan-preset.css', '/* @spartan-ng/brain 1.8.0 hlm-tailwind-preset.css, @apply prefixed with tw: by x */\n');
    put(dir, 'src/app/shared/modern/ui/button/src/lib/hlm-button.ts', "export const v = cva('tw:inline-flex tw:rounded-md');\n");
    text = doctor(dir).warnings.join('\n');
    assert.match(text, /spartan-preset\.css was copied from @spartan-ng\/brain 1\.8\.0; installed 1\.9\.0/);
    assert.doesNotMatch(text, /unprefixed classes/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('doctor: the Tailwind v4 / PostCSS check covers the spartan starter too', () => {
  const dir = project(SPARTAN);
  try {
    put(dir, 'node_modules/tailwindcss/package.json', JSON.stringify({ version: '3.4.17' }));
    put(dir, 'postcss.config.json', '{}');
    const text = doctor(dir).warnings.join('\n');
    assert.match(text, /tailwindcss 3\.4\.17 installed/);
    assert.match(text, /postcss\.config\.json shadows/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the starter stylesheets pass the stylelint preset; generated ones say so and are skipped', async () => {
  const { default: stylelint } = await import('stylelint');
  const { autopilotStylelint } = await import('../../plugins/angular/tooling/stylelint/preset.mjs');
  const files = render({ ...SPARTAN, design: { starter: true, brands: ['a'] } });
  const config = autopilotStylelint({ tailwind: true, strictScope: ['src/**'] });
  for (const rel of ['src/styles/tailwind.css', 'src/styles/brands/a.css', ...TOKENS]) {
    const { results } = await stylelint.lint({ code: files[rel].content, codeFilename: rel, config });
    assert.deepEqual(results[0].warnings.map((w) => `${w.rule}: ${w.text}`), [], rel);
  }
  const generated = extractTokens(':root {\n  --primary: oklch(0.21 0.006 285.885);\n}\n');
  assert.match(generated, /^\/\* stylelint-disable \*\//);
  const { results } = await stylelint.lint({ code: generated, codeFilename: 'src/styles/tokens/colors.css', config });
  assert.deepEqual(results[0].warnings, []);
});

test('the legacy starter tailwind.css passes the stylelint preset too', async () => {
  const { default: stylelint } = await import('stylelint');
  const { autopilotStylelint } = await import('../../plugins/angular/tooling/stylelint/preset.mjs');
  const css = render({ ...SPARTAN, design: { starter: true, legacyCss: true, brands: ['a'] }, lint: { strictScope: ['src/app/features/**'] } })['src/styles/tailwind.css'].content;
  const { results } = await stylelint.lint({ code: css, codeFilename: 'src/styles/tailwind.css', config: autopilotStylelint({ tailwind: true, strictScope: ['src/**'] }) });
  assert.deepEqual(results[0].warnings.map((w) => w.rule), []);
});

test('token values written like spartan writes them pass (oklch numbers, not percentages and degrees)', async () => {
  const { default: stylelint } = await import('stylelint');
  const { autopilotStylelint } = await import('../../plugins/angular/tooling/stylelint/preset.mjs');
  const code = '.brand-a {\n  --primary: oklch(0.55 0.22 27);\n}\n';
  const { results } = await stylelint.lint({ code, codeFilename: 'src/styles/brands/a.css', config: autopilotStylelint({ tailwind: true, strictScope: ['src/**'] }) });
  assert.deepEqual(results[0].warnings.map((w) => w.rule), []);
});

test('design.legacyLibraries defaults to an empty list and takes UI library names', () => {
  assert.deepEqual(normaliseConfig({}).design.legacyLibraries, []);
  assert.throws(() => normaliseConfig({ design: { legacyLibraries: ['bootstrap'] } }), /legacyLibraries/);
});

test('design.brands must be a list of names', () => {
  assert.throws(() => normaliseConfig({ design: { brands: 'ab' } }), /design\.brands must be a list/);
  assert.throws(() => normaliseConfig({ design: { brands: null } }), /design\.brands must be a list/);
});

test('the spartan catalog lists only components install generates', () => {
  const doc = render(SPARTAN)['docs/DESIGN_SYSTEM.md'].content;
  assert.doesNotMatch(doc, /native-select/);
});
