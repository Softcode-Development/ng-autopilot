---
name: sync
description: Bring this project up to date with the autopilot repo — rewrites generated files (autopilot rules, tools/autopilot, CLAUDE.md, git hooks), creates missing project files, merges settings, updates fingerprints. Use on "/autopilot:sync", "update autopilot", "re-sync", or when /autopilot:doctor says the autopilot repo changed.
---

# Autopilot sync

1. The working tree must be clean; otherwise ask the owner to commit or stash.
2. Dry run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" sync . --dry-run`. Show the owner the summary — especially **Conflicts** (hand-edited generated files that will be overwritten).
3. On the owner's go: `node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" sync .`, then `node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" doctor .`.
4. Commit on the current branch (or a new `chore/autopilot-sync` branch if the owner prefers): `chore: autopilot sync` with the autopilot commit from `.claude/autopilot.lock.json` in the body.

Never hand-edit a generated file to "fix" a conflict: project-specific needs go in `.claude/rules/project.md` or the project's own config files; autopilot changes go in the autopilot repo, in a session opened there.
