// PreToolUse(Bash): block destructive or rule-breaking shell commands.
// Settings deny-lists match command prefixes only; this hook closes the
// side channels (secret reads via cat/grep, redirect writes into protected
// paths, force pushes spelled as `+branch`).

import { fileURLToPath } from 'node:url';
import {
  readEnvelope, projectRoot, loadGoldenConfig, protectedPaths, flagIsSet, globToRegExp, finish,
} from './lib/hook-io.mjs';

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

function readsSecretFile(command) {
  if (!new RegExp(`(?:^|[\\s;&|(])${READ_VERBS}\\s`).test(command)) return false;
  for (const m of command.matchAll(ENV_FILE)) {
    const suffix = m[1];
    if (!suffix || !SAFE_ENV_SUFFIXES.has(suffix.split('.').pop())) return true;
  }
  return SECRET_FILE.test(command);
}

// A redirect counts only at a token boundary, so prose mentions of `>` inside
// quoted text do not trip it.
function writeTargets(command) {
  const targets = [];
  const redirect = /(?:^|[\s&|0-9])>{1,2}\s*([^\s|;&'"`>]+)/g;
  const tee = /\btee\s+(?:-[A-Za-z]+\s+)*([^\s|;&'"`>]+)/g;
  for (const m of command.matchAll(redirect)) targets.push(m[1]);
  for (const m of command.matchAll(tee)) targets.push(m[1]);
  return targets.map((t) => t.replace(/^\.\//, ''));
}

export function evaluateBash(command, { root = '.', config = {}, isFlagSet = () => false } = {}) {
  if (!command) return { blocked: false };
  for (const rule of RULES) {
    if (rule.test(command)) return { blocked: true, reason: rule.reason };
  }
  const targets = writeTargets(command);
  for (const p of protectedPaths(config)) {
    const re = globToRegExp(p.glob);
    const hit = targets.find((t) => re.test(t));
    if (hit && !isFlagSet(p.flag)) {
      return { blocked: true, reason: `shell write into ${hit} refused: ${p.reason}. (Flag: .claude/.flags/${p.flag})` };
    }
  }
  return { blocked: false };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envelope = readEnvelope();
  const root = projectRoot();
  finish(NAME, evaluateBash(envelope?.tool_input?.command ?? '', {
    root,
    config: loadGoldenConfig(root),
    isFlagSet: (flag) => flagIsSet(root, flag),
  }));
}
