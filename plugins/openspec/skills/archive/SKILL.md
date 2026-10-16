---
name: archive
description: Step 10 of the autopilot workflow in the OpenSpec planning format — archive a finished change, promote its spec deltas into openspec/specs/, have the doc-writer polish the promoted specs and write an ADR when a durable decision was made. Used by /deliver at close when planning is openspec, or on "archive the change".
---

# OpenSpec archive

## Pre-flight

- The change's tasks are all ticked and the final gate is green.
- The owner has approved closing (PR merged, or the owner says archive now).

## Commands

From `.claude/autopilot.json` → `openspec.archive`, else `openspec archive <slug> --yes`.

## Flag protocol

`openspec/specs/**` is a protected path (`autopilot.json` → `protectedPaths`, flag `openspec-archive`). This skill is the only flow that sets the flag.

- Before the first write: `mkdir -p .claude/.flags && touch .claude/.flags/openspec-archive`.
- After the commit: `rm -f .claude/.flags/openspec-archive`.
- On any abort: remove the flag first. A stale flag leaves the specs unprotected.

## Steps

1. Run the archive command. It validates, moves the change to `openspec/changes/archive/<date>-<slug>/`, and promotes the spec deltas into `openspec/specs/<capability>/spec.md`.
2. Set the flag; dispatch `autopilot-openspec:doc-writer` with the archived folder path.
3. Commit `docs(openspec): archive <slug>`; remove the flag.
4. A project hook may run after this (e.g. moving a linked build-plan doc) — the project's own skill handles that.

## Refuse

- Archive command exits non-zero → stop, show its output.
- Unticked tasks → list them, stop.
