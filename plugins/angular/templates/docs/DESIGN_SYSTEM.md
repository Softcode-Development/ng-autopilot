# Design system — rules + principles

> Read before any UI work. Pull requests are reviewed against this doc. This document **pins the visual direction**: design skills and agents decide layout, hierarchy, states and copy inside it, never a new palette, font or custom component where a primitive exists.

<!-- guide: library-independent rules (primitives-first, audit-before-hand-roll, a11y minimums, motion, visual gate, design-skill table) come from the autopilot design-discipline rule and the library pack (primeng / spartan / …). This file holds THIS project's catalog, tokens and layout decisions for new code — never a legacy design system. -->

---

## 1. Primitive library

The UI layer is **<library + version>** with **<styling approach>** ([TECH_STACK.md](TECH_STACK.md)). Every interactive element comes from it — autopilot rule `design-discipline` § Primitives first.

## 2. Catalog

Full import paths: <link to the shared UI library README>.

**Audit authority** for "does a primitive exist": <the library docs for the installed major — PrimeNG: `https://v{major}.primeng.org`, never `primeng.org`, which shows the latest major>.

**Available now**

| Category | Primitive | Import |
|---|---|---|
| Buttons | | |
| Inputs | | |
| Select | | |
| Dialog | | |
| Toast | | |
| Menu | | |
| Checkbox / Radio / Switch | | |
| Layout (card, separator, scroll area) | | |
| Feedback (badge, alert, spinner, skeleton) | | |
| Tooltip | | |
| Date picker | | |
| Table | | |
| Icons | | |

**Add when needed**

| Category | Primitive | First consumer |
|---|---|---|
| | | |

## 3. Custom composites

<Feature composites this project has, and what primitives each composes — examples agents can copy.>

## 4. Design tokens

Tokens are CSS variables, so themes swap at runtime. Every value below is concrete — "library defaults" is not an answer; name the defaults.

### 4.1 Colour

<Token source file; primary / secondary / muted / accent / destructive tokens with their foreground pairs; surfaces and borders; the project's domain token namespace (e.g. `--app-income`), each with a light and a dark value.>

### 4.2 Typography

<Font families with fallback stack and how they are loaded; root font size; the type scale (sizes and when each is used); weights.>

### 4.3 Spacing

<The spacing scale (base unit) and the default rhythm: between fields, between sections, inside containers, on phone.>

### 4.4 Radius

<The radius scale and which radius components and containers use.>

### 4.5 Motion

<Durations (micro / popover / panel) and easings; how reduced motion is honoured.>

### 4.6 Usage rule

<How templates consume tokens — utility classes, library token classes, preset tokens — and what is never done (raw colour literals, component SCSS for layout, overriding library internals).>

## 5. Theme and dark mode

<!-- guide: single-theme app: keep the heading, replace the bullets with "Single light theme" and why. -->

- **Strategy:** <class on the html element | media query | library preset selector>.
- **Default:** follow `prefers-color-scheme` until the user chooses.
- **Persistence:** `localStorage.theme` ∈ `{light, dark, system}`; the user's choice overrides the OS.
- **No flash of wrong theme:** an inline script in `index.html` sets the theme class before the bundle loads.
- **OS changes:** when the setting is `system`, honour mid-session OS theme flips.

## 6. Layout

- **Containers:** <default grouping boundary>.
- **Spacing:** <scale and how it is applied>.
- **Breakpoints:** <list>; mobile-first.
- **Navigation:** <primary navigation surface and behaviour per breakpoint>.
- **Overlays:** dialogs and popovers stack through the library — no manual z-index.
- **Toasts:** <region>; `aria-live="polite"`.

## 7. Forms

<Field wrapper, label, error-message and submit-button primitives this project uses.>

## 8. Iconography

<Icon set and usage pattern.>

## 9. Where things live

| Concern | Location |
|---|---|
| Design tokens | |
| Shared UI primitives / wrappers | |
| Feature composites | `features/{feature}/ui/` |
| Theme service | |
| Format helpers (money/date/number) | |

## 10. Visual gate specifics

Dev servers, accounts, widths and start points live in `.claude/gates.md` § Visual gate. <UI states and design checks specific to this project.>

## 11. Future rules

Append new UI rules as `## 11.N — {name}` with source, rationale and a "Why" sentence, so future agents can judge edge cases.
