#!/usr/bin/env node
// Hardcoded-text ratchet for legacy templates (outside lint.strictScope).
//
//   node tools/autopilot/i18n/hardcoded-ratchet.mjs <file.html>...
//
// Legacy templates hold untranslated text the strict lint would reject, so the
// rule cannot run on them as an error. The ratchet only forbids adding more:
// for each staged template it counts `autopilot/template-no-hardcoded-text` hits
// in the staged content and in HEAD (0 for a new file) and fails when the
// staged count is higher, naming the new hits. Removing text always passes.
// Runs from lint-staged (autopilot preset) in pre-commit.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';
import angular from 'angular-eslint';

import rule from '../eslint/rules/template-no-hardcoded-text.mjs';

const RULE = 'autopilot/template-no-hardcoded-text';

function readConfig(root) {
  const file = path.join(root, '.claude', 'autopilot.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

// Hits of the hardcoded-text rule in `text`, as { line, text } (text = the offending source).
export function hardcodedHits(text, { translatePipes = ['translate'], allowlistFile } = {}) {
  const linter = new Linter({ configType: 'flat' });
  const messages = linter.verify(text, [{
    files: ['**/*.html'],
    languageOptions: { parser: angular.templateParser },
    plugins: { autopilot: { rules: { 'template-no-hardcoded-text': rule } } },
    rules: { [RULE]: ['error', { translatePipes, ...(allowlistFile ? { allowlistFile } : {}) }] },
  }], { filename: 'template.html' });
  const lines = text.split('\n');
  return messages.filter((m) => m.ruleId === RULE).map((m) => ({
    line: m.line,
    text: m.endLine === m.line ? lines[m.line - 1].slice(m.column - 1, m.endColumn - 1).trim() : lines[m.line - 1].slice(m.column - 1).trim(),
  }));
}

// Hits in `after` that `before` did not have, matched by their text (a moved line is not new).
export function newHits(before, after) {
  const pool = before.map((h) => h.text);
  return after.filter((h) => {
    const i = pool.indexOf(h.text);
    if (i < 0) return true;
    pool.splice(i, 1);
    return false;
  });
}

const gitShow = (root, spec) => {
  const r = spawnSync('git', ['show', spec], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
};

// One file: { file, before, after, added } or null when it did not grow.
export function checkFile(root, rel, options) {
  const staged = gitShow(root, `:${rel}`) ?? readFileSync(path.join(root, rel), 'utf8');
  const head = gitShow(root, `HEAD:${rel}`);
  const before = head === null ? [] : hardcodedHits(head, options);
  const after = hardcodedHits(staged, options);
  if (after.length <= before.length) return null;
  return { file: rel, before: before.length, after: after.length, added: newHits(before, after) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const lint = readConfig(root).lint ?? {};
  const options = { translatePipes: lint.translatePipes ?? ['translate'], allowlistFile: lint.i18nAllowlistFile };
  const failures = process.argv.slice(2)
    .map((f) => path.relative(root, path.resolve(f)).replaceAll('\\', '/'))
    .map((rel) => checkFile(root, rel, options))
    .filter(Boolean);
  for (const f of failures) {
    console.error(`[hardcoded-ratchet] ${f.file}: untranslated text grew from ${f.before} to ${f.after} hit(s). New:`);
    for (const h of f.added) console.error(`  line ${h.line}: ${h.text}`);
  }
  if (failures.length) {
    console.error('Put new text behind translation keys (autopilot i18n rule); legacy text may stay, but never grows.');
    process.exit(1);
  }
}
