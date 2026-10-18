import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installedVersion, resolveArgs } from '../npx-launch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
let installed;
let declared;
let none;
const pkgDir = (root, name) => path.join(root, 'node_modules', ...name.split('/'));
const install = (root, name, version) => {
  mkdirSync(pkgDir(root, name), { recursive: true });
  writeFileSync(path.join(pkgDir(root, name), 'package.json'), JSON.stringify({ name, version }));
};

before(() => {
  installed = mkdtempSync(path.join(tmpdir(), 'mcp-installed-'));
  install(installed, 'primeng', '21.1.10');
  install(installed, '@spartan-ng/brain', '1.8.3');
  writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ dependencies: { primeng: '^22.0.0' } }));
  declared = mkdtempSync(path.join(tmpdir(), 'mcp-declared-'));
  writeFileSync(path.join(declared, 'package.json'), JSON.stringify({ dependencies: { primeng: '^22.1.0', '@spartan-ng/brain': '^1.7.0' } }));
  none = mkdtempSync(path.join(tmpdir(), 'mcp-none-'));
});
after(() => [installed, declared, none].forEach((d) => rmSync(d, { recursive: true, force: true })));

// Published versions of the MCP packages, as npm would answer.
const PUBLISHED = { '@spartan-ng/mcp': ['1.7.0', '1.8.0', '1.8.1'], '@primeng/mcp': ['21.1.10', '22.1.2'] };
const view = (name) => PUBLISHED[name];

test('installed version wins over the declared range; walks up from a sub-folder; null when absent', () => {
  assert.equal(installedVersion('primeng', installed), '21.1.10');
  assert.equal(installedVersion('primeng', declared), '22.1.0');
  const sub = path.join(installed, 'apps', 'web', 'src');
  mkdirSync(sub, { recursive: true });
  assert.equal(installedVersion('@spartan-ng/brain', sub), '1.8.3');
  assert.equal(installedVersion('primeng', none), null);
});

test('{major-of:pkg}: the installed major, raised to the first published MCP major; latest when absent', () => {
  const args = ['-p', '@primeng/mcp@{major-of:primeng}', 'primeng-mcp'];
  assert.deepEqual(resolveArgs(args, installed, view), ['-p', '@primeng/mcp@21', 'primeng-mcp']);
  assert.deepEqual(resolveArgs(args, none, view), ['-p', '@primeng/mcp@latest', 'primeng-mcp']);
  const old = mkdtempSync(path.join(tmpdir(), 'mcp-old-'));
  try {
    writeFileSync(path.join(old, 'package.json'), JSON.stringify({ dependencies: { primeng: '^17.18.0' } }));
    assert.deepEqual(resolveArgs(args, old, view), ['-p', '@primeng/mcp@21', 'primeng-mcp']);
  } finally {
    rmSync(old, { recursive: true, force: true });
  }
});

test('{version-of:pkg}: the same version when published, else the newest with that major, else latest', () => {
  const args = ['-p', '@spartan-ng/mcp@{version-of:@spartan-ng/brain}', 'spartan-mcp'];
  assert.deepEqual(resolveArgs(args, installed, view), ['-p', '@spartan-ng/mcp@1.8.1', 'spartan-mcp'], '1.8.3 not published → newest 1.x');
  const exact = mkdtempSync(path.join(tmpdir(), 'mcp-exact-'));
  try {
    install(exact, '@spartan-ng/brain', '1.7.0');
    assert.deepEqual(resolveArgs(args, exact, view), ['-p', '@spartan-ng/mcp@1.7.0', 'spartan-mcp']);
  } finally {
    rmSync(exact, { recursive: true, force: true });
  }
  assert.deepEqual(resolveArgs(args, none, view), ['-p', '@spartan-ng/mcp@latest', 'spartan-mcp']);
  assert.deepEqual(resolveArgs(args, installed, () => undefined), ['-p', '@spartan-ng/mcp@latest', 'spartan-mcp'], 'registry unreachable → latest');
});

test('both packs ship the same launcher', () => {
  const primeng = readFileSync(path.join(here, '..', 'npx-launch.mjs'), 'utf8');
  const spartan = readFileSync(path.join(here, '..', '..', '..', 'spartan', 'mcp', 'npx-launch.mjs'), 'utf8');
  assert.equal(spartan, primeng);
});

test('the MCP configs use the placeholders', () => {
  const primeng = JSON.parse(readFileSync(path.join(here, '..', '..', '.mcp.json'), 'utf8'));
  const spartan = JSON.parse(readFileSync(path.join(here, '..', '..', '..', 'spartan', '.mcp.json'), 'utf8'));
  assert.ok(primeng.mcpServers.primeng.args.includes('@primeng/mcp@{major-of:primeng}'));
  assert.ok(spartan.mcpServers['spartan-ui'].args.includes('@spartan-ng/mcp@{version-of:@spartan-ng/brain}'));
});
