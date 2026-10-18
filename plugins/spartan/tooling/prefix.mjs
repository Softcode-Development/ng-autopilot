#!/usr/bin/env node
// Prefix the Tailwind classes in spartan-generated (helm) code for the legacy setup.
//
//   node tools/autopilot/spartan/prefix.mjs <componentsPath> [--prefix tw]
//
// The legacy setup prefixes every Tailwind class (`tw:flex`) so it cannot collide with
// legacy global CSS. spartan's CLI has no prefix option, so this rewrites what it
// generates: class strings passed to classes() / cva() / hlm() / cn() (cva: the base
// and the variants / compoundVariants values, never their keys), static class="…" in
// inline templates, and hlm()'s tailwind-merge so it merges prefixed classes.
// Idempotent — run it after every `ng g @spartan-ng/cli:ui`.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const CLASS_CALLS = new Set(['classes', 'cva', 'hlm', 'cn']);
// In compoundVariants entries only these hold classes; the other keys select variants.
const COMPOUND_CLASS_KEYS = new Set(['class', 'className']);

// spartan-* names are hook classes, not utilities.
const keep = (token, prefix) => !token.trim() || token.startsWith(`${prefix}:`) || token.startsWith('spartan-');

export function prefixClassList(list, prefix) {
  return list.split(/(\s+)/).map((t) => (keep(t, prefix) ? t : `${prefix}:${t}`)).join('');
}

export function prefixTemplate(html, prefix) {
  return html.replace(/(\s)class="([^"]*)"/g, (all, space, list) => (list.includes('{{') ? all : `${space}class="${prefixClassList(list, prefix)}"`));
}

export function prefixTwMerge(source, prefix) {
  return source.replace(
    "import { twMerge } from 'tailwind-merge';",
    `import { extendTailwindMerge } from 'tailwind-merge';\n\nconst twMerge = extendTailwindMerge({ prefix: '${prefix}' });`,
  );
}

const isText = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
const nameOf = (prop, sf) => (prop.name ? prop.name.getText(sf).replace(/^['"]|['"]$/g, '') : '');

export function prefixSource(source, prefix) {
  const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true);
  const edits = [];
  const edit = (node, transform) => {
    const start = node.getStart(sf) + 1;
    const end = node.getEnd() - 1;
    edits.push({ start, end, value: transform(source.slice(start, end)) });
  };
  // Every string under a class argument is a class list, except object keys.
  const classStrings = (node) => {
    if (isText(node)) return edit(node, (t) => prefixClassList(t, prefix));
    if (ts.isPropertyAssignment(node)) return classStrings(node.initializer);
    ts.forEachChild(node, classStrings);
  };
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && CLASS_CALLS.has(node.expression.text)) {
      for (const arg of node.arguments) {
        if (ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) {
            if (!ts.isPropertyAssignment(p)) continue;
            if (nameOf(p, sf) === 'variants') classStrings(p.initializer);
            if (nameOf(p, sf) === 'compoundVariants' && ts.isArrayLiteralExpression(p.initializer)) {
              for (const entry of p.initializer.elements) {
                if (!ts.isObjectLiteralExpression(entry)) continue;
                for (const q of entry.properties) if (ts.isPropertyAssignment(q) && COMPOUND_CLASS_KEYS.has(nameOf(q, sf))) classStrings(q.initializer);
              }
            }
          }
        } else {
          classStrings(arg);
        }
      }
      return;
    }
    if (ts.isPropertyAssignment(node) && nameOf(node, sf) === 'template' && isText(node.initializer)) {
      edit(node.initializer, (t) => prefixTemplate(t, prefix));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  let out = source;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.value + out.slice(e.end);
  return out;
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const prefix = args.includes('--prefix') ? args[args.indexOf('--prefix') + 1] : 'tw';
  if (!target) {
    console.error('usage: node prefix.mjs <componentsPath> [--prefix tw]');
    process.exit(2);
  }
  let changed = 0;
  for (const file of walk(path.resolve(target)).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
    const before = readFileSync(file, 'utf8');
    const after = prefixTwMerge(prefixSource(before, prefix), prefix);
    if (after !== before) {
      writeFileSync(file, after);
      changed++;
      console.log(`  ${path.relative(process.cwd(), file).replaceAll('\\', '/')}`);
    }
  }
  console.log(`${changed} file(s) prefixed with ${prefix}:`);
}
