---
name: doctor
description: Check this project against the golden workspace — hand-edited or missing generated files, golden repo ahead of the last sync, plugins not enabled, test tiers without overrides, unfilled placeholders, missing devDependencies, leftover legacy AI files, inactive git hooks. Use on "/core:doctor", "check golden drift", "is the workspace healthy".
---

# Golden doctor

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/golden.mjs" doctor .` and report the result grouped by severity, each finding with its fix:

| Finding | Fix |
|---|---|
| generated file content differs / missing / new file in a generated folder | `/core:sync` restores it; move any project-specific intent into `.claude/rules/project.md` |
| golden repo changed since the last sync | `/core:sync` |
| plugin not enabled | `/core:sync` (it rewrites `enabledPlugins`) |
| tier without overrides/backlog | `/core:sync` creates them; fill the overrides |
| unfilled placeholders | fill them (owner decisions go to the owner as questions with options) |
| devDependencies missing | install them (ask before running the install) |
| legacy AI files | `/core:install` Phase 2–4, or delete them after extracting anything project-specific |
| git hooks not active | `npx husky` (ask first) |

Do not fix anything without the owner's go.
