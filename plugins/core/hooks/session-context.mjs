// SessionStart: print where things stand, so a fresh session resumes without
// re-reading everything. Stdout goes into the model's context. Never blocks.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectRoot, loadGoldenConfig } from './lib/hook-io.mjs';
import { findActivePlans, lastWorklogHeading } from './lib/plans.mjs';

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

export function describeContext({ branch, lastCommit, dirty, config, plans, lastEntry = () => '' }) {
  const lines = [];
  lines.push(`[context] branch: ${branch || '(unknown)'} · last commit: ${lastCommit || '(none)'} · uncommitted files: ${dirty}`);
  const packs = Array.isArray(config.packs) ? config.packs.join(', ') : '(no .claude/golden.json)';
  const tiers = Array.isArray(config.testTiers) && config.testTiers.length ? config.testTiers.join(', ') : 'none declared';
  lines.push(`[context] packs: ${packs} · planning: ${config.planning || 'plan-file'} · test tiers: ${tiers} · default mode: balanced`);
  if (plans.length === 0) {
    lines.push('[context] active plan: none — deliver changes with /deliver');
  }
  for (const p of plans) {
    const parts = [`${p.slug} (${p.status}${p.mode ? `, ${p.mode}` : ''})`, `tasks ${p.tasks.done}/${p.tasks.total}`];
    if (p.openQuestions > 0) parts.push(`${p.openQuestions} open question(s)`);
    if (p.tasks.next) parts.push(`next task: ${p.tasks.next}`);
    const entry = lastEntry(p);
    if (entry) parts.push(`last worklog: ${entry}`);
    lines.push(`[context] active plan: ${parts.join(' · ')}`);
  }
  if (plans.length > 0) lines.push('[context] resume with /deliver');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = projectRoot();
  const status = git(root, ['status', '--porcelain']);
  process.stdout.write(describeContext({
    branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    lastCommit: git(root, ['log', '-1', '--pretty=format:%h %s']),
    dirty: status ? status.split('\n').length : 0,
    config: loadGoldenConfig(root),
    plans: findActivePlans(root),
    lastEntry: (p) => lastWorklogHeading(p.path),
  }) + '\n');
  process.exit(0);
}
