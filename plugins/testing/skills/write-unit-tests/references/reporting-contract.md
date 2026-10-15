# Reporting Contract — Author Agent Output

The `unit-test-author` subagent must return this exact structure at the end of every invocation. No prose, no other shape. The orchestrating skill parses this report and surfaces fields in the run-level summary.

---

## Required fields

- **Subject file**: absolute path
- **Spec file**: absolute path
- **Detected runner**: e.g. `karma-jasmine`, `jest`, `vitest` (from the `detect-stack` skill in `unit-tests` mode)
- **Detected stack**: e.g. `angular`, `react`, `react-native` (from the `detect-stack` skill in `unit-tests` mode)
- **Behaviours covered**: bulleted list (`verb + object + condition` per line)
- **Behaviours skipped (§6 forbid list)**: list of `<would-have-been-line> — §6: <reason>` for behaviours not tested because `core.md` §6 forbids it (framework wiring, translated text, private methods, etc.), or "none"
- **Edge cases marked unreachable (§5.1)**: list of `<method>: <edge> — unreachable: <reason>` for edge cases not tested because the type system / call graph / invariant forbids them (e.g. "null input — type system forbids; param is `string`, not `string | null`"), or "none". §5.1 unreachables are **not** §6 forbids — they are reachable in principle but blocked by an invariant; document the invariant.
- **Parity check**: `bullets: N, test blocks: M` — must be equal; if not equal, the author has not finished. State both numbers explicitly.
- **Self-check attestation**: every category below was greppped/inspected before reporting; all counts must be `0`. If any > 0, **do not report** — return to Step 10 and fix first.
  - `as any` casts in spec code: 0
  - `as unknown as <T>` double-casts in spec code: 0
  - Inline mock / spy declarations (`jasmine.createSpyObj`, `jest.fn()`, `vi.fn()`, mock provider literals): 0
  - Inline builder / factory functions: 0
  - Hand-assembled multi-field fixture objects (use builders instead): 0
  - Reusable spec helpers defined in this file: 0
  - Real `setTimeout` / `setInterval` / `Date.now()` / `Math.random()`: 0
  - Raw mutation of `window` / `document` / `history` / `localStorage` / `sessionStorage` / `environment` (use toolkit helpers): 0
  - Raw `subscribe(` or unawaited promises without cleanup: 0
  - `if` / `for` / `.forEach` / `.map` over assertions / ternaries / computed expected values in test bodies: 0
  - Exact call counts on logger spies (`toHaveBeenCalledTimes` on a logger): 0
  - Translated UI text assertions: 0
  - DOM-shape assertions on conditional template nodes: 0
  - Private-method probing (`(x as any).foo` / reaching into internals): 0
  - PII in fixtures, spy assertions, or log payloads: 0
  - Skipped flaky tests without an open ticket and a `// Flake root cause:` comment: 0
- **Error-path coverage**: every `try/catch`, `.catch(...)`, error callback, or error stream operator in the subject, plus which test block exercises each — or "no error paths in subject"
- **Coverage delta + ceiling verdict** (per `core.md` §6.1):
  - Per-file before → after for the subject: `lines X% → Y%`, `branches X% → Y%`, `functions X% → Y%` (from coverage report; lcov format is standard across runners)
  - **Ceiling verdict** — exactly one of:
    - **`AT CEILING`** — remaining gap is fully accounted for by §6-blocked archetypes; list each blocker as `methodName() at file:line — archetype — refactor candidate / dead code / accept`
    - **`BELOW CEILING`** — real reachable behaviour was left unspecced; list each missing behaviour as `verb + object + condition`
    - **`ABOVE CEILING (suspicious)`** — coverage rose without a corresponding behaviour-list bullet; identify the offending test block and revert before reporting done
- **Test count**: total test blocks
- **Run time**: seconds
- **Scoped test command**: the exact command run
- **Scoped test exit code**: 0 / non-zero
- **Lint exit code**: 0 / non-zero
- **Toolkit additions made in this pass**: list each. For every addition, confirm all four checklist steps are done:
  1. file at conventional path with JSDoc
  2. barrel re-export
  3. README row
  4. self-test for non-trivial logic
- **Backlog update**: the exact row written to the backlog (`[x] path — N tests, VERDICT (lines X%→Y%, branches X%→Y%)` or `[x] path — §6: <reason>`)

---

## When the report should NOT be generated (escalate instead)

- Subject's behaviour is ambiguous or undocumented — do not guess.
- Required mock/builder is missing from the project's toolkit and the addition would refactor multiple subjects or change toolkit conventions.
- Subject is exercised by an e2e/critical spec (overrides.md will list the directory) and the change risks invalidating an e2e assertion — flag it; the project may require a same-PR e2e update.
- Subject has so much logic that one spec file feels wrong (>20 test blocks) — propose a split before writing.
- The §6 forbid list is unclear for this subject — quote the section, ask for a ruling.
- The scoped test command isn't passing after one rewrite — escalate, do not loop.

In any of these cases: return a brief escalation message naming the blocker, do not write the structured report, do not tick the backlog.
