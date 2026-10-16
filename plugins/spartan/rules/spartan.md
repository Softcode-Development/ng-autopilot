---
paths:
  - "**/*.html"
  - "**/*.scss"
  - "**/*.css"
  - "**/*.component.ts"
  - "**/shared/ui/**"
---

# spartan/ng + Tailwind

Library-specific half of the design discipline; the project rules' Design system section holds the catalog ("Available now" / "Add when needed") and its token names.

- **Two layers:** `@spartan-ng/brain` (`brn-*`) — headless, a11y-correct primitives; helm (`hlm-*`) — Tailwind-styled wrappers generated into the shared UI library. Every interactive element uses a `brn-*`/`hlm-*` pair.
- **Upstream catalog:** https://www.spartan.ng/components is the audit authority. `ls node_modules/@spartan-ng/brain/` undersells it (brain is a strict subset of the helm catalog), and so does listing the local generated folder.
- **Adding a primitive:** `nx generate @spartan-ng/cli:ui <name>` (or `spartan-ng add <name>`). The generator wires the path alias and may pull peer deps (`@ng-icons/lucide`, `tw-animate-css`); pin each new dependency to an exact version.
- **Generator quirk:** the CLI emits a broken `@nx/enforce-module-boundaries` IIFE in the per-primitive `eslint.config.mjs` (it returns `undefined` and breaks config validation). Delete that key; the rule inherits from the base config spread.
- **Tokens:** CSS custom properties consumed through Tailwind utilities (`bg-background`, `text-foreground`, `rounded-lg`) that resolve to `var(--token)` at runtime. Project-specific tokens use a project prefix namespace with `*-foreground` pairs.
- **Dark mode:** Tailwind class strategy (`dark` on `<html>`).
- **Icons:** Lucide via `@ng-icons/lucide` and the `hlm-icon` wrapper.
- **Motion:** spartan primitive animations already respect duration tokens and reduced motion; custom animation uses `motion-safe:`.
- **Forms:** `hlm-form-field` + `hlm-input` + `hlm-label` + `hlm-error-message`.
