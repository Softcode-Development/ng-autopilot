# Security checklist

What the `security-reviewer` looks for, by OWASP Top 10 category. Stack-specific rules live in the golden security rules (`angular`, `nestjs`) and the project docs; this list is about the patterns that keep recurring.

**Thinking process:** for each change, ask who can reach the new code, what data it touches, what an attacker controls in its inputs, and what is logged on the way.

## A01 — Broken access control
- A route/endpoint over private data without its guard, or marked public for convenience.
- Tenant/owner filtering hand-rolled at call sites instead of coming from the guard's context (drifts when the contract changes).
- New tables holding tenant data without row-level policies in the same migration (when the project uses RLS).
- Cross-tenant queries (admin, reporting, jobs) without an explicit admin guard and audit entries.
- Over-sharing inside a tenant: new resource types default to the narrowest visibility.
- Open redirects: `returnUrl`/`redirect` parameters not validated against an internal allowlist.

## A02 — Cryptographic failures
- Tokens in `localStorage`/`sessionStorage` without a documented reason and compensating controls (CSP).
- Cookies missing `HttpOnly; Secure; SameSite`.
- MFA secrets or recovery codes leaving the server outside the one enrolment response.
- Sensitive identifiers (national ids, bank refs) returned outside the owner's own settings endpoint.

## A03 — Injection
- Untyped/unvalidated request bodies.
- Raw SQL built by string concatenation.
- `postMessage` handlers without an `event.origin` allowlist.
- `eval`, `new Function`, `document.write`; `[innerHTML]` / `bypassSecurityTrust*` on user-influenced content.

## A04 — Insecure design
- Authorization decided from client-side flags; the server re-checks state on every mutation.
- Single-layer authorization on sensitive writes ("the other layer covers it").
- Auth, session and consent flows with implicit state — every transition explicit and persisted.

## A05 — Security misconfiguration
- Internal error details (stack traces, ORM messages, environment names) in responses.
- Production source maps served to users.
- Debug routes or overlays reachable in production.
- `*` CORS; missing security headers.

## A06 — Vulnerable and outdated components
- A new dependency without a justification (what it does, why the platform or an existing dependency can't, maintenance status).
- High/Critical audit findings ignored.
- Lockfile changes merged without review.

## A07 — Identification and authentication failures
- Single-use, time-bound, user-bound tokens (magic links, resets, invites) accepted twice, late, or for another user.
- Login errors that reveal whether an account exists.
- Account deletion that skips the grace period or reuses ids.

## A08 — Software and data integrity failures
- Webhooks parsed before their signature is verified; no idempotency key.
- Third-party scripts without Subresource Integrity when they can't be self-hosted.
- Queue/job payloads trusted without re-validation — a queue is not a trust boundary.

## A09 — Logging and monitoring failures
- PII or secrets in logs, analytics or error reports (log ids and boolean flags instead).
- Error paths that drop the correlation id.
- Security-relevant events (failed auth, access denied, role changes, deletions) not logged.
- Audit records writable from anywhere but the audit service.

## A10 — Server-side request forgery
- User-supplied URLs fetched without a domain allowlist (match the resolved host, not a string prefix).
- Private, loopback and link-local ranges not blocked after resolution.
