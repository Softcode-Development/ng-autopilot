---
name: install
description: Install the ng-autopilot AI workspace into a project, or adopt an existing AI setup into it — inspects the repo, asks the setup questions (packs, planning format, test tiers, lint strict scope, i18n), extracts project-specific knowledge from old AI files into .claude/rules/project.md, removes the old AI setup, then syncs the autopilot files. On a project that already has .claude/autopilot.json it reconfigures instead (change any answer — widen the lint scope, add a test tier or pack — then sync). Use on "/autopilot:install", "install the ng-autopilot workspace", "adopt autopilot in this repo", "reconfigure autopilot", "widen the lint scope", "add the e2e tier".
---

# Install the ng-autopilot workspace

You are installing into the project at the current working directory. **stop where a phase says the owner decides**. Never push, merge or delete a branch.

Script launcher (used below): `node "${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.mjs"`.

## Which mode

- **No `.claude/autopilot.json`** → **install**: run Phases 0–6 below.
- **`.claude/autopilot.json` exists** → **reconfigure**:
  1. The working tree must be clean; work on the current branch unless the owner asks for a new one.
  2. Show the current answers as the Phase 1 table (current value + what the repo shows now — e.g. new modern folders that could join `lint.strictScope`, a newly configured e2e framework). The owner changes any of them.
  3. Write the new `.claude/autopilot.json` with the flag protocol (Phase 5 step 1).
  4. Sync dry run → show the summary (what gets added, removed, rewritten) → on the owner's go, apply → run doctor.
  5. Commit: `chore: reconfigure autopilot (<what changed>)`.

  Reconfigure never touches project-owned files (project.md, gates.md, overrides, plans) except creating the ones a new tier or pack needs.

## Phase 0 — Branch

1. The working tree must be clean (`git status --porcelain` empty). If not: stop and ask the owner to commit or stash.
2. **Ask the owner which branch to start from** (show the current branch and the default branch). Create `chore/autopilot-install` from it.

## Phase 1 — Setup questions (owner decides)

Inspect the repo, then present **one** table with a proposed answer per question, each with the evidence. The owner confirms or corrects.

**Install every frontend capability.** The point is to give the project the whole toolkit from day one — not to mirror what it already has. Detection fills in *details* (prefix, pipes, locale files, commands); it never decides to leave a frontend capability out.

| Key in `.claude/autopilot.json` | Inspect | Default |
|---|---|---|
| `packs` | `package.json` dependencies | **Always** `core`, `angular`, `testing`, `openspec`. **UI library pack** — PrimeNG in use → `primeng`; spartan/ng in use → `spartan`; both → both; **neither → ask the owner which UI library the project will use** (PrimeNG or spartan/ng + Tailwind) and install that pack. **Backend pack** — `nestjs` only when the repo has a NestJS app; without a backend there is nothing for it to do. |
| `planning` | — | `plan-file` unless the owner chooses `openspec` |
| `testTiers` | runner + spec files; e2e framework config | **`["unit", "integration", "e2e"]` — always all three.** A tier the repo does not run yet still gets its overrides and backlog (placeholders); the first `/write-<tier>-tests` sets the tier up (framework choice — Playwright for a new e2e suite — config, scripts) and fills the overrides. Note in the table which tiers start from zero. |
| `lint.strictScope` | folder layout | **whole app (`["src/**"]`) or only the modern folders (e.g. `["src/app/features/**"]`)** — inside it every autopilot rule is an error; outside is legacy: bug fixes only, never developed further (architecture rule, Legacy stays legacy) |
| `lint.selectorPrefix` | `angular.json` → `prefix` | |
| `lint.translatePipes` | i18n library | `translate` (ngx-translate), `transloco`, … |
| `lint.testingToolkit` | existing shared test-helper folder | **`src/testing`** unless one already exists. Sync creates it with its README; specs import it, production code can't (ESLint, by relative path and alias); it is linted with the spec rules even outside `strictScope` |
| `lint.testingToolkitImports` | `tsconfig` `paths` pointing at the toolkit | path aliases for the toolkit (e.g. `@app/testing`); `[]` when there is none |
| `i18n.sets` | locale JSON files | each set: the source-of-truth locale file + the locales that mirror it |
| `packageManager` | lockfile | `npm` / `pnpm` |
| `commands.typecheck` | tsconfig files | incremental, e.g. `npx tsc -p tsconfig.app.json --noEmit --incremental` |
| `commands.prePush` | `package.json` scripts | the affected lint + typecheck + test command; with a narrowed `strictScope`, lint the scope **and** the toolkit (e.g. `npx eslint --no-error-on-unmatched-pattern "src/app/features/**" "src/testing/**"`). The hook runs non-interactively: it must work on the owner's machine as it is, with no setup step. Don't add env vars or machine paths because a doc says "set X": tools usually find what they need themselves (karma-chrome-launcher finds Chrome in `%LOCALAPPDATA%`, `Program Files` and `Program Files (x86)` when `CHROME_BIN` is unset). Verify by asking the tool what it resolves, and never conclude "not installed" from one folder |
| `stylelint.scss`, `stylelint.tailwind` | style files, Tailwind config | |
| `sourceGlobs` | layout | what counts as application code (default `src/**`) |
| `api.baseUrl`, `api.docsUrl` | environment files (`apiUrl`, `baseUrl`, proxy config), README / docs / old AI files / your memory for Swagger / OpenAPI / `api-docs` links | the dev API base and its Swagger/OpenAPI docs URL. **Not found → ask the owner; never guess.** A project with no backend API: `api.none: true`. Sync writes them into the generated `CLAUDE.md`, so every session has them |

## Phase 2 — Inventory the existing AI setup (owner decides)

Find every AI artifact: `CLAUDE.md`, `AGENTS.md`, `.claude/agents|skills|instructions|prompts|commands|rules|plans|reviews|*-testing`, hooks in `.claude/settings*.json` and the scripts they call, `.mcp.json`, `.github/copilot-instructions.md`, `.github/prompts|instructions|agents`, `.cursor*`, `.windsurfrules`.

Present one table, a row per file or folder, with a decision:

| Decision | Meaning |
|---|---|
| **extract → delete** | holds knowledge **new work needs** — extracted into `.claude/rules/project.md` (or gates.md / an overrides file) in Phase 3, then deleted. Files that only describe legacy code (its conventions, design system, UI-library rules, scaffolding) are **delete**, not extract |
| **delete** | replaced by the ng-autopilot workspace (generic agents, skills, instructions, Copilot copies, old review reports) |
| **archive** | finished plans → `.claude/plans/archive/` |
| **keep** | genuinely project-specific and not expressible as a rule (rare — say why) |

Nothing is touched until the owner approves the table.

## Phase 3 — Extract project knowledge (owner reviews)

1. Write `.claude/rules/project.md` from `${CLAUDE_PLUGIN_ROOT}/templates/project/project.md`, filled with what the extracted files say. Follow the autopilot `ai-first-docs` rule:
   - **only what new work needs and the autopilot rules don't already say** — the test for every line: "would an agent building a new feature inside `lint.strictScope` go wrong without it?" Typical keepers: API and auth/session facts, markets/tenants and their config, i18n source-of-truth workflow, security fields, frozen packages new code must not bump, do-not-modify list, how a new feature is mounted in the legacy shell;
   - **legacy stays legacy:** no legacy conventions, no legacy design system, no legacy UI-library rules, no legacy component idioms — legacy code is only bug-fixed, in its own style, and the file itself shows that style;
   - each rule keeps its why, enforcement and precedent;
   - nothing stale (old versions, finished migrations, superseded advice).
   - Also extract project facts from the owner's auto-memory for this repo (`~/.claude/projects/<repo>/memory/`) by the same test — it exists on one machine only.
2. Draft `.claude/gates.md` (commands, smoke map, visual-gate setup, security triggers) and, per test tier, `.claude/<tier>-testing/overrides.md` (toolkit, scoped commands, carve-outs) from the same sources and `package.json`.
3. Show the owner `project.md` with a coverage map: every section of every extract → delete file → where it went (`project.md` / `gates.md` / overrides / "covered by autopilot rule X" / "legacy only — dropped"). The owner approves.
4. Commit: `docs: extract project knowledge into project rules`.

## Phase 4 — Remove the old setup

1. Delete everything the table marked delete / extract → delete; move archive items. The old `CLAUDE.md` and any existing `.husky/pre-commit|commit-msg|pre-push` are protected paths (sync will regenerate them): set the flag for their removal — `mkdir -p .claude/.flags && touch .claude/.flags/autopilot-sync` — and remove it right after.
2. Remove old hooks and permissions from `.claude/settings.json` that point at deleted scripts.
3. Commit: `chore: remove legacy AI setup`.

## Phase 5 — Install

1. Write `.claude/autopilot.json` with the Phase 1 answers. It is a protected file: create the flag first and remove it after — `mkdir -p .claude/.flags && touch .claude/.flags/autopilot-sync`, write, then `rm .claude/.flags/autopilot-sync`.
2. Dry run: launcher `sync <project-dir> --dry-run`; show the summary. Then apply: launcher `sync <project-dir>`.
3. Run launcher `doctor <project-dir>`.
4. Ask the owner before installing the missing devDependencies and before running `npx husky` to activate the git hooks.
5. Commit: `chore: install autopilot workspace`.

## Phase 6 — Hand-back

The branch name and its three commits; the doctor output; what the owner still fills in (placeholders in gates.md / overrides); how to update later (`/autopilot:sync`) and check drift (`/autopilot:doctor`).
