// Reads the component class behind a template and returns which members are
// signals (safe to call with no arguments in a template) and which members
// hold an injected store whose members are signals.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

export const SIGNAL_FACTORIES = new Set([
  'signal', 'computed', 'linkedSignal', 'input', 'model', 'toSignal',
  'viewChild', 'viewChildren', 'contentChild', 'contentChildren',
  'resource', 'httpResource', 'rxResource', 'selectSignal',
]);

const cache = new Map();

// Inline templates are linted as virtual files named after their host file:
// `<path>/x.component.ts/<n>_inline-template-….html`.
export function componentFileFor(templateFile) {
  const inline = /^(.*?\.ts)[\\/][^\\/]*$/.exec(templateFile);
  if (inline && existsSync(inline[1])) return inline[1];
  if (!templateFile.endsWith('.html')) return null;

  const sibling = templateFile.replace(/\.html$/, '.ts');
  if (existsSync(sibling)) return sibling;

  const dir = path.dirname(templateFile);
  const base = path.basename(templateFile);
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || f.endsWith('.spec.ts')) continue;
    const full = path.join(dir, f);
    if (readFileSync(full, 'utf8').includes(base)) return full;
  }
  return null;
}

function factoryName(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  // input.required(), viewChild.required(), store.selectSignal(), this.x.selectSignal()
  if (ts.isPropertyAccessExpression(expr)) {
    if (expr.name.text === 'required' && ts.isIdentifier(expr.expression)) return expr.expression.text;
    return expr.name.text;
  }
  return '';
}

function isSignalType(typeNode) {
  return !!typeNode && ts.isTypeReferenceNode(typeNode) && /Signal$/.test(typeNode.typeName.getText());
}

export function analyseSource(source, fileName = 'component.ts') {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const signals = new Set();
  const stores = new Map(); // member name → injected class name

  const visit = (node) => {
    if (ts.isPropertyDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (isSignalType(node.type)) signals.add(name);
      const init = node.initializer;
      if (init && ts.isCallExpression(init)) {
        const fn = factoryName(init.expression);
        if (SIGNAL_FACTORIES.has(fn)) signals.add(name);
        if (fn === 'inject' && init.arguments[0] && ts.isIdentifier(init.arguments[0])) {
          stores.set(name, init.arguments[0].text);
        }
      }
    }
    // constructor(private readonly store: ProductsStore) {}
    if (ts.isParameter(node) && node.modifiers?.length && ts.isIdentifier(node.name) && node.type && ts.isTypeReferenceNode(node.type)) {
      stores.set(node.name.text, node.type.typeName.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { signals, stores };
}

export function componentInfoFor(templateFile) {
  const file = componentFileFor(templateFile);
  if (!file) return { file: null, signals: new Set(), stores: new Map() };
  const mtime = statSync(file).mtimeMs;
  const hit = cache.get(file);
  if (hit && hit.mtime === mtime) return hit.info;
  const info = { file, ...analyseSource(readFileSync(file, 'utf8'), file) };
  cache.set(file, { mtime, info });
  return info;
}
