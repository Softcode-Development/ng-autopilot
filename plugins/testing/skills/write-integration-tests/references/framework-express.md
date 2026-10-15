# Express / Fastify — Integration Testing Patterns

Framework-specific patterns for **bare Express** and **bare Fastify** integration tests using **supertest**. Read **on top of** `core.md` (universal principles) and the active `runner-<runner>.md` (runner syntax — typically `runner-vitest.md` or `runner-jest.md`).

This file covers projects that don't use NestJS — bare Express / bare Fastify / Koa / Hapi servers. For NestJS apps, use `framework-nestjs.md` (which also uses supertest but bootstraps differently via `@nestjs/testing`).

The integration tier here builds the production `app` (Express `Application` or Fastify `FastifyInstance`) with **all production middleware and routes wired**, then drives it with supertest. External IO (DB, cache, queue, third-party SDKs) is faked at the same seams the production code injects them — typically via factory functions or DI containers like `awilix` / `tsyringe`.

---

## §6 additions for Express / Fastify

These extend the universal §6 forbid-list in `core.md`:

| Not tested at integration tier | Why | Where it gets tested instead |
|---|---|---|
| **Express / Fastify framework internals** — that `express.json()` parses bodies, that `fastify.register(plugin)` adds a hook | Owned by the framework. | Never. |
| **Middleware internals when not custom** — `cors()`, `helmet()`, `cookie-parser` default behaviour | Owned by the middleware. Test that **your** wired-together flow produces the expected response shape when the middleware is in the chain. | Never as a standalone assertion. |
| **Route-handler logic with all collaborators mocked** | If every collaborator is mocked, it's a unit test. | Unit test. |
| **DB driver internals** — that `pg` parses a `BEGIN` statement, that Mongoose constructs a query | Owned by the driver. | Never. |
| **Plugin internals** — Fastify plugins from the ecosystem (`@fastify/cors`, `@fastify/jwt`) | Owned by plugin. Test the wired-together effect through the seam. | Never. |

---

## Bootstrap template — Express + supertest

The standard shape: production `app` factory, real middleware chain, swap external IO at the factory's seam.

```ts
/**
 * Integration spec for the /orders router.
 *
 * Scenarios:
 *   - POST /orders returns 201 with the created order on a valid payload
 *   - POST /orders returns 400 with field errors on invalid payload
 *   - POST /orders returns 401 when the bearer token is missing
 *   - GET /orders/:id returns 404 when the order does not exist
 *   - POST /orders rolls back the in-memory repo when the publish step throws
 *
 * Strategy: build the production Express app via createApp({ deps }) with
 * real routes, real middleware (auth, body parser, error handler), real
 * validators. Deps are swapped at the factory seam: InMemoryOrderRepo,
 * spy EventPublisher, fixed clock. supertest drives the in-process app —
 * no port, no containers.
 */

import { type Application } from 'express';
import supertest from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app';
import { InMemoryOrderRepo } from '../../testing/in-memory-order-repo';
import { fixedClock } from '../../testing/clocks';

describe('POST /orders (integration)', () => {
  let app: Application;
  let repo: InMemoryOrderRepo;
  let publishSpy: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    repo = new InMemoryOrderRepo();
    publishSpy = vi.fn();
    app = createApp({
      deps: {
        orderRepo: repo,
        eventPublisher: { publish: publishSpy },
        clock: fixedClock('2026-01-01T00:00:00Z'),
      },
    });
  });

  beforeEach(() => {
    repo.reset();
    publishSpy.mockReset();
  });

  it('returns 201 with the created order on a valid payload', async () => {
    const res = await supertest(app)
      .post('/orders')
      .set('Authorization', 'Bearer fake-token')
      .send({ items: [{ sku: 'A', qty: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      state: 'pending',
    });
    expect(publishSpy).toHaveBeenCalledOnce();
  });
});
```

**Key points:**

- `createApp({ deps })` — the production app factory exposes a dep-injection seam. If the production code constructs the app with all deps hardcoded (`new Pool({...})` inline), the spec must surface this as a "production code needs a factory before this is testable" finding rather than monkey-patching imports.
- All middleware in the production chain runs — auth, body parser, validators, error handler.
- `supertest(app)` — bare Express app, no `app.listen()` needed. Supertest constructs an in-process server for each test.
- Deps swapped at the seam — same shape as NestJS DI overrides, but using factory-injection instead of `.overrideProvider(...)`.

---

## Bootstrap template — Fastify + supertest

```ts
import { type FastifyInstance } from 'fastify';
import supertest from 'supertest';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    deps: {
      orderRepo: new InMemoryOrderRepo(),
      eventPublisher: { publish: vi.fn() },
    },
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

it('returns 201 on a valid payload', async () => {
  const res = await supertest(app.server)
    .post('/orders')
    .set('Authorization', 'Bearer fake-token')
    .send({ items: [{ sku: 'A', qty: 2 }] });

  expect(res.status).toBe(201);
});
```

Or with Fastify's built-in `inject` (preferred for Fastify projects — no supertest dependency needed):

```ts
const res = await app.inject({
  method: 'POST',
  url: '/orders',
  headers: { Authorization: 'Bearer fake-token' },
  payload: { items: [{ sku: 'A', qty: 2 }] },
});

expect(res.statusCode).toBe(201);
expect(res.json()).toMatchObject({ id: expect.any(String), state: 'pending' });
```

`app.inject(...)` is faster than supertest for Fastify because it skips the HTTP layer entirely. Use it unless `overrides.md` mandates supertest for consistency with other parts of the codebase.

---

## What to override (external IO) vs what to leave real

### Override at these seams

- **Database connection / repository / DAO** — replace with in-memory implementation (`InMemoryOrderRepo` implementing the production `OrderRepo` interface). For raw `pg` / Mongoose / Knex usage, the production code should wrap DB access in a repository class; if it doesn't, propose the refactor before writing the integration spec.
- **Message broker / queue producer** — replace with a spy (`{ publish: vi.fn() }`).
- **Cache client** (Redis client wrapper) — replace with an in-memory `Map`-backed adapter.
- **Outbound HTTP** — mock via `nock` (Node-level HTTP intercept) or replace the HTTP-client wrapper at the seam.
- **Third-party SDKs** (Stripe, Twilio, AWS SDK, Sentry) — mock the module via the runner's module-mock primitive.
- **Clock** — inject a fixed `Clock` ({ now() }) or use the runner's fake timers.
- **Auth / JWT verifier** — leave the **real** verifier in place; supply a real signed token in the test. Replacing the verifier hides whether auth is wired correctly.

### Leave real

- All routes / route handlers.
- All middleware in the production chain — auth, validators, error handler, request-logger, correlation-id, body-parser, CORS.
- All application services orchestrating the use case.
- Domain logic, validators, mappers.

### Forbidden override targets

- **Internal application service** the route handler delegates to.
- **The auth middleware itself** — supply a valid token; if you find yourself bypassing auth in the test, the spec is wrong.
- **The error handler** — production's error-shape contract is part of what integration tests verify.

---

## In-memory repository pattern (no DI container)

When the project doesn't use a DI container, the production app factory accepts deps as an object:

```ts
// src/app.ts
import express from 'express';
import { type OrderRepo } from './order.repo';
import { type EventPublisher } from './event-publisher';
import { type Clock } from './clock';
import { ordersRouter } from './orders.router';

export interface AppDeps {
  orderRepo: OrderRepo;
  eventPublisher: EventPublisher;
  clock: Clock;
}

export function createApp({ deps }: { deps: AppDeps }) {
  const app = express();
  app.use(express.json());
  app.use('/orders', ordersRouter(deps));
  app.use(errorHandler);
  return app;
}
```

The integration test constructs `createApp({ deps: { orderRepo: new InMemoryOrderRepo(), ... } })`. The production `index.ts` constructs the same `createApp({ deps: { orderRepo: new PgOrderRepo(pool), ... } })`. **Same code path; different adapter.**

If the production app doesn't have this seam, it's a testability finding — escalate before authoring the integration spec.

---

## DI containers (awilix / tsyringe / inversify)

For projects with a DI container, the integration test builds the container with test-bound adapters:

```ts
// testing/build-test-container.ts
import { asClass, asValue, createContainer } from 'awilix';
import { InMemoryOrderRepo } from './in-memory-order-repo';

export function buildTestContainer(overrides = {}) {
  const container = createContainer();
  container.register({
    orderRepo: asClass(InMemoryOrderRepo).singleton(),
    eventPublisher: asValue({ publish: vi.fn() }),
    clock: asValue(fixedClock('2026-01-01T00:00:00Z')),
    ...overrides,
  });
  return container;
}
```

The production app factory accepts the container; the test injects the test container.

---

## Authn / authz in integration specs

**Always supply a real signed token in tests.** Don't bypass auth middleware:

```ts
import { sign } from 'jsonwebtoken';

const validToken = sign({ sub: 'user-1', scope: ['orders:write'] }, process.env.JWT_SECRET ?? 'test-secret');

await supertest(app).post('/orders').set('Authorization', `Bearer ${validToken}`).send(...);
```

The JWT secret comes from `process.env.JWT_SECRET` set in the test setup (`beforeAll`) and restored in `afterAll`. The test exercises the **real verifier** with a **real token** — verifying the wiring works.

For tests of **failure cases** (missing token, invalid token, expired token):

```ts
// Missing
await supertest(app).post('/orders').send(...).expect(401);

// Invalid
await supertest(app).post('/orders').set('Authorization', 'Bearer not-a-jwt').send(...).expect(401);

// Expired
const expired = sign({ sub: 'u-1' }, secret, { expiresIn: '-1h' });
await supertest(app).post('/orders').set('Authorization', `Bearer ${expired}`).send(...).expect(401);
```

---

## nock for outbound HTTP

When the production code wraps `node-fetch` / `axios` / `undici` in a service that the integration test wants to exercise without hitting the real upstream:

```ts
import nock from 'nock';

beforeEach(() => nock.cleanAll());
afterEach(() => {
  if (!nock.isDone()) {
    nock.cleanAll();
    throw new Error('Pending nock interceptors not consumed');
  }
});

it('publishes to the webhook endpoint when an order is placed', async () => {
  const scope = nock('https://hooks.example.com')
    .post('/webhooks/orders', body => body.orderId === expect.any(String))
    .reply(200, { received: true });

  const res = await supertest(app).post('/orders').set('Authorization', `Bearer ${validToken}`).send({ items: [...] });

  expect(res.status).toBe(201);
  expect(scope.isDone()).toBe(true);
});
```

**Important**: configure nock with `disableNetConnect()` in test setup so any unmocked outbound HTTP throws loudly:

```ts
beforeAll(() => {
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1'); // allow supertest's in-process requests
});

afterAll(() => nock.enableNetConnect());
```

Alternatives: MSW also supports Node-level interception (`setupServer` from `msw/node`) and is often preferred over nock when the project already uses MSW elsewhere.

---

## Error handler integration

The production error handler converts thrown errors into HTTP responses with a specific shape (`{ error: { code, message, requestId } }`). The integration test exercises this:

```ts
it('returns a 500 with the standard error shape when the publisher throws', async () => {
  publishSpy.mockRejectedValueOnce(new Error('broker down'));

  const res = await supertest(app)
    .post('/orders')
    .set('Authorization', `Bearer ${validToken}`)
    .send({ items: [{ sku: 'A', qty: 1 }] });

  expect(res.status).toBe(500);
  expect(res.body).toMatchObject({
    error: { code: 'INTERNAL', message: expect.any(String), requestId: expect.any(String) },
  });
});
```

The error handler stays real; the wired-together response is asserted at the seam.

---

## Request-scoped state (correlation ID, request logger)

For middleware that mutates the request object or response headers, assert on the response:

```ts
it('echoes a supplied X-Correlation-Id', async () => {
  const supplied = '0190af3b-1234-7000-8abc-abcdef012345';
  const res = await supertest(app).get('/health').set('X-Correlation-Id', supplied);
  expect(res.headers['x-correlation-id']).toBe(supplied);
});

it('generates a correlation ID when the header is absent', async () => {
  const res = await supertest(app).get('/health');
  expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
});
```

---

## Containers / live DB

**Default: no containers** per `core.md` §3.1. The in-memory repo pattern is the default for Express/Fastify projects too.

When `overrides.md` documents a testcontainers carve-out for a specific subject (e.g. testing that an `ON CONFLICT` clause resolves correctly under real Postgres), the spec lives in a dedicated file with its own `beforeAll` boot, runs on a dedicated Nx / npm target (`test:integration:live`), uses per-test transactions for isolation, and is excluded from the default PR run.

---

## Gotchas (Express / Fastify-specific)

### `supertest(app)` vs `supertest(app.server)`

- Express: `supertest(app)` — passes the Express `Application` directly.
- Fastify: `supertest(app.server)` — passes the underlying Node HTTP server (must call `await app.ready()` first).

Mixing these is a common bug. The error is usually obscure ("supertest expected function, got object").

### `app.close()` for Fastify

Fastify holds open connections by default. Always `await app.close()` in `afterAll`. Skipping this leaks file descriptors across spec files and eventually crashes the runner with EMFILE.

### `process.env` mutation

If the production app reads env vars at construction time, set them **before** `createApp(...)`. Mutating `process.env` after the app is built has no effect. Reset env vars in `afterAll` to avoid leaking into other spec files.

### Body parser conflicts

If production uses `express.json()` with a `limit` option, the test must too. Specs that send large payloads fail with a different error in test than in prod when the test app has the default 100kb limit but prod has 1mb.

### Async error handling

Express does not auto-catch async errors thrown in route handlers unless the project uses `express-async-errors` or wraps handlers in a `try/catch → next(err)` pattern. If the integration test asserts that a thrown error produces a 500, the production code must actually route the error to the error handler. Otherwise the spec sees an unhandled promise rejection and the runner reports a different failure mode.

### Test isolation when sharing an `app`

The same `app` instance built once in `beforeAll` is reused across tests. **In-memory state must be reset in `beforeEach`** — otherwise the second test sees fixtures from the first. The reset goes on the in-memory adapter (`repo.reset()`), not the app.

### Port collisions

`supertest(app)` does not bind a port — the in-process server is ephemeral. If a spec calls `app.listen(3000)` somewhere (don't), parallel test files will fight for port 3000. Never call `app.listen` in integration specs.

### `helmet()` and CSP headers

If production enables `helmet()` with default CSP, supertest responses include CSP headers. Tests that assert on response headers must account for them — or whitelist only the headers the test cares about (use `expect.objectContaining(...)` on `res.headers`).
