# Feature Modules

Every feature the product has or will have, expanded into concrete behaviour. Each module maps to one **capability slug** (in `()`), used in plan/spec folders, branch names and commit scopes.

<!-- guide: for an existing codebase, draft this from the code (routes, feature folders, API services), then have the owner correct it — code wins over older docs. Status values: live | in progress | planned | <phase>. Requirements are behaviours an agent can turn into acceptance scenarios, not implementation notes. -->

---

## 1. <Feature name> (`<slug>`)

**Status:** <live | in progress | planned>
**Entry points:** <routes / menu items>
**Owner notes:** <the original ask, in the owner's words, when it matters>

**Requirements**
- <Observable behaviour: "A user can …", "When …, the system …".>
- <Validation, permissions, empty/error states that matter.>

**Out of scope**
- <Item> → <destination: a later feature, a phase, or "no destination needed: <reason>">

---

## Cross-cutting modules

### A. <i18n / audit / feature flags / export / …> (`<slug>`)
<Requirements.>
