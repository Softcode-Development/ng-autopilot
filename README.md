# claude-golden

The golden AI-driven development workspace for Angular projects: one source for agents, skills, hooks, rules, doc templates and tooling, shared by every project instead of copied.

## Layout

```
.claude-plugin/marketplace.json   local plugin marketplace
plugins/
  core/       stack-neutral: agent conduct, git safety, work modes, AI-first docs, doc templates
  angular/    Angular 19–21 rulebook + DESIGN_SYSTEM template
  testing/    unit / integration / e2e orchestrator → author → reviewer agents, write-*-tests skills, detect-stack
  nestjs/     backend add-on + DATA_MODEL template
  spartan/    spartan/ng + Tailwind design-system add-on
  primeng/    PrimeNG design-system add-on
docs/IMPORT-LOG.md                every imported item, its decision and destination
```

Inside a plugin:
- `rules/` — rule files synced into a project's `.claude/rules/golden/` (plugins cannot load rules themselves).
- `templates/docs/` — starting points for a project's doc set.
- Agents, skills and hooks (later batches) load directly from the plugin.

## How a project uses it

A project lists its packs in `.claude/golden.json`; a sync step enables the matching plugins and writes the rules and repo-side tooling into the project. A drift check reports hand-edited generated files and contradictions. (Sync and drift check are built after the harvest batches.)

## Status

Harvesting from finances-app in batches; see `docs/IMPORT-LOG.md`.
