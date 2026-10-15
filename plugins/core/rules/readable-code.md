---
paths:
  - "**/*.ts"
  - "**/*.html"
---

# Readable, self-documenting code

Code reads like a book. Violations are review blockers, not nits. Applies to the TypeScript and the template layer.

- **DRY** — shared logic lives once, in a named helper.
- **Extract methods** — a block with a distinct responsibility becomes a named private method. Triggers: distinct responsibility, a meaningful domain concept, reused logic, complexity reduction, side-effect isolation. ~20 lines is an audit heuristic, never a lint rule; use judgement.
- **Single responsibility** — a method or class does one thing. A long `ngOnInit` / `onSubmit` that reads session, registers listeners, validates, mutates, navigates and cleans up becomes separate named methods called from the lifecycle hook.
- **Intent-based names** — names say what the thing is or does (`restoreUserEmailFromSession`, `navigateToDashboard`). Technology-based names (`setupSubscription`, `handleCallback`) are banned.
- **Guard clauses** — `if (!condition) return;` over nested `if` blocks.
- **Tell, don't ask** — objects do things; callers don't read internal state to decide on their behalf.
- **Separate orchestration from logic** — an orchestrating method calls named helpers; it holds no inline business logic.
- **No boolean soup** — a named predicate (`isAlreadyVerified(session)`) replaces a compound inline condition.
- **Obvious side effects** — side-effecting methods are named for the effect and isolated (`registerVerificationListener()` owns its subscription).
- **Composition over giant classes** — split a large class into focused collaborators instead of adding more private methods.
- **Predict bugs, optimise for performance** — flag off-by-one errors, N+1 patterns, leaks and unsubscribed listeners while writing, not only at review.

## Comments
- Default: no comments. Names explain intent.
- A comment explains **why**, never what: a hidden constraint, an upstream-bug workaround (link the issue), a regulatory rule, a deliberate trade-off.
- Step-counter comments (`// 1. read session`, `// 2. listen`) are banned — extract the steps into named methods.
- No temporal or changelog comments (`now returns X`, `added for PR 12`, `not yet surfaced`); git history holds that.

**Enforcement:** review; lint covers what it can (max nesting, complexity).
