#!/usr/bin/env node
// OpenSpec git gate (husky). A commit that touches source code must belong to
// the one active change:
//   --pre-commit          the staged diff ticks at least one `[x]` row in that change's tasks.md
//   --commit-msg <file>   the message carries `Change: <slug>`
// Owner-only bypass for a trivial commit with NO active change: SKIP_TASKS_GATE="<reason>"
// plus a matching `Skip-Tasks-Gate: <reason>` trailer (checked at commit-msg). Never agent-selected.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE_GLOBS = ['src/', 'apps/', 'libs/', 'projects/'];

function git(root, args, input) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', input });
  return r.status === 0 ? r.stdout : '';
}

export function activeChanges(root) {
  const dir = path.join(root, 'openspec', 'changes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => e.name);
}

function sourcePrefixes(root) {
  try {
    const cfg = JSON.parse(readFileSync(path.join(root, '.claude', 'autopilot.json'), 'utf8'));
    const globs = cfg.sourceGlobs ?? [];
    return globs.length ? globs.map((g) => g.replace(/\*.*$/, '')) : DEFAULT_SOURCE_GLOBS;
  } catch {
    return DEFAULT_SOURCE_GLOBS;
  }
}

export function touchesSource(files, prefixes) {
  return files.some((f) => prefixes.some((p) => f.startsWith(p)));
}

function stagedFiles(root) {
  return git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMRD']).split('\n').filter(Boolean);
}

export function trailerValue(message, key) {
  const parsed = spawnSync('git', ['interpret-trailers', '--parse'], { input: message, encoding: 'utf8' }).stdout ?? '';
  const line = parsed.split('\n').find((l) => l.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  return line ? line.slice(key.length + 1).trim() : '';
}

export function checkPreCommit(root, env = process.env) {
  const files = stagedFiles(root);
  if (!touchesSource(files, sourcePrefixes(root))) return null;
  const active = activeChanges(root);
  if (active.length === 0) {
    if ((env.SKIP_TASKS_GATE ?? '').trim()) return null;
    return 'the commit touches source code but no OpenSpec change is active. Plan it first, or (owner only) set SKIP_TASKS_GATE="<reason>" with a matching Skip-Tasks-Gate trailer.';
  }
  if (active.length > 1) return `several active changes (${active.join(', ')}) — archive or remove the extras so the tick can be checked.`;
  const tasks = `openspec/changes/${active[0]}/tasks.md`;
  const ticked = git(root, ['diff', '--cached', '--', tasks]).split('\n').some((l) => /^\+\s*(?:[-*]|\d+\.)\s*\**\[x\]/i.test(l));
  return ticked ? null : `the staged diff touches source code but ticks no task in ${tasks}. Stage the [x] tick with the code.`;
}

export function checkCommitMsg(root, message, env = process.env) {
  const files = stagedFiles(root);
  if (!touchesSource(files, sourcePrefixes(root))) return null;
  const reason = (env.SKIP_TASKS_GATE ?? '').trim();
  if (reason) {
    const trailer = trailerValue(message, 'Skip-Tasks-Gate');
    if (!trailer) return 'SKIP_TASKS_GATE is set but the message has no `Skip-Tasks-Gate: <reason>` trailer — the trailer is the audit record.';
    if (trailer !== reason) return `the Skip-Tasks-Gate trailer [${trailer}] must equal SKIP_TASKS_GATE [${reason}].`;
    return null;
  }
  const active = activeChanges(root);
  if (active.length === 1 && !new RegExp(`^Change:\\s*${active[0]}\\s*$`, 'm').test(message)) {
    return `commits touching source code carry a body line \`Change: ${active[0]}\`.`;
  }
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim() || process.cwd();
  const [mode, file] = process.argv.slice(2);
  const problem = mode === '--commit-msg'
    ? checkCommitMsg(root, readFileSync(file, 'utf8'))
    : checkPreCommit(root);
  if (problem) {
    console.error(`[hook:openspec-tasks-gate] BLOCKED: ${problem}`);
    process.exit(1);
  }
}
