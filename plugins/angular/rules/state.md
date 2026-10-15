---
paths:
  - "**/*.ts"
---

# State management

**State is split by origin, not by feature. Each origin has exactly one mechanism**, declared in the project's ARCHITECTURE.md state table.

| Origin | Mechanism | Used for |
|---|---|---|
| **Server state** (fetched over HTTP) | One server-state library, named by the project (e.g. TanStack Query for Angular), or `resource()`/`httpResource()` when optimistic updates and cache sharing are not needed | Reads, mutations, cache invalidation, optimistic updates |
| **Component-local UI state** | Signals (`signal`, `computed`, `linkedSignal`) | Open/closed, selected tab, expanded row, in-flight toggles |
| **Cross-feature client state** (rare) | One store mechanism (e.g. NgRx SignalStore); the project lists its stores, and adding one needs an ADR | Active tenant/account, theme, locale, feature flags |
| **URL state** | Angular Router | Active entity slug, filters, pagination cursors, expanded ids — filter state lives in the URL, never in a store |
| **Form state** | Reactive Forms (typed) | All input and validation state; forms never read from or write to a store |
| **Streams** | RxJS, narrowly, converted with `toSignal()` | Websockets, debounced typeahead; RxJS never leaks into templates |

**Decision rule:** *Did this data come from the API?* → server-state mechanism. No → *does it cross feature boundaries?* → store. No → component-local `signal()`.

## Banned
- `BehaviorSubject` / `ReplaySubject` for app state — use signals.
- Classic NgRx (`Store` + `Actions` + `Effects` + reducers) in new code.
- Singleton services holding mutable plain fields.
- Two sources of truth for the same data: server data lives in the server-state mechanism, not copied into a store.
- Wrapping an `Observable` in a service just to keep RxJS habits.

**Enforcement:** review; lint `no-restricted-imports` for `BehaviorSubject` outside allowed folders where a project opts in.

**Legacy carve-out:** a project mid-migration lists its legacy state pattern and the folders it is confined to in ARCHITECTURE.md; new code follows this rule.
