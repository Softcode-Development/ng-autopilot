---
paths:
  - "apps/api/**"
  - "prisma/**"
  - "**/*.repository.ts"
---

# Backend performance

## Database
- N+1: lists with related records use `include` / `select`; watch for `findMany` followed by per-row `findUnique` in a loop.
- Every tenant column (`<tenant>_id`) is indexed in the migration that adds it; composite indexes for common predicates (`<tenant>_id, created_at DESC`).
- List endpoints project explicitly (`select`) and paginate (cursor preferred); unbounded results are not allowed.
- Transactions never wrap external calls — push side effects outside the transaction so row locks stay short.
- Raw queries are parameterised (`Prisma.sql` or the ORM's equivalent).
- Statement and transaction timeouts are set; pool starvation under load is the failure mode.

## Request path
- No synchronous file I/O or heavy CPU work on the request path — async APIs or a worker.
- Logger transports run off the event loop (worker-thread transports), never synchronous file/HTTP writes.
- Rate limiters on multi-instance deploys use a shared store (Redis), not memory.
- Long-running work goes to a queue; the handler acknowledges immediately.
- No per-request data on module-level singletons.

## When you find a performance bug
Measure first (query logs, `EXPLAIN ANALYZE`, timings), fix the cheapest cause (a missing index beats a cache), and record the before/after numbers.
