// Autopilot lint-staged preset. Linters and Prettier run only on staged files
// inside the lint scope (lint.strictScope + the testing toolkit): ESLint has no
// config for files outside it, and its "no matching configuration" warning
// fails --max-warnings=0; formatting a legacy file on a one-line fix rewrites
// the whole file.
//
// Usage in the project's .lintstagedrc.mjs:
//   import { autopilotLintStaged } from './tools/autopilot/lint-staged/preset.mjs';
//   export default { ...autopilotLintStaged(autopilot), /* project entries */ };

import path from 'node:path';

const DEFAULT_SCOPE = ['src/**'];
const DEFAULT_TOOLKIT = 'src/testing';

const dirOf = (glob) => glob.replace(/\/\*\*$/, '');
const filesIn = (glob, ext) => (glob.endsWith('/**') ? `${glob}/*.${ext}` : `${glob}/**/*.${ext}`);

// strictScope plus the toolkit folder, without globs another one already covers
// (two matching keys would run two `--fix` passes on the same file at once).
export function lintScope(autopilot = {}) {
  const lint = autopilot.lint ?? {};
  const toolkit = lint.testingToolkit === undefined ? DEFAULT_TOOLKIT : lint.testingToolkit;
  const globs = [...(lint.strictScope ?? DEFAULT_SCOPE), ...(toolkit ? [`${toolkit.replace(/\\/g, '/').replace(/\/$/, '')}/**`] : [])];
  const unique = [...new Set(globs)];
  return unique.filter((g) => !unique.some((other) => other !== g && dirOf(g).startsWith(`${dirOf(other)}/`)));
}

export function i18nGlob(autopilot = {}) {
  const files = (autopilot.i18n?.sets ?? []).flatMap((s) => [s.source, ...s.locales]);
  if (files.length === 0) return null;
  const dirs = [...new Set(files.map((f) => path.posix.dirname(f)))];
  return dirs.length === 1 ? `${dirs[0]}/*.json` : `{${dirs.join(',')}}/*.json`;
}

export function autopilotLintStaged(autopilot = {}) {
  const scope = lintScope(autopilot);
  // A scope covering the whole app means there is no legacy code to protect from
  // reformatting, so docs and config files are formatted repo-wide.
  const wholeApp = scope.includes('src/**');
  const entries = {};
  for (const glob of scope) {
    entries[filesIn(glob, '{ts,mts,cts,js,mjs,cjs,html}')] = ['eslint --fix --max-warnings=0', 'prettier --write'];
    entries[filesIn(glob, '{scss,css}')] = ['stylelint --fix', 'prettier --write'];
    if (!wholeApp) entries[filesIn(glob, '{md,json,yml,yaml}')] = ['prettier --write'];
  }
  if (wholeApp) entries['*.{md,json,yml,yaml}'] = ['prettier --write'];
  const i18n = i18nGlob(autopilot);
  if (i18n) entries[i18n] = ['node tools/autopilot/i18n/i18n-validate.mjs'];
  return entries;
}
