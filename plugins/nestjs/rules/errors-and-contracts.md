---
paths:
  - "apps/api/**"
  - "libs/**/api-contracts/**"
  - "**/*.controller.ts"
  - "**/dto/**"
---

# Errors, OpenAPI and shared contracts

## Canonical error taxonomy
One global exception filter returns one shape. The frontend translates `code`; the backend never returns localised text.

```ts
interface ApiErrorResponse {
  code: string;            // <feature>.<reason>, e.g. 'transactions.not_found'
  message: string;         // i18n key
  httpStatus: number;
  correlationId: string;
  details?: Record<string, unknown>;
}
```
- Codes are `<feature>.<reason>`: lowercase, dot-separated, deterministic. Reasons are stable identifiers (`not_found`, `forbidden`, `version_conflict`, …).
- Domain errors are typed (`NotFoundError`, `ConflictError`, `ForbiddenError`, `ValidationError`) and mapped to HTTP status **only in the filter**. `throw new HttpException(...)` outside the filter is banned. — **Enforcement:** lint `no-restricted-syntax`.

## Every handler ships complete OpenAPI metadata
Touching a route is incomplete until `/docs` shows: `@ApiOperation({ summary })`, `@ApiBody({ type })`, `@ApiParam`/`@ApiQuery` for every param, a typed success response (`@ApiOkResponse` / `@ApiCreatedResponse` / `@ApiNoContentResponse`), and the standard errors (401 for non-public, 403 for scoped resources, 422 with a body, plus 404/409/400 where the service throws them).
- **Why:** reflection yields nothing when bodies are `unknown` and responses are schema-inferred aliases; the generated client is only as good as this metadata.
- **Exempt:** `*.spec.ts`, health controllers.
- **Enforcement:** OpenAPI lint in CI where wired; review.

## No duplicate wire-contract schemas
Before authoring a schema for a wire contract (request, response, query, named entity), grep the shared contracts library for the same logical shape; reuse it if found. If not found and the frontend consumes the shape (today or per the backlog (`.claude/plans/backlog.md`) / the active plan), author it in the shared library and import it into the API.
- A schema may stay API-local only if it is backend-only forever (error envelope, health probes) **or** its frontend consumer is far off and the shape is still evolving — and that deferral cites its destination in the active plan.
- **Why:** two locations for one shape drift apart; the frontend ends up holding two disagreeing types (generated vs imported).
- **Enforcement:** review (grep the contracts lib for every new DTO schema).
