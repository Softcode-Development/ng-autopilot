---
paths:
  - "**/*.html"
  - "**/*.scss"
  - "**/*.css"
  - "**/*.component.ts"
---

# Design discipline

The project rules' Design system section (`.claude/rules/project.md`) is the UI law: its primitive library, catalog, tokens and layout rules win over anything here and over any design skill's suggestion. This rule is the library-independent part.

## Primitives first
Every interactive element (button, input, select, dialog, popover, menu, toast, tooltip, checkbox, radio, switch, …) comes from the project's primitive library. Raw `<button>`, `<input>`, `<select>`, `<ul role="listbox">`, hand-rolled focus traps and custom ARIA plumbing are forbidden in templates when a primitive exists.
- **Why:** library primitives are vetted for focus management, ARIA roles and keyboard handling, and they carry the tokens. Re-implementing them fragments UX and re-does accessibility from scratch.
- **Enforcement:** review; lint/template rules where the project adds them.
- **Custom is fine for feature composites** (a transaction row, a category chip) — they compose primitives internally instead of reinventing them. Plain semantic HTML (`<p>`, `<section>`, `<nav>`, headings, non-listbox `<ul>`) is fine; the rule covers interactive elements.

## Audit before hand-rolling
Before writing markup that looks like a primitive (spinner, progress bar, toast, skeleton, badge, breadcrumb, switch, accordion, …), assume the library has it and find it:
1. Check the library's **upstream component catalog** (docs site) — the authority.
2. Check the "Available now" catalog in the project rules' Design system section — import it.
3. Check "Add when needed" — install/generate it now and pin new dependencies.
4. Only if upstream truly lacks it: hand-roll a component in the shared UI library (single use may stay inline; the second consumer lifts it).

**A `node_modules` listing or a listing of the local wrapper folder is not an audit** — both undersell what upstream offers.
- **Precedent:** a spinner was hand-rolled after a `node_modules` audit, then ripped out when the docs catalog showed the library had one all along.

## Tokens
- Colors, spacing, type, radius and motion come from design tokens (CSS custom properties), so themes swap at runtime.
- **No raw hex/rgb literals** in component TS/HTML/SCSS. — **Enforcement:** stylelint `color-no-hex`, `color-named`, `function-disallowed-list` (rgb/hsl) on component styles.
- **No `!important`** to beat token or library styles — if you are fighting the design system, raise it instead. — **Enforcement:** stylelint `declaration-no-important`.
- **No `prefers-color-scheme` media queries inside components** — tokens carry both themes. — **Enforcement:** stylelint `media-feature-name-disallowed-list`.
- Accessibility basics in templates (alt text, label association, focusable interactive elements, …) — **Enforcement:** angular-eslint `templateAccessibility` rules.
- Custom classes (where utilities or primitives don't fit) use BEM-like names: `.feature-element__part--modifier`.

## Accessibility minimums
- Every interactive element has an accessible name (`aria-label`, `aria-labelledby`, or visible text).
- Keyboard navigation works for every primary flow.
- Automated a11y checks (axe) show zero `serious`/`critical` violations on touched pages.
- `prefers-reduced-motion` is honoured: animations are conditional (`motion-safe:` or a media query). No unconditional animation.
- Library focus-visible styles are not overridden without a documented reason.
- Color contrast ≥ WCAG AA on every token pair.
- Toast regions use `aria-live="polite"`, never `assertive`.

## Motion and icons
- Durations and easings come from motion tokens (fast ≈ 100–150 ms micro-interactions, base ≈ 200 ms popovers/toasts, slow ≈ 300 ms dialogs/pages). Every animation has a functional purpose.
- One icon set, named in the project rules' Design system section. No inline SVG in templates except logos, charts and bespoke illustrations.

## Visual gate — every UI change
Before committing UI work, open each changed screen in the connected browser and check it at **desktop and phone width (~360–375 px)**, in **light and dark** theme if the app has both, in every state the change touched (empty, loading, error, filled). Check against the project rules' Design system section. A failure is fixed in the same scope before committing.
- **Why:** specs and unit tests can't see overflowing dialogs, missing spinners or dark-mode breakage.
- Use the dev server that is already running; never start a second one, never kill one you did not start.
- The project's visual-testing overrides name the URLs, accounts and states to check.

## Design skills
| Skill | When | Input |
|---|---|---|
| `frontend-design:frontend-design` | Before building a new or reshaped page, dialog, form or state | The project rules' Design system section as the fixed brief |
| `design:ux-copy` | When adding or rewriting user-facing copy | The source-locale strings in context |
| `design:design-system` | Before adding a shared component or token; when review finds drift | The shared UI library + the project rules' Design system section |
| `design:design-critique` | In the visual gate, every UI task | Screenshots + the project rules' Design system section |
| `design:accessibility-review` | New or changed interactive surface (dialog, form, menu, keyboard flow) | The live screen; the minimums above are the floor |

Inside an app, the project rules' Design system section **pins the visual direction**: the skills decide layout, hierarchy, states, spacing rhythm and copy — never a new palette, font or custom component where a primitive exists. Findings are triaged like review comments: fix in-scope ones, decline bad ones with a one-line reason, defer out-of-scope ones with a destination. If a skill's plugin is not installed, say so in the hand-back instead of skipping silently.
