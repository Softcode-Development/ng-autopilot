#!/usr/bin/env node
// i18n gate: every key in a source locale file is referenced somewhere in the
// code (as a quoted string). Keys only built dynamically are listed under
// i18n.ignoreUnusedPrefixes in .claude/autopilot.json.
//
//   node tools/autopilot/i18n/i18n-unused.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { flatten, loadI18nConfig, readJson, walkFiles } from './lib.mjs';

export function findUnused(root) {
  const config = loadI18nConfig(root);
  const keys = new Set();
  for (const set of config.sets) for (const k of flatten(readJson(root, set.source)).keys()) keys.add(k);

  const corpus = walkFiles(root, config.scanDirs, config.scanExtensions).map((f) => readFileSync(f, 'utf8')).join('\n');
  const used = (key) => [`'${key}'`, `"${key}"`, `\`${key}\``].some((q) => corpus.includes(q));

  return [...keys]
    .filter((k) => !config.ignoreUnusedPrefixes.some((p) => k.startsWith(p)))
    .filter((k) => !used(k))
    .sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const unused = findUnused(process.cwd());
  for (const k of unused) console.error(`[i18n-unused] unused key "${k}"`);
  if (unused.length) {
    console.error(`[i18n-unused] ${unused.length} unused key(s). Remove them, use them, or list a dynamic prefix in i18n.ignoreUnusedPrefixes.`);
    process.exit(1);
  }
  console.log('[i18n-unused] ok');
}
