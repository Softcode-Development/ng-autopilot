# Runner Reference Mapping

The detection of which test runner this project uses lives in the `detect-stack` skill (the testing plugin's `skills/detect-stack/SKILL.md`, mode `unit-tests` — integration tests reuse the unit runner). That skill returns a `runner` name (`karma-jasmine`, `jest`, `vitest`, etc.) plus standard failure modes (no package.json, ambiguous, missing).

This file documents what the `integration-test-orchestrator` agent does with that name — which runner-specific reference file to load and what each one should contain.

Integration tests on most stacks run through the **same runner** as unit tests. The runner only handles spy/timer/assertion mechanics; the "what gets bootstrapped and how the boundary is faked" lives in the **framework** reference (`framework-<framework>.md`).

---

## Runner-to-reference mapping

| `runner` value (from detect-stack) | Reference file in this skill |
|---|---|
| `vitest` | `runner-vitest.md` |
| `jest` | `runner-jest.md` |
| `karma-jasmine` | `runner-karma-jasmine.md` |
| `mocha` | `runner-mocha.md` (not yet written — escalate) |
| `none` / `ambiguous` | stop and ask |

If detection returns a runner whose reference file is a placeholder, the skill stops and tells the user which runner needs its file authored. Do not improvise a different runner's syntax.

---

## What goes in a runner reference file

A `runner-<runner>.md` file in this skill's references contains the runner-mechanics that integration specs need:

- **Spy / mock primitive syntax** — `vi.fn()` vs `jest.fn()` vs `jasmine.createSpyObj`.
- **Module mocking** (where supported) — `vi.mock('@sentry/nestjs')`, `jest.mock('module')`; Jasmine has no equivalent (uses DI).
- **`resetModules` + dynamic import pattern** — for testing module-evaluation-time env-driven init guards (`vi.resetModules()` + `await import('./instrumentation')`).
- **Fake-timer abstraction** — `vi.useFakeTimers()` vs `jest.useFakeTimers()` vs Angular's `fakeAsync`+`tick`.
- **Preferred assertion syntax** for "called once with these args" patterns and structural matchers (`expect.objectContaining`).
- **Coverage tooling** for integration specs (lcov location, separate reports vs merged with unit).
- **Common runner-specific footguns** that bite integration specs (ESM hoisting of `vi.mock`, Jest's `--runInBand` for shared in-memory state, etc.).

What does **not** go in a runner reference file (lives in the framework file instead):

- Bootstrap patterns (`Test.createTestingModule(...)`, `TestBed.configureTestingModule(...)`, RTL `render(...)`, `app.init()`).
- DI override patterns specific to the framework (`.overrideProvider(...).useValue(...)`, `TestBed` providers, MSW handler registration).
- Lifecycle assumptions specific to the framework.

The boundary is roughly: **runner = how to express any test**; **framework = how to bootstrap and fake at the integration seam**.

---

## How the matched file is used

The `integration-test-orchestrator` agent includes the matched runner reference file path in the brief passed to the `integration-test-author` subagent, alongside the universal references (`core.md`, `coverage-floors.md`, `reporting-contract.md`) and the matched framework reference (`framework-<framework>.md`). The reviewer subagent receives the same set.
