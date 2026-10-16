// Runs the hook scripts as real processes with the envelope Claude Code
// sends, so stdin parsing, CLAUDE_PROJECT_DIR handling and exit codes are
// covered — not only the pure evaluate functions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = mkdtempSync(path.join(tmpdir(), 'golden-hooks-'));
mkdirSync(path.join(project, '.claude'), { recursive: true });
writeFileSync(path.join(project, '.claude', 'golden.json'), JSON.stringify({
  protectedPaths: [{ glob: 'prisma/schema.prisma', flag: 'db-migrator-active', reason: 'owned by the db-migrator agent' }],
}));

function runHook(script, envelope, projectDir = project) {
  const r = spawnSync(process.execPath, [path.join(hooksDir, script)], {
    input: typeof envelope === 'string' ? envelope : JSON.stringify(envelope),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    cwd: tmpdir(),
    encoding: 'utf8',
  });
  return { code: r.status, stderr: r.stderr };
}

const edit = (filePath) => ({ tool_name: 'Edit', tool_input: { file_path: filePath } });
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });

test.after(() => rmSync(project, { recursive: true, force: true }));

test('guard-paths blocks an absolute path into synced rules (exit 2, stderr names the hook)', () => {
  const r = runHook('guard-paths.mjs', edit(path.join(project, '.claude', 'rules', 'golden', 'x.md')));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /^\[hook:guard-paths\] BLOCKED: \.claude\/rules\/golden\/x\.md/);
});

test('guard-paths reads project protectedPaths from golden.json', () => {
  assert.equal(runHook('guard-paths.mjs', edit(path.join(project, 'prisma', 'schema.prisma'))).code, 2);
  assert.equal(runHook('guard-paths.mjs', edit(path.join(project, 'src', 'main.ts'))).code, 0);
});

test('guard-paths honours a flag file', () => {
  mkdirSync(path.join(project, '.claude', '.flags'), { recursive: true });
  writeFileSync(path.join(project, '.claude', '.flags', 'db-migrator-active'), '');
  try {
    assert.equal(runHook('guard-paths.mjs', edit(path.join(project, 'prisma', 'schema.prisma'))).code, 0);
  } finally {
    rmSync(path.join(project, '.claude', '.flags'), { recursive: true, force: true });
  }
});

test('guard-paths covers NotebookEdit (notebook_path)', () => {
  const r = runHook('guard-paths.mjs', { tool_name: 'NotebookEdit', tool_input: { notebook_path: '.claude/rules/golden/n.ipynb' } });
  assert.equal(r.code, 2);
});

test('Git Bash style CLAUDE_PROJECT_DIR (/c/...) resolves on Windows', { skip: process.platform !== 'win32' }, () => {
  const msys = '/' + project[0].toLowerCase() + project.slice(2).replace(/\\/g, '/');
  const r = runHook('guard-paths.mjs', edit(path.join(project, '.claude', 'rules', 'golden', 'x.md')), msys);
  assert.equal(r.code, 2);
});

test('guard-bash exit codes', () => {
  assert.equal(runHook('guard-bash.mjs', bash('git push -f')).code, 2);
  assert.equal(runHook('guard-bash.mjs', bash('git status')).code, 0);
});

function writePlan(slug, frontmatterStatus, openQuestion) {
  const dir = path.join(project, '.claude', 'plans', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'plan.md'), [
    '---', `slug: ${slug}`, `status: ${frontmatterStatus}`, '---', '',
    '## Out of scope', '', '- CSV export → backlog: orders-export', '',
    '## Open questions', '', openQuestion ? '- [ ] Q: default sort?' : '- [x] Q: default sort? → A: newest', '',
    '## Tasks', '', '- [x] 1. service', '- [ ] 2. list page', '',
  ].join('\n'));
  writeFileSync(path.join(dir, 'worklog.md'), '# Worklog\n\n## Slice 1 — service (2026-10-15)\n');
  return dir;
}

test('plan-ready blocks a source edit while the plan has an open question, allows once answered', () => {
  const dir = writePlan('orders-list', 'approved', true);
  try {
    const src = edit(path.join(project, 'src', 'app', 'orders.ts'));
    const blocked = runHook('plan-ready.mjs', src);
    assert.equal(blocked.code, 2);
    assert.match(blocked.stderr, /orders-list: 1 open question/);
    writePlan('orders-list', 'approved', false);
    assert.equal(runHook('plan-ready.mjs', src).code, 0);
    writePlan('orders-list', 'paused', true);
    assert.equal(runHook('plan-ready.mjs', src).code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('out-of-scope validates the post-edit plan content', () => {
  const dir = writePlan('orders-list', 'approved', false);
  try {
    const planPath = path.join(dir, 'plan.md');
    const drop = { tool_name: 'Edit', tool_input: { file_path: planPath, old_string: '- CSV export → backlog: orders-export', new_string: '- CSV export' } };
    assert.equal(runHook('out-of-scope.mjs', drop).code, 2);
    const keep = { tool_name: 'Edit', tool_input: { file_path: planPath, old_string: 'orders-export', new_string: 'orders-csv' } };
    assert.equal(runHook('out-of-scope.mjs', keep).code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('session-context prints the active plan from a real project folder', () => {
  const dir = writePlan('orders-list', 'in-progress', false);
  try {
    const r = spawnSync(process.execPath, [path.join(hooksDir, 'session-context.mjs')], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: project }, encoding: 'utf8',
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /active plan: orders-list \(in-progress\) · tasks 1\/2 · next task: list page · last worklog: Slice 1 — service/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an OpenSpec change gates source edits on design.md open questions and shows in session context', () => {
  const dir = path.join(project, 'openspec', 'changes', 'add-export');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'proposal.md'), '## Why\n\nExport.\n');
  writeFileSync(path.join(dir, 'tasks.md'), '## 1. Service\n- [x] 1.1 endpoint\n- [ ] 1.2 client\n');
  writeFileSync(path.join(dir, 'design.md'), '## Open questions\n\n- [ ] Q: CSV or XLSX?\n');
  mkdirSync(path.join(project, 'openspec', 'changes', 'archive', 'old'), { recursive: true });
  try {
    const src = edit(path.join(project, 'src', 'app', 'export.ts'));
    const blocked = runHook('plan-ready.mjs', src);
    assert.equal(blocked.code, 2);
    assert.match(blocked.stderr, /add-export: 1 open question/);
    writeFileSync(path.join(dir, 'design.md'), '## Open questions\n\n- [x] Q: CSV or XLSX? → A: CSV\n');
    assert.equal(runHook('plan-ready.mjs', src).code, 0);
    const ctx = spawnSync(process.execPath, [path.join(hooksDir, 'session-context.mjs')], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: project }, encoding: 'utf8',
    });
    assert.match(ctx.stdout, /active plan: add-export \(in-progress, openspec\) · tasks 1\/2 · next task: client/);
    assert.doesNotMatch(ctx.stdout, /active plan: old/);
  } finally {
    rmSync(path.join(project, 'openspec'), { recursive: true, force: true });
  }
});

test('fence: the real hook refuses edits to the golden repo from another project, allows them inside it', () => {
  const goldenRoot = path.resolve(hooksDir, '..', '..', '..');
  const target = path.join(goldenRoot, 'plugins', 'core', 'rules', 'work-modes.md');
  const fromProject = runHook('guard-paths.mjs', edit(target));
  assert.equal(fromProject.code, 2);
  assert.match(fromProject.stderr, /golden workspace repo/);
  assert.equal(runHook('guard-paths.mjs', edit(target), goldenRoot).code, 0);
  assert.equal(runHook('guard-bash.mjs', bash(`rm "${target.replace(/\\/g, '/')}"`)).code, 2);
});

test('hooks allow on empty or malformed input instead of crashing', () => {
  for (const script of ['guard-bash.mjs', 'guard-paths.mjs', 'plan-ready.mjs', 'out-of-scope.mjs']) {
    assert.equal(runHook(script, '').code, 0, `${script} empty`);
    assert.equal(runHook(script, 'not json').code, 0, `${script} malformed`);
  }
});
