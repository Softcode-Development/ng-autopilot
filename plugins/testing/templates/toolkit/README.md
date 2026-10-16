# Testing toolkit

Test-only helpers shared by specs: mock providers, builders, fixtures, fakes, harnesses.

- **Specs only.** ESLint blocks every import of this folder from production code (`no-restricted-imports`, by relative path and by alias).
- **Linted** with the autopilot rules, relaxed as for specs, even when the folder sits outside `lint.strictScope`.
- **Check here first.** Before writing a mock or builder inline, look for one below; when a second spec needs the same helper, move it here.
- **One concept per file**, exported through `index.ts`, with a row below and a self-test (`<file>.spec.ts`).

| Helper | File | Use for |
|---|---|---|
