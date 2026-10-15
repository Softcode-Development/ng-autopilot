# Project `.claude/` templates

Sync writes these into a project:

| Template | Written to | Notes |
|---|---|---|
| `settings.json` | `.claude/settings.json` | Merged, not overwritten: project-specific allow/ask/deny entries are kept; golden entries are added. Lists both npm and pnpm forms; sync drops the unused package manager. |
| `gitignore` | `.claude/.gitignore` | |

## Why the permission lists look like this

- **allow** — read/search/edit, the project's own scripts, read-only git, staging and committing (commits are local and reversible).
- **ask** — anything that installs, leaves the machine, rewrites history or deletes: installs, `git push`, merge/rebase/reset/checkout, PR create/merge, `rm`, `curl`/`wget` (the smoke gate and API checks need them, so they are not denied).
- **deny** — never from an agent session: force pushes, `reset --hard`, `git clean`, `--no-verify`, package publish, reading env/secret/key files. `.env.example`-style files are not denied.

The settings deny list matches command **prefixes** only. The core `guard-bash` hook closes the side channels the list cannot see: secret reads through `cat`/`grep`, force pushes spelled `+branch`, redirect writes into protected paths.

Do not add `Bash(rm -rf *:*)`: its `*` matches every `rm -rf`, including repo-relative cleanups the hook deliberately allows.

## `.claude/golden.json` (written by sync)

```json
{
  "packs": ["core", "angular", "testing", "primeng"],
  "planning": "plan-file",
  "testTiers": ["unit", "e2e"],
  "protectedPaths": [
    { "glob": "prisma/schema.prisma", "flag": "db-migrator-active", "reason": "owned by the db-migrator agent" }
  ]
}
```

`testTiers` lists the test tiers the project has (`unit`, `integration`, `e2e`). Sync creates `.claude/<tier>-testing/overrides.md` from the testing pack's template for each one; the architect tags acceptance criteria only with these tiers; `/deliver` Step 5 dispatches only their orchestrators.

`protectedPaths` are guarded by `guard-paths` (Write/Edit) and `guard-bash` (shell redirects). `.claude/rules/golden/**` is always protected (flag `golden-sync`). A flow allowed to edit a protected path creates `.claude/.flags/<flag>` before its first write and removes it after its last.
