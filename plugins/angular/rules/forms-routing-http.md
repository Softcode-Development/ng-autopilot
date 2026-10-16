---
paths:
  - "**/*.ts"
  - "**/*.html"
---

# Forms, routing and HTTP

## Forms
- **Reactive Forms only**, typed (`FormGroup<…>` / `NonNullableFormBuilder`); `nonNullable: true` on controls that never hold `null`. Template-driven forms (`ngModel`) are not allowed.
- Validators set once at construction. Custom validators are pure functions of `AbstractControl`, colocated in the feature's `validators/`. When the project shares schemas with the backend (e.g. Zod), forms validate through them so client and server agree.
- Submit is disabled while the request runs (an `isSubmitting` signal); field errors are tied to their input (`<label for>`, `aria-describedby`). Templates display validation state; they don't compute it.
- **Locking a control:** create it disabled or call `.disable()`. Never put `[disabled]` on an element bound with `formControlName` — Angular re-applies the control's own state and silently unlocks it. A locked field that must still be sent is read with `getRawValue()`.
- Bind `[formGroup]` + `formControlName`; never `[formControl]="form.get('x')"` (template call).

## Routing
- Feature routes live in `<feature>.routes.ts`, lazy-loaded from `app.routes.ts` (`loadChildren` / `loadComponent`).
- Guards, matchers and resolvers are functional (`CanActivateFn`, `CanMatchFn`, `ResolveFn`), not classes.
- `provideRouter(routes, withComponentInputBinding())` so routed components receive params as inputs.
- Route data carries i18n title keys; a title strategy translates them.

## HTTP
- `HttpClient` is the only HTTP client (no raw `fetch`, `XMLHttpRequest` or third-party HTTP libraries in app code). It is provided once, in `app.config.ts` — `provideHttpClient(withFetch(), withInterceptors([...]))`. Never provide it again in a feature — a second instance silently skips the interceptors.
- Interceptors are functional (`HttpInterceptorFn`) and live in `core/http/interceptors/`: auth header, correlation id, error mapping, retry policy, telemetry. Global concerns are never duplicated per service.
- HTTP services return `Observable<T>`; components convert at their edge (`toSignal()`), or the server-state layer consumes them.
- Feature code calls a typed API layer (a generated client, or one service method per endpoint) — no raw URL strings at call sites (see constants rule).
- Response types reuse the domain interfaces; verify real endpoint params and enum spellings against the API docs named in `CLAUDE.md` (**API** line, from `autopilot.json` → `api.docsUrl`) before wiring. When it says "not set", ask the owner first.
