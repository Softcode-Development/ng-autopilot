import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { brokenLinks, linksIn } from '../links.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'links.mjs');
let root;
const write = (rel, text) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
};

before(() => {
  root = mkdtempSync(path.join(tmpdir(), 'autopilot-links-'));
  write('docs/upgrade/reviews/pr-12.md', '# Review');
  write('docs/upgrade/plan.md', [
    '# Upgrade',
    'Gate evidence: [review](reviews/pr-12.md#verdict) and [old review](../../.claude/reviews/pr-13.md).',
  ].join('\n'));
});
after(() => rmSync(root, { recursive: true, force: true }));

test('one good and one broken link: only the broken one is reported', () => {
  assert.deepEqual(brokenLinks(root), [{ file: 'docs/upgrade/plan.md', target: '../../.claude/reviews/pr-13.md' }]);
});

test('external links, anchors, code and placeholders are not checked', () => {
  const text = [
    '[site](https://example.com) [mail](mailto:a@b.c) [top](#top)',
    '`[code](missing.md)`',
    '```',
    '[fenced](missing.md)',
    '```',
    '<!-- [comment](missing.md) -->',
    '[fill](docs/{name}.md)',
    '[ok](GETTING_STARTED.md "title")',
    '[ref]: ./ARCHITECTURE.md',
  ].join('\n');
  assert.deepEqual(linksIn(text).sort(), ['./ARCHITECTURE.md', 'GETTING_STARTED.md']);
});

test('README, project rules, gates and overrides are checked; repo-root links resolve from the project', () => {
  write('README.md', '[docs](docs/upgrade/plan.md) [abs](/docs/missing.md)');
  write('.claude/rules/project.md', '[gates](../gates.md)');
  write('.claude/unit-testing/overrides.md', '[toolkit](../../src/testing/README.md)');
  const files = brokenLinks(root).map((b) => `${b.file} → ${b.target}`);
  assert.ok(files.includes('README.md → /docs/missing.md'));
  assert.ok(files.includes('.claude/rules/project.md → ../gates.md'));
  assert.ok(files.includes('.claude/unit-testing/overrides.md → ../../src/testing/README.md'));
  assert.ok(!files.some((f) => f.startsWith('README.md → docs/')));
});

test('the CLI exits 1 and names each broken link', () => {
  const r = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /broken link {2}docs\/upgrade\/plan\.md → \.\.\/\.\.\/\.claude\/reviews\/pr-13\.md/);
});
