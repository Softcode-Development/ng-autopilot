# Repo-side tooling

What sync writes into a project. Autopilot-owned files go under `tools/autopilot/` (protected: edited only by sync); project-owned entry files are created **once** and never overwritten — they import the autopilot parts and hold the project's additions.

| Source (autopilot repo) | Written to (project) | Owner |
|---|---|---|
| `angular/tooling/eslint/**` | `tools/autopilot/eslint/` (preset, autopilot plugin, rules) | autopilot |
| `angular/tooling/stylelint/preset.mjs` | `tools/autopilot/stylelint/preset.mjs` | autopilot |
| `angular/tooling/i18n/*` | `tools/autopilot/i18n/` | autopilot |
| `core/tooling/commitlint/autopilot-base.cjs` | `tools/autopilot/commitlint/autopilot-base.cjs` | autopilot |
| `openspec/tooling/tasks-gate.mjs` (openspec pack) | `tools/autopilot/openspec/tasks-gate.mjs` | autopilot |
| `nestjs/tooling/openapi.mjs` (nestjs pack) | `tools/autopilot/nestjs/openapi.mjs` | autopilot |
| `core/tooling/husky/*` | `.husky/pre-commit`, `commit-msg`, `pre-push` | autopilot (regenerated); project steps in `.husky/pre-commit.local` |
| — | `eslint.config.mjs` → `...autopilotAngular({ tsconfigRootDir: import.meta.dirname, ...autopilot.lint })` + project blocks | project |
| — | `stylelint.config.mjs` → `autopilotStylelint({ scss, tailwind, strictScope })` | project |
| — | `commitlint.config.cjs` → extends the autopilot base + `scope-enum` from the project's capability slugs (the project rules' Product section) | project |
| `core/tooling/lint-staged/lintstagedrc.json` | `.lintstagedrc.json` | project (created once) |
| `core/tooling/prettier/*` | `.prettierrc.json`, `.prettierignore` | project (created once) |
| `core/tooling/editorconfig` | `.editorconfig` | project (created once) |
| `core/tooling/gitleaks.toml` | `.gitleaks.toml` | project (created once) |

## Placeholders sync fills

| Placeholder | Value |
|---|---|
| `__EXEC__` | `npx --no-install` (npm) or `pnpm exec` (pnpm) |
| `__TYPECHECK__` | the incremental typecheck, e.g. `npx tsc -p tsconfig.app.json --noEmit --incremental` |
| `__PREPUSH__` | the final-gate command from `.claude/gates.md` |
| `__I18N_GLOB__` | the locale files glob from `autopilot.json` → `i18n.sets`; the line is dropped when the project has no i18n |

Pack steps are inserted between the `# >>> autopilot pack steps` markers: the openspec tasks gate (pre-commit + commit-msg), the nestjs OpenAPI regeneration (pre-commit).

## devDependencies the project needs

`eslint`, `angular-eslint`, `typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-security`, `eslint-plugin-unicorn`, `eslint-config-prettier`, `prettier`, `stylelint`, `stylelint-config-standard` (or `-scss`), `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`. The drift check lists the missing ones; installing them is part of the project's alignment change.
