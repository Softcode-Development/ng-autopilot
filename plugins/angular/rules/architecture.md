---
paths:
  - "**/*.ts"
  - "**/*.html"
---

# Angular architecture

The project's concrete tree and any deviation from this rule live in the project's `docs/ARCHITECTURE.md`; the project doc wins on conflict.

## Lint scope

`.claude/autopilot.json` → `lint.strictScope` (globs, default `["src/**"]`) is where the autopilot rules apply **in full, as errors, with no exceptions**. A legacy repo sets it to its modern folders (e.g. `["src/app/features/**"]`).

## Legacy stays legacy

Code outside `lint.strictScope` is legacy. It is never developed further: bug fixes only, made in the file's existing style; no new features, no in-place modernisation. New work, and every replacement of a legacy screen, is built inside the strict scope. Legacy conventions, the legacy design system and legacy UI libraries are never written into the project rules and never reach new code.
- **Why:** a half-modernised legacy file is worse than either state, and every new feature built on legacy patterns extends what has to be replaced.
- **Enforcement:** the autopilot ESLint and stylelint presets apply every rule to `strictScope` only; the plan gate puts new work inside it; reviewers flag new features or rewrites outside it.
- **Exempt:** the one-line wiring that mounts a new feature (a lazy route, a menu entry) in the legacy shell.

## Shape
```
src/app/
├── core/        app-lifetime singletons — flat, intent-named folders
├── shared/      truly reusable, truly dumb pieces
└── features/    one folder per feature — the unit of change
    └── <feature>/
        ├── data-access/   state, services, HTTP, queries, mutations
        ├── ui/            presentational components (no data-service DI)
        ├── pages/         routed smart components (containers)
        ├── models/        interfaces, types, enums, consts
        ├── utils/         pure helpers
        ├── <feature>.routes.ts
        └── README.md      ≤30 lines: purpose, public exports, capability slug
```

- **`features/`** is the unit of change: one capability = one feature folder.
- **`core/`** holds singletons that live for the whole app (auth state, interceptors, logger, theme, bootstrap helpers). Its children are **flat and intent-named** (`auth/`, `bootstrap/`, `constants/`, `http/`, `i18n/`, `observability/`, `theme/`) — never technology-named parents like `core/services/` or `core/utils/`, never `core/<vendor>/` (a vendor nests under its intent: `observability/<vendor>/`). Interceptors live under `core/http/interceptors/`. `core/` never imports from `features/`.
- **`shared/`** holds pieces with no feature-domain dependency. If it knows a feature's domain, it belongs in that feature.
- **Shared UI libraries group components by which project types can consume them.** Universal primitives at the top level; surface-specific pieces (dashboard chrome such as page headers) under a category folder (`dashboard/`). Ask "which project types can reuse this?" before placing a shared component.

## Model files per feature
When a feature has that kind of content, it lives in the matching file — never create an empty file to satisfy the list:

| File | Holds |
|---|---|
| `models/<entity>.interface.ts` | Shape of a domain entity |
| `models/<entity>.types.ts` | Discriminated unions, request/response types |
| `models/<entity>.enums.ts` | String-literal unions / `as const` maps |
| `models/<entity>.consts.ts` | Static configuration: limits, defaults, patterns |

One file per component, directive, pipe or service; a class used by two consumers gets its own file.

## Forbidden
- `services/`, `components/`, `models/` as **top-level** folders — always nested in a feature.
- Feature A importing Feature B's internals. Cross-feature reuse goes through `shared/` or a library barrel.
- Circular imports between features.
- A file named `utils.ts` more than one folder deep without a more specific name.

**Enforcement:** lint import boundaries (`no-restricted-imports` patterns, or `@nx/enforce-module-boundaries` in Nx) for the import rules; review for placement.

## Component types
- **Pages (smart/container):** routed, inject services, own state.
- **UI (presentational):** inputs/outputs only, no DI to data services.
- **Layout:** structural wrappers (shells, headers).

## Modern Angular baseline
- **Standalone everything.** No `NgModule` in new code. Providers in `app.config.ts` (`provideRouter`, `provideHttpClient(withInterceptors([...]))`, …).
- **`inject()`** for DI in new code.
- **`ChangeDetectionStrategy.OnPush`** on every component. — **Enforcement:** lint `prefer-on-push-component-change-detection`.
- **Zoneless** when the project's Angular version supports it and the project's `docs/ARCHITECTURE.md` declares it; then never add `zone.js` to polyfills.
- **Signals are the primary reactive primitive**: `signal`, `computed`, `linkedSignal`, `effect`, `resource`. RxJS only where signals cannot express the flow (debounced streams, websockets), converted with `toSignal()` at the boundary.

## Dependency injection
- `inject()` only in injection context — field initialisers or the constructor; calling it from a lifecycle hook throws.
- Singletons: `@Injectable({ providedIn: 'root' })`. Feature-scoped services go in the feature's route `providers`, not root.
- Value tokens: `InjectionToken<T>` with `factory: () => …`. No string tokens.

## Zoneless
When the app runs zoneless (`provideZonelessChangeDetection()`):
- Change detection runs on **signal writes**, Angular-bound template events, the `async` pipe and explicit `markForCheck()` — **not** on `setTimeout`, `setInterval`, `requestAnimationFrame` or promise callbacks. State a callback changes for the UI must be a signal write.
- Third-party libraries that rely on zone.js patches (some charts, drag-drop) get an adapter that writes signals; document the adapter in a why-comment.
- Avoid `NgZone.run()`; it is the zone-ful escape hatch, used only to adapt a library that cannot be integrated otherwise, and called out in review.
- `OnPush` everywhere is what makes zoneless safe — the default strategy is a review blocker.

## Refactoring and migrations
- **Behaviour stays identical:** the same values, conditions, request payloads and timing. Anything that cannot stay identical is reported (with the reason and a proposal), never changed silently.
  - **Why:** a refactor that "improves" behaviour on the way through hides a product change inside a no-op diff, and nobody reviews it as one.
- **Migrations use Angular's official schematics first** (`ng generate @angular/core:<migration>` — control-flow, inject, signal-input-migration, output-migration, signal-queries-migration, standalone, …); hand edits only for what a schematic leaves behind.
  - **Why:** the schematics handle edge cases (two-way bindings, aliases, template references) that hand edits miss.
