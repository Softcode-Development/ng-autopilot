import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { primengMajor, resolveArgs } from '../npx-launch.mjs';

let installed;
let declared;
let none;
before(() => {
  installed = mkdtempSync(path.join(tmpdir(), 'primeng-installed-'));
  mkdirSync(path.join(installed, 'node_modules', 'primeng'), { recursive: true });
  writeFileSync(path.join(installed, 'node_modules', 'primeng', 'package.json'), JSON.stringify({ version: '21.1.10' }));
  writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ dependencies: { primeng: '^22.0.0' } }));
  declared = mkdtempSync(path.join(tmpdir(), 'primeng-declared-'));
  writeFileSync(path.join(declared, 'package.json'), JSON.stringify({ dependencies: { primeng: '^22.1.0' } }));
  none = mkdtempSync(path.join(tmpdir(), 'primeng-none-'));
});
after(() => [installed, declared, none].forEach((d) => rmSync(d, { recursive: true, force: true })));

test('the installed PrimeNG wins over the declared range', () => {
  assert.equal(primengMajor(installed), '21');
});

test('without node_modules the package.json range decides', () => {
  assert.equal(primengMajor(declared), '22');
});

test('no PrimeNG at all: null', () => {
  assert.equal(primengMajor(none), null);
});

test('{primeng-major} in the npx args becomes the major, or latest when unknown', () => {
  const args = ['-p', '@primeng/mcp@{primeng-major}', '-p', 'zod@3.25.76', 'primeng-mcp'];
  assert.deepEqual(resolveArgs(args, installed), ['-p', '@primeng/mcp@21', '-p', 'zod@3.25.76', 'primeng-mcp']);
  assert.deepEqual(resolveArgs(args, none), ['-p', '@primeng/mcp@latest', '-p', 'zod@3.25.76', 'primeng-mcp']);
});

test('PrimeNG older than the first @primeng/mcp release (21) gets the 21 docs server, not a missing version', () => {
  const old = mkdtempSync(path.join(tmpdir(), 'primeng-old-'));
  try {
    writeFileSync(path.join(old, 'package.json'), JSON.stringify({ dependencies: { primeng: '^17.18.0' } }));
    assert.deepEqual(resolveArgs(['-p', '@primeng/mcp@{primeng-major}'], old), ['-p', '@primeng/mcp@21']);
  } finally {
    rmSync(old, { recursive: true, force: true });
  }
});
