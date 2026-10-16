// Protection of generated files: the wider protected list, shell write
// coverage beyond redirects, and the golden-repo fence.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateBash } from '../guard-bash.mjs';
import { evaluatePath } from '../guard-paths.mjs';
import { goldenFence } from '../lib/hook-io.mjs';
import { segments, tokens, writeTargets } from '../lib/shell-writes.mjs';

const win = process.platform === 'win32';
const root = win ? 'C:/work/shop' : '/work/shop';
const fence = win ? 'C:/apps/claude-golden' : '/apps/claude-golden';
const bash = (cmd, opts = {}) => evaluateBash(cmd, { root, fence, ...opts }).blocked;
const edit = (p, opts = {}) => evaluatePath(p, { root, fence, ...opts }).blocked;

test('parser: segments respect quotes; tokens unquote', () => {
  assert.deepEqual(segments('a && b | c; d'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(segments(`echo "a; b" && c`), ['echo "a; b"', 'c']);
  assert.deepEqual(tokens(`sed -i 's/a b/c/' "x y.md"`), ['sed', '-i', 's/a b/c/', 'x y.md']);
});

test('parser: write targets per command', () => {
  assert.deepEqual(writeTargets("sed -i 's/a/b/' f1.md f2.md"), ['f1.md', 'f2.md']);
  assert.deepEqual(writeTargets("sed -i -e 's/a/b/' -e 's/c/d/' f.md"), ['f.md']);
  assert.deepEqual(writeTargets('cp a.txt b.txt dest/'), ['dest/']);
  assert.deepEqual(writeTargets('mv old.md new.md'), ['new.md', 'old.md']);
  assert.deepEqual(writeTargets('rm -f a b'), ['a', 'b']);
  assert.deepEqual(writeTargets('git checkout -- x.md y.md'), ['x.md', 'y.md']);
  assert.deepEqual(writeTargets('git restore --staged x.md'), []);
  assert.deepEqual(writeTargets("perl -pi -e 's/a/b/' f.md"), ['f.md']);
  assert.deepEqual(writeTargets(`node -e "require('fs').writeFileSync('CLAUDE.md', 'x')"`), ['CLAUDE.md']);
  assert.deepEqual(writeTargets(`node -e "console.log(require('./package.json').name)"`), []);
  assert.deepEqual(writeTargets('FOO=1 rm x'), ['x']);
  assert.deepEqual(writeTargets('cat a > out.md'), ['out.md']);
});

const PROTECTED = [
  '.claude/rules/golden/angular/state.md',
  'tools/golden/eslint/preset.mjs',
  'CLAUDE.md',
  '.husky/pre-commit',
  '.husky/commit-msg',
  '.husky/pre-push',
  '.claude/golden.json',
  '.claude/golden.lock.json',
];

test('Write/Edit: every generated file is protected; project-owned files are not', () => {
  for (const p of PROTECTED) assert.equal(edit(p), true, p);
  for (const p of ['.claude/rules/project.md', '.claude/gates.md', '.claude/unit-testing/overrides.md', '.claude/unit-testing/backlog.md',
    '.claude/plans/backlog.md', '.husky/pre-commit.local', 'eslint.config.mjs', '.claude/settings.json', 'src/app/a.ts']) {
    assert.equal(edit(p), false, p);
  }
});

test('shell: sed -i, cp, mv, rm, git checkout, node -e into generated files are blocked', () => {
  for (const cmd of [
    "sed -i 's/x/y/' CLAUDE.md",
    "sed -i 's/x/y/' .claude/rules/golden/core/work-modes.md",
    'cp /tmp/x.md .claude/rules/golden/angular/state.md',
    'mv tools/golden/eslint/preset.mjs tools/golden/eslint/old.mjs',
    'rm .husky/pre-commit',
    'git checkout -- .claude/golden.lock.json',
    `node -e "require('fs').writeFileSync('.claude/golden.json','{}')"`,
    "perl -pi -e 's/a/b/' .husky/commit-msg",
  ]) assert.equal(bash(cmd), true, cmd);
});

test('shell: ordinary work is allowed', () => {
  for (const cmd of [
    "sed -i 's/x/y/' src/app/a.ts",
    'cp .claude/rules/golden/core/work-modes.md /tmp/copy.md',
    'cat CLAUDE.md',
    'rm -rf dist/web-app',
    'git restore --staged CLAUDE.md',
    `node -e "console.log(require('fs').readFileSync('CLAUDE.md','utf8'))"`,
  ]) assert.equal(bash(cmd), false, cmd);
});

test('the golden-sync flag unlocks generated files for sync', () => {
  const isFlagSet = (f) => f === 'golden-sync';
  assert.equal(edit('CLAUDE.md', { isFlagSet }), false);
  assert.equal(bash('rm .husky/pre-push', { isFlagSet }), false);
});

test('fence: the golden repo cannot be edited from a project', () => {
  const inGolden = `${fence}/plugins/core/rules/work-modes.md`;
  assert.equal(edit(inGolden), true);
  assert.equal(bash(`sed -i 's/a/b/' ${inGolden}`), true);
  assert.equal(bash(`rm -r ${fence}/plugins/core`), true);
  assert.match(evaluatePath(inGolden, { root, fence }).reason, /golden workspace repo/);
});

test('fence: a session opened in the golden repo may edit it', () => {
  assert.equal(edit(`${fence}/plugins/core/rules/work-modes.md`, { root: fence }), false);
  assert.equal(edit('plugins/core/rules/work-modes.md', { root: fence }), false);
});

test('fence: the real fence resolves to the repo holding the marketplace manifest', () => {
  assert.match(goldenFence(), /claude-golden$/i);
});
