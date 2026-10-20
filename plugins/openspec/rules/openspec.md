---
paths:
  - "openspec/**"
---

# OpenSpec

Applies when the project's planning format is `openspec` (or a task opted into it). The sequence is the autopilot workflow; this rule covers what differs.

## Where things live
- A change: `openspec/changes/<slug>/` — `proposal.md`, `design.md`, `specs/<capability>/spec.md`, `tasks.md`, `worklog.md`.
- Promoted truth: `openspec/specs/<capability>/spec.md`, edited only by the archive flow. — **Enforcement:** `guard-paths` + `guard-bash` via the `protectedPaths` entry (flag `openspec-archive`).
- Open questions: `design.md` → `## Open questions`, as `- [ ] Q:` / `- [x] Q: … → A: … (date)`. — **Enforcement:** `plan-ready` hook.
- Out of scope: `proposal.md` → `## Out of scope`, every bullet `→ <destination>`. — **Enforcement:** `out-of-scope` hook (sync adds `openspec/changes/*/proposal.md` to `outOfScopeDocs`).

## Scenarios drive coverage, not test names
Every scenario in the change's spec deltas has a matching test at its tier — the coverage contract — or a worklog deferral with a destination (for a paused tier: the hand-off in `.claude/plans/handoff/`, work-modes rule). The WHEN/THEN text is a template, not a mandate: test authors name tests by their own conventions; the plan-reviewer matches scenario ↔ test by behaviour.

## Scenario numbers stay inside the spec
Scenario ids (`AS-N`, `1.2`, …) are transient: they reset or merge when a change archives. Never put them in production code, tests, scripts, top-level docs, ADRs or configs — reference the behaviour text instead. Allowed only inside `openspec/changes/**` and `openspec/specs/**`.
- **Why:** an id embedded outside the spec becomes a stale reference the next time the capability changes.

## Commits
Commits that touch application code carry a body line `Change: <slug>` and tick the `tasks.md` row in the same commit. — **Enforcement:** the pack's commit-msg and pre-commit git hooks (tooling).
- A sanctioned owner bypass for a trivial commit with no active change exists only as an env var plus a matching `Skip-Tasks-Gate: <reason>` trailer, owner-invoked, never agent-selected.
