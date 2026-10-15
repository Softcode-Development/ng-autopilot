---
paths:
  - "**/*.ts"
  - "**/*.html"
---

# Forms, routing and HTTP

## Forms
- **Reactive Forms only**, typed (`FormGroup<…>` / `NonNullableFormBuilder`). Template-driven forms are not allowed.
- Validators set once at construction. When the project shares schemas with the backend (e.g. Zod), forms validate through them so client and server agree.
- **Locking a control:** create it disabled or call `.disable()`. Never put `[disabled]` on an element bound with `formControlName` — Angular re-applies the control's own state and silently unlocks it. A locked field that must still be sent is read with `getRawValue()`.
- Bind `[formGroup]` + `formControlName`; never `[formControl]="form.get('x')"` (template call).

## Routing
- Feature routes live in `<feature>.routes.ts`, lazy-loaded from `app.routes.ts` (`loadChildren` / `loadComponent`).
- Guards and resolvers are functional (`CanActivateFn`, `ResolveFn`), not classes.
- Route data carries i18n title keys; a title strategy translates them.

## HTTP
- `HttpClient` is provided once, in `app.config.ts`, with the interceptors. Never provide it again in a feature — a second instance silently skips the interceptors.
- Interceptors live in `core/http/interceptors/`: auth header, correlation id, error mapping, retry policy, telemetry. Global concerns are never duplicated per service.
- Feature code calls a typed API layer (a generated client, or one service method per endpoint) — no raw URL strings at call sites (see constants rule).
- Response types reuse the domain interfaces; verify real endpoint params and enum spellings against the API docs named in DOMAIN.md before wiring.
