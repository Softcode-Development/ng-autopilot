---
name: detect-stack
description: Detect the technology stack and tooling of the current project from package.json. Triggers when the user asks "what stack is this project on", "what framework", "what test runner", "what e2e tool", "what package manager", "is this Angular or React", "detect the stack", or similar. Also used by other skills (write-unit-tests, write-e2e-tests, code-review, etc.) as a pre-flight step to determine which framework-specific patterns to apply. Supports four modes via argument — full (default), unit-tests, e2e, stack.
---

# Detect Stack

Detect the technology stack and tooling of the current project by introspecting `package.json`. This skill is workflow-agnostic: it produces a structured report, and consuming workflows pick the fields they care about.

## Modes (via argument)

| Mode | Returns | Use when |
|---|---|---|
| `full` (default) | All core axes **plus** a categorized ecosystem inventory of every load-bearing library in the project | The user asked directly, or a workflow needs the full picture. |
| `unit-tests` | stack + runner + the ecosystem categories that materially affect how unit tests are written (state management, data layer, async/observable libs, etc.) | A unit-testing workflow needs to know how to test. |
| `e2e` | stack + e2e framework + the ecosystem categories that materially affect e2e (SSR runtime, auth, routing if non-default) | An e2e-testing workflow needs to know how to drive the browser. |
| `stack` | stack only | A non-testing workflow (i18n, code review, refactor, setup-component) only needs framework identity. |

If the user passes an unknown mode, default to `full` and note that the mode was unrecognised.

## How it works

Read `<cwd>/package.json`. Inspect `dependencies`, `devDependencies`, and `packageManager` field together. For each axis, match against the table below — **first match wins** (most-specific stacks first).

### Stack axis

| Found in deps | `stack` |
|---|---|
| `@angular/core` | `angular` |
| `react-native` | `react-native` |
| `react` (without `react-native`) | `react` |
| `vue` | `vue` |
| `svelte` | `svelte` |
| `solid-js` | `solid` |
| `@nestjs/core` | `nestjs` |
| `express` / `koa` / `fastify` (without front-end framework above) | `node` |
| (none of the above) | `vanilla` |

### Runner axis (test runner)

| Found in deps | `runner` |
|---|---|
| `karma` AND (`jasmine-core` or `jasmine`) | `karma-jasmine` |
| `jest` (without `karma`) | `jest` |
| `vitest` | `vitest` |
| `mocha` | `mocha` |
| `jasmine` alone (no Karma) | `jasmine-node` |
| (none) | `none` |

When both `karma` and `jest` appear, inspect `package.json` `scripts.test`: if it invokes `karma` or `ng test`, prefer `karma-jasmine`; if it invokes `jest`, prefer `jest`. If still ambiguous, report `ambiguous` and ask.

### E2E framework axis

| Found in deps | `e2e` |
|---|---|
| `cypress` | `cypress` |
| `@playwright/test` or `playwright` | `playwright` |
| `webdriverio` | `webdriverio` |
| `puppeteer` (used as e2e runner — check scripts) | `puppeteer` |
| (none) | `none` |

### Package manager axis

Lock-file checks must look at the **project root only** — not recursively. Lock files inside `node_modules/` belong to nested dependencies and are noise.

| Signal | `package_manager` |
|---|---|
| `packageManager` field in package.json (e.g. `"packageManager": "pnpm@8..."`) | the named manager |
| `pnpm-lock.yaml` at project root | `pnpm` |
| `yarn.lock` at project root | `yarn` |
| `bun.lockb` at project root | `bun` |
| `package-lock.json` at project root (or none of the above) | `npm` |

### Language axis

| Signal | `language` |
|---|---|
| `tsconfig.json` present in project root, or `typescript` in deps | `typescript` |
| (otherwise) | `javascript` |

### Monorepo flag

Monorepo signals must also look at the **project root only** — `lerna.json` inside `node_modules/` is a nested test fixture, not a real signal.

| Signal | `monorepo` |
|---|---|
| `workspaces` field in package.json, OR `pnpm-workspace.yaml` at root, OR `turbo.json` at root, OR `nx.json` at root, OR `lerna.json` at root | `true` |
| (none of the above) | `false` |

If `monorepo: true`, the consuming workflow should be told that detection ran against the root package.json — workspace-specific re-detection may be needed if the user is operating inside a sub-package.

---

## Ecosystem inventory (full mode, and partially for other modes)

After the core axes are resolved, examine the project's full `dependencies` + `devDependencies` and produce a categorized inventory of the **load-bearing libraries** that shape how the project is built, structured, and worked with.

There is no fixed taxonomy. **You decide the categories** based on what the project actually depends on. A typical web project might surface categories like state management, data/API layer, UI library, styling, SSR runtime, build tooling, forms, validation, auth, routing, i18n, date/time, animations, HTTP client, error tracking, analytics, testing utilities beyond the runner — but list only categories that materially apply to this project. Skip categories nothing populates.

**What counts as load-bearing**: a library a new engineer joining the project would need to know exists in order to navigate the codebase or make a change. Skip transitive tooling, polyfills, type-only `@types/*` packages, dev-only formatters, and small utility libraries that don't shape architecture (e.g. `lodash`, `date-fns`, `uuid` may or may not be load-bearing depending on how integral they are — judgment call).

**How to group**: for each load-bearing library, group it under a purpose label and name the package(s). Multiple packages in the same family go on one line (e.g. all `@ngrx/*` packages together under "State management"). Include the major version when relevant to compatibility.

**Mode filtering**: 
- `full` — emit every category present.
- `unit-tests` — emit only categories that affect how unit tests are written (typically: state management, data/API layer, async libraries, anything that needs mocking at the test boundary).
- `e2e` — emit only categories that affect how e2e drives the app (typically: SSR runtime, authentication, non-default routing, anything that changes how the app boots in a real browser).
- `stack` — omit the ecosystem block entirely.

Do **not** name specific libraries in this section's instructions — the model should discover them by reading `package.json`. The point of this skill is to inventory what's *actually there*, not what someone listed when writing the skill.

---

## Project pin override

If `<project>/.claude/CLAUDE.md` (or any project-side config file the consuming workflow loads) contains lines like:

```
STACK: angular
RUNNER: karma-jasmine
E2E: cypress
PACKAGE_MANAGER: pnpm
```

→ those override the corresponding axis from `package.json` detection. Useful for monorepos, projects mid-migration, or test environments that diverge from production.

## Output format

Always emit a structured block at the top of the response, then (if applicable) a categorized ecosystem block, then a short prose summary.

**Core axes block** — always emitted, columns aligned for scannability:

```
Stack:           <value>
Runner:          <value>          (omit for `stack` mode)
E2E:             <value>          (omit for `unit-tests` and `stack` modes)
Package manager: <value>          (omit for `unit-tests`, `e2e`, `stack` modes)
Language:        <value>          (omit for `unit-tests`, `e2e`, `stack` modes)
Monorepo:        <value>          (omit for `unit-tests`, `e2e`, `stack` modes)
```

**Ecosystem block** — emitted for `full`, partially for `unit-tests` and `e2e`, omitted for `stack`:

```
Ecosystem:
  <Category>:      <package> [+ <package> ...]   (version where useful)
  <Category>:      <package>
  ...
```

The category labels are whatever you choose based on what's in the project. One line per category. Concise — this is an inventory, not documentation.

End the response with a one-sentence summary stating the most important facts (e.g. "Angular 18 SSR app on Karma/Jasmine with NgRx + Apollo, deployed via npm.").

The structured blocks are the machine-readable contract for consuming skills. The prose summary is for human readability.

If a consuming skill invokes this skill, the structured block is the contract — that's what the caller will read back.

## Failure modes

- **No `package.json`** in the working directory → stop. Tell the user this skill targets Node/web/RN projects and ask where the package.json lives.
- **`package.json` exists but is malformed** → report `unreadable` and ask the user to check it.
- **No matching stack** → emit `stack: vanilla`. The consuming workflow decides whether `vanilla` is acceptable.
- **Multiple stacks matched** (rare — e.g. `@angular/core` AND `react-native` in the same package.json) → stop. Ask the user which sub-package to operate on, or recommend they add a `STACK: ...` pin to `.claude/CLAUDE.md`.
- **Ambiguous runner** (both Karma and Jest installed, scripts inconclusive) → emit `runner: ambiguous` and ask.

## How other skills use this

A consuming skill has two equivalent options:

1. **Invoke this skill explicitly** in a pre-flight step (e.g. instruct Claude to "first run detect-stack in unit-tests mode, then proceed"). Read the structured block from the response.
2. **Read this SKILL.md file inline** with the Read tool and execute the procedure directly. Same logic, no skill context-switch.

In practice, option 2 is what happens when one skill is already mid-execution — Claude reads this file as a reference. Option 1 is for when the user invokes detection independently.

Either way, the detection logic above is the single source of truth. Do not duplicate it in consuming skills.
