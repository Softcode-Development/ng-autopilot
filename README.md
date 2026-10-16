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

## Layout

```
.claude-plugin/marketplace.json   local plugin marketplace
plugins/
  core/       workflow (WORKFLOW.md, /deliver, /review), agents (architect, reviewers), hooks, core rules, templates
  angular/    Angular 19–21 rules, implementer agent, angular-cli MCP, DESIGN_SYSTEM template
  testing/    unit / integration / e2e orchestrator → author → reviewer agents, write-*-tests skills
  nestjs/     backend rules, db-migrator, DATA_MODEL template
  spartan/    spartan/ng + Tailwind design-system add-on
  primeng/    PrimeNG design-system add-on + MCP
  openspec/   OpenSpec planning format (plan/archive skills, doc-writer)
bin/setup.mjs                     machine setup
dependencies.json                 external plugins the workflow depends on
```

Inside a plugin:
- `rules/` — synced into a project's `.claude/rules/golden/<pack>/` (plugins cannot load rules themselves; one folder per pack because packs share file names like `security.md`).
- `templates/` — starting points for a project's docs and `.claude/` files.
- `agents/`, `skills/`, `hooks/hooks.json`, `.mcp.json` — load directly from the plugin when a project enables it.

## Tests

```bash
npm test     # hooks + setup planning (node --test)
```

## Status

Packs, rules, workflow, hooks and tooling are in place. Project sync and the drift check are next.
