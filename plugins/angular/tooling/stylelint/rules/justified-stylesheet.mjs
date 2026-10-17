// A stylesheet in new code must say why it exists. New code styles layout, spacing,
// typography and colour with utility classes and the theme's tokens; a stylesheet is
// the exception and opens with a `/* why: … */` comment. Covers component styles with
// or without the `.component` suffix (Angular 20+ names them `user.css`) and any other
// stylesheet in the scope. An empty file and the app's global entry styles
// (src/styles.*, src/styles/**) pass.

import stylelint from 'stylelint';

const ruleName = 'autopilot/justified-stylesheet';
const messages = stylelint.utils.ruleMessages(ruleName, {
  missing: 'Stylesheet without a reason — use utility classes / tokens, or start the file with /* why: … */ (autopilot design-discipline § Styling)',
});

const GLOBAL_ENTRY = /(^|[\\/])src[\\/]styles(\.s?css$|[\\/])/;

const rule = (enabled) => (root, result) => {
  if (!enabled) return;
  if (GLOBAL_ENTRY.test(root.source?.input?.file ?? '')) return;
  const first = root.first;
  if (!first) return;
  if (first.type === 'comment' && /^\s*why:/i.test(first.text)) return;
  stylelint.utils.report({ ruleName, result, node: first, message: messages.missing });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
