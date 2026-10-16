import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { checkPreCommit, checkCommitMsg } from '../tasks-gate.mjs';

let root;
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const write = (rel, text) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
};

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'golden-tasks-'));
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  write('README.md', 'x\n');
  write('openspec/changes/add-export/tasks.md', '## 1. Service\n- [ ] 1.1 endpoint\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
});
after(() => root && rmSync(root, { recursive: true, force: true }));

test('docs-only commits are never gated', () => {
  write('README.md', 'y\n');
  git('add', '.');
  assert.equal(checkPreCommit(root, {}), null);
  assert.equal(checkCommitMsg(root, 'docs: x', {}), null);
});

test('source commit without a tick is blocked; with the tick it passes', () => {
  write('src/app/export.ts', 'export const x = 1;\n');
  git('add', '.');
  assert.match(checkPreCommit(root, {}), /ticks no task/);
  write('openspec/changes/add-export/tasks.md', '## 1. Service\n- [x] 1.1 endpoint\n');
  git('add', '.');
  assert.equal(checkPreCommit(root, {}), null);
});

test('commit message needs the Change line', () => {
  write('src/app/export.ts', 'export const x = 1;\n');
  git('add', '.');
  assert.match(checkCommitMsg(root, 'feat(export): add endpoint', {}), /Change: add-export/);
  assert.equal(checkCommitMsg(root, 'feat(export): add endpoint\n\nChange: add-export\n', {}), null);
});

test('no active change: blocked unless the owner bypass is set, and the trailer must match', () => {
  rmSync(path.join(root, 'openspec'), { recursive: true, force: true });
  write('src/app/fix.ts', 'export const y = 1;\n');
  git('add', '-A');
  assert.match(checkPreCommit(root, {}), /no OpenSpec change is active/);
  const env = { SKIP_TASKS_GATE: 'typo fix' };
  assert.equal(checkPreCommit(root, env), null);
  assert.match(checkCommitMsg(root, 'fix: typo', env), /no `Skip-Tasks-Gate/);
  assert.match(checkCommitMsg(root, 'fix: typo\n\nSkip-Tasks-Gate: other\n', env), /must equal/);
  assert.equal(checkCommitMsg(root, 'fix: typo\n\nSkip-Tasks-Gate: typo fix\n', env), null);
});

test('several active changes block', () => {
  write('openspec/changes/second/tasks.md', '- [ ] a\n');
  write('src/app/a.ts', 'export const a = 1;\n');
  git('add', '.');
  assert.match(checkPreCommit(root, {}), /several active changes/);
});
