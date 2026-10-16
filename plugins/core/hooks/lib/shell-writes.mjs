// Best-effort list of the files a shell command writes, moves or deletes.
// Used by guard-bash to keep agents off protected paths through the shell.
// It cannot see inside arbitrary scripts; the pre-commit fingerprint check is
// the backstop for anything that slips past.

const TOKEN = /'[^']*'|"(?:\\.|[^"\\])*"|[^\s'"]+/g;
const WRITE_APIS = /\b(writeFile|writeFileSync|appendFile|appendFileSync|rmSync|rm\(|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|cpSync|truncate|write_text|write_bytes|shutil\.(?:copy|move|rmtree)|os\.(?:remove|unlink|rename))\b|open\([^)]*['"][wa]/;

const unquote = (t) => (/^(['"]).*\1$/s.test(t) ? t.slice(1, -1) : t);

// Split on ; && || | and newlines, but not inside quotes.
export function segments(command) {
  const out = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (ch === quote && command[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    const rest = command.slice(i);
    const m = /^(?:&&|\|\||[;|\n])/.exec(rest);
    if (m) {
      out.push(current);
      current = '';
      i += m[0].length - 1;
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

export const tokens = (segment) => (segment.match(TOKEN) ?? []).map(unquote);

const isFlag = (t) => t.startsWith('-');

// Drop leading env assignments and wrappers (`FOO=1 cmd`, `sudo cmd`, `npx cmd`).
function commandStart(toks) {
  let i = 0;
  while (i < toks.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[i]) || ['sudo', 'command', 'env'].includes(toks[i]))) i++;
  return toks.slice(i);
}

function afterScriptFlags(args, scriptFlags) {
  // Remove the values consumed by -e/-f style flags; what remains (non-flags) are files.
  const files = [];
  let scriptGiven = false;
  for (let i = 0; i < args.length; i++) {
    if (scriptFlags.includes(args[i])) {
      scriptGiven = true;
      i++;
      continue;
    }
    if (!isFlag(args[i])) files.push(args[i]);
  }
  return scriptGiven ? files : files.slice(1); // without -e, the first non-flag is the script
}

function inlineScriptTargets(args, evalFlags) {
  const idx = args.findIndex((a) => evalFlags.includes(a));
  if (idx === -1 || idx + 1 >= args.length) return [];
  const script = args[idx + 1];
  if (!WRITE_APIS.test(script)) return [];
  return [...script.matchAll(/['"`]([^'"`\s]+)['"`]/g)].map((m) => m[1]).filter((s) => /[/\\.]/.test(s));
}

export function writeTargets(command) {
  const targets = [];
  for (const segment of segments(command)) {
    const toks = commandStart(tokens(segment));
    if (toks.length === 0) continue;
    const cmd = toks[0].replace(/^.*[\\/]/, '');
    const args = toks.slice(1);
    const nonFlags = args.filter((a) => !isFlag(a));
    switch (cmd) {
      case 'sed':
        if (args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))) targets.push(...afterScriptFlags(args, ['-e', '-f', '--expression', '--file']));
        break;
      case 'perl':
        if (args.some((a) => /^-[a-zA-Z]*i/.test(a))) targets.push(...afterScriptFlags(args, ['-e', '-E']));
        else targets.push(...inlineScriptTargets(args, ['-e', '-E']));
        break;
      case 'cp': case 'mv': case 'install': case 'ln': {
        const t = args.indexOf('-t');
        if (t !== -1 && args[t + 1]) targets.push(args[t + 1]);
        else if (nonFlags.length >= 2) targets.push(nonFlags.at(-1));
        if (cmd === 'mv') targets.push(...nonFlags.slice(0, -1)); // moving a file away also changes it
        break;
      }
      case 'rm': case 'unlink': case 'truncate': case 'shred': case 'rmdir':
        targets.push(...nonFlags);
        break;
      case 'git': {
        const sub = nonFlags[0];
        const rest = args.slice(args.indexOf(sub) + 1);
        if (sub === 'rm' || sub === 'mv') targets.push(...rest.filter((a) => !isFlag(a)));
        if (sub === 'checkout' && rest.includes('--')) targets.push(...rest.slice(rest.indexOf('--') + 1));
        if (sub === 'restore' && (!rest.includes('--staged') || rest.includes('--worktree'))) {
          targets.push(...rest.filter((a) => !isFlag(a) && a !== '--'));
        }
        break;
      }
      case 'node': case 'deno': case 'bun':
        targets.push(...inlineScriptTargets(args, ['-e', '--eval', '-p', '--print']));
        break;
      case 'python': case 'python3': case 'py':
        targets.push(...inlineScriptTargets(args, ['-c']));
        break;
      default:
        break;
    }
  }
  // Redirects and tee anywhere in the command, at a token boundary only.
  for (const m of command.matchAll(/(?:^|[\s&|0-9])>{1,2}\s*([^\s|;&'"`>]+)/g)) targets.push(m[1]);
  for (const m of command.matchAll(/\btee\s+(?:-[A-Za-z]+\s+)*([^\s|;&'"`>]+)/g)) targets.push(m[1]);
  return [...new Set(targets.map((t) => t.replace(/^\.\//, '')))];
}
