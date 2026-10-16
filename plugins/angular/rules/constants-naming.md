---
paths:
  - "**/*.ts"
  - "**/*.html"
---

# Constants and naming

## No hardcoded API URLs, route paths or page-name keys
Every HTTP endpoint, client route and user-facing page name lives once, in `core/constants/`, and is consumed by name:

| Constant | Holds | Consumed by |
|---|---|---|
| `API_PATHS.<feature>.<key>` | Endpoint URLs | `HttpClient` calls, query/mutation functions |
| `ROUTE_SEGMENTS.<area>.<key>` | URL segments, no slash (`'sign-in'`) | `Route.path` in `*.routes.ts` |
| `ROUTE_PATHS.<area>.<key>` | Full URLs with leading slash, **derived** from `ROUTE_SEGMENTS` via template literals | `router.navigate`, `[routerLink]` |
| `ROUTE_NAMES.<area>.<key>` | i18n keys for page names (breadcrumbs, titles, nav labels) | translate pipe / service |

- **Why:** a typo or backend rename surfaces as a build error in the one file that owns the literal, not as runtime 404s scattered over N call sites.
- **Templates:** bind by property — `[routerLink]="routePaths.auth.signIn"` with `protected readonly routePaths = ROUTE_PATHS;`.
- **Enforcement:** lint `no-restricted-syntax` selectors for `router.navigate(['/…'])` and `http.<verb>('/api/…')` literals; templates are review-only (attribute literals can't be lint-restricted).
- **Exempt:** `core/constants/**` (the source of truth) and `*.spec.ts` (literal URLs are wire-contract regression checks; importing the constant would make the test a constant-equality check).

## Naming
| Kind | Convention | Example |
|---|---|---|
| File | `kebab-case` | `fast-add-sheet.component.ts` |
| Class, interface, type | `PascalCase`; no `I` prefix | `Order`, `AccountSettings` |
| `as const` map keys | `PascalCase`; `SCREAMING_SNAKE` for truly static constants | `TransactionDirection.In` |
| Function | `camelCase`, verb-first | `splitTransactionEqually` |
| Boolean | `is/has/should/can` prefix | `isPendingConfirmation` |
| Component | `.component.ts`, selector `<prefix>-<kebab>` | `app-fast-add-sheet` |
| Routed page (if the project separates them) | `.page.ts` | `dashboard.page.ts` |
| Service | `.service.ts` | `transactions.service.ts` |
| Tests | `.spec.ts` unit · `.int-spec.ts` integration · project's e2e suffix | `transactions.service.spec.ts` |
| Schema / inferred type | `…Schema` / name without `Schema` | `createTransactionSchema` → `CreateTransactionDto` |

**Enforcement:** lint `component-selector`, `directive-selector`, `naming-convention`; review for the rest.
