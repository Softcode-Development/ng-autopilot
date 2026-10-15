// PreToolUse(Write|Edit): block edits to protected paths unless the owning
// flow has set its flag file. Synced golden rules are always protected.

import { fileURLToPath } from 'node:url';
import {
  readEnvelope, projectRoot, loadGoldenConfig, protectedPaths, flagIsSet, globToRegExp,
  canonicalisePath, finish,
} from './lib/hook-io.mjs';

const NAME = 'guard-paths';

export function evaluatePath(filePath, { root = '.', config = {}, isFlagSet = () => false } = {}) {
  if (!filePath) return { blocked: false };
  const rel = canonicalisePath(filePath, root);
  for (const p of protectedPaths(config)) {
    if (globToRegExp(p.glob).test(rel) && !isFlagSet(p.flag)) {
      return { blocked: true, reason: `${rel} is protected: ${p.reason}. (Flag: .claude/.flags/${p.flag})` };
    }
  }
  return { blocked: false };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envelope = readEnvelope();
  const root = projectRoot();
  const input = envelope?.tool_input ?? {};
  finish(NAME, evaluatePath(input.file_path ?? input.notebook_path ?? '', {
    root,
    config: loadGoldenConfig(root),
    isFlagSet: (flag) => flagIsSet(root, flag),
  }));
}
