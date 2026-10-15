---
paths:
  - "**/*.md"
---

# Writing docs for AI-only development

The project docs (CLAUDE.md, ARCHITECTURE.md, DESIGN_SYSTEM.md, …) are the agents' operating manual. No human fills gaps between them, so every doc is written for an agent that reads it cold. Apply this whenever you create or edit a project doc, a rule, an agent or a skill.

## The doc set

| File | Holds | Never holds |
|---|---|---|
| `CLAUDE.md` | Mission, stack one-liner, work mode, the hard rules as one line + link each, the "Where to look" table | Rule bodies, how-tos, history |
| `ARCHITECTURE.md` | The project's shape and conventions: layout and why, forbidden patterns, state decision table, project-specific patterns | Generic Angular rules (those come from the golden rules) |
| `DESIGN_SYSTEM.md` | The UI law: primitive catalog, tokens, dark mode, layout, where things live | Generic a11y/motion/visual-gate rules (golden `design-discipline`) |
| `FEATURES.md` | Every feature: capability slug, requirements, phase/status | Implementation detail |
| `DOMAIN.md` (FE-only) / `DATA_MODEL.md` (with a backend) | Glossary, entities, enums with wire spelling, API source of truth | Code conventions |
| `TECH_STACK.md` | Layer → choice → version → why; non-stack decisions | Tutorials |
| `GETTING_STARTED.md` | Zero → running → AI workflow loop → "every time you sit down" | Rules |

## Each fact lives once

A rule is written in exactly one file; everything else links to it. Two copies of a rule drift apart, and an agent that finds two versions picks one at random. Before adding a rule, grep for the subject; if it exists, extend or link, never restate.

## Anatomy of a rule

Every hard rule carries these parts, so an agent can apply it to a case the author never imagined:

- **Rule** — one imperative sentence, specific enough to check (`No inline template longer than 15 lines`, not `keep templates small`).
- **Why** — the failure it prevents. Agents judge edge cases from the why, not from the wording.
- **Enforcement** — the mechanism: `lint: <rule>`, `hook: <script>`, `static check: <script>`, `CI: <job>`, or `review only`. In a project doc, never claim a mechanism that is not wired; `review only` is an honest answer. In a golden rule, it names the mechanism the golden tooling ships; the drift check reports a project that has not wired it.
- **Exempt** — the files or cases the rule does not cover (e.g. `*.spec.ts`, the constants file itself).
- **Precedent** — optional: the incident that created the rule (`a spinner was hand-rolled after a faulty node_modules audit`). Precedents stop agents from repeating the same mistake by a different path.

## Decision aids beat descriptions

- Give a **one-sentence decision rule** for every recurring choice (`Did the data come from the API? → server-state library. No → crosses features? → store. No → local signal.`).
- Give **"where things live" tables** so an agent never invents a location.
- Give **audit procedures** before building (`check the upstream catalog first; a node_modules listing does not count`).
- Give **correct-shape examples** in code fences for patterns agents get wrong.

## Owner-only decisions

When a rule can only be changed or lifted by the owner, say so explicitly and say how the lift is recorded (`edit the Status: line to "lifted on <date> by the owner" in the same commit`). An agent may suggest a lift; it stops and asks, never acts on its own judgement.

## Growth slot

Each law doc ends with a "Future rules" section describing how a new rule is appended (source, rationale, why). Rules land there instead of being scattered.

## Hygiene

- No temporal wording (`now`, `recently`, `new in this PR`, `step 12 will…`); the doc states what is true.
- No status that goes stale inside a rule body (`services 3-7 pending`); status lives in plans or FEATURES.md.
- Links are relative and point at a section anchor when the target is long.
