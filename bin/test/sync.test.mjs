import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
const config = (over = {}) => write('.claude/autopilot.json', JSON.stringify({
  packs: ['angular', 'testing'],
  testTiers: ['unit'],
  lint: { strictScope: ['src/app/features/**'], selectorPrefix: 'app' },
  i18n: { sets: [{ source: 'src/assets/i18n/lt.json', locales: ['src/assets/i18n/en.json'] }] },
  ...over,
}, null, 2));

before(() => {
  root = mkdtempSync(path.join(tmpdir(), 'autopilot-sync-'));
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  write('package.json', JSON.stringify({ name: 'app', devDependencies: { eslint: '9.0.0' } }));
  write('.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash(npm run e2e:*)'] }, enabledPlugins: { 'other@market': true } }));
  config();
});
after(() => rmSync(root, { recursive: true, force: true }));

test('missing autopilot.json is an error', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'autopilot-none-'));
  assert.throws(() => sync(empty), /run \/autopilot:install first/);
  rmSync(empty, { recursive: true, force: true });
});

test('dry run writes nothing', () => {
  const r = sync(root, { dryRun: true });
  assert.ok(r.written.length > 0);
  assert.equal(existsSync(p('CLAUDE.md')), false);
  assert.equal(existsSync(p('.claude/autopilot.lock.json')), false);
});

test('fresh sync writes generated files, creates project files, merges settings, fingerprints', () => {
  const r = sync(root);
  for (const f of ['.claude/rules/autopilot/core/work-modes.md', '.claude/rules/autopilot/angular/state.md', 'tools/autopilot/eslint/preset.mjs',
    'tools/autopilot/eslint/rules/template-no-method-calls.mjs', 'tools/autopilot/i18n/i18n-validate.mjs', 'tools/autopilot/lock/verify.mjs',
    'CLAUDE.md', '.husky/pre-commit', '.husky/commit-msg', '.husky/pre-push', '.claude/.gitignore']) {
    assert.ok(existsSync(p(f)), f);
  }
  for (const f of ['.claude/rules/project.md', '.claude/gates.md', '.claude/plans/backlog.md', '.claude/unit-testing/overrides.md',
    '.claude/unit-testing/backlog.md', 'eslint.config.mjs', 'stylelint.config.mjs', 'commitlint.config.cjs', '.lintstagedrc.mjs',
    'src/testing/README.md']) {
    assert.ok(r.created.includes(f), f);
  }
  assert.equal(existsSync(p('.claude/e2e-testing/overrides.md')), false);
  assert.equal(existsSync(p('tools/autopilot/openspec/tasks-gate.mjs')), false);

  assert.match(read('CLAUDE.md'), /`src\/app\/features\/\*\*`/);
  assert.match(read('CLAUDE.md'), /\.claude\/rules\/project\.md/);
  assert.match(read('.husky/pre-commit'), /npx --no-install lint-staged/);
  assert.match(read('.husky/pre-commit'), /tools\/autopilot\/lock\/verify\.mjs --staged/);
  assert.ok(existsSync(p('tools/autopilot/lint-staged/preset.mjs')));

  const settings = JSON.parse(read('.claude/settings.json'));
  assert.ok(settings.permissions.allow.includes('Bash(npm run e2e:*)'), 'project entry kept');
  assert.ok(settings.permissions.deny.includes('Bash(git push --force:*)'), 'autopilot entry added');
  assert.equal(settings.permissions.allow.some((e) => e.startsWith('Bash(pnpm')), false, 'npm project drops pnpm entries');
  assert.equal(settings.enabledPlugins['autopilot-angular@ng-autopilot'], true);
  assert.equal(settings.enabledPlugins['autopilot-openspec@ng-autopilot'], false);
  assert.equal(settings.enabledPlugins['other@market'], true);

  const lock = JSON.parse(read('.claude/autopilot.lock.json'));
  assert.ok(lock.files['CLAUDE.md'] && lock.files['tools/autopilot/eslint/preset.mjs']);
  assert.equal(lock.files['.claude/rules/project.md'], undefined, 'project-owned files are not fingerprinted');
  assert.deepEqual(r.missingDevDependencies.includes('eslint'), false);
  assert.ok(r.missingDevDependencies.includes('husky'));
  assert.deepEqual(verifyAll(root), []);
});

test('the generated lint-staged config loads and covers only the lint scope, the toolkit and the locale files', async () => {
  const { default: lintStaged } = await import(pathToFileURL(p('.lintstagedrc.mjs')).href);
  assert.deepEqual(Object.keys(lintStaged).sort(), [
    'src/app/features/**/*.{md,json,yml,yaml}',
    'src/app/features/**/*.{scss,css}',
    'src/app/features/**/*.{ts,mts,cts,js,mjs,cjs,html}',
    'src/assets/i18n/*.json',
    'src/testing/**/*.{md,json,yml,yaml}',
    'src/testing/**/*.{scss,css}',
    'src/testing/**/*.{ts,mts,cts,js,mjs,cjs,html}',
  ]);
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
  write('.claude/rules/autopilot/angular/state.md', 'tampered');
  assert.match(verifyAll(root).join('\n'), /state\.md: content differs/);
  const r = sync(root);
  assert.ok(r.conflicts.some((c) => c.includes('state.md')));
  assert.notEqual(read('.claude/rules/autopilot/angular/state.md'), 'tampered');
  assert.deepEqual(verifyAll(root), []);
});

test('pre-commit fingerprint check blocks staged edits, deletions and new files in generated folders', () => {
  git('add', '-A');
  git('commit', '-q', '-m', 'synced');
  assert.deepEqual(verifyStaged(root), []);

  write('tools/autopilot/eslint/preset.mjs', '// weakened');
  write('tools/autopilot/eslint/extra.mjs', '// new');
  git('rm', '-q', '--cached', '.husky/pre-push');
  write('.claude/rules/project.md', '# Mine, edited\n');
  git('add', 'tools/autopilot', '.claude/rules/project.md');
  const problems = verifyStaged(root).join('\n');
  assert.match(problems, /preset\.mjs: content differs/);
  assert.match(problems, /extra\.mjs: new file in a generated folder/);
  assert.match(problems, /pre-push: generated file deleted/);
  assert.doesNotMatch(problems, /project\.md/);

  git('reset', '-q');
  git('checkout', '--', 'tools/autopilot/eslint/preset.mjs');
  rmSync(p('tools/autopilot/eslint/extra.mjs'));
  assert.deepEqual(verifyStaged(root), []);
});

test('openspec pack: installed with plan-file planning, the git gate is copied but not wired into the hooks', () => {
  config({ packs: ['angular', 'testing', 'openspec'], planning: 'plan-file' });
  sync(root);
  assert.ok(existsSync(p('tools/autopilot/openspec/tasks-gate.mjs')));
  assert.ok(existsSync(p('.claude/rules/autopilot/openspec/openspec.md')));
  assert.doesNotMatch(read('.husky/pre-commit'), /tasks-gate/);
  assert.doesNotMatch(read('.husky/commit-msg'), /tasks-gate/);
});

test('openspec pack: with openspec planning, the git gate runs in pre-commit and commit-msg', () => {
  config({ packs: ['angular', 'testing', 'openspec'], planning: 'openspec' });
  sync(root);
  assert.match(read('.husky/pre-commit'), /tasks-gate\.mjs --pre-commit/);
  assert.match(read('.husky/commit-msg'), /tasks-gate\.mjs --commit-msg "\$1"/);
  config();
  sync(root);
  git('add', '-A');
  git('commit', '-q', '-m', 'back to the base config');
});

test('a re-sync after a autopilot change commits cleanly (staged lock matches staged files)', () => {
  config({ testTiers: ['unit', 'e2e'] });
  sync(root);
  git('add', '-A');
  assert.deepEqual(verifyStaged(root), []);
  git('commit', '-q', '-m', 'add e2e tier');
});

test('removing a pack removes its generated files and disables the plugin', () => {
  config({ packs: ['testing'], testTiers: ['unit'] });
  const r = sync(root);
  assert.ok(r.removed.includes('tools/autopilot/eslint/preset.mjs'));
  assert.ok(r.removed.some((f) => f.startsWith('.claude/rules/autopilot/angular/')));
  assert.equal(existsSync(p('.claude/rules/autopilot/angular/state.md')), false);
  assert.equal(JSON.parse(read('.claude/settings.json')).enabledPlugins['autopilot-angular@ng-autopilot'], false);
  assert.ok(existsSync(p('eslint.config.mjs')), 'project-owned entry file is the project\'s to remove');
});
