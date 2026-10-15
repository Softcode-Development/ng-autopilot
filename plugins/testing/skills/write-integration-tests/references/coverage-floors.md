# Coverage Floors by Integration-Surface Archetype

Integration coverage is measured by **behaviour-surface exhaustion**, not lcov %. The lcov number is a sanity check; the target is "every reachable bullet in the integration surface has a passing `it(...)`."

This file documents lcov **sanity-check ranges** per archetype. The author agent uses them to verify their `AT CEILING` claim is plausible. If the lcov number is well outside the expected range for the archetype, the author re-examines whether they missed reachable behaviour (below the range) or wrote framework / implementation tests (above the range).

Per-project coverage targets (CI-enforced) live in the project's `overrides.md`.

---

## Coverage Floors by Archetype

| Archetype | Lines | Branches | Notes |
|---|---|---|---|
| **NestJS controller + its service module** (HTTP integration) | 75–90% | 60–80% | All routes × happy/error variants. Some defensive `catch` blocks for unreachable broker / DB failure modes pull the ceiling down. |
| **NestJS module bootstrap** (correlation-id, request-scoped state, logger redaction) | 80–95% | 65–85% | Small, mostly synchronous surface. Most lines are configuration that runs once. |
| **NestJS microservice handler** (message-driven) | 70–85% | 55–75% | Async error paths + idempotency / retry / DLQ branches widen the ceiling gap. |
| **Express / Fastify router + handlers** | 75–90% | 60–80% | Same shape as Nest controller integration. |
| **Angular feature component + real children + real reducers** | 70–85% | 55–75% | Templates contain framework wiring that is §6-blocked. Most uncovered lines are template conditionals already verified at unit tier by the child component's own spec. |
| **Angular interceptor integration** (real `HttpClient` + interceptor chain) | 85–95% | 75–90% | Small surface — three or four branches (success, 4xx, 5xx, network 0). |
| **React feature page + real providers + MSW** | 70–85% | 55–75% | Same shape as Angular feature component. |
| **React custom hook integration** (real `QueryClient`, real reducers, MSW) | 80–90% | 65–80% | Smaller surface than a full page; one or two seams. |
| **DB-backed integration** (testcontainers carve-out, real adapter) | 65–80% | 50–70% | Adapter-level integration; most domain logic is unit-tested separately. Branch coverage reflects defensive code in the adapter (connection retry, transaction rollback). |
| **Module-init / env-driven config** (instrumentation.ts, logger config) | 80–95% | 65–85% | Verified via `resetModules` + dynamic-import pattern. Branches: env-set, env-unset, env-malformed. |

---

## Interpreting a Verdict Outside the Expected Range

A verdict outside its archetype's floor range is a **smell** — not an automatic failure, but a prompt to verify.

| Situation | Action |
|---|---|
| `AT CEILING` claimed at 55% lines on a **NestJS controller integration** | Likely missing reachable error paths or auth branches. Push back unless the author enumerates §6-blocked archetypes for every uncovered region. |
| `AT CEILING` claimed at 95% lines on an **Angular feature component integration** | Either the feature is genuinely small (verify) or the spec is reaching into private state / asserting on template byproducts (§6 violation — reject). |
| `AT CEILING` claimed at 90%+ lines on a **DB-backed integration** | Verify it's not testing the DB driver itself rather than the wired-together adapter + use case. |
| `AT CEILING` claimed at 40% branches on **any HTTP integration** | Public branches (auth states × payload validity × downstream success/failure) are reachable. Push back. |
| Coverage **above** the upper bound for the archetype without extra behaviour-list bullets | Suspicious — likely framework / implementation assertion (§6 violation). |

---

## Relationship between Floors and Ceilings

- **Floor** — "did the file regress below the agreed minimum?" — mechanical gate, CI-enforced per folder (configured in `overrides.md`).
- **Ceiling** — "did this specific integration spec exercise every reachable seam variant?" — requires reading the integration surface; the author must enumerate every uncovered region.

A spec can sit at its integration ceiling and still be below the floor — that signals a **testability refactor is needed** (production code lacks a dep-injection seam, or the feature has unreachable defensive code that should be deleted), not more tests. When the ceiling is well below a floor, the author classifies each blocker as `refactor candidate`, `dead code`, or `accept`, and surfaces the choice with concrete `file:line` references.

---

## Why integration coverage targets are lower than unit

A wired-together integration spec exercises one happy path (or one error path) per `it(...)`. Each `it(...)` is more expensive than a unit test (boots a module, drives a request, asserts at the seam). The economics flip: at unit tier you write 30 tests for a service to hit 95% coverage; at integration tier you write 8 tests that exercise the wired flow.

Lower lcov % at integration tier is **not** a coverage gap as long as the **behaviour surface is exhausted**. The unit tier is responsible for branch coverage of individual collaborators; the integration tier is responsible for verifying they work together at the seam.

This is why **§6 enforcement is the dominant rule** at this tier, not lcov chasing. A spec that hits 95% lines by asserting on internal call sequences is **worse** than a spec that hits 70% by asserting on the seam — the first one is a §6 violation, the second is correct.
