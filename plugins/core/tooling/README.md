# Repo-side tooling

What sync writes into a project. Autopilot-owned files go under `tools/autopilot/` (protected: edited only by sync); project-owned entry files are created **once** and never overwritten — they import the autopilot parts and hold the project's additions.

| Source (autopilot repo) | Written to (project) | Owner |
|---|---|---|
| `angular/tooling/eslint/**` | `tools/autopilot/eslint/` (preset, autopilot plugin, rules) | autopilot |
| `angular/tooling/stylelint/preset.mjs` | `tools/autopilot/stylelint/preset.mjs` | autopilot |
| `angular/tooling/i18n/*` | `tools/autopilot/i18n/` | autopilot |
| `core/tooling/commitlint/autopilot-base.cjs` | `tools/autopilot/commitlint/autopilot-base.cjs` | autopilot |
| `core/tooling/lint-staged/preset.mjs` | `tools/autopilot/lint-staged/preset.mjs` (linters + Prettier on staged files inside `lint.strictScope` and the testing toolkit only; locale validation on the `i18n.sets` files) | autopilot |
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

With the primeng pack's design-system starter (`design.starter`), the project also needs `tailwindcss`, `@tailwindcss/postcss` and `tailwindcss-primeui` (devDependencies) and `@primeuix/themes`, `@fontsource-variable/inter` and `primeicons` (dependencies); sync prints one install command for each kind.

The import rules use `eslint-plugin-import-x` (registered under the `import/` rule prefix): the original `eslint-plugin-import` does not accept eslint 10. The presets are tested against angular-eslint 21 and 22 with eslint 10.
