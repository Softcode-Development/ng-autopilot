# Unit Testing — Core Principles

Universal rules for unit tests, **runner-agnostic and stack-agnostic**. These principles apply whether the project uses Karma/Jasmine, Jest, Vitest, or Mocha; whether the app is Angular, React, React Native, or Vue.

Read alongside:
- The active **runner** reference (`runner-<runner>.md`) for spy/mock/fake-timer/assertion syntax
- The active **stack** reference (`stack-<stack>.md`) for component testing, framework mocks, and stack-specific §6 additions
- The project-specific `overrides.md` (if present)

These core rules are the floor — they cannot be loosened by runner/stack files or overrides. Runner/stack files and overrides only **add** rules.

---

## 1. Three-tier test taxonomy *(the test pyramid)*

| Tier | Lives in | Runs via | Scope |
|---|---|---|---|
| **Unit test** | `*.spec.ts` / `*.test.ts` next to source | the project's unit-test runner | One class/function. All collaborators mocked. No DOM rendering of children. |
| **Integration test** | same file extension, `describe`d "Integration:" | same runner | One feature slice with real collaborators in scope, mocked at the boundary. |
| **E2E test** | Cypress / Playwright / similar suite | E2E runner | Real user journeys. **Out of scope for this skill.** |

This skill writes unit tests only. Integration tests follow the same authoring rules with broader scope.

---

## 2. Zero tolerance for placeholder specs

A spec file with only `it('should create', () => expect(component).toBeTruthy())` (or the runner's equivalent) is technical debt, not coverage. Delete or replace it.

---

## 2.1 — Rules beat codebase convention

When the rules in these references disagree with patterns you see in **existing specs in the repository**, the rules win. Existing specs that violate the rules are technical debt, not precedent — including specs that have been in the codebase for years, specs written by senior authors, and specs that other team members have referenced as "the way we test X here". A wrong pattern is wrong regardless of who wrote it or how widely it spread.

When you find a rule-violating pattern in existing specs:

- **Do not copy it into the new spec.** "We test it this way everywhere else" is not a defence — it makes the new spec wrong too.
- **Do not extend it.** Adding one more `it('calls X with Y')` because the sibling spec has six of them is propagation, not consistency.
- **Flag it.** List the pre-existing violations in your report under a "pre-existing violations to surface" section so the team can clean them up. Reviewers must flag the new violation **and** the pattern it copied from.

The single exception: when `overrides.md` documents a project-specific carve-out from a `core.md` rule. Project overrides extend the floor; existing-spec patterns do not.

---

## 3. §6 — What We Explicitly Do NOT Test *(test behaviour, not implementation)*

Coverage isn't the goal — confidence in *our* code is. Testing things we don't own or that the compiler/framework already guarantees is noise. This is a **review-level forbid**; reviewers must reject specs that violate it.

| Not tested | Why | Where it gets tested instead |
|---|---|---|
| **Framework behaviour** — lifecycle hooks fire in order, routers navigate, HTTP clients send bytes | Owned by the framework. | Never. Trust the framework. |
| **Page-metadata wiring** — anything that sets page/document metadata (title, description, social/OG/SEO tags, canonical URL, favicon, manifest, head injection), whether the subject calls a framework primitive directly **or routes through a project wrapper service over it**. The fact that the call goes through your own `MetaTitleService` / `SeoService` / `HeadService` does not make the metadata payload your behaviour — the wrapper is a relay, the owner is still the framework's metadata layer. | Payload is static branding / i18n, not behaviour. If real logic transforms a dynamic input into the metadata value, test the **input/model** that drives it (e.g. the computed title signal, the selector, the resolver output) — never the metadata call, never the branding suffix, never the call count. | Never via spec. SEO smoke test or visual review. |
| **Trivial template bindings** — `{{ user.name }}` rendering the right string | Zero logic. Template type-checker catches mistakes. | Never. |
| **Simple getters/setters / pass-through methods** — `get name() { return this._name; }` | No branches, no side effects. | Never. |
| **Auto-generated code** — generated GraphQL/OpenAPI types, version files, build metadata | Output of a tool. | Excluded from coverage. |
| **Routing configuration tables** — that a route maps to a component | Declarative config; mistakes caught by build / smoke tests. | Never. |
| **Style / SCSS / CSS** | Wrong abstraction layer. | Visual review or E2E. |
| **Third-party libraries** — RxJS operators, Apollo cache merge internals, state-management library mechanics | Already covered upstream. We test our reducers/effects/selectors, not the framework. | Never. |
| **Private methods directly** | Implementation detail. Test through the public API. | The public method's spec exercises the path. |
| **Constants / enums / interfaces / type aliases** | TypeScript guarantees this. | Compiler. |
| **`console.*` output, log message text** | Brittle and PII-risky. Assert on the *call* with a structured payload, never on the message string. | Never. |
| **Translated UI text** | Specs must not depend on translated strings. Assert on keys/IDs or on the model that drives the title/text. | Never. |
| **DOM byproducts of code under test** | E.g. `document.querySelectorAll('script').length`. Spy on the boundary instead. | Never (via DOM) — boundary spy. |

**Rule of thumb**: *if the test would still pass after deleting the production code and replacing it with a stub that returns the right shape, you're testing the framework, not your code. Delete the test.*

The active `stack-<stack>.md` may add framework-specific entries (e.g. PrimeNG internals for Angular, gesture handlers for React Native).

---

## §6.1 — Coverage Pursuit: Hit the §6 Ceiling, Then Stop

§6 is what we don't test. Everything else, we do — and we **push coverage on each subject file as high as the §6 forbid list permits**, no further.

### What "the ceiling" means

A subject's coverage ceiling is the highest line/branch/function % reachable using only public API entry points, without violating §6 (no private-method testing, no real timers, no DOM-shape assertions, no constant-asserting filler). The ceiling is a property of the subject, not a global number.

### How to compute the ceiling

1. Run the project's scoped test command with coverage and read per-file numbers from the coverage report. The standard format is `lcov.info`: `LF`/`LH` for lines, `BRF`/`BRH` for branches, `FNF`/`FNH` for functions. Jest, Vitest, and Karma all emit lcov by default.
2. Identify every uncovered line/branch/function. For each, classify it as either:
   - **Reachable from public API** → still in scope → not at ceiling yet.
   - **§6-blocked archetype** (list below) → out of scope → counts toward the ceiling.
3. The ceiling claim is: *every uncovered region maps to a §6-blocked archetype*. State this by enumerating each blocker in the report with its `file:line`. `AT CEILING` means the enumeration is exhaustive.

### §6-blocked archetypes (stop-condition list)

When remaining uncovered regions all map to one of these, you have hit the ceiling:

- **Private multi-stage async pipeline** — no public entry point.
- **Private debounce / throttle stream** — fired only by internal events.
- **Real `setTimeout` inside an async subscription** — untestable without timer mutation of production code.
- **Fire-and-forget async, errors swallowed** — no observable side effect.
- **Only reachable from another §6-blocked method** — private helper of a blocked method.
- **Dead entry point** — public method whose call sites are all commented out, or gated on a removed flag.
- Or anything else in the §6 table above.

Adding tests beyond this point requires a production refactor, not more spec authoring. Stop writing tests and report.

### Refactor vs accept

When the ceiling is well below the archetype's floor (see `coverage-floors.md`), name each blocker with `file:line` and classify it as:
- **Refactor candidate** — extract to an injected service so it can be unit-tested at its boundary.
- **Dead code** — propose deletion.
- **Accept** — genuinely defensive code with no observable boundary (rare; document why).

**This is not a coverage-chasing rule.** Every new test block must still satisfy §6 and the behaviour-list discipline. A test added solely to inflate a number is a §6 violation regardless of coverage impact.

### Ceiling verdict labels (mandatory in every spec report)

- **`AT CEILING`** — every uncovered region is a §6-blocked archetype; enumerated with `file:line`.
- **`BELOW CEILING`** — real reachable behaviour was left unspecced; list each as `verb + object + condition`.
- **`ABOVE CEILING (suspicious)`** — coverage rose without a behaviour-list bullet; identify the offending test block and revert before reporting done.

---

## 4. F.I.R.S.T. principles

- **Fast** — milliseconds per test; no real I/O, no real timers.
- **Isolated** — all collaborators mocked; no shared state between tests.
- **Repeatable** — same result every run, any order, any machine.
- **Self-validating** — explicit pass/fail; no manual log inspection; descriptive test titles.
- **Timely** — written in the same PR as the production code.

---

## 5. Behaviour-list discipline *(one observable behaviour per test — one reason to fail)*

Before writing any test setup code:

1. List observable behaviours of the public API as flat lines: `verb + object + condition`.
2. Skip anything in §6.
3. Each line → one test block (`it(...)` in Jasmine/Jest/Vitest/Mocha). Split lines containing "and".
4. Group lines by behaviour → each group becomes an inner `describe(...)`.
5. Output the list as a comment block at the top of the spec file before the outer `describe(...)` opens.

**Parity self-check (mandatory, before reporting done)**: count the bullet lines in the comment block and count the test blocks in the file. They must match exactly, 1:1.

- A test block without a matching list line → real behaviour discovered mid-authoring (update the comment block) or duplicate/scaffolding artifact (delete it).
- A list line without a matching test block → spec is incomplete (write the missing test) or it's a §6 violation that should be skipped (remove from list, note in report).

Drift is not allowed. Reconcile or stop.

Example:
```ts
// Behaviours covered:
// - dispatches AddToCart when addItem(productId) called with valid id
// - emits empty array when store has no items
// - calls navigate(['/login']) when init runs and user is null on browser
// - skips navigate when init runs on server platform
// - logs structured payload { orderId, has_email: true } when checkout fails
```

### §5.1 — Edge case enumeration *(mandatory in the behaviour list)*

The behaviour list must explicitly cover edge cases, not just the happy path. For each public method with input or branches, enumerate:

- **Empty inputs** — `[]`, `''`, `{}`
- **`null` / `undefined`** — where the type permits
- **Boundary values** — zero, negative, max, single-element arrays, off-by-one positions
- **Invalid data at runtime boundaries** — malformed payloads, unexpected shapes from external sources
- **Error conditions** — thrown errors, rejected promises, collaborator failures

If an edge case is unreachable (type system forbids it, input is internally constructed), state it in the behaviour-list comment block with the reason. Missing edge-case coverage with no documented reason → `BELOW CEILING`. Reviewers must reject `AT CEILING` claims that silently skip reachable edge cases.

---

## 6. Mocking rules (universal)

- **One mock per dependency, declared in the project's testing toolkit** — never re-declare an inline mock in a spec. The toolkit path is in `overrides.md`.
- **Never reach into private members** (`(component as any).foo`). If you need to assert on internal state, expose it through a tested public API or assert on the observable side-effect.
- **Never mock the subject under test.**
- **Mock only externals — don't over-mock.** Good candidates: APIs, databases, message queues, navigation, analytics, time, randomness. Bad candidates: pure functions, value objects, simple DTOs, in-process domain objects. Over-mocking couples specs to implementation and produces fragile suites that "test the mock" instead of the behaviour.
- **Prefer hand-rolled spies** over a heavyweight mocking library — avoids dependency churn. The runner file lists the exact primitive (Jasmine: `jasmine.createSpyObj`; Jest: `jest.fn()`; Vitest: `vi.fn()`).
- **No `as any`. No `as unknown as Foo` double-casts.** Single casts are fine at real boundaries; the chain is `any` wearing a hat. Fix the toolkit handle's typing instead.

---

## 7. Naming *(descriptive test names)*

- `describe`: subject under test (class name or feature).
- Inner `describe`: behaviour group (`'on init'`, `'when signed in'`, `'addToCart()'`).
- Test block: single observable behaviour, present tense — `'dispatches addItem when cart button clicked'`. **Forbidden**:
  - `'should create'`, `'should work'`, `'should render'` — vague, asserts nothing specific.
  - `'calls <method>...'`, `'invokes <method>...'`, `'passes <arg> to <method>...'`, `'dispatches to <method>...'` — names the call site, not the behaviour the user/next-page/next-system observes. If the only thing you can say about the test is "it calls X", you are testing the framework or the implementation. Rewrite around the observable effect, or delete (§3 rule-of-thumb).

> **Readability target — newcomer rule.** Someone new to the codebase should understand the *scenario*, *action*, and *expected outcome* from a single test block, without reading the production code. If they can't, the title is vague, the AAA structure is muddled, or the assertion is too oblique. Fix the test, not the reader.

---

## 8. Assertions (universal principles)

The exact assertion syntax comes from the active runner file. Universal principles:

- **One observable behaviour per test block.** Don't bundle assertions for unrelated behaviours.
- **Assert only what matters.** Don't assert on entire large objects when one field drives the behaviour under test. Use structural matchers (`objectContaining`, `arrayContaining`) and pin the minimal slice that proves the behaviour. Whole-object equality assertions break on unrelated changes and obscure which field actually mattered.
- **Prefer single-assertion-per-call patterns** that combine "was called" + "with these args" into one expectation (Jasmine 4+ `toHaveBeenCalledOnceWith`; Jest's `.toHaveBeenCalledWith` after asserting `.toHaveBeenCalledTimes(1)`; Vitest equivalent).
- **Never assert exact call counts on logger spies.** Count assertions are brittle. Assert per call with structural matchers (Jasmine: `jasmine.objectContaining`; Jest: `expect.objectContaining`; Vitest: `expect.objectContaining`) and check distinct calls explicitly.
- **Never assert on rendered translated text.** Assert on the model that drives the title/text, or on the i18n key.
- **For state-action dispatches**: assert on the action literal that was dispatched, not on the dispatch method invocation count.
- **For multi-emission observables / streams**: prefer the runner's marble/scheduler abstraction over `subscribe + done`.
- **Spy on a dependency call only when the call itself IS the observable effect** — e.g. a cleanup side-effect, a navigation, an analytics event fired into a void. If the call is just an internal step toward a testable output (a return value, a public property, rendered state), assert on that output instead and leave the intermediate call untested. The rule of thumb: *could you verify the same behaviour by checking the output rather than the call? If yes, check the output.*

### §8.1 — No logic in test bodies

Tests must be obvious. The reader must not have to compute the expected value to know what's being asserted. Reviewers must reject specs that violate any of:

- **No `if` / `else` / `switch` in test bodies.** Different paths belong in different test blocks.
- **No `for` / `while` / `.forEach` / `.map` over assertions.** Use the runner's parameterised API (Jest/Vitest: `it.each`; Jasmine: one `it` per case).
- **No computed expected values.** `expect(x).toBe(items.length * 2)` hides the answer. Inline literals: `expect(x).toBe(8)`. If the literal changes when production is correct, update the test — that's the point of pinning.
- **No ternaries inside assertions.** `expect(x).toBe(isAdmin ? 'admin' : 'guest')` is two tests pretending to be one. Split.

Single exception: setup arithmetic inside `beforeEach` (building a fixture) is fine; the assertion must still compare to a literal.

---

## 9. Async rules *(deterministic — no real time, no randomness)*

The exact fake-timer / async primitive comes from the active runner file. Universal principles:

- **Never** use real `setTimeout` / `setInterval` / `Date.now()` / `Math.random()`. Use the runner's fake-timer abstraction. Stub `Date.now()` / `Math.random()` via the runner's spy primitive.
- **Never** use a callback-style done signal if the operation is synchronous after mocking.
- All Promise-returning mocks resolve immediately. Async test setup should not require real waiting.
- All network and time operations route through testing controllers / fake clocks, not real I/O.

---

## 10. Anti-flake checklist *(isolated & deterministic — enforced by review)*

- No real network. Use the framework's HTTP testing controller or the runner's network mock.
- No real `setTimeout` / `setInterval`.
- No reliance on element measurements (`getBoundingClientRect`, layout-dependent values).
- No global state leakage between tests. Always restore spies/stubs in the runner's "after each" hook.
- No raw mutation of host globals (`window`, `document`, `history`, `localStorage`, `sessionStorage`, `document.cookie`). Use toolkit helpers — see `runner-<runner>.md` / `stack-<stack>.md` / `overrides.md`.
- No raw mutation of `environment` / config singletons. Use a deep-merge override helper.
- No raw `subscribe()` (RxJS) or unawaited promises without cleanup.

### §10.1 — Flaky test remediation policy

A flaky test is worse than no test — it trains the team to ignore failures and erodes CI trust. When a flaky test is identified:

1. **Skip it immediately** (`xit` / `it.skip`) and open a ticket. **Do not "rerun until green".** Never merge a flaky test in the hope it stabilises.
2. **Diagnose the root cause** before re-enabling — real timer leakage, unmocked randomness, order dependency, async race, real I/O, layout-dependent measurement. Add a `// Flake root cause: <cause>` comment on the re-enabled test so the next person sees what was fixed.
3. **Never add retries** (`--retries=N`, `cy.retry()`, custom rerun loops, `flaky-test-reporter` allowlists) to mask flakiness. Retries hide bugs in production code, not just specs.
4. **If the flake originates in production code** (race condition, non-deterministic output, hidden global state), **fix the production code**. The test was telling the truth.

Skipped flaky tests count against `AT CEILING` claims — they are uncovered reachable behaviour, not §6-blocked archetypes. The author's report must list any skipped flaky tests under `BELOW CEILING` with the ticket reference.

---

## 11. Cleanup (universal)

- Restore spies in the runner's "after each" hook if you spied on globals. (Some runners auto-restore when you spy on existing methods; explicit restore is always safe.)
- Tear down created subjects in the runner's "after each" hook.
- Call any HTTP/network testing controller's `verify()` in the runner's "after each" hook for any spec that uses HTTP testing.

---

## 12. File structure (every spec) *(Arrange–Act–Assert)*

Every test block follows **Arrange–Act–Assert (AAA)**: set up the world, invoke the behaviour, assert on the outcome. Keep the three phases visible — either a blank line between them or inline `// Arrange / Act / Assert` comments — so the reader sees structure at a glance. A test block that mixes setup, invocation, and assertion in a single dense paragraph is harder to debug when it fails.

The outer shape is universal. The test bed / render template inside `beforeEach` is stack-specific and comes from `stack-<stack>.md`. The spy/mock primitives inside test blocks are runner-specific and come from `runner-<runner>.md`.

```ts
// Behaviours covered:
// - <verb + object + condition>
// - ...

describe('<Subject>', () => {
  let subject: T;
  // declare other handles here

  beforeEach(/* runner-specific async setup */ () => {
    // Test bed setup (stack-specific) — see stack-<stack>.md
    // Mock wiring (runner-specific spies) — see runner-<runner>.md
  });

  afterEach(() => {
    // Cleanup goes here (HTTP verify, spy restore, subject teardown)
  });

  describe('<behaviour group>', () => {
    it('does X when Y', () => {
      // Arrange / Act / Assert
    });
  });
});
```

---

## 13. Test data — minimal and PII-free

**Keep test data minimal.** Only populate the fields the assertion actually relies on. A 40-field fixture object hides which field drives the result, and breaks on unrelated changes elsewhere in the type. Use the project's builders/factories (path in `overrides.md`) — they default sensible values, and the spec overrides only the fields under test. Whole-fixture equality assertions are a §8 "assert only what matters" violation.

**No real PII in test data.** No real emails, phone numbers, addresses, payment data, national IDs, or auth tokens — even in fixtures, even in mocks. Builders must default to obviously-fake values (`'test@example.invalid'`, `'+10000000000'`, `'fake-token'`).

**Log-assertion spies must not capture PII.** Use structural matchers (`objectContaining({ has_email: true })`) instead of literal email strings. The structured payload should match what would actually be logged in production: IDs, boolean flags, error codes — never PII. If a spec ends up asserting on a PII string, the production code is leaking PII to the logger and that's a bug, not a test concern.
