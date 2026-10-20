# Project `.claude/` templates

Sync writes these into a project:

| Template | Written to | Notes |
|---|---|---|
| `settings.json` | `.claude/settings.json` | Merged, not overwritten: project-specific allow/ask/deny entries are kept; autopilot entries are added, and an autopilot entry that moved tier is removed from its old one. Lists both npm and pnpm forms; sync drops the unused package manager. |
| `gitignore` | `.claude/.gitignore` | Ignores flags, review reports, local notes and `.claude/tmp/` — the run output agents write (gate output, screenshots, logs), so nothing lands elsewhere on disk. |

## Why the permission lists look like this

- **allow** — read/search, edits **inside the project only** (`Edit(./**)`, `Write(./**)` — a write anywhere else on disk asks), read-only shell (`ls`, `cat`, `head`, `tail`, `grep`, `wc`, `date`), removing a flow's flag file, the project's own scripts, read-only git, staging and committing, pushing a feature branch, and creating, editing and commenting on PRs (owner decision: agents push and open PRs without asking; the merge is the owner's stop).
- **ask** — anything that installs, lands on a trunk or rewrites history: installs, merge/rebase/reset, PR merge, `curl`/`wget` (the smoke gate and API checks need them, so they are not denied). An `ask` rule prompts even in auto mode, so the list holds only what deserves a prompt every time: `rm` and `git checkout` are not on it — they prompted on harmless repo-relative operations, and `guard-bash` refuses their destructive forms (absolute or `..` paths, bare `*`, `checkout .`). Branches are switched with `git switch` (allowed). Sync removes the retired entries (bare `Edit`/`Write`, `Bash(rm:*)`, `Bash(git checkout:*)`) from projects synced before.
- **deny** — never from an agent session: pushes to a trunk (`main`, `master`, `production`), force pushes, `reset --hard`, `git clean`, `--no-verify`, package publish, reading env/secret/key files. `.env.example`-style files are not denied.

The settings deny list matches command **prefixes** only. The core `guard-bash` hook closes the side channels the list cannot see: secret reads through `cat`/`grep`, force pushes spelled `+branch`, pushes that land on a trunk in a form the prefixes miss (`HEAD:main`, `refs/heads/main`, a bare `git push` while on `main`), redirect writes into protected paths. It also refuses what the tool-discipline rule forbids and a prompt would otherwise catch: in-place edit scripts (`sed -i`, `perl -i`), shell launchers and detached windows (`powershell`, `cmd /c start`, `Start-Process`), killing processes by name (`taskkill /IM`, `pkill`, `killall`, `Stop-Process -Name`), and `rm` paths that climb out with `..`.

Do not add `Bash(rm -rf *:*)`: its `*` matches every `rm -rf`, including repo-relative cleanups the hook deliberately allows.

## `.claude/autopilot.json` (written by sync)

```json
{
  "packs": ["core", "angular", "testing", "primeng"],
  "planning": "plan-file",
  "testTiers": ["unit", "e2e"],
  "testing": {
    "unit": { "enabled": true },
    "integration": { "enabled": true },
    "e2e": { "enabled": false },
    "phase": "orchestrated"
  },
  "limits": { "parallelTestAgents": 3 },
  "sourceGlobs": ["src/**"],
  "lint": {
    "strictScope": ["src/app/features/**"],
    "selectorPrefix": "app",
    "translatePipes": ["translate"],
    "testingToolkit": "src/testing",
    "testingToolkitImports": ["@app/testing"]
  },
  "i18n": {
    "sets": [{ "source": "src/assets/i18n/lt.json", "locales": ["src/assets/i18n/en.json"] }],
    "ignoreUnusedPrefixes": []
  },
  "protectedBranches": ["release"],
  "protectedPaths": [
    { "glob": "prisma/schema.prisma", "flag": "db-migrator-active", "reason": "owned by the db-migrator agent" }
  ]
}
```

`sourceGlobs` is what counts as application code for the `plan-ready` hook and the openspec tasks gate (default `src/**`, `apps/**`, `libs/**`, `projects/**`).

`lint.strictScope` is where every autopilot lint rule applies as an error, with no carve-outs (default `["src/**"]`). A legacy repo migrating step by step sets its modern folders here (e.g. `["src/app/features/**"]`) — chosen at install time, widened as code moves in. With a narrowed scope, staged templates outside it go through the hardcoded-text ratchet (their untranslated text may shrink, never grow); `lint.legacyHardcodedTextRatchet: false` turns it off. The other `lint` keys feed the ESLint preset: component/directive selector prefix, translation pipe names, test-only toolkit import paths, the i18n allowlist file, extra template call exceptions.

`i18n.sets` drives the i18n gates: each set is a source locale file and the locales that must mirror it.

`nestjs.openapi` (nestjs pack) configures the OpenAPI snapshot lint and regeneration hook — see the pack's `tooling/openapi.mjs`.

`testTiers` lists the test tiers the project has (`unit`, `integration`, `e2e`). Sync creates `.claude/{tier}-testing/overrides.md` and `backlog.md` from the testing pack's templates for each one; the architect tags acceptance criteria only with these tiers; `/deliver` Step 5 runs only them.

`testing.<tier>.enabled` (default `true`, one switch per tier) pauses a tier when `false`: no new specs or cases at it — the architect defers criteria that need it to a hand-off (`.claude/plans/handoff/`), `/deliver` dispatches no test agents for it, and the reviewers flag a new spec at it instead of a missing one; the implementer keeps the tier's existing specs in step with the files it edits, in the same commit; existing specs of every tier still run in the checkpoint and final gate. Setting it back to `true` restores the full flow with no other change. Doctor notes paused tiers. `testing.phase` is `orchestrated` (default — the orchestrator's sequential author → reviewer → fix per subject) or `single-review` (shared helpers, then parallel authors split by area, one review pass, one fix pass).

`limits.parallelTestAgents` (default 3) caps how many test agents run at once; at most one heavy test runner (browser or app boot) runs at any moment regardless.

`design` (primeng or spartan pack) sets up the default design system: `starter` (sync creates the preset, providers, theme service, `src/styles/tailwind.css` and `.postcssrc.json` once, and `docs/DESIGN_SYSTEM.md` comes pre-filled), `legacyCss` (no Tailwind base reset, `tw:` class prefix, PrimeNG unlayered — for apps that load Bootstrap / Material / Nebular CSS), `darkMode` (default `true`), `brands` (default `[]`; bare lowercase names, one override file each in `src/styles/brands/`, class `brand-<name>`). `stylelint.tailwind` defaults to `design.starter`. One UI library per project when the starter is on; `legacyLibraries` lists a UI library kept only for legacy screens after a switch (`["primeng"]`).

`lint.vendorGlobs` lists generated vendor code (spartan helm components): the strict lint, the stylesheet rule and the hardcoded-text ratchet skip it; TypeScript still compiles it.

`protectedBranches` adds trunks to the built-in `main`, `master` and `production`: `guard-bash` refuses any push that lands on one.

`protectedPaths` are guarded by `guard-paths` (Write/Edit) and `guard-bash` (shell redirects). `.claude/rules/autopilot/**` is always protected (flag `autopilot-sync`). A flow allowed to edit a protected path creates `.claude/.flags/{flag}` before its first write and removes it after its last.
