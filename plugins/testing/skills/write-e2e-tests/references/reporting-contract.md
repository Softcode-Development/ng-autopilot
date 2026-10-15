# Reporting Contract — E2E Author Agent Output

The `e2e-test-author` subagent must return this exact structure at the end of every invocation. No prose, no other shape. The orchestrating skill parses this report and surfaces fields in the run-level summary.

---

## Required fields

- **Feature / spec**: short feature name (e.g. `Cart`, `Auth — sign in`) + absolute spec path
- **Subject components / files**: absolute paths to the production components, services, effects, and routes the spec exercises (the source-of-truth files the author read to map the behaviour surface)
- **Detected framework**: e.g. `cypress`, `playwright` (from the `detect-stack` skill in `e2e` mode)
- **Detected stack**: e.g. `angular`, `react`, `react-native`, `vue` (from `detect-stack`)
- **Mode**: `mock-first` or `real-api` — and if `real-api`, the explicit reason it was chosen (`golden-path`, `contract-verification`, `known-regression`, `user-requested`)
- **Behaviours covered**: bulleted list (`verb + object + condition` per line)
- **Behaviours skipped (§6 forbid list)**: list of `<would-have-been-line> — §6: <reason>` for behaviours not tested because `core.md` §6 forbids it (third-party widget internals, translated text, visual concern, etc.), or "none"
- **Behaviours marked unreachable / out-of-scope (§5.1)**: list of `<bullet> — unreachable: <reason>` for behaviours not tested because they are gated off in this env, removed from product, or reachable only via a code path that was deleted. Document the gate or invariant. Not-the-same-thing as §6.
- **Parity check**: `bullets: N, test blocks: M` — must be equal; if not equal, the author has not finished. State both numbers explicitly.
- **Self-check attestation**: every category below was grepped/inspected before reporting; all counts must be `0`. If any > 0, **do not report** — return to self-review and fix first.
  - Static `wait(ms)` calls (`cy.wait(<number>)`, `page.waitForTimeout(...)`): 0
  - `it.only` / `describe.only` / `context.only` / `test.only`: 0
  - `it.skip` / `xit` / `xdescribe` without an open ticket and a `// Flake root cause:` comment: 0
  - Raw `cy.get('.<class>')` / `cy.get('#<id>')` / tag-only selectors in spec body (page-object internals also count): 0
  - Selector by translated text (`cy.contains('<English string>')`, `getByText('<English string>')`) as primary handle: 0
  - Inline mock / fixture object literals with > 3 fields constructed in the spec (use builders/factories): 0
  - Reusable spec helpers defined inline (should live in `cypress/support/` or equivalent): 0
  - `console.*` assertions (text or call shape): 0
  - PII in fixtures, intercept bodies, or assertion expected values: 0
  - `if` / `for` / `.forEach` / `.map` over assertions / ternaries / computed expected values in test bodies: 0
  - Page-object methods that assert (should return chainers/locators, not perform `should(...)` internally): 0
  - Smoke-only `it(...)` blocks whose sole assertion is `<page-root>.should('exist')` or `body.should('be.visible')`: 0
  - Tautological URL assertions (`url.should('include', '/')`): 0
  - Mocked operations the page fires that are unmocked (network shows passthrough or `{data: {}}` defaults): 0
  - Tests whose assertion would still pass if the production handler returned a hardcoded stub of the asserted shape: 0
  - Real `setTimeout` / `setInterval` reliance in the spec body without `cy.clock` / `page.clock`: 0
- **Stack-specific gate compliance** — confirm each step that the active `stack-<stack>.md` requires before the first navigation. Examples:
  - Angular SSR: `stripSSRTransferState()` called in `beforeEach`? `yes` / `n/a (non-SSR build)`
  - Angular reactive forms: every input write uses `ngClearAndType` (or equivalent) and not raw `.type()`? `yes` / `no form inputs`
- **Network mock coverage**: for mock-first mode, list every operation/endpoint the spec triggers and which mock fixture/handler covers it. For real-API mode, list the operations that are intentionally hitting the real API and the staging env URL.
- **Persistence coverage**: which `it(...)` exercises reload / cross-route persistence — or "no persistence-relevant behaviour in this feature"
- **Behavioural ceiling verdict** (per `core.md` §6.1):
  - **`AT CEILING`** — every uncovered behaviour-list bullet maps to a §6-blocked archetype or has explicit unreachable-reason documentation. Enumerate each blocker as `bullet — archetype — refactor candidate / dead code / accept`
  - **`BELOW CEILING`** — reachable behaviour was left unspecced; list each missing behaviour as `verb + object + condition`
  - **`ABOVE CEILING (suspicious)`** — `it(...)` blocks present that don't correspond to a behaviour-list bullet (often: smoke filler that crept in). Identify and revert before reporting done.
- **Test count**: total `it(...)` blocks
- **Run time**: total seconds for the scoped run
- **Scoped run command**: the exact command the orchestrator passed in (verbatim)
- **Scoped run exit code**: 0 / non-zero
- **Lint exit code**: 0 / non-zero (if a linter applies to e2e files — many projects have a separate `eslint` config for `cypress/`)
- **Toolkit additions made in this pass**: list each. For every addition, confirm all four checklist steps are done:
  1. file at conventional path (helper / page object / fixture) with JSDoc / header comment explaining the *why*
  2. barrel re-export (or `support/index.ts` declaration for custom commands)
  3. type declaration if the addition introduces a new `cy.<command>` (in `cypress/support/index.d.ts` or equivalent)
  4. example usage in at least one spec (typically the spec just written) — proves the addition is reachable
- **Pre-existing violations to surface** (per `core.md` §2.1): any rule-violating patterns in sibling specs that the author noticed while reading the codebase. Format: `<spec-path:line> — <rule>: <quote>`. Not for fixing in this PR — for the team's awareness.
- **Backlog update**: the exact row written to the backlog (`[x] <feature-name> — N tests, VERDICT (mode: mock-first|real-api)` or `[x] <feature-name> — §6: <reason>`)
- **Mutation-test confirmation**: state one production-code line you mentally mutated and confirmed the spec would fail on. E.g. `"Mutated CartEffect.adjustQuantity to early-return; spec 'recomputes subtotal when quantity is increased' fails as expected."`

---

## When the report should NOT be generated (escalate instead)

- Feature's behaviour surface is ambiguous or undocumented — do not guess.
- Required helper/page-object/fixture is missing from the project's toolkit AND the addition would refactor multiple specs or change toolkit conventions.
- A real-API spec is being requested without user-explicit authorisation (real-API specs need staging credentials and may surface real PII).
- Feature touches code exercised by an active critical journey and the change risks invalidating an existing assertion — flag it; the project may require a same-PR update to the critical spec.
- Feature has so much surface that one spec file feels wrong (>15 `it(...)` blocks) — propose a split into `critical/` (cross-page journey) + `pages/` (deep per-page) before writing.
- The §6 forbid list is unclear for this feature — quote the section, ask for a ruling.
- The scoped run command isn't passing after one rewrite — escalate, do not loop.
- A reviewer finding would require production-code changes — surface to the user; author agents write specs, page objects, and fixtures, never production code.

In any of these cases: return a brief escalation message naming the blocker, do not write the structured report, do not tick the backlog.
