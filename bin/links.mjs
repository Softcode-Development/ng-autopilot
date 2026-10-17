#!/usr/bin/env node
// Broken relative links in a project's own docs.
//
//   node bin/links.mjs <project-dir>
//
// Checks README.md, docs/**/*.md, .claude/rules/project.md, .claude/gates.md and
// .claude/<tier>-testing/overrides.md. A link is broken when its target path
// (anchor and query dropped) does not exist. External links, pure anchors and
// links inside code are not checked. Exit 1 when any link is broken.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const INLINE = /\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const REFERENCE = /^\s{0,3}\[[^\]\n]+\]:\s*<?(\S+?)>?(?:\s+"[^"]*")?\s*$/gm;

function walkMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walkMarkdown(full);
    return e.name.endsWith('.md') ? [full] : [];
  });
}

export function projectDocs(projectRoot) {
  const claude = path.join(projectRoot, '.claude');
  const overrides = existsSync(claude)
    ? readdirSync(claude).filter((d) => d.endsWith('-testing')).map((d) => path.join(claude, d, 'overrides.md'))
    : [];
  return [
    path.join(projectRoot, 'README.md'),
    ...walkMarkdown(path.join(projectRoot, 'docs')),
    path.join(claude, 'rules', 'project.md'),
    path.join(claude, 'gates.md'),
    ...overrides,
  ].filter((f) => existsSync(f) && statSync(f).isFile());
}

// Code blocks, inline code and comments hold example syntax, not links.
const stripNonLinks = (text) =>
  text
    .replace(/^ {0,3}(```|~~~)[\s\S]*?^ {0,3}\1/gm, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');

const isLocal = (target) => !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith('#') && !/[<>{}]/.test(target);

export function linksIn(text) {
  const body = stripNonLinks(text);
  return [...body.matchAll(INLINE), ...body.matchAll(REFERENCE)].map((m) => m[1]).filter(isLocal);
}

export function brokenLinks(projectRoot) {
  const broken = [];
  for (const file of projectDocs(projectRoot)) {
    for (const target of linksIn(readFileSync(file, 'utf8'))) {
      let rel = target.split(/[#?]/)[0];
      if (!rel) continue;
      try {
        rel = decodeURIComponent(rel);
      } catch {
        // keep the raw form
      }
      const resolved = rel.startsWith('/') ? path.join(projectRoot, rel) : path.resolve(path.dirname(file), rel);
      if (!existsSync(resolved)) broken.push({ file: path.relative(projectRoot, file).replaceAll('\\', '/'), target });
    }
  }
  return broken;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node bin/links.mjs <project-dir>');
    process.exit(2);
  }
  const broken = brokenLinks(path.resolve(target));
  for (const b of broken) console.log(`broken link  ${b.file} → ${b.target}`);
  if (!broken.length) console.log('ok — no broken links in the project docs');
  process.exit(broken.length ? 1 : 0);
}
