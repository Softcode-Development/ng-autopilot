# Stack: React (placeholder)

This is a placeholder. The e2e-test-author / e2e-test-reviewer agents must **stop and escalate** if `detect-stack` reports `stack: react` and ask for this file to be authored.

When this file is filled in, it should mirror `stack-angular.md` and cover:

- **SSR / hydration** — Next.js / Remix / vanilla React-on-server hydration markers, when to strip them or wait on them, how React 18's selective hydration interacts with intercepts
- **Suspense boundaries** — what waits look like when a fallback is visible, when to wait on the fallback to disappear vs. on the resolved content to appear
- **Form libraries** — React-Hook-Form, Formik, controlled vs uncontrolled inputs, when raw `.type()` works vs. when a synthetic-input pattern is needed
- **Router** — React Router v6+ behaviour, Next.js App Router behaviour, route loaders, route guards (auth wrappers)
- **State management** — Redux / Zustand / Jotai / TanStack Query — how to ensure the e2e spec stays at the UI tier and doesn't leak into store assertions
- **Component libraries** — MUI, Chakra, Mantine, shadcn/ui — selector patterns through the wrappers
- **Dynamic imports / RSC** — React Server Components, streaming, when the spec sees a chunk fetch
- **React-specific §6 additions** — implementation-internal things not to assert on

Until written, escalate.
