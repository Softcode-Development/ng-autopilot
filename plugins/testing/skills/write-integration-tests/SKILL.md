---
name: write-integration-tests
description: Write integration tests for a feature or continue the integration backlog. Triggers on "write integration tests for X", "add integration coverage to Y", "rework this integration spec", "continue the integration backlog", "audit this integration spec", "write integration tests" (no target), or "/write-integration-tests <args>". Use for any work on *.integration.spec.* / *.int.spec.* / tests/integration/** files, supertest + NestJS TestingModule specs, TestBed-with-real-children specs, RTL + MSW specs, or Express + supertest specs. Detects the test runner (Vitest, Jest, Karma/Jasmine) and target framework (NestJS, Angular TestBed, React + MSW, Express, Fastify) from package.json. Tracks per-project progress in .claude/integration-testing/backlog.md and reads project-specific overrides from .claude/integration-testing/overrides.md if present.
---

# Write Integration Tests

Dispatch the `testing:integration-test-orchestrator` agent with the user's argument. The orchestrator owns runner/framework detection, queue building, per-feature authoring and review, backlog tracking, and the run-level summary.

Pass through any argument the user provided (spec path, feature name, integer count, area, `audit <path>`, `rework <path>`, `all`, etc.) unchanged.
