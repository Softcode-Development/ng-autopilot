// Template purity: no function or method calls bound in templates, except
// zero-argument signal reads and output handlers. Unlike angular-eslint's
// no-call-expression, it reads the component class to tell `count()` (a
// signal) from `format(x)` (a method), so signals-first code stays clean.

import compiler from '@angular-eslint/bundled-angular-compiler';

import { componentInfoFor } from '../lib/component-signals.mjs';

const { ImplicitReceiver, PropertyRead, SafePropertyRead, TmplAstBoundEvent } = compiler;

function insideEventBinding(node) {
  for (let p = node.parent; p && p.type !== 'Program'; p = p.parent) {
    if (p instanceof TmplAstBoundEvent) return true;
  }
  return false;
}

const isRead = (n) => n instanceof PropertyRead || n instanceof SafePropertyRead;
const isRoot = (n) => n instanceof ImplicitReceiver; // ThisReceiver extends it

function calleeLabel(receiver) {
  const parts = [];
  for (let n = receiver; n && isRead(n); n = n.receiver) parts.unshift(n.name);
  return parts.join('.') || 'expression';
}

export function isSignalRead(receiver, info, storePatterns) {
  if (!isRead(receiver)) return false;
  // sig()
  if (isRoot(receiver.receiver)) return info.signals.has(receiver.name);
  // store.items() — a member that holds an injected store
  const owner = receiver.receiver;
  if (isRead(owner) && isRoot(owner.receiver)) {
    const injected = info.stores.get(owner.name);
    if (!injected) return false;
    return storePatterns.some((re) => re.test(injected) || re.test(owner.name));
  }
  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow function and method calls in templates; zero-argument signal reads and output handlers are allowed.',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          allowList: { type: 'array', items: { type: 'string' }, uniqueItems: true },
          storePatterns: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
      },
    ],
    messages: {
      call: '`{{callee}}(…)` is called in the template — bind a computed signal or a precomputed field instead (template purity). Only zero-argument signal reads and output handlers may be called.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const allowList = new Set(['$any', ...(options.allowList ?? [])]);
    const storePatterns = (options.storePatterns ?? ['Store$']).map((s) => new RegExp(s));
    const source = context.sourceCode;
    let info;
    const componentInfo = () => (info ??= componentInfoFor(context.filename));

    function check(node) {
      if (insideEventBinding(node)) return;
      const receiver = node.receiver;
      if (isRead(receiver) && allowList.has(receiver.name)) return;
      if (node.args.length === 0 && isSignalRead(receiver, componentInfo(), storePatterns)) return;
      context.report({
        loc: { start: source.getLocFromIndex(node.sourceSpan.start), end: source.getLocFromIndex(node.sourceSpan.end) },
        messageId: 'call',
        data: { callee: calleeLabel(receiver) },
      });
    }

    return { Call: check, SafeCall: check };
  },
};
