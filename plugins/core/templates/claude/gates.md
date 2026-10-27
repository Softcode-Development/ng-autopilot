# Gates — <project>

Project configuration for the workflow's gates. The `/deliver` driver reads this file; keep commands exact and copy-pasteable.

Every gate command is a `package.json` script run with the package manager (`npm run …`), so it is allowlisted and runs the same for every agent. A gate that is a shell script (`bash tools/check.sh`) gets a script wrapper (`"gate:check": "bash tools/check.sh"`) and is listed here as `npm run gate:check`.

## Commands

| Gate | Command | Notes |
|---|---|---|
| Affected / existing tests (suite) | `<e.g. npm run test:ci>` | runs the existing specs of **every** tier, paused ones included. Env vars it needs (e.g. `CHROME_BIN`). Per-spec commands for the test authors live in `.claude/{tier}-testing/overrides.md`. |
| Lint | `<command or "none">` | |
| Typecheck | `<command>` | |
| Final gate | `<one command running lint + typecheck + tests (+ build)>` | |
| Build required in final gate | yes / no | why. Builds go to the project's normal output folder, never to temp. |

Gate output (logs, reports, screenshots) goes to `.claude/tmp/` (git-ignored), never elsewhere on disk.

## Smoke map

| Touched paths | Command | Pass criterion |
|---|---|---|
| `src/**` | `<dev server command, e.g. npm run start>` (reuse the server listening on `<port>` — `node tools/autopilot/server/listening.mjs <port>`; never start a second one) | compiles; touched route renders without console errors |

Paths matching no row: record `smoke: n/a ({paths})`.

## Dev servers

- Started only with the project's `npm run start…` scripts, as a background task of the session. A server the owner started or asked for is the owner's: agents never stop or restart it.
- A server that must outlive the session: `<none | npm run start:detached — a cross-platform node launcher script in the repo (e.g. tools/dev-server.mjs) that spawns the server detached and writes its pid to .claude/tmp/>`. Never `cmd //c start … /k` (Git Bash mangles it) or other OS windows.

## Visual gate

- **Dev server:** `<command>` on `<port>` (per market/tenant: …).
- **Browser:** the Playwright MCP server `playwright` (headless Chrome, `tools/autopilot/browser/mcp.mjs`). **Sign-in:** the agent signs in through `<login route>` with a dev/test account from `<path to a git-ignored *.local.md file — never the values>` and saves the session to `.claude/browser/storage-state.json`.
- **Widths:** 1280 and 375 (`browser_resize`). **Themes:** <light, dark | light only> (`browser_emulate_media`, or the app's theme switch).
- **Start points:** <routes worth checking for most changes>.
- **Loading states:** the API pattern to hold pending for the loading-vs-loaded comparison: <e.g. `**/api/**`> (`page.route` through `browser_run_code_unsafe`, never fulfilled).

## Security triggers

Paths that add `security-reviewer` to Step 7 in any mode:
- `<auth/ interceptor / guards paths>`
- `package.json`, lockfile
- `<env / config files>`

## Versioning

- Bump the app version per change: yes / no. Where: `<package.json version | other>`.
