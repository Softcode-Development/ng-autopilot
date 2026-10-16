# Unit testing — project overrides (<project>)

<!-- Synced to .claude/unit-testing/overrides.md when "unit" is in autopilot.json testTiers.
     Read by autopilot-testing:unit-test-orchestrator and passed to every author and reviewer.
     Overrides only ADD rules to the testing references, except entries under
     "Carve-outs", which must name the core.md rule they relax and why.
     Replace every <placeholder>; the drift check reports unfilled ones. -->

## Stack pins

```
STACK: <angular | nestjs | react | …>
RUNNER: <vitest | karma-jasmine | jest>
```

## Scoped commands

| Purpose | Command |
|---|---|
| One spec file | `<e.g. npx ng test --include=src/app/x/x.service.spec.ts --watch=false>` |
| A folder | `<…>` |
| Coverage for one file | `<…>` |

Environment the commands need: `<e.g. CHROME_BIN for Karma>`. The full-suite command lives in `.claude/gates.md`.

## File layout

- Specs live `<next to the subject | in __tests__/>`, named `<x.spec.ts>`.
- Test setup / global hooks: `<src/test.ts | vitest.setup.ts>` — what they already do (zone, providers, console guards).

## Toolkit

Shared helpers live in the testing toolkit (`lint.testingToolkit`, default `src/testing/`; its README indexes them). Specs only — production imports fail lint.

| Need | Use | Path |
|---|---|---|
| Collaborator mocks | `<toolkit mocks | jasmine.createSpyObj inline (see carve-outs)>` | `<path>` |
| Builders / fixtures | `<…>` | `<path>` |
| HTTP | `provideHttpClient()` + `provideHttpClientTesting()` + `HttpTestingController` | — |
| Router / environment / storage helpers | `<…>` | `<path>` |

Dependency → mock map for the project's most-injected services:

| Injected | Mock |
|---|---|
| `<AuthService>` | `<provideMockAuth() | createSpyObj('AuthService', [...])>` |

## Coverage targets

| Area | Lines / branches | Enforced by |
|---|---|---|
| `<src/app/shared/**>` | `<…>` | `<karma/vitest thresholds | review only>` |

## Additional hard constraints

- <e.g. Never mutate the environment singleton — use withEnvironmentOverrides().>
- <e.g. Every spec fails on console.error (global guard) — spy on it when the error is expected.>

## Carve-outs from the core references

Each entry names the rule it relaxes, the reason, and its scope.

| Core rule | Carve-out | Why | Scope |
|---|---|---|---|
| <core.md § … (e.g. "no inline mocks")> | <what is allowed instead> | <project convention / no toolkit yet> | <all specs | path> |

## Project rules that apply at every tier

<Links to the project rules (`.claude/rules/project.md`) tests must respect (e.g. no PII in fixtures, legacy patterns tests must not copy).>

## Unit vs other tiers

- Prefer unit for: <pure logic, pipes, validators, services with mocked IO, …>
- Prefer e2e / integration for: <cross-feature flows, real routing, …>
