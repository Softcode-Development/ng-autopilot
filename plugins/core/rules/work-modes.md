# Work modes and verification gates

Every task runs in one of three modes. If no mode is named, the agent picks by the table below and says which mode it chose before starting.

**A mode changes ceremony and timing — never whether a gate runs.** Every mode has a reviewer agent, the pre-commit hook, the smoke/visual gates where they apply, and green tests before the work is done.

## The three modes

| | `fast` | `balanced` (default) | `strict` (opt-in) |
|---|---|---|---|
| **For** | Bug fix, small UI change, translations, copy, config | Features and anything not fast or strict | Auth, security, payments, data model, migrations, risky refactors |
| **Planning** | A few sentences in chat: intent, files, done-criteria | Plan file with acceptance criteria (`.claude/plans/<slug>.md`) | OpenSpec change when the `openspec` pack is enabled; otherwise the plan file with every section filled |
| **Commits** | One | One per feature slice | One per task |
| **Lint + typecheck** | Pre-commit hook (automatic) | Pre-commit hook (automatic) | Pre-commit hook (automatic) |
| **Existing tests** | Affected tests, once, before review | End of implementation + final gate | End of each task + end of implementation + final gate |
| **New tests** | Fix tests the change broke; a bug fix adds one regression test where testable | Test phase after the feature (below) | Test phase after the feature; every acceptance criterion has a test |
| **Review** | Reviewer agent, one pass on the diff | Reviewer agent on the whole change | Reviewer agent + security reviewer |
| **Smoke gate** | If runtime wiring changed | Once, when the feature is done | Once, when the feature is done |
| **Visual gate** | If UI changed | Once, when the feature is done | Once, when the feature is done |

## Choosing and changing the mode

- The owner names the mode, or the agent proposes one with a one-line reason.
- **Upgrades only.** When a `fast` task grows — more than a handful of files, a new component or route, or anything touching auth, security or the data model — the agent stops and proposes `balanced`. A `balanced` task that turns out to touch a `strict` area stops and proposes `strict`. An agent never downgrades a mode on its own.

## The delivery sequence (`balanced` and `strict`)

1. **Plan** — goal, scope, out of scope with destinations, acceptance criteria, task checklist.
2. **Implement** the whole feature in slices, committing each slice. No new tests yet. The pre-commit hook lints and type-checks staged files on every commit.
3. **Checkpoint** — run the existing affected test suite; fix what the feature broke.
4. **Test phase** — on the finished feature, never per task:
   1. unit tests for new and changed code, through the unit-test orchestrator;
   2. mocked e2e tests for new and changed pages, through the e2e orchestrator (when the project has an e2e suite);
   3. integration tests where the project has that tier.

   The plan's acceptance criteria are the coverage list.
5. **Smoke + visual gates** on the finished feature.
6. **Review** — a separate reviewer agent on the whole change; fix in scope.
7. **Final gate** — lint, typecheck, full affected tests, build when the project requires it. Bump the version if the project versions its app. Open the PR.

**Why tests come after the feature:** a test written per task pins an intermediate shape and is rewritten when the feature settles; an author who sees the finished feature writes tests for the real behaviour, once.

**Why `strict` also runs existing tests per task:** in high-risk areas a regression must be caught at the task that caused it, so the commit history stays bisectable.

## Smoke gate
Boot the runtime the change touched and confirm it starts: the dev server compiles and the touched route renders without console errors; for a backend, the app boots and its health endpoint answers.
- **Why:** it is the cheapest catch of runtime/DI/boot breaks that unit tests miss. A build compiles TypeScript but never instantiates the DI container, so **a build is not a smoke test**.
- **Precedent:** two un-bootable commits (a missing DI export, a crashing queue name) passed every spec tier and were caught only by booting.
- Use the dev server that is already running, or boot on an alternate port; never kill a server you did not start.

## Visual gate
See the design-discipline rule of the UI stack pack.

## Integration-tier precedent
When a change defers integration tests to the test phase, the checkpoint and final gate re-run the **pre-existing** integration specs of every module the change touched, not only new ones.
- **Precedent:** a queue-module change silently broke 5 existing integration specs; a per-commit affected unit gate never ran them.
