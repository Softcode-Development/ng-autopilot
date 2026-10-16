import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ESLint } from 'eslint';

import { autopilotAngular } from '../eslint/preset.mjs';

const root = mkdtempSync(path.join(tmpdir(), 'autopilot-preset-'));
after(() => rmSync(root, { recursive: true, force: true }));

const write = (rel, text) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
};

write('tsconfig.json', JSON.stringify({
  compilerOptions: { strict: true, target: 'ES2022', module: 'ES2022', moduleResolution: 'bundler', experimentalDecorators: true, skipLibCheck: true, noEmit: true },
  include: ['src/**/*.ts'],
}));

// The same violations in and out of scope.
const COMPONENT = (name) => `import { Component, Input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export enum Mode { A, B }

@Component({
  selector: 'app-${name}',
  templateUrl: './${name}.component.html',
})
export class ${name[0].toUpperCase() + name.slice(1)}Component {
  @Input() title = '';
  readonly state = new BehaviorSubject<number>(0);
  label(): string {
    console.log('x');
    return 'x';
  }
}
`;
const TEMPLATE = '<h1>Orders</h1>\n<p>{{ label() }}</p>\n<div *ngIf="title">x</div>\n';

write('src/app/features/orders/orders.component.ts', COMPONENT('orders'));
write('src/app/features/orders/orders.component.html', TEMPLATE);
write('src/app/legacy/legacy.component.ts', COMPONENT('legacy'));
write('src/app/legacy/legacy.component.html', TEMPLATE);
write('src/app/features/orders/orders.component.spec.ts', `import { BehaviorSubject } from 'rxjs';
// @ts-expect-error invalid input under test
const s = new BehaviorSubject<number>('x');
export { s };
`);
write('src/app/features/core/constants/route-paths.ts', `export const go = (r: { navigate(c: string[]): void }): void => r.navigate(['/orders']);
`);

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: autopilotAngular({ tsconfigRootDir: root, strictScope: ['src/app/features/**'], constantsGlobs: ['**/core/constants/**'] }),
});

const rulesIn = async (rel) => {
  const [result] = await eslint.lintFiles([path.join(root, rel)]);
  return new Set(result.messages.map((m) => m.ruleId ?? `fatal: ${m.message}`));
};

test('in scope: every autopilot rule fires on the component', async () => {
  const rules = await rulesIn('src/app/features/orders/orders.component.ts');
  for (const r of [
    'no-restricted-syntax', // enum, @Input, BehaviorSubject
    'no-restricted-imports', // rxjs BehaviorSubject
    'no-console',
    '@angular-eslint/prefer-on-push-component-change-detection',
    '@angular-eslint/prefer-signals',
  ]) assert.ok(rules.has(r), `expected ${r}, got ${[...rules].join(', ')}`);
});

test('in scope: template rules fire on the external template', async () => {
  const rules = await rulesIn('src/app/features/orders/orders.component.html');
  for (const r of ['autopilot/template-no-method-calls', 'autopilot/template-no-hardcoded-text', '@angular-eslint/template/prefer-control-flow']) {
    assert.ok(rules.has(r), `expected ${r}, got ${[...rules].join(', ')}`);
  }
});

test('out of scope: legacy code is untouched by autopilot rules', async () => {
  // Files outside the scope match no autopilot config block; ESLint reports them
  // as "no matching configuration" (a warning), never as a rule error.
  for (const rel of ['src/app/legacy/legacy.component.ts', 'src/app/legacy/legacy.component.html']) {
    const [result] = await eslint.lintFiles([path.join(root, rel)]);
    assert.equal(result.errorCount, 0, `${rel}: ${result.messages.map((m) => m.ruleId).join(', ')}`);
  }
});

test('specs: subjects allowed, ts-expect-error allowed with a reason', async () => {
  const rules = await rulesIn('src/app/features/orders/orders.component.spec.ts');
  assert.ok(!rules.has('no-restricted-syntax'), [...rules].join(', '));
  assert.ok(!rules.has('no-restricted-imports'), [...rules].join(', '));
  assert.ok(!rules.has('@typescript-eslint/ban-ts-comment'), [...rules].join(', '));
});

test('constants files may hold route literals', async () => {
  const rules = await rulesIn('src/app/features/core/constants/route-paths.ts');
  assert.ok(!rules.has('no-restricted-syntax'), [...rules].join(', '));
});

test('tsconfigRootDir is required', () => {
  assert.throws(() => autopilotAngular({}), /tsconfigRootDir is required/);
});
