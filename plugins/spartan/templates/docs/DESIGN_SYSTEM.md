# Design system — rules + principles

> Read before any UI work. Pull requests are reviewed against this doc. This document **pins the visual direction**: design skills and agents decide layout, hierarchy, states and copy inside it, never a new palette, font or custom component where a primitive exists.

<!-- guide: the autopilot spartan/ng default design system, pre-filled. Change a value here and in the file it names in the same commit (§ 9). Library-independent rules (primitives first, audit before hand-rolling, a11y minimums, visual gate) come from the autopilot design-discipline and spartan rules, and the official spartan skill (.claude/skills/spartan). This file covers new code only — never a legacy design system. -->

---

## 1. Primitive library

The UI layer is **spartan/ng**: `@spartan-ng/brain` (headless, accessible primitives, from npm) and helm (the styled layer, generated into the repo by spartan's CLI and owned by this project), on **Tailwind CSS v4** ([TECH_STACK.md](TECH_STACK.md)). Every interactive element comes from it — autopilot rule `design-discipline` § Primitives first.

- **Visual style:** `"style": "nova"` in `components.json`. spartan writes the style's classes into each generated component, so switching style means regenerating the components with the CLI (`ng g @spartan-ng/cli:ui`), never editing them by hand.
- **Generated code:** helm lives in <helm components path from components.json>. It is vendor code: exempt from the strict lint (`lint.vendorGlobs`), still type-checked, updated with `ng g @spartan-ng/cli:healthcheck --autoFix` and the CLI's migrations.
{{#legacyCss}}
- **Legacy setup:** after every `ng g @spartan-ng/cli:ui`, run `node tools/autopilot/spartan/prefix.mjs <helm components path from components.json>` — it prefixes the generated classes with `tw:`.
{{/legacyCss}}

## 2. Catalog

**Audit authority** for "does a primitive exist", always for the installed version (`package.json` → `@spartan-ng/brain`):
- the spartan MCP server (autopilot spartan pack, runs the installed version) and the official spartan skill;
- `https://www.spartan.ng/components/{name}`.

**Available now** (import `Hlm…Imports` from `@spartan-ng/helm/{name}` into the standalone component that uses it)

| Category | Primitive | Import |
|---|---|---|
| Buttons | `button[hlmBtn]` (`variant`, `size`) | `HlmButtonImports` from `@spartan-ng/helm/button` |
| Inputs | `input[hlmInput]`, `textarea[hlmTextarea]` | `HlmInputImports`, `HlmTextareaImports` |
| Form fields | `hlm-field`, `hlm-field-label`, `hlm-field-description`, `hlm-field-error` | `HlmFieldImports` from `@spartan-ng/helm/field` |
| Select | `hlm-select` | `HlmSelectImports` from `@spartan-ng/helm/select` |
| Dialog | `hlm-dialog`, `hlm-dialog-content`, `hlm-sheet`, `hlm-alert-dialog` | `HlmDialogImports`, `HlmSheetImports` |
| Toast | `hlm-toaster` + `toast()` from `ngx-sonner` | `HlmToasterImports` from `@spartan-ng/helm/sonner` |
| Menu | `hlm-dropdown-menu`, `hlm-menubar`, `hlm-tabs`, `hlm-breadcrumb` | `HlmDropdownMenuImports`, … |
| Checkbox / Radio / Switch | `hlm-checkbox`, `hlm-radio-group`, `hlm-switch` | `HlmCheckboxImports`, … |
| Layout (card, separator, scroll area) | `[hlmCard]` (+ header / title / content / footer), `hlm-separator`, `hlm-scroll-area` | `HlmCardImports`, … |
| Feedback (badge, alert, spinner, skeleton) | `[hlmBadge]`, `[hlmAlert]`, `hlm-spinner`, `hlm-skeleton`, `hlm-progress` | `HlmBadgeImports`, … |
| Tooltip / popover | `[hlmTooltip]`, `hlm-popover` | `HlmTooltipImports`, `HlmPopoverImports` |
| Date picker | `hlm-date-picker`, `hlm-calendar` | `HlmDatePickerImports` |
| Table | `[hlmTable]` (+ `hlmTr`, `hlmTh`, `hlmTd`), `hlm-pagination` | `HlmTableImports` |
| Icons | Lucide via `<ng-icon name="lucideCheck" />` + `provideIcons({ lucideCheck })` | `NgIcon` from `@ng-icons/core`, icons from `@ng-icons/lucide` |

**Add when needed** — anything else in the catalog: check the audit authority, run `ng g @spartan-ng/cli:ui --name={name} --interactive=false`{{#legacyCss}} and the prefix tool{{/legacyCss}}, then add a row here in the change that first uses it.

| Category | Primitive | First consumer |
|---|---|---|
| | | |

## 3. Custom composites

<Feature composites this project has, and what primitives each composes — examples agents can copy.>

## 4. Design tokens

Semantic tokens are CSS variables (OKLCH) on `:root` and `:root.dark`, consumed through Tailwind classes; they flip with the theme, so no dark-mode colour overrides are written by hand. Files: `src/styles/tokens/`.
{{#legacyCss}}

**Legacy setup (this app loads legacy global CSS):** every class takes the `tw:` prefix (`tw:flex`, `tw:md:grid-cols-2`{{#darkMode}}, `tw:dark:bg-muted`{{/darkMode}}), and only files inside `lint.strictScope` and `src/index.html` are scanned — a `tw:` class written anywhere else (the legacy app shell, a legacy page) generates no CSS. Tailwind's base reset is off, so legacy pages look exactly as before; new code sets its own type and spacing with classes.
{{/legacyCss}}

### 4.1 Colour

- **Palette:** zinc, generated by spartan into `src/styles/tokens/colors.css` (`ng g @spartan-ng/cli:ui-theme --theme=zinc …`, then `node tools/autopilot/spartan/spartan-css.mjs tokens src/styles/tokens/colors.css`). Do not edit by hand; re-run with another `--theme` (`neutral`, `stone`, `gray`, `slate`) to change it.
- **Semantic pairs:** `background`/`foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive` — each with `-foreground` for content on top — plus `border`, `input`, `ring`. Classes: `__TW__bg-primary __TW__text-primary-foreground`, `__TW__bg-muted __TW__text-muted-foreground`, `__TW__border-border`.
- **Status:** the component variants (`variant="destructive"` on `hlmBtn`, `hlmAlert`, `hlmBadge`) — never a hand-picked colour for a status.
- **Project tokens:** `src/styles/tokens/app.css`, the `--app-*` namespace, each with a `-foreground` pair and a light and a dark value, exposed with `@theme inline` (`__TW__text-app-income`).
- **Defined project tokens:** none yet. Add each as `` `--app-{name}` — light / dark — meaning ``.
{{#brands}}
- **Brands:** one file per brand in `src/styles/brands/` overriding only what differs (`--primary`, `--primary-foreground`, `--ring`, …) under `.brand-{name}`; the build's brand is set with `provideBrand(environment.brand)` (`src/app/core/theme/brand.ts`). An empty brand file means the default design.
{{/brands}}

### 4.2 Typography

- **Font:** the system font stack (`src/styles/tokens/typography.css`), no web font to load — `__TW__font-sans`.
- **Root size:** 16px; everything is rem-based.
- **Scale:** Tailwind's — body `__TW__text-sm` in dense UI and `__TW__text-base` in content, captions `__TW__text-xs`, headings `__TW__text-xl` / `__TW__text-2xl` / `__TW__text-3xl` with `__TW__font-semibold`; `__TW__tabular-nums` for figures; `__TW__truncate` for one-line overflow.

### 4.3 Spacing

- Tailwind's 4px scale (`src/styles/tokens/spacing.css`). Default rhythm: `__TW__gap-4` between fields, `__TW__gap-6` between sections, `__TW__p-6` inside cards, `__TW__p-4` on phone.
- Space items with `__TW__flex` / `__TW__grid` and `__TW__gap-*` — never `space-x-*` / `space-y-*`. Equal width and height: `__TW__size-*`.

### 4.4 Radius

- One knob, `--radius: 0.5rem` (`src/styles/tokens/radius.css`), and its scale: `__TW__rounded-sm` (−4px), `__TW__rounded-md` (−2px), `__TW__rounded-lg`, `__TW__rounded-xl` (+4px), `__TW__rounded-2xl` (+8px), `__TW__rounded-full`. Components use the scale; never a raw pixel radius.

### 4.5 Motion

- Durations `--duration-fast` 150ms (micro-interactions), `--duration-base` 200ms (popovers), `--duration-slow` 300ms (panels, dialogs); easings `__TW__ease-in`, `__TW__ease-out`, `__TW__ease-in-out` (`src/styles/tokens/motion.css`).
- spartan's overlay animations come with the preset; custom animation sits behind `__TW__motion-safe:`.

### 4.6 Usage rule

| Concern | How | Never |
|---|---|---|
| Layout, spacing, sizing, typography, responsive | Tailwind classes in the template; on a spartan component, `class` is for its **layout only** (position, margin, width) | component SCSS |
| Colours, surfaces, borders | the semantic token classes (§ 4.1) | hex, `rgb()`, raw palette classes like `__TW__bg-blue-500` |
| How a spartan component looks | its built-in `variant` / `size` inputs first; a lasting change goes into the generated helm file or a token | overriding its colours, typography or padding through `class`, `::ng-deep` |
| A project colour | a token in `tokens/app.css` (§ 4.1) | SCSS variables |

New components have no stylesheet (`ng g c` is set to `style: none`). Any stylesheet in new code is the exception and opens with `/* why: … */` — stylelint `autopilot/justified-stylesheet`; only the global entry styles (`src/styles.*`, `src/styles/**`) are exempt.

## 5. Theme and dark mode

{{#darkMode}}
- **Strategy:** class `dark` on `<html>` — the tokens' `:root.dark` block and Tailwind's `dark:` variant (defined by the spartan preset). Write dark variants only for non-token cases: `__TW__dark:bg-muted`.
- **Default:** follow `prefers-color-scheme` until the user chooses.
- **Persistence:** `localStorage.theme` ∈ `{light, dark, system}` via `ThemeService` (`src/app/core/theme/theme.service.ts`); the user's choice overrides the OS.
- **No flash of wrong theme:** the inline script in `index.html` sets the class before the bundle loads.
- **OS changes:** in `system`, `ThemeService` follows mid-session OS theme flips.
{{/darkMode}}
{{^darkMode}}
- **Single light theme:** no `dark` class is ever set; the `:root.dark` tokens stay unused. No `dark:` classes.
{{/darkMode}}

## 6. Layout

- **Page shell:** `__TW__min-h-screen __TW__bg-background __TW__text-foreground` around the content; content width `__TW__max-w-7xl __TW__mx-auto __TW__px-4 __TW__md:px-6`.
- **Containers:** `[hlmCard]` with its header / content / footer parts.
- **Grids and stacks:** `<div class="__TW__flex __TW__flex-col __TW__gap-4">`, `<div class="__TW__grid __TW__grid-cols-1 __TW__md:grid-cols-2 __TW__gap-6">`.
- **Breakpoints:** Tailwind's — `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536; mobile-first. The visual gate checks 375 and 1280.
- **Navigation:** <primary navigation surface and behaviour per breakpoint — e.g. `hlm-menubar` on desktop, `hlm-sheet` behind a menu button on phone>.
- **Overlays:** dialogs, sheets and popovers stack through spartan (CDK overlay) — no manual z-index.
- **Toasts:** one `<hlm-toaster />` in the app shell, `toast()` to show one; polite announcements.

## 7. Forms

- **Field:** `<hlm-field>` with `<label hlmFieldLabel for>`, the control (`hlmInput`, `hlm-select`, `hlm-checkbox`, …) bound with `formControlName`, `<p hlmFieldDescription>` for help, and `<hlm-field-error>` shown when the control is invalid and touched.
- **Stack:** `<form class="__TW__flex __TW__flex-col __TW__gap-4">`; two columns from `md`: `__TW__grid __TW__md:grid-cols-2 __TW__gap-4`.
- **Submit:** `<button hlmBtn type="submit">`, disabled while saving with a `hlm-spinner` inside; secondary actions `variant="outline"` or `variant="ghost"`.

## 8. Iconography

Lucide only (`@ng-icons/lucide`): `<ng-icon name="lucidePlus" />` with `provideIcons({ lucidePlus })` in the component. Decorative icons get `aria-hidden="true"`; an icon-only button gets `aria-label` and `size="icon"`.

## 9. Where things live

| Concern | Location |
|---|---|
| Tailwind setup, preset, token and brand imports | `src/styles/tailwind.css` |
| Colour tokens (generated) / project tokens / type, spacing, radius, motion | `src/styles/tokens/colors.css` / `app.css` / `typography.css`, `spacing.css`, `radius.css`, `motion.css` |
{{#brands}}
| Brand overrides / active brand | `src/styles/brands/{name}.css` / `src/app/core/theme/brand.ts` |
{{/brands}}
{{#darkMode}}
| Theme switching | `src/app/core/theme/theme.service.ts` |
{{/darkMode}}
| spartan CLI settings (style, path, import alias) | `components.json` |
| Generated helm components | <helm components path from components.json> |
| Feature composites | `features/{feature}/ui/` |
| Format helpers (money/date/number) | <format helpers location> |

## 10. Visual gate specifics

Dev servers, accounts, widths and start points live in `.claude/gates.md` § Visual gate. <UI states and design checks specific to this project.>

## 11. Future rules

Append new UI rules as `## 11.N — {name}` with source, rationale and a "Why" sentence, so future agents can judge edge cases.
