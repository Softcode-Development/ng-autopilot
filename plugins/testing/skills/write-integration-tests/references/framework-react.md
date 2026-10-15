# React + MSW — Integration Testing Patterns

Framework-specific patterns for **React** integration tests using React Testing Library (RTL) with **real children + real providers + MSW**. Read **on top of** `core.md` (universal principles) and the active `runner-<runner>.md` (runner syntax — typically `runner-vitest.md` or `runner-jest.md`).

The integration tier for React renders the subject component with its **real children**, the **real providers** (`QueryClientProvider`, `Provider` from Redux, theme/context providers, `BrowserRouter` / `MemoryRouter`), and **MSW** to intercept outbound HTTP. External IO is faked at the network seam via MSW handlers; third-party SDKs (Sentry, PostHog, Segment) are mocked at the module-import seam. The browser is **not** booted — these specs run in jsdom (or happy-dom on Vitest).

---

## §6 additions for React (integration tier)

These extend the universal §6 forbid-list in `core.md`:

| Not tested at integration tier | Why | Where it gets tested instead |
|---|---|---|
| **React framework internals** — that `useState` triggers a re-render, that `useEffect` runs after commit, that `useMemo` caches | Owned by React. | Never. |
| **React Router internals** — that `<Link>` navigates, that `useNavigate` returns a function | Owned by RR. | Never. |
| **Redux internals / RTK internals** — that `dispatch` reaches the reducer, that `createSlice` produces the right action creators | Owned by Redux/RTK. Test reducers as pure functions at unit tier; integration tests cover wired-together features with the real store. | Unit test for reducer; integration test asserts on store state changes after UI action. |
| **TanStack Query internals** — that `useQuery` deduplicates, that `useMutation` triggers a re-fetch | Owned by TanStack. | Never. |
| **MUI / Chakra / Radix internal behaviour** — that a `Dialog` traps focus, that a `Popover` positions correctly | Owned by the UI library. | E2E. |
| **Pure hook output** — a `useFormatPrice` hook that wraps `Intl.NumberFormat` | One hook — unit tier. | Unit test (`renderHook`). |
| **Single component logic with all children mocked / all providers mocked** | If everything around it is mocked, it's a unit test. | Unit test. |

---

## Bootstrap template (React + RTL + MSW + real providers)

The standard shape. Stand up MSW once per spec file in `beforeAll/afterAll`; render the subject with real providers + real children in each test.

```tsx
/**
 * Integration spec for CheckoutPage.
 *
 * Scenarios:
 *   - renders the cart summary from the /api/cart response
 *   - submits the order when "Place order" is clicked and shows a success toast
 *   - shows a network-error banner when the submit returns 5xx
 *   - disables the submit button while a submit is in flight
 *
 * Strategy: render <CheckoutPage /> with its real children (CartSummary,
 * AddressForm, PaymentSummary, PlaceOrderButton) inside a TestBed of real
 * providers — QueryClientProvider with a fresh client per test, real Redux
 * store with seeded initial state, MemoryRouter. MSW intercepts /api/cart
 * and /api/orders. No real network, no browser navigation.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Provider as ReduxProvider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CheckoutPage } from './checkout-page';
import { buildStore } from '../../testing/build-store';
import { buildCartResponse } from '../../testing/fixtures/cart';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderCheckout(opts: { initialEntries?: string[] } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = buildStore(/* preloaded slices */);

  return render(
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={opts.initialEntries ?? ['/checkout']}>
          <CheckoutPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ReduxProvider>,
  );
}

describe('CheckoutPage (integration)', () => {
  it('renders the cart summary from the /api/cart response', async () => {
    server.use(
      http.get('/api/cart', () => HttpResponse.json(buildCartResponse({ items: [{ sku: 'A', qty: 2 }] }))),
    );

    renderCheckout();

    const summary = await screen.findByTestId('cart-summary');
    expect(within(summary).getByTestId('line-item-A')).toBeInTheDocument();
    expect(within(summary).getByTestId('total')).toHaveTextContent('€42.00');
  });
});
```

**Key points:**

- Real providers in the render — `Provider` from Redux, `QueryClientProvider`, `MemoryRouter`. Each wraps real children.
- **Fresh `QueryClient` per test** — TanStack Query caches across tests by default; sharing a client leaks fixture state into the next test. Build a new client per `renderCheckout(...)` call (or in `beforeEach`).
- `retry: false` on the QueryClient — production retry behaviour produces extra requests that the spec must handle; disabling retry in tests is conventional.
- `setupServer()` once per spec file; `server.use(...)` per test to add/override handlers.
- **`onUnhandledRequest: 'error'`** — mandatory. A request that's not handled must crash the spec, never pass through. Otherwise missed mocks silently masquerade as failed states.
- Use `screen.findBy*` (returns a promise, retries until the element appears) over `screen.getBy*` (synchronous, fails immediately) when the component depends on an async data load.
- `userEvent` over `fireEvent` for user interactions — `userEvent` simulates the real event sequence (pointerdown → pointerup → click → focus) and respects `disabled` attributes.

---

## What to override (external IO) vs what to leave real

### Override at these seams

- **HTTP / fetch / GraphQL** — MSW handlers for every outbound request the feature touches. `onUnhandledRequest: 'error'` to fail loudly on misses.
- **Third-party SDK modules** — `vi.mock('@sentry/react')`, `vi.mock('posthog-js')`. The SDK never reaches its real backend; the wrapper code paths are exercised.
- **Browser globals**:
  - `localStorage` / `sessionStorage` — use jsdom's built-in (it's a fake) but **reset in `beforeEach`** (`localStorage.clear()`).
  - `IndexedDB` — use `fake-indexeddb` polyfill or mock the wrapper.
  - `navigator.clipboard` — mock if used (`vi.spyOn(navigator.clipboard, 'writeText')`).
  - `window.location` — mock via `vi.stubGlobal('location', ...)` for redirect-asserting tests.
- **`Date` / `Math.random`** — use the runner's fake timers and `vi.spyOn(Math, 'random')` / `vi.spyOn(crypto, 'randomUUID')`.
- **Analytics / telemetry wrappers** — replace with spies via module mock or props.

### Leave real

- All child components rendered by the subject.
- All hooks the subject calls — `useEffect`, `useCallback`, custom `useCheckout`, `useCart`.
- Real reducers / slices in the Redux store.
- Real router (`MemoryRouter` is a real Router, just with a memory history instead of `window.history`).
- Real TanStack Query (`QueryClient` with a fresh instance and `retry: false`).
- Real context providers from the production tree (`ThemeProvider`, `AuthProvider`).
- Real form libraries (`react-hook-form`, `formik`) and their validators.

### Forbidden override targets

- **Internal application hooks** the subject directly imports — overriding `useCheckout` defeats integration testing.
- **Child components** in the rendered tree — replacing `<CartSummary />` with `<MockCartSummary />` removes the wiring under test.
- **`<QueryClientProvider>` with a mocked `useQuery`** — use real TanStack Query with MSW; that's what integration testing is about.

---

## MSW patterns

### Handler set per test

```ts
server.use(
  http.get('/api/cart', () => HttpResponse.json(buildCartResponse({ items: [] }))),
  http.post('/api/orders', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'order-1', state: 'pending', ...body });
  }),
);
```

### Error responses

```ts
http.post('/api/orders', () => new HttpResponse(null, { status: 500 }));
http.post('/api/orders', () => HttpResponse.json({ message: 'Bad request' }, { status: 400 }));
```

### Network failure

```ts
http.post('/api/orders', () => HttpResponse.error());
```

### Asserting on request bodies

```ts
let capturedBody: unknown;
server.use(
  http.post('/api/orders', async ({ request }) => {
    capturedBody = await request.json();
    return HttpResponse.json({ id: 'order-1' });
  }),
);

await userEvent.click(screen.getByRole('button', { name: /place order/i }));
await screen.findByText(/order placed/i);

expect(capturedBody).toMatchObject({ items: [{ sku: 'A', qty: 2 }] });
```

### Delaying responses (testing loading states)

```ts
import { delay } from 'msw';

http.get('/api/cart', async () => {
  await delay(100);
  return HttpResponse.json(...);
});
```

Combine with fake timers when the production code uses time-dependent loading indicators:

```ts
vi.useFakeTimers();
try {
  renderCheckout();
  expect(screen.getByTestId('spinner')).toBeInTheDocument();
  await vi.advanceTimersByTimeAsync(100);
  expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
} finally {
  vi.useRealTimers();
}
```

---

## Redux / RTK integration

### Building a real store with seeded slices

```ts
// testing/build-store.ts
import { configureStore } from '@reduxjs/toolkit';
import { cartReducer } from '../features/cart/cartSlice';
import { userReducer } from '../features/user/userSlice';

export function buildStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: { cart: cartReducer, user: userReducer },
    preloadedState,
  });
}
```

The spec composes seeded state via builders:

```ts
const store = buildStore({
  cart: withItem(initialCartState, { sku: 'A', qty: 2 }),
  user: { ...initialUserState, signedIn: true },
});
```

### Asserting on store state after a UI action

```ts
it('dispatches adjustQuantity and reflects the new total', async () => {
  const store = buildStore({ cart: withItem(initialCartState, { sku: 'A', qty: 2 }) });
  server.use(
    http.post('/api/cart/adjust', () => HttpResponse.json({ ok: true, newTotal: 4200 })),
  );

  render(<ReduxProvider store={store}>{/* ...providers... */}<CartPage /></ReduxProvider>);

  await userEvent.click(await screen.findByTestId('qty-inc-A'));
  await screen.findByText('€42.00');

  expect(store.getState().cart.total).toBe(4200);
});
```

The integration assertion verifies the full path: click → dispatch → thunk fires HTTP → MSW responds → reducer updates → selector emits → UI re-renders.

---

## TanStack Query integration

### Fresh client per test, retry disabled

Already shown in the template above. The two non-default settings (`retry: false` for queries and mutations) prevent test-environment retries that produce extra MSW requests the spec must handle.

### Asserting on cache state (advanced)

Most integration tests assert on the rendered UI, not the cache directly. When the cache itself is the seam under test (manual `queryClient.setQueryData(...)` calls in production code), assert via `queryClient.getQueryData(...)`:

```ts
expect(queryClient.getQueryData(['cart'])).toMatchObject({ items: [...] });
```

---

## React Router integration

### `MemoryRouter` for unit-shape routing, real navigation

```tsx
<MemoryRouter initialEntries={['/checkout']}>
  <Routes>
    <Route path="/checkout" element={<CheckoutPage />} />
    <Route path="/orders/:id" element={<OrderDetail />} />
  </Routes>
</MemoryRouter>
```

For tests that assert on navigation (e.g. "redirects to /orders/<id> after submit"), supply the destination route and assert on the rendered destination component:

```ts
await userEvent.click(screen.getByRole('button', { name: /place order/i }));
await screen.findByText(/order placed/i);
expect(await screen.findByTestId('order-detail')).toBeInTheDocument();
```

Asserting on `useNavigate()` calls directly is a §6 violation — assert on what the user sees after navigation.

---

## React Hook Form / Formik integration

Form libraries' internal state is real; the integration test drives the form via `userEvent` and asserts on the submitted payload (captured by an MSW handler):

```ts
let submittedBody: unknown;
server.use(
  http.post('/api/orders', async ({ request }) => {
    submittedBody = await request.json();
    return HttpResponse.json({ id: 'o-1' });
  }),
);

await userEvent.type(screen.getByLabelText(/address/i), '1 Test St');
await userEvent.click(screen.getByRole('button', { name: /place order/i }));
await screen.findByText(/order placed/i);

expect(submittedBody).toMatchObject({ address: '1 Test St' });
```

---

## Third-party SDK module mocks

For SDKs that reach external services on import or on first use:

```ts
import * as Sentry from '@sentry/react';
vi.mock('@sentry/react');

it('reports an error when submit fails', async () => {
  server.use(http.post('/api/orders', () => new HttpResponse(null, { status: 500 })));

  renderCheckout();
  await userEvent.click(await screen.findByRole('button', { name: /place order/i }));
  await screen.findByText(/something went wrong/i);

  expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledOnce();
});
```

Module mocks at the integration tier are reserved for **third-party** imports. Never mock an internal module.

---

## Selectors and queries (RTL)

- **Prefer accessible queries** — `getByRole`, `getByLabelText`, `getByText` — over `getByTestId` for elements that have a natural role.
- **Use `getByTestId` (`data-testid`)** for elements without a clear role (containers, summary rows, indicator nodes).
- **Forbidden**: class selectors, `nth-child`, raw `document.querySelector` from the test body.
- **Avoid text-content selectors that depend on translated copy** when the app supports i18n; use `data-testid` or `aria-label` instead. (`overrides.md` documents the project's stance.)
- `within(...)` to scope queries to a parent — prevents `getByRole('button')` matching every button on the page.

---

## Gotchas (React-specific)

### `act()` warnings

If a state update happens outside `userEvent` / `findBy*`, React Testing Library prints an `act()` warning. The fix is almost never to wrap in manual `act(...)` — it's usually that the test needs to `await` an async operation. Use `findBy*` for async appearance, `userEvent.click` (returns a promise) for interactions.

### `userEvent` v14 returns promises

`userEvent.click(...)`, `userEvent.type(...)`, etc. all return promises in v14. Always `await` them. Forgetting the `await` produces flaky tests where assertions run before the event finishes processing.

### Strict Mode double-invocation

React 18 with `<StrictMode>` double-invokes effects in development. Tests inherit that behaviour. If a spec asserts on call counts, account for the double-invoke — or assert on idempotent side effects (final state) instead of intermediate calls.

### `localStorage` leakage between tests

jsdom's `localStorage` persists across tests in the same spec file. Clear it in `beforeEach`:

```ts
beforeEach(() => localStorage.clear());
```

### Default `QueryClient` retry

A `QueryClient` with default settings retries 3× on failure. In a 500-response test, MSW will see 4 requests. Disable retry on the client (`retry: false`) and assert on the user-visible error state, not on request count.

### `MemoryRouter` vs `BrowserRouter`

Use `MemoryRouter` in tests — it doesn't touch `window.history`, doesn't conflict with parallel tests, and starts at a defined entry. `BrowserRouter` in tests can interact unpredictably with jsdom's `history` global.

### Cleanup between tests

`@testing-library/react` auto-cleans the DOM between tests when `globals: true` in the Vitest config (Jest does this by default). If `auto-cleanup` is disabled, call `cleanup()` manually in `afterEach`.

### MSW + Vitest module-resolution

If MSW handlers don't intercept requests, check:
1. `setupServer` is imported from `msw/node` (Node runtime), not `msw/browser`.
2. The HTTP client in production uses a request URL MSW's handler matches — relative URLs (`'/api/cart'`) work in jsdom because MSW patches at the `fetch` level.
3. `onUnhandledRequest: 'error'` is set — if a request is silently passing through, this surfaces it.
