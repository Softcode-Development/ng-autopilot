---
paths:
  - "**/*.html"
  - "**/*.scss"
  - "**/*.css"
  - "**/*.component.ts"
---

# PrimeNG

Library-specific half of the design discipline; the project's `docs/DESIGN_SYSTEM.md` holds the catalog and theme preset.

- **Upstream catalog:** the docs for the installed PrimeNG major are the audit authority for "does a primitive exist" — `https://v{major}.primeng.org/llms/llms.txt` (index) and `https://v{major}.primeng.org/llms/components/{component}.md` (full page with examples; readable by fetch tools, unlike the client-rendered site `https://v{major}.primeng.org`), and the PrimeNG MCP server. `primeng.org` shows the latest major — its components and APIs may not exist in the installed one.
- **Theme package licence:** `@primeuix/themes` 3.x is commercial. Pin `@primeuix/themes` below 3.0 (and PrimeNG to the matching free line). `@primeng/themes` is deprecated. — **Enforcement:** static check on `package.json`.
- **Theme preset:** `src/app/core/theme/app-preset.ts` — small overrides on Aura with `definePreset`, so new tokens arrive with every `@primeuix/themes` update. A preset made with the PrimeNG Theme Designer or from Figma lives in `src/app/core/theme/generated/`, is never edited by hand, replaces Aura as `definePreset`'s base, and is migrated with the Designer's Migration Assistant on each PrimeNG major. Keep a token's structure when overriding it: a token Aura defines per colour scheme is overridden per colour scheme, or the override is ignored.
- **Project tokens:** lowercase dot names under `app` in the preset's `extend` (`app.income.color` → `--p-app-income-color`), each with a light and a dark value, exposed to Tailwind in `src/styles/tailwind.css`. The same names work as Theme Designer / Figma `custom` tokens.
- **Providers once:** the preset, dark-mode selector and CSS-layer choice live in `PRIMENG_PROVIDERS` (`src/app/core/theme/primeng.providers.ts`), registered in `app.config.ts`.
- **Utilities:** Tailwind v4 + `tailwindcss-primeui` (`src/styles/tailwind.css`) for layout, spacing, typography and the preset's colours. No PrimeFlex — unmaintained, superseded by the plugin.
- **One instance styled differently:** its `dt` input (scoped tokens) or `pt` (pass-through classes) — never `::ng-deep` or `.p-*` overrides.
- **CSS layers with Tailwind (modern setup):** `cssLayer: { name: 'primeng', order: 'theme, base, primeng' }` — PrimeNG sits after Tailwind's theme and base and before its utilities, so utility classes win over component styles.
- **CSS layers next to legacy CSS (legacy setup, `design.legacyCss`):** when the app still ships unlayered legacy CSS (Bootstrap, Material, Nebular), do **not** put PrimeNG in a CSS layer (`cssLayer: false`) — any unlayered rule beats a layered one, so PrimeNG loses even to a bare `button` reset. Unlayered, its `.p-*` class selectors outrank legacy element selectors. Tailwind runs without its base reset and with the `tw:` class prefix (`tw:flex`), scanning only the strict-scope folders, so legacy pages and legacy class names are untouched; a PrimeNG part is styled through `pt` / `dt`, since a layered utility cannot beat unlayered PrimeNG.
- **Global CSS:** don't target bare elements without `:not(.p-component)` when the rule would also hit PrimeNG (e.g. focus-outline removals must keep PrimeNG's focus ring).
- **Styling:** customise through the theme preset's design tokens and pass-through (`pt`) options, not by overriding `.p-*` internals in component SCSS (design-discipline § Styling).
