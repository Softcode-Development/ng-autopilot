# CLAUDE.md — universal agent context

> Loaded into every agent session. This file is **law**: every agent reads it first, before any other doc. Changes to it are reviewed like code.
>
> This file is an **index**. It states the mission, the stack, the work mode and the hard rules in one line each, and points to the one place where each subject is written in full. Target ≤ 150 lines.

<!-- guide: keep every section short. A rule body longer than two lines belongs in ARCHITECTURE.md, DESIGN_SYSTEM.md or a .claude/rules file — link it from here. Each fact lives once (golden rule: ai-first-docs). -->

## 1. Mission

<One or two sentences: what the product is, who uses it, what it must become.>

**Most important path:** <the one user flow everything else is cut before, e.g. "fast add">. When a trade-off is needed, protect this path first.

## 2. Stack

<One line: framework + version · key libraries · runner · package manager.> Full table and rationale: [TECH_STACK.md](TECH_STACK.md).

### Stack pins (read by `detect-stack`)

```
STACK: angular
RUNNER: <vitest | karma-jasmine | jest>
E2E: <playwright | cypress | none>
PACKAGE_MANAGER: <pnpm | npm>
LANGUAGE: typescript
MONOREPO: <true | false>
```

### Golden packs

Enabled packs: <core, angular, …> (see `.claude/golden.json`). Their rules are synced into `.claude/rules/golden/` and load automatically — never edit those files here; change them in the golden repo and re-sync. Project-specific rules and overrides live in this repo's docs and `.claude/rules/project/`.

## 3. Architecture

<Two to four sentences: the one shape that matters (feature folders, core/shared), the state approach, anything unusual.> Full conventions: [ARCHITECTURE.md](ARCHITECTURE.md). UI work follows [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 4. Workflow

- **Work mode:** `balanced` by default, `strict` opt-in — golden rule `work-modes`.
- **Delivering a change:** <the loop, e.g. plan → implement → verify → review → PR, with the command names>.
- **Gates before every commit:** smoke gate + visual gate for UI work + <project gate command>.
- **Testing:** <runner, tiers in use, where project test rules live (`.claude/<tier>-testing/overrides.md`)>.

## 5. Domain essentials

<Only the three to six facts an agent needs in every session (e.g. "every resource is tenant-scoped"). Glossary and entities: [DOMAIN.md](DOMAIN.md) or [DATA_MODEL.md](DATA_MODEL.md).>

## 6. Hard rules (project-specific)

<!-- guide: one line + link each. Generic rules come from the golden packs; list here only what this project adds or overrides, and the legacy carve-outs. Mark owner-only rules. -->

1. <Rule in one sentence.> → [where it is written in full](ARCHITECTURE.md#anchor)
2. <Legacy carve-out: e.g. "NgModule-based until <milestone>; new features follow the golden standalone rule."> → [ARCHITECTURE.md](ARCHITECTURE.md#legacy)
3. <Owner-only rule, e.g. a moratorium.> **Status:** in force. Lifted only by the owner's explicit words; recorded by editing this line to `lifted on <YYYY-MM-DD> by the owner`.

## 7. Do not modify without the owner's authorization

- <Deployment workflows, infra ids, build configurations, major dependency upgrades, …>

## 8. Where to look

| Need | File |
|---|---|
| Architecture, conventions, state table | [ARCHITECTURE.md](ARCHITECTURE.md) |
| UI law — primitives, tokens, a11y, motion | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| Every feature and its capability slug | [FEATURES.md](FEATURES.md) |
| Glossary, entities, API source of truth | [DOMAIN.md](DOMAIN.md) |
| Stack, versions, non-stack decisions | [TECH_STACK.md](TECH_STACK.md) |
| Run from zero; the AI workflow loop; "I just sat down, what now?" | [GETTING_STARTED.md](GETTING_STARTED.md) |
| Generic rules (Angular, security, i18n, …) | `.claude/rules/golden/` |
| Test-tier project rules | `.claude/<tier>-testing/overrides.md` |
| Visual gate — URLs, accounts, states | `.claude/visual-testing/overrides.md` |
| Active plans | `.claude/plans/` |
