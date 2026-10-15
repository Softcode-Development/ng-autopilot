# Karma + Jasmine — Runner Patterns

Runner-specific syntax and patterns for projects using **Karma** (test runner) + **Jasmine** (assertion + spy library). This is the default test runner for Angular projects and many legacy front-end stacks.

Read **on top of** `core.md`. This file fills in the runner-specific blanks the core principles leave open (spy primitive, fake timers, assertion syntax).

The active `stack-<stack>.md` (e.g. `stack-angular.md`) layers framework-specific patterns on top.

---

## Spy / mock primitives

| Need | Jasmine API |
|---|---|
| Create a spy for a single function | `jasmine.createSpy('name')` |
| Create a spy object with multiple methods | `jasmine.createSpyObj('Name', ['method1', 'method2'])` |
| Configure a spy's return value | `spy.and.returnValue(value)` |
| Configure a spy to throw | `spy.and.throwError('msg')` (or `new Error(...)`) |
| Configure a spy to call a fake | `spy.and.callFake((arg) => ...)` |
| Spy on an existing method (auto-restored) | `spyOn(obj, 'methodName')` |
| Spy on a property | `spyOnProperty(obj, 'propName', 'get').and.returnValue(...)` |
| Reset a spy between assertions | `spy.calls.reset()` |
| Read call history | `spy.calls.mostRecent().args`, `spy.calls.all()`, `spy.calls.count()` |

Jasmine spies created via `jasmine.createSpyObj` are typed when you provide a generic: `jasmine.createSpyObj<MyService>('MyService', ['method'])`.

---

## Assertion syntax

Jasmine 4+ syntax. Universal `core.md` §8 principles map to:

| Universal principle | Jasmine syntax |
|---|---|
| Single-assertion "called once with these args" | `expect(spy).toHaveBeenCalledOnceWith(...)` |
| Per-call structural matcher | `expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({ ... }))` |
| Distinct-call check | `expect(spy.calls.all()[N].args[0]).toEqual(...)` |
| Asymmetric matchers | `jasmine.any(String)`, `jasmine.objectContaining({...})`, `jasmine.arrayContaining([...])`, `jasmine.stringMatching(/regex/)` |

**Forbidden** (per `core.md` §8): `expect(spy).toHaveBeenCalledTimes(N)` on logger spies. Use per-call `toHaveBeenCalledWith(objectContaining(...))` instead, asserting each distinct call.

**Forbidden** (per `core.md` §6): `jasmine.anything()` inside `.withArgs(...)`. If your project ESLint enforces this, the project will fail the build.

---

## Async — `fakeAsync` + `tick`

`fakeAsync` is Angular-aware (zone.js integration) but works for any synchronous-after-mock Promise/timer logic.

```ts
import { fakeAsync, tick, flush } from '@angular/core/testing';

it('debounces input by 300ms', fakeAsync(() => {
  subject.handleInput('a');
  tick(299);
  expect(spy).not.toHaveBeenCalled();
  tick(1);
  expect(spy).toHaveBeenCalledOnceWith('a');
}));
```

- `tick(N)` advances virtual time by N ms.
- `flush()` drains all pending microtasks and timers.
- Do not use real `setTimeout` inside a `fakeAsync` block — the whole point is to avoid it.

For non-Angular projects on Karma/Jasmine (rare), use `jasmine.clock().install()` / `jasmine.clock().tick(N)` / `jasmine.clock().uninstall()` instead.

---

## Marble tests (RxJS) — `TestScheduler`

For multi-emission observables, debounce, switchMap chains, etc.:

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

Marble tests are mandatory for any spec that involves RxJS time operators (`debounceTime`, `throttleTime`, `delay`, `audit`, …). Do not pad the test with `tick()` calls when a marble is correct.

---

## Module mocking

Jasmine has **no** built-in module-mocking facility analogous to `jest.mock('module')`. The Angular/Jasmine pattern is:

- Inject dependencies via DI tokens.
- Provide a mock for each token in the test bed's `providers` array (Angular `TestBed.configureTestingModule({ providers: [...] })`).
- The mock implementation comes from the project's testing toolkit (see `stack-<stack>.md`).

For pure ES modules without DI, prefer wrapping the module's exports in an injectable service that you can mock — never reach for module-level mocking workarounds in Jasmine.

---

## Coverage

Coverage is produced by **karma-coverage** plugin. Configure in `karma.conf.js`:

```js
coverageReporter: {
  dir: 'coverage/',
  reporters: [
    { type: 'lcov', subdir: '.' },          // lcov.info for tooling
    { type: 'text-summary' },               // console summary
  ],
  check: {
    each: {
      // per-folder thresholds — defined in overrides.md
    },
  },
}
```

Scoped runs with coverage:
- `ng test --no-watch --code-coverage --include=src/path/to/file.spec.ts` (Angular CLI)
- Read `coverage/lcov.info` for `LF`/`LH`/`BRF`/`BRH`/`FNF`/`FNH` per file.

---

## Cleanup hooks

- `beforeEach(async () => { ... })` for async setup (TestBed compile, etc.). Use `async` only when you actually await something.
- `afterEach(() => { ... })` for cleanup. Most spies auto-restore (`spyOn` of existing methods); `jasmine.createSpyObj` is GC'd with the suite. Explicit cleanup needed for:
  - `HttpTestingController.verify()` (Angular-specific — see `stack-angular.md`)
  - Manual property spies (`spyOnProperty`)
  - Subjects/observables you created and need to `complete()`
  - Toolkit teardown helpers (project-specific — see `overrides.md`)

---

## ESLint rules typically enforced for Karma/Jasmine spec files

(Confirm against `overrides.md`. These are the patterns most well-tended Karma/Jasmine projects enforce.)

- Ban `fdescribe` / `fit` / `xdescribe` / `xit` / `pending()`.
- Ban `it('should create' | 'should work', ...)`.
- Ban `setTimeout` / `setInterval` in spec files.
- Ban `(x as any)` casts.
- Ban `jasmine.anything()` inside `.withArgs(...)`.

Inline `eslint-disable` is only allowed with a `-- justified: <reason>` comment of ≥ 10 characters explaining the constraint.

---

## Common footguns

### `spy.and.returnValue(of(...))` not configured before subscribe

If a spy returns a default `undefined` and the subject tries to `.subscribe()` on it, the test errors out. Configure the spy in the test's Arrange step **before** any Act that touches it.

### Forgetting to reset spies between behaviour groups

When a spy is configured in an outer `beforeEach` and a single test needs a different return value, configure it **inside that test's Arrange**, not by reassigning the outer config. Jasmine spies persist call history across `it` blocks within a `describe`; use `spy.calls.reset()` if you need a clean count for an assertion.

### `done()` with `fakeAsync`

Don't mix `fakeAsync` with `done()`. Pick one — almost always `fakeAsync` for time-based logic, plain synchronous test for non-time logic.

### `TestScheduler` and `Date.now()`

`TestScheduler.run` controls virtual time for RxJS operators but does **not** stub `Date.now()`. If your subject calls `Date.now()`, spy on it explicitly: `spyOn(Date, 'now').and.returnValue(fixedTimestamp)`.
