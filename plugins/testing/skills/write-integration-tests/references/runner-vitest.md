# Vitest — Runner Patterns (Integration)

Vitest-specific spy / mock / timer / module-mock syntax for integration specs. Read **on top of** `core.md` and the active `framework-<framework>.md`. The patterns in the framework file describe **what to bootstrap and fake at the boundary**; this file describes the **mechanics** of expressing those fakes in Vitest.

Vitest's API is largely Jest-compatible; the namespace is `vi` instead of `jest`. Notable integration-relevant differences are called out.

---

## Spy / mock primitives

```ts
import { vi } from 'vitest';

// Standalone spy
const spy = vi.fn();
const spyWithImpl = vi.fn((x: number) => x * 2);
const spyTyped: Mock<[req: Request], Promise<Response>> = vi.fn();

// Spy on an existing method (auto-restored if vi.restoreAllMocks() / config restoreMocks: true)
const repoSaveSpy = vi.spyOn(repo, 'save').mockResolvedValue(undefined);

// Reset all spies between tests
beforeEach(() => {
  vi.clearAllMocks();   // clears calls + instances; keeps implementations
  // OR
  vi.resetAllMocks();   // clears calls + resets implementations to undefined
  // OR
  vi.restoreAllMocks(); // restores spies created with vi.spyOn to originals
});
```

For integration specs: prefer `vi.spyOn` on the **in-memory fake's** methods (to confirm the wired-together code reached the boundary) over `vi.fn()` standalone. Standalone `vi.fn()` is reserved for injected callbacks and event publishers.

---

## Module mocking — third-party SDKs only

Module mocks (`vi.mock`) at the integration tier are reserved for **third-party imports at the IO boundary** (Sentry, PostHog, Stripe, Twilio, AWS SDK clients). Never `vi.mock` an internal module.

```ts
// At top of the spec — hoisted by Vitest above all imports.
vi.mock('@sentry/nestjs', async (importOriginal) => {
  const original = await importOriginal<typeof import('@sentry/nestjs')>();
  return {
    ...original,
    init: vi.fn(),
    captureException: vi.fn(),
  };
});
```

**ESM hoisting gotcha**: `vi.mock` is hoisted to the top of the file by Vitest's transform — but the factory can only reference variables declared via `vi.hoisted()`. If you need a shared spy reference:

```ts
const { initSpy } = vi.hoisted(() => ({ initSpy: vi.fn() }));

vi.mock('@sentry/nestjs', () => ({ init: initSpy }));

// Later in tests:
expect(initSpy).toHaveBeenCalledWith(expect.objectContaining({ dsn: '...' }));
```

For per-test mock changes, prefer `vi.mocked(...)` over re-declaring the mock:

```ts
import * as Sentry from '@sentry/nestjs';
vi.mock('@sentry/nestjs');

it('captures exception', () => {
  vi.mocked(Sentry.captureException).mockImplementation(...);
  // ...
});
```

---

## resetModules + dynamic import (env-driven init guards)

When production code initialises at module-evaluation time based on environment variables (e.g. `if (process.env.SENTRY_DSN) Sentry.init(...)` at the top of `instrumentation.ts`), use `vi.resetModules()` + dynamic `import()` to re-evaluate the module under different env shapes.

```ts
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
  delete process.env['SENTRY_DSN'];
});

it('does not init Sentry without DSN', async () => {
  delete process.env['SENTRY_DSN'];
  await import('./instrumentation');
  const Sentry = await import('@sentry/nestjs');
  expect(vi.mocked(Sentry.init)).not.toHaveBeenCalled();
});

it('inits Sentry with DSN when set', async () => {
  process.env['SENTRY_DSN'] = 'https://fake@sentry.io/1';
  await import('./instrumentation');
  const Sentry = await import('@sentry/nestjs');
  expect(vi.mocked(Sentry.init)).toHaveBeenCalledOnce();
});
```

Document the trick in the spec's header comment block — readers should not have to puzzle out why dynamic imports are necessary.

---

## Fake timers

```ts
import { vi } from 'vitest';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Inside a test:
vi.advanceTimersByTime(300);   // synchronous fast-forward
await vi.runAllTimersAsync();  // run all pending timers, awaiting microtasks
await vi.advanceTimersByTimeAsync(300);
```

Use `vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })` to pin `Date.now()` deterministically when the production code uses real time.

---

## Assertions

Same shape as Jest — `expect.objectContaining`, `expect.arrayContaining`, `expect.any(...)`, `expect.stringMatching(...)`.

```ts
expect(res.body).toMatchObject({
  id: expect.stringMatching(UUIDV7_RE),
  state: 'pending',
  createdAt: expect.any(String),
});

expect(repoSaveSpy).toHaveBeenCalledOnce();
expect(repoSaveSpy).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'user-1' }));
```

For HTTP integration specs with supertest, assert on `res.status`, `res.headers`, and structural matches on `res.body`.

---

## Coverage

Vitest emits lcov by default when `coverage.reporter: ['lcov']` is set in `vitest.config.ts`. The provider is `v8` or `istanbul`:

```ts
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    reportsDirectory: './coverage',
  },
}
```

For integration coverage measured separately from unit coverage, use the project's `overrides.md` to document the separate `coverage` directory (e.g. `coverage/integration/` vs `coverage/unit/`).

---

## Footguns

- **Top-level `await` in spec files** — Vitest supports it, but `vi.mock` hoists above the `await` line. If you need to await something before declaring mocks, restructure or use `vi.hoisted()`.
- **`vi.mock` factory cannot reference outer-scope variables.** Only `vi.hoisted()` variables are accessible. Otherwise you get an obscure "Cannot access 'X' before initialization" error.
- **Concurrent tests share module state by default.** For integration specs that re-import modules (per the `resetModules` pattern above), avoid `test.concurrent` — concurrent tests will race on the module cache.
- **Snapshot location.** Vitest writes snapshots to `__snapshots__/<spec>.snap` next to the spec; integration specs rarely use snapshots (assert on structural matchers instead), so this rarely matters.
- **`vi.spyOn` on getter / setter** — requires `vi.spyOn(obj, 'prop', 'get')` / `'set'`; the third argument is non-obvious.
