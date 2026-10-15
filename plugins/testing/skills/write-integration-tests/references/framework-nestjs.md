# NestJS — Integration Testing Patterns

Framework-specific patterns for **NestJS** integration tests. Read **on top of** `core.md` (universal principles) and the active `runner-<runner>.md` (runner syntax — typically `runner-vitest.md` or `runner-jest.md` for Nest).

The integration tier for Nest bootstraps a real `TestingModule` via `@nestjs/testing`, runs the full DI container with real controllers / services / pipes / guards / interceptors / middleware / filters, and drives the in-process HTTP server with **supertest**. External IO is faked at provider-override seams; no real Postgres / Redis / brokers unless `overrides.md` documents a testcontainers carve-out.

---

## §6 additions for NestJS

These extend the universal §6 forbid-list in `core.md`:

| Not tested at integration tier | Why | Where it gets tested instead |
|---|---|---|
| **NestJS framework internals** — that `Module` metadata is read, that the DI container resolves circular deps, that `@Injectable()` decorators fire | Owned by Nest. | Never. Trust the framework. |
| **Single-provider business logic** — `OrderService.computeTotal()` with all collaborators mocked | One class — that's the unit tier. | Unit test. |
| **Decorator behaviour** — `@Body()`, `@Query()`, `@Headers()` mapping request fields to handler args | Framework wiring; tested implicitly when the controller receives a valid request and produces a response. | Never as a standalone assertion. |
| **Pipe internals** — that `ValidationPipe` strips unknown properties, that `ParseIntPipe` throws on non-numeric | Nest-owned. Test that **your** wired-together flow rejects an invalid payload with the expected status / shape — not the pipe's internals. | Unit test for custom pipes; never for built-ins. |
| **Built-in interceptor / filter behaviour** — `ClassSerializerInterceptor`, `HttpExceptionFilter` defaults | Nest-owned. | Never. |
| **Microservice transport internals** — that `@MessagePattern` routes a Kafka message | Transport-owned. Integration test verifies the handler runs on a faked message; the transport is faked. | Contract test if transport drift is a concern. |

---

## Bootstrap template (NestJS + supertest)

The standard shape. Boot in `beforeAll`, tear down in `afterAll`, drive with `supertest` per `it(...)`.

```ts
/**
 * Integration spec for the orders controller (POST /orders).
 *
 * Scenarios:
 *   - returns 201 with the created order on a valid payload
 *   - returns 400 with field errors on invalid payload
 *   - returns 401 when the bearer token is missing
 *   - rolls back the in-memory repo when the publish step throws
 *
 * Strategy: boot the full OrdersModule with real controllers, services,
 * validators, interceptors, and guards. OrderRepo is overridden to an
 * in-memory implementation; EventPublisher is overridden to a spy. supertest
 * drives requests against the in-process Nest app — no port, no containers.
 */

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrdersModule } from './orders.module';
import { OrderRepo } from './order.repo';
import { InMemoryOrderRepo } from '../../../testing/in-memory-order-repo';
import { EventPublisher } from '../../shared/event-publisher';

describe('OrdersController (integration)', () => {
  let app: INestApplication;
  let repo: InMemoryOrderRepo;
  let publishSpy: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    publishSpy = vi.fn();

    const module = await Test.createTestingModule({
      imports: [OrdersModule],
    })
      .overrideProvider(OrderRepo).useClass(InMemoryOrderRepo)
      .overrideProvider(EventPublisher).useValue({ publish: publishSpy })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    repo = module.get(OrderRepo) as unknown as InMemoryOrderRepo;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repo.reset();
    publishSpy.mockReset();
  });

  describe('POST /orders', () => {
    it('returns 201 with the created order on a valid payload', async () => {
      const res = await supertest(app.getHttpServer())
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
});
```

**Key points:**

- `Test.createTestingModule({ imports: [<your real module>] })` — import the **production** module, not a hand-assembled test module. The real module brings the real controllers, services, pipes, guards, interceptors, providers, and DI wiring.
- `.overrideProvider(...).useClass(...)` / `.useValue(...)` — replace **only external IO providers**. Repo (DB seam), Publisher (broker seam), HTTP clients (vendor SDK seam), clock providers (time seam). Never override an internal service.
- `app.useGlobalPipes(...)` and other global wiring — replicate **production** `main.ts` configuration. If production sets `ValidationPipe` globally, the spec must too — otherwise validation behaviour diverges and 400-path tests are testing a different app.
- `await app.init()` — required for middleware / module-init hooks to fire.
- `supertest(app.getHttpServer())` — drives the in-process Express/Fastify adapter. No port is opened.

---

## Adapter choice (Express vs Fastify)

If production uses `NestExpressApplication`, the test must too:

```ts
import { type NestExpressApplication } from '@nestjs/platform-express';

app = module.createNestApplication<NestExpressApplication>();
```

Same for `NestFastifyApplication`. The default `createNestApplication()` returns the Express adapter; if production runs Fastify, the test will behave differently from production for middleware ordering and request mutation. Confirm the adapter in `overrides.md`.

---

## DI overrides — what to fake, what to leave real

### Override at these seams (external IO)

- **Repository / DAO classes** — replace with `InMemoryXxxRepo` implementing the same interface. Keep the production interface; only swap the adapter.
- **Event publishers / message bus clients** — replace with a spy: `{ publish: vi.fn() }`.
- **HTTP client wrappers** (services that wrap `HttpService` / `fetch` for outbound calls) — replace with a spy returning fixture responses, or mock the wrapper module via `vi.mock`.
- **Third-party SDK wrappers** (`SentryService`, `StripeService`, `S3Service`) — replace with a spy.
- **Clock / `Date.now()` providers** — if production injects a `Clock` provider, override it; otherwise use the runner's fake-timer abstraction.
- **Logger** — replace with a spy (`{ log: vi.fn(), error: vi.fn(), warn: vi.fn() }`) when the spec asserts on log calls; otherwise leave the real `pino-pretty` / `Logger` in place but pipe to a `/dev/null`-equivalent sink to keep CI output clean.
- **Config providers** (`ConfigService`) — usually leave **real**, but ensure `process.env` is set deterministically per spec (set in `beforeAll`, restore in `afterAll`).

### Leave real

- Controllers (always — they're the integration entry seam).
- Application services orchestrating the use case.
- Domain services, validators, mappers.
- Pipes, interceptors, guards, exception filters — including custom ones.
- Middleware (CORS, body-parser, correlation-id, auth-token extraction).
- DTO classes (`class-validator` decorators are real).

### Forbidden override targets

- **Internal application service** that the controller delegates to — overriding it converts the spec into a fancy unit test for the controller alone.
- **Validators / pipes** — if the spec wants to skip validation, the spec is wrong; either supply a valid payload or assert on the validation-failure response.
- **Guards** — if a route is auth-guarded, the spec supplies a valid token in the request header. Overriding the guard hides whether auth is wired correctly.

---

## supertest patterns

```ts
import supertest from 'supertest';

// GET
const res = await supertest(app.getHttpServer()).get('/orders/abc').set('Authorization', 'Bearer t');

// POST with JSON body
const res = await supertest(app.getHttpServer()).post('/orders').send({ items: [] });

// Headers
.set('X-Correlation-Id', 'req-1')

// Query params
.query({ page: 2, limit: 50 })

// File upload (multipart)
.attach('file', Buffer.from('content'), 'fixture.csv')

// Cookies
.set('Cookie', ['session=fake-session-id'])
```

Assert on `res.status`, `res.body`, `res.headers`. Avoid asserting on `res.text` for JSON endpoints — use `res.body` with structural matchers.

---

## Pino / logger redaction integration testing

For projects with structured logging + redaction (sensitive fields stripped from log records), test the redaction config separately from the full HTTP path:

```ts
import { Writable } from 'node:stream';
import pino from 'pino';
import { buildPinoLoggerOptions, buildPinoRedactPaths } from './pino.config';

function buildTestLogger(): { logger: pino.Logger; getLines: () => Record<string, unknown>[] } {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); },
  });
  const logger = pino(
    { level: 'info', redact: { paths: buildPinoRedactPaths(), remove: true } },
    sink,
  );
  return {
    logger,
    getLines: () => chunks.flatMap(c => c.split('\n')).filter(l => l.trim()).map(l => JSON.parse(l)),
  };
}

it('strips banned fields', () => {
  const { logger, getLines } = buildTestLogger();
  logger.info({ amount: 100, profile_id: 'abc' }, 'transaction created');
  const [line] = getLines();
  expect(line).not.toHaveProperty('amount');
  expect(line).toHaveProperty('profile_id', 'abc');
});
```

This is an integration test of the **redaction config**, not of HTTP. It imports the production config builders directly and exercises them through Pino's real serializer — no Nest boot needed. Faster than booting the whole app for a serializer-only assertion.

---

## Correlation-ID middleware / request-scoped state

Middleware that mutates the request object (correlation ID, auth context) is verified by the response. Boot the full module, drive a request with / without the input header, and assert on the response header / body:

```ts
it('echoes a supplied X-Correlation-Id', async () => {
  const supplied = '0190af3b-1234-7000-8abc-abcdef012345';
  const res = await supertest(app.getHttpServer()).get('/').set('X-Correlation-Id', supplied);
  expect(res.headers['x-correlation-id']).toBe(supplied);
});

it('generates UUIDv7 when X-Correlation-Id is absent', async () => {
  const res = await supertest(app.getHttpServer()).get('/');
  const UUIDV7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect(res.headers['x-correlation-id']).toMatch(UUIDV7_RE);
});
```

---

## In-memory repository pattern

The default DB fake. Implements the production repository interface:

```ts
// testing/in-memory-order-repo.ts
import { type Order, type OrderRepo } from '../src/orders/order.repo';

export class InMemoryOrderRepo implements OrderRepo {
  private store = new Map<string, Order>();

  async save(o: Order): Promise<Order> {
    this.store.set(o.id, o);
    return o;
  }

  async findById(id: string): Promise<Order | null> {
    return this.store.get(id) ?? null;
  }

  reset(): void {
    this.store.clear();
  }
}
```

This adapter:
- Lives in the project's testing toolkit (path in `overrides.md`).
- Implements the exact production interface — if the interface changes, the adapter breaks at compile time.
- Has a `reset()` method called in `beforeEach`.
- Is registered via `.overrideProvider(OrderRepo).useClass(InMemoryOrderRepo)`.

Builders / factories for fixture entities live alongside (`buildOrder({ overrides })`); the spec body inserts via `await repo.save(buildOrder({ ownerId: 'u-1' }))` rather than hand-assembling objects.

---

## Microservice / message-driven integration

When the integration seam is a `@MessagePattern` handler instead of HTTP:

```ts
const app = module.createNestMicroservice({ /* fake transport */ });
await app.listen();

// Drive by invoking the handler directly through the DI-resolved controller,
// or through a fake transport that emits a synthetic message.
```

Prefer driving the handler through the DI-resolved controller method with a constructed message DTO — that exercises the same code-path as a real broker delivery without the transport in the loop. Mock the outbound side (downstream publishers, repo writes) at the boundary.

---

## Containers / live external dependencies

**Default: no containers.** Per `core.md` §3.1, testcontainers / docker-compose / live Postgres-Redis-Kafka are opt-in per project, documented in `overrides.md` with the container manifest, orchestration entry point, and which subjects the carve-out applies to.

When a project does have the carve-out and the test target is "exercise the real Postgres adapter, not the in-memory one":

- Use a dedicated Nx target (e.g. `test:integration:live`) that runs separately from the default `test` target.
- Each test runs in its own transaction (begin → run → rollback) so the DB stays clean.
- Builders insert fixtures via the same production code-path the spec exercises — don't reach into the DB with raw SQL.
- Document container start-up cost in the spec header; if it's > 5s, group all live-DB specs into one file with a single `beforeAll` boot.

---

## Gotchas (NestJS-specific)

### Global pipes / interceptors / filters

If production registers global pipes (`app.useGlobalPipes(new ValidationPipe(...))`) in `main.ts`, the spec must register them too. Otherwise validation tests pass on a different app than runs in production. Same for global interceptors and filters.

### Module-scoped vs request-scoped providers

A `@Injectable({ scope: Scope.REQUEST })` provider is instantiated per request — the spec must not hold a reference resolved at boot time (it'll be stale by the first request). Resolve request-scoped providers through `module.resolve(...)` inside the test, or assert on the observable response.

### Async module imports

`forRootAsync(...)` patterns inject `ConfigService` at boot time. The spec must provide a `ConfigService` (or set `process.env`) **before** `module.compile()`. Setting env vars in `beforeEach` after compile won't take effect.

### Express adapter `bodyParser` default

`createNestApplication()` enables body-parser by default. If production disables it (`NestFactory.create(AppModule, { bodyParser: false })`) and adds a custom parser, the spec must replicate that — otherwise large-payload / streaming tests pass in CI but fail in prod.

### `@nestjs/testing` resolution order

`.overrideProvider(...)` only overrides **registered providers**. If the provider is imported from a sub-module, the override must target the same DI token. Use `useExisting` if production aliases tokens.

### Reflection metadata

If `tsconfig` lacks `emitDecoratorMetadata: true` in the spec's compilation, `@nestjs/common` decorators silently misbehave. Confirm in `overrides.md`. On Vitest, the SWC plugin must enable `transform.decoratorMetadata: true` (see `apps/api/vitest.config.ts` in finance-app for a working example).
