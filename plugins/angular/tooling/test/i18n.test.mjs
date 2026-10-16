import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { flatten, params, bracesBalanced } from '../i18n/lib.mjs';
import { validate } from '../i18n/i18n-validate.mjs';
import { findUnused } from '../i18n/i18n-unused.mjs';

const root = mkdtempSync(path.join(tmpdir(), 'golden-i18n-'));
after(() => rmSync(root, { recursive: true, force: true }));
const write = (rel, data) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), typeof data === 'string' ? data : JSON.stringify(data));
};

write('.claude/golden.json', {
  i18n: {
    sets: [
      { source: 'src/assets/i18n/market-a/lt.json', locales: ['src/assets/i18n/market-a/en.json'] },
      { source: 'src/assets/i18n/market-b/pt.json', locales: ['src/assets/i18n/market-b/en.json'] },
    ],
    ignoreUnusedPrefixes: ['ENUM.'],
  },
});
write('src/assets/i18n/market-a/lt.json', { ORDERS: { TITLE: 'Užsakymai', COUNT: '{{ count }} užsakymai' }, ENUM: { A: 'A' } });
write('src/assets/i18n/market-a/en.json', { ORDERS: { TITLE: 'Orders', COUNT: '{{ total }} orders', EXTRA: 'x' } });
write('src/assets/i18n/market-b/pt.json', { ORDERS: { TITLE: 'Pedidos' } });
write('src/assets/i18n/market-b/en.json', { ORDERS: { TITLE: '' } });
write('src/app/orders.component.html', "<h1>{{ 'ORDERS.TITLE' | translate }}</h1>");

test('flatten, params and braces', () => {
  assert.deepEqual([...flatten({ a: { b: 'x', c: { d: 'y' } } }).keys()], ['a.b', 'a.c.d']);
  assert.deepEqual(params('Hi {{ name }}, {count, plural, one {# item} other {# items}}'), ['count', 'name']);
  assert.equal(bracesBalanced('{{ a }'), false);
  assert.equal(bracesBalanced('{{ a }}'), true);
});

test('validate reports missing, extra, empty and parameter mismatches per set', () => {
  const problems = validate(root);
  const has = (re) => assert.ok(problems.some((p) => re.test(p)), `missing problem ${re}\n${problems.join('\n')}`);
  has(/market-a\/en\.json: missing "ENUM\.A"/);
  has(/market-a\/en\.json: extra "ORDERS\.EXTRA"/);
  has(/market-a\/en\.json: parameters of "ORDERS\.COUNT" are \[total\], source has \[count\]/);
  has(/market-b\/en\.json: empty value for "ORDERS\.TITLE"/);
  assert.equal(problems.some((p) => p.includes('market-b/pt.json: missing')), false);
});

test('validate with staged files checks only their sets', () => {
  const problems = validate(root, ['src/assets/i18n/market-b/en.json']);
  assert.ok(problems.length > 0);
  assert.ok(problems.every((p) => p.includes('market-b/')), problems.join('\n'));
});

test('unused keys: used and ignored prefixes are not reported', () => {
  assert.deepEqual(findUnused(root), ['ORDERS.COUNT']);
});
