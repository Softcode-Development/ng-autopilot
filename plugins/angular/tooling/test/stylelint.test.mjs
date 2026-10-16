import { test } from 'node:test';
import assert from 'node:assert/strict';

import stylelint from 'stylelint';

import { goldenStylelint } from '../stylelint/preset.mjs';

const lint = async (code, codeFilename, options) => {
  const { results } = await stylelint.lint({ code, codeFilename, config: goldenStylelint(options) });
  return results[0].warnings.map((w) => w.rule);
};

const VIOLATIONS = `.card { color: #ff0000; background: rgb(0 0 0); border-color: red; margin: 0 !important; }
@media (prefers-color-scheme: dark) { .card { color: var(--fg); } }
`;

test('in scope: token, !important and dark-mode rules fire (scss)', async () => {
  const rules = await lint(VIOLATIONS, 'src/app/features/orders/orders.component.scss', { scss: true, strictScope: ['src/app/features/**'] });
  for (const r of ['color-no-hex', 'function-disallowed-list', 'color-named', 'declaration-no-important', 'media-feature-name-disallowed-list']) {
    assert.ok(rules.includes(r), `expected ${r}, got ${rules.join(', ')}`);
  }
});

test('out of scope: design-discipline rules do not fire on legacy styles', async () => {
  const rules = await lint(VIOLATIONS, 'src/app/legacy/legacy.component.scss', { scss: true, strictScope: ['src/app/features/**'] });
  for (const r of ['color-no-hex', 'declaration-no-important', 'media-feature-name-disallowed-list']) {
    assert.ok(!rules.includes(r), `unexpected ${r}`);
  }
});

test('token-based styles pass', async () => {
  const rules = await lint('.card {\n  color: var(--fg);\n  padding: var(--space-2);\n}\n', 'src/app/features/a/a.component.css', {});
  assert.deepEqual(rules, []);
});

test('tailwind at-rules are accepted when enabled', async () => {
  const code = '@import "tailwindcss";\n@theme {\n  --color-x: var(--fg);\n}\n';
  assert.ok((await lint(code, 'src/styles.css', {})).includes('at-rule-no-unknown'));
  assert.ok(!(await lint(code, 'src/styles.css', { tailwind: true })).includes('at-rule-no-unknown'));
});
