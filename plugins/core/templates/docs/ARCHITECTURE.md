# Code Architecture & Conventions

This document is non-negotiable. Agents read it before generating code; reviewers cite it. Violations are review blockers, not nits.

<!-- guide: this file holds what is true of THIS project. Generic Angular rules (TypeScript rigor, templates, forms, naming, i18n, security, design discipline) come from the golden packs in .claude/rules/golden/ — do not restate them; record only deviations and project-specific patterns. Every rule: Rule / Why / Enforcement / Exempt / Precedent (golden rule ai-first-docs). -->

---

## 1. Layout

```
<project tree, two to three levels deep, with a one-line comment per folder>
```

### Why this shape

- <What the unit of change is (usually the feature folder) and why.>
- <What core/, shared/ and any libraries hold, and the import direction between them.>

### Forbidden patterns

- <Project-specific forbidden placements and imports, beyond the golden architecture rule.>

## 2. Deviations from the golden rules

<!-- guide: every place this project does not (yet) follow a golden rule, with the reason and the folders the exception is confined to. Example: "NgModule-based — new features also stay NgModule until <milestone>, because …". -->

| Golden rule | Deviation | Confined to | Why | Until |
|---|---|---|---|---|
| <rule> | <what differs> | <paths> | <reason> | <milestone or "permanent"> |

## 3. State management

| Origin | Mechanism in this project | Used for |
|---|---|---|
| Server state | <library> | |
| Component-local UI state | signals | |
| Cross-feature client state | <store mechanism> — stores: <list>; adding one needs an ADR | |
| URL state | Router | |
| Form state | Reactive Forms | |
| Streams | RxJS via `toSignal()` | |

**Decision rule:** <one sentence, e.g. "Came from the API? → … Crosses features? → … Otherwise → local signal().">

**Why this combination:** <one bullet per non-obvious choice.>

## 4. Project patterns

<!-- guide: the bigger-picture patterns an agent must reuse instead of reinventing: the HTTP/API layer, error handling, config/market/tenant handling, auth flow, logging, feature flags. Each with "where it lives" and a correct-shape example. -->

### 4.1 <Pattern name>
- **Where:** `<path>`
- **Rule:** <…>
- **Example:**
```ts
// correct shape
```

## 5. Where things live

| Concern | Location |
|---|---|
| <constants, interceptors, shared dialogs, test toolkit, …> | `<path>` |

## 6. Testing layout

<Runner, where each tier's specs live and how they are named, the project test toolkit location. Rules for authoring live in `.claude/<tier>-testing/overrides.md`.>

## 7. Documentation & ADRs

- Each feature folder has a `README.md` of ≤30 lines: purpose, public exports, capability slug.
- ADRs live in `docs/adr/NNNN-title.md`, created only for durable, non-obvious decisions.

## 8. Future rules

Append new rules as `## 8.N — <name>` with: source (ADR, plan, PR), the rule, a "Why" sentence, and its enforcement. Update CLAUDE.md § 6 if it becomes a hard rule.
