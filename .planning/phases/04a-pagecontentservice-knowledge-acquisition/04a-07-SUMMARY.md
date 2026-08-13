---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 07
subsystem: content-side transport (messaging + serialization)
tags: [wxt, content-script, messaging, extraction, serialization, spa-navigation, bridge]

# Dependency graph
requires:
  - phase: 04a-03
    provides: MessageBusBridge / RuntimeEnvelope / ResponseEnvelope transport seam + ERROR_CODES canonical codes
  - phase: 04a-06
    provides: AxDomWalker (D-4a-12/13/20 RawNode walk) + SPANavigationWatcher (D-4a-01 wxt:locationchange detector)
provides:
  - "PAGE_CONTENT_EXTRACTED canonical MessageType (the ONLY Phase-4a canonical addition — Pitfall 5)"
  - "PageContextBridge requestExtraction(tabId, mode) bounded-wait roundtrip with opId correlation + typed CONTENT_EXTRACT_FAILED timeout (D-4a-03/19/22)"
  - "ExtractionPayload {html, baseUrl, truncated} interface contract — what PageContentService (04a-08) compiles against"
  - "ContentScriptHost.serializeForExtraction — clone/strip/stamp/truncate (D-4a-07/08/09), PAGE_HTML_MAX_BYTES = 2_097_152"
  - "Mode-discriminated EXTRACT_PAGE_CONTENT reply: 'default' → serialized HTML, 'actionable' → walked RawNode minus password values (D-4a-12/20)"
  - "SPA-nav invalidation signal: host rebuilds live context + upserts registry + publishes lightweight update (D-4a-01)"
affects: [04a-08, 04a-09, 04a-10, Phase 4b, Phase 5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "clone/strip/stamp/truncate serialization (RESEARCH Pattern 2 verbatim — content never parses, panel owns DOMParser)"
    - "bounded-wait request/reply with opId correlation + always-cleared timer + typed carrier rejection (T-1-14)"
    - "mode-discriminated reply payload over a single canonical MessageType (Pitfall 5 — no throwaway contracts)"

key-files:
  created:
    - tests/core/content/PageContextBridge.test.ts
  modified:
    - src/core/runtime/MessageType.ts
    - src/core/content/PageContextBridge.ts
    - src/core/content/ContentScriptHost.ts
    - src/core/content/SPANavigationWatcher.ts
    - src/entrypoints/core.content.ts
    - tests/core/content/ContentScriptHost.test.ts
    - tests/core/content/SPANavigationWatcher.test.ts

key-decisions:
  - "PAGE_CONTENT_EXTRACTED is the single canonical addition (Pitfall 5) — the reply reuses EXTRACT_PAGE_CONTENT's envelope + opId correlation; no throwaway contract"
  - "ExtractionPayload carries baseUrl as a SIBLING field (content bundle stays pure string manipulation; the panel injects `<base>` into its detached DOMParser doc — D-4a-08)"
  - "Timeout rejects typed with the D-4a-22 canonical CONTENT_EXTRACT_FAILED code — never the O.12 non-canonical string, never an unhandled rejection"
  - "PAGE_HTML_MAX_BYTES = 2_097_152 pinned/exported from ContentScriptHost (single home, test imports it); truncation walks back to the last COMPLETE CLOSING TAG before the cap — no dangling element"
  - "SPANavigationWatcher normalizes wxt's URL-instance newUrl (wxt 0.19.29 dispatches URL objects — a string-only guard would never fire in production)"

patterns-established:
  - "Pattern 1: mode-discriminated reply — EXTRACT_PAGE_CONTENT carries {tabId, mode}; the host replies default → ExtractionPayload / actionable → RawNode[] over ONE canonical reply type (D-4a-12)"
  - "Pattern 2: element-boundary truncation — walk back to the last `</...>` closing tag strictly before the cap (a bare `>` may be an opening tag, leaving a dangling element)"

requirements-completed: [CAT-01, CAT-02, CAT-04]

# Coverage metadata (#1602) — one entry per shipped deliverable
coverage:
  - id: D1
    description: "PAGE_CONTENT_EXTRACTED MessageType + PageContextBridge requestExtraction/replyExtracted bounded-wait roundtrip with opId correlation and typed CONTENT_EXTRACT_FAILED timeout"
    requirement: CAT-02
    verification:
      - kind: unit
        ref: "tests/core/content/PageContextBridge.test.ts#requestExtraction roundtrip (3 tests: resolve/typed-timeout/id-mismatch)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ContentScriptHost.serializeForExtraction — strip set (script/style/noscript/svg + cross-origin iframes + form-action attrs), baseUrl stamp, boundary truncation with truncated flag"
    requirement: CAT-01
    verification:
      - kind: unit
        ref: "tests/core/content/ContentScriptHost.test.ts#EXTRACT_PAGE_CONTENT (default) replies serialized HTML minus the strip set (D-4a-07)"
        status: pass
      - kind: unit
        ref: "tests/core/content/ContentScriptHost.test.ts#truncates an oversized serialized doc at an element boundary (D-4a-09)"
        status: pass
    human_judgment: false
  - id: D3
    description: "mode 'actionable' EXTRACT_PAGE_CONTENT reply — walked RawNode tree with password values omitted at capture (D-4a-20)"
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "tests/core/content/ContentScriptHost.test.ts#mode actionable replies with the walked RawNode tree minus password values (D-4a-12/20)"
        status: pass
    human_judgment: false
  - id: D4
    description: "SPA-nav watcher wiring (D-4a-01) — on wxt:locationchange the host rebuilds the live context, upserts the registry, publishes the lightweight live-context update; watcher normalizes wxt's URL-instance event shape"
    verification:
      - kind: unit
        ref: "tests/core/content/ContentScriptHost.test.ts#SPA-nav watcher callback rebuilds the live context + upserts the registry (D-4a-01)"
        status: pass
      - kind: unit
        ref: "tests/core/content/SPANavigationWatcher.test.ts#normalizes wxt URL-instance events to a string href (wxt 0.19.29 runtime shape)"
        status: pass
    human_judgment: false
  - id: D5
    description: "core.content.ts passes the wxt ctx into the host (watcher registers via ctx.addEventListener — auto-clean on invalidation); entrypoint stays ISOLATED / document_idle / <all_urls>"
    verification:
      - kind: other
        ref: "pnpm tsc --noEmit (ctx satisfies SPANavigationWatcherDeps structurally)"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-08-13
status: complete
---

# Phase 04a Plan 07: Content-Side Extraction Transport Summary

**Content-script extraction transport: canonical PAGE_CONTENT_EXTRACTED reply, PageContextBridge requestExtraction bounded-wait roundtrip (typed CONTENT_EXTRACT_FAILED timeout), ContentScriptHost serializeForExtraction (clone/strip/stamp/boundary-truncate, PAGE_HTML_MAX_BYTES = 2_097_152), mode-discriminated reply (default → serialized HTML / actionable → RawNode minus password values), and SPANavigationWatcher wiring (D-4a-01) with the wxt ctx threaded through core.content.ts**

## Performance

- **Duration:** 13 min (resume session — Task 1 committed previously)
- **Started:** 2026-08-13T01:42:00Z (resume)
- **Completed:** 2026-08-13T01:54:06Z
- **Tasks:** 2 (Task 1 resumed-complete, Task 2 executed RED→GREEN)
- **Files modified:** 8

## Accomplishments

- `PAGE_CONTENT_EXTRACTED` added as the ONE canonical Phase-4a MessageType (Pitfall 5) — the reply reuses EXTRACT_PAGE_CONTENT's request envelope + opId correlation
- `PageContextBridge.requestExtraction(tabId, mode)` — bounded-wait roundtrip (getCapabilities precedent) resolving on the matching opId reply, shape-validating the payload before resolve (sanitize precedent), and rejecting typed with the D-4a-22 canonical `CONTENT_EXTRACT_FAILED` code on timeout; timer always cleared (T-1-14)
- `ContentScriptHost.serializeForExtraction()` — RESEARCH Pattern 2 verbatim: clone → strip script/style/noscript/svg + cross-origin iframes (try/catch origin check, T-4a-20) + form-action attributes (inputs kept, D-4a-07) → stamp `document.baseURI` → serialize one string → truncate at the last COMPLETE CLOSING TAG before `PAGE_HTML_MAX_BYTES` with `truncated:true` (D-4a-09, no chunk protocol)
- Mode-discriminated EXTRACT_PAGE_CONTENT reply: `'default'` → `ExtractionPayload`, `'actionable'` → walked RawNode tree with password values omitted at capture (D-4a-20)
- SPANavigationWatcher wired in `start()` (constructor-injected deps for tests; production receives the wxt ctx from `core.content.ts`): onNavigate rebuilds the live context + upserts the registry + publishes the lightweight live-context update (D-4a-01 mark-stale signal)
- Rule 1 fix: the watcher now normalizes wxt's real URL-instance `newUrl` — wxt 0.19.29 dispatches `WxtLocationChangeEvent(new URL(...))`, so the previous string-only guard would have made the production nav signal dead

## Task Commits

Each task was committed atomically (TDD pairs):

1. **Task 1: MessageType addition + PageContextBridge request/reply contract (Pitfall 5)** — `884140c` (test) + `f85b9a2` (feat) — committed pre-resume, verified in this session's acceptance pass
2. **Task 2: ContentScriptHost serialization + watcher wiring + mode reply (D-4a-07/08/09/01)** — `118ac05` (test: 4 failing RED tests committed on resume) + `fb54845` (feat: implementation)

**Plan metadata:** (final docs commit — recorded in this SUMMARY's commit)

## Files Created/Modified

- `src/core/runtime/MessageType.ts` - `PAGE_CONTENT_EXTRACTED` canonical addition (Task 1, Pitfall 5)
- `src/core/content/PageContextBridge.ts` - `ExtractionPayload`, `ExtractionRequest`, `requestExtraction()` bounded-wait roundtrip, `replyExtracted()` ResponseEnvelope, typed CONTENT_EXTRACT_FAILED carrier (Task 1)
- `src/core/content/ContentScriptHost.ts` - `PAGE_HTML_MAX_BYTES = 2_097_152` export, `serializeForExtraction()`, mode-discriminated EXTRACT_PAGE_CONTENT reply, SPANavigationWatcher wiring + `handleNavigate` (Task 2)
- `src/core/content/SPANavigationWatcher.ts` - Rule 1 fix: URL-instance `newUrl` normalization + widened event interface (Task 2 deviation)
- `src/entrypoints/core.content.ts` - passes the wxt `ctx` into the host (`watcherDeps: ctx`); ISOLATED / document_idle / `<all_urls>` unchanged
- `tests/core/content/PageContextBridge.test.ts` - NEW: roundtrip resolve, typed timeout (code assert), id-mismatch ignored (Task 1)
- `tests/core/content/ContentScriptHost.test.ts` - extended: default serialized reply + strip set, boundary truncation, actionable RawNode password omission, SPA-nav watcher rebuild (Task 2)
- `tests/core/content/SPANavigationWatcher.test.ts` - added URL-instance normalization regression test (Task 2 deviation)

## Decisions Made

- **Pitfall 5 discipline:** PAGE_CONTENT_EXTRACTED is the only canonical addition; the reply reuses EXTRACT_PAGE_CONTENT's envelope + opId — no throwaway contract
- **Sibling baseUrl field:** ExtractionPayload carries `baseUrl` as a sibling field so the content bundle stays pure string manipulation; the panel injects `<base>` into its detached DOMParser doc (D-4a-08)
- **Typed timeout rejection:** requestExtraction rejects with `code === ERROR_CODES.CONTENT_EXTRACT_FAILED` (D-4a-22 canonical, never the O.12 string) — asserted in the test
- **Single home for the cap:** `PAGE_HTML_MAX_BYTES` exported from ContentScriptHost; tests import it from there
- **Element-boundary truncation = closing-tag boundary:** walk back to the last `</...>` before the cap — a bare `>` can be an opening tag and leave a dangling element
- **Watcher normalization:** `newUrl` accepted as string | URL (wxt dispatches URL objects at runtime); delivered to the host as a string href

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SPANavigationWatcher would never fire in production — wxt dispatches URL-instance newUrl**
- **Found during:** Task 2 (watcher wiring — the D-4a-01 signal is the point of the wiring)
- **Issue:** wxt 0.19.29's location-watcher dispatches `new WxtLocationChangeEvent(new URL(...))` (verified in `custom-events.mjs`/`location-watcher.mjs`), but the watcher's guard was `typeof newUrl === 'string'` — in production the callback never fires, so the nav invalidation signal would be dead.
- **Fix:** Normalize both shapes in the handler (`typeof newUrl === 'string' ? newUrl : newUrl?.href`), widened `WxtLocationChangeLikeEvent.newUrl` to `string | URL`, added a regression test dispatching a real URL-instance event.
- **Files modified:** src/core/content/SPANavigationWatcher.ts, tests/core/content/SPANavigationWatcher.test.ts
- **Verification:** SPANavigationWatcher suite 5/5 green; ContentScriptHost nav test green; `pnpm tsc --noEmit` green
- **Committed in:** fb54845 (Task 2 GREEN commit)

**2. [Rule 3 - Blocking] jsdom 4 MB parse exceeds vitest's default 5 s test timeout**
- **Found during:** Task 2 GREEN (truncation test)
- **Issue:** `document.body.innerHTML = unit.repeat(60000)` (4 MB / 60k elements) parses slowly in jsdom and intermittently blew past vitest's 5000 ms default timeout — a flaky RED test rather than a real failure.
- **Fix:** Explicit `30000` ms per-test timeout on the truncation test (test-infra only, no behavior change).
- **Files modified:** tests/core/content/ContentScriptHost.test.ts
- **Verification:** truncation test green across repeated runs; full content suite green
- **Committed in:** fb54845 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking/test-infra)
**Impact on plan:** Both fixes were required for the shipped behavior to be correct (production nav signal) and reliably verified. No scope creep.

## Issues Encountered

- **`-x` flag unknown in vitest 4.1.10:** the plan's `<verify>` commands spell `-x`; executed with `--bail=1` (same stop-on-first-failure semantics) — documented STATE.md precedent (04a-05), command-line only, no source impact.
- **Truncation boundary semantics:** the first truncation implementation ended at any `>` (an opening-tag boundary), leaving a dangling `<p>`; the test's `endsWith('</p>')` assertion pinned the requirement to a COMPLETE CLOSING TAG. Walk-back reimplemented to `lastIndexOf('</', scan)` → `indexOf('>', closeStart)`.

## TDD Gate Compliance

- Task 1: `884140c` test(RED) → `f85b9a2` feat(GREEN) — pair present
- Task 2: `118ac05` test(RED) → `fb54845` feat(GREEN) — pair present
- RED tests failed for the right reason at commit time (timeout/no-reply on the unimplemented host), not import or syntax errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **04a-08 ready:** PageContentService compiles against the committed `ExtractionPayload {html, baseUrl, truncated}` contract and consumes `requestExtraction(tabId, mode)` via the bridge — the interface-first ordering the plan promised; the SPA-nav `publishContext` mark-stale signal is the cache-invalidation trigger the service subscribes to (D-4a-01).
- **Out-of-scope note:** `04a-PATTERNS.md` is untracked (never committed with plan-phase artifacts) — logged to `deferred-items.md`.

## Self-Check: PASSED

- Created files exist: `tests/core/content/PageContextBridge.test.ts` ✓
- Commits exist: `884140c`, `f85b9a2`, `118ac05`, `fb54845` ✓ (verified via `git log --grep="04a-07"`)
- `pnpm vitest run tests/core/content --bail=1` → 4 files / 22 tests pass ✓
- `pnpm tsc --noEmit` → exit 0 ✓
- No forbidden lib import in host/entrypoint (grep clean) ✓
- Pitfall 5: only `PAGE_CONTENT_EXTRACTED` added to MessageType ✓
- Entrypoint world/runAt/matches unchanged ✓

---
*Phase: 04a-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-13*
