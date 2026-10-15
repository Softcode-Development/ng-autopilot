# Angular Stack — Unit Testing Patterns

Framework-specific patterns for **Angular** applications (any version with standalone components — typically Angular 14+). Read **on top of** `core.md` (universal principles) and the active `runner-<runner>.md` (runner syntax — typically `runner-karma-jasmine.md` for Angular).

This file is runner-agnostic where possible — it describes the Angular concepts (TestBed, providers, NgRx test patterns, Apollo mocking, SSR). The exact spy/assertion/timer syntax used in code examples below assumes Karma/Jasmine (the default Angular runner). For Jest/Vitest on Angular, swap the syntax per the active runner file; the **patterns** stay the same.

Tested against Angular 18 SSR projects with NgRx, Apollo GraphQL, PrimeNG, RxJS, and signals. Most patterns transfer cleanly to Angular 16+.

---

## §6 additions for Angular

These extend the universal §6 forbid-list in `core.md`:

| Not tested | Why | Where it gets tested instead |
|---|---|---|
| **PrimeNG / Material / Ionic internal behaviour** — `p-dropdown` opens, `mat-dialog` traps focus, animations | Owned by the UI library. | Visual/interaction in E2E only. |
| **Angular framework behaviour** — `*ngIf` toggles, lifecycle hooks fire in order, `Router` navigates, `HttpClient` sends bytes | Owned by Angular. | Never. Trust the framework. |
| **NgRx store mechanics** — that `dispatch` puts an action on the reducer stream | Owned by NgRx. We test our reducers/effects/selectors, not NgRx itself. | Never. |
| **Apollo cache merge internals** — that a type policy concatenates pages | Owned by Apollo. Test the cache policy *function* in isolation if it's custom. | Apollo's own tests; or unit test the merge function as a pure utility. |

---

## File structure template (Angular)

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
// import the standalone subject + provider helpers from the project's testing toolkit

// Behaviours covered:
// - ...

describe('<Subject>', () => {
  let subject: SubjectType;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubjectStandaloneComponent], // standalone component only — never its children
      providers: [
        // mocks chosen in recipe Step 4
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    subject = TestBed.inject(SubjectType);
    // or for components:
    // const fixture = TestBed.createComponent(SubjectStandaloneComponent);
    // component = fixture.componentInstance;
  });

  afterEach(() => {
    // HttpTestingController.verify() if used
  });

  describe('<group>', () => {
    it('does X when Y', () => {
      // Arrange / Act / Assert
    });
  });
});
```

---

## Component testing strategy

- **Container / route components**: instantiate the class, mock all injected services, assert on outputs (state, dispatched actions, navigation calls, meta/title). Do **not** call `detectChanges()` unless asserting on the rendered template.
- **Shared UI components** (forms, controls, cards): test inputs → outputs and template behaviour (clicks, ControlValueAccessor contracts) using `fixture.detectChanges()` and `By.css('[data-cy=...]')`.
- **Dialogs / overlays**: class logic only; rendering belongs in E2E.

---

## Mock helpers (standard Angular DI tokens)

For every injected dependency, pick its mock from the project's testing toolkit (typical path: `src/testing/`; confirm against `overrides.md`). Common helper names used in well-structured Angular projects:

| If the subject injects… | Use… |
|---|---|
| `HttpClient` | `provideHttpClient(withFetch())` + `HttpTestingController` |
| `Apollo` / GraphQL DataService wrapper | `provideMockApollo()` / `provideMockDataService()` |
| NgRx `Store` | `provideMockStore({ initialState })` + selector overrides via `store.overrideSelector(...)` |
| `Router` | `provideMockRouter()` (or `provideRouter([])`) |
| `ActivatedRoute` | `provideMockActivatedRoute({ params, queryParams, data })` |
| `PLATFORM_ID` | `providePlatformId('browser' \| 'server')` |
| `Meta` / `Title` | `provideMockMetaTitle()` |
| `LoggerService` | `provideMockLogger()` |
| `REQUEST` / `RESPONSE` / `AUTH_TOKEN` (SSR Universal tokens) | `provideMockRequest()` / `provideMockResponse()` / `provideMockAuthToken()` |
| `DynamicDialogRef` / `DynamicDialogConfig` (PrimeNG) | `providePrimeNgDialogMocks(...)` |

Names may differ per project — the **shape** is the same: one provider-bundle factory per dependency, declared once in the toolkit, imported everywhere. The spy primitive used inside those helpers comes from the runner file (Jasmine: `jasmine.createSpyObj`; Jest: `jest.fn()`; etc.).

---

## SSR (Server-Side Rendering)

- Test both `PLATFORM_ID = 'browser'` and `PLATFORM_ID = 'server'` for any subject with `isPlatformBrowser` / `isPlatformServer` branches.
- For services depending on `REQUEST` / `RESPONSE` / `AUTH_TOKEN`: use the project's SSR provider mocks.
- Never trust one platform branch to imply the other — assert both explicitly.

---

## NgRx patterns

- **Reducer**: test as a pure function. `initial state + action → expected state`. No TestBed needed.
- **Selectors**: test as pure functions. `mock state → expected derived value`. No TestBed.
- **Effects**: test at the effect boundary with `provideMockActions(actions$)` and `provideMockStore(...)`. Verify `action in → side effect → action out`. Use the runner's marble/scheduler abstraction (see `runner-<runner>.md`) for multi-emission streams.

```ts
// Effect example (Karma/Jasmine syntax; swap for other runners)
it('emits LoadCartSuccess when cart query resolves', () => {
  actions$ = of(LoadCart());
  dataServiceSpy.query.and.returnValue(of({ data: { activeOrder: orderFixture } }));

  effects.loadCart$.subscribe(action => {
    expect(action).toEqual(LoadCartSuccess({ order: orderFixture }));
  });
});
```

---

## Apollo / GraphQL patterns

- Mock Apollo at the `DataService` boundary (never `ApolloTestingController` in component specs — it adds complexity and couples the spec to Apollo's internals).
- Use generated `DocumentNode` and `*Query` / `*Mutation` / `*Variables` types from the project's generated artefacts (typically `src/app/core/graphql/generated/` or similar — confirm in `overrides.md`).
- Spies keyed by document node: `dataServiceSpy.query.withArgs(GetThing, vars).and.returnValue(...)` (Jasmine; swap for runner). Schema field changes then break the mock at compile time, surfacing drift in the spec.

---

## Async — zone-aware fake time (Angular)

Angular's `fakeAsync` + `tick` are zone-aware and integrate with Angular's change detection. They live in `@angular/core/testing` and work with any test runner — but on Karma/Jasmine they're idiomatic and the most common choice.

For Karma/Jasmine details, see `runner-karma-jasmine.md` → "Async — `fakeAsync` + `tick`".

For Jest/Vitest on Angular, the runner files describe their respective fake-timer mechanisms; `fakeAsync` still works in those environments but the project may prefer the runner's native fake-timer API for non-Angular code.

`HttpTestingController.verify()` belongs in `afterEach` for any spec that uses HTTP testing (Angular-specific — `@angular/common/http/testing`).

---

## Signal-based local state

- Test computed signals via the public method that triggers an update + read the computed value.
- Do **not** assert on private signal internals — §6.
- Production code should use `update` or `set`, never `mutate` (deprecated). If you find `mutate` in production, that's a separate refactor — don't accommodate it in tests.

---

## Form controls (ControlValueAccessor)

For shared form-control components implementing CVA:

- Test the CVA contract: `writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState`.
- Test form integration via a wrapper `FormGroup` in `beforeEach` rather than calling CVA methods directly when possible.
- Assert on emitted `onChange` calls with the expected value (typed).

---

## Gotchas (Angular-specific)

### Provider-bundle factories returning tuples

Some toolkit factories return `[Provider, Handle]` for ergonomic destructuring (e.g. `provideMockRouter()`, `provideMockLogger()`). Passing the tuple directly to `providers[]` creates a nested array and blows up at runtime with "Invalid provider" — TypeScript won't catch it.

```ts
providers: [provideMockRouter()[0]]           // ✅ extract the provider
// NOT: providers: [provideMockRouter()]      // ❌ nested array, runtime error
```

Or destructure:
```ts
const [routerProvider, router] = provideMockRouter();
providers: [routerProvider]
```

### Dispatch spy ordering

When asserting on `store.dispatch` calls following a `fixture.detectChanges()` (which fires `ngOnInit`), install the spy **before** `detectChanges`, then read the dispatched action via the runner's call-history API (Jasmine: `store.dispatch.calls.mostRecent().args[0]`).

### Standalone component imports

A standalone component spec must import the **subject** standalone component into the `TestBed`. Never import its child standalone components — that drags real renders into the spec. Mock children via `NO_ERRORS_SCHEMA` only when absolutely necessary and prefer extracting the logic into a service.

### `eslint-disable` justification

If the project's ESLint config requires `-- justified: <reason>` comments on `eslint-disable` lines in specs (≥10 chars), never omit the justification. Confirm format in `overrides.md`.
