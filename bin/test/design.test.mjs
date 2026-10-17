import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { fillBlocks, normaliseConfig, renderFiles } from '../lib/render.mjs';
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
