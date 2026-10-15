# Reporting Contract — Integration Author Agent Output

The `integration-test-author` subagent must return this exact structure at the end of every invocation. No prose, no other shape. The orchestrating skill parses this report and surfaces fields in the run-level summary.

---

## Required fields

- **Subject seam**: the wired-together boundary being tested (`OrdersController + OrdersModule (NestJS HTTP)`, `CheckoutPage + real providers + MSW (React)`, `app.module — CorrelationIdMiddleware (NestJS bootstrap)`).
- **Subject files**: absolute paths of the production modules inside the boundary (controller, services, child components, etc.).
- **Spec file**: absolute path.
- **Detected runner**: e.g. `vitest`, `jest`, `karma-jasmine` (from the `detect-stack` skill).
- **Detected framework**: e.g. `nestjs`, `angular`, `react`, `express`, `fastify` (from `detect-stack` plus the orchestrator's per-spec framework inference).
- **Boundary inventory**:
  - **Real inside the boundary** — list every production module that runs unmocked.
  - **Faked at the seam** — list every external IO fake with the seam type: `<adapter / token / module>` → `<fake mechanism>` (e.g. `OrderRepo` → `InMemoryOrderRepo`, `EventPublisher` → `vi.fn` spy, `@sentry/nestjs` → module mock with `vi.fn()` init).
  - **Containers** — `none` (the default) or, if `overrides.md` authorised one, the container manifest + `overrides.md` section reference.
- **Behaviours covered**: bulleted list (`verb + object + condition` per line, matching the spec's header comment).
- **Behaviours skipped (§6 forbid list)**: list of `<would-have-been-line> — §6: <reason>`, or "none".
- **Edge cases marked unreachable (§5.1)**: list of `<seam>: <edge> — unreachable: <reason>` (e.g. "POST /orders: 415 unsupported media type — unreachable: production code restricts to JSON via global pipe; tested at the pipe's unit tier"), or "none".
- **Parity check**: `bullets: N, test blocks: M` — must be equal. State both numbers explicitly.
- **Self-check attestation**: every category below was grepped/inspected before reporting; all counts must be `0`. If any > 0, **do not report** — return to Step 10 and fix first.
  - Internal-collaborator overrides (`.overrideProvider(InternalService)`, `<MockChildComponent>` for components inside the wired tree): 0
  - `vi.mock` / `jest.mock` of an internal (non-third-party) module: 0
  - `as any` casts in spec code: 0
  - `as unknown as <T>` double-casts in spec code: 0
  - Inline mock / spy declarations for reusable seams (`new InMemoryOrderRepo()` declared in the spec but no toolkit equivalent exists): 0
  - Inline builder / factory functions for fixture entities: 0
  - Hand-assembled multi-field fixture objects (use builders instead): 0
  - Real `setTimeout` / `setInterval` / `Date.now()` / `Math.random()` reachable from production code under test: 0
  - Real network (unmocked outbound HTTP / GraphQL): 0
  - Raw mutation of `window` / `document` / `process.env` / `localStorage` without restore: 0
  - Raw `subscribe(` (RxJS) or unawaited promises without cleanup: 0
  - `if` / `for` / `.forEach` / `.map` over assertions / ternaries / computed expected values in test bodies: 0
  - Exact call counts on logger spies (`toHaveBeenCalledTimes` on a logger): 0
  - Translated UI text assertions: 0
  - DOM-shape assertions on internal template byproducts: 0
  - Private-method probing (`(x as any).foo` / reaching into internals): 0
  - PII in fixtures, spy assertions, or log payloads: 0
  - Real containers introduced without an `overrides.md` carve-out: 0
  - Skipped flaky tests without an open ticket and a `// Flake root cause:` comment: 0
  - Missing header comment block (per `core.md` §14 — one-line description, scenarios, strategy, optional spec/build-plan reference): 0
- **Seam-effect coverage**: every public seam variant identified in the integration surface, plus which `it(...)` exercises each. For HTTP: every route × method × auth state × happy/error variant. For component integration: every user-driven public input × every external IO response variant.
- **Coverage delta + ceiling verdict** (per `core.md` §4.1):
  - Per-file before → after for the subject(s): `lines X% → Y%`, `branches X% → Y%`, `functions X% → Y%` (from coverage report; lcov format).
  - **Ceiling verdict** — exactly one of:
    - **`AT CEILING`** — every uncovered region maps to a §6-blocked archetype; list each blocker as `methodName() at file:line — archetype — refactor candidate / dead code / accept`.
    - **`BELOW CEILING`** — real reachable behaviour was left unspecced; list each missing seam-effect as `verb + object + condition`.
    - **`ABOVE CEILING (suspicious)`** — coverage rose without a corresponding behaviour-list bullet; identify the offending test block and revert before reporting done.
- **Test count**: total test blocks.
- **Run time**: seconds.
- **Scoped test command**: the exact command run.
- **Scoped test exit code**: 0 / non-zero.
- **Lint exit code**: 0 / non-zero.
- **Toolkit additions made in this pass**: list each. For every addition, confirm all four checklist steps are done:
  1. file at conventional path (in-memory repo, MSW handler set, builder, fake clock) with JSDoc.
  2. barrel re-export.
  3. README row.
  4. self-test for non-trivial logic (e.g. an `InMemoryOrderRepo` with a non-trivial query method needs its own unit test; a trivial `Map`-backed store can skip).
- **Backlog update**: the exact row written to the backlog (`[x] path — N tests, VERDICT (lines X%→Y%, branches X%→Y%)` or `[x] path — §6: <reason>`).

---

## When the report should NOT be generated (escalate instead)

- Subject's behaviour surface is ambiguous or undocumented — do not guess.
- The production code lacks a dependency-injection seam (no `createApp({ deps })` factory, no NestJS provider tokens for external IO, no DI for the DB / publisher / clock) — propose the testability refactor; do not monkey-patch imports.
- Required in-memory adapter / MSW handler set / fake clock is missing from the project's toolkit and the addition would refactor multiple subjects or change toolkit conventions.
- Subject is exercised by an e2e/critical spec (overrides.md will list the directory) and the change risks invalidating an e2e assertion — flag it; the project may require a same-PR e2e update.
- Subject has so much surface that one spec file feels wrong (>20 test blocks) — propose a split before writing.
- The §6 forbid list is unclear for this subject — quote the section, ask for a ruling.
- The scoped test command isn't passing after one rewrite — escalate, do not loop.
- A live external dependency (Postgres / Redis / Kafka container) appears to be required but `overrides.md` has no carve-out — escalate; do not introduce containers ad-hoc.

In any of these cases: return a brief escalation message naming the blocker, do not write the structured report, do not tick the backlog.
