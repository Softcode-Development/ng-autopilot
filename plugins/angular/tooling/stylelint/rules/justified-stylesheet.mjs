// A component stylesheet must say why it exists. New code styles layout, spacing,
// typography and colour with utility classes and the theme's tokens; a stylesheet
// is the exception and opens with a `/* why: … */` comment. An empty file passes.

import stylelint from 'stylelint';

const ruleName = 'autopilot/justified-stylesheet';
const messages = stylelint.utils.ruleMessages(ruleName, {
  missing: 'Component stylesheet without a reason — use utility classes / tokens, or start the file with /* why: … */ (autopilot design-discipline § Styling)',
});

const rule = (enabled) => (root, result) => {
  if (!enabled) return;
  const first = root.first;
  if (!first) return;
  if (first.type === 'comment' && /^\s*why:/i.test(first.text)) return;
  stylelint.utils.report({ ruleName, result, node: first, message: messages.missing });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
