# claude-golden

The golden AI-driven development workspace for Angular projects: one source for agents, skills, hooks, rules, doc templates and tooling, shared by every project instead of copied.

## Set up a machine

```bash
git clone <this repo> && cd claude-golden
npm run setup              # dry run: prints what it will do
npm run setup -- --apply   # registers the marketplace, installs the packs (disabled at user scope),
                           # installs missing external dependencies (dependencies.json)
```

Packs are installed once per machine and **enabled per project** (the project's `.claude/settings.json`, written by sync). External plugins the workflow calls — `frontend-design`, `design`, `superpowers` — are installed only when no copy exists; a copy synced from claude.ai counts.

## Install into a project

Open Claude Code in the project and run **`/core:install`**. It works on a new branch (it asks which branch to start from) and stops for your decisions:

1. **Setup questions** — it inspects the repo and proposes each answer; you confirm or correct. The answers go to `.claude/golden.json`.
2. **Inventory** — every existing AI file (old CLAUDE.md, agents, skills, instructions, prompts, Copilot files, hooks) with a decision per file: extract → delete, delete, archive, keep. You approve the table.
3. **Extract** — project-specific knowledge goes into `.claude/rules/project.md` (only what differs from the golden rules); you review it. *Commit 1.*
4. **Clean** — the old AI setup is deleted. *Commit 2.*
5. **Install** — sync writes the golden files; the drift check runs; you approve installing the devDependencies and activating the git hooks. *Commit 3.*

### Choosing the lint scope

`lint.strictScope` decides where every golden rule is an error, with no carve-outs:

```jsonc
// A modern app — the whole codebase follows the golden rules:
{ "lint": { "strictScope": ["src/**"] } }

// A legacy app being modernised step by step — only the new code:
{ "lint": { "strictScope": ["src/app/features/**"] } }
```

Outside the scope, golden lint rules are off and legacy code keeps its current lint; widen the scope as code moves in, then `/core:sync`.

### Afterwards

| Command | Use |
|---|---|
| `/core:sync` | Bring the project up to date after the golden repo changes (dry run first) |
| `/core:doctor` | Drift check: edited generated files, golden repo ahead, placeholders, missing devDependencies, legacy files |
| `/deliver` | Every change |
| `/review` | Full review of a branch or PR |

Generated files (`CLAUDE.md`, `.claude/rules/golden/`, `tools/golden/`, `.husky/*`, `.claude/golden*.json`) change only through sync: hooks refuse edits, and the pre-commit fingerprint check refuses commits of edited copies. Project-owned files — `.claude/rules/project.md`, `.claude/gates.md`, test overrides and backlogs, plans, and the project's own `eslint.config.mjs` / `stylelint.config.mjs` / `commitlint.config.cjs` — are yours.

The scripts behind the skills can also run directly from the golden repo: `node bin/sync.mjs <project> [--dry-run]`, `node bin/doctor.mjs <project>`.

## Layout

```
.claude-plugin/marketplace.json   local plugin marketplace
plugins/
  core/       workflow (WORKFLOW.md, /deliver, /review), agents (architect, reviewers), hooks, core rules, templates
  angular/    Angular 19–21 rules, implementer agent, angular-cli MCP
  testing/    unit / integration / e2e orchestrator → author → reviewer agents, write-*-tests skills
  nestjs/     backend rules, db-migrator
  spartan/    spartan/ng + Tailwind design-system add-on
  primeng/    PrimeNG design-system add-on + MCP
  openspec/   OpenSpec planning format (plan/archive skills, doc-writer)
bin/setup.mjs                     machine setup
bin/sync.mjs, bin/doctor.mjs      project sync and drift check (behind /core:sync and /core:doctor)
dependencies.json                 external plugins the workflow depends on
```

Inside a plugin:
- `rules/` — synced into a project's `.claude/rules/golden/<pack>/` (plugins cannot load rules themselves; one folder per pack because packs share file names like `security.md`).
- `templates/` — starting points for a project's docs and `.claude/` files.
- `agents/`, `skills/`, `hooks/hooks.json`, `.mcp.json` — load directly from the plugin when a project enables it.

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
