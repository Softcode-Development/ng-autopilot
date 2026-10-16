---
name: write-unit-tests
description: Write unit tests for a file or continue the backlog. Triggers on "write unit tests for X", "add test coverage to Y", "continue unit-testing backlog", "write unit tests" (no target), or "/write-unit-tests <args>". Detects the test runner and application stack from package.json, tracks per-project progress in .claude/unit-testing/backlog.md, and reads project-specific overrides from .claude/unit-testing/overrides.md if present.
---

# Write Unit Tests

Dispatch the `autopilot-testing:unit-test-orchestrator` agent with the user's argument. The orchestrator owns stack detection, queue building, per-file authoring and review, backlog tracking, and the run-level summary.

Pass through any argument the user provided (file path, integer count, area name, "all", etc.) unchanged.
