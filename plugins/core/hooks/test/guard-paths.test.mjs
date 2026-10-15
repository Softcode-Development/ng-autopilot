import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePath } from '../guard-paths.mjs';
import { canonicalisePath, globToRegExp, fromMsysPath } from '../lib/hook-io.mjs';

const root = process.platform === 'win32' ? 'C:/repo' : '/repo';
const config = {
  protectedPaths: [
    { glob: 'prisma/schema.prisma', flag: 'db-migrator-active', reason: 'owned by the db-migrator agent' },
    { glob: 'prisma/migrations/**', flag: 'db-migrator-active', reason: 'owned by the db-migrator agent' },
    { glob: 'openspec/specs/**', flag: 'opsx-archive-in-progress', reason: 'promoted truth' },
  ],
};
const blocked = (p, isFlagSet = () => false) => evaluatePath(p, { root, config, isFlagSet }).blocked;

test('blocks protected paths in every spelling', () => {
  for (const p of [
    'prisma/schema.prisma',
    './prisma/schema.prisma',
    `${root}/prisma/schema.prisma`,
    'apps/../prisma/schema.prisma',
    'prisma/migrations/20260101_init/migration.sql',
    'openspec/specs/transactions/spec.md',
    '.claude/rules/golden/state.md',
  ]) {
    assert.equal(blocked(p), true, p);
  }
});

test('allows ordinary paths', () => {
  for (const p of ['src/app/app.ts', 'prisma/seed.ts', 'openspec/changes/x/proposal.md', '.claude/rules/project/a.md', '']) {
    assert.equal(blocked(p), false, p);
  }
});

test('flag unlocks only its own paths', () => {
  const db = (f) => f === 'db-migrator-active';
  assert.equal(blocked('prisma/schema.prisma', db), false);
  assert.equal(blocked('openspec/specs/x/spec.md', db), true);
});

test('golden-sync flag unlocks synced rules', () => {
  assert.equal(blocked('.claude/rules/golden/a.md', (f) => f === 'golden-sync'), false);
});

test('backslash paths are normalised', () => {
  assert.equal(canonicalisePath('prisma\\migrations\\x.sql', root), 'prisma/migrations/x.sql');
});

test('Git Bash /c/ paths resolve to drive paths on Windows', () => {
  assert.equal(fromMsysPath('/c/apps/x', 'win32'), 'C:/apps/x');
  assert.equal(fromMsysPath('/c', 'win32'), 'C:/');
  assert.equal(fromMsysPath('/c/apps/x', 'linux'), '/c/apps/x');
  assert.equal(fromMsysPath('/usr/lib', 'win32'), '/usr/lib');
});

test('paths outside the repo stay absolute', () => {
  const outside = process.platform === 'win32' ? 'D:/other/prisma/schema.prisma' : '/other/prisma/schema.prisma';
  assert.equal(blocked(outside), false);
});

test('glob: * stays in one segment, ** crosses', () => {
  assert.equal(globToRegExp('a/*.md').test('a/b.md'), true);
  assert.equal(globToRegExp('a/*.md').test('a/b/c.md'), false);
  assert.equal(globToRegExp('a/**').test('a/b/c.md'), true);
  assert.equal(globToRegExp('**/x.ts').test('x.ts'), true);
  assert.equal(globToRegExp('**/x.ts').test('d/e/x.ts'), true);
});
