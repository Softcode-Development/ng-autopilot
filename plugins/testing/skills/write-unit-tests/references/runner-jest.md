# Jest — Runner Patterns

**Placeholder.** This file gets filled in when a project using Jest needs the `write-unit-tests` skill.

If the skill detected Jest and routed you here: **stop**. Tell the user this runner reference is unwritten and that they need to either:
1. Author it now (using `runner-karma-jasmine.md` as a structural template — same sections: spy primitives, assertions, fake timers, marble tests, coverage, cleanup, ESLint, footguns), or
2. Confirm the project actually uses Karma/Jasmine — some projects have `jest` as a transitive dependency without actually running Jest.

Do **not** improvise Jasmine-flavoured syntax on a Jest project. The differences are non-trivial:

- **Spies**: `jest.fn()` and `jest.spyOn()` vs `jasmine.createSpy` / `jasmine.createSpyObj` / `spyOn`. Different call-history APIs (`mock.calls` vs `calls.all()`).
- **Module mocking**: `jest.mock('module', factory)` has no Jasmine equivalent. Jest can intercept ES module imports; Jasmine cannot.
- **Fake timers**: `jest.useFakeTimers()` / `jest.advanceTimersByTime(N)` vs Angular's `fakeAsync` + `tick`. Different defaults around microtask flushing.
- **Async matchers**: `await expect(promise).resolves.toBe(...)` and `.rejects` are Jest-only.
- **Snapshot testing**: `toMatchSnapshot()` is Jest-native; absent in Jasmine.
- **Coverage**: Built-in via `--coverage`; no separate plugin like karma-coverage.
- **`expect.objectContaining` / `expect.any`** vs `jasmine.objectContaining` / `jasmine.any`. Same concept, different namespace.

Expected sections when this file is written:

- Spy / mock primitives table
- Assertion syntax (`expect.toHaveBeenCalledWith`, `expect.objectContaining`, `expect.any`)
- Fake timers (`jest.useFakeTimers('modern')`, `jest.advanceTimersByTime`, `jest.runAllTimers`)
- Module mocking patterns (`jest.mock`, `jest.requireActual`)
- Async patterns (`async/await`, `.resolves` / `.rejects`)
- Coverage configuration in `jest.config.js`
- Cleanup hooks (`beforeEach`, `afterEach`, `beforeAll`, `afterAll`)
- ESLint rules (`eslint-plugin-jest`)
- Common footguns (timer-vs-microtask ordering, automatic mock reset, async leak detection)
