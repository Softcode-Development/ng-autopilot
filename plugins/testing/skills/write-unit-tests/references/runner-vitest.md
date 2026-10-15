# Vitest — Runner Patterns

Runner-specific syntax and patterns for projects using **Vitest** as their unit-test runner. Vitest's API is largely Jest-compatible — the namespace is `vi` instead of `jest`, but most patterns transfer 1:1. ESM-first behaviour and Vite-driven module resolution are the notable departures.

Read **on top of** `core.md` (universal principles). The active `stack-<stack>.md` (e.g. `stack-angular.md`) layers framework-specific patterns on top of this file.

For integration specs on Vitest, see the testing plugin's parallel `skills/write-integration-tests/references/runner-vitest.md` — the patterns overlap but the integration file focuses on boundary fakes (in-memory adapters, MSW handlers, supertest) rather than per-collaborator spying.

---

## Spy / mock primitives

```ts
import { vi, type Mock } from 'vitest';

// Standalone spy — for an injected callback or event publisher
const onChange = vi.fn();
const onChangeWithImpl = vi.fn((x: number) => x * 2);
const onChangeTyped: Mock<[value: string], void> = vi.fn();

// Spy on an existing method (auto-restored when config.restoreMocks: true,
// or you call vi.restoreAllMocks() in afterEach)
const navigateSpy = vi.spyOn(router, 'navigate').mockReturnValue(true);

// Spy on a getter / setter
vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1920);
vi.spyOn(env, 'apiUrl', 'set');

// Reset between tests — pick one
beforeEach(() => {
  vi.clearAllMocks();   // clears calls + instances; keeps implementations
  // OR
  vi.resetAllMocks();   // clears calls + resets implementations to undefined
  // OR
  vi.restoreAllMocks(); // restores vi.spyOn'd methods to originals
});
```

| Need | Vitest API |
|---|---|
| Standalone spy | `vi.fn()` |
| Spy with implementation | `vi.fn((arg) => result)` |
| Configure return value | `spy.mockReturnValue(value)` |
| Configure resolved promise | `spy.mockResolvedValue(value)` |
| Configure rejected promise | `spy.mockRejectedValue(error)` |
| Configure to throw | `spy.mockImplementation(() => { throw new Error('msg') })` |
| Spy on existing method | `vi.spyOn(obj, 'method')` |
| Spy on a getter | `vi.spyOn(obj, 'prop', 'get')` |
| Read call history | `spy.mock.calls`, `spy.mock.calls[N]`, `spy.mock.lastCall`, `spy.mock.results` |

Prefer `vi.spyOn` on an existing method over `vi.fn()` replacing it — `spyOn` preserves the original for restore.

**Typed spies for service interfaces:**

```ts
type LoggerLike = Pick<Logger, 'info' | 'warn' | 'error'>;
const logger: LoggerLike = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
```

For toolkit factories that return `[Provider, Handle]` tuples (Angular DI pattern — see `stack-angular.md`), the spy lives inside the helper, not in the spec.

---

## Assertion syntax

Vitest's `expect` matches Jest's API. Universal `core.md` §8 principles map to:

| Universal principle | Vitest syntax |
|---|---|
| Single-assertion "called once" | `expect(spy).toHaveBeenCalledOnce()` + `expect(spy).toHaveBeenCalledWith(...)` |
| Per-call structural matcher | `expect(spy).toHaveBeenCalledWith(expect.objectContaining({ ... }))` |
| Distinct-call check | `expect(spy.mock.calls[N][0]).toEqual(...)` |
| Asymmetric matchers | `expect.any(String)`, `expect.objectContaining({...})`, `expect.arrayContaining([...])`, `expect.stringMatching(/regex/)`, `expect.closeTo(0.1, 2)` |
| Promise rejection | `await expect(promise).rejects.toThrow(SomeError)` |
| Promise resolution | `await expect(promise).resolves.toEqual(expected)` |

**Forbidden** (per `core.md` §8): `expect(spy).toHaveBeenCalledTimes(N)` for N > 1 on logger spies. Use per-call structural matchers instead, asserting each distinct call. The single exception is when the test name explicitly fixes N as part of a named contract (e.g. "fires AdjustOrderLine exactly once per quantity bump — debounced").

**Type-level assertions** are Vitest-unique (`expectTypeOf<T>().toMatchTypeOf<U>()`). Use sparingly — type assertions belong in `.d.ts` test files at most, not regular specs.

---

## Fake timers

```ts
import { vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('debounces input by 300ms', () => {
  subject.handleInput('a');
  vi.advanceTimersByTime(299);
  expect(spy).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(spy).toHaveBeenCalledOnce();
  expect(spy).toHaveBeenCalledWith('a');
});
```

| Need | Vitest API |
|---|---|
| Install fake timers | `vi.useFakeTimers()` |
| Restore real timers | `vi.useRealTimers()` |
| Pin `Date.now()` | `vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })` |
| Advance synchronously | `vi.advanceTimersByTime(N)` |
| Advance awaiting microtasks | `await vi.advanceTimersByTimeAsync(N)` |
| Drain all pending timers | `vi.runAllTimers()` |
| Drain all awaiting microtasks | `await vi.runAllTimersAsync()` |

**Use the `Async` variants when the timer schedules microtasks** (Promises, async/await chains). The synchronous variants run timer callbacks but do not flush microtasks queued by those callbacks — a subsequent assertion against a Promise resolution will see stale state.

Stub `Math.random()` explicitly when the subject uses it:

```ts
vi.spyOn(Math, 'random').mockReturnValue(0.42);
```

---

## Angular zone-aware fake time (`fakeAsync` + `tick`)

For Angular subjects with zone-driven change detection, `@angular/core/testing`'s `fakeAsync` + `tick` still work under Vitest — they sit at a higher abstraction layer than `vi.useFakeTimers()` and integrate with Angular's `NgZone`.

```ts
import { fakeAsync, tick, flush } from '@angular/core/testing';

it('debounces typeahead by 300ms', fakeAsync(() => {
  subject.handleInput('a');
  tick(299);
  expect(spy).not.toHaveBeenCalled();
  tick(1);
  expect(spy).toHaveBeenCalledWith('a');
}));
```

**Do not mix `fakeAsync` with `vi.useFakeTimers()` in the same test.** Pick one — `fakeAsync` when the subject depends on Angular's change detection cycle, `vi.useFakeTimers()` for pure JS time logic. Mixing produces silent inconsistencies because the two abstractions schedule against different clocks.

Zoneless Angular (Angular 21+ with `provideZonelessChangeDetection()`) makes `fakeAsync` less idiomatic — for zoneless subjects, prefer `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(N)` and assert against the resulting signal state.

---

## Marble tests (RxJS) — `TestScheduler`

For multi-emission observables, debounce, throttle, switchMap chains, and any operator with time semantics:

```ts
import { TestScheduler } from 'rxjs/testing';

let testScheduler: TestScheduler;

beforeEach(() => {
  testScheduler = new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });
});

it('debounces input emissions to 300ms', () => {
  testScheduler.run(({ cold, expectObservable }) => {
    const input$ = cold('a-b-c----d|', { a: 'x', b: 'y', c: 'z', d: 'w' });
    const result$ = input$.pipe(debounceTime(300, testScheduler));
    expectObservable(result$).toBe('---------c--d|', { c: 'z', d: 'w' });
  });
});
```

Marble tests are mandatory for any spec involving RxJS time operators (`debounceTime`, `throttleTime`, `delay`, `audit`, …). Do not pad the test with `vi.advanceTimersByTime` calls when a marble is correct.

**Gotcha:** `TestScheduler.run` controls virtual time for RxJS operators but does **not** stub `Date.now()`. If the subject reads `Date.now()` independently of RxJS, spy on it explicitly: `vi.spyOn(Date, 'now').mockReturnValue(fixedTimestamp)`.

---

## Module mocking

Vitest's `vi.mock` is hoisted to the top of the file (above all imports) by Vitest's transform. This is convenient but has ESM-specific quirks the Jasmine world does not have.

**At the unit tier, module mocking is rare.** Prefer dependency injection: inject collaborators via constructor args, DI tokens, or props, and replace them in the test bed (see `stack-<stack>.md`). Reach for `vi.mock` only for **third-party imports at the IO boundary** that aren't routed through DI:

```ts
// At the top of the spec — Vitest hoists this above all imports.
vi.mock('@sentry/angular', async (importOriginal) => {
  const original = await importOriginal<typeof import('@sentry/angular')>();
  return {
    ...original,
    init: vi.fn(),
    captureException: vi.fn(),
  };
});
```

**ESM hoisting gotcha:** the `vi.mock` factory cannot reference outer-scope variables. Use `vi.hoisted()` for shared spy references:

```ts
const { initSpy } = vi.hoisted(() => ({ initSpy: vi.fn() }));

vi.mock('@sentry/angular', () => ({ init: initSpy }));

it('initialises Sentry once', () => {
  expect(initSpy).toHaveBeenCalledOnce();
});
```

For per-test mock changes, prefer `vi.mocked(...)`:

```ts
import * as Sentry from '@sentry/angular';
vi.mock('@sentry/angular');

it('captures exception with extra context', () => {
  vi.mocked(Sentry.captureException).mockImplementation(...);
  // Act + Assert
});
```

**Internal modules: never `vi.mock`.** If a unit test feels like it needs to mock an internal module, that's a sign the subject lacks a DI seam — surface as a testability finding, don't reach for `vi.mock`.

---

## Coverage

Vitest emits lcov by default when configured. Provider options are `v8` (faster, built on Chrome DevTools Protocol) or `istanbul` (more granular branch reporting):

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/*.d.ts', '**/index.ts'],
    },
  },
});
```

Scoped runs with coverage:

```bash
pnpm exec vitest run --coverage <relative-path-to-spec.spec.ts>
```

Read `coverage/lcov.info` for `LF`/`LH`/`BRF`/`BRH`/`FNF`/`FNH` per file (per `core.md` §6.1 ceiling discipline). Vitest writes per-file lcov entries identical in shape to Jest's and Karma's, so the universal "find each uncovered line, classify as §6-blocked or reachable" workflow applies unchanged.

---

## Cleanup hooks

```ts
beforeEach(() => { ... });    // sync or async — Vitest awaits async setups
afterEach(() => { ... });
beforeAll(() => { ... });
afterAll(() => { ... });
```

Auto-restore is opt-in via `vitest.config.ts`:

```ts
test: {
  clearMocks: true,    // clear mock.calls before each test
  restoreMocks: true,  // restore vi.spyOn'd originals after each test
  unstubGlobals: true, // restore vi.stubGlobal'd values after each test
  unstubEnvs: true,    // restore vi.stubEnv'd env vars after each test
}
```

If the project doesn't have these in its config, restore explicitly in `afterEach`:

```ts
afterEach(() => {
  vi.restoreAllMocks();
});
```

Explicit cleanup is still needed for:

- `HttpTestingController.verify()` on Angular HTTP specs (see `stack-angular.md`)
- Subjects / observables you created and need to `complete()`
- Toolkit teardown helpers (project-specific — see `overrides.md`)

---

## ESLint rules typically enforced for Vitest spec files

(Confirm against `overrides.md`. These are the patterns most well-tended Vitest projects enforce — `eslint-plugin-vitest` provides most of them.)

- Ban `it.only` / `describe.only` / `test.only` / `it.skip` / `describe.skip` / `test.skip` / `it.todo` without a ticket.
- Ban `it('should create' | 'should work' | 'should render', ...)` — `core.md` §7 vague-title rule.
- Ban `setTimeout` / `setInterval` in spec files (use `vi.useFakeTimers()`).
- Ban `(x as any)` casts and `as unknown as T` double-casts — `core.md` §6.
- Ban `expect(...).toBeTruthy()` / `toBeFalsy()` on boolean assertions — use `toBe(true)` / `toBe(false)` for explicit intent.
- Ban `expect.anything()` — too loose; use `expect.any(Constructor)` or `expect.objectContaining(...)`.

Inline `eslint-disable` is only allowed with a `-- justified: <reason>` comment of ≥ 10 characters explaining the constraint.

---

## Test isolation

Vitest runs each test file in a fresh worker by default (`pool: 'forks'` or `pool: 'threads'`). Inside a file, tests share module state — `vi.mock`'d modules persist across `it(...)` blocks within the file. This is intentional: it makes module mocks ergonomic.

**Concurrent tests share state.** `test.concurrent(...)` and `describe.concurrent(...)` run tests in the same file in parallel, sharing the module cache. Avoid concurrent tests in any spec that:

- Uses `vi.useFakeTimers()` — concurrent tests race on the shared clock.
- Uses `vi.mock` with per-test `vi.mocked(...).mockImplementation(...)` — concurrent tests race on the shared mock.
- Mutates any singleton (registry, in-memory store, env var).

Default to sequential tests. Reach for `test.concurrent` only for genuinely independent pure-logic tests where wall-time matters.

---

## Common Vitest footguns

### `vi.mock` factory referencing outer variables

```ts
const spy = vi.fn();
vi.mock('./module', () => ({ exported: spy })); // ❌ "Cannot access 'spy' before initialization"
```

The factory is hoisted; `spy` is not. Fix:

```ts
const { spy } = vi.hoisted(() => ({ spy: vi.fn() }));
vi.mock('./module', () => ({ exported: spy }));
```

### `vi.advanceTimersByTime` without `Async` swallows microtasks

If the timer callback is `async` or awaits a Promise, the synchronous `advanceTimersByTime` fires the timer but doesn't drain the microtask queue. The next assertion sees pre-resolution state.

```ts
// ❌ subject schedules a setTimeout whose callback awaits a Promise
vi.advanceTimersByTime(1000);
expect(handler).toHaveBeenCalled(); // race — Promise hasn't resolved yet

// ✅
await vi.advanceTimersByTimeAsync(1000);
expect(handler).toHaveBeenCalled();
```

### Forgetting `await` on `.resolves` / `.rejects`

```ts
expect(promise).rejects.toThrow(Error);  // ❌ assertion never runs; test silently passes
await expect(promise).rejects.toThrow(Error); // ✅
```

`eslint-plugin-vitest` rule `expect-expect` does not catch this; review specs by eye.

### `vi.spyOn` on a getter without the third argument

```ts
vi.spyOn(window, 'innerWidth'); // ❌ TypeError — 'innerWidth' is a getter, not a method
vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1920); // ✅
```

### Top-level `await` in spec files

Vitest supports top-level `await`, but `vi.mock` hoisting still puts the mock factory above the top-level `await`. If you must await before declaring mocks (e.g. dynamic import for fixture loading), restructure to put the mock above and the await below, or use `vi.hoisted()` to share state.

### Snapshot location

Vitest writes snapshots to `__snapshots__/<spec>.snap` next to the spec. Unit specs rarely use snapshots — they encourage whole-object equality, which violates `core.md` §8 "assert only what matters". Prefer structural assertions.

### `vi.clearAllMocks` vs `vi.resetAllMocks` vs `vi.restoreAllMocks`

| Method | Clears `.mock.calls` | Resets implementations | Restores `spyOn` originals |
|---|---|---|---|
| `vi.clearAllMocks()` | ✅ | ❌ | ❌ |
| `vi.resetAllMocks()` | ✅ | ✅ (to `undefined`) | ❌ |
| `vi.restoreAllMocks()` | ✅ | ✅ | ✅ |

Most projects want `restoreAllMocks` in `afterEach` (or `restoreMocks: true` in config). `resetAllMocks` is rarely the right choice — it strips implementations from `vi.fn()`-only spies, breaking the next test if they expected the spy to behave.

### Coverage exclusions that should be excluded

V8 coverage instruments every loaded module — including spec files and `node_modules`. The default `exclude` list catches most noise, but custom toolkits or generated code may need explicit exclusion in `vitest.config.ts`'s `coverage.exclude`. The project's `overrides.md` documents the exclusion list when non-default.
