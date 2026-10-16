import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findAutopilotRoot } from '../../plugins/core/scripts/autopilot.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const launcher = path.join(repo, 'plugins', 'core', 'scripts', 'autopilot.mjs');

test('the launcher finds the autopilot repo from inside the plugin', () => {
  assert.equal(path.resolve(findAutopilotRoot()), repo);
});

test('the launcher forwards to doctor and passes its exit code through', () => {
  const r = spawnSync(process.execPath, [launcher, 'doctor', repo], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /autopilot\.json missing/);
});

test('unknown commands are rejected', () => {
  const r = spawnSync(process.execPath, [launcher, 'nope'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});
