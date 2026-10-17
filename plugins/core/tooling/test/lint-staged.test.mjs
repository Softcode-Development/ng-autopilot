import { test } from 'node:test';
import assert from 'node:assert/strict';

import path from 'node:path';

import { autopilotLintStaged, lintScope, ratchetCommands, ratchetOn } from '../lint-staged/preset.mjs';

test('scope: strictScope plus the toolkit; a toolkit inside the scope is not repeated', () => {
  assert.deepEqual(lintScope({ lint: { strictScope: ['src/app/features/**'] } }), ['src/app/features/**', 'src/testing/**']);
  assert.deepEqual(lintScope({}), ['src/**']);
  assert.deepEqual(lintScope({ lint: { strictScope: ['src/app/features/**'], testingToolkit: null } }), ['src/app/features/**']);
});

test('narrowed scope: legacy files match no entry, so nothing lints or reformats them', () => {
  const entries = autopilotLintStaged({
    lint: { strictScope: ['src/app/features/**'] },
    i18n: { sets: [{ source: 'src/assets/i18n/iceland/is.json', locales: ['src/assets/i18n/iceland/en.json'] },
      { source: 'src/assets/i18n/brazil/pt-BR.json', locales: ['src/assets/i18n/brazil/en.json'] }] },
  });
  assert.deepEqual(Object.keys(entries).sort(), [
    '**/*.html',
    'src/app/features/**/*.{md,json,yml,yaml}',
    'src/app/features/**/*.{scss,css}',
    'src/app/features/**/*.{ts,mts,cts,js,mjs,cjs,html}',
    'src/testing/**/*.{md,json,yml,yaml}',
    'src/testing/**/*.{scss,css}',
    'src/testing/**/*.{ts,mts,cts,js,mjs,cjs,html}',
    '{src/assets/i18n/iceland,src/assets/i18n/brazil}/*.json',
  ]);
  assert.deepEqual(entries['src/app/features/**/*.{ts,mts,cts,js,mjs,cjs,html}'], ['eslint --fix --max-warnings=0', 'prettier --write']);
});

test('whole-app scope: code inside src, docs and config formatted repo-wide', () => {
  const entries = autopilotLintStaged({ lint: { strictScope: ['src/**'] } });
  assert.deepEqual(Object.keys(entries), ['src/**/*.{ts,mts,cts,js,mjs,cjs,html}', 'src/**/*.{scss,css}', '*.{md,json,yml,yaml}']);
});

test('hardcoded-text ratchet: on for a narrowed scope with the angular pack, off for the whole app or when opted out', () => {
  const narrowed = { packs: ['core', 'angular'], lint: { strictScope: ['src/app/features/**', 'src/app/shared/modern/**'] } };
  assert.equal(ratchetOn(narrowed), true);
  assert.equal(ratchetOn({ ...narrowed, lint: { ...narrowed.lint, legacyHardcodedTextRatchet: false } }), false);
  assert.equal(ratchetOn({ packs: ['core', 'angular'], lint: { strictScope: ['src/**'] } }), false);
  assert.equal(ratchetOn({ packs: ['core', 'nestjs'], lint: { strictScope: ['apps/api/**'] } }), false);
  assert.equal(typeof autopilotLintStaged(narrowed)['**/*.html'], 'function');
  assert.equal(autopilotLintStaged({ lint: { strictScope: ['src/**'] } })['**/*.html'], undefined);
});

test('hardcoded-text ratchet: only templates outside the scope are checked', () => {
  const cwd = path.resolve('/repo');
  const autopilot = { lint: { strictScope: ['src/app/features/**', 'src/app/shared/modern/**'] } };
  const abs = (rel) => path.join(cwd, rel);
  assert.deepEqual(ratchetCommands(autopilot, [abs('src/app/features/a/a.html'), abs('src/app/shared/modern/b/b.html')], cwd), []);
  const [command] = ratchetCommands(autopilot, [abs('src/app/features/a/a.html'), abs('src/app/pages/old/old.html')], cwd);
  assert.match(command, /^node tools\/autopilot\/i18n\/hardcoded-ratchet\.mjs "[^"]*old\.html"$/);
});
