---
paths:
  - "**/*.ts"
  - "**/*.html"
---

# Frontend security

## Never log PII or secrets
- No emails, phone numbers, addresses, passwords, payment data, national IDs, auth tokens/JWTs or API keys in any log, error report or analytics event. Log ids or boolean flags (`hasEmail: !!value`).
- Never log whole form values (`form.value`, `getRawValue()`) or raw request/response objects.
- User-visible errors go through the project's notification service (toast/snackbar), not `console.*`.
- **No `console.log` in shipped code** — use the project's logger, which redacts. — **Enforcement:** lint `no-console`; error-reporting SDKs configured with a `beforeSend` redaction hook.

## XSS
- Use `{{ }}` interpolation and property binding (escaped by default).
- Never bind `[innerHTML]` without sanitising through `DomSanitizer` or a project sanitise pipe; never call `bypassSecurityTrust*` on user-influenced content.
- Never build HTML strings in TypeScript and inject them.
- **Enforcement:** lint `no-restricted-syntax` on `bypassSecurityTrust`; review for `[innerHTML]`.

## Auth and tokens
- The auth token is attached only by the HTTP interceptor — never read or attached manually per request; never hardcode credentials.
- Don't decode JWTs ad hoc (`atob`); use the project's one JWT utility.
- Token refresh is owned by one service; features never call the refresh endpoint or start their own refresh timers.
- Route guards gate authenticated routes; authorization is still enforced by the API — the client never trusts itself.

## Secrets and config
- No secrets in the frontend bundle — anything in `environment*.ts` is public. Public keys only (e.g. a restricted maps key).
- `.env*` and credential files are never read by agents and never committed.

## Deployed-SPA hazards
- **Stale lazy chunks after a deploy:** old hashed chunks disappear from the CDN, so a long-open tab fails to load one. Route navigation and the global error handler recover by reloading once; a new caught dynamic `import()` does the same before reporting its own error.

## Dependencies
- New dependencies are pinned and license-checked; dependency audit runs in CI.
