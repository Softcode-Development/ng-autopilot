---
name: plan
description: Step 1 of the golden workflow in the OpenSpec planning format — create an OpenSpec change folder and have the architect fill proposal, design (with open questions), spec deltas (acceptance scenarios) and tasks, then validate. Used by /deliver when the project's planning format is openspec or the owner says "use openspec".
---

# OpenSpec plan

Replaces only Step 1 of `/deliver`; Steps 2–10 run unchanged. Read the openspec rule (`.claude/rules/golden/openspec/openspec.md`) first.

## Commands

From `.claude/golden.json` → `openspec`, else the defaults:

| Key | Default |
|---|---|
| `newChange` | `openspec new change <slug>` |
| `validate` | `openspec validate <slug>` |

A project with its own wrapper (e.g. one that also links a build-plan doc) sets these keys; use them verbatim.

## Steps

1. Pick the slug: lower-kebab `<verb>-<noun>` from the request.
2. Run `newChange`. It creates `openspec/changes/<slug>/`. Create `worklog.md` there from the core template.
3. Dispatch `core:architect` with: the request, mode, `planning: openspec`, the change folder path, and this mapping of plan sections to OpenSpec files:

   | Plan section | OpenSpec file |
   |---|---|
   | Goal | `proposal.md` → Why |
   | In scope | `proposal.md` → What Changes |
   | Out of scope (each `→ <destination>`) | `proposal.md` → `## Out of scope` |
   | Open questions (`- [ ] Q:` with options + recommendation) | `design.md` → `## Open questions` |
   | Acceptance criteria (tagged by tier) | `specs/<capability>/spec.md` → scenarios (WHEN/THEN) |
   | UI surface, risks | `design.md` |
   | Tasks (one commit each) | `tasks.md` |

   The architect fills every artifact, then runs `validate` once at the end — never between artifacts.
4. `validate` red → the architect fixes and re-runs until green. Never paper over a validator finding.
5. Commit the change folder (`docs(openspec): propose <slug>`) and continue `/deliver` at Step 2 (plan gate): the open questions are in `design.md`.
