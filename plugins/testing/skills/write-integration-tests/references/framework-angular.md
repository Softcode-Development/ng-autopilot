# Angular TestBed — Integration Testing Patterns

Framework-specific patterns for **Angular** integration tests using the TestBed with **real children**. Read **on top of** `core.md` (universal principles) and the active `runner-<runner>.md` (runner syntax — typically `runner-vitest.md` or `runner-karma-jasmine.md`).

The integration tier for Angular bootstraps a TestBed with the subject **plus** its real child components, real interceptors, real providers, and real router (where relevant). External IO is faked at provider seams: `HttpTestingController` for HTTP, MSW for `fetch`-based clients, fakes for third-party SDK wrappers, fake clock for time. The browser is **not** booted — these specs run in jsdom (or a real browser via Karma, but without navigation between routes).

---

## §6 additions for Angular (integration tier)

These extend the universal §6 forbid-list in `core.md`:

| Not tested at integration tier | Why | Where it gets tested instead |
|---|---|---|
| **PrimeNG / Material / CDK internal behaviour** — that `p-dropdown` opens, that `mat-dialog` traps focus, that animations fire | Owned by the UI library. | E2E for interaction; never at integration. |
| **Angular framework internals** — that `*ngIf` toggles, that `Router.navigate` emits, that `HttpClient` formats the request line | Owned by Angular. | Never. |
| **Pure pipe output** — `currency`, `date`, `translate`, custom pure pipes | One pipe — that's the unit tier. | Unit test. |
| **NgRx store mechanics** — that `dispatch` reaches the reducer | Owned by NgRx. Test our reducers/selectors as pure functions at unit tier; integration tests cover the **wired-together feature** with the real store. | Unit test for reducer / selector; integration test asserts on store state changes after dispatching. |
| **Apollo cache merge internals** | Owned by Apollo. Test custom merge functions as pure utilities. | Apollo's tests; unit test for custom merges. |
| **Hydration markers (SSR)** — that `ngh` attributes are emitted | Framework-owned. | Never. |
| **Single component logic with all children mocked** | If every child is mocked, you have a unit test. Integration tests render real children. | Unit test. |

---

## Bootstrap template (Angular TestBed with real children)

The standard shape. Configure the TestBed in `beforeEach` with the subject plus its real children + real providers + faked IO. Drive interactions through `DebugElement` queries; assert on rendered state / store state / emitted events.

```ts
/**
 * Integration spec for CartFeatureComponent.
 *
 * Scenarios:
 *   - displays line items from the cart store
 *   - dispatches AdjustQuantity when the +/- buttons are clicked
 *   - shows the empty state when the cart store has no items
 *   - displays a network-error toast when the AdjustQuantity mutation 5xxs
 *
 * Strategy: render CartFeatureComponent with its real children (CartLineItem,
 * CartSummary, CartToolbar) inside a TestBed. The cart store is real (NgRx
 * MockStore is forbidden at integration tier — we use the real reducer + a
 * seeded initial state). HttpTestingController fakes the outbound mutation.
 * No browser navigation, no real network.
 */

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store, provideStore } from '@ngrx/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CartFeatureComponent } from './cart-feature.component';
import { cartReducer } from '../+state/cart.reducer';
import { authInterceptor } from '../../core/http/auth.interceptor';
import { initialCartState, withItem } from '../../testing/cart-fixtures';

describe('CartFeatureComponent (integration)', () => {
  let fixture: ComponentFixture<CartFeatureComponent>;
  let httpController: HttpTestingController;
  let store: Store;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartFeatureComponent],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideStore({ cart: cartReducer }, { initialState: { cart: withItem(initialCartState, { sku: 'A', qty: 2 }) } }),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CartFeatureComponent);
    httpController = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);

    fixture.detectChanges();
  });

  afterEach(() => {
    httpController.verify();
  });

  describe('initial render', () => {
    it('displays line items from the cart store', () => {
      const lineItems = fixture.debugElement.queryAll(/* By.css('[data-cy="cart-line-item"]') */);
      expect(lineItems).toHaveLength(1);
      expect(lineItems[0].nativeElement.textContent).toContain('A');
    });
  });
});
```

**Key points:**

- `imports: [CartFeatureComponent]` — import the **subject** standalone component. Its declared imports bring its real children. Do **not** wrap children in `NO_ERRORS_SCHEMA` or replace them with stubs — that converts the spec back to a unit test.
- `provideHttpClient(withInterceptors([authInterceptor]))` + `provideHttpClientTesting()` — the **real** interceptors run, but outbound requests are caught by `HttpTestingController` instead of hitting the network.
- `provideStore({ cart: cartReducer }, { initialState })` — real reducer with a seeded state. **`provideMockStore` is not used at integration tier** — that's the unit-tier mock. The integration tier verifies that dispatched actions flow through the real reducer and the rendered UI updates accordingly.
- `provideRouter([])` — real Router with an empty config so navigation calls don't blow up. If the spec asserts on navigation, supply the relevant routes.
- `fixture.detectChanges()` — fires `ngOnInit` lifecycle. Install spies on injected services **before** the first `detectChanges()` if you need to observe init-time effects.

---

## What to override (external IO) vs what to leave real

### Override at these seams

- **`HttpClient`** — `provideHttpClient()` + `provideHttpClientTesting()` for `HttpTestingController`. Real interceptors + real services; only the network is faked.
- **`fetch`-based clients** — use MSW handler set in `beforeAll(() => server.listen())` / `afterAll(() => server.close())` / `afterEach(() => server.resetHandlers())`.
- **Third-party SDK wrappers** (`SentryService`, `PosthogService`, `IntercomService`) — override the wrapper class with a spy: `{ provide: PosthogService, useValue: { capture: vi.fn(), identify: vi.fn() } }`. Mock the underlying SDK module via the runner's module-mock if needed.
- **`Window` / `Document` / `localStorage` / `sessionStorage`** — use toolkit helpers; never raw-mutate. The project may provide tokens (`WINDOW`, `DOCUMENT`) that can be overridden.
- **SSR Universal tokens** — `REQUEST`, `RESPONSE`, `AUTH_TOKEN` — override with deterministic mocks per the project's toolkit.
- **`PLATFORM_ID`** — provide `'browser'` or `'server'` explicitly for hydration / SSR-branch testing.
- **`Clock` / `Date.now()` providers** — if production injects a clock token, override; otherwise use the runner's fake timers.

### Leave real

- All child standalone components rendered by the subject.
- All interceptors registered in production via `withInterceptors([...])`.
- All guards / resolvers in the route config.
- Real reducers / selectors / signals / computed values.
- Real form controls, validators, ControlValueAccessor implementations.
- Real pipes (pure or otherwise).
- Real RxJS streams from real services (with HTTP faked at the IO boundary).

### Forbidden override targets

- **Internal application service** that the subject directly delegates to — overriding it converts the integration spec into a unit test.
- **Child components** that are part of the rendered tree — rendering them as `<app-mock-line-item>` defeats the purpose of integration testing.
- **`provideMockStore`** — that's the unit-tier mock. Integration tier uses the real reducer with a seeded `initialState`.
- **The Router class** itself (`{ provide: Router, useValue: ... }`) — use `provideRouter([...routes])` with the relevant routes instead.

---

## NgRx integration patterns

### Seeding initial state

```ts
provideStore(
  { cart: cartReducer, user: userReducer },
  { initialState: {
    cart: withItem(initialCartState, { sku: 'A', qty: 2 }),
    user: { ...initialUserState, signedIn: true },
  } },
)
```

Builders (`withItem`, `withSignedInUser`, …) live in the project's testing toolkit. They produce minimal seeded state shapes; the spec composes them.

### Asserting on store state after a UI action

```ts
it('dispatches AdjustQuantity and the store reflects the new total', async () => {
  let cartTotal: number | undefined;
  store.select(selectCartTotal).subscribe(t => (cartTotal = t));

  // Act: click the increment button
  const incBtn = fixture.debugElement.query(By.css('[data-cy="qty-inc"]'));
  incBtn.triggerEventHandler('click');
  fixture.detectChanges();

  // Resolve the outbound mutation
  const req = httpController.expectOne('/api/cart/adjust');
  req.flush({ ok: true, newTotal: 42 });
  fixture.detectChanges();

  expect(cartTotal).toBe(42);
});
```

The integration test verifies the **full wired path**: click → dispatch → effect fires HTTP → response → reducer updates state → selector emits → UI re-renders. Asserting at any intermediate step (dispatch call count, effect spy) is a §6 violation — assert at the seam.

### Effects integration

For an effects integration test, leave the effect class real and supply real `actions$`:

```ts
import { provideEffects } from '@ngrx/effects';
import { Actions } from '@ngrx/effects';

providers: [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideStore({ cart: cartReducer }),
  provideEffects([CartEffects]),
]
```

Dispatch an action via `store.dispatch(...)` and assert on the resulting state. The effect runs through real RxJS operators with real HTTP (faked at the boundary).

---

## HttpTestingController patterns

```ts
// Expect exactly one request
const req = httpController.expectOne('/api/cart/adjust');
req.flush({ ok: true, total: 42 });

// Expect with method
httpController.expectOne(r => r.url === '/api/cart' && r.method === 'POST');

// No request expected
httpController.expectNone('/api/cart/secret');

// Multiple requests
const reqs = httpController.match('/api/cart/items');
reqs[0].flush(...);
reqs[1].flush(...);

// Error response
req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

// Network failure (status 0)
req.flush('', { status: 0, statusText: 'Unknown Error' });
```

Always call `httpController.verify()` in `afterEach` — it fails the test if any expected request was not consumed.

---

## Interceptor integration testing

Test interceptors via the **integration path** — supply real `HttpClient` with the interceptor registered, drive a real subscription, and assert on the side effect (state marker, retry count, redirect):

```ts
/**
 * Integration spec for error.interceptor.
 *
 * Strategy: TestBed with provideHttpClient(withInterceptors([errorInterceptor]))
 * and HttpTestingController. Drive requests through the real HttpClient;
 * assert on ErrorInterceptorState markers and retry behaviour.
 */

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  ErrorInterceptorState.lastUnauthorized = undefined;
});

afterEach(() => TestBed.inject(HttpTestingController).verify());

it('marks 401 responses with a sanitized unauthorized marker', () => {
  const http = TestBed.inject(HttpClient);
  const controller = TestBed.inject(HttpTestingController);

  let caughtError: unknown;
  http.get('/api/test').subscribe({ error: e => (caughtError = e) });

  const req = controller.expectOne('/api/test');
  req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

  expect(ErrorInterceptorState.lastUnauthorized).toMatchObject({ kind: 'unauthorized', status: 401 });
  expect(caughtError).toBeDefined();
});
```

For interceptors that retry with a delay (`timer(300)`, `retry({ delay })`), use the runner's fake timers:

```ts
vi.useFakeTimers();
try {
  // ... dispatch, flush 500, advance timers
  await vi.runAllTimersAsync();
  // ... assert retry happened
} finally {
  vi.useRealTimers();
}
```

---

## SSR / hydration integration testing

For projects with SSR via `@angular/platform-server`:

- Test both `PLATFORM_ID = 'browser'` and `PLATFORM_ID = 'server'` for any feature with `isPlatformBrowser` / `isPlatformServer` branches.
- Use the project's SSR provider mocks for `REQUEST`, `RESPONSE`, `AUTH_TOKEN`.
- Never trust one platform branch to imply the other — assert both explicitly.

Init-side-effects on a third-party SDK gated on the browser platform are tested via the runner's module-mock + the `resetModules` + dynamic-import pattern (see `runner-<runner>.md`).

---

## MSW for fetch-based integration testing

When the project uses `fetch` directly (not `HttpClient`), MSW is the integration-tier IO fake of choice:

```ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('/api/cart', () => HttpResponse.json({ items: [] })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
```

`onUnhandledRequest: 'error'` is mandatory at the integration tier — a missed handler must crash the spec, never pass through. See `framework-react.md` for the more complete MSW reference.

---

## Gotchas (Angular-specific)

### `fixture.detectChanges()` ordering

Install spies on injected services **before** the first `detectChanges()` if you need to observe `ngOnInit`-time effects. After `detectChanges()`, `ngOnInit` has already run.

### Standalone component imports

Importing the subject standalone component into the TestBed brings its declared imports — real children. **Do not** add the children to the TestBed's `imports` array explicitly; let the subject pull them in. Avoid `NO_ERRORS_SCHEMA` — it silently swallows real wiring bugs.

### `provideRouter([])` vs `RouterTestingModule`

Modern Angular (16+) uses `provideRouter([])`; older specs may use `RouterTestingModule`. Stick to one convention per project (`overrides.md` documents which). Don't mix.

### Animations

Animations are async and flake easily. Either disable them at the TestBed level (`provideNoopAnimations()`) or assert on the animation-end event when behaviour depends on animation completion. Never `setTimeout` to wait for an animation.

### Real `fetch` in jsdom

jsdom (used by Vitest by default) does not have a built-in `fetch`. Either polyfill globally in the test setup, or use MSW (which sets up its own `fetch` patching). Without a polyfill, calls to `fetch` in production code under integration test will throw "fetch is not defined".

### `Zone.js` and `fakeAsync`

`fakeAsync` from `@angular/core/testing` is zone-aware and integrates with Angular's change detection — it's the idiomatic choice for Karma/Jasmine. On Vitest with Angular, `fakeAsync` works but the runner's native `vi.useFakeTimers()` is often preferable for non-Angular RxJS / `setTimeout` code.

### `HttpTestingController.verify()` placement

Always in `afterEach`. If a spec dispatches a request that the spec body doesn't consume (forgot to call `.flush()`), `verify()` makes it visible. Without `verify()`, the spec passes silently and the next test gets a polluted controller.

### Cleanup between tests

`TestBed` is reset automatically between tests in modern Angular CLI defaults. If you bootstrap your own module, call `TestBed.resetTestingModule()` in `afterEach` to avoid provider leakage.
