# Delivery workflow

The single source of **what happens after what** when a change is delivered. The `/deliver` skill executes it; agents cite it; the work-modes rule sets the policy it runs under. If this file and another doc disagree on sequence, this file wins.

Development here is AI-only. The owner decides — scope, open questions, product calls, push — and agents do everything else. Every step below says whether the owner is needed.

---

## 1. Roles

| Role | Who | Writes | Never |
|---|---|---|---|
| **Driver** | The main session running `/deliver` | Branch, commits of plan/worklog, gate records, triage decisions | Reviews its own implementation; skips a gate |
| **architect** | `autopilot:architect` (opus) | The plan | Writes application code |
| **implementer** | the stack pack's implementer (e.g. `autopilot-angular:implementer`, sonnet) | Production code, one commit per slice; fixes from review | Writes new test files; edits protected paths; reviews its own code |
| **db-migrator** | `autopilot-nestjs:db-migrator` (when the pack is enabled) | Schema + migrations (flag-protected paths) | Edits application code |
| **Test orchestrators** | `autopilot-testing:<tier>-test-orchestrator` | Specs, `test(...)` commits | Edits production code |
| **plan-reviewer** | `autopilot:plan-reviewer` (opus, read-only) | Review report | Judges code quality; patches anything |
| **code-reviewer** | `autopilot:code-reviewer` (opus, read-only) | Review report | Re-checks plan conformance; patches anything |
| **security-reviewer** | `autopilot:security-reviewer` (sonnet, read-only) | Review report | Weakens a control to make something pass |
| **Owner** | You | Answers, approvals | — |

**No self-review:** the agent that wrote code never reviews it; reviewers abort if asked to review their own output.

## 2. Artifacts

| Artifact | Path | Committed | Written by |
|---|---|---|---|
| Plan | `.claude/plans/<slug>/plan.md` | yes | architect; owner answers in § Open questions |
| Worklog | `.claude/plans/<slug>/worklog.md` | yes | driver (gates, triage, handoff), implementer (slice notes) |
| Review reports | `.claude/reviews/<date>-<slug>-<reviewer>.md` | no (run output) | reviewers |
| Gate config | `.claude/gates.md` | yes | owner / once per project |
| Project rules | `.claude/rules/project.md` | yes | owner (created once by install) |
| Backlog | `.claude/plans/backlog.md` | yes | driver/architect |
| Finished plans | `.claude/plans/archive/<YYYY-MM-DD>-<slug>/` | yes | driver at close |

With the `openspec` planning format, the plan is the OpenSpec change folder (`openspec/changes/<slug>/`: proposal, design, spec deltas, tasks) and the worklog lives in it; everything else is identical.

### Plan sections (plan-file format)

Frontmatter: `slug`, `title`, `mode`, `planning`, `status` (`draft` → `approved` → `in-progress` → `done`; `paused` to step aside), `branch`, `created`.

1. **Goal** — the outcome, in the owner's words where possible.
2. **In scope** — bullets; each one must end up with a code path.
3. **Out of scope** — every bullet ends with `→ <destination>` (a later plan, `→ backlog: <item>` in `.claude/plans/backlog.md`, or `→ not doing: <reason>`).
4. **Open questions** — `- [ ] Q: …` with options and a recommendation; answered as `- [x] Q: … → A: … (YYYY-MM-DD)`.
5. **Acceptance criteria** — `WHEN … THEN …`, each tagged with its test tier: `[unit]`, `[e2e]`, `[integration]`, or `[manual]` with a reason.
6. **UI surface** — routes and states the change touches (empty, loading, error, filled, dialog open, validation shown); where the visual gate starts looking.
7. **Tasks** — ordered checklist, sliced so each slice is one commit.
8. **Risks / notes** — optional.

### Worklog entries

Append-only, newest last, one `##` heading per entry:

- `## Slice <n> — <title> (<date>)` — commit sha, files, anything the next agent must know.
- `## Checkpoint (<date>)` — existing-test result and what was fixed.
- `## Test phase (<date>)` — tiers run, spec files, criteria covered, criteria deferred with destination.
- `### Smoke — <scope> (<date>) — GREEN|RED` and `### Visual — <route/state> round <n> (<date>) — GREEN|RED` — one line per screen × width × theme checked; findings and fixes.
- `## Review triage (<date>)` — per finding: `fix` / `decline: <reason>` / `defer → <destination>` / `owner: <question + answer>`.
- `## Decision — <topic> (<date>)` — a choice made mid-flight and why.
- `## Handoff (<date>)` — where the flow stopped, the next step, anything in progress. Written whenever a session ends mid-flow.

## 3. The sequence

Steps for `balanced`. § 4 lists what `fast` and `strict` change.

### Step 0 — Intake
- **Driver:** read the request; pick the mode (work-modes rule) and the planning format (project default from `.claude/autopilot.json`, or the owner's override). Say both in one line.
- **Pre-flight:** working tree clean (or only this change's files); no other plan `in-progress` unless the owner says to run in parallel.
- **Owner:** only to override the mode or format.

### Step 1 — Plan
- **architect** writes `.claude/plans/<slug>/plan.md` (status `draft`) from the request, the project's CLAUDE.md (index) and the project rules (`.claude/rules/project.md`), and the code.
- Every question only the owner can answer goes into **Open questions** with options and a recommendation — never guessed.
- Scope that does not fit goes into **Out of scope** with a destination. Never silently dropped.
- Driver creates the branch `<type>/<slug>` and commits the plan.

### Step 2 — Plan gate (owner)
- The driver walks the open questions **one at a time**, each with options and a recommendation, and writes every answer into the plan.
- The owner approves the plan; the driver sets `status: approved` and commits.
- **Enforced:** the `plan-ready` hook blocks source edits while the active plan is `draft` or has an unanswered open question.

### Step 3 — Implement
- Driver sets `status: in-progress` and dispatches the **implementer** slice by slice with a prescriptive brief (§ 8). Schema/migration slices go to **db-migrator** when that pack is enabled.
- The implementer commits each slice itself (`feat(<scope>): …`), ticking the plan task in the same commit. The pre-commit hook lints and type-checks staged files.
- UI slices follow the implementer's UI protocol (design skills before markup; routes and states touched reported in the hand-back).
- A slice that turns out too big is **split in the plan**, never trimmed.
- No new test files in this step.

### Step 4 — Checkpoint
- Driver runs the existing affected tests (the project's test command from `.claude/gates.md`). Failures are fixed by the implementer in the slice's scope. Worklog: `## Checkpoint`.

### Step 5 — Test phase
- On the finished feature, dispatch the tiers listed in `.claude/autopilot.json` → `testTiers`, in this order, sequentially:
  1. `autopilot-testing:unit-test-orchestrator` — new and changed code;
  2. `autopilot-testing:e2e-test-orchestrator` — mocked journeys for new and changed pages;
  3. `autopilot-testing:integration-test-orchestrator` — re-run the **pre-existing** integration specs of every module touched, too.
- Each orchestrator applies the project's `.claude/<tier>-testing/overrides.md` (toolkit, scoped commands, carve-outs).
- The plan's acceptance criteria are the coverage list. **Coverage contract:** every criterion has a test at its tagged tier, or a worklog deferral with a destination.
- Worklog: `## Test phase`.

### Step 6 — Smoke and visual gates
- **Smoke:** boot what the change touched, per the smoke map in `.claude/gates.md`. A build is not a smoke test.
- **Visual** (UI changed): per the design-discipline rule — every changed route × state, desktop and phone width, light and dark, interactions driven, console read, design-critique (+ accessibility-review for new interactive surfaces) on the screenshots.
- Red → implementer fixes in scope, re-run both gates. **Browser not connected → blocked: stop and ask the owner. Never skipped.**
- Worklog: one record per screen and round.

### Step 7 — Review
- Dispatch in parallel against `<base>..HEAD`:
  - **plan-reviewer** — always in `balanced`/`strict`;
  - **code-reviewer** — always;
  - **security-reviewer** — in `strict`, or when the diff touches a security trigger path from `.claude/gates.md`.
- Reports go to `.claude/reviews/` (not committed).

### Step 8 — Triage and fix
- The driver decides every finding (§ 7) and records it in `## Review triage`.
- Fixes go to the implementer as one brief; it commits `fix(<scope>): …`. Affected tests re-run.
- If any **BLOCKING** finding was fixed, the reviewer that raised it re-checks **only those findings** (one targeted round, not a full review).

### Step 9 — Final gate
- Lint, typecheck, affected tests, and build when `.claude/gates.md` requires it — the project's final-gate command.
- Version bump as the last commit when the project versions its app (git-safety rule).

### Step 10 — Close
- **Owner approves push/PR.** Driver pushes and opens the PR (title = conventional subject; body = goal, scope, test summary, link to the plan).
- Plan `status: done`, folder moved to `.claude/plans/archive/<date>-<slug>/`, committed. A durable, non-obvious decision gets an ADR (`docs/adr/`).
- With `openspec`: the archive step promotes the spec instead.

## 4. Mode differences

| Step | `fast` | `strict` |
|---|---|---|
| 1–2 | No plan file: the driver states intent, files and done-criteria in chat and proceeds | Every plan section filled; risks section required |
| 3 | One commit | One commit per task; existing affected tests run after each task |
| 4 | Affected tests once | Per task + end of implementation |
| 5 | Fix tests the change broke; a bug fix adds one regression test where testable | As balanced; every acceptance criterion tested (no `[manual]` without owner approval) |
| 6 | Visual gate if UI changed; smoke if wiring changed | As balanced |
| 7 | code-reviewer only, one pass on the diff | + security-reviewer always |
| 8–9 | As balanced | As balanced |
| 10 | Commit on the current branch unless the owner asks for a PR | As balanced |

A fast task that grows (more than a handful of files, a new route or component, anything touching auth/security/data model) stops and proposes `balanced`. Modes only go up.

## 5. When the driver stops for the owner

Only these:
1. Open questions at the plan gate (Step 2).
2. A scope item that fits neither In scope nor Out of scope — propose a destination and wait.
3. A mode upgrade.
4. A review finding that is a product decision (§ 7).
5. The browser is not connected for a visual gate.
6. A red gate the driver cannot fix within the change's scope.
7. Push / PR / merge.

**How to ask:** one question per message, 2–4 options, a recommendation with its reason first. Never forward a raw finding or error without a proposed answer.

## 6. Resuming

`/deliver` with no argument finds the active plan (`status` `approved` or `in-progress`), reads its tasks and worklog, and continues from the first incomplete step. Whenever a session ends mid-flow, the driver appends `## Handoff` naming the next step.

## 7. Review triage

For each finding the driver picks exactly one:

| Decision | When | Record |
|---|---|---|
| **fix** | A real defect, or a cheap improvement a rule backs | `fix` (+ commit sha after) |
| **decline** | The reviewer is wrong or the gain is not worth it | `decline: <one-line reason>` |
| **defer** | Valid but outside this change's scope | `defer → <destination>` (plan, backlog item in `.claude/plans/backlog.md`) |
| **owner** | A product or UX decision with more than one reasonable answer | the question, options, recommendation, and the owner's answer |

Bugs and rule violations are never declined. A declined BLOCKING needs a reason that cites a rule or the plan.

**Example:** *B1 double submit on save* → fix. *S2 use a Map for a 10-item list* → decline: no measurable gain. *S3 add CSV export* → defer → backlog: `orders-export`. *Q1 show archived orders by default?* → owner, options (a) hidden (b) shown (c) toggle defaulting to hidden; recommend (c).

## 8. Dispatch briefs

Every brief to a sub-agent contains:
- **Mode and step** (e.g. "balanced, Step 3, slice 2 of 4").
- **The plan path** and the task(s) in scope.
- **Files and routes** in scope; known pitfalls and an example of the expected pattern.
- **Done-criteria** and what to report back (for UI: routes and states touched, design skills used).
- **Constraints:** commit or not, no new tests (implementer), stay in scope, escalate instead of deferring.
- When a shared contract changes: update every typed consumer in the same pass.

A tight brief has been measured to run the same work about four times faster than a loose one.

## 9. Definition of done

1. Plan approved; every in-scope item has a code path; every out-of-scope item has a destination.
2. Every task ticked.
3. Tests: coverage contract met; the full affected suite green.
4. Smoke gate green; visual gate green for every UI change, recorded in the worklog.
5. Reviews done; every finding triaged and recorded; no open BLOCKING.
6. Final gate green; version bumped when the project versions its app.
7. PR opened with the owner's approval; plan archived.

## 10. Failure modes this workflow guards against

| Failure | Guard |
|---|---|
| Code written before scope is agreed | Plan gate + `plan-ready` hook |
| Scope silently dropped | Out-of-scope destinations (hook-enforced format); plan-reviewer checks every in-scope item has code |
| Agent reviews its own work | Separate reviewer agents; abort on self-review |
| Tests written against a shape that later changes | Test phase runs on the finished feature |
| Integration-only regressions surfacing late | Checkpoint + re-running pre-existing integration specs |
| App doesn't boot though tests pass | Smoke gate |
| Screen looks wrong though tests pass | Visual gate |
| Destructive or hook-skipping commands | `guard-bash` hook + settings deny list |
| Hand-edited generated rules or schema | `guard-paths` hook + flag protocol |
| Lost context between sessions | Worklog + handoff entries + session-context hook |
| Review noise stalling the change | Severity conventions + driver triage; owner sees only product questions |

## 11. Other skills inside the loop

Use them where they fit; they never replace a step:
- `superpowers:systematic-debugging` — any red gate or failing test, before proposing a fix.
- `superpowers:verification-before-completion` — before claiming a step, fix or PR is done.
- `superpowers:brainstorming` — at the plan gate when requirements are unclear; answers go into the plan.
- `superpowers:receiving-code-review` — while triaging findings.
- `superpowers:dispatching-parallel-agents` — genuinely independent investigation only.

`writing-plans` / `executing-plans` / `subagent-driven-development` do not replace Steps 1–3; `test-driven-development` does not replace the test phase.
