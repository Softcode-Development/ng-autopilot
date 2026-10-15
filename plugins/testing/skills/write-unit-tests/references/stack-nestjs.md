# NestJS Stack — Unit Testing Patterns

Framework-specific patterns for **NestJS** applications (any version with class-based providers — typically Nest 9+). Read **on top of** `core.md` (universal principles) and the active `runner-<runner>.md` (typically `runner-vitest.md` or `runner-jest.md` for Nest).

The integration tier for NestJS is documented separately at the testing plugin's `skills/write-integration-tests/references/framework-nestjs.md`. **The two tiers test different things**:

- **Unit (this file)**: one class in isolation. Direct construction with mocked constructor args. No `Test.createTestingModule`, no supertest, no decorator wiring.
- **Integration (`framework-nestjs.md`)**: the wired-together feature slice. Real `TestingModule` boots the controller + service + pipes + guards + interceptors; supertest drives requests; the boundary fakes external IO.

If a test feels like it needs `@nestjs/testing`, you're at the wrong tier — escalate to integration.

---

## §6 additions for NestJS

These extend the universal §6 forbid-list in `core.md`:

| Not tested at unit tier | Why | Where it gets tested instead |
|---|---|---|
| **DI container behaviour** — that providers resolve, that `@Injectable()` registers, that circular deps fail at boot | Owned by NestJS. | Never. Trust the framework. Boot failures surface at app startup. |
| **Decorator wiring** — that `@Body()` populates the parameter, `@Query()` parses, `@Headers('x-foo')` reads, `@Param('id')` extracts | Framework wiring. Decorators don't *run* outside a request; testing them at unit tier requires fabricating a fake request lifecycle. | Integration tier (boot the controller via `TestingModule`, drive with supertest). |
| **Built-in pipe behaviour** — that `ValidationPipe` strips unknown fields, `ParseIntPipe` throws on non-numeric, `ParseUUIDPipe` rejects malformed UUIDs | Nest-owned. Asserting these is asserting framework code. | Integration tier verifies the wired-together flow rejects invalid input. |
| **Built-in guard / interceptor / filter behaviour** — `AuthGuard('jwt')` defaults, `ClassSerializerInterceptor`, the default `ExceptionFilter` | Nest-owned. | Never. |
| **Module metadata** — that `@Module({ imports: [...], providers: [...] })` lists the right items | Declarative config. Drift caught by boot or by integration tier. | Never via unit; integration tier exercises the wiring. |
| **`@nestjs/config` schema validation** — that the env schema rejects an invalid env | Validation is owned by the schema library (Joi/Zod). Test the schema with a pure-function unit, not via a NestJS bootstrap. | Unit test the schema function directly. |
| **`@nestjs/throttler` / rate-limiting** — that the throttler actually throttles | Nest-owned. | Integration if request behaviour matters; never at unit. |
| **Lifecycle hook invocation order** — that `OnModuleInit` fires before `OnApplicationBootstrap` | Nest-owned. Trust the framework. | Never. The *contents* of your hook method are unit-testable via direct call (see §3 below). |

The rule of thumb: **if a unit test would require `Test.createTestingModule(...)` to express, it's the wrong tier**. A NestJS unit test should look like a plain-class TypeScript unit test — just constructor + mocks.

---

## File structure template (NestJS service)

The standard shape. No TestBed, no TestingModule, no DI container — construct the class directly with mocked collaborators.

```ts
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { TransactionsService } from './transactions.service';
import type { TransactionsRepo } from './transactions.repo';
import type { Logger } from 'nestjs-pino';

// Behaviours covered:
// - creates a transaction with the household id from context
// - rejects when amount is negative
// - logs structured payload on failure (no PII)

describe('TransactionsService', () => {
  let subject: TransactionsService;
  let repo: { create: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
  let logger: Pick<Logger, 'error' | 'warn' | 'log'>;

  beforeEach(() => {
    repo = {
      create: vi.fn(),
      findOne: vi.fn(),
    };
    logger = {
      error: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
    };
    subject = new TransactionsService(repo as unknown as TransactionsRepo, logger as Logger);
  });

  describe('<behaviour group>', () => {
    it('does X when Y', () => {
      // Arrange / Act / Assert
    });
  });
});
```

Key points:

- **Direct `new SubjectClass(...)` construction.** No DI container. If the subject's constructor signature is awkward to call directly, the dependencies are poorly factored — surface as a testability finding.
- **Mock by interface, not by class.** Use `Pick<Logger, 'error' | 'warn'>` or a hand-rolled `type RepoMock = { ... }`, not `Mock<TransactionsRepo>`. The unit test should not care which class the production code's collaborator happens to be — only what method shape it consumes.
- **Cast at the constructor boundary.** `repo as unknown as TransactionsRepo` is the one allowed `as unknown as` cast at this seam, because it's narrowing a structural mock to the production class's nominal type. `core.md §6`'s ban on double-casts targets test-body assertions, not boundary handle setup. Document the cast at the toolkit seam, not in every spec.
- **Type the mock with `ReturnType<typeof vi.fn>`** (or your runner's equivalent) to keep arg/return inference working when the spy is called inside the test.

---

## Component testing strategy

### Services (`@Injectable()`)

Direct construction + mocked collaborators. This is the default NestJS unit pattern.

```ts
const subject = new MyService(repoMock, loggerMock, configMock);
```

If the service has many dependencies, prefer a factory in `libs/shared/testing/nest/` (project-specific path; see `overrides.md`):

```ts
// In the project's testing toolkit
export function buildTransactionsService(overrides: Partial<Deps> = {}): TransactionsService {
  return new TransactionsService(
    overrides.repo ?? buildRepoMock(),
    overrides.logger ?? buildLoggerMock(),
    overrides.config ?? buildConfigMock(),
  );
}

// In the spec
const subject = buildTransactionsService({ repo: { create: vi.fn().mockResolvedValue(...) } });
```

The factory absorbs the unchanging mocks; the spec passes only what it cares about.

### Controllers (`@Controller()`)

Controllers are unit-testable as plain classes — `@Controller`, `@Get`, `@Post` decorators don't run outside a request. Construct directly and call the method:

```ts
const subject = new TransactionsController(serviceMock);
const result = await subject.create({ amount: 100, currency: 'EUR' }, householdContext);
expect(result).toEqual({ id: 'tx-1', ... });
```

But this is rarely useful. Controllers are usually thin pass-throughs (`return this.service.create(...)`); unit-testing them often violates `core.md` §3's stub-passes rule (the test would still pass with a stub returning the same shape). **Default: don't unit-test controllers. Test their wired behaviour at the integration tier**.

Exception: a controller with a non-trivial input transform (e.g. mapping query params to a domain object) is worth a unit test for the transform alone.

### Pipes (`PipeTransform`)

Custom pipes are pure transforms — `transform(value, metadata)` in, transformed value or thrown error out. Unit-test directly:

```ts
const subject = new ParseHouseholdIdPipe();
expect(subject.transform('h_abc123', { type: 'param' })).toBe('h_abc123');
expect(() => subject.transform('invalid', { type: 'param' })).toThrow(BadRequestException);
```

**Don't unit-test built-in pipes** (§6 — Nest-owned).

### Guards (`CanActivate`)

Custom guards are testable by constructing them + passing a fake `ExecutionContext`. The fake context is a toolkit helper, not inline boilerplate:

```ts
// Toolkit helper
export function buildHttpExecutionContext(req: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    getType: () => 'http',
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

// Spec
const subject = new HouseholdScopeGuard(membershipRepoMock);
const ctx = buildHttpExecutionContext({ params: { householdId: 'h_1' }, user: { sub: 'u_1' } });
membershipRepoMock.exists.mockResolvedValue(true);
await expect(subject.canActivate(ctx)).resolves.toBe(true);
```

**Don't unit-test built-in guards** (§6 — `AuthGuard('jwt')`, etc. are Nest-owned).

### Interceptors (`NestInterceptor`)

Custom interceptors are testable by calling `intercept(context, next)` directly. `next` is a `CallHandler` — fake it with an RxJS `of(...)` observable:

```ts
import { of, lastValueFrom } from 'rxjs';

const subject = new CorrelationIdInterceptor();
const ctx = buildHttpExecutionContext({ headers: { 'x-correlation-id': 'cid-1' } });
const result$ = subject.intercept(ctx, { handle: () => of({ ok: true }) });
const result = await lastValueFrom(result$);
expect(result).toEqual({ ok: true });
expect(loggerMock.log).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'cid-1' }));
```

### Exception filters (`ExceptionFilter`)

Custom filters are testable by calling `catch(exception, host)` directly. `host` is an `ArgumentsHost` — same fake pattern as `ExecutionContext`. Assert on the response side-effects (status, body shape) by spying on `host.switchToHttp().getResponse()`.

### Custom decorators

A custom `@CurrentUser()` or `@HouseholdContext()` parameter decorator is typically `createParamDecorator((data, ctx) => ...)`. The decorator function itself is testable as a pure function (export it for testing). The *decorator wiring* — that Nest calls your function with the right `ExecutionContext` on a route — is integration-tier.

### Lifecycle hooks (`OnModuleInit`, `OnApplicationBootstrap`, etc.)

Testable by calling the hook method directly on a constructed instance:

```ts
const subject = new ConfigBootService(configMock, loggerMock);
await subject.onModuleInit();
expect(loggerMock.log).toHaveBeenCalledWith(expect.objectContaining({ event: 'config_loaded' }));
```

**Don't test that the hook *fires* on app boot** — Nest owns that.

### Repositories

If the repo wraps Prisma / TypeORM / Mongoose, the test value is in the **translation logic** between the ORM result and the domain type. The ORM call itself is mocked:

```ts
prismaMock.transaction.findUnique.mockResolvedValue({ id: 'tx-1', amount_minor: 1000n, currency: 'EUR' });
const result = await subject.findById('tx-1');
expect(result).toEqual({ id: 'tx-1', amount: { value: 1000n, currency: 'EUR' } }); // domain shape, not Prisma shape
```

If the repo is a pure pass-through (no translation), there's nothing to unit-test — that's `core.md §3`'s stub-passes rule. Integration tier covers the real Prisma round-trip.

---

## Mock helpers (common NestJS injection tokens)

For every injected dependency, the mock comes from the project's testing toolkit (typical path: `libs/shared/testing/nest/`; confirm against `overrides.md`). Common patterns:

| If the subject injects… | Mock pattern |
|---|---|
| Another `@Injectable()` service | Hand-rolled `{ method1: vi.fn(), method2: vi.fn() }` typed to a `Pick<...>` of the interface |
| `Logger` / `nestjs-pino` `Logger` | `buildLoggerMock()` — returns `{ log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }` |
| `ConfigService` (`@nestjs/config`) | `buildConfigMock({ DATABASE_URL: 'postgres://test' })` — typed `get<T>(key)` returning the seeded value |
| Repository / DAO | In-memory repo from the toolkit (same one the integration tier uses) |
| `EventEmitter2` (`@nestjs/event-emitter`) | `buildEventEmitterMock()` — `{ emit: vi.fn(), on: vi.fn() }` |
| `CACHE_MANAGER` (`@nestjs/cache-manager`) | `buildCacheManagerMock()` — `{ get: vi.fn(), set: vi.fn(), del: vi.fn() }` |
| `HttpService` (`@nestjs/axios`) | `buildHttpServiceMock()` — `{ get: vi.fn(), post: vi.fn() }` returning `of(...)` RxJS observables |
| `ModuleRef` (dynamic provider lookup) | Avoid at unit tier. `ModuleRef` indicates the subject reaches into DI at runtime — refactor to constructor injection, or escalate to integration. |
| `REQUEST` (request-scoped provider) | Avoid at unit tier. Request-scoped providers are integration-tier concerns. |

**Names may differ per project — the shape is the same**: one builder per dependency token, declared once in the toolkit, imported everywhere. Inline mocks in spec files are a `core.md §6` violation.

---

## Logger assertions — Pino structured payloads

NestJS projects typically use `nestjs-pino` for structured logging. Assertions on log calls use structural matchers on the **payload object**, never on the formatted message:

```ts
// ❌ asserts on formatted message
expect(loggerMock.error).toHaveBeenCalledWith('Failed to create transaction: invalid amount');

// ✅ asserts on structured payload
expect(loggerMock.error).toHaveBeenCalledWith(
  expect.objectContaining({
    event: 'transaction_create_failed',
    reason: 'invalid_amount',
    householdId: 'h_1',
  }),
  'Failed to create transaction',
);
```

The second argument (the message string) is asserted only when its content is part of the contract (e.g. a deliberate error identifier); skip it otherwise. `core.md §13` no-PII rules apply — assert `has_email: true`, never the email itself.

---

## Async patterns

NestJS services are **plain async functions** — no Angular `Zone`, no `fakeAsync` wrapper. Standard async/await with the runner's fake-timer abstraction is enough:

```ts
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('debounces stat collection', async () => {
  await subject.recordEvent('a');
  await vi.advanceTimersByTimeAsync(299);
  expect(statsMock.publish).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(statsMock.publish).toHaveBeenCalledOnce();
});
```

Use the runner's `Async` timer variants (`advanceTimersByTimeAsync` in Vitest, `jest.advanceTimersByTimeAsync` in Jest) when the timer callback awaits a Promise — see `runner-<runner>.md`.

**Don't use `fakeAsync` / `tick` from `@angular/core/testing` in NestJS specs.** That's an Angular-zone construct; importing it pulls in zone.js, which has no place in a Nest unit test.

---

## RxJS in NestJS subjects

NestJS uses RxJS internally (`@nestjs/axios` returns `Observable<AxiosResponse<T>>`, interceptors return `Observable<unknown>`). For multi-emission streams, use the runner's marble-test abstraction (`TestScheduler` from `rxjs/testing`) — see `runner-<runner>.md`. For single-emission `of(...)` patterns, plain `await lastValueFrom(observable$)` is fine.

---

## Gotchas (NestJS-specific)

### `Reflect.getMetadata` reads at runtime

If the subject reads its own decorator metadata (`Reflect.getMetadata('path', target)`), the unit test will hit `undefined` because `reflect-metadata` is loaded by Nest's bootstrap, not by a bare spec. Either:

- Import `'reflect-metadata'` at the top of the spec file (and confirm it doesn't break test isolation), or
- Refactor the subject to receive its metadata via constructor args. Metadata-reading code is usually a smell — integration tier owns "did the framework wire this metadata correctly".

### `@Injectable({ scope: Scope.REQUEST })` providers

Request-scoped providers receive a fresh instance per request. At unit tier, you construct one instance; there's no request to inject. If the subject relies on per-request state (`@Inject(REQUEST) req`), unit testing requires faking the `REQUEST` value — but the test is now exercising request-scope behaviour, which is integration territory. Surface as a testability finding if the subject's logic depends on request-scope plumbing.

### `forwardRef(() => OtherService)` circular deps

If the constructor uses `forwardRef`, the production code has a circular dependency. The unit test sees only the injected handle — there's no circular issue at construction time. Resolve the circular dep at the architecture level if possible; otherwise just inject the mock normally.

### `BullMQ` / `@nestjs/bull` queues

Queue producers (`@InjectQueue('transactions') private queue: Queue`) inject the `Queue` token. At unit tier, mock the `Queue` interface (`{ add: vi.fn() }`). Don't unit-test that BullMQ actually queues the job — Bull-owned.

### `@nestjs/schedule` cron / interval

`@Cron(...)` / `@Interval(...)` decorators register the method with Nest's scheduler. Unit-test the **method body** by calling it directly; never test that the scheduler fires it.

### Constructor parameter property shorthand

Most NestJS services use:

```ts
constructor(private readonly repo: TransactionsRepo) {}
```

This is a TypeScript shorthand — `repo` becomes a private field. Tests cannot access `(subject as any).repo` — see `core.md §6` (no private-member reach-in). Assert on the observable side-effect (the method behaviour), not on the internal handle.

### Module-level side effects

Some NestJS files run code at module load (`reflect-metadata` polyfill, telemetry init). If a spec file imports the production module, those side effects run. If they touch real IO (Sentry init), use the runner's module-mocking primitive to neutralise them — see `runner-<runner>.md` "Module mocking". This is a unit-tier smell; the production code's eager side effects belong in an `OnModuleInit` hook instead.

### `class-validator` / `class-transformer` decorators

DTOs with `@IsString()`, `@IsNumber()`, `@Type(() => Date)` etc. are validated by the framework, not by the subject. Don't unit-test that `class-validator` validates — it's framework code. If the DTO has a custom validator function, unit-test the function directly.

---

## ESLint rules typically enforced for NestJS spec files

(Confirm against `overrides.md`. These are the patterns most well-tended NestJS projects enforce.)

- Ban `Test.createTestingModule` imports in `*.spec.ts` — that's integration tier.
- Ban `@nestjs/testing` imports in `*.spec.ts` — same reason.
- Ban `supertest` imports in `*.spec.ts` — same reason.
- Ban `(x as any)` casts (universal `core.md §6` rule; tighter in tests because mock interfaces should be typed).
- Ban `it('should create' | 'should work', ...)` (universal `core.md §7` vague-title rule).

Inline `eslint-disable` is only allowed with a `-- justified: <reason>` comment of ≥ 10 characters explaining the constraint.
