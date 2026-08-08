---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 11
subsystem: workspace
tags: [messaging-hardening, error-observability, workspace-sync, background-router, gap-closure, security]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: "01-10 mount wiring that makes WorkspaceSync/BroadcastBus LIVE in production — the hardening in this plan protects the now-reachable sync path"
provides:
  - "Golden Rule 9 restored in the messaging layer: EventBus/MessageBus/BroadcastBus now import the real debugLog + ERROR_CODES and call EVT_HANDLER/MSG_SERIALIZE directly (WR-01); ProviderRegistry.notify catch logs EVT_HANDLER (WR-08) — the R-10 observability contract is live where it was silently dead"
  - "WorkspaceSync inbound adoption hardened (WR-04): shared sanitizeStored (T-1-13) exported from WorkspaceStore, handleRemoteUpdate now shape-validates → workspaceId scope-gates (M.3, foreign workspaces ignored) → version-LWW → field-preserving merge adoption; 2 new negative tests"
  - "BackgroundRouter listener hardened (WR-09): shared isRuntimeEnvelopeShape predicate guards SHAPE before the whitelist TYPE check; malformed messages from valid senders get a MSG_DESERIALIZE fail-envelope reply instead of a synchronous throw; manual cast removed"
affects: [01-mv3-wxt-runtime-antd-shells-workspace, 02-storage-persistence, security phase (TraceRedactor real redaction per WR-07), real-browser e2e verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared inbound gates: sanitizeStored (storage/remote workspace values) and isRuntimeEnvelopeShape (runtime messages) are single exported predicates consumed by every inbound path — never duplicated"
    - "Fail-envelope reply over synchronous throw in runtime listeners: workerState.fail(MSG_DESERIALIZE, ...) + return true so the sender promise resolves"
    - "Field-preserving merge adoption ({ ...local, ...sanitized }) keeps inert D-18 fields local (T-1-05)"

key-files:
  created: []
  modified:
    - src/core/events/EventBus.ts
    - src/core/messaging/MessageBus.ts
    - src/core/runtime/BroadcastBus.ts
    - src/core/ai/ProviderRegistry.ts
    - src/core/workspace/WorkspaceStore.ts
    - src/core/workspace/WorkspaceSync.ts
    - src/core/background/BackgroundRouter.ts
    - tests/core/workspace/WorkspaceSync.test.ts

key-decisions:
  - "Adopted the err instanceof Error ? err : undefined pattern in the rewired catch bodies — the plan's literal { error: err } would fail tsc (strict catch variables are unknown; DebugLogOptions.error is Error), and the WorkspaceStore/ProviderRegistry precedent already uses the narrowing pattern"
  - "Kept ERROR_CODES.MSG_SERIALIZE in MessageBus/BroadcastBus publish catches (IN-04's CONNECT_FAILED suggestion explicitly deferred — error-code registry churn without a spec C.2 update is out of scope)"
  - "No BackgroundRouter test added — fakeBrowser does not model sender.id for sendMessage dispatch (verified, plan-prescribed); verification is source assertion + tsc + full gate"

patterns-established:
  - "Export-once guard predicates consumed across module boundaries (MessageBus.isRuntimeEnvelopeShape used by BackgroundRouter; WorkspaceStore.sanitizeStored used by WorkspaceSync)"
  - "Inbound validation ordering: SHAPE guard before TYPE/whitelist check before payload access"

requirements-completed: [WSPC-03, WSPC-05]

coverage:
  - id: D1
    description: "Golden Rule 9 restored in the messaging layer — EventBus/MessageBus/BroadcastBus catch bodies reach the real debugLog with canonical §C.2 codes (EVT_HANDLER/MSG_SERIALIZE) and ProviderRegistry's notify catch logs EVT_HANDLER; the ambient hook and typeof guards are fully gone from src/ (WR-01/WR-08)"
    requirement: "WSPC-05"
    verification:
      - kind: other
        ref: "grep -rn 'import { debugLog }' src/core/events/EventBus.ts src/core/messaging/MessageBus.ts src/core/runtime/BroadcastBus.ts | grep -vc '://' → 3"
        status: pass
      - kind: other
        ref: "grep -rn 'declare const debugLog|typeof debugLog' src/core/events/ src/core/messaging/ src/core/runtime/ | grep -vc '://' → 0"
        status: pass
      - kind: other
        ref: "grep -c 'ERROR_CODES.EVT_HANDLER' src/core/ai/ProviderRegistry.ts → 1"
        status: pass
      - kind: unit
        ref: "pnpm vitest run tests/core/events tests/core/messaging tests/core/runtime → 46 passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "WorkspaceSync inbound adoption hardened — handleRemoteUpdate routes remote state through the shared sanitizeStored (T-1-13), ignores malformed payloads and foreign-workspaceId snapshots (M.3 scope gate), and adopts same-workspace higher-version snapshots via a field-preserving merge (WR-04)"
    requirement: "WSPC-03"
    verification:
      - kind: other
        ref: "grep 'export function sanitizeStored' src/core/workspace/WorkspaceStore.ts | grep -vc '://' → 1"
        status: pass
      - kind: other
        ref: "grep 'workspaceId !== local.workspaceId' src/core/workspace/WorkspaceSync.ts | grep -vc '://' → 1"
        status: pass
      - kind: unit
        ref: "tests/core/workspace/WorkspaceSync.test.ts#a WORKSPACE_UPDATED with a higher remote version merges into the store (same-workspaceId fixture, v9)"
        status: pass
      - kind: unit
        ref: "tests/core/workspace/WorkspaceSync.test.ts#a WORKSPACE_UPDATED from a foreign workspaceId is ignored (M.3 scope gate)"
        status: pass
      - kind: unit
        ref: "tests/core/workspace/WorkspaceSync.test.ts#a malformed WORKSPACE_UPDATED state payload is ignored (T-1-13)"
        status: pass
      - kind: unit
        ref: "pnpm vitest run tests/core/workspace/WorkspaceSync.test.ts tests/core/workspace/WorkspaceStore.test.ts → 18 passed"
        status: pass
    human_judgment: false
  - id: D3
    description: "BackgroundRouter inbound shape guard — the listener validates envelope SHAPE via the shared isRuntimeEnvelopeShape before any property access and replies workerState.fail(MSG_DESERIALIZE, 'malformed envelope') instead of throwing synchronously; manual type assertion removed (WR-09)"
    verification:
      - kind: other
        ref: "grep 'export function isRuntimeEnvelopeShape' src/core/messaging/MessageBus.ts | grep -vc '://' → 1"
        status: pass
      - kind: other
        ref: "grep -c 'isRuntimeEnvelopeShape' src/core/background/BackgroundRouter.ts → 4 (import + guard + comments)"
        status: pass
      - kind: other
        ref: "grep -c 'ERROR_CODES.MSG_DESERIALIZE' src/core/background/BackgroundRouter.ts → 1"
        status: pass
      - kind: other
        ref: "pnpm verify:phase-1 → eslint + prettier + tsc + wxt build + 26 files/169 tests + content-bundle clean, exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-08-08
status: complete
---

# Phase 1 Plan 11: Messaging & Workspace-Sync Hardening Summary

**Golden Rule 9 error observability restored in the now-live messaging layer (real debugLog imports replacing the never-bound ambient hook in EventBus/MessageBus/BroadcastBus + ProviderRegistry's empty catch filled), WorkspaceSync inbound adoption hardened with the shared T-1-13 sanitizer and M.3 workspaceId scope gate, and BackgroundRouter guarded against malformed inbound envelopes with a fail-envelope reply — phase gate re-green at 26 files / 169 tests**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-08T22:06:30Z
- **Completed:** 2026-08-08T22:15:15Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- **WR-01 closed:** the ambient `declare const debugLog: DebugLogFn | undefined` hook — never bound at runtime, making every guarded catch body dead — is deleted from EventBus/MessageBus/BroadcastBus. Each module now imports the real `debugLog` + `ERROR_CODES` and calls `EVT_HANDLER` (EventBus, both scoped variants) / `MSG_SERIALIZE` (MessageBus.publish, BroadcastBus.emit) directly. The regression guard greps (`declare const debugLog` / `typeof debugLog` across the three dirs) return 0.
- **WR-08 closed:** ProviderRegistry's empty `notify()` catch now logs `EVT_HANDLER` with the module tag — a broken listener is isolated AND visible.
- **WR-04 closed:** `sanitizeStored` is exported from WorkspaceStore as the single T-1-13 inbound gate (still used by the store's own onChanged handler). `WorkspaceSync.handleRemoteUpdate` now runs remote state through the full pipeline: shape pre-check → sanitizeStored (malformed → ignored, logged) → workspaceId scope gate (foreign workspace → ignored, logged) → version-LWW (lower/equal → ignored) → adoption via `{ ...local, ...sanitized }` field-preserving merge. Three tests cover adopted (same-id v9 merge asserting conversationId/activeSurface), foreign-id ignored (v99 rejected), and malformed state ignored.
- **WR-09 closed:** `isRuntimeEnvelopeShape` is exported from MessageBus (single shared predicate — MessageBus.dispatchInbound and BackgroundRouter both use it). BackgroundRouter's listener validates SHAPE immediately after the §16.2 sender.id guard and before the whitelist TYPE check; a malformed message from a valid sender gets `workerState.fail(ERROR_CODES.MSG_DESERIALIZE, 'malformed envelope')` + `return true` instead of a synchronous TypeError that would hang the sender's promise. The manual `as RuntimeEnvelope` cast is gone (the type predicate narrows).
- Phase gate re-green end-to-end: `pnpm verify:phase-1` exits 0 (eslint → prettier → tsc → wxt build → 26 files / **169 tests** → content-bundle clean). The +2 tests over 01-10's 167 are the new WorkspaceSync negatives.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire dead error logging — real debugLog in EventBus/MessageBus/BroadcastBus (WR-01) + ProviderRegistry catch (WR-08)** - `83156a8` (feat)
2. **Task 2: Harden WorkspaceSync inbound adoption — shared sanitizer + workspaceId scope gate (WR-04)** - `c0d4350` (feat)
3. **Task 3: BackgroundRouter inbound shape guard — shared predicate + fail-envelope reply (WR-09)** - `f54dfc5` (feat)

**Plan metadata:** pending final metadata commit

## Files Created/Modified

- `src/core/events/EventBus.ts` - Ambient `DebugLogFn` hook declaration deleted; real `debugLog`/`ERROR_CODES` imports added; both catch bodies now call `debugLog(ERROR_CODES.EVT_HANDLER, ...)` directly with `context: 'EventBus.emit'` / `'EventBus.emit.scope'`; stale 'deferred 01-04' header note replaced with the 01-11 wiring note
- `src/core/messaging/MessageBus.ts` - Same rewire (catch body → `debugLog(ERROR_CODES.MSG_SERIALIZE, ...)`); `isRuntimeEnvelopeShape` promoted from module-private to exported (single shared shape guard)
- `src/core/runtime/BroadcastBus.ts` - Same rewire (catch body → `debugLog(ERROR_CODES.MSG_SERIALIZE, ...)`); guard wrapper removed
- `src/core/ai/ProviderRegistry.ts` - `notify()` catch now logs `ERROR_CODES.EVT_HANDLER` with `module: 'ProviderRegistry'` (WR-08)
- `src/core/workspace/WorkspaceStore.ts` - `sanitizeStored` exported; doc comment updated to document the shared T-1-13 inbound-gate role
- `src/core/workspace/WorkspaceSync.ts` - Store import extended to include `sanitizeStored`; `handleRemoteUpdate` rewritten: shape-check → sanitizeStored → workspaceId scope gate → version-LWW → `{ ...local, ...sanitized }` merge; ignored paths log `WORKSPACE_SYNC`
- `src/core/background/BackgroundRouter.ts` - `isRuntimeEnvelopeShape` import; shape guard immediately after the sender.id check; `workerState.fail(MSG_DESERIALIZE, 'malformed envelope')` reply; manual `as` cast removed; header comment documents SHAPE-before-TYPE ordering
- `tests/core/workspace/WorkspaceSync.test.ts` - Adoption fixture updated to same-workspaceId (`ws-local`, v9, still asserting `conv-remote`/`standalone` merge); +2 negative tests (foreign `ws-foreign` v99 ignored; malformed `{ state: { version: 99 } }` ignored); header comment documents the WR-04 coverage

## Decisions Made

- **`err instanceof Error ? err : undefined` in rewired catch bodies** — the plan's literal `{ error: err }` fails tsc: strict-mode catch variables are `unknown` while `DebugLogOptions.error` is `Error`. The narrowing pattern matches WorkspaceStore/ProviderRegistry precedent (Rule 1 type-correctness adaptation; identical runtime behavior).
- **Kept `MSG_SERIALIZE` in publish/emit catches** — IN-04's `CONNECT_FAILED` suggestion is explicitly deferred (error-code registry churn without a spec C.2 update is out of gap-closure scope, per plan context).
- **No BackgroundRouter test added** — fakeBrowser does not model `sender.id` for `sendMessage` dispatch (plan-verified); verification is source assertion + tsc + the full phase gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `{ error: err }` fails tsc under strict catch-variable typing**
- **Found during:** Task 1 (error-logging rewire)
- **Issue:** The plan's literal call shape `debugLog(ERROR_CODES.EVT_HANDLER, ..., { error: err, ... })` does not type-check — `catch (err)` binds `unknown` under `strict` while `DebugLogOptions.error` is `Error | undefined`. The LSP surfaced `Type 'unknown' is not assignable to type 'Error | undefined'` in all four rewired catches.
- **Fix:** Used the established narrowing pattern `error: err instanceof Error ? err : undefined` — the exact shape WorkspaceStore and ProviderRegistry already use. Message text, payload keys, and codes are unchanged.
- **Files modified:** src/core/events/EventBus.ts, src/core/messaging/MessageBus.ts, src/core/runtime/BroadcastBus.ts
- **Verification:** `pnpm tsc --noEmit` exit 0; all messaging/events/runtime suites pass (46 tests); full gate green
- **Committed in:** 83156a8 (Task 1 commit)

**2. [Rule 3 - Blocking] Prettier rejected EventBus.ts in the full phase gate**
- **Found during:** Task 3 (verify:phase-1 run)
- **Issue:** The first `pnpm verify:phase-1` run failed at `prettier --check` — the scoped-handler `debugLog(...)` call in EventBus.ts exceeded prettier's print width and needed wrapping onto multiple lines.
- **Fix:** Applied prettier's canonical formatting to that call (`debugLog(\n ERROR_CODES.EVT_HANDLER,\n \`EventBus scoped handler error for scope ...\`, { ... })`); re-ran the full gate green.
- **Files modified:** src/core/events/EventBus.ts
- **Verification:** `pnpm verify:phase-1` exits 0 (prettier check passes)
- **Committed in:** f54dfc5 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were required for gate-green and type-correctness. No scope creep; no architectural changes; no behavior change beyond the intended logging/safety semantics.

## Issues Encountered

- The full `pnpm verify:phase-1` first run failed on prettier formatting (fixed as deviation 2); the second run passed end-to-end (26 files / 169 tests, content-bundle clean).
- The 3000ms heartbeat timer from WorkspaceSync.start() remains live in jsdom entrypoint tests (unchanged from 01-10); the suite still exits cleanly with no open-handle failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The now-live sync path (01-10 wiring) is safe and observable: every catch in the messaging layer reaches debugLog with a canonical §C.2 code; WorkspaceSync rejects malformed and foreign-workspace snapshots; BackgroundRouter survives malformed inbound messages with a fail-envelope reply.
- Phase gate re-green with no regression to the 9 executed plans or to 01-10; REQUIREMENTS.md traceability rows for WSPC-03/WSPC-05 remain owned (mark-complete via `requirements mark-complete`).
- **Deferred (unchanged by this plan):** WR-05 (Options deep-link, standalone-nav persistence work), WR-06 (OptionsPage theme-save toast, ThemeStore write-path change), WR-07 (debugLog `options.extra` redaction — the security phase that implements real TraceRedactor), D-09 onboarding-completes-once-provider-configured (Phase 3).
- **Outstanding human-verification items** (carried from 01-VERIFICATION.md, executable only on a host with Chrome system libs): real-browser cross-window PING/PONG election, LWW adoption, malformed-message behavior in a live extension, theme propagation across surfaces.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

- Created files verified on disk: `01-11-SUMMARY.md` and all 8 modified source/test files — FOUND
- Commits verified in git log: `83156a8` (feat, Task 1), `c0d4350` (feat, Task 2), `f54dfc5` (feat, Task 3) — FOUND
- Final `pnpm verify:phase-1` exit 0; 26 files / 169 tests green; content bundle clean
