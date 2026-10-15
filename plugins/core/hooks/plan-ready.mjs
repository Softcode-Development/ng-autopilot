// PreToolUse(Write|Edit): no source edits while the active plan is still a
// draft or has an unanswered open question (WORKFLOW.md Step 2). Fast-mode
// work has no plan, so it is never blocked.

import { fileURLToPath } from 'node:url';
import {
  readEnvelope, projectRoot, loadGoldenConfig, globToRegExp, canonicalisePath, finish,
} from './lib/hook-io.mjs';
import { findActivePlans } from './lib/plans.mjs';

const NAME = 'plan-ready';
export const DEFAULT_SOURCE_GLOBS = ['src/**', 'apps/**', 'libs/**', 'projects/**'];

export function evaluatePlanReady(filePath, { root = '.', config = {}, plans = [] } = {}) {
  if (!filePath) return { blocked: false };
  const rel = canonicalisePath(filePath, root);
  const globs = Array.isArray(config.sourceGlobs) ? config.sourceGlobs : DEFAULT_SOURCE_GLOBS;
  if (!globs.some((g) => globToRegExp(g).test(rel))) return { blocked: false };

  const notReady = plans.filter((p) => p.status === 'draft' || p.openQuestions > 0);
  if (notReady.length === 0) return { blocked: false };

  const why = notReady
    .map((p) => (p.openQuestions > 0
      ? `${p.slug}: ${p.openQuestions} open question(s) unanswered`
      : `${p.slug}: status draft — awaiting owner approval`))
    .join('; ');
  return {
    blocked: true,
    reason: `source edits wait for the plan gate (${why}). Answer the questions and set status: approved — or set status: paused to step aside for an unrelated fix.`,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envelope = readEnvelope();
  const root = projectRoot();
  const input = envelope?.tool_input ?? {};
  finish(NAME, evaluatePlanReady(input.file_path ?? input.notebook_path ?? '', {
    root,
    config: loadGoldenConfig(root),
    plans: findActivePlans(root),
  }));
}
