// No hardcoded user-facing text in templates: static text, literal strings in
// interpolations that are not piped through the translation pipe, and
// user-visible attributes (placeholder, title, alt, aria-label, label).
// Works on external .html templates and inline templates alike.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import compiler from '@angular-eslint/bundled-angular-compiler';

const { BindingPipe, Interpolation, LiteralPrimitive, TmplAstElement } = compiler;

const LETTER = /\p{L}/u;
const DEFAULT_ATTRIBUTES = ['placeholder', 'title', 'alt', 'aria-label', 'label'];
const DEFAULT_IGNORED_ELEMENTS = ['script', 'style', 'code', 'pre'];

const allowlistCache = new Map();
function loadAllowlist(file) {
  if (!file) return {};
  const full = path.resolve(file);
  if (!allowlistCache.has(full)) {
    try {
      allowlistCache.set(full, JSON.parse(readFileSync(full, 'utf8')));
    } catch {
      allowlistCache.set(full, {});
    }
  }
  return allowlistCache.get(full);
}

function offsets(span) {
  const start = typeof span.start === 'number' ? span.start : span.start.offset;
  const end = typeof span.end === 'number' ? span.end : span.end.offset;
  return { start, end };
}

function ancestors(node) {
  const list = [];
  for (let p = node.parent; p && p.type !== 'Program'; p = p.parent) list.push(p);
  return list;
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hardcoded user-facing text in templates; use translation keys.' },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          translatePipes: { type: 'array', items: { type: 'string' } },
          attributes: { type: 'array', items: { type: 'string' } },
          ignoreElements: { type: 'array', items: { type: 'string' } },
          allowedExactStrings: { type: 'array', items: { type: 'string' } },
          allowAriaHidden: { type: 'boolean' },
          allowlistFile: { type: 'string' },
        },
      },
    ],
    messages: {
      text: 'Hardcoded text "{{text}}" — use a translation key piped through `{{pipe}}`.',
      literal: 'Literal string "{{text}}" in an interpolation — use a translation key piped through `{{pipe}}`.',
      attribute: 'Hardcoded `{{name}}="{{text}}"` — bind a translated key: `[{{name}}]="key | {{pipe}}"`.',
    },
  },
  create(context) {
    const o = context.options[0] ?? {};
    const file = loadAllowlist(o.allowlistFile);
    const pipes = new Set(o.translatePipes ?? ['translate']);
    const pipeLabel = [...pipes][0];
    const attributes = new Set(o.attributes ?? DEFAULT_ATTRIBUTES);
    const ignoredElements = new Set(o.ignoreElements ?? DEFAULT_IGNORED_ELEMENTS);
    const exact = new Set([...(o.allowedExactStrings ?? []), ...(file.allowedExactStrings ?? [])]);
    const allowAriaHidden = o.allowAriaHidden ?? file.allowedAriaHidden ?? true;
    const source = context.sourceCode;

    const isUserText = (text) => {
      const t = text.trim();
      return t.length > 0 && LETTER.test(t) && !exact.has(t);
    };

    const skipped = (node) => ancestors(node).some((p) =>
      p instanceof TmplAstElement && (
        ignoredElements.has(p.name)
        || p.attributes.some((a) => a.name === 'ngNonBindable')
        || (allowAriaHidden && p.attributes.some((a) => a.name === 'aria-hidden' && a.value === 'true'))
      ));

    const report = (span, messageId, data) => {
      const { start, end } = offsets(span);
      context.report({ loc: { start: source.getLocFromIndex(start), end: source.getLocFromIndex(end) }, messageId, data: { pipe: pipeLabel, ...data } });
    };

    const literalsOutsidePipe = (ast, out) => {
      if (!ast) return out;
      if (ast instanceof BindingPipe) {
        if (pipes.has(ast.name)) return out; // the translated subtree is fine
        literalsOutsidePipe(ast.exp, out);
        ast.args?.forEach((a) => literalsOutsidePipe(a, out));
        return out;
      }
      if (ast instanceof LiteralPrimitive) {
        if (typeof ast.value === 'string' && isUserText(ast.value)) out.push(ast);
        return out;
      }
      for (const key of ['condition', 'trueExp', 'falseExp', 'left', 'right', 'expression']) {
        if (ast[key] && typeof ast[key] === 'object') literalsOutsidePipe(ast[key], out);
      }
      return out;
    };

    return {
      Text(node) {
        if (isUserText(node.value) && !skipped(node)) report(node.sourceSpan, 'text', { text: node.value.trim().slice(0, 60) });
      },
      BoundText(node) {
        if (skipped(node)) return;
        const ast = node.value?.ast;
        if (!(ast instanceof Interpolation)) return;
        const staticText = ast.strings.join(' ');
        if (isUserText(staticText)) report(node.sourceSpan, 'text', { text: staticText.trim().slice(0, 60) });
        for (const expr of ast.expressions) {
          for (const lit of literalsOutsidePipe(expr, [])) {
            report(node.sourceSpan, 'literal', { text: String(lit.value).slice(0, 60) });
          }
        }
      },
      'Element > TextAttribute'(node) {
        if (!attributes.has(node.name) || !isUserText(node.value) || skipped(node)) return;
        report(node.sourceSpan, 'attribute', { name: node.name, text: node.value.slice(0, 60) });
      },
    };
  },
};
