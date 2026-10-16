---
name: install
description: Install the golden AI workspace into a project, or adopt an existing AI setup into it — inspects the repo, asks the setup questions (packs, planning format, test tiers, lint strict scope, i18n), extracts project-specific knowledge from old AI files into .claude/rules/project.md, removes the old AI setup, then syncs the golden files. Works on a new branch in three reviewable commits. Use on "/core:install", "install the golden workspace", "adopt golden in this repo".
---

# Install the golden workspace

You are installing into the project at the current working directory. Run every phase in order; **stop where a phase says the owner decides**. Never push, merge or delete a branch.

Script launcher (used below): `node "${CLAUDE_PLUGIN_ROOT}/scripts/golden.mjs"`.

## Phase 0 — Branch

1. The working tree must be clean (`git status --porcelain` empty). If not: stop and ask the owner to commit or stash.
2. **Ask the owner which branch to start from** (show the current branch and the default branch). Create `chore/golden-install` from it.

## Phase 1 — Setup questions (owner decides)

Inspect the repo, then present **one** table with a proposed answer per question, each with the evidence. The owner confirms or corrects.

| Key in `.claude/golden.json` | Inspect | Notes |
|---|---|---|
| `packs` | `package.json` dependencies | `core` always; `angular`; `testing`; `primeng` / `spartan` by UI library; `nestjs` when the repo has a NestJS app; `openspec` only if the owner wants that planning format |
| `planning` | — | `plan-file` unless the owner chooses `openspec` |
| `testTiers` | runner + spec files; e2e framework config | only tiers the project actually runs |
| `lint.strictScope` | folder layout | **whole app (`["src/**"]`) or only the modern folders (e.g. `["src/app/features/**"]`)** — inside it every golden rule is an error; outside, legacy code keeps its current lint |
| `lint.selectorPrefix` | `angular.json` → `prefix` | |
| `lint.translatePipes` | i18n library | `translate` (ngx-translate), `transloco`, … |
| `lint.testingToolkitImports` | test helper folders | import paths production code must never use |
| `i18n.sets` | locale JSON files | each set: the source-of-truth locale file + the locales that mirror it |
| `packageManager` | lockfile | `npm` / `pnpm` |
| `commands.typecheck` | tsconfig files | incremental, e.g. `npx tsc -p tsconfig.app.json --noEmit --incremental` |
| `commands.prePush` | `package.json` scripts | the affected lint + typecheck + test command |
| `stylelint.scss`, `stylelint.tailwind` | style files, Tailwind config | |
| `sourceGlobs` | layout | what counts as application code (default `src/**`) |

## Phase 2 — Inventory the existing AI setup (owner decides)

Find every AI artifact: `CLAUDE.md`, `AGENTS.md`, `.claude/agents|skills|instructions|prompts|commands|rules|plans|reviews|*-testing`, hooks in `.claude/settings*.json` and the scripts they call, `.mcp.json`, `.github/copilot-instructions.md`, `.github/prompts|instructions|agents`, `.cursor*`, `.windsurfrules`.

Present one table, a row per file or folder, with a decision:

| Decision | Meaning |
|---|---|
| **extract → delete** | holds project knowledge — extracted into `.claude/rules/project.md` (or gates.md / an overrides file) in Phase 3, then deleted |
| **delete** | replaced by the golden workspace (generic agents, skills, instructions, Copilot copies, old review reports) |
| **archive** | finished plans → `.claude/plans/archive/` |
| **keep** | genuinely project-specific and not expressible as a rule (rare — say why) |

Nothing is touched until the owner approves the table.

## Phase 3 — Extract project knowledge (owner reviews)

1. Write `.claude/rules/project.md` from `${CLAUDE_PLUGIN_ROOT}/templates/project/project.md`, filled with what the extracted files say. Follow the golden `ai-first-docs` rule:
   - **only what is specific to this project or differs from the golden rules** — never restate a golden rule;
   - each rule keeps its why, enforcement and precedent;
   - legacy carve-outs only for paths **outside** `lint.strictScope`;
   - nothing stale (old versions, finished migrations, superseded advice).
2. Draft `.claude/gates.md` (commands, smoke map, visual-gate setup, security triggers) and, per test tier, `.claude/<tier>-testing/overrides.md` (toolkit, scoped commands, carve-outs) from the same sources and `package.json`.
3. Show the owner `project.md` and list anything you deliberately left out and why. The owner approves.
4. Commit: `docs: extract project knowledge into project rules`.

## Phase 4 — Remove the old setup

1. Delete everything the table marked delete / extract → delete; move archive items. The old `CLAUDE.md` and any existing `.husky/pre-commit|commit-msg|pre-push` are protected paths (sync will regenerate them): set the flag for their removal — `mkdir -p .claude/.flags && touch .claude/.flags/golden-sync` — and remove it right after.
2. Remove old hooks and permissions from `.claude/settings.json` that point at deleted scripts.
3. Commit: `chore: remove legacy AI setup`.

## Phase 5 — Install

1. Write `.claude/golden.json` with the Phase 1 answers. It is a protected file: create the flag first and remove it after — `mkdir -p .claude/.flags && touch .claude/.flags/golden-sync`, write, then `rm .claude/.flags/golden-sync`.
2. Dry run: launcher `sync <project-dir> --dry-run`; show the summary. Then apply: launcher `sync <project-dir>`.
3. Run launcher `doctor <project-dir>`.
4. Ask the owner before installing the missing devDependencies and before running `npx husky` to activate the git hooks.
5. Commit: `chore: install golden workspace`.

## Phase 6 — Hand-back

The branch name and its three commits; the doctor output; what the owner still fills in (placeholders in gates.md / overrides); how to update later (`/core:sync`) and check drift (`/core:doctor`).
