---
paths:
  - "apps/api/**"
  - "**/*.controller.ts"
  - "**/*.guard.ts"
  - "prisma/**"
  - "supabase/**"
---

# Backend security baseline

New features add to this list, never subtract. The project's security reviewer checks PRs against it.

| Concern | Mechanism |
|---|---|
| AuthN | Identity provider JWT validated by a guard in `core/security/`; **default deny** — every controller requires the guard unless explicitly `@Public()` |
| AuthZ | Resource-scope guard/decorator on every domain resource (tenant, household, account); per-route role checks |
| Input validation | Schema on every controller input; strict types in every service |
| Rate limiting | Global throttler + stricter limits on auth and write endpoints |
| Brute force | Login throttling + captcha on signup/login |
| Headers | `helmet`: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| CORS | Explicit allowlist; **no `*`** in any deployed config |
| CSRF | Double-submit cookie on cookie-auth flows; not needed for pure bearer APIs |
| Secrets | Validated env schema; secrets in the host's secret store, never in git |
| Audit log | Append-only log of every write: actor, before, after |
| PII minimisation | Collect only what a feature needs |
| Erasure / export | Account deletion with a grace period + audit entry; one-click data export |
| Dependencies | Package audit + OSV scanner in CI; automated update PRs |
| SAST | ESLint security plugin + semgrep in CI |
| Containers | Image scanning in CI |
| Incident response | Error alerts routed to a channel; runbooks in `docs/runbooks/` |

## Database-side rules
- Row-level security, when used, is defense in depth; the API guard is the primary authorization.
- `SECURITY DEFINER` helpers live in a non-exposed schema (e.g. `private`) with `EXECUTE` granted only to the authenticated role — never in a schema the REST layer exposes.
