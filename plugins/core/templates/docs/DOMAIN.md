# Domain

The vocabulary and data shapes of this product, for a frontend that talks to an API it does not own. (A repo that owns its backend uses DATA_MODEL.md instead.)

<!-- guide: agents read this before wiring any API call or naming anything. Keep enums in their exact wire spelling. -->

---

## 1. Glossary

- **<Term>** — <meaning; local-language terms with their translation; what it is NOT, when commonly confused>.

## 2. API source of truth

- **Docs:** the dev API and its docs are in `CLAUDE.md` (**API** line, from `.claude/autopilot.json` → `api`). <Other environments, markets or local APIs and their URLs.>
- **Rule:** verify real endpoint params and enum values against the docs before wiring; the docs win over older code and over this file.
- **Client:** <generated client package | hand-written services under `<path>`>.
- **Auth/headers:** <what the interceptor adds; anything a call must mark>.
- **Auth / session facts:** <token lifetimes, refresh behaviour, error codes the client must handle>.
- **Known API behaviours:** <quirks agents must know, e.g. "false is stripped by X", "endpoint returns 501 in market Y">.

## 3. Entities

### <Entity>
| Field | Type | Notes |
|---|---|---|
| id | string (uuid) | |

**Rules:** <invariants the UI must respect>.

## 4. Enums (wire spelling)

| Enum | Values | i18n key map |
|---|---|---|
| <Name> | `'value_a'`, `'value_b'` | `<FEATURE>_I18N_KEY` in `<path>` |

## 5. Sensitive data

What may appear in logs, analytics, error reports and URLs. The security rules and reviewers check against this table.

| Class | Rule | This project's fields |
|---|---|---|
| Always sensitive | Never logged; returned only to its owner | <emails, tokens, passwords, national ids, payment/bank data, …> |
| Usually sensitive | Log only as a flag or salted hash | <display names, relationships, balances, …> |
| Flag only | Log as `hasX: !!x`, never the value | <hasEmail, hasMfa, …> |
| Always safe | Log freely | <ids (UUIDs), error codes, correlation ids, timings, route names> |

## 6. Tenancy / markets / roles

<How data is scoped (tenant, market, account), what varies by market or role, and where that config lives.>
