---
paths:
  - "apps/api/**"
  - "**/*.controller.ts"
  - "**/*.repository.ts"
  - "**/dto/**"
---

# NestJS backend conventions

## Shape
```
apps/api/src/
├── core/        config, logger, database client, http (filters), security, observability
├── shared/      decorators, pipes, guards, interceptors, base DTOs
└── features/<feature>/
    ├── <feature>.module.ts       one module per feature, imported once into AppModule
    ├── <feature>.controller.ts   thin: validate, delegate, return DTO
    ├── <feature>.service.ts      stateless domain logic
    ├── <feature>.repository.ts   owns every database call
    ├── dto/                      schema + inferred type per request/response
    ├── models/
    └── index.ts                  barrel; callers never reach into internals
```

## Layers
```
Controller → Service → Repository → ORM
   ↑            ↑
  DTO       Domain types
```
- Controllers know HTTP, DTOs and one service. No business logic.
- Services know domain types and one or more repositories. Services never touch the ORM.
- Repositories know the ORM and translate to domain types. **ORM types never leak** past the repository.

## Validation and config
- One schema library end to end (e.g. Zod via `nestjs-zod`), with a global validation pipe. Every DTO and entity has a schema; the type is inferred from it — no hand-rolled payload types.
- Env config is validated by a schema at boot; a missing required secret fails boot fast.

## Performance
- List endpoints are cursor-paginated (no `OFFSET`).
- N+1 is prevented in the repository (explicit `include`/`select`).
- Hot reads may be cached where consistency allows.
- Background work goes to a queue — never block the request loop.

## Logging
- Structured logger with request correlation ids. No `console.log` outside the bootstrap file.
