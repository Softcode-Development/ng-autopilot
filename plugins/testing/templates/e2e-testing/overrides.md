# E2E testing — project overrides (<project>)

<!-- Synced to .claude/e2e-testing/overrides.md when "e2e" is in autopilot.json testTiers.
     Read by autopilot-testing:e2e-test-orchestrator. Overrides only ADD rules, except documented
     carve-outs (e.g. the folder convention). Replace every <placeholder>. -->

## Stack pins

```
STACK: <angular>
E2E: <playwright | cypress>
```

## Commands and server

| Purpose | Command |
|---|---|
| One spec | `<…>` |
| Mocked suite | `<…>` |
| Critical (real-API) suite | `<… | none>` |

- **Dev server:** `<command>` on `<baseUrl>`. The orchestrator **<may | must not>** start it; when it must not, it asks the owner to confirm it is running.
- **Accounts for real-API specs:** `<path to a *.local.md or env var names — never values>`.

## Folder convention

```
<e2e root>/
  <journeys|features>/<feature>/   mock-first specs (default)
  <critical>/                      real-API specs (allowlist below)
  <page-objects | support | fixtures | network>/
```

## Toolkit

| Need | Path |
|---|---|
| Page objects | `<…>` |
| Custom commands / helpers | `<…>` |
| Network mocks / fixtures | `<…>` |

## Selectors

- Interactive elements carry `<data-cy | data-testid>`; specs select by it. Missing attribute → add it to the template in the same change, never invent a selector for one that doesn't exist.
- Translated text is not a selector, except: <documented exceptions>.

## Real-API allowlist

Mock-first by default. Real-API specs only for:

| Flow | Why it needs the real API |
|---|---|
| <…> | <…> |

## Coverage additions per area

| Area | Must cover |
|---|---|
| <checkout> | <…> |

## Additional hard constraints

- <e.g. no production data in fixtures; every visited route exists in the router config / prerender manifest>.

## Carve-outs from the core references

| Core rule | Carve-out | Why | Scope |
|---|---|---|---|
| <core.md § 15 folder layout> | <the folder convention above> | <existing suite> | <all specs> |
