// Autopilot stylelint preset. Component styles inside `strictScope` get the
// design-discipline rules (tokens, no !important, no component dark-mode
// media queries); everything stylelint-config-standard checks applies there too.
//
// Stylesheets in scope, other than the app's global entry styles, must justify
// themselves (autopilot/justified-stylesheet).
//
// Usage in the project's stylelint.config.mjs:
//   import { autopilotStylelint } from './tools/autopilot/stylelint/preset.mjs';
//   export default autopilotStylelint({ scss: true, strictScope: ['src/app/features/**'] });

import justifiedStylesheet from './rules/justified-stylesheet.mjs';

const TAILWIND_AT_RULES = [
  'tailwind', 'apply', 'layer', 'config', 'theme', 'source', 'utility', 'variant',
  'custom-variant', 'plugin', 'reference', 'screen', 'responsive', 'variants', 'import',
];

export function autopilotStylelint(options = {}) {
  const o = { scss: false, tailwind: false, strictScope: ['src/**'], ignoreFiles: [], vendorGlobs: [], ...options };
  const ext = o.scss ? '{scss,css}' : 'css';
  const files = o.strictScope.map((g) => (g.endsWith('/**') ? `${g}/*.${ext}` : `${g}/**/*.${ext}`));

  return {
    extends: [o.scss ? 'stylelint-config-standard-scss' : 'stylelint-config-standard'],
    plugins: [justifiedStylesheet],
    ignoreFiles: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.angular/**', ...o.ignoreFiles, ...o.vendorGlobs],
    rules: {
      'selector-class-pattern': null,
      'no-descending-specificity': null,
      ...(o.tailwind ? {
        'at-rule-no-unknown': [true, { ignoreAtRules: TAILWIND_AT_RULES }],
        ...(o.scss ? { 'scss/at-rule-no-unknown': [true, { ignoreAtRules: TAILWIND_AT_RULES }] } : {}),
        'function-no-unknown': [true, { ignoreFunctions: ['theme'] }],
        // Tailwind v4 imports by name: @import "tailwindcss";
        'import-notation': 'string',
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
      // Layout and look come from utility classes and tokens; a stylesheet says why it exists.
      { files, rules: { 'autopilot/justified-stylesheet': true } },
    ],
  };
}
