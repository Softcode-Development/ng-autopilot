# E2E Coverage Floors by Feature Archetype

Per-archetype **behavioural coverage minimums**. The author agent must reach at least these expectations before claiming `AT CEILING`. If more reachable behaviour exists above the floor, keep writing tests. Do **not** stop at the floor. Do **not** exceed §6 to push numbers higher.

E2E coverage is measured **behaviourally, not in lcov %**. A feature is "covered" when every user-observable behaviour in its surface has an `it(...)` that asserts a state change. The floors below name the behaviours that **must** be present for the feature class. The ceiling is reached when every reachable bullet has a test and remaining gaps map to §6 archetypes (covered elsewhere, visual concern, third-party flow, dead behaviour).

These floors are framework-agnostic — the archetype shape is the same whether the app is Angular + Cypress or React + Playwright. Per-folder enforcement (CI gates on critical-spec presence, real-API smoke counts) lives in the project's `overrides.md`.

---

## Coverage Floors by Feature Archetype

### Auth flow

| Behaviour | Mock-first | Real-API |
|---|---|---|
| Sign in (happy) — credentials → land on home / dashboard | ✅ | ✅ (1 spec) |
| Sign in (invalid creds) — error surfaced, no navigation | ✅ | optional |
| Sign in (network error / 5xx) — error surfaced, retry path | ✅ | — |
| Sign out — auth state cleared, redirect, protected routes blocked | ✅ | ✅ |
| Session persistence across reload | ✅ | — |
| Session expiry → re-auth path | ✅ | — |
| Sign up — happy path | ✅ | optional |
| Sign up — email already taken / validation errors | ✅ | — |
| Password reset — request → email-sent confirmation | ✅ | — |
| Password reset — token validity / expiry | ✅ | — |
| Guard: protected route → redirect to login for guest | ✅ | — |
| Guard: post-login return-to-intended-route | ✅ | — |

**Ceiling note:** the auth provider's own hosted UI is §6 (third-party-owned). Assert only the *return-to-app* state.

---

### Cart / shopping basket

| Behaviour | Required |
|---|---|
| Empty state — empty message, checkout blocked/hidden | ✅ |
| Add from listing page → sidebar updated, count incremented | ✅ |
| Add from product page → same | ✅ |
| Add same product twice → quantity merged or duplicate line per project spec | ✅ |
| Navigate to cart page → line items with correct name/price/quantity | ✅ |
| Increase quantity → line total + subtotal recompute, mutation fired | ✅ |
| Decrease quantity → same in reverse | ✅ |
| Decrement at qty 1 → behaviour per spec (delete row or stay at 1) | ✅ |
| Remove one item (of two) → other remains, totals update | ✅ |
| Remove last item → empty state reappears | ✅ |
| Apply coupon (valid) → discount line appears, total decreases | ✅ |
| Apply coupon (invalid) → error surfaced, total unchanged | ✅ |
| Persist across reload | ✅ |
| Persist across route navigation | ✅ |
| Checkout button — navigates (or blocks for guest, asserting which) | ✅ |
| Guest vs logged-in differences (if any) | ✅ |

---

### Checkout flow

| Behaviour | Required |
|---|---|
| Step 1: shipping address — form validation, error surfacing | ✅ |
| Step 1: pre-filled from saved address for logged-in user | ✅ |
| Step 2: shipping method selection → recalculate totals | ✅ |
| Step 3: payment method selection → integration boundary | ✅ |
| Step 3: payment widget rendered — assert presence; widget internals are §6 | ✅ |
| Order summary — line items match cart, totals match | ✅ |
| Place order (happy) — confirmation page reached, order ID surfaced | ✅ (real-API, 1 spec) |
| Place order (declined) — error surfaced, cart preserved | ✅ |
| Back navigation between steps — data preserved | ✅ |
| Refresh during checkout — current step preserved or restart per spec | ✅ |
| Guest checkout path (if supported) | ✅ |

**Ceiling note:** payment processor widget internals (Stripe Elements, Adyen Drop-in, Braintree Hosted Fields) are §6. Assert the integration boundary (widget mounts, success callback navigates), not the widget's rendering.

---

### Browse / catalog

| Behaviour | Required |
|---|---|
| Listing page renders at least one product card with name + price | ✅ |
| Empty result (no products in category) → empty state | ✅ |
| Filter applied → product list updates, count updates, URL updates | ✅ |
| Filter cleared → reverts to unfiltered list | ✅ |
| Sort changed → product order changes | ✅ |
| Pagination — next page → URL updates, new products | ✅ |
| Search — query → results, no-results state | ✅ |
| Product card click → product detail page | ✅ |

---

### Product detail page

| Behaviour | Required |
|---|---|
| Renders name, price, images, description | ✅ |
| Variant selection (size, colour, configuration) → price/availability updates | ✅ |
| Out of stock → CTA disabled or replaced | ✅ |
| Add to cart → cart updates | ✅ (covered by cart, may dedupe) |
| Quantity selector → reflected in add-to-cart mutation | ✅ |
| Related products / cross-sells rendered (if part of design) | ✅ (presence only; click → other archetype) |

---

### Profile / account

| Behaviour | Required |
|---|---|
| Profile renders current user data | ✅ |
| Edit profile field → save → success state, value persisted across reload | ✅ |
| Edit profile field → validation error | ✅ |
| Change password — success | ✅ |
| Change password — wrong current pwd | ✅ |
| Orders list — renders, empty state, pagination if applicable | ✅ |
| Order detail — renders line items, totals, status | ✅ |
| Saved addresses — add / edit / delete | ✅ |
| Saved payment methods — list / add / delete (if applicable; widget internals §6) | ✅ |
| Sign out from profile | ✅ (covered by auth) |

---

### Forms (generic — contact, support, lead-gen)

| Behaviour | Required |
|---|---|
| Required-field validation on submit | ✅ |
| Format validation (email, phone, postcode) | ✅ |
| Submit (happy) → success state | ✅ |
| Submit (server error) → error surfaced, form preserved | ✅ |
| Field-level error clearing on input | ✅ |

---

### Layout / navigation (separate spec from journeys)

| Behaviour | Required |
|---|---|
| Header nav — links navigate, active state | ✅ |
| Mobile nav — hamburger opens, links navigate, closes on selection | ✅ |
| Footer — links navigate | ✅ |
| Logged-in vs guest header differences | ✅ |
| Language / region switcher (if applicable) — switches and persists | ✅ |
| Responsive viewports — desktop / tablet / mobile baseline assertions | ✅ |

---

## Interpreting a Verdict Outside the Expected Range

A verdict outside its archetype's floor is a smell — not an automatic failure, but a prompt to verify.

| Situation | Action |
|---|---|
| `AT CEILING` claimed on cart with only "add to cart" tested | Cart archetype requires the full quantity/totals/persistence surface. Push back. |
| `AT CEILING` claimed on checkout with no error paths | Place-order declined / shipping-method recalc / back-nav are reachable. Push back. |
| `AT CEILING` claimed on auth with no logout coverage | Logout is reachable and core. Push back. |
| Real-API spec count above 3 for any single feature | Real-API is for golden paths only. Most should be mocked. Push back. |

---

## Relationship between Floors and Ceilings

- **Floor** = "did the feature regress below the agreed minimum behavioural surface?" — checked at PR time against the archetype list.
- **Ceiling** = "did this specific feature get every test §6 allows?" — requires reading the components and effects; the author must enumerate every uncovered bullet.

A feature can sit at its §6 ceiling and still be below the floor — that signals a **product or implementation gap**, not more tests. When the ceiling is well below a floor, the author classifies each missing behaviour as `not-implemented`, `gated-by-flag`, or `out-of-scope-per-product` with concrete `component:line` or `route` references.

---

## When the project doesn't fit a listed archetype

The archetype list above is the common shapes for e-commerce / SaaS / web-app features. Projects with non-standard surfaces (data-grid heavy admin tools, real-time collaborative apps, dashboards with live charts) should add their own archetype tables to `overrides.md`. The orchestrator must read overrides — project-specific floors stack on top of these.
