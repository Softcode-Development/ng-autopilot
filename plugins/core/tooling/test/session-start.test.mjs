import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installArgs, installHash, nodeDir, pinnedNode, sessionStart } from '../cloud/session-start.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'cloud', 'session-start.mjs');

function project(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'autopilot-cloud-'));
  for (const [rel, text] of Object.entries(files)) writeFileSync(path.join(root, rel), text);
  return root;
}

test('the pinned Node: .nvmrc first, then .node-version, then an exact engines.node; a range is no pin', () => {
  const cases = [
    [{ '.nvmrc': 'v24.15.0\n', 'package.json': '{"engines":{"node":"22.1.0"}}' }, '24.15.0'],
    [{ '.node-version': '22.12.0' }, '22.12.0'],
    [{ 'package.json': '{"engines":{"node":"24.15.0"}}' }, '24.15.0'],
    [{ 'package.json': '{"engines":{"node":">=24"}}', '.nvmrc': 'lts/*' }, null],
    [{}, null],
  ];
  for (const [files, expected] of cases) {
    const root = project(files);
    assert.equal(pinnedNode(root), expected, JSON.stringify(files));
    rmSync(root, { recursive: true, force: true });
  }
});

test('a version the image does not ship is downloaded next to the preinstalled ones', () => {
  assert.deepEqual(nodeDir('24.15.0', () => false), { dir: '/opt/node-v24.15.0-linux-x64', download: true });
  assert.deepEqual(nodeDir('24.15.0', (p) => p.startsWith('/opt/node-v24.15.0')), { dir: '/opt/node-v24.15.0-linux-x64', download: false });
});

test('clean install per package manager; no lockfile, a plain install', () => {
  assert.deepEqual(installArgs('npm', true), ['npm', ['ci']]);
  assert.deepEqual(installArgs('npm', false), ['npm', ['install']]);
  assert.deepEqual(installArgs('pnpm', true), ['pnpm', ['install', '--frozen-lockfile']]);
});

test('the install hash changes with the manifest, the lockfile or .npmrc', () => {
  const root = project({ 'package.json': '{}', 'package-lock.json': '{}' });
  const before = installHash(root, 'npm');
  assert.equal(installHash(root, 'npm'), before);
  writeFileSync(path.join(root, '.npmrc'), 'engine-strict=true');
  assert.notEqual(installHash(root, 'npm'), before);
  rmSync(root, { recursive: true, force: true });
});

test('outside a cloud session it does nothing and prints nothing', () => {
  const root = project({ 'package.json': '{}', '.nvmrc': '24.15.0' });
  assert.equal(sessionStart(root, { PATH: process.env.PATH }), null);
  const r = spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, CLAUDE_CODE_REMOTE: '', CLAUDE_PROJECT_DIR: root }, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.ok(!existsSync(path.join(root, '.claude')), 'no run output either');
  rmSync(root, { recursive: true, force: true });
});
