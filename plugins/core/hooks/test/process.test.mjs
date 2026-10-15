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

test('hooks allow on empty or malformed input instead of crashing', () => {
  for (const script of ['guard-bash.mjs', 'guard-paths.mjs']) {
    assert.equal(runHook(script, '').code, 0, `${script} empty`);
    assert.equal(runHook(script, 'not json').code, 0, `${script} malformed`);
  }
});
