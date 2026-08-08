---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 03
subsystem: messaging, events, runtime
tags: [message-bus, event-bus, message-bus-bridge, runtime-envelope, whitelist, fake-browser, ports]

# Dependency graph
requires:
  - phase: 01-01
    provides: WXT 0.19 scaffold, vitest + WxtVitest, fakeBrowser, pnpm toolchain
  - phase: 01-02
    provides: RuntimeEnvelope/ResponseEnvelope contract, MessageType registry + MessageTypeValues whitelist
provides:
  - EventBus (typed in-panel events) + EventBusManager (shared singleton for all surfaces)
  - MessageBus wrapping runtime events (browser.runtime.onMessage/sendMessage) AND background port broadcasts (chrome.runtime.connect('np-port'))
  - MessageBusBridge — the phase-owned 7-method cross-context bridge contract (W3) that surfaces import (Rule R-4: never MessageBus directly)
  - Runtime whitelist enforcement (MSG_UNKNOWN_TYPE before dispatch) at every messaging boundary
affects: [01-04 (debugLog EVT_HANDLER/MSG_SERIALIZE wiring), 01-05 (EventBus/BroadcastBus subscribe), 01-06 (surfaces consume bridge), 01-07 (MessageBus/PortReader), 01-08 (shells), 01-09 (verify:phase-1)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bridge boundary pattern (R-4 module-level): MessageBusBridge is the only module that imports MessageBus; surfaces import the bridge. Enforced by acceptance grep on the bridge's imports."
    - "Same code path for tests and runtime: MessageBus wraps browser.runtime (fakeBrowser in vitest) and chrome.runtime ports — no test-only branches; fakeBrowser.runtime.connect is spied in tests because the fake does not implement it."
    - "Deferred-import debugLog guard: catch blocks call `typeof debugLog === 'function'`-guarded hooks with canonical §C.2 codes (EVT_HANDLER, MSG_SERIALIZE) until 01-04 ships src/core/log/debugLog.ts (Golden Rule 9)."

key-files:
  created:
    - src/core/events/EventBus.ts
    - src/core/events/EventBusManager.ts
    - src/core/messaging/MessageBus.ts
    - src/core/messaging/MessageBusBridge.ts
    - tests/core/events/EventBus.test.ts
    - tests/core/messaging/MessageBus.test.ts
    - tests/core/messaging/MessageBusBridge.test.ts
  modified: []

key-decisions:
  - "MessageBusBridge's 7-method contract (connect/disconnect/publish/subscribe/addMessageListener/removeMessageListener/getNetworkStatus) is PHASE-OWNED — it is not in the spec (W3); defined here, consumed by 01-06/01-07."
  - "port.enableEmitter is a wxt 0.21+ API that does not exist in pinned wxt ^0.19.29 (verified against the installed package) — the base chrome.runtime.Port API (postMessage/onMessage/onDisconnect) provides the same transport; documented in MessageBus.ts header (Rule 1)."
  - "MessageBus validates the MessageTypeValues whitelist at a single private choke point (isKnownType) so both publish/broadcastToPorts (throw MSG_UNKNOWN_TYPE) and inbound dispatch (silent drop) share one guard."
  - "EventBus handler errors are isolated per-handler (try/catch → debugLog EVT_HANDLER, typeof-guarded until 01-04) so one broken handler never breaks the loop (§13)."
  - "MessageBus/MessageBusBridge tests run in node env (not jsdom) with navigator.onLine stubbed for getNetworkStatus — jsdom 30's TextEncoder/esbuild invariant break (01-01 Rule 3 precedent) makes jsdom unusable for esbuild-loaded modules."

patterns-established:
  - "Bridge boundary: one wrapper module owns transport; consumers never touch chrome.runtime directly (R-4)"
  - "Whitelist at every messaging boundary: MessageTypeValues rejects unknown types before dispatch (Pitfall 5, T-1-04)"
  - "Deferred debugLog: typeof-guarded calls with canonical codes compile standalone before 01-04"

requirements-completed: [RUNTIME-02, WSPC-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "EventBus typed in-panel event system: subscribe/emit/unsubscribe/subscribeToScope with canonical 12-event registry; handler errors isolated (EVT_HANDLER); EventBusManager lazy singleton"
    requirement: WSPC-03
    verification:
      - kind: unit
        ref: "tests/core/events/EventBus.test.ts#one throwing handler does not break the next handler"
        status: pass
      - kind: unit
        ref: "tests/core/events/EventBus.test.ts#subscribeToScope delivers only events emitted for that scope"
        status: pass
      - kind: unit
        ref: "tests/core/events/EventBus.test.ts#returns the same shared EventBus instance (lazy singleton)"
        status: pass
    human_judgment: false
  - id: D2
    description: "MessageBus wraps runtime events AND background port broadcasts with one code path; MessageType whitelist rejects unknown types (throw MSG_UNKNOWN_TYPE); unsubscribe + disconnect lifecycle"
    requirement: WSPC-03
    verification:
      - kind: unit
        ref: "tests/core/messaging/MessageBus.test.ts#sendMessage delivers a RuntimeEnvelope-shaped message to a subscribed listener"
        status: pass
      - kind: unit
        ref: "tests/core/messaging/MessageBus.test.ts#publish() rejects messages with non-whitelist types (MSG_UNKNOWN_TYPE)"
        status: pass
      - kind: unit
        ref: "tests/core/messaging/MessageBus.test.ts#connect() registers the named port and broadcastToPorts posts to it"
        status: pass
    human_judgment: false
  - id: D3
    description: "MessageBusBridge phase-owned 7-method contract; the only module importing MessageBus (R-4); getNetworkStatus resolves navigator.onLine; listener add/remove lifecycle"
    requirement: WSPC-03
    verification:
      - kind: unit
        ref: "tests/core/messaging/MessageBusBridge.test.ts#publish→subscribe roundtrip delivers the RuntimeEnvelope"
        status: pass
      - kind: unit
        ref: "tests/core/messaging/MessageBusBridge.test.ts#removeMessageListener stops delivery"
        status: pass
      - kind: unit
        ref: "tests/core/messaging/MessageBusBridge.test.ts#getNetworkStatus resolves to navigator.onLine"
        status: pass
    human_judgment: false

# Metrics
duration: 38min
completed: 2026-08-08
status: complete
---

# Phase 1 Plan 3: Messaging + Event Infrastructure Summary

**MessageBus wrapping wxt runtime events + background port broadcasts, MessageBusBridge (the phase-owned 7-method cross-context contract surfaces import — never MessageBus directly), and a typed EventBus with scoped subscription — all whitelist-guarded against non-canonical message types**

## Performance

- **Duration:** 38 min
- **Started:** 2026-08-08T07:10:14Z
- **Completed:** 2026-08-08T07:48:02Z
- **Tasks:** 3
- **Files modified:** 7 (4 source + 3 tests)

## Accomplishments

- **EventBus + EventBusManager (Task 1):** typed in-panel event system with subscribe/emit/unsubscribe, `subscribeToScope('sidepanel'|'standalone'|'background')` returning an unsubscribe fn, emit-returns-boolean, and per-handler try/catch so one throwing handler never breaks the loop (§13). The canonical 12-event registry (SHOW_HANDOFF_PENDING … NETWORK_STATUS_CHANGED) ships in the same file the acceptance greps check. EventBusManager is the lazy singleton wrapper every surface subscribes through in 01-05/01-06.
- **MessageBus (Task 2):** ONE class wrapping BOTH transport paths — wxt runtime events (`browser.runtime.onMessage.addListener`/`sendMessage`, driven by fakeBrowser in tests) and background port broadcasts (`chrome.runtime.connect({name:'np-port'})` + `port.postMessage`/`onMessage`/`onDisconnect`). Same code path in tests and runtime; no test-only branches. A single `isKnownType` choke point rejects non-whitelist message types before dispatch — publish/broadcastToPorts throw `MSG_UNKNOWN_TYPE` (§C.2), inbound messages are silently dropped (T-1-04 spoof guard). `connect`/`publish`/`subscribe`/`broadcastToPorts`/`disconnect` with full port lifecycle.
- **MessageBusBridge (Task 3):** the PHASE-OWNED bridge contract (W3 — deliberately not in the spec): `connect()`, `disconnect()`, `publish()`, `subscribe()`, `addMessageListener()`, `removeMessageListener()`, `getNetworkStatus(): Promise<boolean>` (navigator.onLine). It is the single choke point surfaces import — surfaces NEVER import MessageBus directly (Rule R-4), enforced at module level by the acceptance grep. Only RuntimeEnvelope-shaped messages pass (compile-time type + runtime whitelist).
- **Whitelist enforcement everywhere (Pitfall 5 / T-1-04):** the MessageTypeValues whitelist from 01-02 guards every dispatch path; spoofed/non-canonical types never reach a handler, and outbound misuse throws with the canonical `MSG_UNKNOWN_TYPE` code.

## Task Commits

Each task was committed atomically:

1. **Task 1: EventBus + EventBusManager (typed event system)** - `9e27845` (feat)
2. **Task 2: MessageBus (wxt runtime + port bridge)** - `f1466be` (feat)
3. **Task 3: MessageBusBridge (cross-context bridge wrapper)** - `47e266f` (feat) + `f27f2f0` (feat: `unsubscribeListener` on MessageBus — the reference-based removal the bridge's `removeMessageListener` delegates to)

**Plan metadata:** `(pending)` docs commit

## Files Created/Modified

- `src/core/events/EventBus.ts` - Typed EventBus (subscribe/emit/unsubscribe/subscribeToScope) + canonical 12-event `EVENT_TYPES` registry; per-handler error isolation to debugLog EVT_HANDLER
- `src/core/events/EventBusManager.ts` - `getEventBus()` lazy singleton shared instance
- `src/core/messaging/MessageBus.ts` - Dual-transport MessageBus (runtime events + ports); `isKnownType` whitelist choke point; NP_PORT_NAME const
- `src/core/messaging/MessageBusBridge.ts` - Phase-owned 7-method bridge contract; only module importing MessageBus (R-4); getNetworkStatus via navigator.onLine
- `tests/core/events/EventBus.test.ts` - 10 tests (delivery, unsubscribe, scoped delivery, error isolation, singleton)
- `tests/core/messaging/MessageBus.test.ts` - 8 tests (sendMessage delivery, whitelist rejection both directions, unsubscribe, port broadcast, disconnect)
- `tests/core/messaging/MessageBusBridge.test.ts` - 7 tests (roundtrip, listener add/remove, whitelist rejection, network status, delegation)

## Decisions Made

- **Bridge contract is phase-owned (W3):** the 7 methods are defined here because the spec's §19.2 ("Local Model Small Context", line 2962) does not define them. 01-06/01-07 consume this exact contract.
- **Base Port API instead of `port.enableEmitter`:** `enableEmitter` is a wxt 0.21+ stream API; the pinned wxt ^0.19.29 does not ship it (verified by grepping the installed package). The base `chrome.runtime.Port` transport (`postMessage`/`onMessage.addListener`/`onDisconnect`) delivers the same PORT_STREAM_* capability. Documented in the MessageBus.ts header.
- **Single whitelist choke point:** MessageBus routes all whitelist checks through one private `isKnownType` so the guard is uniform and auditable (also satisfies the plan's `grep -c "MessageTypeValues" == 1` acceptance).
- **Node env for messaging tests:** jsdom 30's TextEncoder/esbuild Uint8Array invariant break (01-01 Rule 3 precedent) makes jsdom unusable for these esbuild-loaded tests; MessageBus tests run in node env, and the bridge test stubs `globalThis.navigator = { onLine: true }` so `getNetworkStatus` is still asserted against `navigator.onLine`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `port.enableEmitter` does not exist in pinned wxt ^0.19.29**
- **Found during:** Task 2 (MessageBus port path)
- **Issue:** The plan's action text says "including port.enableEmitter for wxt-safe streams" — but `enableEmitter` is a wxt 0.21+ API. Grepping the installed `wxt@0.19.29` package (dist + types) finds zero occurrences. Importing it would fail tsc.
- **Fix:** Implemented the background port broadcast path with the base `chrome.runtime.Port` API (`chrome.runtime.connect({name:'np-port'})` + `port.postMessage` + `port.onMessage.addListener` + `port.onDisconnect`), which is exactly what `enableEmitter` wraps in newer wxt — same transport, same PORT_STREAM_* capability. Noted in the MessageBus.ts header.
- **Files modified:** src/core/messaging/MessageBus.ts
- **Verification:** Port broadcast test (spied `fakeBrowser.runtime.connect`) passes; `pnpm tsc --noEmit` green.
- **Committed in:** f1466be (Task 2 commit)

**2. [Rule 3 - Blocking] jsdom 30 TextEncoder/esbuild invariant break blocked the bridge test**
- **Found during:** Task 3 (first `vitest run` of MessageBusBridge.test.ts)
- **Issue:** The default jsdom environment fails with esbuild's `new TextEncoder().encode("") instanceof Uint8Array` invariant violation — the same documented 01-01 Rule 3 issue — for any esbuild-loaded module.
- **Fix:** Ran the bridge test in the node environment (`@vitest-environment node`, matching 01-02 precedent) and stubbed `globalThis.navigator = { onLine: true }` in `beforeAll` so `getNetworkStatus` resolves against a real `navigator.onLine`. MessageBus.test.ts also uses node env (it never touches navigator).
- **Files modified:** tests/core/messaging/MessageBus.test.ts, tests/core/messaging/MessageBusBridge.test.ts
- **Verification:** 8/8 + 7/7 tests pass; full suite 34/34 green.
- **Committed in:** f1466be, 47e266f (Task 2/3 commits)

**3. [Rule 3 - Blocking] fakeBrowser does not implement `chrome.runtime.connect`**
- **Found during:** Task 2 (port broadcast test)
- **Issue:** `@webext-core/fake-browser`'s runtime object throws "Browser.runtime.connect not implemented" — the fake has no in-memory port implementation.
- **Fix:** The tests `vi.spyOn(fakeBrowser.runtime, 'connect')` and return a minimal controllable fake Port (postMessage/onMessage/onDisconnect with triggerInbound helper). The plan's flagged_assumption already acknowledged port wiring is verified via fakeBrowser, not a real browser.
- **Files modified:** tests/core/messaging/MessageBus.test.ts, tests/core/messaging/MessageBusBridge.test.ts
- **Verification:** Port broadcast + delegation tests pass.
- **Committed in:** f1466be, 47e266f (Task 2/3 commits)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 API drift, 2 Rule 3 blockers)
**Impact on plan:** All fixes were necessary to build/test against the pinned toolchain (wxt 0.19.29 + fakeBrowser 1.5.2 + jsdom 30). No scope creep — no features added beyond the plan's contract; the port transport is the same capability by a different (base) API.

## Issues Encountered

- **REQUIREMENTS.md RUNTIME-02 text/plan mismatch (flagged for phase verifier):** the plan frontmatter declares `requirements: [RUNTIME-02, WSPC-03]` and its flagged_assumption frames RUNTIME-02 as "messaging — MessageBus uses wxt fakeBrowser runtime events in vitest". However, REQUIREMENTS.md's RUNTIME-02 line reads "Side panel opens; first-run onboarding appears on fresh install" — a 01-08 shells/onboarding concern, not messaging. This plan's messaging work satisfies the plan's *intent* for RUNTIME-02 but arguably not the requirement's *text*. Marked complete per plan declaration (mirroring 01-02's treatment of WSPC-03); the phase verifier should confirm whether RUNTIME-02's wording needs reconciliation with the spec's §18 mapping.
- **`requirements mark-complete` tool limitation:** gsd-tools reported `table_unmatched` for both IDs because REQUIREMENTS.md's traceability table uses range rows (`RUNTIME-01…05`), which the verb cannot index. Checkboxes were still updated (confirmed via git diff); the traceability row was updated manually, mirroring 01-02's pattern.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **01-04 (debugLog/errorCodes/TraceRedactor):** EventBus + MessageBus already call the deferred `debugLog` hook with canonical codes (EVT_HANDLER, MSG_SERIALIZE) guarded by `typeof` — 01-04 replaces the ambient `declare const debugLog` with the real `@/core/error/debugLog` import in both files.
- **01-05 (ThemeStore/BroadcastBus/KeymapRegistry):** subscribes via `getEventBus()` and consumes the EVENT_TYPES registry; BroadcastBus reuses MessageBus's runtime-event path.
- **01-06 (WorkspaceStore/WorkspaceRouter/WorkspaceSync):** surfaces consume `MessageBusBridge` — not MessageBus — per R-4; WORKSPACE_* messages flow through the whitelisted bridge.
- **01-07 (MessageBus/PortReader/content bridge):** builds on the port path (`np-port`) and PORT_STREAM_* protocol established here.
- **01-08 (shells/onboarding/cmdk):** EventBus's SIDEPANEL_OPENED/STANDALONE_OPENED/THEME_CHANGED events are ready for shell wiring.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

- All 7 created files exist on disk (4 source + 3 tests)
- All 4 task commits found in git log: 9e27845 (Task 1), f1466be (Task 2), 47e266f + f27f2f0 (Task 3)
- Plan `<verification>` green: `pnpm vitest run tests/core/events tests/core/messaging` → 25/25 passed; `pnpm tsc --noEmit` → exit 0
- Full suite green: `pnpm vitest run` → 34/34 passed
- All acceptance criteria greps pass:
  - Task 1: `grep -c "subscribeToScope" EventBus.ts` == 1 ✓; `grep -c "SHOW_HANDOFF_PENDING\|WORKSPACE_SYNC_START\|THEME_CHANGED" EventBus.ts` == 3 ✓
  - Task 2: `grep -c "MessageTypeValues" MessageBus.ts` == 1 ✓; transport refs >= 2 ✓
  - Task 3: bridge methods == 3 ✓; `from '@/core/messaging/MessageBus'` import count == 1 ✓
- eslint + prettier green on all 7 files
