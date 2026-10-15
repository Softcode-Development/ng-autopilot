# Getting Started

From an empty machine to a running app, then how to work in this repo with agents. Read in order.

<!-- guide: commands must be copy-pasteable and exact. If a step needs a secret, say where it comes from, never the value. -->

---

## 1. Prerequisites

- Node <version> (`.nvmrc`), <package manager + version>
- <Docker, browsers, CLIs (gh, claude), accounts the dev needs>

## 2. Install

```bash
<install command>
```
<Known install caveats, e.g. required flags and why.>

## 3. Environment and secrets

<Which env files exist, which are committed, where real values come from, which accounts the visual gate uses (file path, never the values).>

## 4. Run, test, build

| Task | Command | Notes |
|---|---|---|
| Dev server | | port |
| Dev server per <market/tenant/app> | | |
| Unit tests (watch) | | |
| Unit tests (single run, CI-like) | | env vars needed |
| Project gate | | what it checks |
| Build per configuration | | output folder |
| E2E | | |

## 5. Working with agents

```
<the delivery loop with exact command names, e.g.
/plan <task>      → plan in .claude/plans/
/deliver          → implement → gates → review → PR>
```

- **Mode:** `balanced` by default; say "strict" for <when>.
- **Test tiers:** `/write-unit-tests <target>`, … (project rules in `.claude/<tier>-testing/overrides.md`).
- **Deferring something mid-flight:** tell the agent the item and its destination; it writes both ends.

## 6. Every time you sit down

1. Open the repo; start a Claude Code session (session start prints branch, active plan, last commit).
2. Open the active plan in `.claude/plans/` and find the first unchecked item.
3. <Start the dev server if doing UI work.>
4. Continue the loop from § 5.

## 7. Iron rules

The hard rules are in [CLAUDE.md § 6](CLAUDE.md#6-hard-rules-project-specific) and the golden rules in `.claude/rules/golden/`. The three most often broken: never `--no-verify`; no agent reviews its own code; nothing is deferred without a destination.

## 8. Pacing an agent-built project

Agents type the code; **the bottleneck is the owner — proposing, reviewing, deciding.** Plan in changes and cycle time, not calendar weeks.

- **Reviewer fatigue** is the ceiling: if you can review three changes an evening, that is the throughput. Stagger merges.
- **Verify in staging** before stacking more changes on top; a break found late costs the speed advantage.
- **CI and gate feedback time:** optimise the slowest gate before optimising anything else.
- **Plan quality:** a sloppy plan costs about three times as much downstream (bad slicing, wrong questions, rework). Spend the time on the plan.
- **Resist scope creep mid-change:** park new ideas in FEATURES.md with a status, and re-plan.
- **CLAUDE.md is law — keep it accurate.** A wrong line there misleads every session.
