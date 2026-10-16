// PreToolUse(Write|Edit|MultiEdit): every bullet under a plan's
// `## Out of scope` names a destination (`→ <destination>`). Validates the
// content the edit will leave, not the file on disk.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readEnvelope, projectRoot, loadAutopilotConfig, globToRegExp, canonicalisePath, finish,
} from './lib/hook-io.mjs';
import { outOfScopeOffenders, postEditContent } from './lib/plans.mjs';

const NAME = 'out-of-scope';
export const DEFAULT_PLAN_GLOBS = ['.claude/plans/**/plan.md'];

export function evaluateOutOfScope(rel, content, { config = {} } = {}) {
  const globs = [
    ...DEFAULT_PLAN_GLOBS,
    ...(Array.isArray(config.packs) && config.packs.includes('openspec') ? ['openspec/changes/*/proposal.md'] : []),
    ...(Array.isArray(config.outOfScopeDocs) ? config.outOfScopeDocs : []),
  ];
  if (!rel || rel.startsWith('.claude/plans/archive/')) return { blocked: false };
  if (!globs.some((g) => globToRegExp(g).test(rel))) return { blocked: false };
  const offenders = outOfScopeOffenders(content);
  if (offenders.length === 0) return { blocked: false };
  const list = offenders.map((o) => `  - ${o.length > 160 ? o.slice(0, 159) + '…' : o}`).join('\n');
  return {
    blocked: true,
    reason: `${offenders.length} "Out of scope" bullet(s) in ${rel} have no destination:\n${list}\nEnd each with "→ <plan slug | backlog: item | not doing: reason>".`,
  };
}

function readOrEmpty(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envelope = readEnvelope();
  const root = projectRoot();
  const input = envelope?.tool_input ?? {};
  const rel = canonicalisePath(input.file_path ?? '', root);
  const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
  const content = postEditContent(envelope?.tool_name, input, readOrEmpty(abs));
  finish(NAME, evaluateOutOfScope(rel, content, { config: loadAutopilotConfig(root) }));
}
