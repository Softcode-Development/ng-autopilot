import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyse, classSelectors, elementRules, globalStylesheets } from '../css-collisions.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'css-collisions.mjs');
let legacy;
let modern;
const put = (root, rel, text) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
};
const angularJson = (styles) => JSON.stringify({ projects: { app: { architect: { build: { options: { styles } } } } } });

before(() => {
  legacy = mkdtempSync(path.join(tmpdir(), 'collisions-legacy-'));
  put(legacy, 'angular.json', angularJson(['node_modules/legacy-kit/dist/kit.css', { input: 'src/styles.scss' }]));
  put(legacy, 'node_modules/legacy-kit/dist/kit.css', '/* .ignored */ .p-4{padding:1.5rem!important}.btn{color:red}.bg-primary{background:#07f!important}.d-flex{display:flex}body{margin:0}a:hover{color:red}');
  put(legacy, 'src/styles.scss', "@import './partials/base';\n.app-shell { display: block; }\n");
  put(legacy, 'src/partials/_base.scss', '.container { width: 90%; }\nh1, h2 { margin: 0; }\n');
  modern = mkdtempSync(path.join(tmpdir(), 'collisions-modern-'));
  put(modern, 'angular.json', angularJson(['src/styles.css']));
  put(modern, 'src/styles.css', '/* empty */\n');
});
after(() => [legacy, modern].forEach((d) => rmSync(d, { recursive: true, force: true })));

test('class selectors and element rules, comments ignored', () => {
  const css = '/* .nope */ .a, .b:hover > .c-d { } h1 { } .x .y { } a:hover { } @media (min-width: 1px) { .e { } }';
  assert.deepEqual([...classSelectors(css)].sort(), ['a', 'b', 'c-d', 'e', 'x', 'y']);
  assert.equal(elementRules(css), 2);
});

test('global stylesheets: angular.json styles (string and object form) and their @imports, with the library each comes from', () => {
  const sheets = globalStylesheets(legacy);
  assert.deepEqual(sheets.map((s) => [s.file, s.library]), [
    ['node_modules/legacy-kit/dist/kit.css', 'legacy-kit'],
    ['src/styles.scss', 'app'],
    ['src/partials/_base.scss', 'app'],
  ]);
});

test('analyse: Tailwind utilities that share a name with a legacy class, element rules, and the verdict', async () => {
  const report = await analyse(legacy);
  assert.deepEqual(report.collisions, ['bg-primary', 'container', 'p-4']);
  assert.ok(!report.collisions.includes('btn') && !report.collisions.includes('d-flex'));
  assert.equal(report.elementRules, 3);
  assert.equal(report.legacyCss, true);
  const clean = await analyse(modern);
  assert.deepEqual(clean.collisions, []);
  assert.equal(clean.legacyCss, false);
});

test('CLI prints the sources, the collisions and the recommendation', () => {
  const r = spawnSync(process.execPath, [script, legacy], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /legacy-kit +node_modules\/legacy-kit\/dist\/kit\.css/);
  assert.match(r.stdout, /3 class names collide with Tailwind utilities: bg-primary, container, p-4/);
  assert.match(r.stdout, /recommend design\.legacyCss: true/);
});

test('SCSS entries are compiled when sass is available: loop-generated utilities are seen', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'collisions-scss-'));
  try {
    put(root, 'angular.json', angularJson(['src/styles.scss']));
    put(root, 'src/styles.scss', "@use 'kit';\n");
    put(root, 'src/_kit.scss', '@for $i from 1 through 4 { .p-#{$i} { padding: $i * 4px !important; } }\n');
    const report = await analyse(root);
    assert.deepEqual(report.collisions, ['p-1', 'p-2', 'p-3', 'p-4']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the autopilot Tailwind entry (src/styles/tailwind.css) is new code, not legacy evidence', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'collisions-own-'));
  try {
    put(root, 'angular.json', angularJson(['src/styles/tailwind.css', 'src/styles.css']));
    put(root, 'src/styles/tailwind.css', "@import './tokens/index.css';\nbody { margin: 0; }\n.flex { display: flex; }\n");
    put(root, 'src/styles/tokens/index.css', ':root { --x: 1; }\nh1 { margin: 0; }\n');
    put(root, 'src/styles.css', '/* empty */\n');
    const report = await analyse(root);
    assert.deepEqual(report.sources.map((s) => s.file), ['src/styles.css']);
    assert.equal(report.legacyCss, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('without a Tailwind engine the check still answers from element rules and says what it could not check', async () => {
  const report = await analyse(legacy, { loadCompile: async () => null });
  assert.equal(report.collisions, null);
  assert.equal(report.legacyCss, true);
  assert.match(report.note, /Tailwind is not installed/);
});

test('degrades instead of crashing: no angular.json, unreadable angular.json, Tailwind v3 in the project', async () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'collisions-bare-'));
  const broken = mkdtempSync(path.join(tmpdir(), 'collisions-broken-'));
  const v3 = mkdtempSync(path.join(tmpdir(), 'collisions-v3-'));
  try {
    const none = await analyse(bare);
    assert.deepEqual(none.sources, []);
    assert.match(none.note, /angular\.json/);
    put(broken, 'angular.json', '{ // comment\n "projects": {');
    assert.match((await analyse(broken)).note, /angular\.json/);
    put(v3, 'angular.json', angularJson(['src/styles.css']));
    put(v3, 'src/styles.css', '.p-4 { padding: 1rem; }\n');
    put(v3, 'node_modules/tailwindcss/package.json', JSON.stringify({ name: 'tailwindcss', version: '3.4.17' }));
    const old = await analyse(v3);
    assert.deepEqual(old.collisions, ['p-4'], 'checked with this repo\'s Tailwind v4');
  } finally {
    [bare, broken, v3].forEach((d) => rmSync(d, { recursive: true, force: true }));
  }
});

test('CLI makes no recommendation when angular.json could not be read', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'collisions-cli-bare-'));
  try {
    const r = spawnSync(process.execPath, [script, bare], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /decide design\.legacyCss with the owner/);
    assert.doesNotMatch(r.stdout, /recommend design\.legacyCss/);
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});
