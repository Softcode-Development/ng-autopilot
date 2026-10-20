import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { candidates, formatBytes, projectSlug, refusal } from '../cleanup.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'cleanup.mjs');
let base;
let project;
let tmp;
let home;
const file = (p, bytes) => {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, 'x'.repeat(bytes));
};

before(() => {
  base = mkdtempSync(path.join(tmpdir(), 'autopilot-cleanup-'));
  project = path.join(base, 'work', 'shop');
  tmp = path.join(base, 'tmp');
  home = path.join(base, 'home');
  mkdirSync(project, { recursive: true });
  const slug = projectSlug(project);
  // Claude Code's folders for this project — the slug's case may differ from the path's.
  file(path.join(tmp, 'claude', slug.toLowerCase(), 'session-a', 'scratchpad', 'notes.md'), 100);
  file(path.join(tmp, 'claude', 'other-project', 'session-z', 'scratchpad', 'keep.md'), 10);
  file(path.join(home, '.claude', 'projects', slug, 'session-a', 'tool-results', 'dump.txt'), 2048);
  file(path.join(home, '.claude', 'projects', slug, 'session-a.jsonl'), 5);
  file(path.join(home, '.claude', 'projects', slug, 'memory', 'MEMORY.md'), 5);
  file(path.join(project, '.claude', 'tmp', 'gate', 'output.log'), 50);
  file(path.join(base, 'spike-copy', 'src', 'main.ts'), 30);
});
after(() => rmSync(base, { recursive: true, force: true }));

test('the project slug follows Claude Code: every non-alphanumeric character becomes "-"', () => {
  assert.equal(projectSlug(process.platform === 'win32' ? 'C:\\apps\\ng-autopilot' : '/apps/ng-autopilot'), process.platform === 'win32' ? 'C--apps-ng-autopilot' : '-apps-ng-autopilot');
});

test('lists session scratch, tool-result dumps and the repo run output; never transcripts, memory or other projects', () => {
  const { items } = candidates(project, { tmp, home });
  const listed = items.map((i) => path.relative(base, i.path).replace(/\\/g, '/'));
  assert.equal(items.length, 3);
  assert.ok(listed.some((p) => /^tmp\/claude\/[^/]+\/session-a$/.test(p)));
  assert.ok(listed.some((p) => /^home\/\.claude\/projects\/[^/]+\/session-a\/tool-results$/.test(p)));
  assert.ok(listed.includes('work/shop/.claude/tmp'));
  assert.ok(!listed.some((p) => /jsonl|memory|other-project/.test(p)));
  assert.equal(items.find((i) => i.path.endsWith('tool-results')).bytes, 2048);
});

test('--path adds what the driver names; --skip keeps an item; unsafe or missing paths are refused or reported', () => {
  const spike = path.join(base, 'spike-copy');
  const { items, refused, missing } = candidates(project, {
    tmp, home,
    extra: [spike, path.join(base, 'gone'), project, path.join(project, 'src'), home, path.join(home, '.claude'), path.parse(base).root],
    skip: [path.join(project, '.claude', 'tmp')],
  });
  assert.ok(items.some((i) => i.path === spike && i.bytes === 30));
  assert.ok(!items.some((i) => i.path.endsWith(`${path.sep}tmp`) && i.path.startsWith(project)), 'skipped');
  assert.deepEqual(missing, [path.join(base, 'gone')]);
  assert.equal(refused.length, 5);
  assert.match(refusal(path.join(project, 'src'), { projectRoot: project, home }), /inside the project/);
  assert.match(refusal(path.join(home, '.claude', 'projects'), { projectRoot: project, home }), /Claude Code's own folder/);
});

test('sizes read like a person would say them', () => {
  assert.deepEqual([formatBytes(512), formatBytes(2048), formatBytes(5 * 1024 * 1024)], ['512 B', '2.0 KB', '5.0 MB']);
});

test('CLI: lists with sizes and changes nothing; --delete removes exactly the list', () => {
  const env = { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp, HOME: home, USERPROFILE: home };
  const run = (...args) => spawnSync(process.execPath, [script, project, ...args], { encoding: 'utf8', env });
  const spike = path.join(base, 'spike-copy');
  const list = run('--path', spike);
  assert.equal(list.status, 0);
  assert.match(list.stdout, /2\.0 KB .*tool-results {2}— tool-result dumps/);
  assert.match(list.stdout, /4 item\(s\)/);
  assert.ok(existsSync(spike));
  const del = run('--path', spike, '--delete');
  assert.equal(del.status, 0);
  assert.match(del.stdout, /Freed .* in 4 item\(s\)/);
  assert.ok(!existsSync(spike));
  assert.ok(!existsSync(path.join(project, '.claude', 'tmp')));
  assert.ok(existsSync(path.join(home, '.claude', 'projects', projectSlug(project), 'memory', 'MEMORY.md')), 'memory untouched');
  assert.ok(existsSync(path.join(tmp, 'claude', 'other-project')), 'other projects untouched');
  assert.match(run().stdout, /Nothing to clean up/);
});
