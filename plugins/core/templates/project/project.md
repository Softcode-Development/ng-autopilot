---
paths:
  - "src/**"
  - "apps/**"
  - "libs/**"
  - "projects/**"
  - "*.json"
  - ".claude/**"
  - "docs/**"
---

# <Project> — project rules

<!-- guide: the project's HARD rules for new work, and where its docs are. Descriptions (stack, architecture, domain, design
     system, features, setup) live in docs/ — link to them, never copy them here. The autopilot rules
     (.claude/rules/autopilot/) already cover Angular, TypeScript, state, templates, forms, i18n, security, design
     discipline, testing and the workflow — never restate them; record only what this project adds or changes.
     Legacy stays legacy: no legacy conventions here. Every rule follows the autopilot ai-first-docs anatomy:
     Rule / Why / Enforcement / Exempt / Precedent. Loaded on demand (paths above). Owned by the project. -->

## Product

- **What it is:** <one or two sentences — who uses it, what it must do>.
- **Most important path:** <the flow everything else is cut before>.

## Project docs

Read the doc before the work it covers; each fact lives in exactly one of them.

| Doc | Holds | Read before |
|---|---|---|
| [docs/TECH_STACK.md](../../docs/TECH_STACK.md) | Layer → choice → version → why; frozen packages; non-stack decisions (branches, hooks, env, versioning) | adding or bumping a dependency |
| [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) | Layout, legacy vs new code, state table, project patterns, where things live, i18n setup, testing layout | any code change |
| [docs/DOMAIN.md](../../docs/DOMAIN.md) | Glossary, API facts and quirks, auth/session facts, entities, wire enums, sensitive data, markets / tenants / roles | wiring an API call, naming anything, logging |
| [docs/DESIGN_SYSTEM.md](../../docs/DESIGN_SYSTEM.md) | The UI law for new code: primitive library, catalog, tokens, theme, layout, icons | any UI work |
| [docs/FEATURES.md](../../docs/FEATURES.md) | Every feature with its capability slug, status and requirements | planning a change |
| [docs/GETTING_STARTED.md](../../docs/GETTING_STARTED.md) | Install, environment, run / test / build, working with agents | setting up or running the app |

## Rules

<!-- guide: one ### block per project-specific hard rule. Example:
### <Rule name>
- **Rule:** <one imperative sentence>.
- **Why:** <the failure it prevents>.
- **Enforcement:** <lint / hook / review only>. **Exempt:** <…>. **Precedent:** <incident, optional>. -->

## Do not modify without the owner

- <deployment workflows, infra ids, build configurations, major dependency upgrades, …>

## Future rules

Append a rule under Rules with its source (owner decision, incident, review finding) and the date it was agreed. A rule the owner lifts gets `Status: lifted on {date} by the owner` in the same commit.
