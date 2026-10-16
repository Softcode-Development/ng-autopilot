import { test } from 'node:test';
import assert from 'node:assert/strict';

import { autopilotLintStaged, lintScope } from '../lint-staged/preset.mjs';

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
