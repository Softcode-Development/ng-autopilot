---
name: doctor
description: Check this project against the ng-autopilot workspace — hand-edited or missing generated files, autopilot repo ahead of the last sync, plugins not enabled, test tiers without overrides, unfilled placeholders, broken links in the project docs, missing devDependencies, leftover legacy AI files, inactive git hooks. Use on "/autopilot:doctor", "check autopilot drift", "is the workspace healthy".
---

# Autopilot doctor

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs" doctor .` and report the result grouped by severity, each finding with its fix:

| Finding | Fix |
|---|---|
| generated file content differs / missing / new file in a generated folder | `/autopilot:sync` restores it; move any project-specific intent into `.claude/rules/project.md` |
| autopilot repo changed since the last sync | `/autopilot:sync` |
| plugin not enabled | `/autopilot:sync` (it rewrites `enabledPlugins`) |
| tier without overrides/backlog | `/autopilot:sync` creates them; fill the overrides |
| unfilled placeholders | fill them (owner decisions go to the owner as questions with options) |
| broken link | find where the target went (`git log --diff-filter=DR -- <path>`) and relink; a target deleted on purpose → restore it to a tracked home, or remove the link with the owner's go |
| dependencies / devDependencies missing | run the install commands `/autopilot:sync` prints (ask before running them) |
| tailwindcss below v4 / postcss.config.json shadows .postcssrc.json | upgrade to Tailwind v4 with `@tailwindcss/postcss`; keep one PostCSS config (Angular reads `postcss.config.json` first) — ask before changing either |
| doc missing a section from its template | add the section; if it does not apply, keep the heading with a `not applicable: reason` comment |
| legacy AI files | `/autopilot:install` Phase 2–4, or delete them after extracting anything project-specific |
| git hooks not active | `npx husky` (ask first) |

Do not fix anything without the owner's go.
