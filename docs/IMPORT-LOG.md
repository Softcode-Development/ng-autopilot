# Import log

Every source item, its decision and where it landed. Nothing leaves a source without a row here. Decisions: **as-is**, **generalized** (domain stripped), **template** (structure only), **finances-only** (stays in the source project), **dropped** (with reason), **→ batch N** (decided in a later batch; the item is not lost).

Source for batches 1–9: `C:\apps\finances-app` (Nx, Angular 21 + NestJS 11). Items marked *(other repo)* come from seller-ui, fp-ecommerce-store, qualylab-admin-fe or the owner's saved preferences.

Paths below are relative to `plugins/`.

---

## Batch 1 — root docs (2026-10-15)

### File-level decisions

| File | Decision | Landed in |
|---|---|---|
| CLAUDE.md | template + extract | `core/templates/docs/CLAUDE.md` + rules below |
| ARCHITECTURE.md | template + extract | `core/templates/docs/ARCHITECTURE.md` + rules below |
| DESIGN_SYSTEM.md | template + extract | `angular/templates/docs/DESIGN_SYSTEM.md`, `angular/rules/design-discipline.md`, `spartan/rules/spartan.md` |
| FEATURES.md | template | `core/templates/docs/FEATURES.md` |
| GETTING_STARTED.md | template | `core/templates/docs/GETTING_STARTED.md` |
| TECH_STACK.md | template | `core/templates/docs/TECH_STACK.md` |
| DATA_MODEL.md | template (nestjs) + extract | `nestjs/templates/docs/DATA_MODEL.md`, `nestjs/rules/data-model.md`; FE-only projects get `core/templates/docs/DOMAIN.md` |
| ROADMAP.md | dropped, except two sections | Owner: no value across projects. Kept: "How to read the time estimates" and "Rules to keep yourself honest" → GETTING_STARTED § 8 |
| SECURITY.md | dropped | Owner agreed: a human disclosure policy, no value for agents. Agent-facing security → `angular/rules/security.md`, `nestjs/rules/security.md` |
| README.md | dropped, except one convention | "Most important path; everything else is cut first" → CLAUDE template § 1 |
| WORK_PROCESS_LOG.md | → batch 9 | Process log; read with the process docs |
| AGENTIC_WORKFLOW.md | → batches 2–4 | Describes hooks, agents, skills, MCP, CI gates |

### New in golden (no single source)

| Item | Landed in | Basis |
|---|---|---|
| AI-first doc standard: doc-set table, each fact lives once, rule anatomy (Rule/Why/Enforcement/Exempt/Precedent), decision aids, owner-only decisions, growth slot | `core/rules/ai-first-docs.md` | How the finances docs are written; drift found across all 5 repos |
| DOMAIN.md for FE-only projects | `core/templates/docs/DOMAIN.md` | DATA_MODEL is backend-only; FE repos need glossary + API source of truth |
| "Deviations from golden rules" table | ARCHITECTURE template § 2 | Lets legacy repos (seller-ui NgModule) declare carve-outs instead of contradicting |

### CLAUDE.md, section by section

| § | Item | Decision | Landed in |
|---|---|---|---|
| header | "This file is law", reviewed like code | as-is | CLAUDE template header |
| 1 | Mission | template | CLAUDE template § 1 |
| 2 | Stack line + stack pins block | template | CLAUDE template § 2 (pins format may change → batch 6) |
| 3 | Feature folders FE / BE | generalized | `angular/rules/architecture.md`, `nestjs/rules/backend.md` |
| 3 | `core/` flat, intent-named folders; vendors under intent; interceptors in `core/http/interceptors/` | generalized | `angular/rules/architecture.md` |
| 3 | Shared UI grouped by consuming project type | generalized | `angular/rules/architecture.md` |
| 4 | `/propose → /opsx-apply → /opsx-archive` | → batch 4 | OpenSpec adoption decided with the skills |
| 4.1 | Smoke gate | generalized | `core/rules/work-modes.md` |
| 4.1 | Visual gate (desktop + phone, light + dark) | generalized | `angular/rules/design-discipline.md` |
| 4.1 | Path → command mapping (AGENTIC_WORKFLOW § 8.5) | → batch 2–4 | |
| 4.2 | balanced / strict modes: timing only, never whether | generalized | `core/rules/work-modes.md` |
| 4.2 | End-of-change pass re-runs existing int-specs (+ BullModule precedent) | generalized | `core/rules/work-modes.md` |
| 4.2 | Worklog note may stand in for a small change | generalized | `core/rules/work-modes.md` ("short plan note") |
| 4.2 | CI manual, not per-push (dev stage) | → batch 8 | |
| 4.2 | Per-file unit tests for pure logic only; DB access is integration tier | → batch 6 | |
| 4.2 | Prescriptive agent briefs (~4× faster) | as-is | `core/rules/agent-conduct.md` |
| 4.2 | Never relaxed list | generalized | `core/rules/work-modes.md` |
| 5 | LT tax glossary, Pinigini, household terms | finances-only | Pattern → DOMAIN template § 1 |
| 6 | Error taxonomy | as-is | `nestjs/rules/errors-and-contracts.md` |
| 7 | Auth model (Supabase JWT → guard → household scope) | generalized | `nestjs/rules/security.md` (AuthN/AuthZ rows) |
| 8 | Testing rules + tier table + global test agents | → batch 6 | |
| 8 | Spec scenarios drive coverage, not literal names; AS-N forbidden in tests | → batch 4/6 | OpenSpec-tied |
| 9 | Branch strategy main/production/change-* | finances-only | Pattern → TECH_STACK template "Non-stack decisions" |
| 9 | Conventional Commits + commitlint | generalized | `core/rules/git-safety.md` |
| 9 | `Change: <slug>` body line | → batch 4 | OpenSpec-tied |
| 9 | Tick task in the same commit | generalized | `core/rules/git-safety.md` |
| 9 | Version bump per change, SemVer by type | generalized | `core/rules/git-safety.md` |
| 9 | Squash merge, no direct push, no force, no `--no-verify` | generalized | `core/rules/git-safety.md` |
| 10.1 | No freestyle code | generalized | `core/rules/agent-conduct.md` |
| 10.2 | No self-review | generalized | `core/rules/agent-conduct.md` |
| 10.3–4 | No silent deferral; destination pointers | generalized | `core/rules/agent-conduct.md`; pointer-format validator → batch 4 |
| 10.5 | No `any` | as-is | `angular/rules/typescript.md` |
| 10.6 | No `*` CORS | as-is | `nestjs/rules/security.md` |
| 10.7 | No `console.log` | as-is | `angular/rules/security.md`, `nestjs/rules/backend.md` |
| 10.8 | No BehaviorSubject for app state; RxJS fenced | generalized | `angular/rules/state.md`. Finances' specific fence (RxJS only under `realtime/`) stays a project rule |
| 10.9 | No Karma/Jasmine | → batch 6 | Runner is per project (seller-ui runs Karma) |
| 10.10 | No `--no-verify`; SKIP_TASKS_GATE owner bypass | generalized | `core/rules/git-safety.md`; the bypass mechanism → batch 2 |
| 10.11 | `schema.prisma` only by db-migrator | generalized | `nestjs/rules/data-model.md`; hook → batch 2 |
| 10.12 | `openspec/specs/**` only by archive | → batch 2/4 | |
| 10.13 | AS-N references | → batch 4 | |
| 10.14 | Primitives first | generalized | `angular/rules/design-discipline.md` |
| 10.15 | Inline template ≤ 15 lines | as-is | `angular/rules/components-templates.md` |
| 10.16 | Readable code | as-is | `core/rules/readable-code.md` |
| 10.17 | API/route/page-name constants | generalized (i18n-library neutral) | `angular/rules/constants-naming.md` |
| 10.18 | E2E moratorium | finances-only | Pattern (owner-only rule with Status line) → `core/rules/ai-first-docs.md`, `agent-conduct.md`, CLAUDE template § 6.3 |
| 10.19 | OpenAPI metadata | as-is | `nestjs/rules/errors-and-contracts.md` |
| 10.20 | No duplicate wire schemas | generalized | `nestjs/rules/errors-and-contracts.md` |
| 11 | Build-plan linkage (frontmatter, validator) | → batch 4/9 | |
| 12 | Where to look | template | CLAUDE template § 8 |

### ARCHITECTURE.md

| § | Item | Decision | Landed in |
|---|---|---|---|
| 1 | Monorepo tree | finances-only | Pattern → ARCHITECTURE template § 1 |
| 1 | Why this shape; forbidden patterns | generalized | `angular/rules/architecture.md` |
| 2 | tsconfig strictness | as-is (options already covered by `strict` folded in) | `angular/rules/typescript.md` |
| 2 | `as` / `!` / `@ts-expect-error` / return types / no numeric enum | as-is | `angular/rules/typescript.md` |
| 2 | Mandatory per-feature artifacts | as-is | `angular/rules/architecture.md`; DTO row → `nestjs/rules/backend.md` |
| 3 | NestJS modules, layers, validation, perf, logging, secrets | generalized | `nestjs/rules/backend.md`, `nestjs/rules/security.md` |
| 4 | Component types | as-is | `angular/rules/architecture.md` |
| 4 | spartan TL;DR | generalized | `spartan/rules/spartan.md` |
| 4 | Standalone, signals, zoneless | generalized (zoneless when declared) | `angular/rules/architecture.md` |
| 4 | State-by-origin table, decision rule, banned list | generalized (library named by project) | `angular/rules/state.md` + ARCHITECTURE template § 3 |
| 4 | Templates (control flow, signal APIs, OnPush) | as-is | `angular/rules/components-templates.md`, `architecture.md` |
| 4 | Forms (Reactive, Zod via `zodFormBuilder`) | generalized | `angular/rules/forms-routing-http.md` |
| 4 | HTTP (generated client, interceptors) | generalized | `angular/rules/forms-routing-http.md` |
| 4 | Routing (lazy, functional guards, title keys) | as-is | `angular/rules/forms-routing-http.md` |
| 4 | Styling (tokens, no raw hex, dark mode) | generalized | `angular/rules/design-discipline.md`, DESIGN_SYSTEM template § 4–5 |
| 4 | Accessibility | generalized | `angular/rules/design-discipline.md` |
| 5 | i18n (keys, all locales same PR, pipes, backend returns keys, ICU) | generalized (Transloco specifics → future `transloco` pack) | `angular/rules/i18n.md` |
| 6 | Naming | as-is | `angular/rules/constants-naming.md` |
| 7 | Testing (incl. "verbatim" naming that contradicts CLAUDE § 8; 80/75 coverage claimed but not enforced) | → batch 6 | Contradiction and false enforcement claim to be resolved there |
| 7 | No test reaches another feature's internals | → batch 6 | |
| 8 | Money & dates | generalized | `angular/rules/typescript.md` § Money and dates, `nestjs/rules/data-model.md` |
| 9 | Comments: why not what | as-is | `core/rules/readable-code.md` |
| 9 | Feature README ≤ 30 lines; ADRs | as-is | `angular/rules/architecture.md`, ARCHITECTURE template § 7 |
| 10 | Security baseline table | split | BE rows → `nestjs/rules/security.md`; FE rows → `angular/rules/security.md` |
| 10 | SECURITY DEFINER in `private` schema | generalized | `nestjs/rules/security.md` |

### DESIGN_SYSTEM.md

| § | Item | Decision | Landed in |
|---|---|---|---|
| 1 | Mandatory-primitives rule + why | generalized | `angular/rules/design-discipline.md` |
| 1.1 | Audit before hand-rolling; node_modules is not an audit; spinner precedent | as-is | `angular/rules/design-discipline.md` (+ brain/helm specifics in `spartan.md`) |
| 1.1 | Generator quirk (enforce-module-boundaries IIFE) | as-is | `spartan/rules/spartan.md` |
| 2 | Catalog: available now / add when needed | template | DESIGN_SYSTEM template § 2 |
| 3 | Custom composites boundary | generalized | `design-discipline.md` + template § 3 |
| 4 | Tokens as CSS variables; no hex (stylelint) | generalized | `design-discipline.md` + template § 4 |
| 5 | Dark mode strategy, persistence, FOUC script, OS listener | generalized | DESIGN_SYSTEM template § 5 |
| 6 | A11y minimums | as-is | `design-discipline.md` |
| 7 | Iconography | generalized | `design-discipline.md`, `spartan.md` (Lucide) |
| 8 | Motion | as-is | `design-discipline.md` |
| 9 | Forms primitives | generalized | `spartan.md`, template § 7 |
| 10 | Layout (card, spacing, breakpoints, overlays, toasts polite) | template + as-is | template § 6, `design-discipline.md` (toasts) |
| 10 | Sidebar offcanvas, FAB | finances-only | |
| 11 | Where things live | template | template § 9 |
| 12 | Where the rules came from | dropped | Provenance links into finances build-plan; the import log now carries provenance |
| 13 | Visual gate + design-skill table + "doc pins direction" + triage + missing-plugin rule | as-is | `design-discipline.md` |
| 14 | Future rules slot | as-is | template § 11, `ai-first-docs.md` growth slot |

### GETTING_STARTED.md, TECH_STACK.md, FEATURES.md, DATA_MODEL.md, ROADMAP.md, README.md

| Item | Decision | Landed in |
|---|---|---|
| GETTING_STARTED build-plan steps 00–06 | finances-only | |
| GETTING_STARTED loop, deferral mid-flight, "every time you sit down", iron rules | template | GETTING_STARTED template § 5–7 |
| TECH_STACK table (layer/choice/why) + non-stack decisions | template | TECH_STACK template |
| TECH_STACK Angular-vs-Next, Supabase-vs-API discussions, cost | finances-only | |
| FEATURES module format (slug, original ask, requirements, phase) | template | FEATURES template |
| DATA_MODEL conventions (tenant id, money, timestamptz, soft delete, naming, migrations, version chain) | generalized | `nestjs/rules/data-model.md` + DATA_MODEL template |
| ROADMAP "How to read the time estimates" (owner is the bottleneck; reviewer fatigue; slow gate first; plan quality) | generalized | GETTING_STARTED template § 8 |
| ROADMAP "Rules to keep yourself honest" (park ideas in FEATURES, CLAUDE.md is law) | generalized | GETTING_STARTED template § 8 |
| README "most important UX path" convention | generalized | CLAUDE template § 1 |

### Added from other repos and owner preferences

| Item | Source | Landed in |
|---|---|---|
| Template purity (no method calls in templates) | owner preference; seller-ui rule 1 | `angular/rules/components-templates.md` |
| `@for` tracks a stable id | seller-ui rule 6 | `components-templates.md` |
| `data-cy` on interactive elements | seller-ui rule 10 | `components-templates.md` |
| Locking form controls (no `[disabled]` with formControlName; `getRawValue`) | seller-ui | `forms-routing-http.md` |
| `HttpClient` provided once (a second instance skips interceptors) | seller-ui | `forms-routing-http.md` |
| Verify params/enums against API docs before wiring | seller-ui, owner preference | `forms-routing-http.md`, DOMAIN template § 2 |
| Never log PII / whole form values; notification service over console | seller-ui | `angular/rules/security.md` |
| XSS: no `[innerHTML]` without sanitizer, no HTML strings | seller-ui | `angular/rules/security.md` |
| Token attached only by interceptor; one JWT utility; one refresh owner | seller-ui | `angular/rules/security.md` |
| Stale lazy chunks after deploy → reload once | seller-ui | `angular/rules/security.md` |
| Enum i18n pattern (`as const` + `_I18N_KEY` Record, piped in template) | owner preference | `angular/rules/i18n.md` |
| Brand strings live in config, not i18n | owner preference | `angular/rules/i18n.md` |
| Translations hand-maintained, never regenerated | seller-ui | `angular/rules/i18n.md` |
| No temporal / changelog comments | owner preference | `core/rules/readable-code.md`, `ai-first-docs.md` |
| PrimeNG: themes licence pin < 3, no CSS layer next to legacy CSS, `:not(.p-component)` | seller-ui | `primeng/rules/primeng.md` |
| Visual gate: never start a second dev server, never kill one you did not start | fp-ecommerce-store, owner preference | `design-discipline.md`, `work-modes.md` |
| "Deviations from golden rules" table | new, for legacy carve-outs | ARCHITECTURE template § 2 |
| `takeUntilDestroyed()`, `host` metadata over HostBinding | Angular 19–21 baseline | `components-templates.md` |

---

### Owner decisions after review (2026-10-15)

| # | Decision | Landed in |
|---|---|---|
| D1 | Tests are written only in a **test phase after the feature is complete** — never per task, in any mode. Order: unit (orchestrated) → mocked e2e for new/changed pages → integration where the tier exists. The plan's acceptance criteria are the coverage list. | `core/rules/work-modes.md` |
| D2 | "Per logical unit" gate removed. Lint + typecheck run automatically in the pre-commit hook; the existing test suite runs at the end of implementation and at the final gate (`strict` adds per task). | `core/rules/work-modes.md` |
| D3 | **OpenSpec is an opt-in `openspec` pack.** Default planning is a plan file with acceptance criteria. | pack → batch 4 |
| D3a | **Mode and planning format are independent settings.** Mode (`fast`/`balanced`/`strict`) sets ceremony; planning format (`plan-file` default / `openspec`) sets only the planning document. Project default in `.claude/golden.json`, overridable per task. Replaces the first draft where `strict` implied OpenSpec. Basis: finances-app runs OpenSpec with balanced rules today. | `core/rules/work-modes.md` § Planning format |
| D4 | **Three modes: `fast` / `balanced` (default) / `strict`.** Fast covers bug fixes, small UI changes, translations, copy, config. Modes only upgrade. | `core/rules/work-modes.md` |
| D5 | **Every mode has a reviewer agent** — fast mode gets one pass on the diff. The owner does not review diffs; the workflow is AI-only. | `core/rules/work-modes.md` |
| D6 | Global test agents + skills move into a `testing` plugin, copied as-is; the speed redesign happens on the golden copy in batch 6. | `plugins/testing/` |

### Testing plugin import (from `~/.claude`, 2026-10-15)

| Item | Decision | Change made |
|---|---|---|
| 9 agents `{unit,integration,e2e}-test-{orchestrator,author,reviewer}` | as-is | Dispatch lines use the plugin-scoped names (`testing:<tier>-test-author`, `testing:<tier>-test-reviewer`); reference paths use `${CLAUDE_PLUGIN_ROOT}/skills/...` (substituted in plugin agent content) |
| Skills `write-unit-tests`, `write-integration-tests`, `write-e2e-tests` + all `references/` | as-is | SKILL.md dispatches `testing:<tier>-test-orchestrator`; cross-references inside `references/*.md` name "the testing plugin's `skills/...`" in words (variable substitution in referenced files is not documented) |
| Skill `detect-stack` | as-is | none |
| Skill `translate` | stays personal | Unrelated to Angular |
| `~/.claude` originals | kept until every project runs on the plugin | While both exist, bare names are ambiguous; the plugin copies dispatch by scoped name. Delete the originals after alignment (fp-ecommerce-store, qualylab use them today) |
| Project-specific reviewer override (`<project>/.claude/agents/<tier>-test-reviewer.md`) | kept | unchanged |
| Real dispatch of `testing:*` agent names from inside an orchestrator | → verify at first sync | Docs confirm the scoped form for plugin agents; the exact Agent-tool `subagent_type` string is tested on the first real run |

### Carried forward

- **→ batch 7:** every `lint:` / `stylelint` rule named in an Enforcement line must exist in the golden ESLint/stylelint preset. Verify each rule name against the installed angular-eslint / typescript-eslint versions, or downgrade the line to `review only`.
- **→ batch 6:** resolve the finances contradiction on test naming ("verbatim" vs paraphrase) and the unenforced 80/75 coverage claim.

---

## Batch 2 — settings + hooks
*(pending)*
