---
paths:
  - "**/*.ts"
  - "**/*.html"
---

# Components and templates

## Template purity
- **No function, getter or method calls bound in templates**, except signal reads (`count()`) and pipes. Compute with `computed()` (or once in `ngOnInit` for legacy code) and bind the result. Forbidden: `{{ service.getX() }}`, `{{ form.get('x') }}`, inline key building like `{{ 'facets.' + value | translate }}`.
  - **Why:** a method in a template runs on every change-detection pass, and it hides logic from tests.
  - **Enforcement:** lint `@angular-eslint/template/no-call-expression` (allow signal reads).

## Control flow and APIs
- **Block control flow** — `@if`, `@for`, `@switch`, `@defer`, `@let`. No `*ngIf` / `*ngFor` in new code.
- **`@for` tracks a stable id** (`track item.id`), never `$index` for object lists.
- **Signal inputs/outputs** — `input()`, `output()`, `model()`. No `@Input()` / `@Output()` in new code.
- **Signal queries** — `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`.
- **`host` metadata** instead of `@HostBinding` / `@HostListener`.

**Enforcement:** lint `prefer-control-flow`, `prefer-signals`, `no-input-rename`, plus `no-restricted-syntax` selectors banning the decorators in new code.

## Inline templates
- **No inline template longer than 15 lines.** Extract to a colocated `.html` (`templateUrl`).
  - **Why:** long inline templates bury the component API under markup and lose template tooling and independent diff review.
  - **Enforcement:** lint `@angular-eslint/component-max-inline-declarations` (`template: 15`).

## Interactive elements
- Every interactive element carries a stable `data-cy` (or the project's test-id attribute) so e2e tests can target it without CSS selectors.
- Every interactive element has an accessible name (see design-discipline).

## Subscriptions
- Prefer signals and the `async` pipe. A component subscription uses `takeUntilDestroyed()` (or the project's declared legacy pattern). Never subscribe in a click handler without a cleanup path.
