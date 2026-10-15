# testing pack

Test orchestration for the golden workflow's test phase (WORKFLOW Step 5) and for direct use (`/write-unit-tests`, `/write-integration-tests`, `/write-e2e-tests`).

| Piece | Role |
|---|---|
| `agents/<tier>-test-orchestrator` | Detects stack/runner, builds the queue, dispatches author → reviewer per subject, tracks the backlog |
| `agents/<tier>-test-author` / `-reviewer` | Write / review one spec against the tier references + project overrides |
| `skills/write-<tier>-tests` | User entry points; dispatch the orchestrator |
| `skills/write-<tier>-tests/references/` | The tier rules (core, coverage floors, reporting contract, runner and stack files) |
| `skills/detect-stack` | Runner / stack / e2e-framework detection |
| `templates/<tier>-testing/overrides.md` | Project overrides template |

## How a project connects

1. `.claude/golden.json` lists the tiers the project has: `"testTiers": ["unit", "e2e"]`.
2. Sync writes `.claude/<tier>-testing/overrides.md` from the template for each listed tier (never overwriting an existing one); the project fills the placeholders.
3. The architect tags acceptance criteria only with listed tiers; `/deliver` Step 5 dispatches only those orchestrators, passing the overrides path.
4. The orchestrators read the overrides file on every run; authors and reviewers receive its path in their brief.
5. The drift check reports a listed tier with no overrides file, or one with unfilled `<placeholders>`.

Overrides only **add** rules to the references. The one exception is a **carve-out**: an entry that names the core rule it relaxes, why, and its scope — for example a project that keeps inline `jasmine.createSpyObj` mocks because it has no mock toolkit.

Commands: the overrides file holds the **scoped** (one spec / one folder) commands the authors run; `.claude/gates.md` holds the **suite** command the driver runs at the checkpoint and final gate.
