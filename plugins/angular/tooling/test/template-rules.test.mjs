import { describe, it, after } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import templateParser from '@angular-eslint/template-parser';
import { RuleTester } from 'eslint';

import noMethodCalls from '../eslint/rules/template-no-method-calls.mjs';
import noHardcodedText from '../eslint/rules/template-no-hardcoded-text.mjs';
import { analyseSource } from '../eslint/lib/component-signals.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser: templateParser } });

const dir = mkdtempSync(path.join(tmpdir(), 'golden-tpl-'));
after(() => rmSync(dir, { recursive: true, force: true }));

writeFileSync(path.join(dir, 'orders.component.ts'), `
import { Component, computed, input, signal, inject } from '@angular/core';
@Component({ selector: 'app-orders', templateUrl: './orders.component.html' })
export class OrdersComponent {
  readonly count = signal(0);
  readonly total = computed(() => this.count() * 2);
  readonly title = input.required<string>();
  readonly selected: Signal<number>;
  private readonly store = inject(OrdersStore);
  private readonly api = inject(OrdersApi);
  format(x: number): string { return String(x); }
  save(): void {}
}
`);
writeFileSync(path.join(dir, 'legacy.ts'), `
@Component({ selector: 'app-legacy', templateUrl: './legacy-view.html' })
export class LegacyComponent { constructor(private readonly ordersStore: OrdersStore) {} }
`);
const orders = path.join(dir, 'orders.component.html');
const legacy = path.join(dir, 'legacy-view.html');

describe('component analysis', () => {
  it('finds signal members, typed signals and injected stores', () => {
    const info = analyseSource(`class C {
      a = signal(1); b = computed(() => 1); c = input.required<string>(); d = model(0);
      e = toSignal(x$); f = this.store.selectSignal(s); g: WritableSignal<number>; h = 5;
      s = inject(CartStore);
      constructor(private readonly legacyStore: UserStore, plain: number) {}
    }`);
    for (const n of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) if (!info.signals.has(n)) throw new Error(`missing signal ${n}`);
    if (info.signals.has('h')) throw new Error('h is not a signal');
    if (info.stores.get('s') !== 'CartStore' || info.stores.get('legacyStore') !== 'UserStore' || info.stores.has('plain')) {
      throw new Error('store detection wrong');
    }
  });
});

tester.run('golden/template-no-method-calls', noMethodCalls, {
  valid: [
    { filename: orders, code: '<p>{{ count() }} / {{ total() }} / {{ title() }} / {{ selected() }}</p>' },
    { filename: orders, code: '@if (count() > 0) { <span>{{ store.items().length }}</span> }' },
    { filename: orders, code: '<button (click)="save()">x</button><input (input)="format(1)">' },
    { filename: orders, code: '<p>{{ $any(count) }}</p>' },
    { filename: orders, code: '<p>{{ total() | number }}</p>' },
    { filename: legacy, code: '<p>{{ ordersStore.items() }}</p>' },
    { filename: orders, code: '<p>{{ helper() }}</p>', options: [{ allowList: ['helper'] }] },
  ],
  invalid: [
    { filename: orders, code: '<p>{{ format(count()) }}</p>', errors: [{ messageId: 'call' }] },
    { filename: orders, code: '<p>{{ count(1) }}</p>', errors: [{ messageId: 'call' }] },
    { filename: orders, code: '<p>{{ api.load() }}</p>', errors: [{ messageId: 'call' }] },
    { filename: orders, code: '<input [value]="form.get(\'x\')">', errors: [{ messageId: 'call' }] },
    { filename: orders, code: '<p>{{ notASignal() }}</p>', errors: [{ messageId: 'call' }] },
    { filename: path.join(dir, 'orphan.html'), code: '<p>{{ count() }}</p>', errors: [{ messageId: 'call' }] },
  ],
});

tester.run('golden/template-no-hardcoded-text', noHardcodedText, {
  valid: [
    { code: "<h1>{{ 'orders.title' | translate }}</h1>" },
    { code: '<span>{{ count }} · 42 € — %</span>' },
    { code: "<input [placeholder]=\"'orders.search' | translate\">" },
    { code: '<i aria-hidden="true">close</i>' },
    { code: '<pre>raw sample</pre><code>npm test</code>' },
    { code: '<span>English</span>', options: [{ allowedExactStrings: ['English'] }] },
    { code: "<h1>{{ 'orders.title' | transloco }}</h1>", options: [{ translatePipes: ['transloco'] }] },
    { code: '<div class="card" data-cy="orders-list" type="button"></div>' },
  ],
  invalid: [
    { code: '<h1>Orders</h1>', errors: [{ messageId: 'text' }] },
    { code: '<p>Total: {{ total }}</p>', errors: [{ messageId: 'text' }] },
    { code: "<p>{{ 'Hello' }}</p>", errors: [{ messageId: 'literal' }] },
    { code: "<p>{{ ok ? 'Yes' : ('no.key' | translate) }}</p>", errors: [{ messageId: 'literal' }] },
    { code: '<input placeholder="Search orders">', errors: [{ messageId: 'attribute' }] },
    { code: '<img alt="Company logo" src="x.png">', errors: [{ messageId: 'attribute' }] },
    { code: '<button aria-label="Close">×</button>', errors: [{ messageId: 'attribute' }] },
    { code: '@if (empty) { <p>No orders yet</p> }', errors: [{ messageId: 'text' }] },
  ],
});
