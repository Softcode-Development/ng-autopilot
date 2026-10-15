# Jest — Runner Patterns (Integration)

**Placeholder.** This file gets filled in when a project using Jest needs the `write-integration-tests` skill.

If the skill detected Jest and routed you here: **stop**. Tell the user this runner reference is unwritten and that they need to either:

1. Author it now (using `runner-vitest.md` as a structural template — Jest's API is the parent that Vitest mirrors; swap `vi` → `jest` and adjust for Jest's CJS-first defaults), or
2. Confirm the project actually uses a different runner — Jest is sometimes pulled in as a transitive dependency by tooling without actually running tests.

Do **not** improvise Vitest- or Jasmine-flavoured syntax on a Jest project.

Expected sections when this file is written (use `runner-vitest.md` once authored as a near-mirror, swapping `vi` → `jest`):

- Spy / mock primitives (`jest.fn`, `jest.spyOn`, `jest.mock`)
- Module mocking conventions for third-party SDKs (CJS hoisting differs from Vitest's ESM hoisting; the factory can reference module-scope variables only when declared inside the factory body or via `jest.doMock` for dynamic mocking)
- `jest.resetModules()` + dynamic `require()` / `import()` for env-driven init guards
- Fake timers (`jest.useFakeTimers('modern')`, `jest.advanceTimersByTime`, `jest.runAllTimersAsync`)
- Assertion syntax (`expect.objectContaining`, `expect.any`, `expect.stringMatching`)
- Coverage configuration (`coverageReporters: ['lcov', 'text']`)
- Cleanup hooks (`afterEach(() => jest.restoreAllMocks())`, `beforeEach(() => jest.clearAllMocks())`)
- `--runInBand` consideration for integration specs that share in-process state
- ESLint rules (`eslint-plugin-jest`)
- Common footguns (CJS vs ESM mock-factory rules, `jest.mock` of `node_modules` requiring the `__mocks__/` adjacency convention, hoisting surprises when mixing `jest.mock` with TypeScript path aliases)
