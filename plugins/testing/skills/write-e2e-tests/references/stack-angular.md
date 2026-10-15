# Stack: Angular (e2e)

Angular-specific patterns for e2e tests. Universal rules live in `core.md`; runner syntax in `runner-<runner>.md`; project specifics (page-object paths, GraphQL wrappers, fixture directories) in `overrides.md`.

This file targets **Angular 14+ standalone-component apps with SSR (Angular Universal)**, which is the dominant modern Angular shape. Older module-based or non-SSR apps still apply most of the rules; the SSR section is the main differentiator.

---

## 1. SSR + hydration: strip transfer state before mocking

If the app is rendered via Angular Universal (`ng build --ssr`, Express server in `server.ts`), the server renders HTML that embeds the Apollo / TanStack-Query / TransferState cache as a `<script id="ng-state">` (or `<script type="application/json" id="state">` for `TransferState`) block. On hydration the browser uses that cache and **does not re-fire queries**.

If your spec intercepts a query mock and never sees it called, this is the cause.

### Fix

Strip the transfer-state script + hydration markers before `cy.visit(...)`. The project typically has a helper:

```ts
// Project helper, called from beforeEach BEFORE the first cy.visit()
stripSSRTransferState();
```

A reference implementation (the helper the project should expose):

```ts
// cypress/support/helpers/strip-ssr-transfer-state.ts
export function stripSSRTransferState() {
  cy.intercept('GET', '**/*', (req) => {
    req.continue((res) => {
      if (typeof res.body === 'string') {
        res.body = res.body
          .replace(/<script[^>]*id="ng-state"[^>]*>[\s\S]*?<\/script>/g, '')
          .replace(/ ngh="[^"]*"/g, '')
          .replace(/<!--nghm-->/g, '')
          .replace(/<!--ngetn-->/g, '')
          .replace(/<!--ngtns-->/g, '')
          .replace(/<!--container-->/g, '');
      }
    });
  });
}
```

**When to call it:** in every spec that uses network mocks against an SSR Angular app. The first `cy.visit(...)` after this returns HTML that forces the browser to fetch fresh data.

**When you can skip it:** real-API specs (no mocks; the SSR cache is real and correct). And dev-mode builds that don't render SSR (`ng serve` with no SSR flag).

---

## 2. Reactive form inputs: use a custom `type` command, not raw `.type()`

Angular reactive forms wire input values through `DefaultValueAccessor`, which subscribes to `input` events on the underlying native element. Cypress's `cy.get(X).type(...)` emits `keydown`/`keypress`/`input` events from the Cypress test window, but Angular's `NgZone` (and especially the hydrated form-control state after SSR) sometimes drops or mis-attributes these events — the value never propagates to the control.

The symptom: `cy.get(X).type('alice')`, then assert the form is valid → fails because `formControl.value === ''`.

### Fix

The project should provide a pair of custom commands:

```ts
// cypress/support/commands/ng-type.ts
Cypress.Commands.add('ngType', { prevSubject: 'element' }, (subject, value: string) => {
  cy.wrap(subject).then($el => {
    const el = $el[0] as HTMLInputElement;
    // Use the native input event so Angular's value accessor sees it
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    )!.set!;
    nativeInputValueSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  });
});

Cypress.Commands.add('ngClearAndType', { prevSubject: 'element' }, (subject, value: string) => {
  cy.wrap(subject).clear().ngType(value);
});
```

Then in specs / page objects:

```ts
cy.get(S.emailInput).find('input').first().ngClearAndType('alice@example.test');
```

**When to use it:** every reactive form input on the page (`<input formControlName="...">`, `<p-inputText formControlName="...">`, anything wrapped by a PrimeNG / Material / Taiga form-control directive).

**When raw `.type()` is fine:** non-form inputs (search boxes that wire their own keyup handler, contentEditable elements). When in doubt, use `ngType` — it's a superset.

---

## 3. PrimeNG / Material / Taiga form controls

Component libraries wrap native inputs with their own host elements (`<p-inputText>`, `<mat-form-field>`, `<tui-input>`). The native input is nested inside, often behind a content-projection slot.

- **Don't select on the host element.** `cy.get('p-inputText[data-cy="email"]').type('alice')` types into the host, not the input.
- **Drill to the native input.** `cy.get('[data-cy="email"]').find('input').first().ngClearAndType('alice')`.
- **Expose the action through the page object.** `LoginPO.fillEmail(value)` encapsulates the drill so specs don't repeat `.find('input').first()`.

For dropdowns / selects (`<p-dropdown>`, `<mat-select>`):

- Click the host to open the panel.
- Wait for the panel (`cy.get('[role="listbox"]').should('be.visible')`).
- Click the option by its `data-cy` (add one to the option template if missing).
- Assert the host's displayed value changed.

---

## 4. Zone.js & async work

Angular uses Zone.js to detect when async work finishes and trigger change detection. In e2e, you usually don't interact with Zone directly — but two patterns matter:

- **Microtasks before assertions.** After dispatching a click that triggers an async pipe, Angular runs change detection inside the same Zone microtask. Cypress's retry-ability handles this for you — `cy.get(X).should(...)` retries until the assertion passes. Don't manually `cy.wait(0)` or `cy.tick(0)` "to let Angular settle".
- **Zoneless apps.** Angular 18+ supports zoneless change detection (`provideExperimentalZonelessChangeDetection()`). In a zoneless app, change detection is triggered by signals, not Zone. Behaviour from the test's perspective is the same — retry-ability still works — but production code patterns that "worked because Zone always ran change detection" may not. If a spec hits a state that "looks stale", check whether the project is zoneless and whether the production code is missing a signal write.

---

## 5. Router & route guards

- `router-outlet` is hydrated, but route components inside it may be **lazy-loaded**. The first navigation to a lazy route causes a JS chunk fetch. In a real run that's fine; in a heavily mocked spec, ensure the chunk request is **not** caught by a "fail unmocked" intercept catch-all. Whitelist `**/*.js` / `**/*.mjs` in the catch-all.
- **`canActivate` guards that redirect** to `/login` for guests will run before the route component mounts. Don't assert the protected route's component rendered until you've handled the guard (either by setting auth state in `beforeEach`, or by asserting the redirect happened).
- **Resolvers** that fetch data before the route activates fire as part of navigation. Mock the resolver's data source; the route won't render until the resolver completes.

---

## 6. State management

The Angular state ecosystem is fragmented (NgRx, NgRx Signals, Elf, signal-based stores, Akita, raw RxJS). E2E specs should be **state-agnostic** — they observe the rendered UI, not the store. The store is a unit-test concern.

Indicators that an e2e spec is leaking into the state tier:

- Asserting on `window.ngStore` or any equivalent
- Spying on `Store.dispatch` from inside the spec
- Reading selectors directly

If a spec does any of these, rewrite to assert the **UI consequence** of the action instead. The store is implementation detail; the rendered cart is the contract.

---

## 7. Apollo / GraphQL specifics

Many Angular apps use Apollo (`apollo-angular`). Three concerns for e2e:

- **Routing by `operationName`.** All GraphQL requests POST to the same endpoint with a body containing `{ operationName, variables, query }`. Intercepts must match on `req.body.operationName` (the project's `cy.mockGraphQL` / `cy.interceptGQL` wrapper typically does this).
- **Cache behaviour.** If Apollo's `fetchPolicy` is `cache-first` (default) and the SSR transfer-state populated the cache, the browser won't fire the query — see §1.
- **Field-policy merges.** If the production code uses `typePolicies.merge`, the spec doesn't care — it asserts on the final UI. If the merge is broken, the UI breaks; the e2e spec catches it as a UI failure.

---

## 8. Standalone components & dynamic imports

Angular 14+ standalone components and the `loadComponent` route API mean route components are bundle-split by default. As above (§5), the chunk fetch happens on first navigation. In headless mocked runs, ensure the dev server is running and the chunks are reachable. If `overrides.md` specifies a static-asset base URL, intercepts must whitelist it.

---

## 9. Angular-specific §6 additions

These layer on `core.md` §6 (universal forbid list):

- **Asserting Zone microtask timing.** Don't write specs that depend on "exactly one tick of change detection". Retry-ability handles it.
- **Asserting `ChangeDetectorRef` was called.** Implementation detail; assert on the rendered DOM.
- **Asserting `Renderer2` interactions.** Same: assert on rendered DOM.
- **Asserting on Apollo's `InMemoryCache` directly.** State tier; not e2e's concern.
- **Asserting on store snapshots (NgRx / Signal-store).** State tier; assert on UI.
- **PrimeNG / Material internals** — the open/close state of an overlay's CDK portal, the focus-trap behaviour, the panel's positioning class names. These are owned by the library. Assert on what the user sees (visibility, content, focus on the right element via `should('be.focused')`), not on the wrapper structure.

---

## 10. Project setup checklist

Before the project's e2e suite is ready for journey-style specs, the following helpers should exist (typically under `cypress/support/`). The project's `overrides.md` lists their exact paths and exported names. The author / reviewer must check this checklist as part of pre-flight; if a piece is missing, escalate to the user (toolkit additions are part of the workflow, but adding *all* of them at once is a bigger scope than per-spec authoring).

- [ ] `stripSSRTransferState()` helper — see §1
- [ ] `ngType` / `ngClearAndType` custom commands — see §2
- [ ] `cy.mockAuth()` / `cy.mockGuest()` (or equivalent) — set auth state without going through the real login UI
- [ ] `cy.mockGraphQL(...)` / `cy.interceptGQL(...)` (or REST equivalents) — bulk + single network mocking
- [ ] Page objects for every route + every overlay (cart sidebar, login dialog, mini-cart, search overlay)
- [ ] Fixture library at a known path (e.g. `cypress/fixtures/graphql/<domain>/`) — fixtures live here, not inline in specs
- [ ] A scoped run command in `package.json` (e.g. `cypress:run`, `cypress:run:staging`)
- [ ] A `data-cy` convention enforced in the codebase (lint rule or PR checklist)
