import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { doctor } from '../doctor.mjs';
import { sync } from '../sync.mjs';

let root;
const write = (rel, text) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
};

before(() => {
  root = mkdtempSync(path.join(tmpdir(), 'autopilot-doctor-'));
  spawnSync('git', ['init', '-q'], { cwd: root });
  write('package.json', JSON.stringify({ name: 'app' }));
  write('.claude/autopilot.json', JSON.stringify({ packs: ['angular', 'testing'], testTiers: ['unit'] }));
});
after(() => rmSync(root, { recursive: true, force: true }));

test('not installed', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'autopilot-bare-'));
  assert.match(doctor(bare).errors[0], /autopilot\.json missing/);
  rmSync(bare, { recursive: true, force: true });
});

test('before the first sync: fingerprints missing and the autopilot repo is ahead', () => {
  const { errors } = doctor(root);
  assert.ok(errors.some((e) => /autopilot\.lock\.json missing/.test(e)));
  assert.ok(errors.some((e) => /run sync/.test(e)));
});

test('after sync: no errors; warnings name what the owner still has to do', () => {
  sync(root);
  write('.claude/agents/old-reviewer.md', 'legacy');
  write('.claude/rules/old-rules.md', 'legacy');
  const { errors, warnings } = doctor(root);
  assert.deepEqual(errors, []);
  const text = warnings.join('\n');
  assert.match(text, /\.claude\/rules\/project\.md: \d+ unfilled/);
  assert.match(text, /devDependencies missing: .*husky/);
  assert.match(text, /legacy AI file\/folder still present: \.claude\/agents/);
  assert.match(text, /unexpected rule file \.claude\/rules\/old-rules\.md/);
  assert.match(text, /git hooks not active/);
  assert.doesNotMatch(text, /not enabled/);
});

test('a hand-edited generated file is an error', () => {
  write('CLAUDE.md', '# edited');
  assert.ok(doctor(root).errors.some((e) => /CLAUDE\.md: content differs/.test(e)));
  sync(root);
  assert.deepEqual(doctor(root).errors, []);
});

test('a config change not yet synced is an error', () => {
  write('.claude/autopilot.json', JSON.stringify({ packs: ['angular', 'testing', 'primeng'], testTiers: ['unit'] }));
  assert.ok(doctor(root).errors.some((e) => /run sync/.test(e)));
});
