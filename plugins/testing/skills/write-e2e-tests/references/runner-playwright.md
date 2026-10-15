# Runner: Playwright

Playwright-specific syntax, primitives, and footguns. Universal rules live in `core.md`; framework-specific (Angular SSR, React Suspense, etc.) lives in `stack-<stack>.md`.

Playwright's idioms diverge from Cypress in several load-bearing ways: locators are first-class objects (not chainers), assertions auto-retry through `expect(locator).toX(...)` rather than `should(...)`, and the runner exposes JS Promises directly instead of wrapping everything in a chainer. The patterns below assume Playwright 1.45+; the `browser.bind` integration in `core.md` and project overrides requires Playwright 1.59+.

---

## 1. Test framework shape

Playwright ships its own test runner (`@playwright/test`) — not Mocha, not Jest. The primitives:

```ts
import { test, expect } from '@playwright/test';

test.describe('Feature: Cart', () => {
  test.beforeEach(async ({ page }) => { ... });   // runs before every test()
  test('does X when Y', async ({ page }) => { ... });
  test.describe('when guest', () => { ... });     // nested suite
});
```

- **One outer `test.describe` per spec file.** The orchestrator's queue is keyed off spec files, not outer describe titles.
- **`test.beforeAll` is rare in e2e.** `test.beforeEach` is the default. `beforeAll` accumulates global state across tests and is a common flake source — use only with a written justification.
- **No `test.only` / `test.describe.only` commits.** Use `--grep "AS-N"` (or `--grep` on a unique spec title) on the CLI for focused runs; never commit `.only`. Reviewers reject.
- **No `test.skip` / `test.fixme` without a quarantine ticket** per `core.md` §10.
- **`page` is a fixture, not a global.** Every test that touches the browser destructures `{ page }` from the test callback's arguments. Other fixtures (`browser`, `context`, `request`) follow the same pattern. `core.md` §12 page-object methods take a `Page` argument.

### Custom fixtures (`test.extend`)

Cypress projects often have `cy.<name>` custom commands; the Playwright idiom is **typed fixtures via `test.extend`**:

```ts
// apps/e2e/src/support/test.ts
import { test as base } from '@playwright/test';
import { CartPage } from '../page-objects/cart.po';

type Fixtures = {
  cartPage: CartPage;
  loggedInUser: { email: string; token: string };
};

export const test = base.extend<Fixtures>({
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  loggedInUser: async ({ page, context }, use) => {
    await context.addCookies([/* auth cookie */]);
    await use({ email: 'test@example.invalid', token: 'fake-token' });
  },
});

export { expect } from '@playwright/test';
```

Specs then import from `support/test` instead of `@playwright/test` and destructure the custom fixtures directly. The project's `overrides.md` lists the fixture set.

---

## 2. Selectors

Playwright locators auto-wait, auto-retry, and compose. The recommended selector priority comes from `core.md` §11 and the project's `overrides.md`:

```ts
// Priority 1 — role + accessible name (preferred; mirrors what assistive tech sees)
page.getByRole('button', { name: /add to cart/i });
page.getByRole('heading', { level: 2, name: 'Your cart' });

// Priority 2 — label / placeholder for form fields
page.getByLabel('Email');
page.getByPlaceholder('you@example.com');

// Priority 3 — test attribute, only when role/label can't disambiguate
page.getByTestId('cart-subtotal');           // matches [data-testid="..."] by default
page.locator('[data-cy="cart-subtotal"]');   // if the project uses data-cy, configure via testIdAttribute
```

Configure the test-attribute name in `playwright.config.ts` if the project uses `data-cy` instead of `data-testid`:

```ts
use: {
  testIdAttribute: 'data-cy',
},
```

**Banned** (per `core.md` §11):

- CSS class selectors (`.btn-primary`) — change on every CSS refactor.
- ID selectors (`#submit`) — non-unique under SSR hydration, repeated on dynamic lists.
- Tag + positional selectors (`button:nth-child(3)`) — break on reorder.
- `getByText('Exact translated string')` as the primary handle — translation-fragile.

**Allowed as a secondary filter** (after a role / label / testid anchor):

```ts
page.getByRole('listitem').filter({ has: page.getByText('Coffee') });
page.getByTestId('line-items').getByRole('listitem').nth(0);
```

---

## 3. Auto-waiting — what it is and what breaks it

Playwright's **actions** (`click`, `fill`, `selectOption`, etc.) auto-wait for the target element to be **actionable**: attached, visible, stable (not animating), enabled, receives events. The default action timeout is 30s; the project overrides it via `playwright.config.ts`.

Playwright's **`expect(locator).toX(...)`** assertions auto-retry until they pass or the assertion timeout (default 5s) elapses.

### What loses auto-waiting

- **`locator.textContent()` / `innerText()` / `getAttribute()`** — these are **one-shot reads**. They return the current value once and do not retry. Use `expect(locator).toHaveText(...)` / `toHaveAttribute(...)` for retried text/attribute assertions.
- **`locator.evaluate(...)`** — evaluates a JS function in the browser context once. The result is not retried. Use `expect.poll(...)` if you must retry a custom predicate.
- **Mixing JS async with locators** — `const text = await locator.textContent(); if (text === 'X') { ... }` is one-shot. Use `await expect(locator).toHaveText('X')`.
- **`waitForSelector(..., { state: 'attached' })` followed by manual assertions** — `waitForSelector` returns the element handle once it appears, but a subsequent `.textContent()` is one-shot. Skip `waitForSelector` and let the next `expect(locator).toX(...)` do the waiting.

### Implication

Prefer chained `expect` assertions over destructured-then-asserted values:

```ts
// ❌ no retry on the text content; brittle
const text = await page.getByTestId('cart-subtotal').textContent();
expect(text).toContain('€42');

// ✅ retries until the assertion passes or timeout
await expect(page.getByTestId('cart-subtotal')).toContainText('€42');
```

When you need to capture a value for later comparison (e.g. "subtotal before and after"):

```ts
const subtotal = page.getByTestId('cart-subtotal');
const before = await subtotal.textContent();
await cartPage.increaseQuantity(0);
await expect(subtotal).not.toHaveText(before ?? '');
```

---

## 4. Waits & timeouts

### Forbidden

- `page.waitForTimeout(2000)` — static wait. Always wait on a signal instead.
- `await new Promise(r => setTimeout(r, 2000))` — same violation, different wrapper.

### Required signals

- **Network response** — `await page.waitForResponse(url => url.includes('/cart/adjust'))`.
- **DOM state** — `await expect(locator).toHaveCount(2)`, `await expect(locator).toBeVisible()`, `await expect(locator).toBeHidden()`.
- **URL** — `await expect(page).toHaveURL(/\/cart$/)`.
- **Attribute** — `await expect(locator).toHaveAttribute('aria-expanded', 'true')`.
- **Computed value** — `await expect.poll(async () => store.getState().cartCount).toBe(2)` for custom predicates.

### Custom timeouts

Pass `{ timeout: <ms> }` to a single expect or action when the default is genuinely too short (slow third-party render, animation):

```ts
await expect(page.getByTestId('third-party-widget'), { timeout: 10_000 }).toBeVisible();
await page.getByRole('button', { name: 'Submit' }).click({ timeout: 10_000 });
```

Don't raise the global `expect.timeout` to mask flakes. If many specs need longer waits, the cause is upstream (slow dev server, slow API mock) — fix it there.

---

## 5. Network intercepts (`page.route`)

```ts
await page.route('**/api/cart/adjust', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(adjustedOrderFixture),
  });
});

await cartPage.increaseQuantity(0);
await page.waitForResponse('**/api/cart/adjust');
```

For GraphQL, route by request body's `operationName`:

```ts
await page.route('**/graphql', async (route) => {
  const body = JSON.parse(route.request().postData() ?? '{}');
  if (body.operationName === 'AdjustOrderLine') {
    return route.fulfill({ status: 200, body: JSON.stringify(adjustedOrderFixture) });
  }
  return route.fallback();
});
```

### Unmocked requests

By default, `page.route` only intercepts the patterns you specify; unmocked URLs pass through to the real server. **Flip this** in mock-first specs: unmocked requests should fail loudly so missing fixtures crash the test instead of silently calling staging or production.

Two ways:

- Set a catch-all route at the start of `beforeEach` that fulfills with `{ status: 599, body: '{ "error": "unmocked request" }' }`:

```ts
await page.route('**/api/**', (route) => {
  return route.fulfill({ status: 599, body: '{"error":"unmocked"}' });
});
// then register specific intercepts that take precedence over the catch-all
```

- Use a project helper from `apps/e2e/src/network/` (`overrides.md` documents the helper).

### Route scope

`page.route` is scoped to the **current `page`** fixture and unsubscribed when the test ends. For cross-test routes, install them in `context.route(...)` from a `beforeEach` that takes `{ context }`, or extend the test fixture with a route-setup helper.

---

## 6. Authentication / sessions

Playwright's idiom is **stored auth state**, not Cypress's `cy.session`. The pattern:

1. **Run a setup project once** that logs in via the API and saves `storageState` (cookies + localStorage) to disk.
2. **Configure spec projects to load that `storageState`** in `playwright.config.ts`.

```ts
// playwright.config.ts
projects: [
  {
    name: 'setup',
    testMatch: /.*\.setup\.ts/,
  },
  {
    name: 'authenticated',
    testMatch: /.*\.e2e\.ts/,
    dependencies: ['setup'],
    use: { storageState: 'playwright/.auth/user.json' },
  },
  {
    name: 'guest',
    testMatch: /.*\.guest\.e2e\.ts/,
    use: { storageState: { cookies: [], origins: [] } },
  },
],
```

```ts
// auth.setup.ts
import { test as setup } from '@playwright/test';

setup('authenticate as alice', async ({ page, request }) => {
  const res = await request.post('/api/auth/login', {
    data: { email: process.env['USER_EMAIL'], password: process.env['USER_PASSWORD'] },
  });
  const { token } = await res.json();
  await page.goto('/');
  await page.evaluate((t) => window.localStorage.setItem('auth_token', t), token);
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
```

For mock-first specs, skip the setup project and seed the auth state inline in `beforeEach`:

```ts
test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => {
    window.localStorage.setItem('auth_token', 'mock-token');
  });
  await page.route('**/api/me', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ id: 'user-1' }) }),
  );
});
```

Project wrappers (`mockAuth(page)`, `loginViaAPI(request)`, `setLocale(page, 'lt')`) typically live in `apps/e2e/src/support/` — `overrides.md` documents them.

---

## 7. Clock / fake timers — `page.clock` (Playwright 1.45+)

```ts
await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });

// inside the test:
await page.clock.fastForward('00:00:01');  // advance 1 second
await page.clock.runFor(500);              // run timers for 500ms (synchronous browser-side)
await page.clock.pauseAt(new Date(...));   // pause time at a specific moment
```

| Need | Playwright API |
|---|---|
| Freeze time at install | `page.clock.install({ time: <Date> })` |
| Advance time (drives timers) | `page.clock.fastForward(<duration>)` |
| Run pending timers without advancing wall time | `page.clock.runFor(<ms>)` |
| Pause time at a specific moment | `page.clock.pauseAt(<Date>)` |
| Set time without driving timers | `page.clock.setFixedTime(<Date>)` |

Common e2e use case: a UI debounce delays a request. Use `page.clock.install` + `page.clock.fastForward` to advance past the debounce without sleeping.

**Gotcha:** `page.clock` only stubs the **browser-side** `Date`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `performance.now`. Anything running in a Web Worker, Service Worker, or on the server (Node-side fixtures, MSW Node handlers) is not affected. For older Playwright versions (< 1.45), Sinon-style time stubbing must be injected via `page.addInitScript`.

---

## 8. Form inputs

`page.getByLabel(X).fill('text')` works for plain `<input>` / `<textarea>` — `fill` clears the field, focuses, sets value, fires `input` and `change` events.

For inputs wrapped by framework form controls (Angular reactive forms, React-Hook-Form custom controls), `.fill()` usually triggers the framework's value-accessor correctly because it fires real DOM events. If the control swallows events or expects keystroke timing, use `pressSequentially`:

```ts
await page.getByLabel('Email').pressSequentially('user@example.com', { delay: 50 });
```

See `stack-<stack>.md` for framework-specific gotchas (Angular's `ControlValueAccessor` interactions, masked inputs, contenteditable).

### Clearing inputs reliably

```ts
await page.getByLabel('Quantity').fill('');               // standard clear
await page.getByLabel('Quantity').press('Control+A');     // select all (Cmd on macOS)
await page.getByLabel('Quantity').press('Delete');
```

### Keyboard shortcuts

```ts
await page.keyboard.press('Escape');
await page.locator('body').press('Meta+K'); // OS-aware: Cmd on macOS, Meta on others
```

Note: `Meta` is `Cmd` on macOS and the Windows key elsewhere. For cross-platform tests, prefer `ControlOrMeta` which Playwright resolves at runtime.

---

## 9. File uploads

```ts
await page.getByLabel('Upload receipt').setInputFiles('fixtures/sample.pdf');

// Inline content
await page.getByLabel('Upload receipt').setInputFiles({
  name: 'inline.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('hello'),
});

// Multiple files
await page.getByLabel('Upload photos').setInputFiles([
  'fixtures/photo-1.jpg',
  'fixtures/photo-2.jpg',
]);

// Clear selected files
await page.getByLabel('Upload receipt').setInputFiles([]);
```

For drag-and-drop dropzones that don't expose a native `<input type="file">`, use `page.evaluate` to dispatch a synthetic `DataTransfer` event, or wrap the pattern in a page-object method.

---

## 10. `browser.bind` (Playwright 1.59+) — shared browser via MCP

`browser.bind` lets the test runner connect to an existing browser instance rather than launching its own. The MCP-driven workflow described in `core.md` and the project's `overrides.md` uses this to share a single browser across the whole run (cold-start cost off the critical path, easy visual observation of the running browser by the author/reviewer agent).

```ts
// Conceptual — exact wiring is project-specific; overrides.md documents it
const browser = await playwright.chromium.bind({ wsEndpoint: process.env.PW_BIND_WS });
const context = await browser.newContext();
const page = await context.newPage();
```

**Do not use `browser.launch()` in specs when the project uses `browser.bind`** — launching a fresh browser per spec defeats the shared-instance design and is a `core.md` / `overrides.md` violation.

For projects without `browser.bind` configured (typical greenfield setups), the runner launches a browser per worker — the project's `overrides.md` will not mention `browser.bind` and the default launch behaviour applies.

---

## 11. `test.only` / `test.fixme` / `test.skip`

Banned in committed specs:

- `test.only`, `test.describe.only` — focus markers from local iteration.
- `test.skip` without an open ticket comment (`core.md` §10).
- `test.fixme` without an open ticket comment — same as skip, different verb.

The project's ESLint config typically includes `eslint-plugin-playwright`'s `no-focused-test` and `no-skipped-test` rules.

---

## 12. Run commands

```bash
# Run the whole suite
pnpm exec playwright test

# Run a single spec
pnpm exec playwright test path/to/spec.e2e.ts

# Run tests matching a title pattern (useful for AS-N: scoped runs)
pnpm exec playwright test --grep "AS-3:"

# Run a single project
pnpm exec playwright test --project=authenticated

# Headed mode (visible browser)
pnpm exec playwright test --headed

# UI mode (Playwright's interactive runner)
pnpm exec playwright test --ui

# Show trace for the last run
pnpm exec playwright show-trace test-results/<failing-test>/trace.zip
```

Project npm scripts (`e2e`, `e2e:headed`, `e2e:debug`) wrap these — `overrides.md` lists the exact commands. The orchestrator passes the **exact scoped run command** to the author and reviewer; do not invent your own.

---

## 13. Trace, screenshots, video

Configure in `playwright.config.ts`:

```ts
use: {
  trace: 'on-first-retry',    // 'off' | 'on' | 'retain-on-failure' | 'on-first-retry'
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
},
```

Traces are zip files containing snapshots, network log, console log, and timing. Open with `playwright show-trace <trace.zip>`. The reviewer agent inspects traces when diagnosing a flake or a "should be passing" failure.

**Do not commit trace files.** They're written to `test-results/` and `.gitignore`d in well-configured projects.

---

## 14. Coverage tooling

Playwright doesn't measure source-code coverage by default. Projects that want it:

- For Chromium specs, `page.coverage.startJSCoverage()` + `page.coverage.stopJSCoverage()` collects raw V8 coverage; pair with `c8` or `monocart-reporter` for lcov output.
- For cross-browser coverage, the `@playwright/test` runner's built-in coverage is limited; istanbul-instrumented dev builds are the standard fallback.

If `overrides.md` doesn't mention coverage, the project doesn't collect e2e coverage — **and that's fine**, because e2e coverage is measured behaviourally per `core.md` §6.1, not in lcov %.

---

## 15. Common Playwright footguns

- **Locator chains vs. element handles.** `page.locator(...)` returns a **lazy locator** that re-resolves every time it's used. `page.$('selector')` returns a one-shot `ElementHandle` that is stale after a re-render. Prefer locators; avoid `page.$` / `page.$$` unless you need imperative DOM access.
- **`expect(locator).toBeVisible()` vs `locator.isVisible()`.** The former retries; the latter is one-shot. `isVisible()` returning `false` for a not-yet-rendered element is **not** the same as "the element is hidden" — use `expect(...).toBeHidden()` for the actual hidden-state assertion.
- **Strict mode.** Locators default to strict — `await page.getByRole('button').click()` throws if more than one button matches. This is a feature, not a bug; either disambiguate (`name:` option, scoped parent, `.first()` with intent) or fix the production accessibility tree. Don't reach for `.first()` to silence the error without confirming you really mean "the first of N".
- **`page.waitForResponse` matches the first response, not the last.** If the page fires the same operation twice (e.g. a query + a refetch), the first match resolves. Wait by `request().postData()` content or by URL pattern that disambiguates, or chain explicit waits.
- **`test.beforeAll` runs once per worker, not once per file.** With multiple workers, the hook fires once per worker process. Don't rely on `beforeAll` to seed a database row — use `beforeEach` with idempotent setup, or a `globalSetup` config option for genuine once-per-run setup.
- **`storageState` is captured at write time.** If auth tokens expire, the saved `storageState.json` becomes stale. Re-run the setup project before each test run, or detect 401s in `beforeEach` and re-auth.
- **`page.evaluate` runs in the browser; the test runs in Node.** Closure variables from the test scope are not available inside `page.evaluate(...)` — pass them as the second argument: `page.evaluate((val) => window.foo = val, valueFromNode)`. Forgetting this produces `ReferenceError: <var> is not defined` inside the browser.
- **Parallelism.** Playwright runs spec files in parallel across workers by default (`workers: undefined` in config → `os.cpus().length`). Tests within a file run sequentially. For specs that mutate shared backend state (real-api specs), set `test.describe.configure({ mode: 'serial' })` or run with `--workers=1`.
- **Fixtures run in worker scope by default.** Custom fixtures declared with `test.extend(...)` are re-created per test by default (`{ scope: 'test' }`), but a `{ scope: 'worker' }` fixture persists across all tests in a worker. Worker-scope fixtures share state — convenient for expensive setup (database connection pool) and dangerous for stateful resources (shared user account). Default to `'test'` scope unless you have a written reason to widen.
- **`page.goto` returns the navigation response, not the document.** Don't `await page.goto(...)` and then assert against the returned value as if it were the page. Use a follow-up `expect(page)` assertion for navigation outcome.

---

## 16. Playwright-specific §6 additions

These layer on `core.md` §6 (universal forbid list):

- **`page.screenshot` in assertions** — debug aid, not an assertion. Visual diff coverage belongs to a separate tool (Percy / Applitools / Playwright's `toHaveScreenshot` only when explicitly scoped per `overrides.md`).
- **`page.waitForLoadState('networkidle')`** — relies on a "no requests for 500ms" heuristic; long-polling or analytics beacons can defeat it indefinitely. Wait on a specific signal (DOM state, response URL) instead. The newer `'domcontentloaded'` / `'load'` states are fine for the document; `networkidle` is the forbidden one.
- **`page.evaluate` reaching into private framework state** — e.g. inspecting `ng.probe(...)` (Angular), `__REACT_DEVTOOLS_GLOBAL_HOOK__` (React) to verify internal state. That's framework-implementation detail; assert on the rendered DOM or a project-exposed test hook.
- **`page.on('console', ...)` to assert log lines** — `core.md` §6 already forbids console assertions; the Playwright-specific reminder is that listening on `'console'` events to count `console.error` calls is the same violation by another name. Use a logger spy at the unit/integration tier instead.
- **`page.context().tracing.start(...)` mid-spec** — tracing is a config-level concern, not a per-test toggle. Configuring it inside a spec body indicates the spec is debugging itself; clean up before committing.
