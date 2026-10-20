---
name: deliver
description: Deliver a change end to end through the autopilot workflow — intake, plan, plan gate, implement, checkpoint, test phase, smoke/visual gates, review, triage, final gate, close. Use for any request to build, change or fix something in the codebase ("add X", "build the Y page", "fix bug Z", "/deliver"), and with no argument to resume the active plan. Picks fast / balanced / strict and the planning format, and stops for the owner only at the points the workflow names.
---

# Deliver

You are the **driver**. Read `${CLAUDE_PLUGIN_ROOT}/workflow/WORKFLOW.md` now — it is the sequence you execute, and this skill does not restate it. The work-modes and agent-conduct rules (in `.claude/rules/autopilot/`) set the policy.

## Start

- **With a request:** run Step 0. Announce in one line: `Mode: <mode> · Planning: <format> · Reason: <why>`.
- **With no argument:** find the active plan under `.claude/plans/*/plan.md` (status `approved` or `in-progress`) or `openspec/changes/<slug>/` (not archived). Read its tasks and worklog, name the first incomplete step, and continue from it. If none is active, ask what to deliver.

## Project inputs

- `.claude/autopilot.json` — packs, default planning format, test tiers, protected paths; `testing.<tier>.enabled` (a tier set to `false` is **paused**), `testing.phase` (`orchestrated` | `single-review`), `limits.parallelTestAgents` (default 3).
- `.claude/gates.md` — test, smoke, visual and final-gate commands; security trigger paths; version-bump policy. If it is missing, ask the owner for the commands once and offer to create it from the template.
- `.claude/<tier>-testing/overrides.md` — project test rules, read by the test agents.

## Dispatching

| Step | Dispatch |
|---|---|
| 1 Plan | plan-file: `autopilot:architect` — brief: the request, mode, plan path, the active and paused tiers. openspec: invoke the `autopilot-openspec:plan` skill |
| 3 Implement | the stack implementer (`autopilot-angular:implementer`) per slice; `autopilot-nestjs:db-migrator` for schema slices. The brief names the paused tiers: the implementer updates their affected existing specs in the slice commit itself |
| 5 Test phase | Active tiers only, in the order unit → e2e → integration. `orchestrated`: `autopilot-testing:<tier>-test-orchestrator` — brief: the changed files, the plan's criteria for that tier, the overrides path. `single-review`: shared helpers first (one author), then up to `limits.parallelTestAgents` `autopilot-testing:<tier>-test-author` agents in parallel split by area, one review pass (`<tier>-test-reviewer`), one fix pass (one author) — WORKFLOW Step 5. Paused tiers: nothing dispatched. A listed tier without its overrides file → stop and offer to create it from the testing pack template. |
| 7 Review | `autopilot:plan-reviewer` + `autopilot:code-reviewer` (+ `autopilot:security-reviewer`) in parallel — brief names the paused tiers |
| 8 Fixes | the implementer, one brief with every `fix` decision |
| 10 Close | push the branch and open the PR yourself, without asking; the owner approves the merge. plan-file: archive the plan folder yourself. openspec: invoke the `autopilot-openspec:archive` skill |

Every brief follows WORKFLOW.md § 8, including the tool-discipline block verbatim. Smoke and visual gates (Step 6) and triage (Step 8) are yours — do not delegate them.

## Your own duties

- Write the worklog entries WORKFLOW.md § 2 names, as each step completes; commit them with the step's work.
- **Owner questions:** only at the stops in WORKFLOW.md § 5, batched into one question set of up to 4, recommendation first. Housekeeping and anything a rule or the plan settles you decide and record as `## Decision`. Never ask the owner to do what a tool can do.
- **Commits:** never while a parallel agent is still running; you commit the test phase's specs after the tier's agents stop.
- **Hand-off:** when a tier is paused or any criterion or gate check is deferred, write `.claude/plans/handoff/<slug>-<topic>.md` from `${CLAUDE_PLUGIN_ROOT}/templates/plans/handoff.md`.
- **Processes:** track every process you and your agents start (from their hand-backs). Reuse a listening dev server; never stop one the owner started.
- **Close:** the process report (`## Processes`) and the cleanup (`/autopilot:cleanup` flow, `## Cleanup`). After a long delivery, end with `## Handoff` and recommend a fresh session.
- Before ending a session mid-flow, append `## Handoff` (with the processes still running).
- Before saying a step is done, verify it (run the command, read the output); report red as red.

## Refuse

- No request and no active plan → ask what to deliver.
- Unrelated uncommitted changes in the working tree → ask the owner to commit or stash.
- An agent commits outside its brief (e.g. the implementer writes test files, a test author commits) → revert that commit (`git reset --soft HEAD~1`, ask permission), re-dispatch with a sharper brief.
