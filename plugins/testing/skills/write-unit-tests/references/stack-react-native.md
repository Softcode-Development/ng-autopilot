# React Native Stack — Unit Testing Patterns

**Placeholder.** This file gets filled in when a React Native project actually needs the `write-unit-tests` skill.

If the skill detected React Native and routed you here: **stop**. Tell the user this stack reference is unwritten and that they need to either:
1. Author it now (using `stack-angular.md` as a structural template — same shape: §6 additions, file structure template, mock helpers table, async patterns, gotchas), or
2. Confirm the project actually uses the detected runner — RN projects typically use **Jest**, in which case both `stack-react-native.md` and `runner-jest.md` would need to be written before this skill can proceed.

Do **not** improvise an Angular-flavoured template on a React Native subject. The §6 surface differs and the test bed shape is fundamentally different:

- Native modules (gesture handlers, camera, biometrics) are framework-owned and untestable in unit form.
- Platform branching is `Platform.OS === 'ios' | 'android'`, not `isPlatformBrowser`.
- Component rendering uses `@testing-library/react-native` (or equivalent) — declarative `render()` rather than imperative `TestBed.createComponent`.
- Navigation mocks (`@react-navigation/native`) replace Angular `Router` mocks.
- `AsyncStorage` replaces `localStorage`; the mocking pattern is different (module-mock the package vs DI override).
- State management is typically Redux Toolkit or Zustand, not NgRx — same archetypes (reducer, slice, store), different APIs.

Expected sections when written (mirror `stack-angular.md`):
- §6 additions specific to RN (native modules, gestures, animations, platform-specific code paths)
- File structure template using `@testing-library/react-native`
- Mock helpers table: navigation, storage, platform, redux/zustand store, async-storage, network
- Component vs hook vs reducer testing strategy
- Async patterns (React `act()` wrapping; runner-specific fake-timer rules in `runner-<runner>.md`)
- Platform branching (`Platform.OS`) — analogous to Angular's SSR `PLATFORM_ID` testing
- Gotchas: state-update warnings, `act()` wrapping, asynchronous render timing, snapshot-test pitfalls
