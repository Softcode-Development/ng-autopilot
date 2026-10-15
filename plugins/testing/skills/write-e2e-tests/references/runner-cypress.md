# Runner: Cypress

Cypress-specific syntax, primitives, and footguns. Universal rules live in `core.md`; framework-specific (Angular SSR, React Suspense, etc.) lives in `stack-<stack>.md`.

---

## 1. Test framework shape

Cypress wraps Mocha. The familiar BDD primitives are:

```ts
describe('Feature: Cart', () => {
  beforeEach(() => { ... });   // runs before every it()
  it('does X when Y', () => { ... });
  context('when guest', () => { ... }); // alias for describe()
});
```

- **One outer `describe` per spec file.** The orchestrator's queue is keyed off spec files, not outer describe titles.
- **`before` is rare in e2e.** `beforeEach` is the default. `before` accumulates global state across `it`s and is a common flake source — use only with a written justification.
- **No `it.only` / `describe.only` commits.** Use `--spec` on the CLI for focused runs; never commit `.only`. Reviewers reject.
- **No `it.skip` without a Flake ticket + comment** per `core.md` §10.

---

## 2. Selectors

Always go through page objects (`core.md` §11/§12). At the page-object level, the Cypress idiom is `data-cy`:

```html
<button data-cy="cart-add-to-cart-btn">Add to cart</button>
```

```ts
// Page object
const S = {
  addToCart: '[data-cy="cart-add-to-cart-btn"]',
  qtyInput: '[data-cy="cart-item-qty-input"]',
  subtotal: '[data-cy="cart-subtotal"]',
};
```

**Banned:**

- `cy.get('.btn-primary')` — CSS class
- `cy.get('#submit')` — ID; non-unique under SSR / repeated lists
- `cy.contains('Add to cart')` as the primary handle — translated text breaks on every i18n PR
- `cy.get('button').first()` — positional

**Allowed as a secondary filter** (after a `data-cy` anchor), not as the primary handle:

- `cy.get('[data-cy="line-items"]').find('[data-cy="line-item"]').eq(0)` — index into a known list
- `cy.get(S.modal).contains('button', 'OK')` — disambiguate within a scoped container

---

## 3. Retry-ability — what it is and what breaks it

Most Cypress commands **retry their last subject** until an assertion passes or the timeout (`defaultCommandTimeout`, default 4s) elapses. This is why `cy.get(X).should('have.length', 2)` works without an explicit wait.

### What loses retry-ability

- **`.then((subject) => {...})`** — once you accept the subject into a callback, Cypress can't retry the previous step. If the assertion inside the callback fails, the chain re-runs from the top, which is much more expensive (and often wrong).
- **`cy.wrap(...).should(...)`** — wrapping a non-jQuery value into the chain. Retry only re-evaluates the assertion, not the value extraction.
- **`cy.get(X).invoke('text')`** — `.invoke()` is final; reads the current text once. Use `should('contain.text', ...)` for retried text assertions.
- **Mixing async JS in a chain** — `await fetch(...)` interleaved with `cy.` commands. Don't. Use `cy.request(...)` or `cy.task(...)`.

### Implication

Prefer chained assertions over destructured-then-asserted values:

```ts
// ❌ no retry on the text content
cy.get(S.subtotal).invoke('text').then(text => {
  expect(text).to.contain('€42');
});

// ✅ retries until the assertion passes or timeout
cy.get(S.subtotal).should('contain.text', '€42');
```

When you need to capture a value for later comparison (e.g. "subtotal before and after"), use aliases:

```ts
cy.get(S.subtotal).invoke('text').as('before');
CartPO.increaseQuantity(0);
cy.wait('@AdjustOrderLine');
cy.get('@before').then(before => {
  cy.get(S.subtotal).should('not.have.text', before);
});
```

---

## 4. Waits & timeouts

### Forbidden

- `cy.wait(2000)` — static wait. Always wait on a signal instead.

### Required signals

- **Network alias** — `cy.wait('@AdjustOrderLine')` after `cy.intercept` set up the alias.
- **DOM mutation** — `cy.get(X).should('have.length', N)`, `should('be.visible')`, `should('not.exist')`.
- **URL** — `cy.url().should('include', '/cart')`.
- **State** — `cy.get(X).should('have.attr', 'aria-expanded', 'true')`.

### Custom timeouts

Pass `{ timeout: <ms> }` to a single command when the default 4s is genuinely too short (slow third-party render, animation):

```ts
cy.get(S.thirdPartyWidget, { timeout: 10000 }).should('be.visible');
```

Don't raise the global `defaultCommandTimeout` to mask flakes. If many specs need longer waits, the cause is upstream (slow dev server, slow API mock) — fix it there.

---

## 5. Network intercepts

```ts
cy.intercept('POST', '**/api/shop*', (req) => {
  if (req.body.operationName === 'AdjustOrderLine') {
    req.reply({ fixture: 'graphql/cart/adjusted-order.json' });
  }
}).as('AdjustOrderLine');

CartPO.increaseQuantity(0);
cy.wait('@AdjustOrderLine');
```

For GraphQL apps, route by `operationName`; for REST, route by method + URL pattern. Project wrappers (`cy.mockGraphQL`, `cy.interceptGQL`) exist in some codebases — `overrides.md` documents them.

### Unmocked requests

By default, Cypress passes through unmocked requests. **Flip this** in mock-first specs: unmocked requests should fail loudly so missing fixtures crash the test instead of silently calling the real API.

Two ways:

- Set a catch-all intercept at the start of `beforeEach` that responds with `{ statusCode: 500, body: { error: 'unmocked request' } }`.
- Use a project helper (`cy.mockGraphQL({...}, { allowPassthrough: false })`) — typical in projects with a wrapper. `overrides.md` documents the helper.

### Aliases are scoped per-test

`cy.intercept(...).as('foo')` only exists for the current test. `cy.wait('@foo')` in a sibling `it(...)` will fail. Set up intercepts in `beforeEach` if every test in the group needs them.

---

## 6. Authentication / sessions

For real-API specs that need a logged-in user, use `cy.session` to cache the auth state across tests in the same spec run:

```ts
beforeEach(() => {
  cy.session('user-alice', () => {
    cy.request('POST', '/api/auth/login', {
      email: Cypress.env('USER_EMAIL'),
      password: Cypress.env('USER_PASSWORD'),
    }).then(res => {
      window.localStorage.setItem('auth_token', res.body.token);
    });
  });
});
```

For mock-first specs, set the auth state directly in `beforeEach`:

```ts
beforeEach(() => {
  window.localStorage.setItem('auth_token', 'mock-token');
  cy.intercept('POST', '**/api/shop*', { /* mock customer query */ }).as('me');
});
```

Project wrappers (`cy.mockAuth()`, `cy.mockGuest()`, `cy.loginViaAPI()`) typically encapsulate this — `overrides.md` documents them.

---

## 7. Clock / fake timers

```ts
cy.clock();                    // freeze the clock at "now"
cy.clock(new Date(2026, 0, 1));// freeze at a specific date
cy.tick(1000);                 // advance 1000ms
cy.clock().invoke('restore');  // restore the real clock
```

Common e2e use case: a debounce inside the UI delays a request. Use `cy.clock()` + `cy.tick(debounceMs)` to advance past the debounce without sleeping.

**Gotcha:** `cy.clock()` only stubs `Date`, `setTimeout`, `setInterval`, `setImmediate`, `performance.now` in the **browser window**. Anything running in a Web Worker or Service Worker is not affected.

---

## 8. Form inputs

`cy.get(X).type('text')` works on plain `<input>` elements. For inputs wrapped by framework form controls (Angular reactive forms, React-Hook-Form custom controls), the framework's value-accessor may need a different event sequence than `.type()` emits. See `stack-<stack>.md` for framework-specific guidance and project-provided custom commands (e.g. `cy.ngType()` for Angular).

### Clearing inputs reliably

```ts
cy.get(X).clear().type('new value');     // standard
cy.get(X).type('{selectall}new value');  // for masked inputs that resist .clear()
```

---

## 9. File uploads

```ts
cy.get(S.fileInput).selectFile('cypress/fixtures/sample.pdf');
cy.get(S.fileInput).selectFile({
  contents: Cypress.Buffer.from('hello'),
  fileName: 'inline.txt',
  mimeType: 'text/plain',
});
```

For drag-and-drop dropzones, pass `{ action: 'drag-drop' }`.

---

## 10. Custom commands

Project-provided `cy.<name>` commands live in `cypress/support/commands/` (or equivalent — `overrides.md` lists them). They're declared in `cypress/support/index.d.ts` for TypeScript autocomplete.

Use existing commands. Adding a new one is part of the toolkit-extension flow described in the orchestrator workflow: file + types + index registration + usage example.

---

## 11. Cypress Studio / `.only`

Banned in committed specs:

- `it.only`, `describe.only`, `context.only` — focus markers from local iteration.
- `xit`, `xdescribe`, `xcontext` — skip markers without an open ticket (see `core.md` §10).
- Cypress-Studio-generated commands without a manual review — Studio writes click+type sequences without page objects; rewrite through the page object before committing.

---

## 12. Run commands

```bash
# Headed, interactive
npm run cypress:open

# Headless, single spec
npx cypress run --spec "<path/to/spec.cy.ts>"

# Headless, against a specific base URL (e.g. staging for real-API specs)
npx cypress run --spec "<spec>" --config baseUrl=https://staging.example.com
```

The exact npm scripts (`cypress:open`, `cypress:run`, `cypress:run:staging`) are project conventions — `overrides.md` lists them. The orchestrator passes the **exact scoped run command** to the author and reviewer; do not invent your own.

---

## 13. Coverage tooling

Cypress doesn't measure code coverage in production by default. Projects that want it install `@cypress/code-coverage` + instrumentation in the dev server. If `overrides.md` doesn't mention it, the project doesn't collect e2e coverage — **and that's fine**, because e2e coverage is measured behaviourally per `core.md` §6.1, not in lcov %.

---

## 14. Common Cypress footguns

- **Test isolation default.** Cypress 12+ defaults to per-test isolation: cookies, localStorage, and sessionStorage are cleared between `it(...)` blocks. If a spec relied on data leaking between tests, it was already broken — fix the spec, don't disable isolation.
- **Chained promises don't work the way you'd expect.** `cy.get(X).then(...)` returns a Cypress chainer, not a real Promise. Don't `await` it; let it chain.
- **`cy.wait(@alias)` waits for one matching call.** If the page fires the same operation twice (e.g. a query + a refetch), the second alias resolution is a separate `cy.wait('@alias')`. Don't write `cy.wait('@alias').wait('@alias')` defensively if only one call is expected; if both are expected, name them explicitly.
- **`should('exist')` retries; `expect(...).to.exist` doesn't.** Inside `.then` callbacks the assertion is synchronous. Prefer chained assertions.
- **`cy.window().its('foo')` retries property reads.** Useful for waiting on framework readiness (e.g. `cy.window().its('Apollo').should('exist')`).
- **`cy.visit` waits for `load`** by default. If the SPA defers route activation past `load`, follow with `cy.url().should('include', ...)` or wait on a `data-cy` on the route component.

---

## 15. Cypress-specific §6 additions

These layer on `core.md` §6 (universal forbid list):

- **`cy.screenshot` in assertions** — debug aid, not an assertion. If you want pixel-diff coverage, that's a separate tool (Percy / Applitools).
- **Asserting on `cy.window().console`** — `core.md` §6 already forbids console assertions; the Cypress-specific reminder is that mocking `console.error` to count calls is the same violation by another name.
- **Tests that depend on Cypress's internal retry timing** — anything that "only passes because retries happened to hit at 3.8s" is flake bait. Wait on an explicit signal.
