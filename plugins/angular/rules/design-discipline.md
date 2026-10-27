---
paths:
  - "**/*.html"
  - "**/*.scss"
  - "**/*.css"
  - "**/*.component.ts"
---

# Design discipline

The project's `docs/DESIGN_SYSTEM.md` is the UI law: its primitive library, catalog, tokens and layout rules win over anything here and over any design skill's suggestion. This rule is the library-independent part.

## Primitives first
Every interactive element (button, input, select, dialog, popover, menu, toast, tooltip, checkbox, radio, switch, …) comes from the project's primitive library. Raw `<button>`, `<input>`, `<select>`, `<ul role="listbox">`, hand-rolled focus traps and custom ARIA plumbing are forbidden in templates when a primitive exists.
- **Why:** library primitives are vetted for focus management, ARIA roles and keyboard handling, and they carry the tokens. Re-implementing them fragments UX and re-does accessibility from scratch.
- **Enforcement:** review; lint/template rules where the project adds them.
- **Custom is fine for feature composites** (a transaction row, a category chip) — they compose primitives internally instead of reinventing them. Plain semantic HTML (`<p>`, `<section>`, `<nav>`, headings, non-listbox `<ul>`) is fine; the rule covers interactive elements.

## Audit before hand-rolling
Before writing markup that looks like a primitive (spinner, progress bar, toast, skeleton, badge, breadcrumb, switch, accordion, …), assume the library has it and find it:
1. Check the library's **upstream component catalog** (docs site) — the authority.
2. Check the "Available now" catalog in the project's `docs/DESIGN_SYSTEM.md` — import it.
3. Check "Add when needed" — install/generate it now and pin new dependencies.
4. Only if upstream truly lacks it: hand-roll a component in the shared UI library (single use may stay inline; the second consumer lifts it).

**A `node_modules` listing or a listing of the local wrapper folder is not an audit** — both undersell what upstream offers.
- **Precedent:** a spinner was hand-rolled after a `node_modules` audit, then ripped out when the docs catalog showed the library had one all along.

## Styling
How a template gets its look; the project's `docs/DESIGN_SYSTEM.md` § 4.6 names the concrete classes.

| Concern | With | Never |
|---|---|---|
| Layout, spacing, sizing, typography, responsive behaviour | utility classes in the template (Tailwind) | component stylesheets |
| Colours, surfaces, borders | the UI library's token classes (PrimeNG: `tailwindcss-primeui` — `bg-primary`, `text-muted-color`, `border-surface`) | hex / `rgb()`, raw palette classes (`bg-blue-500`) |
| How a library component looks | the theme preset; for one instance, the library's scoped-token or pass-through inputs | overriding the library's internal classes, `::ng-deep` |
| A project colour | a token in the theme preset, exposed as a utility class | SCSS variables |

- **No component stylesheet by default** — `ng g c` is set to `style: none`. A stylesheet that must exist opens with `/* why: … */`.
  - **Why:** a stylesheet per component re-decides spacing and colour the tokens already decide, and drifts from them.
  - **Enforcement:** stylelint `autopilot/justified-stylesheet` on every stylesheet in `strictScope` (component styles with or without the `.component` suffix, other SCSS) except the app's global entry styles (`src/styles.*`, `src/styles/**`).

## Tokens
- Colors, spacing, type, radius and motion come from design tokens (CSS custom properties), so themes swap at runtime.
- **No raw hex/rgb literals** in component TS/HTML/SCSS. — **Enforcement:** stylelint `color-no-hex`, `color-named`, `function-disallowed-list` (rgb/hsl) on component styles.
- **No `!important`** to beat token or library styles — if you are fighting the design system, raise it instead. — **Enforcement:** stylelint `declaration-no-important`.
- **No `prefers-color-scheme` media queries inside components** — tokens carry both themes. — **Enforcement:** stylelint `media-feature-name-disallowed-list`.
- Accessibility basics in templates (alt text, label association, focusable interactive elements, …) — **Enforcement:** angular-eslint `templateAccessibility` rules.
- Custom classes (where utilities or primitives don't fit) use BEM-like names: `.feature-element__part--modifier`.

## Theme and dark mode (apps with more than one theme)
- **Default:** follow `prefers-color-scheme` until the user chooses.
- **Persistence:** the choice is `light | dark | system`, stored (e.g. `localStorage.theme`, synced to the user's settings when the app has them); an explicit choice overrides the OS.
- **No flash of the wrong theme:** an inline script in `index.html` applies the theme class before the bundle loads.
- **System mode follows the OS live:** listen to `matchMedia('(prefers-color-scheme: dark)')` changes while the setting is `system`.
- Tokens carry both themes — components never branch on the theme themselves.

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
- One icon set, named in the project's `docs/DESIGN_SYSTEM.md`. No inline SVG in templates except logos, charts and bespoke illustrations.

## Loading skeletons
A loading skeleton mirrors the loaded UI it stands in for:
- the same container and card;
- the same grid and columns;
- the same number of fields, rows or items — per variant when the counts differ (per locale, market, role, …);
- placeholder sizes close to the real ones (line heights, input heights, image boxes).

Build it **after the loaded UI is final, in the same change**, from the loaded template — not from a generic block of grey bars. Use the library's skeleton primitive. Exempt: inline action spinners (a button's pending state).
- **Why:** a skeleton that does not match the loaded layout makes the page jump when data arrives, which reads as a bug; one built before the UI settles drifts from it.
- **Enforcement:** the visual gate compares loading and loaded side by side; review (rubric F).

## Visual gate — every UI change
Before committing UI work, open each changed screen in the project's Playwright browser (MCP server `playwright`) and check it at **desktop and phone width (~360–375 px)**, in **light and dark** theme if the app has both, in every state the change touched (empty, loading, error, filled). Check against the project's `docs/DESIGN_SYSTEM.md`. A failure is fixed in the same scope before committing.
- **Why:** specs and unit tests can't see overflowing dialogs, missing spinners or dark-mode breakage.
- **Loading vs loaded:** capture the loading state and the loaded state at the same width, and compare them side by side: container, grid, item count, sizes. A mismatch is a failure. Hold the request **pending**, never failed (a failed request shows the error state, not the skeleton): `browser_run_code_unsafe` → `await page.route('<api pattern>', () => {})`, then navigate inside the app so only the page's own request waits; `await page.unrouteAll()` afterwards.
- **Phone width and theme:** `browser_resize` to 375×812; `browser_emulate_media` for the colour scheme (or the app's theme switch when it themes by a class). Never ask the owner to resize anything.
- Reuse the dev server that is already listening (`node tools/autopilot/server/listening.mjs <port>`); otherwise start it with `npm run start…` as a background task. Never start a second one; never stop or restart one you did not start.
- Read `browser_console_messages` on every screen; an error there is a failure.
- Screenshots go to `.claude/tmp/`, never elsewhere on disk: `browser_take_screenshot` without a `filename` saves to `.claude/tmp/browser/` (a `filename` is relative to the project root — only `.claude/tmp/browser/<name>.png`).
- The browser uses the owner's saved sign-in; agents never type credentials. Signed out → ask the owner to run `node tools/autopilot/browser/sign-in.mjs <url>`.
- The project's `.claude/gates.md` § Visual gate names the dev servers, accounts, widths and start points to check.

## Design skills
| Skill | When | Input |
|---|---|---|
| `frontend-design:frontend-design` | Before building a new or reshaped page, dialog, form or state | The project's `docs/DESIGN_SYSTEM.md` as the fixed brief |
| `design:ux-copy` | When adding or rewriting user-facing copy | The source-locale strings in context |
| `design:design-system` | Before adding a shared component or token; when review finds drift | The shared UI library + the project's `docs/DESIGN_SYSTEM.md` |
| `design:design-critique` | In the visual gate, every UI task | Screenshots + the project's `docs/DESIGN_SYSTEM.md` |
| `design:accessibility-review` | New or changed interactive surface (dialog, form, menu, keyboard flow) | The live screen; the minimums above are the floor |

Inside an app, the project's `docs/DESIGN_SYSTEM.md` **pins the visual direction**: the skills decide layout, hierarchy, states, spacing rhythm and copy — never a new palette, font or custom component where a primitive exists. Findings are triaged like review comments: fix in-scope ones, decline bad ones with a one-line reason, defer out-of-scope ones with a destination. If a skill's plugin is not installed, say so in the hand-back instead of skipping silently.
