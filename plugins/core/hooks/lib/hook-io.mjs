// Shared I/O for the core hooks. One Node process per hook call: read the
// hook envelope from stdin, decide, print `[hook:<name>] …` to stderr, exit
// 0 (allow) or 2 (block — Claude Code shows stderr to the model).

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  root = path.resolve(fromMsysPath(root));
  const abs = toPosix(path.isAbsolute(input) ? path.normalize(input) : path.resolve(root, input));
  const r = toPosix(root).replace(/\/$/, '');
  const sameCase = process.platform === 'win32' ? (s) => s.toLowerCase() : (s) => s;
  if (sameCase(abs) === sameCase(r)) return '.';
  if (sameCase(abs).startsWith(sameCase(r) + '/')) return abs.slice(r.length + 1);
  return abs;
}

// `**` crosses folders, `*` stays inside one segment, `{a,b}` alternates.
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '{') {
      const end = glob.indexOf('}', i);
      re += `(?:${glob.slice(i + 1, end).split(',').map((alt) => alt.replace(/[\\^$+?.()|[\]]/g, '\\$&')).join('|')})`;
      i = end;
    } else if (c === '*') {
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

// Project config written by sync: .claude/autopilot.json.
export function loadAutopilotConfig(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, '.claude', 'autopilot.json'), 'utf8'));
  } catch {
    return {};
  }
}

// Protected paths: synced autopilot rules are always protected; projects add
// their own in autopilot.json. A flow that may edit one creates the flag file
// `.claude/.flags/<flag>` before its first write and removes it after.
export const BUILT_IN_PROTECTED = [
  {
    glob: '.claude/rules/autopilot/**',
    flag: 'autopilot-sync',
    reason: 'synced from the autopilot repo — change the rule there and re-sync',
  },
  {
    glob: 'CLAUDE.md',
    flag: 'autopilot-sync',
    reason: 'generated index — project-specific rules go in .claude/rules/project.md',
  },
  {
    glob: '.husky/{pre-commit,commit-msg,pre-push}',
    flag: 'autopilot-sync',
    reason: 'generated git hooks — project steps go in .husky/pre-commit.local',
  },
  {
    glob: '.claude/autopilot{.json,.lock.json}',
    flag: 'autopilot-sync',
    reason: 'install answers and generated-file fingerprints — change them through /autopilot:install or sync',
  },
  {
    glob: 'tools/autopilot/**',
    flag: 'autopilot-sync',
    reason: 'autopilot tooling synced from the autopilot repo — change it there and re-sync; project additions go in the project\'s own config files',
  },
];

// The plugins are enabled at user level (so /autopilot:install exists everywhere),
// so these hooks run in every project. Only an installed project — an
// autopilot.json with packs — gets them; any other project is left alone.
export const isInstalled = (config) => Array.isArray(config?.packs);

export function installedConfigOrExit(root) {
  const config = loadAutopilotConfig(root);
  if (!isInstalled(config)) process.exit(0);
  return config;
}

const OPENSPEC_PROTECTED = {
  glob: 'openspec/specs/**',
  flag: 'openspec-archive',
  reason: 'promoted specs — only the openspec archive flow edits them',
};

export function protectedPaths(config) {
  return [
    ...(isInstalled(config) ? BUILT_IN_PROTECTED : []),
    ...(isInstalled(config) && config.packs.includes('openspec') ? [OPENSPEC_PROTECTED] : []),
    ...(Array.isArray(config?.protectedPaths) ? config.protectedPaths : []),
  ];
}

const sameCase = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
const isInside = (child, parent) => {
  const c = sameCase(toPosix(child)).replace(/\/$/, '');
  const p = sameCase(toPosix(parent)).replace(/\/$/, '');
  return c === p || c.startsWith(p + '/');
};

// The autopilot repo and the installed plugin copy these hooks run from.
// Agents in other projects must not edit either: autopilot changes happen in a
// session opened in the autopilot repo itself. Claude Code installs plugins as
// cached copies, so the repo is found through its marketplace record.
export function autopilotFence() {
  const fences = new Set();
  const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  fences.add(toPosix(pluginRoot));
  for (let d = pluginRoot; path.dirname(d) !== d; d = path.dirname(d)) {
    if (existsSync(path.join(d, '.claude-plugin', 'marketplace.json'))) {
      fences.add(toPosix(d));
      break;
    }
  }
  try {
    const known = JSON.parse(readFileSync(path.join(homedir(), '.claude', 'plugins', 'known_marketplaces.json'), 'utf8'));
    const location = known['ng-autopilot']?.installLocation;
    if (location) fences.add(toPosix(location));
  } catch {
    // no marketplace record: the plugin is not installed through Claude Code
  }
  return [...fences];
}

export function fenceBlocks(absPath, root, fence) {
  const fences = (Array.isArray(fence) ? fence : [fence]).filter(Boolean);
  if (!fences.length || !path.isAbsolute(fromMsysPath(absPath))) return false;
  const projectRoot = fromMsysPath(root);
  // A session opened in the autopilot repo (or around a fenced folder) may edit it.
  if (fences.some((f) => isInside(projectRoot, f) || isInside(f, projectRoot))) return false;
  return fences.some((f) => isInside(fromMsysPath(absPath), f));
}

export const FENCE_REASON = 'is inside the ng-autopilot workspace repo — change autopilot rules, agents and tooling in a session opened in that repo, never from a project.';

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
