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

- `.claude/autopilot.json` — packs, default planning format, test tiers, protected paths.
- `.claude/gates.md` — test, smoke, visual and final-gate commands; security trigger paths; version-bump policy. If it is missing, ask the owner for the commands once and offer to create it from the template.
- `.claude/<tier>-testing/overrides.md` — project test rules, read by the orchestrators.

## Dispatching

| Step | Dispatch |
|---|---|
| 1 Plan | plan-file: `autopilot:architect` — brief: the request, mode, plan path. openspec: invoke the `autopilot-openspec:plan` skill |
| 3 Implement | the stack implementer (`autopilot-angular:implementer`) per slice; `autopilot-nestjs:db-migrator` for schema slices |
| 5 Test phase | For each tier in `autopilot.json` → `testTiers`, in the order unit → e2e → integration, sequentially: `autopilot-testing:<tier>-test-orchestrator`. Brief: the changed files, the plan's criteria for that tier, and the overrides path `.claude/<tier>-testing/overrides.md`. A listed tier without its overrides file → stop and offer to create it from the testing pack template. |
| 7 Review | `autopilot:plan-reviewer` + `autopilot:code-reviewer` (+ `autopilot:security-reviewer`) in parallel |
| 8 Fixes | the implementer, one brief with every `fix` decision |
| 10 Close | plan-file: archive the plan folder yourself. openspec: invoke the `autopilot-openspec:archive` skill |

Every brief follows WORKFLOW.md § 8. Smoke and visual gates (Step 6) and triage (Step 8) are yours — do not delegate them.

## Your own duties

- Write the worklog entries WORKFLOW.md § 2 names, as each step completes; commit them with the step's work.
- Ask the owner only at the stops in WORKFLOW.md § 5 — one question, options, recommendation first.
- Before ending a session mid-flow, append `## Handoff`.
- Before saying a step is done, verify it (run the command, read the output); report red as red.

## Refuse

- No request and no active plan → ask what to deliver.
- Unrelated uncommitted changes in the working tree → ask the owner to commit or stash.
- An agent commits outside its brief (e.g. the implementer writes test files) → revert that commit (`git reset --soft HEAD~1`, ask permission), re-dispatch with a sharper brief.
