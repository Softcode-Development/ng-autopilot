#!/usr/bin/env node
// Backstop for generated files: whatever path an edit took, a generated file
// whose content no longer matches its fingerprint cannot be committed.
//
//   node tools/golden/lock/verify.mjs --staged   (pre-commit) staged changes vs the staged lock
//   node tools/golden/lock/verify.mjs --all      (drift check) working tree vs the lock

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GENERATED_ROOTS, LOCK_PATH, fingerprint } from './fingerprint.mjs';

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? '' };
}

function readLock(root, fromIndex) {
  if (fromIndex) {
    const staged = git(root, ['show', `:${LOCK_PATH}`]);
    if (staged.ok) return JSON.parse(staged.out);
  }
  const file = path.join(root, LOCK_PATH);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

const isGeneratedPath = (p) => GENERATED_ROOTS.some((r) => p.startsWith(r));

export function verifyStaged(root) {
  const lock = readLock(root, true);
  if (!lock) return [];
  const problems = [];
  const changes = git(root, ['diff', '--cached', '--name-status', '--no-renames']).out.split('\n').filter(Boolean);
  for (const line of changes) {
    const [status, file] = line.split('\t');
    const locked = lock.files[file];
    if (!locked) {
      if (isGeneratedPath(file) && status !== 'D') problems.push(`${file}: new file in a generated folder — only sync adds files here`);
      continue;
    }
    if (status === 'D') {
      problems.push(`${file}: generated file deleted`);
      continue;
    }
    const staged = git(root, ['show', `:${file}`]);
    if (staged.ok && fingerprint(staged.out) !== locked) problems.push(`${file}: content differs from the synced version`);
  }
  return problems;
}

export function verifyAll(root) {
  const lock = readLock(root, false);
  if (!lock) return [`${LOCK_PATH} missing — the project has not been synced`];
  const problems = [];
  for (const [file, hash] of Object.entries(lock.files)) {
    const full = path.join(root, file);
    if (!existsSync(full)) problems.push(`${file}: generated file missing`);
    else if (fingerprint(readFileSync(full, 'utf8')) !== hash) problems.push(`${file}: content differs from the synced version`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).out.trim() || process.cwd();
  const problems = process.argv.includes('--all') ? verifyAll(root) : verifyStaged(root);
  for (const p of problems) console.error(`[golden-lock] ${p}`);
  if (problems.length) {
    console.error('[golden-lock] Generated files change only through golden sync: fix the rule in the golden repo and re-sync, or put the project-specific part in .claude/rules/project.md / the project config files.');
    process.exit(1);
  }
}
