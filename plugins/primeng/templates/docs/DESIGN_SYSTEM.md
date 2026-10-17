# Design system — rules + principles

> Read before any UI work. Pull requests are reviewed against this doc. This document **pins the visual direction**: design skills and agents decide layout, hierarchy, states and copy inside it, never a new palette, font or custom component where a primitive exists.

<!-- guide: the autopilot PrimeNG default design system, pre-filled. Change a value here and in the code it names in the same commit (§ 9). Library-independent rules (primitives first, audit before hand-rolling, a11y minimums, visual gate) come from the autopilot design-discipline and primeng rules. This file covers new code only — never a legacy design system. -->

---

## 1. Primitive library

The UI layer is **PrimeNG** (styled mode, theme preset in `src/app/core/theme/app-preset.ts`) with **Tailwind CSS v4 + `tailwindcss-primeui`** for layout, spacing, typography and colour utilities ([TECH_STACK.md](TECH_STACK.md)). Every interactive element comes from PrimeNG — autopilot rule `design-discipline` § Primitives first.

## 2. Catalog

**Audit authority** for "does a primitive exist", always for the installed major (`package.json` → `primeng`):
- the LLM docs agents can read: `https://v{major}.primeng.org/llms/llms.txt` (index) and `https://v{major}.primeng.org/llms/components/{component}.md` (full page with examples);
- the PrimeNG MCP server (autopilot primeng pack, runs the installed major);
- the site `https://v{major}.primeng.org` — never `primeng.org`, which shows the latest major.

**Available now** (import into the standalone component that uses it)

| Category | Primitive | Import |
|---|---|---|
| Buttons | `p-button`, `p-splitbutton`, `p-selectbutton` | `ButtonModule` from `primeng/button`, … |
| Inputs | `pInputText`, `p-inputnumber`, `pTextarea`, `p-autocomplete` | `InputTextModule` from `primeng/inputtext`, … |
| Select | `p-select`, `p-multiselect` | `SelectModule` from `primeng/select`, `MultiSelectModule` |
| Dialog | `p-dialog`, `p-confirmdialog`, `p-drawer` | `DialogModule` from `primeng/dialog`, … |
| Toast | `p-toast` + `MessageService` | `ToastModule` from `primeng/toast`, `MessageService` from `primeng/api` |
| Menu | `p-menu`, `p-menubar`, `p-breadcrumb`, `p-tabs` | `MenuModule` from `primeng/menu`, … |
| Checkbox / Radio / Switch | `p-checkbox`, `p-radiobutton`, `p-toggleswitch` | `CheckboxModule` from `primeng/checkbox`, … |
| Layout (card, separator, scroll area) | `p-card`, `p-divider`, `p-toolbar` | `CardModule` from `primeng/card`, … |
| Feedback (badge, alert, spinner, skeleton) | `p-badge`, `p-tag`, `p-message`, `p-progressspinner`, `p-skeleton` | `BadgeModule` from `primeng/badge`, … |
| Tooltip | `pTooltip` | `TooltipModule` from `primeng/tooltip` |
| Date picker | `p-datepicker` | `DatePickerModule` from `primeng/datepicker` |
| Table | `p-table` (+ `p-paginator`) | `TableModule` from `primeng/table` |
| Icons | PrimeIcons `pi pi-*` | `primeicons/primeicons.css` |

**Add when needed** — anything else from the catalog: first check the audit authority, then add a row here in the change that first uses it.

| Category | Primitive | First consumer |
|---|---|---|
| | | |

## 3. Custom composites

<Feature composites this project has, and what primitives each composes — examples agents can copy.>

## 4. Design tokens

Two systems, one source of truth: the **PrimeNG preset** (`--p-*` CSS variables) styles the components; **Tailwind** styles everything around them, and `tailwindcss-primeui` maps the preset's colours into Tailwind classes. Tokens are CSS variables, so light and dark swap at runtime.

### 4.1 Colour

- **Preset:** Aura, `definePreset(Aura, …)` in `src/app/core/theme/app-preset.ts`.
- **Primary:** the `blue` palette (`{blue.50}` … `{blue.950}`, base `{blue.500}`) — change it there for a brand colour. Classes: `__TW__bg-primary`, `__TW__text-primary`, `__TW__text-primary-contrast`, `__TW__bg-primary-50` … `__TW__bg-primary-950`.
- **Surfaces:** Aura's own (light and dark). Classes: `__TW__bg-surface-0` … `__TW__bg-surface-950`, `__TW__border-surface`, `__TW__bg-emphasis`, `__TW__bg-highlight`.
- **Text:** `__TW__text-color` (default), `__TW__text-muted-color` (secondary), `__TW__text-color-emphasis`.
- **Status:** PrimeNG severities (`success`, `info`, `warn`, `danger`, `secondary`, `contrast`) on `p-button`, `p-tag`, `p-message`, `p-toast` — never a hand-picked colour for a status.
- **Project tokens:** lowercase dot names under `app` in the preset's `extend`, each with a light and a dark value (e.g. `app.income.color` → `--p-app-income-color`), exposed to Tailwind in `src/styles/tailwind.css` (`--color-app-income` → `__TW__text-app-income`). The same names work as Theme Designer / Figma `custom` tokens.
- **Defined project tokens:** none yet. Add each as `` `app.{name}.color` — light / dark — meaning ``.

### 4.2 Typography

- **Font:** Inter Variable, self-hosted (`@fontsource-variable/inter`), fallback `ui-sans-serif, system-ui, sans-serif` — `__TW__font-sans`. PrimeNG components inherit it.
- **Root size:** 16px. PrimeNG and Tailwind are rem-based, so the root size scales both — never change it per page.
- **Scale:** Tailwind's — body `__TW__text-base`, dense UI (tables, toolbars) `__TW__text-sm`, captions `__TW__text-xs`, headings `__TW__text-xl` / `__TW__text-2xl` / `__TW__text-3xl` with `__TW__font-semibold`.
- **Numbers in tables:** `__TW__tabular-nums`.

### 4.3 Spacing

- Tailwind's 4px scale: `__TW__gap-*`, `__TW__p-*`, `__TW__m-*`, `__TW__space-y-*`. Default rhythm: `__TW__gap-4` between fields, `__TW__gap-6` between sections, `__TW__p-6` inside cards, `__TW__p-4` on phone.
- Component inner spacing is the preset's — not adjusted with utilities.

### 4.4 Radius

- Components: the preset's scale (Aura). For a container that should match the components: `__TW__rounded-border`.
- Layout: Tailwind's `__TW__rounded-md` / `__TW__rounded-lg` / `__TW__rounded-xl`; avatars and pills `__TW__rounded-full`.

### 4.5 Motion

- Components: Aura's transition duration (0.2s) — not overridden.
- Layout: `__TW__transition` with `__TW__duration-150` (micro), `__TW__duration-200` (popovers), `__TW__duration-300` (panels); every animation behind `__TW__motion-safe:`.

### 4.6 Usage rule

| Concern | How | Never |
|---|---|---|
| Layout, spacing, sizing, typography, responsive | Tailwind classes in the template | component SCSS |
| Colours, surfaces, borders | `tailwindcss-primeui` classes (§ 4.1) | hex, `rgb()`, raw palette classes like `__TW__bg-blue-500` |
| How a PrimeNG component looks | the preset; one instance: its `dt` input (scoped tokens) or `pt` (pass-through classes) | overriding `.p-*` classes, `::ng-deep` |
| A project colour | a token in the preset's `extend.app` (§ 4.1) | SCSS variables |

New components have no stylesheet (`ng g c` is set to `style: none`). A component stylesheet is the exception and opens with `/* why: … */` — stylelint `autopilot/justified-stylesheet`.

## 5. Theme and dark mode

{{#darkMode}}
- **Strategy:** class `app-dark` on `<html>` — PrimeNG `darkModeSelector: '.app-dark'`, Tailwind `dark:` variant on the same class (`src/styles/tailwind.css`). Write dark variants as `__TW__dark:bg-surface-900`.
- **Default:** follow `prefers-color-scheme` until the user chooses.
- **Persistence:** `localStorage.theme` ∈ `{light, dark, system}` via `ThemeService` (`src/app/core/theme/theme.service.ts`); the user's choice overrides the OS.
- **No flash of wrong theme:** the inline script in `index.html` sets the class before the bundle loads.
- **OS changes:** in `system`, `ThemeService` follows mid-session OS theme flips.
{{/darkMode}}
{{^darkMode}}
- **Single light theme:** `darkModeSelector: false` — the app has no dark mode and PrimeNG must not follow the OS setting. No `dark:` classes.
{{/darkMode}}

## 6. Layout

- **Page shell:** `__TW__min-h-screen __TW__bg-surface-50{{#darkMode}} __TW__dark:bg-surface-950{{/darkMode}}` around the content; content width `__TW__max-w-7xl __TW__mx-auto __TW__px-4 __TW__md:px-6`.
- **Containers:** `p-card`, or a plain section `<section class="__TW__bg-surface-0 __TW__rounded-border __TW__border __TW__border-surface __TW__p-6">`.
- **Grids and stacks:** `<div class="__TW__flex __TW__flex-col __TW__gap-4">`, `<div class="__TW__grid __TW__grid-cols-1 __TW__md:grid-cols-2 __TW__gap-6">`.
- **Breakpoints:** Tailwind's — `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536; mobile-first. The visual gate checks 375 and 1280.
- **Navigation:** <primary navigation surface and behaviour per breakpoint — e.g. `p-menubar` on desktop, `p-drawer` behind a menu button on phone>.
- **Overlays:** dialogs, drawers and popovers stack through PrimeNG — no manual z-index.
- **Toasts:** one `<p-toast position="top-right" />` in the app shell; PrimeNG renders it `aria-live="polite"`.

## 7. Forms

- **Field:** a `<label for>` above the control (or `p-floatlabel` / `p-iftalabel` for dense forms), the control (`pInputText`, `p-select`, `p-datepicker`, …) with `formControlName`, and the error below as `<p-message severity="error" size="small" variant="simple">` shown when the control is invalid and touched.
- **Stack:** `<form class="__TW__flex __TW__flex-col __TW__gap-4">`; two columns from `md`: `__TW__grid __TW__md:grid-cols-2 __TW__gap-4`; full-width controls with `p-fluid` or the control's `fluid` input.
- **Submit:** `p-button` with `type="submit"` and `[loading]` while saving; secondary actions `severity="secondary"` or `variant="text"`.

## 8. Iconography

PrimeIcons only (`primeicons` package): `<i class="pi pi-check"></i>`, or a component's `icon` input (`icon="pi pi-plus"`). Decorative icons get `aria-hidden="true"`; an icon-only button gets `aria-label`.

## 9. Where things live

| Concern | Location |
|---|---|
| Theme preset (tokens, primary, project tokens) | `src/app/core/theme/app-preset.ts` |
| A preset from the Theme Designer / Figma (never hand-edited) | `src/app/core/theme/generated/` |
| PrimeNG config (preset, dark-mode selector, CSS layer) | `src/app/core/theme/primeng.providers.ts` → `app.config.ts` |
{{#darkMode}}
| Theme switching | `src/app/core/theme/theme.service.ts` |
{{/darkMode}}
| Tailwind, PrimeNG token classes, font, project-token classes | `src/styles/tailwind.css` |
| Shared UI wrappers and composites | <shared UI folder> |
| Feature composites | `features/{feature}/ui/` |
| Format helpers (money/date/number) | <format helpers location> |

## 10. Visual gate specifics

Dev servers, accounts, widths and start points live in `.claude/gates.md` § Visual gate. <UI states and design checks specific to this project.>

When previewing a theme in the PrimeNG Theme Designer, set its preview font to Inter and its base size to 16px — it defaults to 14px, and the app runs at 16px.

## 11. Future rules

Append new UI rules as `## 11.N — {name}` with source, rationale and a "Why" sentence, so future agents can judge edge cases.
