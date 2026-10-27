# Delivery workflow

The single source of **what happens after what** when a change is delivered. The `/deliver` skill executes it; agents cite it; the work-modes rule sets the policy it runs under. If this file and another doc disagree on sequence, this file wins.

Development here is AI-only. The owner decides — scope, open questions, product calls, merge — and agents do everything else. Every step below says whether the owner is needed.

---

## 1. Roles

| Role | Who | Writes | Never |
|---|---|---|---|
| **Driver** | The main session running `/deliver` | Branch, commits of plan/worklog and of the test phase's specs, gate records, triage decisions, hand-offs, the process report | Reviews its own implementation; skips a gate; commits while a parallel agent is still running |
| **architect** | `autopilot:architect` (opus) | The plan | Writes application code |
| **implementer** | the stack pack's implementer (e.g. `autopilot-angular:implementer`, sonnet) | Production code, one commit per slice; fixes from review | Writes new test files; edits protected paths; reviews its own code |
| **db-migrator** | `autopilot-nestjs:db-migrator` (when the pack is enabled) | Schema + migrations (flag-protected paths) | Edits application code |
| **Test orchestrators / authors** | `autopilot-testing:<tier>-test-orchestrator`, or the tier's `-test-author` agents directly in the `single-review` phase | Specs and shared test helpers | Edits production code; runs `git add` or commits (the driver commits) |
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
| Hand-off | `.claude/plans/handoff/<slug>-<topic>.md` (template: the core plugin's `templates/plans/handoff.md`) | yes | driver, whenever criteria are deferred (a paused tier, a gate deferral); stays after the plan is archived |
| Run output | `.claude/tmp/` — gate output, screenshots, logs (git-ignored) | no | any agent; emptied by the Close-step cleanup |
| Finished plans | `.claude/plans/archive/<YYYY-MM-DD>-<slug>/` | yes | driver at close |

With the `openspec` planning format, the plan is the OpenSpec change folder (`openspec/changes/<slug>/`: proposal, design, spec deltas, tasks) and the worklog lives in it; everything else is identical.

### Plan sections (plan-file format)

Frontmatter: `slug`, `title`, `mode`, `planning`, `status` (`draft` → `approved` → `in-progress` → `done`; `paused` to step aside), `branch`, `created`.

1. **Goal** — the outcome, in the owner's words where possible.
2. **In scope** — bullets; each one must end up with a code path.
3. **Out of scope** — every bullet ends with `→ <destination>` (a later plan, `→ backlog: <item>` in `.claude/plans/backlog.md`, or `→ not doing: <reason>`).
4. **Open questions** — `- [ ] Q: …` with options and a recommendation; answered as `- [x] Q: … → A: … (YYYY-MM-DD)`.
5. **Acceptance criteria** — `WHEN … THEN …`, each tagged with an active test tier: `[unit]`, `[e2e]`, `[integration]`, or `[manual]` with a reason. A criterion that needs a **paused** tier (§ 3 Step 5) is tagged `[deferred <tier> → handoff: <slug>-<topic>]` and goes verbatim into that hand-off.
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
- `## Decision — <topic> (<date>)` — a choice made mid-flight and why: housekeeping and anything a rule or the plan already settles is decided by the driver and recorded here, not asked.
- `## Handoff (<date>)` — where the flow stopped, the next step, anything in progress. Written whenever a session ends mid-flow.
- `## Processes (<date>)` — at Close (and in every Handoff): each process the driver or an agent started (command, by whom), whether it was stopped, and what is still running and why (§ 12).
- `## Cleanup (<date>)` — what was written outside the repo, sizes, what the owner chose to delete or keep.

## 3. The sequence

Steps for `balanced`. § 4 lists what `fast` and `strict` change.

### Step 0 — Intake
- **Driver:** read the request; pick the mode (work-modes rule) and the planning format (project default from `.claude/autopilot.json`, or the owner's override). Say both in one line.
- **Pre-flight:** working tree clean (or only this change's files); no other plan `in-progress` unless the owner says to run in parallel.
- **Owner:** only to override the mode or format.

### Step 1 — Plan
- **architect** writes `.claude/plans/<slug>/plan.md` (status `draft`) from the request, the project's CLAUDE.md (index), the project rules (`.claude/rules/project.md`), the project docs it needs (`docs/FEATURES.md`, `docs/ARCHITECTURE.md`, `docs/DOMAIN.md`), and the code.
- Every question only the owner can answer goes into **Open questions** with options and a recommendation — never guessed.
- Scope that does not fit goes into **Out of scope** with a destination. Never silently dropped.
- Driver creates the branch `<type>/<slug>` and commits the plan.

### Step 2 — Plan gate (owner)
- The driver puts the open questions to the owner **in batches of up to 4 in one question set** (each with options and a recommendation first), and writes every answer into the plan.
- The owner approves the plan; the driver sets `status: approved` and commits.
- **Enforced:** the `plan-ready` hook blocks source edits while the active plan is `draft` or has an unanswered open question.

### Step 3 — Implement
- Driver sets `status: in-progress` and dispatches the **implementer** slice by slice with a prescriptive brief (§ 8). Schema/migration slices go to **db-migrator** when that pack is enabled.
- The implementer commits each slice itself (`feat(<scope>): …`), ticking the plan task in the same commit. The pre-commit hook lints and type-checks staged files.
- UI slices follow the implementer's UI protocol (design skills before markup; routes and states touched reported in the hand-back).
- A slice that turns out too big is **split in the plan**, never trimmed.
- No new test files in this step.
- **Paused tiers** (`.claude/autopilot.json` → `testing.<tier>.enabled: false`): the implementer keeps the **existing** specs of that tier in step with the files it edits — it updates the assertions and cases the change makes wrong, and removes cases for behaviour the change removes — in the same slice commit, with one scoped run of those specs. No new spec files, no new cases; no test agent or orchestrator is dispatched for it. New behaviour at that tier goes to the hand-off.
- Before each commit the implementer runs `git status` and unstages anything that is not its own (`git restore --staged <path>`).

### Step 4 — Checkpoint
- Driver runs the existing affected tests (the project's test command from `.claude/gates.md`) — **of every tier, paused ones included**. Failures are fixed by the implementer in the slice's scope. Worklog: `## Checkpoint`.

### Step 5 — Test phase
- On the finished feature, run the **active** tiers — those in `.claude/autopilot.json` → `testTiers` whose `testing.<tier>.enabled` is not `false` — in this order:
  1. unit — new and changed code;
  2. e2e — mocked journeys for new and changed pages;
  3. integration — re-run the **pre-existing** integration specs of every module touched, too.
- **Paused tiers** get no authors and no orchestrator: their affected existing specs were already updated by the implementer (Step 3), and every criterion that needs them is `[deferred <tier> → handoff: …]` in the hand-off (below). Re-enabling a tier (`enabled: true`) restores this step unchanged; nothing else needs configuring.
- The shape per tier follows `testing.phase`:
  - **`orchestrated`** (default) — dispatch `autopilot-testing:<tier>-test-orchestrator`; it runs author → reviewer → fix per subject, sequentially.
  - **`single-review`** — (1) one author builds the **shared test helpers** the specs will need first (service pins, builders, DOM/form readers) in the testing toolkit; (2) up to `limits.parallelTestAgents` (default 3) `<tier>-test-author` agents in parallel, the work split by area, each writing only its own spec files and never the toolkit (a missing helper is reported, not inlined); (3) **one** review pass — `<tier>-test-reviewer` agents over the new specs, read-only; (4) **one** fix pass — a single author applies the findings that stand and makes the specs green. Then the tier is done: no author ↔ reviewer loops.
- **One heavy test runner at a time** across all agents. Heavy = it boots a browser or the app (Karma, Cypress, Playwright, an Angular builder test target). In `single-review` with a heavy runner, the parallel authors only type-check and lint their specs; the driver runs the scoped specs once after they stop and hands the failures to the fix pass. Light runners (Vitest, Jest) may run per author.
- Each tier applies the project's `.claude/<tier>-testing/overrides.md` (toolkit, scoped commands, carve-outs). Tests and visual checks run **inside the project**, against its own config and the running dev server — never in scratch runner configs, extra ports, temp builds or copies of the repo.
- Test agents never `git add` or commit. The driver commits the tier's specs (`test(<scope>): …`) once every agent of that tier has stopped.
- The plan's acceptance criteria are the coverage list. **Coverage contract:** every criterion has a test at its tagged tier, or a deferral with a destination recorded in the worklog — and, for every deferred criterion, in the hand-off.
- **Hand-off:** when any criterion or gate check is deferred, the driver writes `.claude/plans/handoff/<slug>-<topic>.md` from the template — every deferred criterion verbatim with its reason, the gate deferrals, test data created on shared environments, starting points (routes, test-id prefixes, accounts file, flags), and what not to redo.
- Worklog: `## Test phase` — tiers run, tiers paused, spec files, criteria covered, criteria deferred with destination.

### Step 6 — Smoke and visual gates
- **Smoke:** boot what the change touched, per the smoke map in `.claude/gates.md`. A build is not a smoke test.
- **Visual** (UI changed): per the design-discipline rule — every changed route × state, desktop and phone width, light and dark, interactions driven, console read, design-critique (+ accessibility-review for new interactive surfaces) on the screenshots. **Loading skeletons are compared side by side with the loaded state** at the same width.
- **Dev server:** reuse one already listening (`node tools/autopilot/server/listening.mjs <port>`); a server the owner started is the owner's — never stopped or restarted unless the owner says so. Otherwise start it with `npm run start…` as a background task and record it for the process report.
- **Browser:** the project's Playwright browser — MCP server `playwright` (`browser_*` tools), headless Chrome started by `tools/autopilot/browser/mcp.mjs`, the same locally and in a cloud session.
- **Sign-in is the agent's job — never ask the owner to sign in.** A page that needs a login: sign in through the app's own login form with a dev/test account from the local accounts file `.claude/gates.md` names (git-ignored; its values never go into code, docs, commits, logs or reports), then save the session so later runs start signed in: `browser_run_code_unsafe` → `await page.context().storageState({ path: '.claude/browser/storage-state.json' })`. The browser loads that file at start; when the saved session has expired, sign in again the same way.
- **Never ask the owner for what a tool can do.** Phone width: `browser_resize` to 375×812. Theme: `browser_emulate_media` (`colorScheme`), or the app's own theme switch when it themes by a class. Console: `browser_console_messages`. Loading state: hold the page's request pending with `browser_run_code_unsafe` → `await page.route('<api pattern>', () => {})` (never fulfilled), navigate inside the app, capture, then `await page.unrouteAll()`.
- Screenshots and gate output go to `.claude/tmp/`: `browser_take_screenshot` without a `filename` saves to `.claude/tmp/browser/`; a `filename` is relative to the project root, so name one only as `.claude/tmp/browser/<name>.png`.
- Red → implementer fixes in scope, re-run both gates. **The browser does not start, or no account can sign in (no accounts file, login refused) → blocked: stop and ask the owner. Never skipped.**
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
- Lint, typecheck, affected tests of **every** tier (paused ones included — a change that breaks an existing spec fixes it), and build when `.claude/gates.md` requires it — the project's final-gate command. Builds go to the project's normal output folder, never to a temp folder.
- Version bump as the last commit when the project versions its app (git-safety rule).

### Step 10 — Close
- **Driver pushes and opens the PR** without asking (title = conventional subject; body = goal, scope, test summary, link to the plan); later PR edits and comments need no stop either. **The owner approves the merge** — agents never merge and never push to a trunk (git-safety rule).
- Plan `status: done`, folder moved to `.claude/plans/archive/<date>-<slug>/`, committed. A durable, non-obvious decision gets an ADR (`docs/adr/`). Hand-offs stay in `.claude/plans/handoff/`.
- With `openspec`: the archive step promotes the spec instead.
- **Process report** (`## Processes`): what the driver and its agents started, what was stopped, what is still running and why (§ 12). Stop what the delivery started and no longer needs; a server the owner asked for stays.
- **Cleanup** (`## Cleanup`): list every file and folder the driver or its agents wrote outside the repo during the delivery, plus `.claude/tmp/`, with sizes — `/autopilot:cleanup` does it — and offer to delete them with one confirmation.
- **Long delivery** (several slices, a fix round, or a session that has run for hours): end with `## Handoff` and recommend continuing in a fresh session — it releases the MCP servers and background processes the session holds.

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
5. The visual gate's browser does not start, or no account can sign in (no accounts file, login refused).
6. A red gate the driver cannot fix within the change's scope.
7. Merge. Pushing a feature branch and opening, editing or commenting on its PR are not stops.

Everything else the driver decides: housekeeping, choices a rule or the plan already settles, and anything a tool can find out or do (is the server up, how the page looks at 375 px, which test command to run). It records the choice as `## Decision` in the worklog and goes on.

**How to ask:** gather what is pending into **one question set of up to 4 questions**, each with 2–4 options and a recommendation with its reason first. Never forward a raw finding or error without a proposed answer, and never ask the owner to do something a tool can do.

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
- **The tool-discipline block, verbatim** (agent-conduct rule, "Tool discipline"): edits only through Edit/Write, reads through Read/Grep/Glob; shell only as single allowlisted commands; no python, `sed -i` or heredoc edit scripts, no `cd … &&` chains, no temporary or scratch config files, no shell launchers (`powershell`, `cmd start`), no process kills; a check that needs an unlisted command is skipped and reported.
- **Parallel agents:** "Do not `git add` or commit; do not touch files outside your list." The driver commits only after every parallel agent has stopped.
- **Processes:** start long-running processes only as background tasks, stop only your own, and list both in the hand-back.

A tight brief has been measured to run the same work about four times faster than a loose one.

## 9. Definition of done

1. Plan approved; every in-scope item has a code path; every out-of-scope item has a destination.
2. Every task ticked.
3. Tests: coverage contract met; the full affected suite green.
4. Smoke gate green; visual gate green for every UI change, recorded in the worklog.
5. Reviews done; every finding triaged and recorded; no open BLOCKING.
6. Final gate green; version bumped when the project versions its app.
7. PR opened with the owner's approval; plan archived; every deferred criterion in a hand-off.
8. Process report and cleanup recorded in the worklog.

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
| Machine slows down over a long session | Parallel-agent cap, one heavy runner at a time, agents stop only what they started, process report at Close, fresh session after a long delivery |
| Files left all over the disk | `Edit(./**)`/`Write(./**)` permissions, run output in `.claude/tmp/`, Close-step cleanup |
| A commit sweeps in another agent's files | Parallel agents never stage or commit; driver commits after they stop; implementer unstages what is not its own |
| Deferred work forgotten | Hand-off file, checked against the worklog by the plan-reviewer |
| Permission prompts stall an unattended run | Tool-discipline block in every brief; read-only shell allowed; `guard-bash` refuses edit scripts, launchers and kill-by-name |

## 11. Other skills inside the loop

Use them where they fit; they never replace a step:
- `superpowers:systematic-debugging` — any red gate or failing test, before proposing a fix.
- `superpowers:verification-before-completion` — before claiming a step, fix or PR is done.
- `superpowers:brainstorming` — at the plan gate when requirements are unclear; answers go into the plan.
- `superpowers:receiving-code-review` — while triaging findings.
- `superpowers:dispatching-parallel-agents` — genuinely independent investigation only.

`writing-plans` / `executing-plans` / `subagent-driven-development` do not replace Steps 1–3; `test-driven-development` does not replace the test phase.

## 12. Processes and workspace

A delivery runs for hours on the owner's machine. It leaves the machine as it found it.

**Processes**
- At most `limits.parallelTestAgents` (`.claude/autopilot.json`, default 3) test agents run at once, and at most **one heavy test runner** (one that boots a browser or the app) runs at any moment across all agents.
- Long-running processes (dev server, watch build, test runner in watch mode) start only as **background tasks**, and dev servers only through `npm run start…` (the project's scripts). No detached OS windows: on Windows, Git Bash mangles `cmd //c start … /k`. A server that must outlive the session gets a cross-platform launcher script in the project, documented in `.claude/gates.md`.
- **Reuse before starting:** `node tools/autopilot/server/listening.mjs <port>` says whether a server already answers. A server the owner asked for or started is the owner's: never stopped or restarted unless the owner says so.
- Every agent stops **only the processes it started**, through the background task that runs them — never by killing processes by name — and lists started / stopped / still running in its hand-back. The driver merges these into the `## Processes` worklog entry at Close.
- MCP servers: an agent that does not use one declares a `tools:` allowlist without `mcp__` entries, as every autopilot agent does, so it gets no MCP tools. Whether Claude Code then skips starting the server for that agent is not documented; ending a long delivery with a handoff and a fresh session is what reliably releases them.

**Workspace**
- Agents write only inside the project (the settings allow `Edit(./**)` and `Write(./**)`, not bare `Edit` / `Write`).
- Gate output, screenshots, logs and dumps go to `.claude/tmp/` (git-ignored). Builds go to the project's normal output folder, never to temp.
- No copies of the repo, spike folders or reference checkouts outside it unless the owner asks; anything that does get written outside is listed in the Close-step cleanup.
- No scratch runner configs (a copied `karma.conf` / `playwright.config` with its own port), temp builds or extra folders to isolate parallel runs: the cap and the one-heavy-runner rule make them unnecessary.
- Gate commands are `npm run …` scripts (a `bash tools/x.sh` gate is wrapped in a `package.json` script), so they are allowlisted and run the same for every agent.
