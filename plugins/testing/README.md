# testing pack

Test orchestration for the autopilot workflow's test phase (WORKFLOW Step 5) and for direct use (`/write-unit-tests`, `/write-integration-tests`, `/write-e2e-tests`).

| Piece | Role |
|---|---|
| `agents/<tier>-test-orchestrator` | Detects stack/runner, builds the queue, dispatches author → reviewer per subject, tracks the backlog |
| `agents/<tier>-test-author` / `-reviewer` | Write / review one spec against the tier references + project overrides |
| `skills/write-<tier>-tests` | User entry points; dispatch the orchestrator |
| `skills/write-<tier>-tests/references/` | The tier rules (core, coverage floors, reporting contract, runner and stack files) |
| `skills/detect-stack` | Runner / stack / e2e-framework detection |
| `templates/<tier>-testing/overrides.md` | Project overrides template |
| `templates/<tier>-testing/backlog.md` | Backlog template — same shape as the stub an orchestrator creates when the file is missing (`# <Tier> Testing Backlog` + `## Untracked`), plus the link to the overrides |

## How a project connects

1. `.claude/autopilot.json` lists the tiers the project has: `"testTiers": ["unit", "e2e"]`.
2. Sync writes `.claude/<tier>-testing/overrides.md` and `backlog.md` from the templates for each listed tier (never overwriting existing ones); the project fills the overrides placeholders. The backlog is the orchestrator's: it adds and ticks rows, and `/write-<tier>-tests` with no argument continues from the top unchecked row.
3. The architect tags acceptance criteria only with listed, active tiers; `/deliver` Step 5 runs only those tiers, passing the overrides path.
4. The orchestrators read the overrides file on every run; authors and reviewers receive its path in their brief.
5. The drift check reports a listed tier with no overrides file, or one with unfilled `<placeholders>`.

## Switches in `.claude/autopilot.json`

| Key | Default | Effect |
|---|---|---|
| `testing.<tier>.enabled` | `true` | `false` **pauses** the tier: no new specs or cases at it (criteria that need it go to a hand-off in `.claude/plans/handoff/`), no authors or orchestrator in `/deliver`; the implementer keeps the tier's existing specs in step with the files it edits, in the same commit; its existing specs still run in the checkpoint and final gate. `true` again restores everything, nothing else to change. Overrides and backlog stay synced while paused. |
| `testing.phase` | `orchestrated` | `orchestrated`: per tier, the orchestrator runs author → reviewer → fix per subject, sequentially. `single-review`: shared helpers first, then up to `limits.parallelTestAgents` authors in parallel (split by area), **one** review pass, **one** fix pass (WORKFLOW Step 5). |
| `limits.parallelTestAgents` | `3` | Most test agents running at once. Separately, at most one heavy runner (browser or app boot) runs at any moment. |

Test agents never `git add` or commit — the driver commits the specs after they stop.

Overrides only **add** rules to the references. The one exception is a **carve-out**: an entry that names the core rule it relaxes, why, and its scope — for example a project that keeps inline `jasmine.createSpyObj` mocks because it has no mock toolkit.

Commands: the overrides file holds the **scoped** (one spec / one folder) commands the authors run; `.claude/gates.md` holds the **suite** command the driver runs at the checkpoint and final gate.
