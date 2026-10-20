#!/usr/bin/env node
// Leftovers of agent sessions for one project: what Claude Code and the agents
// wrote outside the repo, plus the repo's git-ignored run output.
//
//   node bin/cleanup.mjs <project-dir> [--path <p>]... [--skip <p>]...            list, with sizes
//   node bin/cleanup.mjs <project-dir> [--path <p>]... [--skip <p>]... --delete   delete what the list shows
//
// Found by itself: the session scratch folders under <tmp>/claude/<project-slug>/,
// the tool-result dumps under ~/.claude/projects/<project-slug>/<session>/tool-results/,
// and <project>/.claude/tmp/. Session transcripts and auto-memory are never touched.
// --path adds anything else the driver knows an agent wrote (a gate-output folder,
// a spike copy, screenshots); --skip keeps an item the owner wants to keep.

import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Claude Code names a project's folders after its path: every character other
// than a letter or digit becomes '-' (c:\apps\shop → c--apps-shop).
export const projectSlug = (projectRoot) => path.resolve(projectRoot).replace(/[^A-Za-z0-9]/g, '-');

const sameCase = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
const norm = (p) => sameCase(path.resolve(p)).replace(/[\\/]+$/, '');
const isInside = (child, parent) => norm(child) === norm(parent) || norm(child).startsWith(norm(parent) + path.sep);

// A folder whose name is the project slug, matched without regard to case
// (the drive letter's case differs between tools on Windows).
function slugDir(parent, slug) {
  if (!existsSync(parent)) return null;
  const hit = readdirSync(parent).find((name) => name.toLowerCase() === slug.toLowerCase());
  return hit ? path.join(parent, hit) : null;
}

const dirs = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name)) : []);

export function sizeOf(p) {
  const st = lstatSync(p);
  if (!st.isDirectory()) return st.size;
  return readdirSync(p).reduce((sum, name) => sum + sizeOf(path.join(p, name)), 0);
}

// Why a path given with --path must not be deleted, or null.
export function refusal(target, { projectRoot, home }) {
  const p = path.resolve(target);
  if (path.dirname(p) === p) return 'a filesystem root';
  if (isInside(home, p)) return 'the home folder or one above it';
  if (isInside(projectRoot, p)) return 'the project or a folder above it';
  if (isInside(p, projectRoot)) return 'inside the project — the repo\'s files are git\'s business (run output goes in .claude/tmp/, which is listed by itself)';
  if (isInside(p, path.join(home, '.claude')) && !/[\\/]tool-results([\\/]|$)/.test(p)) return 'Claude Code\'s own folder (settings, transcripts, memory)';
  return null;
}

export function candidates(projectRoot, { extra = [], skip = [], tmp = tmpdir(), home = homedir() } = {}) {
  const slug = projectSlug(projectRoot);
  const items = [];
  const refused = [];
  const missing = [];
  const add = (p, what) => {
    if (!skip.some((s) => norm(s) === norm(p)) && !items.some((i) => norm(i.path) === norm(p))) items.push({ path: p, what, bytes: sizeOf(p) });
  };

  const sessionTmp = slugDir(path.join(tmp, 'claude'), slug);
  for (const d of sessionTmp ? dirs(sessionTmp) : []) add(d, 'session scratch (scratchpad, task output)');
  const projectHome = slugDir(path.join(home, '.claude', 'projects'), slug);
  for (const d of projectHome ? dirs(projectHome) : []) {
    const results = path.join(d, 'tool-results');
    if (existsSync(results)) add(results, 'tool-result dumps');
  }
  const runOutput = path.join(projectRoot, '.claude', 'tmp');
  if (existsSync(runOutput) && readdirSync(runOutput).length) add(runOutput, 'run output in the repo (git-ignored)');

  for (const e of extra) {
    const why = refusal(e, { projectRoot, home });
    if (why) refused.push({ path: path.resolve(e), why });
    else if (!existsSync(e)) missing.push(path.resolve(e));
    else add(path.resolve(e), 'named by the driver');
  }
  return { items, refused, missing };
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  for (; v >= 1024 && i < units.length - 1; i++) v /= 1024;
  return `${v.toFixed(1)} ${units[i]}`;
}

function parseArgs(argv) {
  const out = { root: null, extra: [], skip: [], del: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--delete') out.del = true;
    else if (a === '--path') out.extra.push(argv[++i]);
    else if (a === '--skip') out.skip.push(argv[++i]);
    else if (!out.root) out.root = a;
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.root) {
    console.error('usage: node bin/cleanup.mjs <project-dir> [--path <p>]... [--skip <p>]... [--delete]');
    process.exit(2);
  }
  const root = path.resolve(args.root);
  const { items, refused, missing } = candidates(root, { extra: args.extra, skip: args.skip });
  for (const r of refused) console.log(`refused  ${r.path} — ${r.why}`);
  for (const m of missing) console.log(`missing  ${m}`);
  if (!items.length) {
    console.log('Nothing to clean up.');
    process.exit(refused.length ? 1 : 0);
  }
  const width = Math.max(...items.map((i) => formatBytes(i.bytes).length));
  for (const i of items) console.log(`${args.del ? 'deleted  ' : ''}${formatBytes(i.bytes).padStart(width)}  ${i.path}  — ${i.what}`);
  const total = items.reduce((s, i) => s + i.bytes, 0);
  if (args.del) {
    for (const i of items) rmSync(i.path, { recursive: true, force: true });
    console.log(`\nFreed ${formatBytes(total)} in ${items.length} item(s).`);
  } else {
    console.log(`\n${items.length} item(s), ${formatBytes(total)}. Delete them with the same command plus --delete (--skip <path> keeps one).`);
  }
  process.exit(refused.length ? 1 : 0);
}
