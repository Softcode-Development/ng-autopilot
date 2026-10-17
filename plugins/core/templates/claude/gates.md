# Gates — <project>

Project configuration for the workflow's gates. The `/deliver` driver reads this file; keep commands exact and copy-pasteable.

## Commands

| Gate | Command | Notes |
|---|---|---|
| Affected / existing tests (suite) | `<e.g. npm run test:ci>` | env vars it needs (e.g. `CHROME_BIN`). Per-spec commands for the test authors live in `.claude/{tier}-testing/overrides.md`. |
| Lint | `<command or "none">` | |
| Typecheck | `<command>` | |
| Final gate | `<one command running lint + typecheck + tests (+ build)>` | |
| Build required in final gate | yes / no | why |

## Smoke map

| Touched paths | Command | Pass criterion |
|---|---|---|
| `src/**` | `<dev server command>` (reuse the running server on `<port>`; never start a second one) | compiles; touched route renders without console errors |

Paths matching no row: record `smoke: n/a ({paths})`.

## Visual gate

- **Dev server:** `<command>` on `<port>` (per market/tenant: …).
- **Accounts:** `<path to a *.local.md file — never the values>`.
- **Widths:** 1280 and 375. **Themes:** <light, dark | light only>.
- **Start points:** <routes worth checking for most changes>.

## Security triggers

Paths that add `security-reviewer` to Step 7 in any mode:
- `<auth/ interceptor / guards paths>`
- `package.json`, lockfile
- `<env / config files>`

## Versioning

- Bump the app version per change: yes / no. Where: `<package.json version | other>`.
