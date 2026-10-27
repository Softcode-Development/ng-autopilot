# ng-autopilot

The autopilot AI-driven development workspace for Angular projects: one source for agents, skills, hooks, rules, doc templates and tooling, shared by every project instead of copied.

## Set up a machine

```bash
git clone <this repo> && cd ng-autopilot
npm run setup              # dry run: prints what it will do
npm run setup -- --apply   # registers the marketplace, installs the packs (disabled at user scope),
                           # installs missing external dependencies (dependencies.json)
```

Packs are installed once per machine and **enabled per project** (the project's `.claude/settings.json`, written by sync). External plugins the workflow calls — `frontend-design`, `design`, `superpowers` — are installed only when no copy exists; a copy synced from claude.ai counts.

## Install into a project

Open Claude Code in the project and run **`/autopilot:install`**. It works on a new branch (it asks which branch to start from) and stops for your decisions:

1. **Setup questions** — it inspects the repo and proposes each answer; you confirm or correct. The answers go to `.claude/autopilot.json`.
2. **Inventory** — every existing AI file (old CLAUDE.md, agents, skills, instructions, prompts, Copilot files, hooks) with a decision per file: extract → delete, delete, archive, keep. You approve the table.
3. **Extract** — project knowledge goes into the doc set (`docs/TECH_STACK.md`, `ARCHITECTURE.md`, `DOMAIN.md`, `DESIGN_SYSTEM.md`, `FEATURES.md`, `GETTING_STARTED.md`, plus `DATA_MODEL.md` with a backend) and the project's hard rules into `.claude/rules/project.md` — only what new work needs and the autopilot rules don't say; you review it with a coverage map. *Commit 1.*
4. **Clean** — the old AI setup is deleted. *Commit 2.*
5. **Install** — sync writes the autopilot files; the drift check runs; you approve installing the devDependencies and activating the git hooks. *Commit 3.*

### Choosing the lint scope

`lint.strictScope` decides where every autopilot rule is an error, with no carve-outs:

```jsonc
// A modern app — the whole codebase follows the autopilot rules:
{ "lint": { "strictScope": ["src/**"] } }

// A legacy app being modernised step by step — only the new code:
{ "lint": { "strictScope": ["src/app/features/**"] } }
```

Outside the scope, autopilot lint rules are off and legacy code keeps its current lint; widen the scope as code moves in, then `/autopilot:sync`.

### Afterwards

| Command | Use |
|---|---|
| `/autopilot:sync` | Bring the project up to date after the autopilot repo changes (dry run first) |
| `/autopilot:doctor` | Drift check: edited generated files, autopilot repo ahead, placeholders, broken doc links, machine-specific paths, missing devDependencies or `prepare: husky`, legacy files |
| `/deliver` | Every change |
| `/review` | Full review of a branch or PR |
| `/autopilot:cleanup` | List what agent sessions left on disk for the project (session scratch, tool-result dumps, `.claude/tmp/`, anything written outside the repo) with sizes; delete after one confirmation. `/deliver` does this at Close |

### Test tiers, parallelism and the machine

`.claude/autopilot.json` → `testing.<tier>.enabled` (one switch each for `unit`, `integration`, `e2e`) pauses a tier: no new tests there — criteria that need it go to a hand-off in `.claude/plans/handoff/` — while the implementer keeps that tier's existing specs in step with the code it edits and every gate still runs them. `testing.phase` picks the test-phase shape (`orchestrated` or `single-review`); `limits.parallelTestAgents` (default 3) caps parallel test agents, and only one heavy runner (browser or app boot) runs at a time. Change them with `/autopilot:install` (reconfigure).

Agents write only inside the project (run output in the git-ignored `.claude/tmp/`), start servers only as background tasks, stop only what they started, and `/deliver` ends with a process report and a cleanup. After a long delivery, continue in a fresh session: it releases the MCP servers and processes the old one holds.

Generated files (`CLAUDE.md`, `.claude/rules/autopilot/`, `tools/autopilot/`, `.husky/*`, `.claude/autopilot*.json`) change only through sync: hooks refuse edits, and the pre-commit fingerprint check refuses commits of edited copies. Project-owned files — `.claude/rules/project.md`, the `docs/` doc set, `.claude/gates.md`, test overrides and backlogs, plans, and the project's own `eslint.config.mjs` / `stylelint.config.mjs` / `commitlint.config.cjs` — are yours.

### The agents' browser

The visual gate runs in a Playwright browser, not the owner's Chrome: sync registers the MCP server `playwright` in the project's `.mcp.json` (`tools/autopilot/browser/mcp.mjs` → `@playwright/mcp`, headless, on the installed Chrome or Edge). Agents resize to phone width, switch the colour scheme, hold a request pending for a loading state and read the console themselves. Set `AUTOPILOT_BROWSER_HEADED=1` to watch.

Agents never type credentials. The owner signs in once: `node tools/autopilot/browser/sign-in.mjs <login URL>...` opens a window, and the session is saved to `.claude/browser/storage-state.json` (git-ignored) for every agent browser after it.

### Cloud sessions (optional)

Off by default. `"cloud": true` in `.claude/autopilot.json` makes sync install what a Claude Code cloud session needs — see [docs/CLOUD.md](docs/CLOUD.md).

The scripts behind the skills can also run directly from the autopilot repo: `node bin/sync.mjs <project> [--dry-run]`, `node bin/doctor.mjs <project>`, `node bin/cleanup.mjs <project> [--path <p>]... [--delete]`.

## Layout

```
.claude-plugin/marketplace.json   local plugin marketplace
plugins/
  core/       plugin `autopilot` — workflow (WORKFLOW.md, /deliver, /review), agents (architect, reviewers), hooks, core rules, templates
  angular/    `autopilot-angular` — Angular 19–21 rules, implementer agent, angular-cli MCP
  testing/    `autopilot-testing` — unit / integration / e2e orchestrator → author → reviewer agents, write-*-tests skills
  nestjs/     `autopilot-nestjs` — backend rules, db-migrator
  spartan/    `autopilot-spartan` — spartan/ng + Tailwind design-system add-on
  primeng/    `autopilot-primeng` — PrimeNG design-system add-on + MCP
  openspec/   `autopilot-openspec` — OpenSpec planning format (plan/archive skills, doc-writer)
bin/setup.mjs                     machine setup
bin/sync.mjs, bin/doctor.mjs      project sync and drift check (behind /autopilot:sync and /autopilot:doctor)
bin/cleanup.mjs                   leftover session files for a project (behind /autopilot:cleanup)
dependencies.json                 external plugins the workflow depends on
```

Inside a plugin:
- `rules/` — synced into a project's `.claude/rules/autopilot/<pack>/` (plugins cannot load rules themselves; one folder per pack because packs share file names like `security.md`).
- `templates/` — starting points for a project's docs and `.claude/` files.
- `agents/`, `skills/`, `hooks/hooks.json`, `.mcp.json` — load directly from the plugin when a project enables it. The core plugin is enabled at user level so `/autopilot:install` exists everywhere; its hooks act only in installed projects (a `.claude/autopilot.json` with `packs`) and do nothing anywhere else.

## Pacing an agent-built project

Agents type the code; **the bottleneck is the owner — proposing, answering, deciding.** Plan in changes and cycle time, not calendar weeks.

- **The plan gate is your main lever:** a sloppy plan costs about three times as much downstream (bad slicing, wrong questions, rework). Spend the time there.
- **Verify in staging** before stacking more changes on top; a break found late costs the speed advantage.
- **Optimise the slowest gate first** when feedback feels slow.
- **Park new ideas** in the backlog instead of growing the change in flight.
- **Keep the project rules accurate** — a wrong line there misleads every session.

## Tests

```bash
npm test     # hooks + setup planning (node --test)
```

## Status

Packs, rules, workflow, hooks and tooling are in place. Project sync and the drift check are next.
