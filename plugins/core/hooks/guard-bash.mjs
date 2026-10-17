// PreToolUse(Bash): block destructive or rule-breaking shell commands.
// Settings deny-lists match command prefixes only; this hook closes the
// side channels (secret reads via cat/grep, redirect writes into protected
// paths, force pushes spelled as `+branch`, pushes to a trunk branch).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  readEnvelope, projectRoot, loadAutopilotConfig, protectedPaths, flagIsSet, globToRegExp, finish,
  canonicalisePath, fenceBlocks, autopilotFence, FENCE_REASON,
} from './lib/hook-io.mjs';
import { writeTargets } from './lib/shell-writes.mjs';

const NAME = 'guard-bash';

const READ_VERBS = '(?:cat|head|tail|less|more|nl|od|xxd|hexdump|strings|awk|sed|grep|rg|bat|type)';
const ENV_FILE = /(?:^|[\s/\\'"=])\.env(?:\.([\w.-]+))?(?=$|[\s'";|&)])/g;
const SAFE_ENV_SUFFIXES = new Set(['example', 'sample', 'template', 'dist', 'defaults']);
const SECRET_FILE = /(?:^|[\s/\\'"])(?:secrets[/\\]|[\w.-]+\.(?:pem|key|p12|pfx)(?=$|[\s'";|&)]))/;

const RULES = [
  {
    test: (c) => c.includes('--no-verify'),
    reason: '--no-verify is banned. Fix the underlying hook failure instead of skipping it.',
  },
  {
    test: (c) => /\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*\s+(?:--\s+)?(?:\/|[A-Za-z]:[\\/])/.test(c),
    reason: 'rm against an absolute path refused. Agents work in repo-relative paths only.',
  },
  {
    test: (c) => /\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*\s+(?:--\s+)?(?:~|\$HOME|\$\{HOME\})(?:[\s/]|$)/.test(c),
    reason: 'rm against the home directory refused.',
  },
  {
    test: (c) => /\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*\s+(?:--\s+)?(?:\.\/)?\*(?:\s|$)/.test(c),
    reason: 'rm with a bare * glob refused. Name what to delete.',
  },
  {
    test: (c) => /\bgit\s+push\b[^;&|]*\s(?:--force(?:-with-lease)?(?:=\S*)?|-f)(?=\s|$)/.test(c)
      || /\bgit\s+push\b[^;&|]*\s\+[\w./-]+/.test(c),
    reason: 'force push refused (--force, -f, --force-with-lease, +refspec). Rebase and push normally, or open a fresh PR.',
  },
  {
    test: (c) => /\bgit\s+reset\b[^;&|]*--hard/.test(c),
    reason: 'git reset --hard refused. Stash, branch or revert instead.',
  },
  {
    test: (c) => /\bgit\s+clean\b[^;&|]*\s-[a-zA-Z]*f/.test(c),
    reason: 'git clean -f refused — it deletes untracked work. Remove specific paths instead.',
  },
  {
    test: (c) => /\bgit\s+(?:checkout\s+(?:--\s+)?\.|restore\s+(?:--worktree\s+)?\.)(?=\s|$)/.test(c),
    reason: 'discarding all working-tree changes refused. Restore specific files instead.',
  },
  {
    test: (c) => /\b(?:npm|pnpm|yarn)\s+publish\b/.test(c),
    reason: 'package publish refused. Releases ship from CI, not from an agent session.',
  },
  {
    test: (c) => readsSecretFile(c),
    reason: 'shell reads of .env / secrets / key files refused (example/sample/template env files are allowed).',
  },
];

export const DEFAULT_TRUNKS = ['main', 'master', 'production'];

// git push options that take a value as the next word.
const PUSH_VALUE_OPTIONS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

// Each `git [-C dir] [-c k=v] push …` in command position, as its argument words.
// `git` quoted or mid-segment is an argument (a commit message, test data), not a command.
function pushInvocations(command) {
  const out = [];
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const raw = segment.trim().replace(/^\(\s*/, '').split(/\s+/);
    let i = 0;
    while (/^[A-Za-z_]\w*=/.test(raw[i] ?? '')) i++;
    if (raw[i] !== 'git') continue;
    const words = raw.map((w) => w.replace(/^['"]|['"]$/g, ''));
    i++;
    while (words[i] === '-C' || words[i] === '-c') i += 2;
    if (words[i] === 'push') out.push(words.slice(i + 1));
  }
  return out;
}

// Why a push would land on a trunk, or null. Bare pushes and `HEAD` resolve
// through the current branch.
export function trunkPush(command, trunks, currentBranch) {
  const isTrunk = (ref) => trunks.includes(ref.replace(/^refs\/heads\//, ''));
  for (const args of pushInvocations(command)) {
    const positional = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--all' || a === '--mirror' || a === '--branches') return `git push ${a} also pushes the trunk branches`;
      if (PUSH_VALUE_OPTIONS.has(a)) i++;
      else if (!a.startsWith('-')) positional.push(a);
    }
    const refspecs = positional.slice(1);
    if (!refspecs.length || refspecs.some((r) => r.replace(/^\+/, '') === 'HEAD')) {
      const branch = currentBranch();
      if (branch && isTrunk(branch)) return `the current branch is ${branch}`;
    }
    for (const spec of refspecs) {
      const bare = spec.replace(/^\+/, '');
      const dst = bare.includes(':') ? bare.slice(bare.indexOf(':') + 1) : bare;
      if (dst && isTrunk(dst)) return `it targets ${dst.replace(/^refs\/heads\//, '')}`;
    }
  }
  return null;
}

function gitCurrentBranch(root) {
  // --show-current also answers on a branch with no commits yet; empty when detached.
  const r = spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() || null : null;
}

function readsSecretFile(command) {
  if (!new RegExp(`(?:^|[\\s;&|(])${READ_VERBS}\\s`).test(command)) return false;
  for (const m of command.matchAll(ENV_FILE)) {
    const suffix = m[1];
    if (!suffix || !SAFE_ENV_SUFFIXES.has(suffix.split('.').pop())) return true;
  }
  return SECRET_FILE.test(command);
}

export function evaluateBash(command, { root = '.', config = {}, isFlagSet = () => false, fence = null, currentBranch = () => gitCurrentBranch(root) } = {}) {
  if (!command) return { blocked: false };
  for (const rule of RULES) {
    if (rule.test(command)) return { blocked: true, reason: rule.reason };
  }
  const trunk = trunkPush(command, [...DEFAULT_TRUNKS, ...(config.protectedBranches ?? [])], currentBranch);
  if (trunk) {
    return { blocked: true, reason: `push to a protected trunk refused: ${trunk}. Push a feature branch and open a PR; the owner approves the merge.` };
  }
  for (const target of writeTargets(command)) {
    if (fenceBlocks(target, root, fence)) {
      return { blocked: true, reason: `shell write to ${target} refused: it ${FENCE_REASON}` };
    }
    const rel = canonicalisePath(target, root);
    for (const p of protectedPaths(config)) {
      if (globToRegExp(p.glob).test(rel) && !isFlagSet(p.flag)) {
        return { blocked: true, reason: `shell write to ${rel} refused: ${p.reason}. (Flag: .claude/.flags/${p.flag})` };
      }
    }
  }
  return { blocked: false };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envelope = readEnvelope();
  const root = projectRoot();
  finish(NAME, evaluateBash(envelope?.tool_input?.command ?? '', {
    root,
    config: loadAutopilotConfig(root),
    isFlagSet: (flag) => flagIsSet(root, flag),
    fence: autopilotFence(),
  }));
}
