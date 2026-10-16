---
name: sync
description: Bring this project up to date with the golden repo — rewrites generated files (golden rules, tools/golden, CLAUDE.md, git hooks), creates missing project files, merges settings, updates fingerprints. Use on "/core:sync", "update golden", "re-sync", or when /core:doctor says the golden repo changed.
---

# Golden sync

1. The working tree must be clean; otherwise ask the owner to commit or stash.
2. Dry run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/golden.mjs" sync . --dry-run`. Show the owner the summary — especially **Conflicts** (hand-edited generated files that will be overwritten).
3. On the owner's go: `node "${CLAUDE_PLUGIN_ROOT}/scripts/golden.mjs" sync .`, then `node "${CLAUDE_PLUGIN_ROOT}/scripts/golden.mjs" doctor .`.
4. Commit on the current branch (or a new `chore/golden-sync` branch if the owner prefers): `chore: golden sync` with the golden commit from `.claude/golden.lock.json` in the body.

Never hand-edit a generated file to "fix" a conflict: project-specific needs go in `.claude/rules/project.md` or the project's own config files; golden changes go in the golden repo, in a session opened there.
