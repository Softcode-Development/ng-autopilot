#!/usr/bin/env node
// spartan stylesheet helpers.
//
//   node tools/autopilot/spartan/spartan-css.mjs tokens <file>
//     spartan's `ui-theme` generator writes Tailwind imports, the spartan preset, the colour
//     tokens and a base layer into one file; this keeps only the `:root` / `:root.dark`
//     token blocks (src/styles/tokens/colors.css), since src/styles/tailwind.css owns the rest.
//
//   node tools/autopilot/spartan/spartan-css.mjs preset <out> [--prefix tw]
//     Legacy setup: copies @spartan-ng/brain's hlm-tailwind-preset.css with its @apply lists
//     prefixed (under prefix(tw) an unprefixed @apply fails the build). The header records the
//     brain version; re-run after a spartan upgrade (doctor reports a stale copy).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prefixClassList } from './prefix.mjs';

// The font stack belongs to tokens/typography.css; the generator's unlayered :root --font-*
// would silently override it, so those declarations are dropped.
export function extractTokens(css) {
  const blocks = [...css.matchAll(/^:root(?:\.dark)?\s*\{[\s\S]*?^\}/gm)].map((m) => m[0].replace(/\n[ \t]*--font-[\w-]+:[^;]*;\n?/g, '\n').replace(/\n{3,}/g, '\n\n'));
  return `${blocks.join('\n\n')}\n`;
}

const HEADER = /^\/\* @spartan-ng\/brain (\S+) hlm-tailwind-preset\.css[^*]*\*\/\n/;

export function presetHeaderVersion(css) {
  return HEADER.exec(css)?.[1] ?? null;
}

export function prefixPreset(css, prefix, version) {
  const body = css.replace(HEADER, '').replace(/@apply ([^;{}]+);/g, (_, list) => `@apply ${prefixClassList(list, prefix)};`);
  return `/* @spartan-ng/brain ${version} hlm-tailwind-preset.css, @apply prefixed with ${prefix}: by tools/autopilot/spartan/spartan-css.mjs — re-run after a spartan upgrade. */\n${body}`;
}

function findPackage(name, from) {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', ...name.split('/'));
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, target, ...rest] = process.argv.slice(2);
  const prefix = rest.includes('--prefix') ? rest[rest.indexOf('--prefix') + 1] : 'tw';
  if (command === 'tokens' && target) {
    writeFileSync(target, extractTokens(readFileSync(target, 'utf8')));
    console.log(`tokens kept in ${target}`);
  } else if (command === 'preset' && target) {
    const brain = findPackage('@spartan-ng/brain', process.cwd());
    if (!brain) {
      console.error('@spartan-ng/brain is not installed — run spartan init first');
      process.exit(1);
    }
    const { version } = JSON.parse(readFileSync(path.join(brain, 'package.json'), 'utf8'));
    writeFileSync(target, prefixPreset(readFileSync(path.join(brain, 'hlm-tailwind-preset.css'), 'utf8'), prefix, version));
    console.log(`spartan preset ${version} copied to ${target} (prefix ${prefix}:)`);
  } else {
    console.error('usage: node spartan-css.mjs tokens <file> | preset <out> [--prefix tw]');
    process.exit(2);
  }
}
