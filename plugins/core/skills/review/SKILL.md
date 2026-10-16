---
name: review
description: Full review of a branch, PR or commit range outside /deliver — runs the autopilot plan-reviewer and code-reviewer (plus security-reviewer when security trigger paths are touched) and reports the findings that matter, most important first. Use for "review this branch", "review PR 123", "full PR review", "/review <range>". Read-only: it reports, it does not fix.
---

# Review

## Scope

- Argument: a PR number (`gh pr diff <n>`, `gh pr view <n>`), a range (`a..b`), or a branch. None → the current branch against the main branch (find it with `git symbolic-ref refs/remotes/origin/HEAD`, falling back to `main`).
- State the scope in one line before dispatching: base, head, file count.

## Dispatch (in parallel, read-only)

| Reviewer | When |
|---|---|
| `autopilot:code-reviewer` | Always |
| `autopilot:plan-reviewer` | When the branch has a plan (`.claude/plans/<slug>/plan.md` naming this branch, or an `openspec/changes/<slug>/` folder) |
| `autopilot:security-reviewer` | When the diff touches a path in `.claude/gates.md` § Security triggers, or the owner asks |

Brief each with the exact range and, for the plan-reviewer, the plan path.

## Report to the owner

One message, most important first:
1. **Verdict** — one line per reviewer.
2. **BLOCKING** — every one, with file:line and the fix in a sentence.
3. **Worth fixing** — suggestions that prevent bugs or real maintenance cost; group the rest as "minor (N)" with the report path.
4. **Questions** — only those that need the owner, each with options and a recommendation.

Merge duplicates across reviewers. Do not fix anything unless the owner asks — then the fixes go through `/deliver` in fast mode (or the active plan's Step 8).
