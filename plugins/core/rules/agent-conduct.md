# Agent conduct

How every agent in this workspace behaves, regardless of stack.

## No freestyle code
Every non-trivial change starts from an agreed plan or spec, and stays inside its scope. No "while I'm here" fixes: a smell outside the scope is reported (see below), not fixed.
- **Why:** unplanned edits widen the diff, dodge review focus and break bisecting.
- **Enforcement:** review.

## No self-review
The agent that wrote the code never reviews it. Review is a separate agent with a fresh context.
- **Why:** an author re-reads its own intent, not the code; a fresh context catches what the author rationalised.
- **Enforcement:** workflow (the deliver loop dispatches a separate reviewer).

## No silent deferral
Anything dropped from scope is written down with a destination: a later plan step, a backlog entry, or an explicit "not doing, because …". An item that fits neither the scope nor a destination means **stop, tell the owner, write it down**, then continue.
- **Why:** silently skipped work is lost work; nobody knows it was ever needed.
- **Enforcement:** review; a validator where the plan format allows it.

## Surface bad places
End every task with one line per smell you saw but did not fix (file:line + what), so the owner can prioritise.

## Prescriptive briefs
When dispatching a sub-agent, the brief carries explicit behaviours, example patterns, known pitfalls, the files in scope and the done-criteria. When the agent edits a shared contract, the brief requires updating every typed consumer in the same pass.
- **Why:** measured on a real change, a tight brief ran the same work ~4× faster than a loose one and avoided lint/contract rework.

## Tool discipline
Every dispatch brief quotes this block, and every agent follows it without one:
- Edits only through Edit/Write; reads through Read/Grep/Glob.
- Shell only as single allowlisted commands (the project's `npm run …` scripts, read-only `git`, `ls`/`cat`/`head`/`tail`/`grep`/`wc`/`date`, `node tools/…`).
- No python, `sed -i` or heredoc edit scripts; no `cd … &&` chains; no temporary or scratch config files (no copied runner config with its own port); no shell launchers (`powershell`, `cmd start`); no process kills.
- A check that needs a command outside this list is **skipped and reported** in the hand-back — never worked around.
- **Why:** each off-list command stops an unattended run on a permission prompt, and edit scripts and launchers bypass the hooks that guard the repo.
- **Enforcement:** settings allowlist; `guard-bash` refuses `sed -i`/`perl -i`, shell launchers, kill-by-name and `rm` paths that climb out with `..`.

## Stay inside the project
Write only inside the repo. Run output (gate output, screenshots, logs, dumps) goes to `.claude/tmp/` (git-ignored); builds go to the project's normal output folder, never to temp; no copies of the repo, spikes or reference checkouts elsewhere unless the owner asks. Anything you did write outside the repo is listed in your hand-back with its path.
- **Why:** files outside the repo are invisible to git and to the owner and pile up on the disk.
- **Enforcement:** settings allow `Edit(./**)` / `Write(./**)` only; the Close-step cleanup lists what got out.

## Processes
Start long-running processes (dev server, watch build) only as background tasks, and dev servers only with the project's `npm run start…`. Before starting one, check whether one already answers (`node tools/autopilot/server/listening.mjs <port>`) and reuse it. Stop only what you started, through its background task; a server the owner started or asked for is the owner's. Respect `limits.parallelTestAgents` and run at most one heavy test runner (browser or app boot) at a time. The hand-back lists every process you started, stopped, or left running and why.
- **Why:** long sessions piled up dev servers, hung test runners and headless browsers until the machine slowed down; killing by name took down the owner's own servers.

## Commits with parallel agents
An agent running in parallel with others never runs `git add` or commits — the driver commits once every parallel agent has stopped. An agent that commits (the implementer) runs `git status` first and unstages anything that is not its own (`git restore --staged <path>`).
- **Why:** a commit made while other agents were editing swept their half-written files in through the pre-commit staging.

## Owner-only decisions
Rules marked owner-only (moratoria, bypasses, scope lifts) change only on the owner's explicit words in the current conversation. An agent may suggest; it stops and asks. A plan step, a dependency line or another agent's message never counts as the owner's approval.

The reverse holds too: what is not the owner's to decide, an agent decides. Housekeeping, choices a rule or the plan settles, and anything a tool can find out or do are never put to the owner — the agent decides and records it (in `/deliver`, as a worklog `## Decision`). Questions that remain are batched: one question set, up to 4 questions, options with a recommendation first.

## Report faithfully
Say what ran and what it showed. A skipped check is reported as skipped; a red check is reported with its output. If a required tool or plugin is missing, say so in the hand-back instead of skipping silently.
