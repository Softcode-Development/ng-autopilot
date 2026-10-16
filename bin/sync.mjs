#!/usr/bin/env node
// Autopilot sync: bring a project in line with the autopilot repo, driven by the
// project's .claude/autopilot.json (written by /autopilot:install).
//
//   node bin/sync.mjs <project-dir>             apply
//   node bin/sync.mjs <project-dir> --dry-run   show what would change
//
// Generated files are rewritten and fingerprinted (.claude/autopilot.lock.json);
// project-owned files are created once and never overwritten; settings.json is
// merged. Idempotent: a second run changes nothing.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fingerprint, LOCK_PATH } from '../plugins/core/tooling/lock/fingerprint.mjs';
import { PACKS, pluginId, renderFiles, requiredDevDependencies } from './lib/render.mjs';

export const AUTOPILOT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const union = (a = [], b = []) => [...a, ...b.filter((x) => !a.includes(x))];

export function mergeSettings(existing, autopilot, packs) {
  const merged = structuredClone(existing ?? {});
  merged.$schema ??= autopilot.$schema;
  merged.permissions ??= {};
  for (const list of ['allow', 'ask', 'deny']) merged.permissions[list] = union(merged.permissions[list], autopilot.permissions[list]);
  merged.enabledPlugins ??= {};
  for (const p of PACKS) merged.enabledPlugins[pluginId(p)] = packs.includes(p);
  return merged;
}

function autopilotCommit() {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: AUTOPILOT_ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
}

export function sync(projectRoot, { dryRun = false } = {}) {
  const configFile = path.join(projectRoot, '.claude', 'autopilot.json');
  if (!existsSync(configFile)) throw new Error(`${configFile} not found — run /autopilot:install first.`);
  const { config, files } = renderFiles(AUTOPILOT_ROOT, JSON.parse(readFileSync(configFile, 'utf8')));
  const previousLock = readJson(path.join(projectRoot, LOCK_PATH), { files: {} });
  const report = { written: [], unchanged: [], created: [], kept: [], merged: [], removed: [], conflicts: [] };
  const write = (rel, content) => {
    if (dryRun) return;
    const full = path.join(projectRoot, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  };

  const lockFiles = {};
  for (const f of files) {
    const full = path.join(projectRoot, f.path);
    if (f.kind === 'generated') {
      lockFiles[f.path] = fingerprint(f.content);
      const current = existsSync(full) ? readFileSync(full, 'utf8') : null;
      if (current !== null && fingerprint(current) === lockFiles[f.path]) {
        report.unchanged.push(f.path);
        continue;
      }
      const lockedHash = previousLock.files[f.path];
      if (current !== null && lockedHash && fingerprint(current) !== lockedHash) report.conflicts.push(`${f.path}: was hand-edited — overwritten with the autopilot version`);
      write(f.path, f.content);
      report.written.push(f.path);
    } else if (f.kind === 'once') {
      if (existsSync(full)) report.kept.push(f.path);
      else {
        write(f.path, f.content);
        report.created.push(f.path);
      }
    } else if (f.kind === 'merge') {
      const merged = mergeSettings(readJson(full, {}), f.content, config.packs);
      const text = `${JSON.stringify(merged, null, 2)}\n`;
      if (!existsSync(full) || readFileSync(full, 'utf8') !== text) {
        write(f.path, text);
        report.merged.push(f.path);
      } else report.unchanged.push(f.path);
    }
  }

  // Generated files the current packs no longer produce.
  for (const [rel, hash] of Object.entries(previousLock.files)) {
    if (lockFiles[rel]) continue;
    const full = path.join(projectRoot, rel);
    if (!existsSync(full)) continue;
    if (fingerprint(readFileSync(full, 'utf8')) !== hash) {
      report.conflicts.push(`${rel}: no longer generated but was hand-edited — left in place, remove it yourself`);
      continue;
    }
    if (!dryRun) rmSync(full);
    report.removed.push(rel);
  }

  const lock = { autopilot: { commit: autopilotCommit() }, files: Object.fromEntries(Object.entries(lockFiles).sort()) };
  const lockText = `${JSON.stringify(lock, null, 2)}\n`;
  const lockFull = path.join(projectRoot, LOCK_PATH);
  const previousLockText = existsSync(lockFull) ? readFileSync(lockFull, 'utf8') : '';
  const sameFiles = previousLockText && JSON.stringify(JSON.parse(previousLockText).files) === JSON.stringify(lock.files);
  if (!sameFiles) write(LOCK_PATH, lockText);

  const pkg = readJson(path.join(projectRoot, 'package.json'), {});
  const have = { ...pkg.dependencies, ...pkg.devDependencies };
  report.missingDevDependencies = requiredDevDependencies(config).filter((d) => !have[d]);
  report.lockChanged = !sameFiles;
  return report;
}

function print(report, dryRun) {
  const verb = dryRun ? 'would ' : '';
  const section = (title, list) => {
    if (!list.length) return;
    console.log(`\n${title} (${list.length})`);
    for (const item of list) console.log(`  ${item}`);
  };
  section(`Generated files ${verb}written`, report.written);
  section(`Project files ${verb}created`, report.created);
  section(`Merged (${verb}update)`, report.merged);
  section(`Generated files ${verb}removed`, report.removed);
  section('Project files kept (already exist — check they use the autopilot presets)', report.kept.filter((p) => /config|lintstaged|prettier|editorconfig|gitleaks/.test(p)));
  section('Conflicts', report.conflicts);
  section('devDependencies to install', report.missingDevDependencies);
  console.log(`\nUnchanged: ${report.unchanged.length}. Fingerprints ${report.lockChanged ? `${verb}updated` : 'unchanged'}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('usage: node bin/sync.mjs <project-dir> [--dry-run]');
    process.exit(2);
  }
  try {
    print(sync(path.resolve(target), { dryRun }), dryRun);
  } catch (e) {
    console.error(`[sync] ${e.message}`);
    process.exit(1);
  }
}
