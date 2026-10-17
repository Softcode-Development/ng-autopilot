import { test } from 'node:test';
import assert from 'node:assert/strict';

import stylelint from 'stylelint';

import { autopilotStylelint } from '../stylelint/preset.mjs';

const lint = async (code, codeFilename, options) => {
  const { results } = await stylelint.lint({ code, codeFilename, config: autopilotStylelint(options) });
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
  const rules = await lint('/* why: fixed-size canvas */\n.card {\n  color: var(--fg);\n  padding: var(--space-2);\n}\n', 'src/app/features/a/a.component.css', {});
  assert.deepEqual(rules, []);
});

test('tailwind at-rules are accepted when enabled', async () => {
  const code = '@import "tailwindcss";\n@theme {\n  --color-x: var(--fg);\n}\n';
  assert.ok((await lint(code, 'src/styles.css', {})).includes('at-rule-no-unknown'));
  assert.ok(!(await lint(code, 'src/styles.css', { tailwind: true })).includes('at-rule-no-unknown'));
});

const SCOPE = { scss: true, strictScope: ['src/app/features/**'] };

test('justified-stylesheet: a component stylesheet in scope needs a why comment', async () => {
  const rules = await lint('.x {\n  display: flex;\n}\n', 'src/app/features/a/a.component.scss', SCOPE);
  assert.deepEqual(rules, ['autopilot/justified-stylesheet']);
});

test('justified-stylesheet: a why comment, an empty file and legacy code pass; other feature SCSS does not', async () => {
  const why = '/* why: third-party canvas sizing */\n.x {\n  display: flex;\n}\n';
  assert.deepEqual(await lint(why, 'src/app/features/a/a.component.scss', SCOPE), []);
  assert.ok(!(await lint('', 'src/app/features/a/a.component.scss', SCOPE)).includes('autopilot/justified-stylesheet'));
  assert.deepEqual(await lint('.x {\n  display: flex;\n}\n', 'src/app/legacy/a.component.scss', SCOPE), []);
  assert.deepEqual(await lint('.x {\n  display: flex;\n}\n', 'src/app/features/a/theme.scss', SCOPE), ['autopilot/justified-stylesheet'], 'feature-level SCSS needs a reason too');
});

test('justified-stylesheet: plain css components when the project has no scss', async () => {
  const rules = await lint('.x {\n  display: flex;\n}\n', 'src/app/features/a/a.component.css', { strictScope: ['src/app/features/**'] });
  assert.deepEqual(rules, ['autopilot/justified-stylesheet']);
});

test('the starter tailwind.css passes with tailwind on', async () => {
  const code = '@import "tailwindcss";\n@import "tailwindcss-primeui";\n\n@custom-variant dark (&:where(.app-dark, .app-dark *));\n\n@theme {\n  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;\n}\n';
  assert.deepEqual(await lint(code, 'src/styles/tailwind.css', { tailwind: true }), []);
});

test('justified-stylesheet: Angular 20+ file names without .component are covered; global entry stylesheets are not', async () => {
  assert.deepEqual(await lint('.x {\n  display: flex;\n}\n', 'src/app/features/user/user.scss', SCOPE), ['autopilot/justified-stylesheet']);
  const whole = { scss: true, strictScope: ['src/**'] };
  assert.ok(!(await lint('.x {\n  display: flex;\n}\n', 'src/styles.scss', whole)).includes('autopilot/justified-stylesheet'));
  assert.ok(!(await lint('.x {\n  display: flex;\n}\n', 'src/styles/tailwind.css', whole)).includes('autopilot/justified-stylesheet'));
});
