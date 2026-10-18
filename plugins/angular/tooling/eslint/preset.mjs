// Autopilot Angular ESLint preset. Every rule applies only inside
// `strictScope` (default: the whole src/), so a legacy repo can enforce the
// full set on its new features/ folder while the rest of the code is migrated.
//
// Usage in the project's eslint.config.mjs:
//   import { autopilotAngular } from './tools/autopilot/eslint/preset.mjs';
//   export default [ ...autopilotAngular({ tsconfigRootDir: import.meta.dirname, ...autopilot.lint }), /* project blocks */ ];

import angular from 'angular-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import-x';
import securityPlugin from 'eslint-plugin-security';
import unicornPlugin from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

import autopilot from './autopilot-plugin.mjs';

const NO_ENUM = { selector: 'TSEnumDeclaration', message: 'Use string-literal unions or `as const` maps instead of `enum` (autopilot rule: typescript).' };
const NO_SUBJECT = {
  selector: 'NewExpression[callee.name=/^(BehaviorSubject|ReplaySubject|Subject)$/]',
  message: 'Subjects are banned for app state — use signals; convert streams with toSignal() (autopilot rule: state).',
};
const NO_DECORATOR_APIS = {
  selector: 'Decorator[expression.callee.name=/^(Input|Output|ViewChild|ViewChildren|ContentChild|ContentChildren|HostBinding|HostListener)$/]',
  message: 'Use input() / output() / model(), signal queries and `host` metadata instead of decorators (autopilot rule: components-templates).',
};
const NO_NGMODULE = { selector: 'Decorator[expression.callee.name="NgModule"]', message: 'No NgModule in new code — standalone components and providers in app.config.ts (autopilot rule: architecture).' };
const NO_BYPASS_SECURITY = {
  selector: 'CallExpression[callee.property.name=/^bypassSecurityTrust/]',
  message: 'bypassSecurityTrust* defeats Angular sanitising — sanitise instead (autopilot rule: security).',
};
const NO_ROUTE_NAVIGATE = {
  selector: 'CallExpression[callee.property.name=/^(navigate|createUrlTree)$/] > ArrayExpression > Literal[value=/^\\//]',
  message: 'Use ROUTE_PATHS.* instead of a hardcoded route (autopilot rule: constants-naming).',
};
const NO_ROUTE_URL = {
  selector: 'CallExpression[callee.property.name=/^(navigateByUrl|parseUrl)$/] > Literal[value=/^\\//]',
  message: 'Use ROUTE_PATHS.* instead of a hardcoded route (autopilot rule: constants-naming).',
};
const NO_API_URL = {
  selector: 'CallExpression[callee.property.name=/^(get|post|put|patch|delete)$/] > Literal[value=/^\\/api\\//]',
  message: 'Use API_PATHS.* instead of a hardcoded API URL (autopilot rule: constants-naming).',
};

const BASE_SYNTAX = [NO_ENUM, NO_DECORATOR_APIS, NO_NGMODULE, NO_BYPASS_SECURITY];
const LITERAL_SYNTAX = [NO_ROUTE_NAVIGATE, NO_ROUTE_URL, NO_API_URL];

const RXJS_SUBJECTS = {
  name: 'rxjs',
  importNames: ['BehaviorSubject', 'ReplaySubject', 'Subject'],
  message: 'Subjects are banned for app state — use signals (autopilot rule: state).',
};

export const DEFAULTS = {
  strictScope: ['src/**'],
  selectorPrefix: 'app',
  constantsGlobs: ['**/core/constants/**'],
  realtimeGlobs: ['**/core/realtime/**'],
  testingToolkit: 'src/testing',
  testingToolkitImports: [],
  translatePipes: ['translate'],
  i18nAllowlistFile: undefined,
  storePatterns: ['Store$'],
  templateCallAllowList: [],
  // Generated vendor code (e.g. spartan helm): never linted, still type-checked.
  vendorGlobs: [],
};

const filesFor = (scope, ext) => scope.map((g) => (g.endsWith('/**') ? `${g}/*.${ext}` : `${g}/**/*.${ext}`));
const inScope = (configs, files) => configs.map((c) => ({ ...c, files }));

const TOOLKIT_MESSAGE = 'The testing toolkit is test-only — never import it from production code (specs only).';

// Matches every way production code can reach the toolkit: relative paths into
// its folder (`../../testing/builders`), the folder itself, and any aliases.
export function toolkitPatterns(o) {
  const folder = o.testingToolkit ? o.testingToolkit.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() : null;
  const groups = [
    ...(folder ? [`**/${folder}`, `**/${folder}/**`] : []),
    ...o.testingToolkitImports.flatMap((alias) => [alias, `${alias}/**`]),
  ];
  return groups.length ? [{ group: groups, message: TOOLKIT_MESSAGE }] : [];
}

function restrictedImports(o, { subjects, toolkit }) {
  const paths = subjects ? [RXJS_SUBJECTS] : [];
  const patterns = toolkit ? toolkitPatterns(o) : [];
  if (!paths.length && !patterns.length) return 'off';
  return ['error', { paths, patterns }];
}

export function autopilotAngular(options = {}) {
  const o = { ...DEFAULTS, ...options };
  if (!o.tsconfigRootDir) throw new Error('autopilotAngular: tsconfigRootDir is required (pass import.meta.dirname).');

  // The toolkit is test code wherever it sits: linted, with the spec relaxations.
  const toolkit = o.testingToolkit ? filesFor([`${o.testingToolkit.replace(/\/$/, '')}/**`], 'ts') : [];
  const ts = [...filesFor(o.strictScope, 'ts'), ...toolkit];
  const html = filesFor(o.strictScope, 'html');
  const specs = [...filesFor(o.strictScope, 'spec.ts'), ...toolkit];
  const constants = o.constantsGlobs.map((g) => `${g}/*.ts`);
  const realtime = o.realtimeGlobs.map((g) => `${g}/*.ts`);

  return [
    ...(o.vendorGlobs.length ? [{ ignores: o.vendorGlobs }] : []),

    // TypeScript: strict + stylistic, typed linting.
    ...inScope(tseslint.configs.strict, ts),
    ...inScope(tseslint.configs.stylistic, ts),
    ...inScope(angular.configs.tsRecommended, ts),
    {
      files: ts,
      processor: angular.processInlineTemplates,
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: o.tsconfigRootDir } },
      plugins: { import: importPlugin, security: securityPlugin, unicorn: unicornPlugin },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        '@typescript-eslint/no-extraneous-class': 'off',
        '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true }],
        'no-console': 'error',
        'no-restricted-syntax': ['error', ...BASE_SYNTAX, NO_SUBJECT, ...LITERAL_SYNTAX],
        'no-restricted-imports': restrictedImports(o, { subjects: true, toolkit: true }),

        '@angular-eslint/prefer-on-push-component-change-detection': 'error',
        '@angular-eslint/prefer-signals': 'error',
        '@angular-eslint/prefer-standalone': 'error',
        '@angular-eslint/prefer-inject': 'error',
        '@angular-eslint/component-selector': ['error', { type: 'element', prefix: o.selectorPrefix, style: 'kebab-case' }],
        '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: o.selectorPrefix, style: 'camelCase' }],
        '@angular-eslint/component-max-inline-declarations': ['error', { template: 15, styles: 15 }],
        '@angular-eslint/no-input-rename': 'error',
        '@angular-eslint/use-lifecycle-interface': 'error',

        'security/detect-eval-with-expression': 'error',
        'security/detect-unsafe-regex': 'error',
        'security/detect-non-literal-fs-filename': 'warn',
        'unicorn/filename-case': ['error', { case: 'kebabCase' }],
        'unicorn/prefer-node-protocol': 'error',
        'import/order': ['error', {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
        }],
        'import/no-cycle': 'error',
        'import/no-self-import': 'error',
      },
    },

    // The constants files are the source of truth for routes and API paths.
    { files: constants, rules: { 'no-restricted-syntax': ['error', ...BASE_SYNTAX, NO_SUBJECT] } },

    // Realtime code may use RxJS subjects.
    {
      files: realtime,
      rules: {
        'no-restricted-syntax': ['error', ...BASE_SYNTAX, ...LITERAL_SYNTAX],
        'no-restricted-imports': restrictedImports(o, { subjects: false, toolkit: true }),
      },
    },

    // Specs: subjects and literal URLs are fine (wire-contract checks); the
    // toolkit is the point; ts directives allowed with a same-line reason.
    {
      files: specs,
      rules: {
        'no-restricted-syntax': ['error', ...BASE_SYNTAX],
        'no-restricted-imports': 'off',
        '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description', 'ts-ignore': 'allow-with-description', 'ts-nocheck': true }],
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },

    // Templates (external .html and inline templates).
    ...inScope(angular.configs.templateRecommended, html),
    ...inScope(angular.configs.templateAccessibility, html),
    {
      files: html,
      plugins: { autopilot },
      rules: {
        '@angular-eslint/template/prefer-control-flow': 'error',
        'autopilot/template-no-method-calls': ['error', { allowList: o.templateCallAllowList, storePatterns: o.storePatterns }],
        'autopilot/template-no-hardcoded-text': ['error', {
          translatePipes: o.translatePipes,
          ...(o.i18nAllowlistFile ? { allowlistFile: o.i18nAllowlistFile } : {}),
        }],
      },
    },

    // Formatting is Prettier's job.
    prettierConfig,
  ];
}
