# Repo-side tooling

What sync writes into a project. Autopilot-owned files go under `tools/autopilot/` (protected: edited only by sync); project-owned entry files are created **once** and never overwritten — they import the autopilot parts and hold the project's additions.

| Source (autopilot repo) | Written to (project) | Owner |
|---|---|---|
| `angular/tooling/eslint/**` | `tools/autopilot/eslint/` (preset, autopilot plugin, rules) | autopilot |
| `angular/tooling/stylelint/preset.mjs` | `tools/autopilot/stylelint/preset.mjs` | autopilot |
| `angular/tooling/i18n/*` | `tools/autopilot/i18n/` | autopilot |
| `core/tooling/commitlint/autopilot-base.cjs` | `tools/autopilot/commitlint/autopilot-base.cjs` | autopilot |
| `core/tooling/lint-staged/preset.mjs` | `tools/autopilot/lint-staged/preset.mjs` (linters + Prettier on staged files inside `lint.strictScope` and the testing toolkit only; locale validation on the `i18n.sets` files) | autopilot |
| `core/tooling/server/listening.mjs` | `tools/autopilot/server/listening.mjs` — `node tools/autopilot/server/listening.mjs <port \| url>`: does a dev server already answer? Agents reuse a listening server instead of asking the owner or starting a second one | autopilot |
| `core/tooling/cloud/setup.sh` (`cloud: true`, see [docs/CLOUD.md](../../../docs/CLOUD.md)) | `tools/autopilot/cloud/setup.sh` — the cloud environment's Setup script (the owner uploads it at claude.ai/code): Chrome for Testing and its system libraries, cached per environment | autopilot |
| `core/tooling/cloud/session-start.mjs` (`cloud: true`) | `tools/autopilot/cloud/session-start.mjs` — run by the SessionStart hook sync merges into `.claude/settings.json`; in a cloud session only: the project's pinned Node on PATH, a clean install when the manifest or lockfile changed, `CHROME_BIN` | autopilot |
| `core/tooling/browser/mcp.mjs` | `tools/autopilot/browser/mcp.mjs` — the agents' browser: starts `@playwright/mcp` (pinned) headless on the installed Chrome/Edge (`CHROME_BIN` first), isolated, starting from the saved session in `.claude/browser/storage-state.json` (agents sign in with the project's dev/test accounts and save it); output in `.claude/tmp/browser/`. Registered as MCP server `playwright` in `.mcp.json` (merged: the project's other servers stay) and approved in `.claude/settings.json` | autopilot |
| `core/tooling/browser/sign-in.mjs` | `tools/autopilot/browser/sign-in.mjs` — `node tools/autopilot/browser/sign-in.mjs <url>...`: optional, for an account agents can't sign in with (SSO, 2FA) — the owner signs in in a Chrome window; saved to `.claude/browser/storage-state.json` (git-ignored, survives cleanup). Cloud: the same JSON in the environment variable `AUTOPILOT_BROWSER_STORAGE_STATE` | autopilot |
| `openspec/tooling/tasks-gate.mjs` (openspec pack) | `tools/autopilot/openspec/tasks-gate.mjs` | autopilot |
| `nestjs/tooling/openapi.mjs` (nestjs pack) | `tools/autopilot/nestjs/openapi.mjs` | autopilot |
| `core/tooling/husky/*` | `.husky/pre-commit`, `commit-msg`, `pre-push` | autopilot (regenerated); project steps in `.husky/pre-commit.local` |
| — | `eslint.config.mjs` → `...autopilotAngular({ tsconfigRootDir: import.meta.dirname, ...autopilot.lint })` + project blocks | project |
| — | `stylelint.config.mjs` → `autopilotStylelint({ scss, tailwind, strictScope })` | project |
| — | `commitlint.config.cjs` → extends the autopilot base + `scope-enum` from the project's capability slugs (`docs/FEATURES.md`) | project |
| — | `.lintstagedrc.mjs` → `...autopilotLintStaged(autopilot)` + project entries | project |
| `testing/templates/toolkit/README.md` (testing pack) | `<lint.testingToolkit>/README.md` (default `src/testing/`) — the shared test-helper folder, created with its index table | project (created once) |
| `core/tooling/prettier/*` | `.prettierrc.json`, `.prettierignore` | project (created once) |
| `core/tooling/editorconfig` | `.editorconfig` | project (created once) |
| `core/tooling/gitleaks.toml` | `.gitleaks.toml` | project (created once) |

## Placeholders sync fills

| Placeholder | Value |
|---|---|
| `__EXEC__` | `npx --no-install` (npm) or `pnpm exec` (pnpm) |
| `__TYPECHECK__` | the incremental typecheck, e.g. `npx tsc -p tsconfig.app.json --noEmit --incremental` |
| `__PREPUSH__` | the final-gate command from `.claude/gates.md` |

Pack steps are inserted between the `# >>> autopilot pack steps` markers: the openspec tasks gate (pre-commit + commit-msg), the nestjs OpenAPI regeneration (pre-commit).

## devDependencies the project needs

`eslint`, `angular-eslint`, `typescript-eslint`, `eslint-plugin-import-x`, `eslint-plugin-security`, `eslint-plugin-unicorn`, `eslint-config-prettier`, `prettier`, `stylelint`, `stylelint-config-standard` (or `-scss`), `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`. The drift check lists the missing ones; sync prints the install command; installing them is part of the project's alignment change.

**Modern and compatible, never pinned.** Nothing is held at a fixed version; each package gets the newest version that fits the project:

- `angular-eslint` — the project's `@angular/core` major (`angular-eslint@21` for Angular 21); its rules follow that Angular version.
- `eslint` — the newest major that angular-eslint version accepts as a peer (an installed eslint is kept).
- Packages that peer on eslint (`typescript-eslint`, the eslint plugins, `eslint-config-prettier`) — their latest when it accepts that eslint major, else their newest major that does.
- Everything else — latest.
- **One deliberate hold:** `@primeuix/themes@2` (primeng pack with the design-system starter) — 3.x carries its own licence; 2.x is MIT and is what PrimeNG 21 styles against.

With the spartan pack's starter the project needs `@spartan-ng/brain`, `@angular/cdk`, `@ng-icons/core`, `@ng-icons/lucide`, `class-variance-authority`, `clsx`, `tailwind-merge` (dependencies) and `@spartan-ng/cli`, `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css` (devDependencies). `@spartan-ng/brain`, `@angular/cdk` and `@ng-icons/core` take the newest major whose `@angular/core` peer accepts the project's Angular major; `@spartan-ng/cli` follows brain and `@ng-icons/lucide` follows `@ng-icons/core`.

With the primeng pack's design-system starter (`design.starter`), the project also needs `tailwindcss`, `@tailwindcss/postcss` and `tailwindcss-primeui` (devDependencies) and `@primeuix/themes`, `@fontsource-variable/inter` and `primeicons` (dependencies); sync prints one install command for each kind.

The import rules use `eslint-plugin-import-x` (registered under the `import/` rule prefix): the original `eslint-plugin-import` does not accept eslint 10. The presets are tested against angular-eslint 21 and 22 with eslint 10.
