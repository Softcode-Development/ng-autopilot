---
paths:
  - "src/**"
  - "apps/**"
  - "libs/**"
  - "projects/**"
  - "*.json"
  - ".claude/**"
---

# <Project> — project rules

<!-- guide: what NEW work in this project needs, and only that. The autopilot rules (.claude/rules/autopilot/) already cover
     Angular, TypeScript, state, templates, forms, i18n, security, design discipline, testing and the workflow — never
     restate them here; record only what differs, what is unique, or what the autopilot rules leave to the project.
     Legacy stays legacy: no legacy conventions, legacy design system or legacy UI-library rules here — legacy code is
     only bug-fixed, in its own style, and is replaced inside lint.strictScope.
     Every rule follows the autopilot ai-first-docs anatomy: Rule / Why / Enforcement / Exempt / Precedent.
     Loaded on demand (paths above): agents get it when they open project files. Owned by the project — sync never
     overwrites it. This is the project's only agent-facing doc. -->

## Product

- **What it is:** <one or two sentences — who uses it, what it must do>.
- **Most important path:** <the flow everything else is cut before>.
- **Markets / tenants / roles:** <what varies and where that configuration lives>.

## Stack

<One line per non-obvious choice: library + version + why it must not be swapped. Frozen packages with the reason and when they unfreeze.>

## Architecture specifics

- **Where things live:** <the project's concrete folders for core services, shared dialogs/components, constants, test toolkit, …>.
- **Patterns to reuse:** <the HTTP/API layer, error handling, market/tenant config, auth flow, logging — what new code calls, each with its path and a correct-shape example>.
- **Mounting new features in the legacy shell:** <where a new feature's lazy route and menu entry go — the only legacy edits new work makes>.

## Domain and API

- **Glossary:** <terms, local-language words, what they are not>.
- **Auth / session facts:** <token lifetimes, refresh behaviour, error codes the client must handle>.
- **Known API behaviours:** <quirks an agent must know>.
- **Enums (wire spelling):** <enum → values → i18n key map location>.

## Design system

The UI law for NEW code — the autopilot design-discipline rule defers to this section. Never the legacy design system.
- **Primitive library:** <library + version new screens are built with>.
- **Catalog:** <the primitives in use and their imports; what to add when needed>.
- **Tokens and theme:** <token source, how components consume them, dark mode>.
- **Layout:** <containers, breakpoints, navigation, overlays, toasts>.

## i18n

- **Library and files:** <library; locale files; source-of-truth locale>.
- **Key conventions:** <naming beyond the autopilot `feature.section.key`>.
- **Brand strings:** <where they live (config), never in translation files>.

## Security specifics

| Data class | This project's fields |
|---|---|
| Always sensitive (never logged) | <…> |
| Usually sensitive (flag or hash) | <…> |
| Flag only | <…> |
| Always safe | <ids, error codes, correlation ids> |

<Auth/guard specifics, anything security-relevant only this project has.>

## Do not modify without the owner

- <deployment workflows, infra ids, build configurations, major dependency upgrades, …>
