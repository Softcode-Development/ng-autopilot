import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFrontmatter, checkboxes, outOfScopeOffenders, postEditContent,
} from '../lib/plans.mjs';
import { evaluatePlanReady } from '../plan-ready.mjs';
import { evaluateOutOfScope } from '../out-of-scope.mjs';
import { describeContext } from '../session-context.mjs';

const PLAN = `---
slug: orders-list
status: approved
mode: balanced
---

# Orders list

## In scope

- List page

## Out of scope

- CSV export → FEATURES.md orders-export
- Bulk delete → not doing: no user need yet
- None

## Open questions

- [x] Q: default sort? → A: newest first (2026-10-15)
1. **[x]** Q: page size? → A: 25

## Tasks

- [x] 1. data-access service
- [ ] 2. list page
- [ ] 3. edit dialog
`;

const root = process.platform === 'win32' ? 'C:/repo' : '/repo';
const plan = (over = {}) => ({ slug: 'orders-list', status: 'approved', openQuestions: 0, tasks: { done: 1, total: 3, next: 'list page' }, ...over });

test('frontmatter and checkbox sections parse (bulleted and numbered/bold styles)', () => {
  assert.equal(parseFrontmatter(PLAN).fm.status, 'approved');
  const tasks = checkboxes(PLAN, 'Tasks');
  assert.deepEqual([tasks.done, tasks.total], [1, 3]);
  assert.equal(checkboxes(PLAN, 'Open questions').open.length, 0);
  assert.equal(checkboxes(PLAN.replace('- [x] Q: default', '- [ ] Q: default'), 'Open questions').open.length, 1);
});

test('out-of-scope: destinations and "None" accepted, bare bullets flagged, continuation lines joined', () => {
  assert.deepEqual(outOfScopeOffenders(PLAN), []);
  const bad = PLAN.replace('- None', '- Dark mode support\n  for the dialog');
  assert.deepEqual(outOfScopeOffenders(bad), ['Dark mode support for the dialog']);
  const continued = PLAN.replace('- None', '- Dark mode\n  → plan theme-pass');
  assert.deepEqual(outOfScopeOffenders(continued), []);
  assert.deepEqual(outOfScopeOffenders('# no section'), []);
});

test('postEditContent: Write, Edit, replace_all, MultiEdit', () => {
  assert.equal(postEditContent('Write', { content: 'new' }, 'old'), 'new');
  assert.equal(postEditContent('Edit', { old_string: 'a', new_string: 'b' }, 'a a'), 'b a');
  assert.equal(postEditContent('Edit', { old_string: 'a', new_string: 'b', replace_all: true }, 'a a'), 'b b');
  assert.equal(postEditContent('MultiEdit', { edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'b a', new_string: 'c' }] }, 'a a'), 'c');
  assert.equal(postEditContent('Edit', { old_string: 'zzz', new_string: 'b' }, 'a'), 'a');
});

test('plan-ready blocks source edits for a draft plan or open questions', () => {
  const opts = (plans) => ({ root, plans });
  assert.equal(evaluatePlanReady('src/app/a.ts', opts([plan({ status: 'draft' })])).blocked, true);
  assert.equal(evaluatePlanReady('src/app/a.ts', opts([plan({ openQuestions: 2 })])).blocked, true);
  assert.match(evaluatePlanReady('src/app/a.ts', opts([plan({ openQuestions: 2 })])).reason, /2 open question/);
});

test('plan-ready allows: approved plan, no plan, non-source paths, custom source globs', () => {
  assert.equal(evaluatePlanReady('src/app/a.ts', { root, plans: [plan()] }).blocked, false);
  assert.equal(evaluatePlanReady('src/app/a.ts', { root, plans: [] }).blocked, false);
  assert.equal(evaluatePlanReady('.claude/plans/x/plan.md', { root, plans: [plan({ status: 'draft' })] }).blocked, false);
  assert.equal(evaluatePlanReady('README.md', { root, plans: [plan({ status: 'draft' })] }).blocked, false);
  const config = { sourceGlobs: ['web/**'] };
  assert.equal(evaluatePlanReady('web/a.ts', { root, config, plans: [plan({ status: 'draft' })] }).blocked, true);
  assert.equal(evaluatePlanReady('src/a.ts', { root, config, plans: [plan({ status: 'draft' })] }).blocked, false);
});

test('out-of-scope hook only judges plan files (and configured docs), never the archive', () => {
  const bad = PLAN.replace('- None', '- Dark mode');
  assert.equal(evaluateOutOfScope('.claude/plans/orders-list/plan.md', bad).blocked, true);
  assert.equal(evaluateOutOfScope('.claude/plans/orders-list/plan.md', PLAN).blocked, false);
  assert.equal(evaluateOutOfScope('.claude/plans/archive/2026-10-01-x/plan.md', bad).blocked, false);
  assert.equal(evaluateOutOfScope('docs/notes.md', bad).blocked, false);
  assert.equal(evaluateOutOfScope('docs/build-plan/01.md', bad, { config: { outOfScopeDocs: ['docs/build-plan/*.md'] } }).blocked, true);
});

test('session context: no plan, then an active plan with its next step', () => {
  const base = { branch: 'feat/x', lastCommit: 'abc feat: y', dirty: 2, config: { packs: ['core', 'angular'], planning: 'plan-file' } };
  const none = describeContext({ ...base, plans: [] });
  assert.match(none, /branch: feat\/x .* uncommitted files: 2/);
  assert.match(none, /packs: core, angular/);
  assert.match(none, /active plan: none/);
  const one = describeContext({ ...base, plans: [plan({ openQuestions: 1, mode: 'balanced' })], lastEntry: () => 'Slice 1 — data-access' });
  assert.match(one, /orders-list \(approved, balanced\) · tasks 1\/3 · 1 open question\(s\) · next task: list page · last worklog: Slice 1/);
  assert.match(one, /resume with \/deliver/);
});
