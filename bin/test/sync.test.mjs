import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { sync } from '../sync.mjs';
import { verifyStaged, verifyAll } from '../../plugins/core/tooling/lock/verify.mjs';

let root;
const p = (rel) => path.join(root, rel);
const read = (rel) => readFileSync(p(rel), 'utf8');
const write = (rel, text) => {
  mkdirSync(path.dirname(p(rel)), { recursive: true });
  writeFileSync(p(rel), text);
};
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const config = (over = {}) => write('.claude/golden.json', JSON.stringify({
  packs: ['angular', 'testing'],
  testTiers: ['unit'],
  lint: { strictScope: ['src/app/features/**'], selectorPrefix: 'app' },
  i18n: { sets: [{ source: 'src/assets/i18n/lt.json', locales: ['src/assets/i18n/en.json'] }] },
  ...over,
}, null, 2));

before(() => {
  root = mkdtempSync(path.join(tmpdir(), 'golden-sync-'));
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  write('package.json', JSON.stringify({ name: 'app', devDependencies: { eslint: '9.0.0' } }));
  write('.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash(npm run e2e:*)'] }, enabledPlugins: { 'other@market': true } }));
  config();
});
after(() => rmSync(root, { recursive: true, force: true }));

test('missing golden.json is an error', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'golden-none-'));
  assert.throws(() => sync(empty), /run \/core:install first/);
  rmSync(empty, { recursive: true, force: true });
});

test('dry run writes nothing', () => {
  const r = sync(root, { dryRun: true });
  assert.ok(r.written.length > 0);
  assert.equal(existsSync(p('CLAUDE.md')), false);
  assert.equal(existsSync(p('.claude/golden.lock.json')), false);
});

test('fresh sync writes generated files, creates project files, merges settings, fingerprints', () => {
  const r = sync(root);
  for (const f of ['.claude/rules/golden/core/work-modes.md', '.claude/rules/golden/angular/state.md', 'tools/golden/eslint/preset.mjs',
    'tools/golden/eslint/rules/template-no-method-calls.mjs', 'tools/golden/i18n/i18n-validate.mjs', 'tools/golden/lock/verify.mjs',
    'CLAUDE.md', '.husky/pre-commit', '.husky/commit-msg', '.husky/pre-push', '.claude/.gitignore']) {
    assert.ok(existsSync(p(f)), f);
  }
  for (const f of ['.claude/rules/project.md', '.claude/gates.md', '.claude/plans/backlog.md', '.claude/unit-testing/overrides.md',
    '.claude/unit-testing/backlog.md', 'eslint.config.mjs', 'stylelint.config.mjs', 'commitlint.config.cjs', '.lintstagedrc.json']) {
    assert.ok(r.created.includes(f), f);
  }
  assert.equal(existsSync(p('.claude/e2e-testing/overrides.md')), false);
  assert.equal(existsSync(p('tools/golden/openspec/tasks-gate.mjs')), false);

  assert.match(read('CLAUDE.md'), /`src\/app\/features\/\*\*`/);
  assert.match(read('CLAUDE.md'), /\.claude\/rules\/project\.md/);
  assert.match(read('.husky/pre-commit'), /npx --no-install lint-staged/);
  assert.match(read('.husky/pre-commit'), /tools\/golden\/lock\/verify\.mjs --staged/);
  assert.ok(JSON.parse(read('.lintstagedrc.json'))['src/assets/i18n/*.json']);

  const settings = JSON.parse(read('.claude/settings.json'));
  assert.ok(settings.permissions.allow.includes('Bash(npm run e2e:*)'), 'project entry kept');
  assert.ok(settings.permissions.deny.includes('Bash(git push --force:*)'), 'golden entry added');
  assert.equal(settings.permissions.allow.some((e) => e.startsWith('Bash(pnpm')), false, 'npm project drops pnpm entries');
  assert.equal(settings.enabledPlugins['angular@claude-golden'], true);
  assert.equal(settings.enabledPlugins['openspec@claude-golden'], false);
  assert.equal(settings.enabledPlugins['other@market'], true);

  const lock = JSON.parse(read('.claude/golden.lock.json'));
  assert.ok(lock.files['CLAUDE.md'] && lock.files['tools/golden/eslint/preset.mjs']);
  assert.equal(lock.files['.claude/rules/project.md'], undefined, 'project-owned files are not fingerprinted');
  assert.deepEqual(r.missingDevDependencies.includes('eslint'), false);
  assert.ok(r.missingDevDependencies.includes('husky'));
  assert.deepEqual(verifyAll(root), []);
});

test('second sync changes nothing', () => {
  const r = sync(root);
  assert.deepEqual([r.written, r.created, r.merged, r.removed], [[], [], [], []]);
  assert.equal(r.lockChanged, false);
});

test('project-owned files are never overwritten', () => {
  write('.claude/rules/project.md', '# Mine\n');
  const r = sync(root);
  assert.equal(read('.claude/rules/project.md'), '# Mine\n');
  assert.ok(r.kept.includes('.claude/rules/project.md'));
});

test('a hand-edited generated file is restored and reported', () => {
  write('.claude/rules/golden/angular/state.md', 'tampered');
  assert.match(verifyAll(root).join('\n'), /state\.md: content differs/);
  const r = sync(root);
  assert.ok(r.conflicts.some((c) => c.includes('state.md')));
  assert.notEqual(read('.claude/rules/golden/angular/state.md'), 'tampered');
  assert.deepEqual(verifyAll(root), []);
});

test('pre-commit fingerprint check blocks staged edits, deletions and new files in generated folders', () => {
  git('add', '-A');
  git('commit', '-q', '-m', 'synced');
  assert.deepEqual(verifyStaged(root), []);

  write('tools/golden/eslint/preset.mjs', '// weakened');
  write('tools/golden/eslint/extra.mjs', '// new');
  git('rm', '-q', '--cached', '.husky/pre-push');
  write('.claude/rules/project.md', '# Mine, edited\n');
  git('add', 'tools/golden', '.claude/rules/project.md');
  const problems = verifyStaged(root).join('\n');
  assert.match(problems, /preset\.mjs: content differs/);
  assert.match(problems, /extra\.mjs: new file in a generated folder/);
  assert.match(problems, /pre-push: generated file deleted/);
  assert.doesNotMatch(problems, /project\.md/);

  git('reset', '-q');
  git('checkout', '--', 'tools/golden/eslint/preset.mjs');
  rmSync(p('tools/golden/eslint/extra.mjs'));
  assert.deepEqual(verifyStaged(root), []);
});

test('a re-sync after a golden change commits cleanly (staged lock matches staged files)', () => {
  config({ testTiers: ['unit', 'e2e'] });
  sync(root);
  git('add', '-A');
  assert.deepEqual(verifyStaged(root), []);
  git('commit', '-q', '-m', 'add e2e tier');
});

test('removing a pack removes its generated files and disables the plugin', () => {
  config({ packs: ['testing'], testTiers: ['unit'] });
  const r = sync(root);
  assert.ok(r.removed.includes('tools/golden/eslint/preset.mjs'));
  assert.ok(r.removed.some((f) => f.startsWith('.claude/rules/golden/angular/')));
  assert.equal(existsSync(p('.claude/rules/golden/angular/state.md')), false);
  assert.equal(JSON.parse(read('.claude/settings.json')).enabledPlugins['angular@claude-golden'], false);
  assert.ok(existsSync(p('eslint.config.mjs')), 'project-owned entry file is the project\'s to remove');
});
