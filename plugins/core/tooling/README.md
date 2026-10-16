# Repo-side tooling

What sync writes into a project. Golden-owned files go under `tools/golden/` (protected: edited only by sync); project-owned entry files are created **once** and never overwritten — they import the golden parts and hold the project's additions.

| Source (golden repo) | Written to (project) | Owner |
|---|---|---|
| `angular/tooling/eslint/**` | `tools/golden/eslint/` (preset, golden plugin, rules) | golden |
| `angular/tooling/stylelint/preset.mjs` | `tools/golden/stylelint/preset.mjs` | golden |
| `angular/tooling/i18n/*` | `tools/golden/i18n/` | golden |
| `core/tooling/commitlint/golden-base.cjs` | `tools/golden/commitlint/golden-base.cjs` | golden |
| `openspec/tooling/tasks-gate.mjs` (openspec pack) | `tools/golden/openspec/tasks-gate.mjs` | golden |
| `nestjs/tooling/openapi.mjs` (nestjs pack) | `tools/golden/nestjs/openapi.mjs` | golden |
| `core/tooling/husky/*` | `.husky/pre-commit`, `commit-msg`, `pre-push` | golden (regenerated); project steps in `.husky/pre-commit.local` |
| — | `eslint.config.mjs` → `...goldenAngular({ tsconfigRootDir: import.meta.dirname, ...golden.lint })` + project blocks | project |
| — | `stylelint.config.mjs` → `goldenStylelint({ scss, tailwind, strictScope })` | project |
| — | `commitlint.config.cjs` → extends the golden base + `scope-enum` from the project's capability slugs (the project rules' Product section) | project |
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
| `__I18N_GLOB__` | the locale files glob from `golden.json` → `i18n.sets`; the line is dropped when the project has no i18n |

Pack steps are inserted between the `# >>> golden pack steps` markers: the openspec tasks gate (pre-commit + commit-msg), the nestjs OpenAPI regeneration (pre-commit).

## devDependencies the project needs

`eslint`, `angular-eslint`, `typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-security`, `eslint-plugin-unicorn`, `eslint-config-prettier`, `prettier`, `stylelint`, `stylelint-config-standard` (or `-scss`), `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`. The drift check lists the missing ones; installing them is part of the project's alignment change.
