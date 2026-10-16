# openspec pack

The OpenSpec planning format. Installed in every frontend project; `planning` in `.claude/autopilot.json` decides whether it is the project's default:

```json
{
  "packs": ["core", "angular", "testing", "openspec"],
  "planning": "openspec",
  "openspec": {
    "newChange": "openspec new change <slug>",
    "validate": "openspec validate <slug>",
    "archive": "openspec archive <slug> --yes"
  }
}
```

- **`planning: "plan-file"`** (default) — changes are planned in `.claude/plans/`; a single change can still use OpenSpec when the owner says so.
- **`planning: "openspec"`** — every balanced/strict change is an OpenSpec change, and sync activates the git gate: a commit touching source must tick a task in the one active change and carry `Change: <slug>`.

With the pack installed, the hooks also protect `openspec/specs/**` (only the archive flow edits it, flag `openspec-archive`) and require out-of-scope destinations in `openspec/changes/*/proposal.md`. The `openspec` command keys are optional; set them when the project wraps the CLI.

| Piece | Role |
|---|---|
| `skills/plan` | Workflow Step 1 in OpenSpec form |
| `skills/archive` | Workflow Step 10 in OpenSpec form |
| `agents/doc-writer` | Polishes promoted specs; ADRs |
| `rules/openspec.md` | Synced into `.claude/rules/autopilot/openspec/`; loads when OpenSpec files are opened |
| `tooling/tasks-gate.mjs` | The git gate; copied to `tools/autopilot/openspec/`, wired into the hooks only when `planning` is `openspec` |
