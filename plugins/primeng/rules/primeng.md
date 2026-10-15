---
paths:
  - "**/*.html"
  - "**/*.scss"
  - "**/*.css"
  - "**/*.component.ts"
---

# PrimeNG

Library-specific half of the design discipline; the project's DESIGN_SYSTEM.md holds the catalog and theme preset.

- **Upstream catalog:** https://primeng.org (and the PrimeNG MCP server when configured) is the audit authority for "does a primitive exist".
- **Theme package licence:** `@primeuix/themes` 3.x is commercial. Pin `@primeuix/themes` below 3.0 (and PrimeNG to the matching free line). `@primeng/themes` is deprecated. — **Enforcement:** static check on `package.json`.
- **Providers once:** the preset, dark-mode selector and CSS-layer choice live in one provider constant registered in `app.config.ts`.
- **CSS layers next to legacy CSS:** when the app still ships unlayered legacy CSS (Bootstrap, Material, Nebular), do **not** put PrimeNG in a CSS layer — any unlayered rule beats a layered one, so PrimeNG loses even to a bare `button` reset. Unlayered, its `.p-*` class selectors outrank legacy element selectors.
- **Global CSS:** don't target bare elements without `:not(.p-component)` when the rule would also hit PrimeNG (e.g. focus-outline removals must keep PrimeNG's focus ring).
- **Styling:** customise through the theme preset's design tokens and pass-through (`pt`) options, not by overriding `.p-*` internals in component SCSS.
