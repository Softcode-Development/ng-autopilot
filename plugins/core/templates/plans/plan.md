---
slug: <kebab-slug>
title: <Title>
mode: balanced
planning: plan-file
status: draft
branch: <feat|fix|chore>/<kebab-slug>
created: <YYYY-MM-DD>
---

# <Title>

## Goal

<The outcome in one to three sentences, in the owner's words where possible.>

## In scope

- <Item — each one ends up with a code path.>

## Out of scope

- <Item> → <destination: plan slug, "backlog: <item>", or "not doing: <reason>">

## Open questions

- [ ] Q: <question> — options: (a) … (b) … — recommend (a) because …

## Acceptance criteria

- [unit] WHEN <condition> THEN <observable result>
- [e2e] WHEN <user action> THEN <what the user sees>

## UI surface

| Route | States | Notes |
|---|---|---|
| `/path` | empty, loading, error, filled | |

## Tasks

- [ ] 1. <Slice — one commit>

## Risks / notes

<Optional in balanced; required in strict.>
