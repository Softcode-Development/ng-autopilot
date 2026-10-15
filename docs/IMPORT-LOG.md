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

## Batch 2 — settings, hooks, MCP (2026-10-15)

Source: `finances-app/.claude/{settings.json,settings.local.json,.gitignore,mcp.json,hooks/**}`, root `.mcp.json`, `.husky/{pre-commit,commit-msg}`.

### Owner decisions

| # | Decision |
|---|---|
| B1 | Hooks are rewritten in Node (one process per call, no MSYS workarounds, `node --test`). Behaviour kept; every smoke case kept. |
| B2 | `curl` / `wget` move from deny to ask (smoke gate and API checks need them). |
| B3 | Hooks that enforce workflow steps (session context, plan-ready, out-of-scope destinations) wait until the workflow document exists (batch 3); they are written against its real steps. |
| B4 | Each commit already summarises the session; the per-turn worklog stub hook is dropped. The agent-written worklog stays and becomes part of every planning format (batch 3/4). |
| B5 | MCP servers ship inside the pack they belong to. |

### Files

| Source | Decision | Landed in / note |
|---|---|---|
| `hooks/guard-bash.sh` | generalized, Node | `core/hooks/guard-bash.mjs`. Kept: `--no-verify`, `rm -rf` absolute/home/bare `*`, force push, publish, `reset --hard`, secret reads, redirect/tee into protected paths. Added: `--force-with-lease` and `+refspec` pushes, `git clean -f`, `git checkout -- .` / `git restore .`, Windows drive paths in `rm`, `\` path separators, `.p12`/`.pfx`. Fixed: `.env.example`/`.sample`/`.template` reads allowed (the source blocked them while settings.local.json allowed them); `secrets/` rule now matches any file under `secrets/` (the source's lookahead only matched when the file was a `.pem`/`.key`). Protected paths come from `.claude/golden.json` instead of hard-coded Prisma/OpenSpec paths. |
| `hooks/guard-paths.sh` | generalized, Node | `core/hooks/guard-paths.mjs`. Config-driven protected paths + flag files; `.claude/rules/golden/**` always protected (flag `golden-sync`); covers `MultiEdit` and `NotebookEdit`. |
| `hooks/lib/{common.sh,extract.mjs,canonicalise-path.cjs}` | rewritten | `core/hooks/lib/hook-io.mjs` (envelope, project root incl. Git Bash `/c/` form, canonical paths, glob, config, flags). |
| `hooks/lib/apply-edit.cjs`, `out-of-scope-offenders.cjs` | → after workflow (B3) | Needed by the post-edit-content validators |
| `hooks/__smoke__.sh` | ported + extended | `core/hooks/test/*.test.mjs`: unit cases for both guards plus process-level tests (real stdin envelope, exit codes, `golden.json`, flag files, Git Bash paths, malformed input). `npm test` in the golden repo. |
| `hooks/load-context.sh` | → after workflow (B3) | Will print branch, last commit, dirty count, active plan + current step, mode, planning format |
| `hooks/summarize-session.sh` | dropped (B4) | Ran per turn (Stop), not per session: 50 identical stubs in the active worklog |
| `hooks/assert-tasks-updated.sh` | → `openspec` pack (batch 4), simplified | Keep the git-native pre-commit + commit-msg trailer check only; drop the PostToolUse copy that tells the agent to `reset --soft` |
| `hooks/assert-open-questions-resolved.sh` | → after workflow (B3) | Generic form: block source edits while the active plan has unresolved open questions. Build-plan linkage form → `openspec` pack |
| `hooks/assert-out-of-scope-has-destination.sh` | → after workflow (B3) | Generic form for plan files: every out-of-scope bullet carries `→ <destination>` |
| `hooks/regenerate-openapi.sh` | → `nestjs` pack, batch 7 | A husky pre-commit script, not a Claude hook |
| `settings.json` permissions | generalized | `core/templates/claude/settings.json` + README. allow / ask / deny tiers. Dropped `Bash(rm -rf *:*)` (matches every `rm -rf`, contradicting the hook). curl/wget → ask (B2). Env reads denied by name so `.env.example` stays readable. |
| `settings.json` `enabledMcpjsonServers` | dropped | Listed 9 servers that exist only in `.claude/mcp.json`, which Claude Code does not read |
| `.claude/mcp.json` | dropped | Not a location Claude Code reads |
| MCP: angular-cli | generalized | `angular/.mcp.json`: the project's own CLI (`node node_modules/@angular/cli/bin/ng.js mcp --read-only`), so it always matches the project's Angular version (CLI ≥ 20). Verified: answers `initialize` from seller-ui (CLI 21.2.26). |
| MCP: primeng | from seller-ui | `primeng/.mcp.json` + `primeng/mcp/npx-launch.mjs` (pinned packages; Windows-safe launch). Verified: answers `initialize`. |
| MCP: playwright | → batch 6 | Belongs to an e2e-runner pack (Cypress projects don't need it) |
| MCP: filesystem, github, postgres, context7, sentry | not imported | Built-in tools / `gh` CLI cover filesystem and GitHub; postgres/sentry are project-specific; context7 → revisit if a pack needs it |
| Root `.mcp.json` `supabase-prod` | finances-only, flagged | An agent with a production database MCP is a risk; recommend removing during finances alignment |
| `settings.local.json` | personal | Pattern documented in `core/templates/claude/README.md` |
| `.claude/.gitignore` | generalized | `core/templates/claude/gitignore`: `.flags/`, `reviews/*.md` (review reports are run output, not history), `settings.local.json`, `*.local.md` |
| `.husky/pre-commit`, `commit-msg` | → batch 7 | Tooling batch (lint-staged, commitlint, spec validate) |

### Carried forward

- **→ first sync:** confirm plugin MCP servers start with the project root as working directory (the angular-cli entry uses a relative `node_modules` path).
- **→ first sync:** confirm `allow: git checkout -b` vs `ask: git checkout` precedence; if ask wins, `git switch -c` is the allowed way to branch.

---

## Batch 3 — workflow, agents, workflow hooks (2026-10-15)

Source: `finances-app/AGENTIC_WORKFLOW.md`, `.claude/skills/opsx-apply/SKILL.md`, `.claude/agents/*.md` (7), `.claude/instructions/code-review.instructions.md`, `security.instructions.md` (outline).

### Owner decisions

| # | Decision |
|---|---|
| C1 | **Two reviewers**, run in parallel: `plan-reviewer` (conformance) and `code-reviewer` (quality). Fast mode runs `code-reviewer` only. |
| C2 | **Driver triages review findings** (fix / decline with reason / defer with destination); only product decisions go to the owner. The per-finding `review-walkthrough` mode is dropped. |
| C3 | **The implementer commits each slice itself**; the stage-then-bundle step is gone (tests come after the feature, the tick hook lives only in the openspec pack). |
| C4 | Step sequence approved as proposed, with the gaps below fixed. |
| C5 | Gaps fixed: coverage contract in balanced too; review rubric imported now (not batch 5); one project file `.claude/gates.md` for gate config; handoff worklog entries. |

### New in golden

| Item | Path |
|---|---|
| Workflow — the single source of the sequence: roles, artifacts, plan sections, worklog entry formats, Steps 0–10, mode differences, owner stops, resuming, triage, briefs, DoD, failure modes, other skills in the loop | `core/workflow/WORKFLOW.md` |
| `/deliver` — executes the workflow; resumable from plan + worklog | `core/skills/deliver/SKILL.md` |
| Plan + worklog templates | `core/templates/plans/{plan,worklog}.md` |
| Gate config template (commands, smoke map, visual setup, security triggers, versioning) | `core/templates/claude/gates.md` |
| `session-context` hook (SessionStart): branch, last commit, dirty count, packs, planning, active plan with tasks / open questions / next task / last worklog entry. ~200 ms. | `core/hooks/session-context.mjs` |
| `plan-ready` hook: blocks source edits while the active plan is `draft` or has an open question; `status: paused` steps aside; source globs configurable | `core/hooks/plan-ready.mjs` |
| `out-of-scope` hook: every Out-of-scope bullet ends with `→ <destination>`, judged on post-edit content (Write/Edit/MultiEdit, `replace_all`); extra docs configurable | `core/hooks/out-of-scope.mjs` |
| Shared plan parsing (frontmatter, sections, checkboxes in bullet and numbered/bold styles, offenders, post-edit content) | `core/hooks/lib/plans.mjs` |
| Tests: 10 new (unit + process-level on a temp project with real plan files); suite 79/79 | `core/hooks/test/` |

### Files

| Source | Decision | Landed in / note |
|---|---|---|
| AGENTIC_WORKFLOW § 1 loop, lifecycle table | generalized | WORKFLOW § 3 (Steps 0–10); `/propose → /opsx:apply → /opsx:archive` becomes `/deliver` with plan-file or OpenSpec planning |
| § 2 scaffolding tree | dropped | Superseded by the golden layout + sync |
| § 3 CLAUDE.md sections | done in batch 1 | CLAUDE template; § 4 now points at `/deliver` and `gates.md` |
| § 4 agent roster + models | generalized | WORKFLOW § 1; models kept (architect/reviewers opus, implementer/security sonnet) |
| § 4 `mcp_servers` frontmatter | dropped | Not a Claude Code agent field; plugin agents ignore MCP settings |
| § 5 skills (propose / opsx-*) | → batch 4 (openspec pack) | `/deliver` is the default entry |
| § 5 external skills (frontend-design, design, superpowers fit) | as-is | WORKFLOW § 11; design skills in the implementer's UI protocol and the design-discipline rule |
| § 6 hooks | done in batch 2–3 | |
| § 7 MCP | done in batch 2 | |
| § 8 CI gates, deploy, branch protection | → batch 8 | |
| § 8.5.1 smoke gate + path→command map | generalized | Mechanism: work-modes + WORKFLOW Step 6; the map moves to the project's `.claude/gates.md` |
| § 8.5.2 visual gate (1280/375, light/dark, drive interactions, console, critique, blocked-not-skipped, worklog record) | as-is | design-discipline rule + WORKFLOW Step 6 |
| § 9 observability | finances-only | |
| § 10 commits & branching (`Change:`/`Task:` body, release-please) | split | Branch per change → WORKFLOW Step 1; `Change:` line → openspec pack; release-please → batch 8 |
| § 11 Definition of Done | generalized | WORKFLOW § 9 |
| § 11.5 no silent deferral + write-down protocol | generalized | agent-conduct rule, plan Out of scope, `out-of-scope` hook, plan-reviewer check 3 |
| § 12 failure modes | generalized | WORKFLOW § 10 |
| § 13 what this enables | dropped | Motivation, not instruction |
| `opsx-apply` loop | generalized | `/deliver` + WORKFLOW Steps 3–9. Dropped: stage-then-bundle (C3), per-task test dispatch, per-task `nx affected … build`. Kept: pre-flight, refusal modes, slicing, smoke/visual procedure, end-of-change integration re-run, version bump last, reviewers before the PR |
| `architect.md` | generalized | `core/agents/architect.md` — plan-file or OpenSpec; open questions with options + recommendation; criteria tagged by tier; reuse-before-creating |
| `fullstack-dev.md` | generalized | `angular/agents/implementer.md` — commits per slice; `free` mode → fast-mode brief; UI work protocol kept; `review-walkthrough` dropped (C2) |
| `build-plan-reviewer.md` | generalized | `core/agents/plan-reviewer.md` — 7 checks incl. unplanned-work question; build-plan linkage → openspec pack |
| `code-reviewer.md` | generalized | `core/agents/code-reviewer.md` — bounding, deferral context, batching thresholds, persisted report kept |
| `build-plan-security.md` | generalized | `core/agents/security-reviewer.md` — triggers from `.claude/gates.md` |
| `db-migrator.md` | generalized | `nestjs/agents/db-migrator.md` — flag protocol, forward + replay verification; Prisma/Supabase specifics stay in the project's DATA_MODEL.md |
| `doc-writer.md` | → batch 4 (openspec pack) | Spec promotion; plan-file closes without it |
| `code-review.instructions.md` | generalized | `core/review/code-review-rubric.md` — lanes, severity, pre-flight, A–H, report shape, must-nots; finances specifics (household scope, Supabase, AS-N, Karma ban, RxJS fence) removed |
| `security.instructions.md` | generalized | `core/review/security-checklist.md` — OWASP A01–A10 patterns |
| `performance.instructions.md`, `typescript-angular.instructions.md`, `documentation.instructions.md` | → batch 5 | Rules batch |

### Carried forward

- **→ first sync:** confirm `${CLAUDE_PLUGIN_ROOT}` substitution in agent bodies (the core agents read the rubric and workflow through it).
- **→ alignment:** seller-ui's flat `.claude/plans/*.md` files move to `<slug>/plan.md` folders (or archive) so `session-context` and `plan-ready` see them.

---

## Batch 4 — skills, OpenSpec pack, setup (2026-10-15)

Sources: `finances-app/.claude/skills/*` (7), `fp-ecommerce-store/.claude/skills/*` (10) + `prompts/implement-feature.md`, `part-seller-web-ui/.claude/skills/*` (11).

### Owner decisions

| # | Decision |
|---|---|
| D1 | Knowledge belongs in docs and rules, not in extra skills — no `ssr` pack, no `refactor` skill, no implement-feature prompt (`/deliver` replaces it). |
| D2 | One new skill: `core:review` — full PR/branch review with the golden reviewers. |
| D3 | Two refactoring lines go into the golden `architecture` rule: behaviour stays identical (else report); official Angular migration schematics first. |
| D4 | The implementer asks the angular-cli MCP for current Angular docs/best practices instead of relying on memory (covers SSR, new APIs). SSR conventions live in each SSR project's ARCHITECTURE.md. |
| D5 | External plugins are **dependencies** (option A), not copies: a setup command installs what is missing; a claude.ai-synced copy counts as present. |
| D6 | qualylab `e2e-writer` lessons: not needed. |
| D7 | Dropped skills (all repos): debug-issue, front-end-design, git-commit, generate-docs, skill-creator, setup-component, write-tests, write-e2e-tests (seller-ui), i18n-translation (library-specific; projects keep theirs). |

### Landed

| Item | Path | Source |
|---|---|---|
| `openspec` pack: `plan` skill (Step 1), `archive` skill (Step 10, flag protocol), `doc-writer` agent, `openspec` rule (where things live, scenarios drive coverage, scenario ids stay in specs, `Change:` line), README with the `golden.json` keys | `plugins/openspec/` | finances `opsx-propose`, `opsx-archive`, `doc-writer`, CLAUDE § 8/§ 9/#13 |
| Core hooks read OpenSpec changes: `openspec/changes/<slug>/` (not archived) is an active plan; tasks counted across task groups; open questions from `design.md` | `core/hooks/lib/plans.mjs` | — |
| `/deliver` hands Step 1 / Step 10 to the openspec skills when planning is openspec | `core/skills/deliver/SKILL.md` | — |
| `core:review` | `core/skills/review/SKILL.md` | seller-ui / fp `code-review` intent, golden reviewers |
| Refactoring + migrations section | `angular/rules/architecture.md` | fp CLAUDE.md behaviour-preservation clause, fp `refactor-code` |
| angular-cli MCP line | `angular/agents/implementer.md` | — |
| Setup: dry-run by default, finds a working CLI (skips a broken npm shim, falls back to the VS Code extension binary), registers the marketplace, installs packs disabled at user scope, installs missing dependencies | `bin/setup.mjs`, `dependencies.json`, `npm run setup` | — |
| `author` in every plugin manifest | `plugins/*/.claude-plugin/plugin.json` | `claude plugin validate` warnings |
| Tests: OpenSpec change gating + context, task groups, setup planning (fresh / synced-present / re-run); suite 84/84 | `core/hooks/test/`, `bin/test/` | — |

### Not imported

| Item | Decision |
|---|---|
| finances `propose <NN>` + build-plan linkage (`source_build_plan:`, moving build-plan docs on archive, `change:new`/`spec:validate` wrappers) | finances-only — a thin project skill on top of the openspec pack, configured through `golden.json` → `openspec` commands |
| finances `opsx-explore` | dropped — WORKFLOW Step 2 does it |
| finances `opsx-apply` | dropped — `/deliver` |
| finances `supabase`, `supabase-postgres-best-practices` (vendored, pinned in `skills-lock.json`) | finances-only |
| fp `ssr-patterns` | not imported (D1, D4) — SSR conventions move into fp / shop ARCHITECTURE.md at alignment |
| fp `front-end-design` | its PrimeNG/SCSS content moves into fp's DESIGN_SYSTEM.md at alignment |
| fp `implement-feature.md` | dropped (D1) |

### Verified

- `claude plugin validate` on the marketplace: **passes** (the batch-1 carried item is closed).
- `npm run setup` dry run on this machine: finds the VS Code-bundled CLI, reports all three dependencies present (`frontend-design` installed, `design` + `superpowers` synced), plans register + install/disable for the 7 packs.

### Carried forward

- **→ first sync:** run `npm run setup -- --apply` for real.
- **→ new machine:** the fallback dependency marketplaces (`anthropics/knowledge-work-plugins`, `obra/superpowers-marketplace`) are only exercised where no synced copy exists; confirm on the first machine that needs them.
- **→ remote:** give the golden repo a private remote so `--source <git-url>` works on other machines.

---

## Batch 5 — instruction files → rules (2026-10-15)

Source: `finances-app/.claude/instructions/{typescript-angular,performance,documentation,security}.instructions.md` (code-review was batch 3).

### Owner decisions

| # | Decision |
|---|---|
| E1 | Additions merge into the existing rules; new files only for performance and documentation. |
| E2 | **Over-engineering** is a reviewer rule (owner's wording): flag unnecessary complexity when a significantly simpler implementation achieves the same functionality without sacrificing quality — **even when the code complies with project rules**. **More code is not automatically over-engineering:** flag complexity that brings no meaningful benefit, not deliberate architecture that solves a real problem. |

### Landed

| Item | Path | Source |
|---|---|---|
| Over-engineering (§ C2, with the benefit test, "compliance is not a defence", how to flag, severity) | `core/review/code-review-rubric.md` | owner |
| "Simplest thing that fully works" authoring line → points at § C2 | `core/rules/readable-code.md` | owner |
| "Mandatory artifacts per feature" → "Model files per feature" (only when the content exists; never empty files) | `angular/rules/architecture.md` | conflict with E2 found while adding it |
| Using signals (computed pure, effect in injection context, untracked, linkedSignal, toSignal initialValue, resource/httpResource, no `mutate`) | `angular/rules/state.md` | typescript-angular § Signals |
| Dependency injection, zoneless section, one class per file | `angular/rules/architecture.md` | § DI, § Zoneless, § Components |
| Inputs (transforms, route params as inputs), lifecycle (toSignal over async pipe, takeUntilDestroyed, DestroyRef, afterNextRender / afterRenderEffect), deferred loading (placeholder/loading/error), `@if` over `[hidden]` | `angular/rules/components-templates.md` | § Components, § Lifecycle, § Deferred, performance § 1 |
| Typed forms detail, validators, submit pattern; functional matchers, `withComponentInputBinding`; HttpClient only, `withFetch`, functional interceptors, services return Observable | `angular/rules/forms-routing-http.md` | § Forms, § Routing, § HTTP |
| interface vs type, readonly, discriminated unions + assertUnreachable, no `Function`/`Object`/`{}`, `satisfies` | `angular/rules/typescript.md` | § TypeScript strict |
| No `!important`, no component dark-mode media queries, BEM naming | `angular/rules/design-discipline.md` | § Styling |
| Frontend performance hunting list | `angular/rules/performance.md` (new) | performance §§ 1–4, 7–9, "when you find" |
| Backend performance hunting list | `nestjs/rules/performance.md` (new) | performance §§ 5–6 |
| Rubric § H links the performance rules | `core/review/code-review-rubric.md` | — |
| Six-question thinking process; reporting (CIA severity, cite the threat, show the attack); SSRF timeouts/redirect cap | `core/review/security-checklist.md` | security § thinking, § when you find, A10 |
| Secure-by-default starting shapes (endpoint, tenant table, webhook, integration) | `nestjs/rules/security.md` | security § templates |
| URL params are user input; redirect allowlist | `angular/rules/security.md` | security § templates, A01 |
| Sensitive-data classes table (4 classes, per-project fields) | `core/templates/docs/DOMAIN.md` § 5 | security § PII catalog (pattern only) |
| JSDoc, workaround links, README contents, ADR format, `BREAKING CHANGE:` | `core/rules/documentation.md` (new) | documentation |

### Changed while doing this

- **Synced rules go to `.claude/rules/golden/<pack>/`**, not one flat folder — `angular` and `nestjs` both have `security.md` and `performance.md`. References in `security-reviewer` and `openspec:plan` updated; the protected glob `.claude/rules/golden/**` already covers subfolders (test added).

### Not imported

Non-negotiables summary and authoring checklist (restate rules; lint enforces), file-organisation recap (architecture rule), Transloco / Supabase / household / `realtime/` specifics, the LT threat model and PII table (finances-only; the pattern went to DOMAIN.md), i18n `@@key` notes (library-specific).

---

## Batch 6 — testing redesign
*(pending)*
