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
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// TypeScript comes from the project being worked on (every Angular project has it); this
// file's own surroundings are the fallback.
function loadTypescript(from, fallback) {
  const bases = [path.join(path.resolve(from), 'package.json'), ...(fallback ? [fileURLToPath(import.meta.url)] : [])];
  for (const base of bases) {
    try {
      return createRequire(base)('typescript');
    } catch {
      // try the next base
    }
  }
  throw new Error(`typescript not found from ${from} — run this in the Angular project`);
}

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

const nameOf = (prop, sf) => (prop.name ? prop.name.getText(sf).replace(/^['"]|['"]$/g, '') : '');

export function prefixSource(source, prefix, { from = process.cwd(), fallback = true } = {}) {
  const ts = loadTypescript(from, fallback);
  const isText = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true);
  const edits = [];
  const edit = (node, transform) => {
    const start = node.getStart(sf) + 1;
    const end = node.getEnd() - 1;
    edits.push({ start, end, value: transform(source.slice(start, end)) });
  };
  const isClassCall = (node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && CLASS_CALLS.has(node.expression.text);

  // A node in class position: only the parts that become class names are prefixed — never
  // comparison operands, conditions, or arguments of other calls (buttonVariants({ variant: 'ghost' })).
  const classValue = (node) => {
    if (!node) return;
    if (isText(node)) return edit(node, (t) => prefixClassList(t, prefix));
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node)) return classValue(node.expression);
    if (ts.isArrayLiteralExpression(node)) return node.elements.forEach(classValue);
    if (ts.isConditionalExpression(node)) return [node.whenTrue, node.whenFalse].forEach(classValue);
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return classValue(node.right);
      if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(op)) return [node.left, node.right].forEach(classValue);
      return;
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      if (!ts.isBlock(node.body)) return classValue(node.body);
      const returns = (n) => (ts.isReturnStatement(n) ? classValue(n.expression) : ts.isFunctionLike(n) ? undefined : ts.forEachChild(n, returns));
      return ts.forEachChild(node.body, returns);
    }
    // clsx-style map: the keys are classes, the values are conditions.
    if (ts.isObjectLiteralExpression(node)) {
      for (const p of node.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        if (ts.isStringLiteral(p.name)) edit(p.name, (t) => prefixClassList(t, prefix));
        else if (ts.isIdentifier(p.name)) edits.push({ start: p.name.getStart(sf), end: p.name.getEnd(), value: `'${prefix}:${p.name.text}'` });
      }
      return;
    }
    if (isClassCall(node)) return classCall(node);
  };

  const classCall = (node) => {
    const cva = node.expression.text === 'cva';
    node.arguments.forEach((arg, i) => {
      if (!(cva && i > 0 && ts.isObjectLiteralExpression(arg))) return classValue(arg);
      for (const p of arg.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        // variants: { group: { key: classes } } — the keys select, the values are classes.
        if (nameOf(p, sf) === 'variants' && ts.isObjectLiteralExpression(p.initializer)) {
          for (const group of p.initializer.properties) {
            if (ts.isPropertyAssignment(group) && ts.isObjectLiteralExpression(group.initializer)) {
              for (const v of group.initializer.properties) if (ts.isPropertyAssignment(v)) classValue(v.initializer);
            }
          }
        }
        if (nameOf(p, sf) === 'compoundVariants' && ts.isArrayLiteralExpression(p.initializer)) {
          for (const entry of p.initializer.elements) {
            if (!ts.isObjectLiteralExpression(entry)) continue;
            for (const q of entry.properties) if (ts.isPropertyAssignment(q) && COMPOUND_CLASS_KEYS.has(nameOf(q, sf))) classValue(q.initializer);
          }
        }
      }
    });
  };

  const visit = (node) => {
    if (isClassCall(node)) return classCall(node);
    if (ts.isPropertyAssignment(node) && nameOf(node, sf) === 'template' && isText(node.initializer)) {
      edit(node.initializer, (t) => prefixTemplate(t, prefix));
      return;
    }
    // host: { class: '…' } on a component or directive.
    if (ts.isPropertyAssignment(node) && nameOf(node, sf) === 'host' && ts.isObjectLiteralExpression(node.initializer)) {
      for (const p of node.initializer.properties) if (ts.isPropertyAssignment(p) && nameOf(p, sf) === 'class') classValue(p.initializer);
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
