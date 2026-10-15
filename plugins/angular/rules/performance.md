---
paths:
  - "**/*.ts"
  - "**/*.html"
  - "**/angular.json"
---

# Frontend performance

A hunting list of what actually causes performance bugs in Angular apps. Rules already owned elsewhere (OnPush, `@for` track, `@defer` blocks, lazy routes, template purity) are not restated.

## Render hot path
- `computed(() => ({ ...x() }))` recreating objects/arrays defeats `===` equality and re-fires every dependent — hoist stable references or memoise on a key.
- `track $index` on keyed data recreates DOM on every reorder — track the record id.
- Long scrolling lists (~50+ rows) get virtual scrolling (`cdk-virtual-scroll-viewport` or the library's equivalent).

## Signals and effects
- Effects writing signals that other effects read cascade work every tick — derive with `computed` instead.
- A `computed` reading a wide signal to produce a narrow value re-runs on every change of the wide one — split the source.
- `toSignal()` without `initialValue` renders `undefined` for a frame.
- Server-state query keys built from a fresh object each render refetch in a loop — keys are stable, value-equal structures.

## Network
- Duplicate identical requests — share at the service edge (`shareReplay({ bufferSize: 1, refCount: true })`) or through the server-state layer.
- Waterfalls — independent requests run in parallel (`forkJoin` / `Promise.all`).
- A mutation that doesn't invalidate or refetch its dependents leaves stale UI.
- Polling backs off on failure, or moves to push.
- Over-fetching — a page showing three fields asks for a projection or a thinner DTO.

## Bundle
- Anything imported from `core/` lands in the initial chunk — keep heavy SDKs (observability, editors, charts) behind dynamic `import()`.
- No whole-library imports (`import * as _ from 'lodash'`); per-function import paths.
- Bundle-budget warnings are treated as errors; a new dependency over ~30 KB needs a justification in the plan.
- After a non-trivial dependency change, look at the bundle (source-map explorer or the build stats) — "it compiled" is not the bar.

## Assets
- Images have `width`/`height` (or an aspect ratio); `NgOptimizedImage` (`ngSrc`) for the LCP image (`priority`) and below-the-fold images.
- Web fonts use `font-display: swap`; each custom font is justified.

## SSR (when the app renders on the server)
- Every awaited request during render adds to TTFB — cap with timeouts, cache where freshness allows.
- Transfer only what hydration needs; the browser reads it from the transfer cache instead of refetching.
- Third-party scripts load browser-side only (`afterNextRender`).

## Targets
LCP ≤ 2.5 s · CLS ≤ 0.1 · INP ≤ 200 ms. Real-user data beats lab scores when prioritising.

## When you find a performance bug
- Measure before optimising — the Performance and Network panels, `console.time`, the bundle stats. "Feels slow" is not a finding.
- Fix the cheapest cause first: a stable key beats a virtual scroller; a deferred chunk beats a faster CDN.
- Show the metric moved — numbers in the worklog or PR, not "should be faster".
