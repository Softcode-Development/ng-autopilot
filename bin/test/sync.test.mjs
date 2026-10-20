import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { mergeSettings, sync } from '../sync.mjs';
import { activeTiers, normaliseConfig, pausedTiers } from '../lib/render.mjs';
import { verifyStaged, verifyAll } from '../../plugins/core/tooling/lock/verify.mjs';

let root;
const p = (rel) => path.join(root, rel);
const read = (rel) => readFileSync(p(rel), 'utf8');
const write = (rel, text) => {
  mkdirSync(path.dirname(p(rel)), { recursive: true });
  writeFileSync(p(rel), text);
};
const lockHas = (rel) => Boolean(JSON.parse(read('.claude/autopilot.lock.json')).files[rel]);
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
    'src/testing/README.md', 'docs/TECH_STACK.md', 'docs/ARCHITECTURE.md', 'docs/DOMAIN.md', 'docs/FEATURES.md',
    'docs/GETTING_STARTED.md', 'docs/DESIGN_SYSTEM.md']) {
    assert.ok(r.created.includes(f), f);
  }
  assert.equal(existsSync(p('.claude/e2e-testing/overrides.md')), false);
  assert.equal(existsSync(p('docs/DATA_MODEL.md')), false, 'DATA_MODEL only with the nestjs pack');
  assert.match(read('CLAUDE.md'), /\[TECH_STACK\.md\]\(docs\/TECH_STACK\.md\) · \[ARCHITECTURE\.md\]\(docs\/ARCHITECTURE\.md\)/);
  assert.equal(lockHas('docs/TECH_STACK.md'), false, 'docs are project-owned, not fingerprinted');
  assert.ok(r.created.includes('README.md'), 'a repo without a README gets one');
  const readme = read('README.md');
  assert.match(readme, /\| Need \| Where \|\n\|---\|---\|\n\| Set up, run, test, build \| \[docs\/GETTING_STARTED\.md\]/, 'Start here opens with setup');
  assert.match(readme, /\[docs\/DESIGN_SYSTEM\.md\]\(docs\/DESIGN_SYSTEM\.md\)/);
  assert.doesNotMatch(readme, /DATA_MODEL|__START_HERE__/);
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

test('the generated lint-staged config loads and covers the lint scope, the toolkit, legacy templates (ratchet) and the locale files', async () => {
  const { default: lintStaged } = await import(pathToFileURL(p('.lintstagedrc.mjs')).href);
  assert.ok(existsSync(p('tools/autopilot/i18n/hardcoded-ratchet.mjs')), 'the ratchet the legacy-template entry runs');
  assert.deepEqual(Object.keys(lintStaged).sort(), [
    '**/*.html',
    'src/app/features/**/*.{md,json,yml,yaml}',
    'src/app/features/**/*.{scss,css}',
    'src/app/features/**/*.{ts,mts,cts,js,mjs,cjs,html}',
    'src/assets/i18n/*.json',
    'src/testing/**/*.{md,json,yml,yaml}',
    'src/testing/**/*.{scss,css}',
    'src/testing/**/*.{ts,mts,cts,js,mjs,cjs,html}',
  ]);
});

test('CLAUDE.md carries the API line: "not set" until the owner gives the URLs', () => {
  assert.match(read('CLAUDE.md'), /\*\*API:\*\* \*\*not set\*\* — before wiring any endpoint, ask the owner/);
  assert.match(read('CLAUDE.md'), /Code outside it is legacy: bug fixes only/);
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

test('API URLs from autopilot.json reach CLAUDE.md; api.none says there is no API', () => {
  config({ api: { baseUrl: 'https://dev.api.example.test', docsUrl: 'https://dev.api.example.test/api/docs' } });
  sync(root);
  assert.match(read('CLAUDE.md'), /\*\*API:\*\* base `https:\/\/dev\.api\.example\.test` · docs https:\/\/dev\.api\.example\.test\/api\/docs — verify every endpoint/);
  config({ api: { none: true } });
  sync(root);
  assert.match(read('CLAUDE.md'), /\*\*API:\*\* none — the project calls no backend API/);
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

test('settings merge: an autopilot entry that moved tiers leaves its old tier; project entries stay', () => {
  const autopilot = { permissions: { allow: ['Bash(git push:*)'], ask: ['Bash(gh pr merge:*)'], deny: ['Bash(git push origin main:*)'] } };
  const existing = { permissions: { allow: ['Bash(make:*)'], ask: ['Bash(git push:*)', 'Bash(docker:*)'], deny: [] } };
  const merged = mergeSettings(existing, autopilot, []);
  assert.deepEqual(merged.permissions.allow, ['Bash(make:*)', 'Bash(git push:*)']);
  assert.deepEqual(merged.permissions.ask, ['Bash(docker:*)', 'Bash(gh pr merge:*)']);
  assert.deepEqual(merged.permissions.deny, ['Bash(git push origin main:*)']);
});

test('testing switches: tiers on by default, a paused tier named in CLAUDE.md, its overrides still synced; bad values refused', () => {
  const c = normaliseConfig({ testTiers: ['unit', 'e2e'] });
  assert.deepEqual(c.testing, { phase: 'orchestrated', unit: { enabled: true }, integration: { enabled: true }, e2e: { enabled: true } });
  assert.deepEqual(c.limits, { parallelTestAgents: 3 });
  const paused = normaliseConfig({ testTiers: ['unit', 'e2e'], testing: { e2e: { enabled: false }, phase: 'single-review' }, limits: { parallelTestAgents: 2 } });
  assert.deepEqual([activeTiers(paused), pausedTiers(paused)], [['unit'], ['e2e']]);
  assert.throws(() => normaliseConfig({ testing: { smoke: { enabled: false } } }), /testing\.smoke: unknown test tier/);
  assert.throws(() => normaliseConfig({ testing: { phase: 'parallel' } }), /testing\.phase: "parallel"/);
  assert.throws(() => normaliseConfig({ testing: { e2e: { enabled: 'no' } } }), /testing\.e2e\.enabled must be true or false/);
  assert.throws(() => normaliseConfig({ limits: { parallelTestAgents: 0 } }), /parallelTestAgents/);

  config({ testTiers: ['unit', 'e2e'], testing: { e2e: { enabled: false }, phase: 'single-review' }, limits: { parallelTestAgents: 2 } });
  sync(root);
  assert.match(read('CLAUDE.md'), /\*\*Test tiers:\*\* unit \(paused: e2e — no new specs there, criteria go to a hand-off; existing specs still run\)\. \*\*Test phase:\*\* `single-review`, at most 2 test agents at once\./);
  assert.ok(existsSync(p('.claude/e2e-testing/overrides.md')), 'a paused tier keeps its overrides: its existing specs still run');
  config({ testTiers: ['unit', 'e2e'] });
  sync(root);
  assert.match(read('CLAUDE.md'), /\*\*Test tiers:\*\* unit, e2e\. \*\*Test phase:\*\* `orchestrated`, at most 3 test agents at once\./, 're-enabling needs no other change');
  config();
  sync(root);
});

test('run output goes to the git-ignored .claude/tmp/; the dev-server check is synced', () => {
  sync(root);
  assert.match(read('.claude/.gitignore'), /^\/tmp\/$/m);
  assert.ok(existsSync(p('tools/autopilot/server/listening.mjs')));
});

test('settings merge: the owner\'s tier for an autopilot entry stands; deny entries always apply', () => {
  const autopilot = { permissions: {
    allow: ['Bash(git commit:*)', 'Bash(node:*)'],
    ask: ['Bash(npm install:*)', 'Bash(npm ci:*)', 'Bash(curl:*)', 'Bash(wget:*)', 'Bash(git merge:*)'],
    deny: ['Bash(git reset --hard:*)'],
  } };
  const existing = { permissions: {
    allow: ['Bash(npm install:*)', 'Bash(npm ci:*)', 'Bash(curl:*)', 'Bash(wget:*)', 'Bash(git reset --hard:*)'],
    ask: ['Bash(npm install:*)'],
    deny: ['Bash(node:*)'],
  } };
  const merged = mergeSettings(existing, autopilot, []);
  assert.deepEqual(merged.permissions.allow, ['Bash(npm install:*)', 'Bash(npm ci:*)', 'Bash(curl:*)', 'Bash(wget:*)', 'Bash(git commit:*)'], 'installs and curl stay allowed; node stays denied');
  assert.deepEqual(merged.permissions.ask, ['Bash(git merge:*)'], 'no ask copy left to override the owner\'s allow');
  assert.deepEqual(merged.permissions.deny, ['Bash(node:*)', 'Bash(git reset --hard:*)']);
  assert.deepEqual(mergeSettings(merged, autopilot, []).permissions, merged.permissions, 'a second merge changes nothing');
});

test('settings merge: retired autopilot entries leave an older project (bare Edit/Write, ask on rm and git checkout)', () => {
  const autopilot = { permissions: { allow: ['Edit(./**)', 'Write(./**)'], ask: ['Bash(git merge:*)'], deny: [] } };
  const existing = { permissions: { allow: ['Read', 'Edit', 'Write', 'Bash(make:*)'], ask: ['Bash(rm:*)', 'Bash(git checkout:*)', 'Bash(docker:*)'], deny: [] } };
  const merged = mergeSettings(existing, autopilot, []);
  assert.deepEqual(merged.permissions.allow, ['Read', 'Bash(make:*)', 'Edit(./**)', 'Write(./**)']);
  assert.deepEqual(merged.permissions.ask, ['Bash(docker:*)', 'Bash(git merge:*)']);
});

test('the settings template keeps writes inside the project and allows read-only shell', () => {
  sync(root);
  const { allow, ask } = JSON.parse(read('.claude/settings.json')).permissions;
  for (const e of ['Edit(./**)', 'Write(./**)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(head:*)', 'Bash(tail:*)', 'Bash(grep:*)', 'Bash(wc:*)', 'Bash(date:*)']) assert.ok(allow.includes(e), e);
  for (const e of ['Edit', 'Write']) assert.ok(!allow.includes(e), `bare ${e} would allow writes anywhere`);
  for (const e of ['Bash(rm:*)', 'Bash(git checkout:*)']) assert.ok(!ask.includes(e), e);
});

test('a modern shared folder in the strict scope gets its README once, with links that resolve', () => {
  config({ lint: { strictScope: ['src/app/features/**', 'src/app/shared/modern/**'], selectorPrefix: 'app' } });
  const r = sync(root);
  assert.ok(r.created.includes('src/app/shared/modern/README.md'));
  const readme = read('src/app/shared/modern/README.md');
  assert.match(readme, /\[ARCHITECTURE\.md § 2\]\(\.\.\/\.\.\/\.\.\/\.\.\/docs\/ARCHITECTURE\.md\)/);
  assert.match(readme, /`components\/\{name\}\/`/);
  for (const [, target] of readme.matchAll(/\]\((\.\.\/[^)]+)\)/g)) assert.ok(existsSync(path.resolve(p('src/app/shared/modern'), target)), target);
  write('src/app/shared/modern/README.md', '# shared/modern — project edit\n');
  sync(root);
  assert.equal(read('src/app/shared/modern/README.md'), '# shared/modern — project edit\n', 'project-owned once created');
  config();
  sync(root);
});
