import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkFile, hardcodedHits } from '../i18n/hardcoded-ratchet.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'i18n', 'hardcoded-ratchet.mjs');
const LEGACY = 'src/app/legacy/orders.component.html';
const BASE = '<h1>Orders</h1>\n<p>{{ \'orders.total\' | translate }}</p>\n<button title="Refresh">{{ \'common.refresh\' | translate }}</button>\n';

let root;
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const stage = (rel, text) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
  git('add', rel);
};
const run = (...files) => spawnSync(process.execPath, [script, ...files], { cwd: root, encoding: 'utf8' });

before(() => {
  root = mkdtempSync(path.join(tmpdir(), 'autopilot-ratchet-'));
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  stage(LEGACY, BASE);
  git('commit', '-q', '-m', 'legacy');
});
after(() => rmSync(root, { recursive: true, force: true }));

test('hits: static text and user-visible attributes count; translated text does not', () => {
  assert.deepEqual(hardcodedHits(BASE).map((h) => h.text), ['Orders', 'title="Refresh"']);
});

test('unchanged count passes, even when the legacy file is edited', () => {
  stage(LEGACY, BASE.replace('<h1>', '<h1 class="title">'));
  assert.equal(checkFile(root, LEGACY), null);
  assert.equal(run(LEGACY).status, 0);
});

test('one more untranslated string fails and names it', () => {
  stage(LEGACY, `${BASE}<p>Shipped today</p>\n`);
  const r = run(LEGACY);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /orders\.component\.html: untranslated text grew from 2 to 3 hit\(s\)/);
  assert.match(r.stderr, /line 4: Shipped today/);
});

test('moving existing text around is not growth', () => {
  stage(LEGACY, `<button title="Refresh">{{ 'common.refresh' | translate }}</button>\n<h1>Orders</h1>\n`);
  assert.equal(checkFile(root, LEGACY), null);
});

test('removing text passes', () => {
  stage(LEGACY, `<h1>{{ 'orders.title' | translate }}</h1>\n`);
  assert.equal(run(LEGACY).status, 0);
});

test('a new legacy file with text fails (HEAD counts 0)', () => {
  const rel = 'src/app/legacy/new.component.html';
  stage(rel, '<span>New label</span>\n');
  const r = run(path.join(root, rel));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /new\.component\.html: untranslated text grew from 0 to 1/);
});

test('the translate pipes come from autopilot.json', () => {
  stage('.claude/autopilot.json', JSON.stringify({ lint: { translatePipes: ['transloco'] } }));
  const rel = 'src/app/legacy/pipe.component.html';
  stage(rel, `<p>{{ 'a.b' | transloco }}</p>\n`);
  assert.equal(run(rel).status, 0);
});
