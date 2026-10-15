---
paths:
  - "**/*.ts"
  - "**/README.md"
  - "docs/adr/**"
---

# Code documentation

Comments in code follow `readable-code` (why, not what; none by default). Project docs follow `ai-first-docs`. This rule covers the rest.

- **JSDoc** only on public APIs of a library or shared package, and on non-obvious contracts (cache, SSR/hydration, cross-boundary behaviour). One short line; no multi-paragraph blocks; never a restatement of the type.
- **Workarounds** for upstream bugs link the issue and name the trigger condition.
- **App/package README:** purpose and scope, local setup, the scripts and what they do, required environment variables (names and shapes — never values), build/deploy notes specific to it. Link to deeper docs instead of copying them.
- **ADRs** in `docs/adr/NNNN-<slug>.md` for durable, non-obvious decisions only: title, status (proposed / accepted / superseded), context, decision, consequences.
- **Commits** drive the changelog: a breaking change carries `BREAKING CHANGE:` in the footer.
- Docs change in the same commit as the code they describe.
