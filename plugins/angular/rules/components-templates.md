---
paths:
  - "**/*.ts"
  - "**/*.html"
---

# Components and templates

## Template purity
- **No function, getter or method calls bound in templates**, except signal reads (`count()`) and pipes. Compute with `computed()` (or once in `ngOnInit` for legacy code) and bind the result. Forbidden: `{{ service.getX() }}`, `{{ form.get('x') }}`, inline key building like `{{ 'facets.' + value | translate }}`.
  - **Why:** a method in a template runs on every change-detection pass, and it hides logic from tests.
  - **Enforcement:** lint `autopilot/template-no-method-calls` — reads the component class and allows only zero-argument signal reads (and members of injected `*Store`s) plus output handlers. A call it cannot prove is a signal read is an error; add a genuine exception to its `allowList`, never disable it.

## Control flow and APIs
- **Block control flow** — `@if`, `@for`, `@switch`, `@defer`, `@let`. No `*ngIf` / `*ngFor` in new code.
- **`@for` tracks a stable id** (`track item.id`), never `$index` for object lists.
- **Signal inputs/outputs** — `input()`, `output()`, `model()`. No `@Input()` / `@Output()` in new code.
- **Signal queries** — `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`.
- **`host` metadata** instead of `@HostBinding` / `@HostListener`.

**Enforcement:** lint `@angular-eslint/template/prefer-control-flow`, `@angular-eslint/prefer-signals`, `@angular-eslint/no-input-rename`, and `no-restricted-syntax` selectors banning `@Input`/`@Output`/query/host decorators.

## Inline templates
- **No inline template longer than 15 lines.** Extract to a colocated `.html` (`templateUrl`).
  - **Why:** long inline templates bury the component API under markup and lose template tooling and independent diff review.
  - **Enforcement:** lint `@angular-eslint/component-max-inline-declarations` (`template: 15`).

## Interactive elements
- Every interactive element carries a stable `data-cy` (or the project's test-id attribute) so e2e tests can target it without CSS selectors.
- Every interactive element has an accessible name (see design-discipline).

## Inputs
- `input<T>()` / `input.required<T>()`; boolean and number attributes use `transform: booleanAttribute` / `numberAttribute`.
- Route params and query params arrive as inputs (`withComponentInputBinding()`), not through `ActivatedRoute.snapshot`.

## Lifecycle and cleanup
- Convert observables with `toSignal()` at the component edge; the `async` pipe only in legacy code, never in event bindings.
- Long-lived subscriptions: `takeUntilDestroyed()` (field-initialiser form preferred); teardown work: `inject(DestroyRef).onDestroy(…)`. Never subscribe in a click handler without a cleanup path.
- One-shot browser/DOM work after render (focus, measuring, third-party widget init): `afterNextRender`. DOM work that re-runs with signals: `afterRenderEffect`. Never touch the DOM from a plain `effect()`.

## Deferred loading
- Non-critical sections: `@defer (on viewport | idle | interaction | when cond())`, heavy widgets (charts, editors, maps, PDF) loaded inside via dynamic `import()`.
- Every `@defer` has `@placeholder`, `@loading (minimum …)` and `@error` blocks — the user always sees the transition.
- Use `@if` for branches that can be absent, not `[hidden]` (hidden content still renders and holds state).
