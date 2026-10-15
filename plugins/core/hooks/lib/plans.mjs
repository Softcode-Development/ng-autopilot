// Plan-file parsing shared by the workflow hooks. A plan lives at
// .claude/plans/<slug>/plan.md (WORKFLOW.md § 2); finished plans move to
// .claude/plans/archive/ and are never "active".

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const INACTIVE = new Set(['done', 'paused']);

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { fm, body: text.slice(m[0].length) };
}

// Lines of a `## <name>` section, up to the next `## ` heading.
export function sectionLines(text, name) {
  const lines = text.split(/\r?\n/);
  const heading = new RegExp(`^##\\s+${name}\\s*$`, 'i');
  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s+/.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

const CHECKBOX = /^\s*(?:[-*]|\d+\.)\s*\*{0,2}\[( |x|X)\]/;

export function checkboxes(text, section) {
  const items = sectionLines(text, section).filter((l) => CHECKBOX.test(l));
  const done = items.filter((l) => /\[(x|X)\]/.test(l));
  const open = items.filter((l) => /\[ \]/.test(l));
  return { total: items.length, done: done.length, open };
}

// Bullets (with continuation lines) under `## Out of scope` that do not name
// a destination with `→ <something>`. A lone "None" bullet is accepted.
export function outOfScopeOffenders(text) {
  const bullets = [];
  let current = null;
  for (const line of sectionLines(text, 'Out of scope')) {
    if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      if (current !== null) bullets.push(current);
      current = line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '').trim();
    } else if (/^\s+\S/.test(line) && current !== null) {
      current += ' ' + line.trim();
    } else if (!line.trim() && current !== null) {
      bullets.push(current);
      current = null;
    }
  }
  if (current !== null) bullets.push(current);
  return bullets.filter((b) => b && !/^none\b/i.test(b) && !/→\s*\S/.test(b));
}

export function readPlan(planPath) {
  const text = readFileSync(planPath, 'utf8');
  const { fm } = parseFrontmatter(text);
  const tasks = checkboxes(text, 'Tasks');
  const questions = checkboxes(text, 'Open questions');
  const nextTask = tasks.open[0]?.replace(CHECKBOX, '').replace(/^\s*\d+\.\s*/, '').trim() ?? '';
  return {
    path: planPath,
    slug: fm.slug || path.basename(path.dirname(planPath)),
    status: (fm.status || 'draft').toLowerCase(),
    mode: fm.mode || '',
    tasks: { done: tasks.done, total: tasks.total, next: nextTask },
    openQuestions: questions.open.length,
  };
}

// Every checkbox line in the file (OpenSpec tasks.md groups tasks under
// several `## N. Group` headings, so there is no single Tasks section).
export function allCheckboxes(text) {
  const items = text.split(/\r?\n/).filter((l) => CHECKBOX.test(l));
  return { total: items.length, done: items.filter((l) => /\[(x|X)\]/.test(l)).length, open: items.filter((l) => /\[ \]/.test(l)) };
}

function readIfExists(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

// An OpenSpec change folder counts as an active plan until it is archived.
// It has no draft status, so plan-ready gates it on open questions only.
export function readOpenSpecChange(changeDir) {
  const tasks = allCheckboxes(readIfExists(path.join(changeDir, 'tasks.md')));
  const questions = checkboxes(readIfExists(path.join(changeDir, 'design.md')), 'Open questions');
  const nextTask = tasks.open[0]?.replace(CHECKBOX, '').replace(/^\s*[\d.]+\s*/, '').trim() ?? '';
  return {
    path: path.join(changeDir, 'proposal.md'),
    slug: path.basename(changeDir),
    status: 'in-progress',
    mode: 'openspec',
    tasks: { done: tasks.done, total: tasks.total, next: nextTask },
    openQuestions: questions.open.length,
  };
}

function subdirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => path.join(dir, e.name));
}

export function findActivePlans(root) {
  const plans = [];
  for (const dir of subdirs(path.join(root, '.claude', 'plans'))) {
    const planPath = path.join(dir, 'plan.md');
    if (!existsSync(planPath)) continue;
    try {
      const plan = readPlan(planPath);
      if (!INACTIVE.has(plan.status)) plans.push(plan);
    } catch {
      // An unreadable plan never blocks work; session-context reports it.
    }
  }
  for (const dir of subdirs(path.join(root, 'openspec', 'changes'))) {
    if (!existsSync(path.join(dir, 'proposal.md')) && !existsSync(path.join(dir, 'tasks.md'))) continue;
    try {
      plans.push(readOpenSpecChange(dir));
    } catch {
      // Same as above.
    }
  }
  return plans;
}

// Content a Write/Edit/MultiEdit will leave on disk, so validators judge the
// result rather than the stale file.
export function postEditContent(toolName, input, currentContent) {
  if (toolName === 'Write') return input.content ?? '';
  const edits = toolName === 'MultiEdit' ? input.edits ?? [] : [input];
  let text = currentContent ?? '';
  for (const e of edits) {
    const oldStr = e.old_string ?? '';
    const newStr = e.new_string ?? '';
    if (!oldStr) {
      text = newStr;
    } else if (e.replace_all) {
      text = text.split(oldStr).join(newStr);
    } else {
      const i = text.indexOf(oldStr);
      if (i !== -1) text = text.slice(0, i) + newStr + text.slice(i + oldStr.length);
    }
  }
  return text;
}

export function lastWorklogHeading(planPath) {
  const worklog = path.join(path.dirname(planPath), 'worklog.md');
  if (!existsSync(worklog)) return '';
  const headings = readFileSync(worklog, 'utf8').split(/\r?\n/).filter((l) => /^#{2,3}\s+/.test(l));
  return headings.at(-1)?.replace(/^#{2,3}\s+/, '') ?? '';
}
