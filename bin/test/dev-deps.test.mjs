import { test } from 'node:test';
import assert from 'node:assert/strict';

import { admitsMajor, installCommand, installSpecs } from '../lib/dev-deps.mjs';

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
