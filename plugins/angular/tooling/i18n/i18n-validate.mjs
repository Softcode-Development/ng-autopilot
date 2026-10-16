#!/usr/bin/env node
// i18n gate: every locale mirrors its source file — same keys, no empty
// values, the same interpolation parameters, balanced braces.
//
//   node tools/golden/i18n/i18n-validate.mjs            all sets
//   node tools/golden/i18n/i18n-validate.mjs <files…>   only sets containing these files (lint-staged)

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bracesBalanced, flatten, loadI18nConfig, params, readJson } from './lib.mjs';

export function validateSet(root, set) {
  const problems = [];
  const source = flatten(readJson(root, set.source));
  const files = [set.source, ...set.locales];
  for (const rel of files) {
    const map = rel === set.source ? source : flatten(readJson(root, rel));
    for (const [key, value] of map) {
      if (value === '' || value === null) problems.push(`${rel}: empty value for "${key}"`);
      if (!bracesBalanced(value)) problems.push(`${rel}: unbalanced braces in "${key}"`);
    }
    if (rel === set.source) continue;
    for (const key of source.keys()) if (!map.has(key)) problems.push(`${rel}: missing "${key}" (present in ${set.source})`);
    for (const key of map.keys()) if (!source.has(key)) problems.push(`${rel}: extra "${key}" (absent from ${set.source})`);
    for (const [key, value] of map) {
      if (!source.has(key)) continue;
      const want = params(source.get(key)).join(',');
      const got = params(value).join(',');
      if (want !== got) problems.push(`${rel}: parameters of "${key}" are [${got}], source has [${want}]`);
    }
  }
  return problems;
}

export function validate(root, onlyFiles = []) {
  const config = loadI18nConfig(root);
  const wanted = onlyFiles.map((f) => path.relative(root, path.resolve(root, f)).replace(/\\/g, '/'));
  const sets = wanted.length
    ? config.sets.filter((s) => [s.source, ...s.locales].some((f) => wanted.includes(f)))
    : config.sets;
  return sets.flatMap((s) => validateSet(root, s));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const problems = validate(root, process.argv.slice(2));
  for (const p of problems) console.error(`[i18n-validate] ${p}`);
  if (problems.length) {
    console.error(`[i18n-validate] ${problems.length} problem(s).`);
    process.exit(1);
  }
  console.log('[i18n-validate] ok');
}
