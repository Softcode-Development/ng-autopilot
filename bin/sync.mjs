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
import { installCommand, installPlan } from './lib/dev-deps.mjs';
import { normaliseConfig, PACKS, pluginId, renderFiles, requiredDependencies, requiredDevDependencies } from './lib/render.mjs';

export const AUTOPILOT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);

// Entries earlier autopilot versions wrote and no longer do. They go on merge, or a
// project synced before the change keeps them: bare Edit/Write allowed writes
// anywhere on disk (now Edit(./**) / Write(./**)); ask rules prompt even in auto
// mode, and rm / git checkout prompted on harmless repo-relative operations
// (guard-bash still refuses their destructive forms).
export const RETIRED_PERMISSIONS = {
  allow: ['Edit', 'Write'],
  ask: ['Bash(rm:*)', 'Bash(git checkout:*)'],
};

// Tiers an autopilot entry used to live in before autopilot moved it. A copy found
// there is autopilot's own stale copy, not the owner's choice.
export const MOVED_PERMISSIONS = {
  'Bash(git push:*)': ['ask'],
  'Bash(gh pr create:*)': ['ask'],
};

const TIERS = ['allow', 'ask', 'deny'];

export function mergeSettings(existing, autopilot, packs) {
  const merged = structuredClone(existing ?? {});
  merged.$schema ??= autopilot.$schema;
  merged.permissions ??= {};
  const project = Object.fromEntries(TIERS.map((t) => [t, (merged.permissions[t] ?? []).filter((e) => !(RETIRED_PERMISSIONS[t] ?? []).includes(e))]));
  const result = structuredClone(project);
  const remove = (tier, e) => (result[tier] = result[tier].filter((x) => x !== e));
  const add = (tier, e) => result[tier].includes(e) || result[tier].push(e);

  for (const tier of TIERS) {
    for (const e of autopilot.permissions[tier] ?? []) {
      const others = TIERS.filter((t) => t !== tier);
      // A deny entry is a safety floor: it always applies, whatever the project says.
      if (tier === 'deny') {
        for (const t of others) remove(t, e);
        add('deny', e);
        continue;
      }
      for (const t of others.filter((o) => (MOVED_PERMISSIONS[e] ?? []).includes(o))) remove(t, e);
      // The owner put this entry in another tier (npm install in allow, say): that
      // choice stands, and the autopilot copy goes, or ask would still win over allow.
      const ownerTiers = others.filter((t) => result[t].includes(e));
      if (ownerTiers.length) remove(tier, e);
      else add(tier, e);
    }
  }
  for (const t of TIERS) merged.permissions[t] = result[t];
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
  report.missingDependencies = requiredDependencies(config).filter((d) => !have[d]);
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
  section('Project files kept (already exist — check they use the autopilot presets)', report.kept.filter((p) => /config|lintstaged|prettier|editorconfig|gitleaks|tailwind|postcss|core\/theme/.test(p)));
  section('Conflicts', report.conflicts);
  for (const [title, list, install] of [
    ['dependencies to install', report.missingDependencies, report.installs?.dependencies],
    ['devDependencies to install', report.missingDevDependencies, report.installs?.devDependencies],
  ]) {
    section(title, list);
    if (!install) continue;
    console.log(`  → ${install.command}`);
    for (const n of install.notes) console.log(`    ${n}`);
  }
  console.log(`\nUnchanged: ${report.unchanged.length}. Fingerprints ${report.lockChanged ? (dryRun ? 'would be updated' : 'updated') : 'unchanged'}.`);
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
    const root = path.resolve(target);
    const report = sync(root, { dryRun });
    const config = normaliseConfig(readJson(path.join(root, '.claude', 'autopilot.json'), {}));
    const pkg = readJson(path.join(root, 'package.json'), {});
    report.installs = {};
    if (report.missingDependencies.length || report.missingDevDependencies.length) {
      const plan = installPlan(report.missingDependencies, report.missingDevDependencies, pkg);
      for (const [kind, dev] of [['dependencies', false], ['devDependencies', true]]) {
        if (plan[kind].specs.length) report.installs[kind] = { command: installCommand(plan[kind].specs, config.packageManager, { dev }), notes: plan[kind].notes };
      }
    }
    print(report, dryRun);
  } catch (e) {
    console.error(`[sync] ${e.message}`);
    process.exit(1);
  }
}
