---
slug: <plan slug>-<topic>
from: <plan slug>
created: <YYYY-MM-DD>
reason: <e.g. e2e tier paused | gate deferred: no staging account>
---

# Hand-off — <topic>

Work the delivery `<plan slug>` deferred, and what the next change needs to start without redoing anything. The plan-reviewer checks this file against the worklog's deferrals, both ways. A later plan picks it up and deletes the file in its own close commit.

## Deferred criteria

Each one verbatim from the plan, with its reason.

- `[deferred <tier> → handoff: <slug>-<topic>] WHEN … THEN …` — reason: <tier paused | …>

## Gate deferrals

- <gate, what was not checked, why, what would unblock it — or "none">

## Test data on shared environments

- <environment: what was created (ids, names, accounts), whether it must be cleaned up — or "none">

## Starting points

| Need | Where |
|---|---|
| Routes and states | <`/path` — states> |
| Test-id prefixes | <`data-testid="orders-…"`> |
| Accounts | <path to the `*.local.md` file — never the values> |
| Flags / config | <feature flags, env switches> |
| Existing specs to extend | <paths> |

## Do not redo

- <what is already done and verified, so the next change does not repeat it>
