# Runner Reference Mapping

The detection of which e2e framework this project uses lives in the `detect-stack` skill (the testing plugin's `skills/detect-stack/SKILL.md`, mode `e2e`). That skill returns an `e2e` framework name (`cypress`, `playwright`, `webdriverio`, etc.) plus standard failure modes (no package.json, ambiguous, missing).

This file documents what the `e2e-test-orchestrator` agent does with that name — which runner-specific reference file to load and what each one should contain.

---

## Runner-to-reference mapping

| `e2e` value (from detect-stack) | Reference file in this skill |
|---|---|
| `cypress` | `runner-cypress.md` |
| `playwright` | `runner-playwright.md` (placeholder — escalate) |
| `webdriverio` | `runner-webdriverio.md` (not yet written — escalate) |
| `puppeteer` | `runner-puppeteer.md` (not yet written — escalate) |
| `none` / `ambiguous` | stop and ask |

If detection returns a framework whose reference file is a placeholder, the skill stops and tells the user which framework needs its file authored. Do not improvise a different runner's syntax.

---

## What goes in a runner reference file

A `runner-<runner>.md` file in this skill's references contains:

- **Test syntax** — `describe` / `it` / `beforeEach` shape (Cypress / Mocha vs Playwright's `test.describe`)
- **Selector primitives** — how to query, chain, and assert (`cy.get(...).should(...)` vs `page.locator(...).expect(...)`)
- **Network intercept syntax** — `cy.intercept` vs `page.route` vs `cy.mockGraphQL` (project wrapper, mention only as an example of where overrides slot in)
- **Wait / retry-ability model** — how the runner retries assertions, what loses retry-ability, common pitfalls (e.g. `.then` breaking the chain in Cypress)
- **Clock / fake-timer abstraction** — `cy.clock` / `page.clock` and what production code patterns interact with it
- **Setup commands for auth / cookies / storage** — `cy.session`, Playwright storage state
- **Headed vs headless run modes**, and how to pick a single spec for local iteration
- **Reporter / artefact output** — where the runner emits videos, screenshots, traces; how a CI run consumes them
- **Common runner-specific footguns** — Cypress test-isolation behaviour, Playwright auto-waiting, etc.

What does **not** go in a runner reference file (lives in the stack file instead):

- Framework-specific hydration concerns (SSR transfer-state stripping, Angular Zone.js form-input gotchas, React Suspense boundaries)
- Project-specific page-object or test-data toolkit
- Auth provider integrations specific to the application

The boundary is roughly: **runner = how to drive any browser-based UI**; **stack = how to drive *this* framework's UI without fighting its lifecycle**.

---

## How the matched file is used

The `e2e-test-orchestrator` agent includes the matched runner reference file path in the brief passed to the `e2e-test-author` subagent, alongside the four universal references and the matched stack reference. The reviewer subagent receives the same set.
