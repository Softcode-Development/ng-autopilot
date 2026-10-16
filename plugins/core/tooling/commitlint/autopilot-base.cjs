// Autopilot commitlint base. The project's commitlint.config.cjs extends it and
// adds its own scope list (the capability slugs from FEATURES.md):
//
//   module.exports = {
//     extends: ['./tools/autopilot/commitlint/autopilot-base.cjs'],
//     rules: { 'scope-enum': [2, 'always', ['orders', 'auth', 'deps', 'ci']] },
//   };

module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => /^Merge\s/i.test(message), (message) => /^Revert\s/i.test(message)],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'style', 'perf', 'build', 'ci', 'revert']],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
