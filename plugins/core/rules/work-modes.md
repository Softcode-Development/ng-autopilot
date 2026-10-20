# Work modes and verification gates

Every task runs in one of three modes. If no mode is named, the agent picks by the table below and says which mode it chose before starting.

**A mode changes ceremony and timing — never whether a gate runs.** Every mode has a reviewer agent, the pre-commit hook, the smoke/visual gates where they apply, and green tests before the work is done.

## The three modes

| | `fast` | `balanced` (default) | `strict` (opt-in) |
|---|---|---|---|
| **For** | Bug fix, small UI change, translations, copy, config | Features and anything not fast or strict | Auth, security, payments, data model, migrations, risky refactors |
| **Planning** | A few sentences in chat: intent, files, done-criteria | A planning document in the project's format (below) | A planning document in the project's format, every section filled |
| **Commits** | One | One per feature slice | One per task |
| **Lint + typecheck** | Pre-commit hook (automatic) | Pre-commit hook (automatic) | Pre-commit hook (automatic) |
| **Existing tests** | Affected tests, once, before review | End of implementation + final gate | End of each task + end of implementation + final gate |
| **New tests** (active tiers only — see Paused test tiers) | Fix tests the change broke; a bug fix adds one regression test where testable | Test phase after the feature; **coverage contract**: every acceptance criterion has a test at its tier, or a recorded deferral with a destination | As balanced; `[manual]` criteria only with the owner's approval |
| **Review** | `code-reviewer`, one pass on the diff | `plan-reviewer` + `code-reviewer` on the whole change (+ `security-reviewer` when a security trigger path is touched) | `plan-reviewer` + `code-reviewer` + `security-reviewer` |
| **Smoke gate** | If runtime wiring changed | Once, when the feature is done | Once, when the feature is done |
| **Visual gate** | If UI changed | Once, when the feature is done | Once, when the feature is done |

## Choosing and changing the mode

- The owner names the mode, or the agent proposes one with a one-line reason.
- **Upgrades only.** When a `fast` task grows — more than a handful of files, a new component or route, or anything touching auth, security or the data model — the agent stops and proposes `balanced`. A `balanced` task that turns out to touch a `strict` area stops and proposes `strict`. An agent never downgrades a mode on its own.

## Planning format

The planning format is a second setting, independent of the mode. It decides only **what the planning document looks like**; everything after planning is the same in either format.

| Format | Document | Set where |
|---|---|---|
| `plan-file` (default) | `.claude/plans/<slug>/plan.md` + `worklog.md` (sections: WORKFLOW.md § 2) | — |
| `openspec` | An OpenSpec change folder (proposal, design, spec with acceptance scenarios, tasks), from the `openspec` pack | Project default in `.claude/autopilot.json` (`"planning": "openspec"`); or per task when the owner says "use openspec" |

`fast` never writes a planning document, so the format does not apply to it. In either format, the acceptance criteria (plan file) or scenarios (`spec.md`) are the coverage list for the test phase.

## The delivery sequence

The step-by-step sequence — who does what, in what order, with which artifacts and where the owner is needed — is the autopilot plugin's `workflow/WORKFLOW.md`, executed by `/deliver`. This rule sets the policy it runs under.

**Why tests come after the feature:** a test written per task pins an intermediate shape and is rewritten when the feature settles; an author who sees the finished feature writes tests for the real behaviour, once.

**Why `strict` also runs existing tests per task:** in high-risk areas a regression must be caught at the task that caused it, so the commit history stays bisectable.

## Smoke gate
Boot the runtime the change touched and confirm it starts: the dev server compiles and the touched route renders without console errors; for a backend, the app boots and its health endpoint answers.
- **Why:** it is the cheapest catch of runtime/DI/boot breaks that unit tests miss. A build compiles TypeScript but never instantiates the DI container, so **a build is not a smoke test**.
- **Precedent:** two un-bootable commits (a missing DI export, a crashing queue name) passed every spec tier and were caught only by booting.
- Reuse a dev server already listening (`node tools/autopilot/server/listening.mjs <port>`); otherwise start one with the project's `npm run start…` as a background task. Never stop or restart a server you did not start — one the owner asked for is the owner's.

## Paused test tiers
`.claude/autopilot.json` → `testing.<tier>.enabled: false` pauses a tier (`unit`, `integration`, `e2e` each have their own switch). While it is paused:
- **No new tests at that tier** — no new spec files, no new cases. The architect tags no criterion with it; a criterion that needs it is written `[deferred <tier> → handoff: <slug>-<topic>]` and goes verbatim into the hand-off (`.claude/plans/handoff/`).
- **Existing specs stay in step, fast:** the implementer that edits a file updates the tier's existing specs the change affects — assertions and cases the change makes wrong — in the same commit, with one scoped run. No test agents, no orchestration.
- **Existing specs of every tier still run** in the checkpoint and the final gate; a change that breaks one fixes it.
- Reviewers do not flag missing tests at that tier, and do flag a new spec file at it.
- Setting `enabled: true` again restores the full test phase for the tier; nothing else changes.
- **Why:** the owner can stop investing in a tier for a while without the existing suite rotting or the deferred coverage being lost.

## Visual gate
See the design-discipline rule of the UI stack pack.

## Integration-tier precedent
When a change defers integration tests to the test phase, the checkpoint and final gate re-run the **pre-existing** integration specs of every module the change touched, not only new ones.
- **Precedent:** a queue-module change silently broke 5 existing integration specs; a per-commit affected unit gate never ran them.
