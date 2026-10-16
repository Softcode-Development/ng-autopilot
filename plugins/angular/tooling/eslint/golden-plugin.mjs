import templateNoHardcodedText from './rules/template-no-hardcoded-text.mjs';
import templateNoMethodCalls from './rules/template-no-method-calls.mjs';

export default {
  meta: { name: 'golden', version: '0.1.0' },
  rules: {
    'template-no-method-calls': templateNoMethodCalls,
    'template-no-hardcoded-text': templateNoHardcodedText,
  },
};
