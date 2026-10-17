import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { fillBlocks, normaliseConfig, renderFiles, requiredDependencies, requiredDevDependencies } from '../lib/render.mjs';
import { doctor } from '../doctor.mjs';
import { AUTOPILOT_ROOT, sync } from '../sync.mjs';

const STARTER = ['src/app/core/theme/app-preset.ts', 'src/app/core/theme/primeng.providers.ts', 'src/app/core/theme/theme.service.ts',
  'src/styles/tailwind.css', '.postcssrc.json'];
const render = (config) => {
  const { files } = renderFiles(AUTOPILOT_ROOT, config);
  return Object.fromEntries(files.map((f) => [f.path, f]));
};

test('fillBlocks keeps {{#flag}} when true and {{^flag}} when false', () => {
  const t = 'a{{#x}}B{{/x}}{{^x}}C{{/x}}';
  assert.equal(fillBlocks(t, { x: true }), 'aB');
  assert.equal(fillBlocks(t, { x: false }), 'aC');
});

test('fillBlocks works on CRLF templates and on several flags', () => {
  const t = 'a\r\n{{#x}}\r\nB\r\n{{/x}}\r\n{{^y}}C\r\n{{/y}}d';
  assert.equal(fillBlocks(t, { x: true, y: false }), 'a\r\nB\r\nC\r\nd', 'marker lines vanish');
  assert.equal(fillBlocks(t, { x: false, y: true }), 'a\r\nd');
});

test('design defaults; stylelint.tailwind follows the starter unless set', () => {
  assert.deepEqual(normaliseConfig({}).design, { starter: false, legacyCss: false, darkMode: true });
  assert.equal(normaliseConfig({ packs: ['primeng'], design: { starter: true } }).stylelint.tailwind, true);
  assert.equal(normaliseConfig({ packs: ['primeng'], design: { starter: true }, stylelint: { tailwind: false } }).stylelint.tailwind, false);
});

test('no starter files without design.starter, or without the primeng pack', () => {
  const plain = render({ packs: ['angular', 'primeng'] });
  const noPrime = render({ packs: ['angular'], design: { starter: true } });
  for (const f of STARTER) {
    assert.equal(plain[f], undefined, f);
    assert.equal(noPrime[f], undefined, f);
  }
});

test('modern setup: full Tailwind, PrimeNG in a layer before utilities, class dark mode, blue primary', () => {
  const files = render({ packs: ['angular', 'primeng'], design: { starter: true } });
  for (const f of STARTER) assert.equal(files[f]?.kind, 'once', f);
  const css = files['src/styles/tailwind.css'].content;
  assert.match(css, /@import "tailwindcss";/);
  assert.match(css, /@import "tailwindcss-primeui";/);
  assert.match(css, /@import "@fontsource-variable\/inter";/);
  assert.match(css, /@custom-variant dark \(&:where\(\.app-dark, \.app-dark \*\)\);/);
  assert.match(css, /--font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;/);
  assert.doesNotMatch(css, /prefix\(tw\)|\{\{|__/);
  const providers = files['src/app/core/theme/primeng.providers.ts'].content;
  assert.match(providers, /darkModeSelector: '\.app-dark'/);
  assert.match(providers, /cssLayer: \{ name: 'primeng', order: 'theme, base, primeng' \}/);
  assert.match(files['src/app/core/theme/app-preset.ts'].content, /'\{blue\.500\}'/);
  assert.match(files['src/app/core/theme/app-preset.ts'].content, /definePreset\(Aura,/);
  assert.match(files['src/app/core/theme/theme.service.ts'].content, /export class ThemeService/);
  assert.ok(JSON.parse(files['.postcssrc.json'].content).plugins['@tailwindcss/postcss']);
});

test('legacy setup without dark mode: prefixed, no preflight, scans the strict scope only, PrimeNG unlayered', () => {
  const files = render({
    packs: ['angular', 'primeng'],
    design: { starter: true, legacyCss: true, darkMode: false },
    lint: { strictScope: ['src/app/features/**', 'src/app/shared/modern', 'src/app/x/*.ts'] },
  });
  const css = files['src/styles/tailwind.css'].content;
  assert.match(css, /prefix\(tw\)/);
  assert.match(css, /source\(none\)/);
  assert.match(css, /@source "\.\.\/app\/features";/);
  assert.match(css, /@source "\.\.\/app\/shared\/modern";/);
  assert.match(css, /@source "\.\.\/app\/x";/);
  assert.match(css, /@source "\.\.\/index\.html";/, 'the <body> classes live in index.html');
  assert.match(css, /@import "tailwindcss\/utilities\.css" prefix\(tw\) source\(none\);/, 'utilities unlayered, or legacy element CSS beats them');
  assert.doesNotMatch(css, /@import "tailwindcss";|preflight|@custom-variant|\{\{|__/);
  const providers = files['src/app/core/theme/primeng.providers.ts'].content;
  assert.match(providers, /darkModeSelector: false/);
  assert.match(providers, /cssLayer: false/);
  assert.equal(files['src/app/core/theme/theme.service.ts'], undefined);
});

let root;
before(() => {
  root = mkdtempSync(path.join(tmpdir(), 'autopilot-design-'));
  spawnSync('git', ['init', '-q'], { cwd: root });
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'app' }));
  mkdirSync(path.join(root, '.claude'));
  writeFileSync(path.join(root, '.claude', 'autopilot.json'), JSON.stringify({ packs: ['angular', 'primeng'], design: { starter: true } }));
});
after(() => rmSync(root, { recursive: true, force: true }));

test('sync keeps a tailwind.css the project already has', () => {
  mkdirSync(path.join(root, 'src', 'styles'), { recursive: true });
  writeFileSync(path.join(root, 'src', 'styles', 'tailwind.css'), '@import "tailwindcss"; /* ours */\n');
  const report = sync(root);
  assert.equal(readFileSync(path.join(root, 'src', 'styles', 'tailwind.css'), 'utf8'), '@import "tailwindcss"; /* ours */\n');
  assert.ok(report.kept.includes('src/styles/tailwind.css'));
  assert.ok(report.created.includes('src/app/core/theme/app-preset.ts'));
});

const SPLIT = ['### 4.1 Colour', '### 4.2 Typography', '### 4.3 Spacing', '### 4.4 Radius', '### 4.5 Motion', '### 4.6 Usage rule'];

test('primeng pack: DESIGN_SYSTEM.md comes pre-filled from the primeng template', () => {
  const doc = render({ packs: ['angular', 'primeng'], design: { starter: true } })['docs/DESIGN_SYSTEM.md'].content;
  for (const h of SPLIT) assert.ok(doc.includes(h), h);
  for (const s of ['Inter Variable', '{blue.500}', 'app.income.color', 'https://v{major}.primeng.org', 'class="flex', 'src/app/core/theme/app-preset.ts']) {
    assert.ok(doc.includes(s), s);
  }
  assert.doesNotMatch(doc, /v21\.primeng\.org|__TW__|\{\{[#^/]/);
});

test('primeng pack, legacy setup: class examples carry the tw: prefix; single theme says so', () => {
  const doc = render({ packs: ['angular', 'primeng'], design: { starter: true, legacyCss: true, darkMode: false } })['docs/DESIGN_SYSTEM.md'].content;
  assert.match(doc, /class="tw:flex/);
  assert.doesNotMatch(doc, /class="flex/);
  assert.match(doc, /darkModeSelector: false/);
  assert.doesNotMatch(doc, /tw:dark:|ThemeService/, 'a single-theme app shows no dark variants');
});

test('angular pack alone: the neutral template, with the same § 4 split as fill-ins', () => {
  const doc = render({ packs: ['angular'] })['docs/DESIGN_SYSTEM.md'].content;
  for (const h of SPLIT) assert.ok(doc.includes(h), h);
  assert.match(doc, /<Font families[^>]*>/);
  assert.doesNotMatch(doc, /Inter Variable/);
});

test('sync ships the stylelint rule with the preset; stylelint.config turns tailwind on with the starter', () => {
  const files = render({ packs: ['angular', 'primeng'], design: { starter: true } });
  assert.equal(files['tools/autopilot/stylelint/rules/justified-stylesheet.mjs']?.kind, 'generated');
  assert.equal(files['tools/autopilot/stylelint/preset.mjs']?.kind, 'generated');
  assert.match(files['stylelint.config.mjs'].content, /tailwind: Boolean\(autopilot\.design\?\.starter\)/);
  assert.match(files['stylelint.config.mjs'].content, /strictScope: autopilot\.lint\?\.strictScope \?\? \["src\/\*\*"\]/, 'no lint block in autopilot.json must not crash');
});

test('the starter needs its packages: theme, font and icons at runtime, Tailwind for the build', () => {
  const config = { packs: ['angular', 'primeng'], design: { starter: true } };
  assert.deepEqual(requiredDependencies(config), ['@primeuix/themes', '@fontsource-variable/inter', 'primeicons']);
  for (const d of ['tailwindcss', '@tailwindcss/postcss', 'tailwindcss-primeui']) assert.ok(requiredDevDependencies(config).includes(d), d);
  assert.deepEqual(requiredDependencies({ packs: ['angular', 'primeng'] }), []);
  assert.ok(!requiredDevDependencies({ packs: ['angular', 'primeng'] }).includes('tailwindcss'));
  const report = sync(root);
  assert.ok(report.missingDependencies.includes('@primeuix/themes'));
  assert.ok(report.missingDevDependencies.includes('tailwindcss-primeui'));
});

test('doctor names missing runtime dependencies apart from devDependencies', () => {
  const text = doctor(root).warnings.join('\n');
  assert.match(text, /^dependencies missing: @primeuix\/themes, @fontsource-variable\/inter, primeicons$/m);
  assert.match(text, /^devDependencies missing: .*tailwindcss-primeui/m);
});

test('doctor: a fresh primeng design system reports only its real fill-ins, not its example markup', () => {
  const fresh = mkdtempSync(path.join(tmpdir(), 'autopilot-fresh-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: fresh });
    writeFileSync(path.join(fresh, 'package.json'), JSON.stringify({ name: 'app' }));
    mkdirSync(path.join(fresh, '.claude'));
    writeFileSync(path.join(fresh, '.claude', 'autopilot.json'), JSON.stringify({ packs: ['angular', 'primeng'], design: { starter: true } }));
    sync(fresh);
    const line = doctor(fresh).warnings.find((w) => w.startsWith('docs/DESIGN_SYSTEM.md:') && w.includes('unfilled'));
    assert.match(line, /: 5 unfilled/);
    for (const markup of ['<html>', '<section', '<div', '<p-toast', '<label for>', '<p-message', '<form ', '<i class']) assert.ok(!line.includes(markup), markup);
  } finally {
    rmSync(fresh, { recursive: true, force: true });
  }
});

test('legacy design system says where tw: classes work; the modern one does not mention scanning', () => {
  const legacy = render({ packs: ['angular', 'primeng'], design: { starter: true, legacyCss: true } })['docs/DESIGN_SYSTEM.md'].content;
  const modern = render({ packs: ['angular', 'primeng'], design: { starter: true } })['docs/DESIGN_SYSTEM.md'].content;
  assert.match(legacy, /every class takes the `tw:` prefix/);
  assert.match(legacy, /only files inside `lint\.strictScope` and `src\/index\.html` are scanned/);
  assert.doesNotMatch(modern, /are scanned/);
});

test('fillBlocks resolves a block nested inside another flag\'s block', () => {
  const t = '{{#a}}x{{#b}}y{{/b}}{{^b}}n{{/b}}z{{/a}}';
  assert.equal(fillBlocks(t, { a: true, b: true }), 'xyz');
  assert.equal(fillBlocks(t, { a: true, b: false }), 'xnz');
  assert.equal(fillBlocks(t, { a: false, b: true }), '');
});

test('template command prints the rendered project file for this project, even when the project already has one', () => {
  const script = path.join(AUTOPILOT_ROOT, 'bin', 'template.mjs');
  const r = spawnSync(process.execPath, [script, root, 'docs/DESIGN_SYSTEM.md'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /### 4\.2 Typography/);
  assert.match(r.stdout, /class="flex/);
  const missing = spawnSync(process.execPath, [script, root, 'docs/NOPE.md'], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /not a project file sync creates/);
});

test('theme service survives jsdom and blocked storage (verified under Angular 21 Vitest in the build check)', () => {
  const svc = render({ packs: ['angular', 'primeng'], design: { starter: true } })['src/app/core/theme/theme.service.ts'].content;
  assert.match(svc, /matchMedia\?\.\(/);
  assert.equal((svc.match(/try \{/g) ?? []).length, 2, 'localStorage read and write are guarded');
});

test('doctor: Tailwind below v4 or a PostCSS config that shadows .postcssrc.json silently stops the classes', () => {
  const clean = doctor(root).warnings.join('\n');
  assert.doesNotMatch(clean, /Tailwind v4|shadows \.postcssrc\.json/);
  mkdirSync(path.join(root, 'node_modules', 'tailwindcss'), { recursive: true });
  writeFileSync(path.join(root, 'node_modules', 'tailwindcss', 'package.json'), JSON.stringify({ version: '3.4.17' }));
  writeFileSync(path.join(root, 'postcss.config.json'), JSON.stringify({ plugins: { tailwindcss: {} } }));
  try {
    const text = doctor(root).warnings.join('\n');
    assert.match(text, /tailwindcss 3\.4\.17 installed — the design-system starter needs Tailwind v4/);
    assert.match(text, /postcss\.config\.json shadows \.postcssrc\.json/);
  } finally {
    rmSync(path.join(root, 'node_modules'), { recursive: true, force: true });
    rmSync(path.join(root, 'postcss.config.json'));
  }
});
