// Shared helpers for the i18n gates. Config comes from .claude/autopilot.json → i18n:
// {
//   "sets": [ { "source": "src/assets/i18n/market-a/lt.json",
//               "locales": ["src/assets/i18n/market-a/en.json"] } ],
//   "scanDirs": ["src"], "scanExtensions": [".ts", ".html"],
//   "ignoreUnusedPrefixes": ["COMMON.ENUM."]
// }

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function loadI18nConfig(root) {
  const file = path.join(root, '.claude', 'autopilot.json');
  const config = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).i18n : undefined;
  if (!config?.sets?.length) throw new Error('No i18n sets in .claude/autopilot.json → i18n.sets');
  return {
    scanDirs: ['src'],
    scanExtensions: ['.ts', '.html'],
    ignoreUnusedPrefixes: [],
    ...config,
  };
}

export function readJson(root, rel) {
  return JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
}

// { a: { b: 'x' } } → Map { 'a.b' => 'x' }
export function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

// Interpolation parameters: ngx-translate {{ name }}, ICU / Transloco {name}.
export function params(value) {
  if (typeof value !== 'string') return [];
  const found = new Set();
  for (const m of value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) found.add(m[1]);
  for (const m of value.replace(/\{\{[^}]*\}\}/g, '').matchAll(/\{\s*(\w+)\s*(?:,[^}]*)?\}/g)) found.add(m[1]);
  return [...found].sort();
}

export function bracesBalanced(value) {
  if (typeof value !== 'string') return true;
  let depth = 0;
  for (const ch of value) {
    if (ch === '{') depth++;
    if (ch === '}' && --depth < 0) return false;
  }
  return depth === 0;
}

export function walkFiles(root, dirs, extensions) {
  const out = [];
  const visit = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(abs, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (extensions.some((e) => entry.name.endsWith(e))) out.push(full);
    }
  };
  for (const d of dirs) if (existsSync(path.join(root, d))) visit(path.join(root, d));
  return out;
}
