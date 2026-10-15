# Coverage Floors by File Archetype

Per-archetype coverage **minimum floors**. The author agent must reach at least these numbers before claiming `AT CEILING`. If more reachable behaviour exists above the floor, keep writing tests. Do **not** stop at the floor. Do **not** exceed §6 to push numbers higher.

These floors are framework-agnostic — the archetype shape is the same whether the subject is an Angular service or a React Native reducer. Per-folder coverage targets (CI-enforced) live in the project's `overrides.md` because they depend on the project's folder structure.

---

## Coverage Floors by Archetype

| Archetype | Lines | Branches | Notes |
|---|---|---|---|
| **Pure utility / pure pipe / pure helper** | 95–100% | 90–100% | No DI, no async — everything reachable from public functions. Below this floor means missing branch variants. |
| **State reducer / selectors** (pure functions) | 95–100% | 90–100% | Pure. Near 100% is the norm; lower means an input variant or edge case was skipped. |
| **State effect / async pipeline** | 85–95% | 70–85% | Marble-tested at the boundary. Lower range reflects genuine error-swallowing and platform no-op guards. |
| **Service (pure / domain)** — no I/O | 90–100% | 85–95% | Deterministic in → out. If lower, the test is missing branches, not the service hiding code. |
| **Service (I/O / orchestration)** — HTTP, GraphQL, SDKs, storage | 80–90% | 65–80% | Async error paths, platform branches, defensive `catch` blocks, retry logic pull the ceiling down. |
| **Guard / interceptor / middleware** | 85–95% | 75–90% | Small, mostly synchronous surface. Two branches (allow/deny) typically. |
| **Directive** | 85–95% | 75–90% | Same shape as a guard. |
| **Standalone validator** — pure validator function | 95–100% | 90–100% | Pure function. Treat as utility. |
| **Resolver** — route resolver | 85–95% | 75–90% | Same shape as a small service; mock the data source and assert the resolved value. |
| **Signal / store-based local state** — `signalStore`, `computed`, `withMethods` | 85–95% | 70–85% | Public method calls and computed derivations are reachable; private signal internals are §6. |
| **Shared UI (presentational)** — display-only, no form logic | 90–95% | 75–90% | Template pass-throughs (§6) trim branches; event output assertions cover the rest. |
| **Shared UI (forms / logic)** — CVA, ControlValueAccessor, validators | 80–90% | 65–80% | Form validation branches and CVA contract add real surface; template wiring is §6 and excluded. |
| **Route component (logic in services)** — thin orchestration | 65–85% | 50–70% | Most logic delegated to injected services; component spec covers wiring and error/success branching on public methods. |
| **Route component (private pipelines)** — complex internal RxJS chains | 60–75% | 45–60% | Ceiling reflects the §6 surface. Still requires all public-method branches tested (role toggles, validator switches, browser/SSR forks, dirty/pristine). A low branch % is not a license to stop — exhaust public paths first. |

---

## Interpreting a Verdict Outside the Expected Range

A verdict outside its archetype's floor range is a smell — not an automatic failure, but a prompt to verify.

| Situation | Action |
|---|---|
| `AT CEILING` claimed at 70% lines on a **pure / domain service** | Almost certainly missing reachable input variants or edge cases. Push back. |
| `AT CEILING` claimed at 45% lines on an **I/O / orchestration service** | Likely missing reachable error paths or platform branches. Push back unless author enumerates §6-blocked archetypes. |
| `AT CEILING` claimed at < 45% branches on **any route component** | Public branches (role toggles, dirty/pristine, error vs success on each public mutation, query-param forks) are reachable. Push back. |
| `AT CEILING` claimed at 95% lines on a **route component with private pipelines** | Either pipelines were refactored out (verify) or spec is reaching into private state (§6 violation, reject). |
| Coverage **above** the upper bound for the archetype without extra behaviour-list bullets | Suspicious — possible constant assertion / framework wiring (§6 violation). |

---

## Relationship between Floors and Ceilings

- **Floor** = "did the file regress below the agreed minimum?" — mechanical gate, CI-enforced per folder (configured in `overrides.md`).
- **Ceiling** = "did this specific file get every test §6 allows?" — requires reading the file; the author must enumerate every uncovered region.

A file can sit at its §6 ceiling and still be below the floor — that signals a **refactor is needed**, not more tests. When the ceiling is well below a floor, the author classifies each blocker as `refactor candidate`, `dead code`, or `accept`, and surfaces the choice with concrete `file:line` references.
