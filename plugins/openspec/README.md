# openspec pack

Opt-in planning format. Enable it in a project's `.claude/golden.json`:

```json
{
  "packs": ["core", "angular", "testing", "openspec"],
  "planning": "openspec",
  "openspec": {
    "newChange": "openspec new change <slug>",
    "validate": "openspec validate <slug>",
    "archive": "openspec archive <slug> --yes"
  },
  "protectedPaths": [
    { "glob": "openspec/specs/**", "flag": "openspec-archive", "reason": "promoted truth — only the archive flow edits it" }
  ],
  "outOfScopeDocs": ["openspec/changes/*/proposal.md"]
}
```

Sync writes the `protectedPaths` and `outOfScopeDocs` entries when the pack is enabled. The `openspec` command keys are optional; set them when the project wraps the CLI.

| Piece | Role |
|---|---|
| `skills/plan` | Workflow Step 1 in OpenSpec form |
| `skills/archive` | Workflow Step 10 in OpenSpec form |
| `agents/doc-writer` | Polishes promoted specs; ADRs |
| `rules/openspec.md` | Synced into `.claude/rules/golden/` |
| git hooks (tasks tick, `Change:` line, bypass trailer) | Repo-side tooling, built with the tooling batch |
