// PreToolUse(Write|Edit): block edits to protected paths unless the owning
// flow has set its flag file. Synced autopilot rules are always protected.

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  readEnvelope, projectRoot, installedConfigOrExit, protectedPaths, flagIsSet, globToRegExp,
  canonicalisePath, finish, fenceBlocks, autopilotFence, fromMsysPath, FENCE_REASON,
} from './lib/hook-io.mjs';

const NAME = 'guard-paths';

export function evaluatePath(filePath, { root = '.', config = {}, isFlagSet = () => false, fence = null } = {}) {
  if (!filePath) return { blocked: false };
  const absolute = path.isAbsolute(fromMsysPath(filePath)) ? filePath : path.resolve(fromMsysPath(root), filePath);
  if (fenceBlocks(absolute, root, fence)) return { blocked: true, reason: `${filePath} ${FENCE_REASON}` };
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
    config: installedConfigOrExit(root),
    isFlagSet: (flag) => flagIsSet(root, flag),
    fence: autopilotFence(),
  }));
}
