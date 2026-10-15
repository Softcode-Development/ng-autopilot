# Code-review rubric

The rubric the `code-reviewer` agent applies. It cites the golden rules (`.claude/rules/golden/*`) and the project's CLAUDE.md / ARCHITECTURE.md instead of restating them, so each rule lives in one place; this file is about **how to look**.

## Lanes

| Concern | Owner |
|---|---|
| Code quality — this rubric | `code-reviewer` |
| Plan conformance: scope, criteria → tests, ticks, visual records | `plan-reviewer` |
| Security / threat model | `security-reviewer` |
| Test authoring quality per tier | the testing pack's tier reviewers |

Stay in your lane. A security finding goes to the security-reviewer's lane (flag an obvious gap as incomplete work, don't run the deep pass); a missing test for a criterion is the plan-reviewer's.

## Mindset

- Findings teach; they don't scold. Explain the **why** and cite the rule.
- Separate `BLOCKING` from `SUGGESTION` ruthlessly. A suggestion escalated out of annoyance is noise; a bug labelled suggestion to avoid stalling is malpractice.
- Cite `file:line` for every finding. One finding per finding — never "assorted problems".
- Acknowledge good patterns briefly when they stand out.

## Severity

- **`BLOCKING:`** — fix before done: bugs, hard-rule violations, missing required behaviour, broken contracts.
- **`SUGGESTION:`** — should be addressed in this change; the driver fixes, declines with a reason, or defers with a destination.
- **`QUESTION:`** — "is this intentional?"; use freely when a finding straddles intent and error.
- **`PRAISE:`** — optional and short.

## Pre-flight

1. Confirm the diff range and the plan.
2. Read the deferral context (plan Out of scope, answered Open questions, worklog Decisions). Items there are not findings.
3. Self-review gate: if you wrote or planned this change, abort.

## A — Correctness (almost always BLOCKING)

- Null/undefined dereferences; unsafe `!`; missing guards on possibly-absent data.
- Floating promises — every promise awaited or explicitly handled.
- Off-by-one and boundary errors: indexes, ranges, pagination, dates.
- Equality traps: `==`, object identity vs value, `NaN`, `Date` compared without `getTime()`.
- Time zones: UTC on the wire, the user's zone on display; never ambiguous.
- Subscriptions, listeners, timers — each one cleaned up (`takeUntilDestroyed`, finite operators, `removeEventListener`, `clearTimeout`).
- Races: concurrent requests, `effect()` writing state, stale last-write-wins, missing `untracked()`.
- N+1: repeated identical requests in loops, templates or services.
- Mutated inputs; request-scoped data on a singleton.
- Error handling: no swallowed errors (`catch {}`), no `console.log(e)` pseudo-handling; the UI keys off error **codes**, never message text.
- Auth: a route or endpoint that needs a guard has one.

## B — Incomplete / half-finished work

Check the deferral context first.

- `TODO` / `FIXME` / `WIP` / `// later` shipped.
- Stubs returning `null`, empty bodies, `NotImplemented` — unless deferred with a destination.
- Non-exhaustive switches over unions (no `assertUnreachable`), silent `default` returning `undefined`.
- Async UI missing one of loading / error / empty / success.
- Forms missing validation, submit-disabled-while-pending, or accessible error messages.
- Half-extracted code: a new helper used at some call sites while the old path lingers.
- User-facing text without a translation key.

## C — Readability and structure

Golden rule `readable-code`. Mostly `SUGGESTION`; `BLOCKING` only when code is genuinely incomprehensible or duplicates non-trivial logic.

DRY (three similar lines can beat a premature abstraction) · extract methods · single responsibility · intent-named, not technology-named · guard clauses · tell-don't-ask · named predicates over boolean soup · obvious, isolated side effects · composition over giant classes · comments explain why; step-counter comments banned.

## D — Hard rules

Every golden rule whose Enforcement is not lint, and every project hard rule in CLAUDE.md, checked against the diff. Violations are `BLOCKING`. Lint-enforced rules: flag only escape hatches (`eslint-disable` without a reason, a rule widened to pass).

Common: `any`; template method calls; `*ngIf`/`*ngFor` or decorator inputs in new code; `@for` without a stable `track`; hardcoded routes/API paths/page-name keys (especially HTML attribute literals lint can't see); `console.log`; PII in logs; `[innerHTML]` without sanitising; a raw interactive element where a design-system primitive exists; inline template over 15 lines.

## E — Architecture

Project ARCHITECTURE.md + golden `architecture` and `state` rules: folder placement (feature / core / shared), import boundaries, one mechanism per state origin, interceptors and HTTP through the project's API layer, the project's declared legacy carve-outs respected (new code doesn't extend a legacy pattern outside its confined folders).

## F — Design system (UI diffs only)

Project DESIGN_SYSTEM.md + golden `design-discipline`: primitives first, tokens only (no raw colors/spacing), theme works without per-component overrides, a11y minimums, one icon set, motion respects reduced-motion.

## G — Tests (gross level only)

Tier reviewers own depth. Flag: tests that always pass (no assertion, unawaited expectation, asserting what the test just built); tests deleted or weakened to turn red green; a spec asserting a constant equals itself; orphan specs for deleted files; `fdescribe`/`fit`/`xit` committed.

## H — Performance (hot paths only)

Lists, signals, queries, I/O. Otherwise skip — performance comments everywhere dilute the signal.

Unbounded lists without `track` / virtualization; template method calls; eager-loaded areas that should be lazy; heavy synchronous work in constructors/`ngOnInit` that belongs behind `@defer` or off the critical path; repeated identical HTTP calls without caching/sharing; an unjustified new dependency (note the bundle impact).

## Report shape

1. Scope paragraph (branch, base, file counts, batch).
2. Intentionally deferred — not flagged (bullets).
3. `BLOCKING:` → `SUGGESTION:` → `QUESTION:` → optional `PRAISE:`, each with id (B1, S2…), `file:line`, rule, and the fix described in a sentence.
4. Summary: counts per severity and a verdict — `Approve` / `Approve with suggestions` / `Request changes` / `Needs clarification`.

## A reviewer must not

- Relitigate a decision recorded in the plan or worklog — disagreement is a `QUESTION`.
- Flag intentionally deferred items.
- Duplicate the plan-reviewer or the security-reviewer.
- Approve in silence — a clean review still writes the report.
- Invent rules — every finding cites a rule, a project doc or a known bug class; gut feel is a `QUESTION`.
- Patch code.

## When stuck

- Incomplete vs intentionally deferred, and the worklog is silent → `QUESTION`.
- The diff is much larger than expected → say so and narrow the scope instead of reviewing shallowly.
