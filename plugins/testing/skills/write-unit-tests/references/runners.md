# Runner Reference Mapping

The detection of which test runner this project uses lives in the `detect-stack` skill (the testing plugin's `skills/detect-stack/SKILL.md`, mode `unit-tests`). That skill returns a `runner` name (`karma-jasmine`, `jest`, `vitest`, etc.) plus standard failure modes (no package.json, ambiguous, missing).

This file documents what the `unit-test-orchestrator` agent does with that name — which runner-specific reference file to load and what each one should contain.

---

## Runner-to-reference mapping

| `runner` value (from detect-stack) | Reference file in this skill |
|---|---|
| `karma-jasmine` | `runner-karma-jasmine.md` |
| `jest` | `runner-jest.md` (placeholder — escalate) |
| `vitest` | `runner-vitest.md` (placeholder — escalate) |
| `mocha` | `runner-mocha.md` (not yet written — escalate) |
| `jasmine-node` | not supported — escalate |
| `none` / `ambiguous` | stop and ask |

If detection returns a runner whose reference file is a placeholder, the skill stops and tells the user which runner needs its file authored. Do not improvise a different runner's syntax.

---

## What goes in a runner reference file

A `runner-<runner>.md` file in this skill's references contains:

- **Spy / mock primitive syntax** — `jasmine.createSpyObj` vs `jest.fn()` vs `vi.fn()`
- **Fake-timer abstraction** — `fakeAsync`+`tick` vs `jest.useFakeTimers()` vs `vi.useFakeTimers()`
- **Module mocking** (where supported) — `jest.mock('module')`, `vi.mock('module')`; Jasmine has no equivalent (uses DI)
- **Preferred assertion syntax** for "called once with these args" patterns
- **Marble / scheduler abstraction** for multi-emission observables
- **Coverage tooling** specifics (Karma needs karma-coverage; Jest/Vitest are built-in)
- **Common runner-specific footguns**

What does **not** go in a runner reference file (lives in the stack file instead):

- Component instantiation patterns (`TestBed.createComponent`, RTL `render()`)
- Framework-specific mock providers (Angular `provideHttpClientTesting`, React Context wrappers)
- Lifecycle assumptions specific to the framework

The boundary is roughly: **runner = how to express any test**; **stack = how to test framework code**.

---

## How the matched file is used

The `unit-test-orchestrator` agent includes the matched runner reference file path in the brief passed to the `unit-test-author` subagent, alongside the four universal references and the matched stack reference. The reviewer subagent receives the same set.
