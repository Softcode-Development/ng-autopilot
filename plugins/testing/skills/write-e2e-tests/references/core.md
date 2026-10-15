# E2E Testing — Core Principles

Universal rules for end-to-end tests, **runner-agnostic and stack-agnostic**. These principles apply whether the project uses Cypress, Playwright, or WebdriverIO; whether the app is Angular, React, React Native, or Vue.

Read alongside:
- The active **runner** reference (`runner-<runner>.md`) for command/selector/network-intercept syntax
- The active **stack** reference (`stack-<stack>.md`) for framework-specific hydration, form-control, and SSR gotchas
- The project-specific `overrides.md` (if present)

These core rules are the floor — they cannot be loosened by runner/stack files or overrides. Runner/stack files and overrides only **add** rules.

---

## 1. Three-tier test taxonomy *(the test pyramid)*

| Tier | Lives in | Runs via | Scope |
|---|---|---|---|
| **Unit test** | `*.spec.ts` / `*.test.ts` next to source | the project's unit-test runner | One class/function. All collaborators mocked. |
| **Integration test** | same file extension, `describe`d "Integration:" | same runner | One feature slice with real collaborators in scope, mocked at the boundary. |
| **E2E test** | dedicated `cypress/`, `e2e/`, `tests/e2e/`, or `playwright/` suite | E2E runner | Real user journeys through a built app in a real (or headless) browser. **This skill.** |

This skill writes e2e tests only. The companion `write-unit-tests` skill owns the other two tiers.

---

## 2. Zero tolerance for smoke-check specs

An e2e "test" that visits a URL and asserts the root container exists is not a test. It tells you the route serves HTML; it tells you nothing about whether the feature works.

```ts
// ❌ NOT a test
it('renders the cart page', () => {
  cy.visit('/cart');
  cy.get('[data-cy="cart-page"]').should('exist');
});
```

The above passes if the cart is completely broken. **Reviewers must reject specs whose assertions would still pass on broken code.**

The minimum bar for any `it(...)` is: an action is taken, and an observable consequence of that action is asserted. If the action and the assertion don't share a causal link, the test is filler — delete it.

---

## 2.1 — Rules beat codebase convention

When the rules in these references disagree with patterns you see in **existing e2e specs in the repository**, the rules win. Existing specs that violate the rules are technical debt, not precedent — including specs that have been in the codebase for years, specs written by senior authors, and specs that other team members have referenced as "the way we test X here". A wrong pattern is wrong regardless of who wrote it or how widely it spread.

When you find a rule-violating pattern in existing specs:

- **Do not copy it into the new spec.** "We test it this way everywhere else" is not a defence — it makes the new spec wrong too.
- **Do not extend it.** Adding one more `it('renders the page')` because the sibling spec has six of them is propagation, not consistency.
- **Flag it.** List the pre-existing violations in your report under a "pre-existing violations to surface" section so the team can clean them up.

The single exception: when `overrides.md` documents a project-specific carve-out from a `core.md` rule. Project overrides extend the floor; existing-spec patterns do not.

---

## 3. Observe state change, not presence

For every user action in a test, ask: **"what changes as a result?"** and assert that. Asserting that the page element exists after visiting it tells you the route works — it tells you nothing about whether the feature works.

Acceptable state-change targets:

- **DOM state** — new node appears that was not there before, existing node updates its text/value, node count changes by a known amount
- **Computed values** — totals, counts, balances, prices, line-item subtotals
- **Navigation** — URL changed to the expected path / hash / query string
- **Network** — the expected mutation was fired with the expected payload (assert via `cy.wait(...)` + body inspection)
- **Storage** — localStorage / sessionStorage / cookie key set or cleared
- **UI feedback** — toast appeared, loading spinner appeared then disappeared, error banner shown
- **Disabled / enabled transitions** — submit button enables only after form is valid

Unacceptable assertions (the tautology family — flag and rewrite or delete):

- `cy.get('body').should('be.visible')`
- `cy.get('[data-cy="<page-root>"]').should('exist')` as the **only** assertion in a test
- `cy.url().should('satisfy', u => u.includes('/') )` — every URL on every site contains `/`
- `cy.url().should('include', '/foo').or('include', '/')` — disjunction with anything universally true
- "redirects to login or shows the page" without asserting **which one happened given the test's preconditions**

The **stub-passes test**: mentally replace the production handler with a stub that hardcodes the asserted output. If your test still passes, you're testing the framework or the runner — not your code. Delete the test.

---

## 4. Cover the full journey, not isolated atoms

A feature test for "cart" is not `visit('/cart')` + `expect page exists`. It's the full arc of what a user does with the feature.

Before you write a single `it(...)`, list every user-observable thing the feature supports. This is the scaffolding of your `describe` / `it` structure. If you can't list it, you don't understand the feature well enough to test it yet — read the components, services, and state effects first.

Example surface for "cart":

- Empty state — page shows empty message, checkout blocked or hidden
- Add one product from shop → sidebar reflects item, count updates
- Add from product page → same
- Navigate to cart page → line item shown with correct name/price/quantity
- Increase quantity → line total recomputes, subtotal recomputes, mutation fires
- Decrease quantity → same in reverse; at 0 or 1 the decrement behaviour matches spec
- Remove one item of two → other remains, totals update
- Remove last item → empty state reappears
- Apply coupon (valid) → discount line appears, total decreases
- Apply coupon (invalid) → error surfaced, total unchanged
- Persist across reload / route change → cart survives
- Checkout button → navigates (or blocks for guest — assert which it is)
- Guest vs. logged-in differences (if any)

Not every spec covers every bullet, but enumerating the surface forces an explicit scope decision rather than "I'll just visit the page and see what happens".

---

## 5. Behaviour-list discipline

Write the behaviour list as a comment block at the top of the spec file **before** any `describe(...)` code. Lines are flat `verb + object + condition` statements grouped by user-journey segment.

After authoring, every bullet must correspond to exactly one `it(...)` block. **Parity is exact, 1:1**, enforced in the author's self-check and by the reviewer.

- Extra `it(...)` → real behaviour discovered mid-authoring (update the comment block) or scaffolding artefact (delete it).
- Extra bullet → spec incomplete (write the missing test) or §6 violation that should be skipped (remove from list, note in report).

Drift is not allowed.

### 5.1 — Edge case enumeration

For each behaviour, enumerate the variants:

- **Empty** — list of length 0, empty string, no selection
- **Boundary** — min, max, exactly-the-threshold values (qty 1 → 0, last item removed, max coupon stack)
- **Invalid** — bad coupon code, expired session, OOS product, declined card
- **Error** — backend returns 4xx/5xx, network fails mid-mutation, timeout
- **Pre-conditioned states** — already logged in, mid-checkout, cart preloaded

If an edge case is reachable but you chose not to cover it, document the reason in the behaviour-list comment (e.g. "OOS error path — covered by unit test on `add-to-cart.effect.ts`; e2e covers happy path only"). If an edge case is **unreachable** (type system forbids it, route guard prevents it, feature flag gates it off in this env), document the invariant. Unreachable ≠ skipped.

---

## 6. §6 — What We Explicitly Do NOT Test *(test behaviour, not implementation)*

E2E coverage isn't the goal — confidence in real user flows is. Anything that is better covered at a lower tier or owned by a third party doesn't belong in an e2e spec.

| Not tested in e2e | Why | Where it gets tested instead |
|---|---|---|
| **Pure component logic** — a directive's transform, a pipe's output, a reducer's state shape | Slow, brittle, and the unit tier owns it. | Unit / integration tests. |
| **Framework wiring** — that the router navigates, that an HTTP interceptor attaches a header, that a guard runs | Framework-owned. Trust it. | Unit tests for guards/interceptors; framework owns the rest. |
| **Page-metadata wiring** — page title, meta tags, OG/SEO tags, canonical URL, favicon | Static branding; payload doesn't change with user input. | SEO smoke test or visual review. |
| **Translated UI text** — asserting a specific English (or any-language) string in a button label | Specs break on every translation update. Assert on `data-cy` selectors or i18n keys. | Translation review; visual regression. |
| **Pixel-level visual layout** — colours, font sizes, exact spacing | Wrong tool. Visual regression suites handle this. | Percy / Chromatic / Playwright screenshot diffs. |
| **Third-party widgets' internals** — Stripe Elements rendering, Google Maps tiles loading | Owned by the vendor. | Vendor's own tests. Stub the integration boundary. |
| **Generated routes / generated forms** — when scaffolded entirely by config and the framework | Declarative config; mistakes caught by build. | Build / type-check. |
| **`console.*` output** | Brittle and PII-risky. | Never assert console text. Logger payload assertions only at lower tier. |
| **Implementation-internal selectors** — `.btn-primary`, `#root > div > div`, `nth-child(3)` | Couples specs to CSS/refactors. | Use `data-cy` / `data-testid` only. |
| **Smoke `should exist` assertions on root containers** | Tautological; passes on broken pages. | Replace with a state-change assertion. |
| **Auth provider's own login UI flow** (e.g. Auth0 hosted login) | Owned by the provider. Use API-level login for setup; assert only the *return-to-app* state. | Provider's own QA. |

The **stub-passes test** applies here: *if the test would still pass after deleting the production code and replacing it with a stub that returns the right shape, you're testing the framework, not your code. Delete the test.*

The active `stack-<stack>.md` may add framework-specific entries (e.g. hydration markers for SSR, RN gesture handlers for React Native). The active `runner-<runner>.md` may add runner-specific entries (e.g. Cypress retry-ability assumptions). Project `overrides.md` may add domain-specific entries (e.g. "do not e2e payment flows — covered by partner contract tests").

---

## §6.1 — Coverage Pursuit: Hit the §6 Ceiling, Then Stop

§6 is what we don't test. Everything else inside the **feature's user-observable surface** (Step 1 above), we do — and we exhaust the surface before declaring the spec done.

### What "the ceiling" means for e2e

E2E coverage is not measured in lcov %. The ceiling is a **behavioural ceiling**: every bullet in the feature's behaviour surface that is not §6-blocked has a corresponding `it(...)` that asserts a state change.

### How to compute the ceiling

1. Enumerate the feature's behaviour surface (§4).
2. For each bullet, classify:
   - **Covered** — there is an `it(...)` whose action and assertion correspond to this bullet.
   - **§6-blocked** — covered at a lower tier or excluded by §6. Document with one-line reason.
   - **Uncovered, reachable** — still in scope. Spec is **below ceiling** until each is covered.
3. The ceiling claim is: *every uncovered bullet maps to a §6-blocked archetype or has explicit unreachable-reason documentation*.

### §6-blocked archetypes (stop-condition list)

When remaining uncovered behaviour all maps to one of these, the spec is at ceiling:

- **Pure logic verified at unit tier** — branch is covered by an existing unit/integration test; e2e duplication adds no signal.
- **Third-party-owned flow** — payment gateway redirect, OAuth provider page, captcha challenge.
- **Visual / pixel concern** — covered by visual regression.
- **Translated string concern** — covered by i18n review.
- **Environment-gated** — feature flag is off in the test env; assert the gate elsewhere.
- **Dead behaviour** — entry point exists but is unreachable in the running app (removed CTA, commented route).

Anything else uncovered is reachable behaviour the spec is missing. Keep writing tests.

---

## 7. Test naming

Test names are read in CI output, in the runner UI, and on every failure. They describe the **behaviour**, not the implementation.

### Good

- `'adds a product to the cart and reflects it in the sidebar'`
- `'recomputes subtotal when quantity is increased'`
- `'shows the empty-state message after the last item is removed'`
- `'redirects guests to /login when the protected route is requested'`
- `'persists cart contents across a page reload'`

### Bad — describes the call site, not the behaviour

- `'calls AdjustOrderLine mutation'` — names a network call, not the user-observable result
- `'invokes onAddToCart'` — names a handler
- `'dispatches AddItem action'` — names an effect at the wrong tier
- `'sets cartCount on the store'` — names a private state mutation
- `'cart page exists'` — tautology

### Bad — describes a lifecycle hook

- `'on init'`, `'after view init'`, `'constructor'` as `describe` block names

The fix: rewrite the title around the **observable effect** — or delete the test if no observable effect exists.

---

## 8. Assertions: assert only what matters

For each behaviour, assert on the **fewest assertions** that prove the behaviour happened. Padding with `should('be.visible')` on every adjacent node is noise that camouflages real failures.

### Specifically

- **One action per `it(...)`** — click, type, navigate, submit. Multiple actions belong in separate `it`s, or in the `beforeEach` of a nested `describe`.
- **One observable effect per `it(...)`** — the consequence of the action. If you're asserting three unrelated effects, you have three tests.
- **Exact match where it matters, partial match elsewhere** — assert `subtotal === expected_total`, not `subtotal.includes('1')`. Assert text content with `should('contain.text', ...)` when the surrounding markup may vary.
- **Wait on the consequence, not on time** — `cy.wait(2000)` is a flake source. Wait on the network call (`cy.wait('@AdjustOrderLine')`) or the DOM change (`cy.get(...).should('have.length', 2)`) instead.

### Exact call counts

`toHaveBeenCalledTimes(N)` / asserting that a mutation fired exactly N times is a violation unless the test name explicitly names the contract that fixes N (e.g. "fires AdjustOrderLine exactly once per quantity bump — debounced"). Generic "N mutations for N items" assertions fail this check. Assert per-call payloads instead, or drop the count assertion.

---

## 9. Network / API layer

Two modes; pick one per spec, never mix in the same `describe`.

### Mock-first (default)

Default to mock-based tests using the runner's network-intercept primitives + project fixtures. Mocks are:

- **Fast** — no real backend round-trip.
- **Deterministic** — no flake from upstream rate limits, DB state, deploy timing.
- **Isolating** — failures point at the UI, not the API.

**Rule:** mock **every** outbound request the feature touches. Leaving a real request unmocked invites flakes, races, and PII leaks. If the runner's default for unmocked requests is "pass through", flip it to "fail loudly" so missed mocks crash the spec instead of papering over a gap (runner-specific configuration in `runner-<runner>.md`).

### Real-API (opt-in, rare)

Real-API tests exist for:

- **Critical end-to-end golden paths** — full order placement, full auth lifecycle (one or two per project, no more).
- **Contract verification** — schema field shape, nullability, enum values. Catch FE↔BE drift at PR time, not in prod.
- **Known past regressions** — once a real-API bug slipped through mocked tests, add a real-API regression spec.

Real-API specs are slower, flakier, and require staging credentials. Keep them in a separate `describe` (or a separate spec file) with a clear marker (e.g. filename suffix `*.real.cy.ts`, or a tag). If you're about to write a real-API test and the user didn't explicitly request one, **stop and confirm**.

---

## 10. Anti-flake

E2E tests are the slowest tier; flakes erode trust faster than coverage gaps. The flake budget per project is approximately zero — every flake is investigated and rooted out, not retried.

### Forbidden

- **Static `wait(ms)`** — `cy.wait(2000)`, `page.waitForTimeout(2000)`. Wait on the observable signal.
- **Polling assertions with manual loops** — let the runner's built-in retry-ability do this. `should(...)` retries by default.
- **Order-dependent specs** — a spec that only passes after another spec ran has hidden state. Each spec must be independently runnable.
- **Sleeping to let animations finish** — wait on `aria-hidden` flipping, on the focus moving, on the animation-end event, or disable animations in the test build.
- **Real `setTimeout`/`setInterval` in the UI that the test depends on** — if a debounce, throttle, or polling interval matters to the assertion, mock the clock at the runner level OR mock the network responses to be instant and assert on the post-debounce state with retry-ability.
- **Random data without a seed** — `Math.random()`, `Date.now()` directly inside a spec body. Seed the data or fix the clock.
- **Shared state between specs** — leftover cookies, persisted state, fixture mutations. Each spec starts from a known clean slate (clear cookies / localStorage / IndexedDB in `beforeEach`, or use the runner's isolation primitive).

### Required

- **Wait on the consequence.** Network alias, DOM mutation, URL change, attribute flip.
- **Idempotent `beforeEach`.** The same setup runs identically on retry. No "if this row exists, skip seed" branches.
- **Clean test data.** Builders / factories produce minimal fixtures. No leftover PII, no real customer data.
- **Single failure mode.** When a spec fails, it fails for **one** reason. If a flake intermittently appears as a different stack trace, fix the test design — don't add a retry.

### Quarantining a flake

If a flake is found and the root cause is not yet diagnosed:

1. Open a ticket / issue with the failure trace.
2. Mark the spec with `.skip` AND a comment: `// Flake root cause: <hypothesis>. Ticket: <link>.`
3. Surface in the report; do **not** silently merge with a retry knob.

Reviewers reject skipped tests without an open ticket and a root-cause comment.

---

## 11. Selectors

The only acceptable selector convention is a **dedicated test attribute** the production code attaches on purpose:

- `data-cy="<feature>-<element>"` — Cypress convention.
- `data-testid="<feature>-<element>"` — Playwright / Testing Library convention.
- The project may pick one and document it in `overrides.md`.

**Banned:**

- CSS class selectors (`.btn`, `.cart-item`) — change on every CSS refactor.
- ID selectors (`#submit`) — non-unique under SSR hydration, repeated on dynamic lists.
- Tag selectors (`button:nth-child(3)`) — positional, breaks on reorder.
- Text-content selectors that depend on translated copy (`cy.contains('Add to cart')`) — break on every i18n update. (Exception: a single primary CTA in a region with no translation pressure, documented in `overrides.md`.)
- Aria roles **as the only selector** — fine as a secondary disambiguator (`role + name`), not as the primary stable handle.

When you need a selector that doesn't exist yet:

1. Add the `data-cy` / `data-testid` attribute to the component template.
2. Add it to the relevant page object's selector map.
3. Expose a method on the page object if the selector will be used more than once.

Inline raw selectors in the spec are a smell. Page objects centralise selectors so refactors update one file, not twenty.

---

## 12. Page objects (or equivalent abstraction)

Specs assert *what* happened. Page objects describe *how* to drive the UI to make it happen. Mixing the two makes specs unreadable and makes refactors painful.

### Each page / overlay gets a page object

A page object exposes:

- A **selector map** — `data-cy` strings, grouped by region.
- **Action methods** — `clickAddToCart(productIndex)`, `setQuantity(itemIndex, qty)`, `submitCoupon(code)`. Methods perform one user action.
- **Query methods** — `getLineItems()`, `getSubtotal()`, `getEmptyMessage()`. Methods return a Cypress chainer / Playwright locator the spec asserts on. **They do not assert.**
- **Navigation helpers** — `navigate(...)`, `navigateAndWait(...)` if the page needs settle-time before assertions.

Page objects compose: a `CheckoutPage` may delegate to a `CartSidebar` page object for the cart-confirmation section. Compose, don't duplicate.

### Anti-pattern: assertions inside page objects

```ts
// ❌ couples the page object to a specific assertion shape
class CartPO {
  expectSubtotal(expected: string) {
    cy.get(S.subtotal).should('contain.text', expected);
  }
}
```

This works fine until two different specs want different assertions on the same node — then you're either duplicating the method or extending the page object every PR. Have page objects return chainers; let specs assert.

```ts
// ✅ spec owns the assertion
CartPO.getSubtotal().should('contain.text', '€42.00');
CartPO.getSubtotal().invoke('text').as('before');
```

---

## 13. Test data — minimal, PII-free, fixture-backed

- **Builders / factories** — every reusable fixture lives behind a builder. Hand-assembled multi-field objects inside spec files are toolkit debt; flag and migrate.
- **PII-free** — no real names, emails, phone numbers, addresses. Use deterministic synthetic data (`alice@example.test`, `+10000000000`). Reviewers reject specs with PII in fixtures, mocks, or assertions.
- **Realistic shape** — fixtures should match the production response shape exactly. The fastest way to author a new fixture is to copy a real response from a dev / staging environment and strip sensitive fields. **Do not invent fields the backend doesn't return**; the spec will pass on data that production will never produce.
- **Minimal** — only the fields the spec asserts on need to be realistic. Other fields can be defaulted in the builder. A 200-field fixture obscures what the test actually cares about.

---

## 14. AAA structure inside `it(...)`

Every `it(...)` block has three sections, in order:

1. **Arrange** — test-specific setup. Shared setup belongs in `beforeEach`. Intercepts that this specific block depends on are arranged here, not in `beforeEach`.
2. **Act** — exactly one user action: click, type, submit, navigate.
3. **Assert** — the observable consequence(s) of the act.

Logic in test bodies (`if`, `for`, `.forEach`, `.map` over assertions, ternaries on expected values, computed expected values) is forbidden — they hide branches inside the test and turn one `it(...)` into N invisible tests. Repeat the assertion or split into separate `it(...)` blocks.

```ts
// ❌ branch hidden inside the test
it('adjusts quantity', () => {
  CartPO.increaseQuantity(0);
  if (isLoggedIn) {
    CartPO.getSubtotal().should('contain.text', '€84');
  } else {
    CartPO.getSubtotal().should('contain.text', '€42');
  }
});

// ✅ one test per branch
describe('when logged in', () => {
  beforeEach(() => cy.mockAuth());
  it('adjusts quantity and recomputes subtotal with member discount', () => { ... });
});
describe('when guest', () => {
  beforeEach(() => cy.mockGuest());
  it('adjusts quantity and recomputes subtotal without member discount', () => { ... });
});
```

---

## 15. File structure & spec organisation

The project's e2e folder should partition by **purpose**, not by URL:

- `critical/` — cross-page user journeys (auth, browse, cart, checkout). A single spec walks through multiple pages.
- `pages/` — per-page deep coverage (cart-page controls, shop filters, profile sub-pages).
- `interactions/` — things that cut across pages but aren't full journeys (sidebars, search, language switch, breadcrumbs, responsive layout, vehicle selector).
- `layout/` — navigation, footer across viewports.

The exact folder names are a project convention — `overrides.md` documents them. The point is: every spec has a clear home, and a reader can browse the folder names and predict what kind of spec lives where.

Within a spec:

- One outer `describe('<Feature>: <variant>')` per spec file.
- Inner `describe` per behaviour group (`'Empty state'`, `'Adding from shop'`, `'Cart page controls'`).
- One `it(...)` per behaviour-list bullet.
- `beforeEach` in the right scope — global setup at the outer level, per-group setup inside the inner `describe`.

---

## 16. When reworking an existing weak spec

Don't incrementally patch a weak test. If the spec is shallow, rewrite it from scratch using this workflow:

1. Read the components, services, and effects under test to understand the full behaviour surface (§4).
2. Delete the old spec (or keep it around long enough to migrate any useful fixtures/selectors into the page object / toolkit).
3. Write the `describe` / `it` scaffold first, journey-style, before filling in bodies (§5).
4. Fill in bodies with state-change assertions (§3 / §14).
5. Run; confirm failures correspond to real UI breakage. **Mutation test:** comment out a line of the production handler — does the spec still pass? If yes, the assertions aren't tight enough.

Reviewers must flag specs that were "improved" by adding assertions to a weak skeleton; the underlying structure usually needs the full rewrite.

---

## 17. Quick checklist before marking a spec done

- [ ] Behaviour-list comment block at top of file; parity 1:1 with `it(...)` blocks
- [ ] Every meaningful user action exercises a mutation, navigation, or state transition
- [ ] Each action's consequence is asserted (DOM, computed value, network mutation, URL, toast, disabled→enabled)
- [ ] Empty, loading, and error states are covered (or marked §6-blocked / unreachable)
- [ ] Persistence is covered (reload / cross-route navigation) where applicable
- [ ] Guest vs. logged-in paths are covered where behaviour differs
- [ ] All selectors go through page objects; no raw class / ID / tag selectors in the spec
- [ ] Framework-specific input commands used for form fields (see `stack-<stack>.md`)
- [ ] SSR / hydration setup performed before first navigation if the stack requires it (see `stack-<stack>.md`)
- [ ] Mocks cover every outbound request the feature fires; unmocked requests fail loudly
- [ ] No static `wait(ms)`; all waits are on observable signals
- [ ] No `console.*` assertions, no translated-text assertions, no implementation-internal selectors
- [ ] No PII in fixtures, assertions, or commit
- [ ] The spec passes — and you've mentally verified that the assertions would fail on broken code (mutation test)
