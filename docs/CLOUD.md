# Cloud sessions (optional)

Running an autopilot project in a Claude Code cloud session (claude.ai/code, the desktop or mobile app, `claude --cloud`). Off by default; nothing here affects local work.

## Turn it on

In the project's `.claude/autopilot.json`:

```jsonc
{
  "cloud": true,
  // Only when a clean install needs flags (peer-range conflicts the project accepts):
  "commands": { "install": "npm ci --force" }
}
```

Then `/autopilot:sync`. With `cloud: false` (or no key), sync removes what it added.

## What sync installs

| File | What it does |
|---|---|
| `tools/autopilot/cloud/setup.sh` | The cloud environment's **Setup script**. Runs as root on Ubuntu 24.04 before Claude Code starts; the result is cached per environment. Installs Chrome (Chrome for Testing, from `storage.googleapis.com`) and its system libraries, and caches the Playwright MCP server. Works with the default **Trusted** network level. |
| `tools/autopilot/cloud/session-start.mjs` | Run on every session start by a SessionStart hook sync adds to `.claude/settings.json`. Does nothing outside the cloud (`CLAUDE_CODE_REMOTE` is not `true`). In the cloud: downloads the project's pinned Node (`.nvmrc`, `.node-version` or an exact `engines.node`; the image ships Node 20–22) and puts it on PATH, runs a clean install (`commands.install`, else `npm ci` / `pnpm install --frozen-lockfile`) when `package.json`, the lockfile or `.npmrc` changed, and sets `CHROME_BIN`. Prints one summary line; the install log is `.claude/tmp/cloud-session-start.log`. |

## The owner's steps, once per environment

1. At claude.ai/code, add or edit the project's environment → **Setup script** → **Choose file** → `tools/autopilot/cloud/setup.sh`.
2. For a signed-in visual gate: agents sign in with the accounts file `.claude/gates.md` names, but that file is git-ignored, so a clone doesn't have it. Put a saved session — the content of `.claude/browser/storage-state.json` from a local run, or its base64 — into the environment variable `AUTOPILOT_BROWSER_STORAGE_STATE`; the browser launcher writes it to the file at start. It expires like any login; without a working one, the visual gate stops and asks the owner.

## What a cloud session does and doesn't have

A cloud session clones the repo and loads only what the repo holds:

| Loads | Doesn't load |
|---|---|
| `CLAUDE.md`, `.claude/rules/` (autopilot and project rules) | **Plugins** — not the ones in `~/.claude`, not the ones `.claude/settings.json` enables (`enabledPlugins`, `extraKnownMarketplaces`) |
| `.claude/agents/`, `.claude/skills/` committed to the repo | Anything in `~/.claude` (personal skills, agents, settings, memory) |
| Hooks and permissions in `.claude/settings.json` | `.claude/settings.local.json` |
| `.mcp.json` servers (the `playwright` browser) | |

So with the packs installed as plugins (the current setup), a cloud session has the autopilot **rules** but not its **agents, skills or hooks**: no `/deliver`, no reviewers, no test agents, no guard hooks. The external plugins the workflow calls (`superpowers`, `frontend-design`, `design`) are missing too. `/autopilot:sync`, `doctor` and `install` need the autopilot repo on disk and run locally only.

**Open decision:** to run the full workflow in the cloud, the packs' agents, skills and hooks would have to live in the project repo (synced copies) instead of only in the plugins. Not decided yet; until then, a cloud session suits work that needs the rules and the project's tooling but not the autopilot agents.

## Status

The scripts are unit-tested and the session-start flow was exercised against a throwaway project, but neither has run in a real cloud session yet. On the first one, check the summary line the session prints, `node_modules/.autopilot-install.sha256`, and `npm run test:ci` (browser specs).

Pinned versions to bump now and then: Chrome for Testing (`CHROME_PINNED` in `setup.sh`) and Playwright / Playwright MCP (`BROWSER_VERSIONS` in `bin/lib/render.mjs`).
