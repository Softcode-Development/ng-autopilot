# Integration testing — project overrides (<project>)

<!-- Synced to .claude/integration-testing/overrides.md when "integration" is in autopilot.json testTiers.
     Read by autopilot-testing:integration-test-orchestrator. Overrides only ADD rules, except
     documented carve-outs (including the container carve-out below).
     Replace every <placeholder>. -->

## Runner and framework resolution

```
RUNNER: <vitest | jest | karma-jasmine>
FRAMEWORK[<apps/api>]: <nestjs>
FRAMEWORK[<apps/web | src>]: <angular>
INTEGRATION_FILE_PATTERN: <*.int-spec.ts | *.integration.spec.ts | tests/integration/**>
```

## Scoped command

| Purpose | Command |
|---|---|
| One spec | `<…>` |
| Pre-existing integration specs of a module (re-run at checkpoint and final gate) | `<…>` |

Mis-scoped commands that run the whole suite: `<note any known trap and its cost>`.

## Container carve-out

Default is in-memory fakes. Containers or live services only when authorised here:

| Dependency | Allowed? | How | Why |
|---|---|---|---|
| `<Postgres>` | `<yes — Testcontainers | no>` | `<helper path>` | `<mocked DBs hide migration breakage>` |

## Toolkit

Shared helpers live in the testing toolkit (`lint.testingToolkit`, default `src/testing/`; its README indexes them). Specs only — production imports fail lint.

| Need | Use | Path |
|---|---|---|
| In-memory adapters / fakes | `<…>` | `<path>` |
| HTTP boundary (MSW handlers / HttpTestingController) | `<…>` | `<path>` |
| Builders / fixtures | `<…>` | `<path>` |
| App bootstrap for tests | `<TestingModule factory | TestBed with real children>` | `<path>` |

## Seam rules

- Auth: <how tests authenticate; never bypass the guard in a test that claims to cover it>.
- Tenant/scope: <how a request is scoped in tests>.

## Acceptance criteria

The plan's `[integration]` criteria (or the OpenSpec scenarios assigned to this tier) are the coverage list; each gets a test or a worklog deferral with a destination.

## Additional hard constraints

- <…>

## Carve-outs from the core references

| Core rule | Carve-out | Why | Scope |
|---|---|---|---|
| <…> | <…> | <…> | <…> |
