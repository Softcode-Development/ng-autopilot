import { test } from 'node:test';
import assert from 'node:assert/strict';

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { extractTokens } from '../../plugins/spartan/tooling/spartan-css.mjs';
import { doctor } from '../doctor.mjs';
import { normaliseConfig, renderFiles } from '../lib/render.mjs';
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
