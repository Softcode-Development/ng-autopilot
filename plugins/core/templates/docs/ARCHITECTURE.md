# Code Architecture & Conventions

This document is non-negotiable. Agents read it before generating code; reviewers cite it. Violations are review blockers, not nits.

<!-- guide: this file holds what is true of THIS project for new work. Generic Angular rules (TypeScript rigor, templates, forms, naming, i18n, security, design discipline) come from the autopilot rules in .claude/rules/autopilot/ — do not restate them; record only project-specific shape and patterns. Hard rules go in .claude/rules/project.md, not here. Legacy conventions are never described (autopilot architecture rule, Legacy stays legacy). -->

---

## 1. Layout

```
<project tree, two to three levels deep, with a one-line comment per folder>
```

### Why this shape

- <What the unit of change is (usually the feature folder) and why.>
- <What core/, shared/ and any libraries hold, and the import direction between them.>

### Forbidden patterns

- <Project-specific forbidden placements and imports, beyond the autopilot architecture rule.>

## 2. Legacy and new code

<!-- guide: delete this section when lint.strictScope is the whole app. Legacy conventions are not described here: legacy code is only bug-fixed, in its own style. -->

- **New code:** `<lint.strictScope paths>` — every autopilot rule applies.
- **Legacy:** everything else — bug fixes only, in the file's existing style; replaced, never modernised in place.
- **Mounting a new feature in the legacy shell:** <where its lazy route and menu entry go, with a correct-shape example — the only legacy edits new work makes>.
- **Replacing a legacy page:** <the cutover steps: build next to legacy, parity check, route swap, removal>.

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

## 6. i18n

- **Library and files:** <library + version; locale files; source-of-truth locale and who writes its values>.
- **Key conventions:** <naming beyond the autopilot `feature.section.key`; casing; where cross-feature words live>.
- **Wiring:** <what a standalone component imports; where the default locale lives; locale switching>.
- **Formatting:** <number / currency / date pipes and the locale each uses>.
- **Brand strings:** <where they live (config), never in translation files>.

## 7. Testing layout

<Runner, where each tier's specs live and how they are named, the project test toolkit location. Rules for authoring live in `.claude/<tier>-testing/overrides.md`.>

## 8. Documentation & ADRs

- Each feature folder has a `README.md` of ≤30 lines: purpose, public exports, capability slug.
- ADRs live in `docs/adr/NNNN-title.md`, created only for durable, non-obvious decisions.

## 9. Future additions

Append new sections as `## 9.N — <name>` with their source (ADR, plan, PR). A hard rule (Rule / Why / Enforcement) goes in `.claude/rules/project.md` instead and links here.
