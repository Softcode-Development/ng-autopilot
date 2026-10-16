// Autopilot stylelint preset. Component styles inside `strictScope` get the
// design-discipline rules (tokens, no !important, no component dark-mode
// media queries); everything stylelint-config-standard checks applies there too.
//
// Usage in the project's stylelint.config.mjs:
//   import { autopilotStylelint } from './tools/autopilot/stylelint/preset.mjs';
//   export default autopilotStylelint({ scss: true, strictScope: ['src/app/features/**'] });

const TAILWIND_AT_RULES = [
  'tailwind', 'apply', 'layer', 'config', 'theme', 'source', 'utility', 'variant',
  'custom-variant', 'plugin', 'reference', 'screen', 'responsive', 'variants', 'import',
];

export function autopilotStylelint(options = {}) {
  const o = { scss: false, tailwind: false, strictScope: ['src/**'], ignoreFiles: [], ...options };
  const ext = o.scss ? '{scss,css}' : 'css';
  const files = o.strictScope.map((g) => (g.endsWith('/**') ? `${g}/*.${ext}` : `${g}/**/*.${ext}`));

  return {
    extends: [o.scss ? 'stylelint-config-standard-scss' : 'stylelint-config-standard'],
    ignoreFiles: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.angular/**', ...o.ignoreFiles],
    rules: {
      'selector-class-pattern': null,
      'no-descending-specificity': null,
      ...(o.tailwind ? {
        'at-rule-no-unknown': [true, { ignoreAtRules: TAILWIND_AT_RULES }],
        ...(o.scss ? { 'scss/at-rule-no-unknown': [true, { ignoreAtRules: TAILWIND_AT_RULES }] } : {}),
        'function-no-unknown': [true, { ignoreFunctions: ['theme'] }],
      } : {}),
    },
    overrides: [
      {
        files,
        rules: {
          // Design discipline: colours come from tokens, never literals.
          'color-no-hex': true,
          'color-named': 'never',
          'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
          // Don't fight the design system.
          'declaration-no-important': true,
          // Tokens carry both themes; components don't branch on the OS theme.
          'media-feature-name-disallowed-list': ['prefers-color-scheme'],
        },
      },
    ],
  };
}
