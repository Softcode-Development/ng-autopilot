# Karma / Jasmine — Runner Patterns (Integration)

**Placeholder.** This file gets filled in when a project using Karma+Jasmine needs the `write-integration-tests` skill for Angular TestBed-with-real-children integration specs.

If the skill detected Karma/Jasmine and routed you here: **stop**. Tell the user this runner reference is unwritten and that they need to either:

1. Author it now, or
2. Confirm the project actually uses Karma/Jasmine for integration specs — modern Angular projects increasingly run integration specs through Vitest (`@nx/vitest` + `unplugin-swc`) even when unit specs use Karma.

Do **not** improvise Vitest- or Jest-flavoured syntax on a Karma/Jasmine project.

Expected sections when this file is written:

- Spy / mock primitives (`jasmine.createSpy`, `jasmine.createSpyObj`, `spyOn`)
- No module-mocking equivalent — Karma/Jasmine relies on **DI overrides** in the Angular TestBed for fake injection (which is the integration tier's natural mechanism anyway, so this is rarely a limitation)
- Fake timers — Angular's `fakeAsync` + `tick` from `@angular/core/testing` (zone-aware, integrates with change detection); Jasmine's own `jasmine.clock()` for non-Angular code
- Assertion syntax (`jasmine.objectContaining`, `jasmine.arrayContaining`, `jasmine.any`)
- Marble testing — RxJS `TestScheduler` patterns for multi-emission integration specs (HTTP error retry, effect chains)
- Karma configuration for coverage (karma-coverage-istanbul-reporter, lcov reporter)
- Cleanup (Karma re-instantiates the browser per spec file by default; `afterEach(() => HttpTestingController.verify())` for HTTP-using specs)
- Karma-specific footguns (test isolation by file, `jasmine.DEFAULT_TIMEOUT_INTERVAL` for slow integration boots, browser-context limitations for filesystem fakes — use stubs instead)
- Compatibility notes for projects migrating Karma → Vitest mid-flight (which patterns survive the migration vs which need rewriting)
