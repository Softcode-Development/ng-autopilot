---
name: write-e2e-tests
description: Write end-to-end tests for a feature or continue the e2e backlog. Triggers on "write e2e tests for X", "add e2e coverage to Y", "rework this Cypress/Playwright spec", "continue e2e backlog", "audit this e2e spec", "write e2e tests" (no target), or "/write-e2e-tests <args>". Use it for any work on .cy.ts / .e2e.ts / Playwright specs, page objects, fixtures, or e2e support files. Detects the e2e framework (Cypress, Playwright) and application stack (Angular, React, RN, Vue) from package.json, tracks per-project progress in .claude/e2e-testing/backlog.md, and reads project-specific overrides from .claude/e2e-testing/overrides.md if present.
---

# Write E2E Tests

Dispatch the `autopilot-testing:e2e-test-orchestrator` agent with the user's argument. The orchestrator owns framework/stack detection, queue building, per-feature authoring and review, backlog tracking, and the run-level summary.

Pass through any argument the user provided (spec path, feature name, integer count, area, "all", etc.) unchanged.
