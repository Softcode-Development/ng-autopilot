# Integration Testing — Core Principles

Universal rules for integration tests, **runner-agnostic and framework-agnostic**. These principles apply whether the project uses Vitest, Jest, or Karma/Jasmine; whether the target is a NestJS module, an Angular TestBed with real children, a React tree with MSW, or an Express app with supertest.

Read alongside:
- The active **runner** reference (`runner-<runner>.md`) for spy/mock/fake-timer/assertion syntax
- The active **framework** reference (`framework-<framework>.md`) for bootstrap templates, IO-boundary fakes, and framework-specific §6 additions
- The project-specific `overrides.md` (if present)

These core rules are the floor — they cannot be loosened by runner/framework files or overrides. Runner/framework files and overrides only **add** rules.

---

## 1. Three-tier test taxonomy *(the test pyramid)*

| Tier | Lives in | Runs via | Scope |
|---|---|---|---|
| **Unit test** | `*.spec.ts` / `*.test.ts` next to source | the project's unit-test runner | One class/function. All collaborators mocked. |
| **Integration test** | `*.integration.spec.*` / `*.int.spec.*` / `tests/integration/**` (project decides — see `overrides.md`) | the same unit-test runner, or a dedicated integration target | **Multiple production modules wired together. Real internal collaborators. Mocks only at external IO boundaries.** This skill. |
| **E2E test** | dedicated `cypress/`, `e2e/`, `playwright/`, or `tests/e2e/` suite | E2E runner | Real user journeys through a built app in a real (or headless) browser. **Out of scope for this skill.** |

This skill writes integration tests only. The companion `write-unit-tests` skill owns the unit tier; `write-e2e-tests` owns the e2e tier.

---

## 2. Zero tolerance for placeholder specs

A spec file with only `it('boots', () => expect(app).toBeDefined())` is not a test — it tells you the constructor runs and nothing else. Same for `it('creates module', () => expect(module).toBeTruthy())`. **Reviewers must reject specs whose assertions would still pass on broken collaborators.**

The minimum bar for any `it(...)` is: a multi-module flow is exercised through a public seam (HTTP request, public method on a bootstrapped service, dispatched event), and a state change is asserted at the **observable output** of that flow (HTTP response body / status / header, store state, emitted event, persisted record).

---

## 2.1 — Rules beat codebase convention

When the rules in these references disagree with patterns you see in **existing integration specs in the repository**, the rules win. Existing specs that violate the rules are technical debt, not precedent — including specs that have been in the codebase for years, specs written by senior authors, and specs that other team members have referenced as "the way we test X here". A wrong pattern is wrong regardless of who wrote it or how widely it spread.

When you find a rule-violating pattern in existing specs:

- **Do not copy it into the new spec.** "We test it this way everywhere else" is not a defence — it makes the new spec wrong too.
- **Do not extend it.** Adding one more `it('mocks the service')` because the sibling spec has six of them is propagation, not consistency.
- **Flag it.** List the pre-existing violations in your report under a "pre-existing violations to surface" section so the team can clean them up. Reviewers must flag the new violation **and** the pattern it copied from.

The single exception: when `overrides.md` documents a project-specific carve-out from a `core.md` rule. Project overrides extend the floor; existing-spec patterns do not.

---

## 3. The integration boundary *(the single rule that defines this tier)*

**An integration test wires multiple production modules together and asserts on the observable output at the outer seam, faking only at external IO boundaries.** Everything inside the boundary is real production code. Everything outside the boundary is a fake.

### What is **inside** the boundary (must be real)

- The module / controller / service under test.
- All internal collaborators it depends on — child services, providers, pipes, interceptors, guards, middleware, validators, mappers, repositories' in-memory adapters, reducers, selectors, signals, effects, hooks, context providers, child components rendered as part of the tree.
- Domain logic, validation, routing, dependency injection wiring, middleware chains.
- Cross-cutting framework wiring that the test is verifying (CORS, body parsing, request lifecycle, error filters, response interceptors).

### What is **outside** the boundary (must be faked)

- **Network IO** — outbound HTTP/GraphQL/gRPC to other services. Fake at the HTTP-client seam (MSW, nock, supertest-against-a-stub) or by injecting a fake client. Never reach a real third-party host.
- **Database / persistent storage** — real Postgres / MySQL / Mongo / Redis instances. The default is **in-process fakes** (in-memory repository implementations, in-memory queue, `Map`-backed cache). See §3.1 for the testcontainers carve-out.
- **Third-party SDKs** — Sentry, PostHog, Stripe, Twilio, S3, Auth0, anything that talks to a vendor's servers. Mock at the module-import boundary (`vi.mock(...)`, `jest.mock(...)`, DI override).
- **Time** — `Date.now()`, `setTimeout`, `setInterval`, RxJS `timer`, `interval`. Use the runner's fake-timer abstraction or inject a clock.
- **Randomness** — `Math.random()`, `crypto.randomUUID()` when the output is part of the assertion. Inject a deterministic generator.
- **Filesystem** — except for fixture reads. Real writes go to a tempdir created and torn down per test, or are mocked.
- **Browser storage** — `localStorage`, `sessionStorage`, `IndexedDB`, cookies — use toolkit helpers; never raw-mutate host globals.
- **Process state** — `process.env` mutation in-test; restore in `afterEach`.

### What is **disallowed inside the boundary** (turns it into a unit test)

- Mocking an **internal collaborator** that the production code under test directly imports. If you find yourself writing `vi.mock('./my-internal-service')`, you are either (a) writing a unit test under an integration filename, or (b) the module-under-test has the wrong shape and the test is fighting that.
- Replacing a real provider with a stub provider in the framework's DI container for a class that is part of the production code-path you're testing.
- Overriding internal RxJS operators, internal pipes, internal interceptors with fakes.

### Rule of thumb

For every mock you reach for, ask: *"does this fake represent something outside our process boundary (network, DB, vendor SDK, time, randomness, filesystem, host globals)?"* If yes, fake it. If no, leave it real — even if the real version is annoying to set up. The annoyance is the test telling you the real wiring is being exercised.

The **stub-passes test** still applies: mentally replace one of the real internal collaborators inside the boundary with a stub that hardcodes the asserted output. If the test still passes, the boundary is wrong — pull more real code in, or move the test down to the unit tier.

---

## 3.1 — Containers and live external dependencies (default: NO)

The default position is **in-process only**. Integration tests run on every PR, on every push, on every dev machine. Spinning up Postgres / Redis / Kafka in Docker on every CI run is expensive, flaky, and slow.

The default fake for a database is an **in-memory repository implementation** that satisfies the same interface the production repository does. The production code stays exactly the same; DI swaps the adapter.

**Testcontainers / live external dependencies are opt-in per project**, documented in `overrides.md` with:

- The exact containers required (image, version, exposed ports).
- The orchestration entry point (`docker-compose.test.yml`, a `globalSetup` file, a separate Nx target).
- The scoped commands that bring the stack up/down.
- Which subjects the carve-out applies to (`payment-flow.integration.spec.ts`, `transaction-isolation.integration.spec.ts` — never the whole project).
- The CI strategy (separate job? same job with caching? skipped on PRs and run nightly?).

Without that documentation in `overrides.md`, do **not** introduce testcontainers — propose the in-process alternative or escalate. Adding a Docker dependency to an integration test is an architectural decision, not an authoring one.

When a project does have the carve-out, the framework reference's "DB / queue / cache" section still applies — the same shape rules (fixtures via builders, deterministic seeding, isolated per-test transactions or schema resets, no leaked state between tests).

---

## 4. §6 — What integration tests do NOT cover *(scope discipline)*

Integration coverage isn't the goal — confidence in *wired-together* code paths is. The tier is expensive (slower than unit, less direct than e2e); content that is better covered elsewhere doesn't belong here. This is a **review-level forbid**; reviewers must reject specs that violate it.

| Not tested at integration tier | Why | Where it gets tested instead |
|---|---|---|
| **Pure functions, pure pipes, pure helpers** — domain logic without collaborators | One module — that's the unit tier. | Unit test. |
| **Reducer / selector logic in isolation** — `(initial state + action) → state`, `(state) → derived` | Pure functions. | Unit test. |
| **Single-class business logic with all collaborators mocked** | If every collaborator is mocked, it's a unit test wearing an integration filename. | Unit test. |
| **Framework behaviour** — that the DI container injects providers, that the router emits navigation events, that lifecycle hooks fire in order | Owned by the framework. | Never. Trust the framework. |
| **Trivial constructor wiring** — `it('boots', () => expect(app).toBeDefined())` | Constructor success is not behaviour. | Never; delete. |
| **Page-metadata wiring** — title, meta tags, OG/SEO/canonical/favicon | Static branding; payload doesn't change with user input. | Never via integration. SEO smoke test or visual review. |
| **Translated UI text** — asserting a specific localised string | Specs break on every translation update. Assert on i18n key, model, or `data-cy`. | Translation review; visual regression. |
| **Pixel-level visual layout** | Wrong tool. | Visual regression. |
| **Third-party SDK internals** — Stripe Elements rendering, Sentry's transport queue | Owned by vendor. Mock at the import boundary. | Vendor's own tests; contract tests if needed. |
| **Real user journeys across pages** — auth → browse → cart → checkout | E2E tier. Integration tests don't drive a browser. | E2E spec. |
| **Routing configuration tables** — that a route maps to a controller / component | Declarative config; caught by build / smoke. | Never. |
| **`console.*` output, log message text** | Brittle and PII-risky. Assert on the *call* via logger spy with a structured payload, never on the message string. | Never. |
| **DOM byproducts** — `document.querySelectorAll('script').length`, layout measurements | Wrong layer. Boundary spy / state change instead. | Never (via DOM) — boundary check. |
| **Generated code** — OpenAPI / GraphQL types, version files | Output of a tool. | Excluded from coverage. |

**Rule of thumb**: *if the test would still pass after deleting one or more production modules from the boundary and replacing them with stubs that return the right shape, you're testing the framework or the implementation — not your wired-together code. Either rewrite the test so it exercises the real modules, or move it down to unit tier and delete the integration spec.*

The active `framework-<framework>.md` may add framework-specific entries (e.g. NestJS lifecycle internals, Angular hydration markers, React reconciler internals).

---

## §4.1 — Coverage Pursuit: Hit the §6 Ceiling, Then Stop

§4 / §6 is what we don't test. Everything else **inside the feature's integration surface**, we do — and we exhaust the surface before declaring the spec done.

### What "the ceiling" means for integration

Integration coverage is measured by **behaviour-surface exhaustion**, not lcov %. The lcov number is a sanity-check, not the target. The ceiling is: *every observable behaviour at the outer seam, across every reachable code-path through the wired-together boundary, is exercised by an `it(...)` — except those documented as §6-blocked.*

The surface for a NestJS controller's integration spec includes: every HTTP route × method × auth state × happy/error/edge variant. The surface for an Angular TestBed-with-real-children spec includes: every user-driven public input × every external IO response variant (success, 4xx, 5xx, network failure, slow).

### How to compute the ceiling

1. Enumerate the integration surface (every public seam × every variant; see §5.1 below).
2. For each bullet, classify:
   - **Covered** — there is an `it(...)` whose action and assertion correspond to this bullet.
   - **§6-blocked** — covered at a lower or higher tier, or excluded by §6. Document with one-line reason.
   - **Uncovered, reachable** — still in scope. Spec is **below ceiling** until each is covered.
3. The ceiling claim is: *every uncovered bullet maps to a §6-blocked archetype or has explicit unreachable-reason documentation*.

### §6-blocked archetypes (stop-condition list)

When remaining uncovered behaviour all maps to one of these, the spec is at ceiling:

- **Pure logic verified at unit tier** — branch is covered by an existing unit test; integration duplication adds no signal.
- **End-to-end visual / user-flow concern** — covered by e2e; integration cannot drive a real browser.
- **Third-party-owned flow** — payment gateway redirect, OAuth provider page, captcha challenge.
- **Translated string concern** — covered by i18n review.
- **Environment-gated** — feature flag is off in the test env; gate is verified elsewhere.
- **Dead behaviour** — controller method / public seam exists but is unreachable (commented route, removed CTA).

Anything else uncovered is reachable behaviour the spec is missing. Keep writing tests.

### Ceiling verdict labels (mandatory in every spec report)

- **`AT CEILING`** — every uncovered bullet maps to a §6-blocked archetype; enumerated.
- **`BELOW CEILING`** — real reachable behaviour was left unspecced; list each as `verb + object + condition`.
- **`ABOVE CEILING (suspicious)`** — coverage rose without a behaviour-list bullet; identify the offending test block and revert before reporting done.

---

## 5. Behaviour-list discipline *(one observable seam-effect per test)*

Before writing any test setup code:

1. List observable behaviours at the **outer seam** of the wired-together boundary, as flat `verb + object + condition` lines.
2. Skip anything in §6.
3. Each line → one test block (`it(...)`). Split lines containing "and".
4. Group lines by behaviour group → each group becomes an inner `describe(...)`.
5. Output the list as a header comment block at the top of the spec file, before the outer `describe(...)`. The header includes: scenarios covered, strategy paragraph (which modules are wired up, what is faked at the boundary, why no containers if applicable), and (if the project uses one) the spec/build-plan reference.

**Parity self-check (mandatory, before reporting done)**: count the bullet lines in the comment block and count the test blocks in the file. They must match exactly, 1:1.

- A test block without a matching list line → real behaviour discovered mid-authoring (update the comment block) or duplicate/scaffolding artefact (delete it).
- A list line without a matching test block → spec is incomplete (write the missing test) or it's a §6 violation that should be skipped (remove from list, note in report).

Drift is not allowed. Reconcile or stop.

Example header (NestJS):
```ts
/**
 * Integration spec for the orders controller.
 *
 * Scenarios:
 *   - POST /orders returns 201 with the created order on a valid payload
 *   - POST /orders returns 400 with field errors on invalid payload
 *   - POST /orders returns 401 when the bearer token is missing
 *   - POST /orders propagates X-Correlation-Id from the request header
 *   - POST /orders rolls back the in-memory repo when the publish step throws
 *
 * Strategy: boot the full OrdersModule via @nestjs/testing with the real
 * controllers, services, validators, interceptors, and guards. The OrderRepo
 * is overridden to an in-memory implementation; the EventPublisher is overridden
 * to a spy. supertest drives requests against the in-process Nest app — no
 * containers, no real Postgres, no real broker.
 */
```

### §5.1 — Edge case enumeration *(mandatory in the behaviour list)*

The behaviour list must explicitly cover edge cases at the seam. For each public seam (HTTP route, public method, exported hook), enumerate:

- **Happy path** — valid input, valid auth, expected response.
- **Validation failure** — invalid input, malformed payload, missing required fields.
- **Authn / authz failure** — missing token, invalid token, insufficient permissions.
- **Downstream IO failure** — DB write rejected, queue publish failed, third-party 5xx, network timeout.
- **Boundary values** — empty list, single-element list, max-size payload, off-by-one positions, zero quantity.
- **Pre-conditioned states** — already-existing resource, mid-transition state, idempotency key replay.
- **Concurrency / ordering** — when relevant: two concurrent writes, retry semantics, message redelivery.

If an edge case is unreachable (route guard prevents it, type system forbids it, feature flag gates it off), state it in the behaviour-list header with the reason. Missing edge-case coverage with no documented reason → `BELOW CEILING`. Reviewers must reject `AT CEILING` claims that silently skip reachable edge cases.

---

## 6. Mocking rules at the integration boundary

- **Mock only at external IO boundaries (§3).** Never mock an internal collaborator that lives inside the wired-together boundary. This is the rule that distinguishes integration from unit.
- **One fake per external boundary, declared in the project's testing toolkit** — in-memory repo classes, MSW handler sets, supertest stubs, fake clocks. The toolkit path is in `overrides.md`. Inline declarations in the spec are forbidden when another spec would also want them.
- **Prefer in-process fakes over mocks where the boundary is stable.** An in-memory repository implementing the same interface as the production adapter is preferable to a `vi.mock` of the production repo — it survives signature refactors at compile time.
- **Module mocks (`vi.mock` / `jest.mock`) are reserved for third-party imports.** Mocking `@sentry/nestjs` is fine; mocking `./my-service` is not (use DI override or, better, leave it real).
- **DI overrides via the framework's testing module are first-class.** NestJS `.overrideProvider(...).useValue(...)`, Angular `TestBed.configureTestingModule({ providers: [{ provide: X, useValue: ... }] })`, React `<Provider value={...}>` wrappers. Override only external IO providers; never override internal application code.
- **Never reach into private members** (`(controller as any).foo`, `service['privateMethod']`). If you need to assert on internal state, assert on the observable output instead.
- **Never mock the system-under-test itself.**
- **No `as any`. No `as unknown as Foo` double-casts.** Single casts are fine at real boundaries; the chain is `any` wearing a hat. Fix the toolkit handle's typing instead.

---

## 7. Naming *(descriptive test names)*

- `describe`: the wired-together subject (`OrdersController (integration)`, `CartFeature (TestBed real children)`, `app.module — CorrelationIdMiddleware`).
- Inner `describe`: behaviour group (`'POST /orders'`, `'when bearer token is missing'`, `'on 5xx downstream'`).
- Test block: single observable seam-effect, present tense — `'returns 201 with the created order on a valid payload'`. **Forbidden**:
  - `'should work'`, `'should boot'`, `'should create module'` — vague, asserts nothing specific.
  - `'calls OrderService.create'`, `'invokes the publisher'`, `'dispatches AddItem action'` — names the call site, not the seam-observable behaviour. Integration tests assert on **what crosses the seam**, not which internal call happened.
  - `'on init'`, `'after view init'`, `'constructor'` as `describe` block names.

> **Readability target — newcomer rule.** Someone new to the codebase should understand the *seam*, *trigger*, and *expected output* from a single test block, without reading the production code. If they can't, fix the test.

---

## 8. Assertions (universal principles)

The exact assertion syntax comes from the active runner file. Universal principles for integration tests:

- **Assert at the seam, not inside the boundary.** For an HTTP integration spec, assert on the HTTP response (status, body, headers). For a TestBed integration spec, assert on what the user observes (rendered output, emitted event, store state, router state) — not on intermediate calls to internal services.
- **One observable effect per test block.** Don't bundle assertions for unrelated effects.
- **Assert only what matters.** Pin the minimal slice that proves the seam-effect. Use structural matchers (`objectContaining`, `arrayContaining`) for response bodies — whole-object equality breaks on unrelated fields and obscures which field actually mattered.
- **Spy on the external IO boundary only — never on internal calls.** A spy on the in-memory repo's `save(...)` confirms the wired-together code reached persistence (legitimate). A spy on an internal validator's `validate(...)` is testing an implementation step (illegitimate — assert on the response that comes back instead).
- **For HTTP**: assert on status + (subset of) body + headers. Avoid asserting on the response object's framework-internal fields.
- **For events / observables / streams**: prefer the runner's marble/scheduler abstraction over `subscribe + done`.
- **Never assert exact call counts on logger spies.** Count assertions are brittle. Assert per call with structural matchers and check distinct calls explicitly.
- **Never assert on rendered translated text.** Assert on i18n key, model, or `data-cy`.
- **For state-action dispatches at the seam**: assert on the action literal that was dispatched (or the resulting state slice), not on dispatch call count.

### §8.1 — No logic in test bodies

Tests must be obvious. The reader must not have to compute the expected value to know what's being asserted.

- **No `if` / `else` / `switch` in test bodies.** Different paths belong in different test blocks.
- **No `for` / `while` / `.forEach` / `.map` over assertions.** Use the runner's parameterised API (`it.each` / `test.each`).
- **No computed expected values.** Inline literals: `expect(res.status).toBe(201)`, `expect(res.body).toMatchObject({ id: '01...', state: 'pending' })`.
- **No ternaries inside assertions.** Two tests pretending to be one. Split.

Single exception: setup arithmetic inside `beforeEach` / `beforeAll` (building a fixture, computing a deterministic seed) is fine; the assertion must still compare to a literal.

---

## 9. Async rules *(deterministic — no real time, no randomness)*

- **Never** use real `setTimeout` / `setInterval` / `Date.now()` / `Math.random()`. Use the runner's fake-timer abstraction or inject a deterministic clock/RNG.
- **Promise-returning fakes resolve immediately.** Async test setup should not require real waiting.
- **Network round-trips at the boundary are faked.** Supertest sends requests against the in-process app — no port is opened, no real network involved. MSW intercepts before `fetch` reaches the network. nock intercepts at the Node http layer.
- **Hot streams / subscriptions** — use the framework's testing utilities (Angular `HttpTestingController.verify()` in `afterEach`, RxJS marble schedulers) — never raw `subscribe()` without cleanup.
- **Module re-imports for env-driven init guards** — use `vi.resetModules()` / `jest.resetModules()` + dynamic `import()` between sub-cases when production code initialises at module-evaluation time. Document the trick in the spec header comment.

---

## 10. Anti-flake checklist *(isolated & deterministic — enforced by review)*

Integration tests are slower than unit tests; flakes erode trust faster than coverage gaps. The flake budget per project is approximately zero — every flake is investigated and rooted out, not retried.

### Forbidden

- **Real network.** Mock at the HTTP-client boundary or use supertest against the in-process app.
- **Real `setTimeout` / `setInterval`** without fake timers.
- **Real `Date.now()` / `Math.random()`** in production code-paths under test, without a deterministic seed or clock injection.
- **Static `await new Promise(r => setTimeout(r, ms))`** in the spec body. Wait on the observable signal (HTTP response, emitted event, fake-timer advance).
- **Order-dependent specs.** Each spec independently runnable.
- **Shared mutable state between tests** — leftover env vars, persisted in-memory repo entries, fixture mutations. Reset in `afterEach` / `beforeEach`.
- **Raw mutation of host globals** (`window`, `document`, `process.env`, `localStorage`). Use toolkit helpers or restore in `afterEach`.
- **Real containers / external services** unless the project has explicit `overrides.md` carve-outs per §3.1.
- **Random data without a seed.** Seed the data or fix the clock.

### Required

- **Each test starts from a known clean slate.** In-memory repos reset in `beforeEach`; spies reset; env vars restored.
- **Wait on the consequence.** HTTP response, emitted event, fake-timer advance, repo entry appearing.
- **Idempotent `beforeEach`.** The same setup runs identically on retry.
- **Clean test data via builders.** No leftover PII, no real customer data.
- **Single failure mode.** When a spec fails, it fails for **one** reason. If a flake intermittently appears as a different stack trace, fix the test design — don't add a retry.

### §10.1 — Flaky test remediation policy

A flaky integration test is worse than no test. When a flake is identified:

1. **Skip it immediately** (`it.skip` / `xit`) and open a ticket. **Do not "rerun until green".**
2. **Diagnose the root cause** before re-enabling — real timer leakage, unmocked randomness, order dependency, async race, real I/O, container start-up timing, env mutation. Add a `// Flake root cause: <cause>` comment on the re-enabled test.
3. **Never add retries** (`--retries=N`, runner-level rerun loops). Retries hide bugs.
4. **If the flake originates in production code** (race condition, non-deterministic output, hidden global state), **fix the production code**. The test was telling the truth.

Skipped flaky tests count against `AT CEILING` claims — they are uncovered reachable behaviour, not §6-blocked archetypes.

---

## 11. Cleanup (universal)

- Restore spies / module mocks in `afterEach`.
- Tear down the bootstrapped app in `afterAll` (`await app.close()` for Nest, `TestBed.resetTestingModule()` for Angular when needed, `cleanup()` for RTL).
- Call `HttpTestingController.verify()` (Angular) / equivalent in `afterEach` for any spec that uses HTTP testing.
- Reset in-memory fakes (`repo.reset()`, `msw.resetHandlers()`) in `beforeEach`.
- Restore `process.env` entries in `afterEach`.

---

## 12. File structure (every integration spec) *(Arrange–Act–Assert)*

Every test block follows **Arrange–Act–Assert (AAA)**: set up the world (or inherit `beforeAll/beforeEach`), trigger the seam, assert on the outcome. Keep the three phases visible.

The outer shape is universal. The bootstrap inside `beforeAll` / `beforeEach` is framework-specific and comes from `framework-<framework>.md`. The spy/mock primitives are runner-specific.

```ts
/**
 * Integration spec header (per §5)
 *
 * Scenarios: ...
 * Strategy: ...
 */

describe('<WiredSubject (integration)>', () => {
  // Bootstrapped handles declared here
  let app: INestApplication; // or fixture / harness / hook-wrapper depending on framework

  beforeAll(async () => {
    // Framework-specific bootstrap (see framework-<framework>.md)
    // Override only external IO providers; internal collaborators stay real
  });

  afterAll(async () => {
    // app.close() / TestBed.resetTestingModule() / cleanup()
  });

  beforeEach(() => {
    // Reset per-test fakes (in-memory repo, MSW handlers, spies)
  });

  afterEach(() => {
    // Spy restore, HTTP testing verify, env restore
  });

  describe('<seam — group>', () => {
    it('returns / emits / sets X when Y', async () => {
      // Arrange / Act / Assert
    });
  });
});
```

---

## 13. Test data — minimal, PII-free, fixture-backed

- **Builders / factories** — every reusable fixture lives behind a builder (path in `overrides.md`). Hand-assembled multi-field objects inside spec files are toolkit debt; flag and migrate.
- **Realistic shape** — fixtures must match the production payload shape exactly. The fastest way to author a new fixture is to copy a real response from a dev/staging environment and strip sensitive fields. Do not invent fields the backend doesn't return.
- **Minimal** — only the fields the spec asserts on need to be realistic. Defaults handle the rest.
- **No real PII** — no real emails, phone numbers, addresses, payment data, national IDs, or auth tokens, even in fixtures. Builders default to obviously-fake values (`'test@example.invalid'`, `'+10000000000'`, `'fake-token'`).
- **Log-assertion spies must not capture PII.** Use structural matchers (`objectContaining({ has_email: true })`) instead of literal email strings. If a spec ends up asserting on a PII string, the production code is leaking PII — that's a bug, not a test concern.

---

## 14. Header comment block (mandatory)

Every integration spec opens with a header comment block containing:

1. **One-line description** — "Integration spec for `<wired subject>`."
2. **Scenarios** — bullet list mirroring §5 behaviour list (the actual `it(...)` titles, or a tight paraphrase).
3. **Strategy** — one paragraph describing:
   - Which modules are wired up (the boundary).
   - What is faked at the seam (in-memory repo? MSW? supertest? injected clock?).
   - Why containers are **not** used (or, if they are, the `overrides.md` reference that authorised it).
4. **Spec / build-plan reference** (optional but recommended when the project uses spec-driven development) — pointer to the openspec scenario, ADR, or build-plan section the integration spec verifies.

This header is the entry point for every reader of the spec — it tells them what's real, what's fake, and why. Reviewers must flag specs without this header.
