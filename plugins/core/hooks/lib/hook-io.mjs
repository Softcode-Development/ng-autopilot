// Shared I/O for the core hooks. One Node process per hook call: read the
// hook envelope from stdin, decide, print `[hook:<name>] …` to stderr, exit
// 0 (allow) or 2 (block — Claude Code shows stderr to the model).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export function readEnvelope() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function projectRoot() {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR ? fromMsysPath(process.env.CLAUDE_PROJECT_DIR) : '';
  return toPosix(fromEnv && existsSync(fromEnv) ? fromEnv : process.cwd());
}

export function toPosix(p) {
  return p.replace(/\\/g, '/');
}

// Git Bash spells `C:\x` as `/c/x`; Node on Windows cannot resolve that form.
export function fromMsysPath(p, platform = process.platform) {
  const m = platform === 'win32' && /^\/([a-zA-Z])(\/.*|$)/.exec(p);
  return m ? `${m[1].toUpperCase()}:${m[2] || '/'}` : p;
}

// Repo-relative, forward-slash path; `.`/`..` collapsed. Paths outside the
// repo come back absolute so they never match a repo-relative glob.
export function canonicalisePath(input, root) {
  if (!input) return '';
  input = fromMsysPath(input);
  root = fromMsysPath(root);
  const abs = toPosix(path.isAbsolute(input) ? path.normalize(input) : path.resolve(root, input));
  const r = toPosix(root).replace(/\/$/, '');
  const sameCase = process.platform === 'win32' ? (s) => s.toLowerCase() : (s) => s;
  if (sameCase(abs) === sameCase(r)) return '.';
  if (sameCase(abs).startsWith(sameCase(r) + '/')) return abs.slice(r.length + 1);
  return abs;
}

// `**` crosses folders, `*` stays inside one segment.
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if ('\\^$+?.()|{}[]'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

// Project config written by sync: .claude/golden.json.
export function loadGoldenConfig(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, '.claude', 'golden.json'), 'utf8'));
  } catch {
    return {};
  }
}

// Protected paths: synced golden rules are always protected; projects add
// their own in golden.json. A flow that may edit one creates the flag file
// `.claude/.flags/<flag>` before its first write and removes it after.
export const BUILT_IN_PROTECTED = [
  {
    glob: '.claude/rules/golden/**',
    flag: 'golden-sync',
    reason: 'synced from the golden repo — change the rule there and re-sync',
  },
  {
    glob: 'CLAUDE.md',
    flag: 'golden-sync',
    reason: 'generated index — project-specific rules go in .claude/rules/project.md',
  },
  {
    glob: 'tools/golden/**',
    flag: 'golden-sync',
    reason: 'golden tooling synced from the golden repo — change it there and re-sync; project additions go in the project\'s own config files',
  },
];

export function protectedPaths(config) {
  return [...BUILT_IN_PROTECTED, ...(Array.isArray(config.protectedPaths) ? config.protectedPaths : [])];
}

export function flagIsSet(root, flag) {
  return existsSync(path.join(root, '.claude', '.flags', flag));
}

export function finish(name, verdict) {
  if (verdict.blocked) {
    process.stderr.write(`[hook:${name}] BLOCKED: ${verdict.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}
