import { test } from 'node:test';
import assert from 'node:assert/strict';

import { admitsMajor, installCommand, installPlan, installSpecs } from '../lib/dev-deps.mjs';

// A registry shaped like npm on 2026-10-17, plus an older angular-eslint major capped at eslint 9.
const REGISTRY = {
  'eslint version': '10.13.0',
  'angular-eslint@22 peerDependencies': { eslint: '^9.0.0 || ^10.0.0' },
  'angular-eslint@21 peerDependencies': { eslint: '^8.57.0 || ^9.0.0 || ^10.0.0' },
  'angular-eslint@20 peerDependencies': { eslint: '^8.57.0 || ^9.0.0' },
  'typescript-eslint peerDependencies': { eslint: '^8.57.0 || ^9.0.0 || ^10.0.0' },
  'eslint-plugin-import-x peerDependencies': { eslint: '^8.57.0 || ^9.0.0 || ^10.0.0' },
  'eslint-plugin-security peerDependencies': {},
  'eslint-config-prettier peerDependencies': { eslint: '>=7.0.0' },
  'eslint-plugin-unicorn peerDependencies': { eslint: '>=10.4' },
  'eslint-plugin-unicorn versions': ['62.0.0', '64.0.0', '77.0.0', '78.0.0', '79.0.0-beta.1'],
  'eslint-plugin-unicorn@78 peerDependencies': { eslint: '>=10.4' },
  'eslint-plugin-unicorn@77 peerDependencies': { eslint: '>=10.0' },
  'eslint-plugin-unicorn@64 peerDependencies': { eslint: '>=9.29.0' },
  'eslint-plugin-unicorn@62 peerDependencies': { eslint: '>=9.20.0' },
};
const view = (spec, field) => REGISTRY[`${spec} ${field}`];
const ALL = ['husky', 'eslint', 'angular-eslint', 'typescript-eslint', 'eslint-plugin-import-x', 'eslint-plugin-security', 'eslint-plugin-unicorn', 'eslint-config-prettier', 'stylelint'];
const angular = (v) => ({ dependencies: { '@angular/core': v } });

test('peer ranges: the forms npm packages use', () => {
  assert.ok(admitsMajor('^8.57.0 || ^9.0.0 || ^10.0.0', 10));
  assert.ok(!admitsMajor('^8.57.0 || ^9.0.0', 10));
  assert.ok(admitsMajor('>=10.4', 11));
  assert.ok(!admitsMajor('>=10.4', 9));
  assert.ok(admitsMajor('>=4.8.4 <6.1.0', 6));
  assert.ok(!admitsMajor('>=4.8.4 <6.0.0', 6));
  assert.ok(admitsMajor('*', 3));
  assert.ok(admitsMajor(undefined, 3));
});

test('Angular 22: angular-eslint@22, eslint@10, the rest latest', () => {
  const { specs } = installSpecs(ALL, angular('^22.1.0'), view);
  assert.deepEqual(specs, ['husky', 'eslint@10', 'angular-eslint@22', 'typescript-eslint', 'eslint-plugin-import-x', 'eslint-plugin-security', 'eslint-plugin-unicorn', 'eslint-config-prettier', 'stylelint']);
});

test('Angular 21: angular-eslint follows the Angular major', () => {
  const { specs, notes } = installSpecs(ALL, angular('~21.2.0'), view);
  assert.ok(specs.includes('angular-eslint@21'));
  assert.ok(specs.includes('eslint@10'));
  assert.match(notes.join('\n'), /angular-eslint@21: matches @angular\/core ~21\.2\.0/);
});

test('an angular-eslint capped at eslint 9: eslint@9, and unicorn falls back to its newest major that accepts 9', () => {
  const { specs, notes } = installSpecs(ALL, angular('^20.3.0'), view);
  assert.ok(specs.includes('eslint@9'));
  assert.ok(specs.includes('eslint-plugin-unicorn@64'));
  assert.ok(specs.includes('typescript-eslint'));
  assert.match(notes.join('\n'), /eslint-plugin-unicorn@64: its latest needs a newer eslint than 9/);
});

test('eslint already installed: plugins fit the installed major, eslint is not re-chosen', () => {
  const pkg = { dependencies: { '@angular/core': '^21.0.0' }, devDependencies: { eslint: '^9.39.4' } };
  const { specs } = installSpecs(['eslint-plugin-unicorn', 'prettier'], pkg, view);
  assert.deepEqual(specs, ['eslint-plugin-unicorn@64', 'prettier']);
});

test('the install command follows the package manager', () => {
  assert.equal(installCommand(['a', 'b@2'], 'pnpm'), 'pnpm add -D a b@2');
  assert.equal(installCommand(['a'], 'npm'), 'npm install -D a');
});

test('the theme package is held at 2.x for its licence', () => {
  const { specs, notes } = installSpecs(['@primeuix/themes', '@fontsource-variable/inter'], {}, view);
  assert.deepEqual(specs, ['@primeuix/themes@2', '@fontsource-variable/inter']);
  assert.match(notes.join('\n'), /@primeuix\/themes@2: .*licen/);
});

test('runtime dependencies install without -D', () => {
  assert.equal(installCommand(['a'], 'npm', { dev: false }), 'npm install a');
  assert.equal(installCommand(['a'], 'pnpm', { dev: false }), 'pnpm add a');
});

// spartan's companions, shaped like npm on 2026-10-18 (Angular 21 project).
const SPARTAN_REGISTRY = {
  '@spartan-ng/brain peerDependencies': { '@angular/core': '>=21.0.0 <23.0.0', tailwindcss: '>=4.0.0', clsx: '>=2.0.0' },
  '@angular/cdk peerDependencies': { '@angular/core': '^22.0.0 || ^23.0.0' },
  '@angular/cdk versions': ['20.2.0', '21.2.7', '22.2.3'],
  '@angular/cdk@22 peerDependencies': { '@angular/core': '^22.0.0 || ^23.0.0' },
  '@angular/cdk@21 peerDependencies': { '@angular/core': '^21.0.0' },
  '@ng-icons/core peerDependencies': { '@angular/core': '>=22.0.0' },
  '@ng-icons/core versions': ['33.2.2', '34.0.0', '36.1.0'],
  '@ng-icons/core@36 peerDependencies': { '@angular/core': '>=22.0.0' },
  '@ng-icons/core@34 peerDependencies': { '@angular/core': '>=22.0.0' },
  '@ng-icons/core@33 peerDependencies': { '@angular/core': '>=21.0.0' },
  'tailwindcss version': '4.3.3',
};
const spartanView = (spec, field) => SPARTAN_REGISTRY[`${spec} ${field}`];

test('spartan companions follow the Angular major; lucide follows ng-icons core; the CLI follows brain', () => {
  const missing = ['@spartan-ng/brain', '@spartan-ng/cli', '@angular/cdk', '@ng-icons/core', '@ng-icons/lucide', 'tailwindcss', 'class-variance-authority'];
  const { specs, notes } = installSpecs(missing, { dependencies: { '@angular/core': '^21.2.0' } }, spartanView);
  assert.deepEqual(specs, ['@spartan-ng/brain', '@spartan-ng/cli', '@angular/cdk@21', '@ng-icons/core@33', '@ng-icons/lucide@33', 'tailwindcss', 'class-variance-authority']);
  assert.match(notes.join('\n'), /@ng-icons\/core@33: newest major whose @angular\/core peer accepts 21/);
});

test('an already installed ng-icons core decides lucide\'s major', () => {
  const pkg = { dependencies: { '@angular/core': '^21.2.0', '@ng-icons/core': '^33.2.2' } };
  assert.deepEqual(installSpecs(['@ng-icons/lucide'], pkg, spartanView).specs, ['@ng-icons/lucide@33']);
});

test('installPlan resolves dependencies and devDependencies together, so the CLI follows the brain chosen for dependencies', () => {
  const registry = {
    '@spartan-ng/brain peerDependencies': { '@angular/core': '>=21.0.0 <23.0.0' },
    '@spartan-ng/brain versions': ['0.9.0', '1.8.0'],
    '@spartan-ng/brain@1 peerDependencies': { '@angular/core': '>=21.0.0 <23.0.0' },
    '@spartan-ng/brain@0 peerDependencies': { '@angular/core': '>=19.0.0 <21.0.0' },
  };
  const plan = installPlan(['@spartan-ng/brain'], ['@spartan-ng/cli'], { dependencies: { '@angular/core': '^20.3.0' } }, (s, f) => registry[`${s} ${f}`]);
  assert.deepEqual(plan.dependencies.specs, ['@spartan-ng/brain@0']);
  assert.deepEqual(plan.devDependencies.specs, ['@spartan-ng/cli@0']);
});
