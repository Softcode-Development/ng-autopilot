// Install specs for the devDependencies the autopilot presets need: modern and
// compatible, never pinned. angular-eslint follows the project's Angular major;
// eslint takes the newest major that angular-eslint version peers on; every
// package that peers on eslint takes its newest version accepting that major;
// everything else is the latest.

import { spawnSync } from 'node:child_process';

// Held on purpose: @primeuix/themes 3.x carries its own licence; 2.x is MIT and is what PrimeNG 21 styles against.
const HELD = { '@primeuix/themes': { major: 2, why: 'held below 3.x for its licence (2.x is MIT)' } };

// Packages whose peer range on eslint decides which version fits.
export const ESLINT_PEERS = ['typescript-eslint', 'eslint-plugin-import-x', 'eslint-plugin-security', 'eslint-plugin-unicorn', 'eslint-config-prettier'];

const majorOf = (range) => {
  const m = /(\d+)/.exec(range ?? '');
  return m ? Number(m[1]) : null;
};

// Does a semver range admit some version of `major`? Covers the forms peer
// ranges use: ^X, ~X, X, X.x, >=X, >X, <X, <=X, *, joined by spaces and ||.
export function admitsMajor(range, major) {
  if (!range || range.trim() === '*') return true;
  return range.split('||').some((alt) => alt.trim().split(/\s+/).every((cmp) => {
    const m = /^(\^|~|>=|>|<=|<|=)?v?(\d+|x|\*)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/.exec(cmp);
    if (!m) return true;
    const [, op = '', maj, min, patch] = m;
    if (maj === 'x' || maj === '*') return true;
    const n = Number(maj);
    const zeroRest = (min === undefined || min === '0') && (patch === undefined || patch === '0');
    switch (op) {
      case '>=': case '>': return major >= n;
      case '<': return zeroRest ? major < n : major <= n;
      case '<=': return major <= n;
      default: return major === n;
    }
  }));
}

export function npmView(spec, field) {
  // One command string: npm is a .cmd shim on Windows and needs the shell; specs are package names we build.
  const r = spawnSync(`npm view ${spec} ${field} --json`, { encoding: 'utf8', shell: true });
  if (r.status !== 0 || !r.stdout.trim()) return undefined;
  const value = JSON.parse(r.stdout);
  return Array.isArray(value) && field !== 'versions' ? value.at(-1) : value;
}

function newestAdmitted(range, latestMajor) {
  for (let m = latestMajor; m > 0; m--) if (admitsMajor(range, m)) return m;
  return latestMajor;
}

// Newest major of `name` whose eslint peer range accepts `eslintMajor`; null = latest fits.
function fittingMajor(name, eslintMajor, view) {
  if (admitsMajor(view(name, 'peerDependencies')?.eslint, eslintMajor)) return null;
  const majors = [...new Set((view(name, 'versions') ?? []).filter((v) => !v.includes('-')).map(majorOf))].sort((a, b) => b - a);
  for (const m of majors) if (admitsMajor(view(`${name}@${m}`, 'peerDependencies')?.eslint, eslintMajor)) return m;
  return null;
}

// `missing`: package names not yet in package.json. `pkg`: the project's package.json.
// Returns install specs (`name` or `name@major`) plus notes on how each pinned one was chosen.
export function installSpecs(missing, pkg, view = npmView) {
  const have = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const specs = [];
  const notes = [];
  const angularMajor = majorOf(have['@angular/core']);
  const needsEslint = missing.some((n) => n === 'eslint' || n === 'angular-eslint' || ESLINT_PEERS.includes(n));

  let eslintMajor = majorOf(have.eslint);
  if (needsEslint && eslintMajor === null) {
    const latest = majorOf(view('eslint', 'version'));
    const peer = view(angularMajor ? `angular-eslint@${angularMajor}` : 'angular-eslint', 'peerDependencies')?.eslint;
    eslintMajor = latest === null ? null : newestAdmitted(peer, latest);
    if (eslintMajor !== null) notes.push(`eslint@${eslintMajor}: newest major angular-eslint${angularMajor ? `@${angularMajor}` : ''} peers on (${peer ?? 'any'})`);
  }

  for (const name of missing) {
    if (HELD[name]) {
      specs.push(`${name}@${HELD[name].major}`);
      notes.push(`${name}@${HELD[name].major}: ${HELD[name].why}`);
    } else if (name === 'angular-eslint' && angularMajor) {
      specs.push(`angular-eslint@${angularMajor}`);
      notes.push(`angular-eslint@${angularMajor}: matches @angular/core ${have['@angular/core']}`);
    } else if (name === 'eslint' && eslintMajor !== null) {
      specs.push(`eslint@${eslintMajor}`);
    } else if (ESLINT_PEERS.includes(name) && eslintMajor !== null) {
      const m = fittingMajor(name, eslintMajor, view);
      specs.push(m === null ? name : `${name}@${m}`);
      if (m !== null) notes.push(`${name}@${m}: its latest needs a newer eslint than ${eslintMajor}`);
    } else {
      specs.push(name);
    }
  }
  return { specs, notes };
}

export const installCommand = (specs, packageManager, { dev = true } = {}) =>
  `${packageManager === 'pnpm' ? 'pnpm add' : 'npm install'}${dev ? ' -D' : ''} ${specs.join(' ')}`;
