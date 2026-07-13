---
phase: 06-transaction-logging-and-diagnostics
plan: 05
subsystem: telemetry
tags: [debug-log, redaction, pruning, retention, indexeddb, tdd]

# Dependency graph
requires:
  - phase: 06-01
    provides: Scaffolded test files (pruning.test.ts skeleton)
  - phase: 06-02
    provides: TraceRedactor singleton with redactValue() method
  - phase: 06-03
    provides: AITransactionLogDB with getTotalCount, deleteTraces, queryTransactions
  - phase: 06-04
    provides: AITransactionLog.schedulePrune hook (export let schedulePrune)
provides:
  - debugLog auto-redaction safety net via traceRedactor.redactValue() (D-10)
  - Tiered retention pruning: count-based (failure-prioritized) + time-based (D-25 through D-29, D-36)
  - Debounced prune scheduling with queue-when-in-progress (D-36)
  - Startup pruning (immediate) + periodic (5-min interval) (D-29)
affects: [06-06 (AITransactionLog integration), 06-07 (DiagnosticsPanel)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Namespace-import wiring for cross-module hook assignment (pruning.ts → AITransactionLog.schedulePrune)
    - Mock IndexedDBManager.getDB for pruning unit tests with fake idb
    - Controlled fake-timer debounce testing via vi.useFakeTimers() + vi.advanceTimersByTime()

key-files:
  created:
    - src/core/telemetry/pruning.ts (197 lines)
    - tests/core/telemetry/pruning.test.ts (290 lines, 5 tests)
    - tests/core/utils/debugLog.test.ts (43 lines, 4 tests)
  modified:
    - src/core/utils/debugLog.ts (added traceRedactor import + redactValue wrapping)

key-decisions:
  - "pruning.ts works directly with IndexedDB via getDB() for maximum flexibility across all trace stores, rather than going through AITransactionLogDB (which only has queryTransactions for one store)"
  - "pruneNow sorts records with failures first (timestamp ASC) then successes (timestamp DESC) — this keeps all failures + newest successes within the maxCount limit"
  - "schedulePrune hook wired via namespace-import property assignment (import * as AITransactionLogModule) since ESM let exports are mutable namespace slots"
  - "Debounce/queue tests use side-effect tracking (transaction done promise) and timer-reset verification instead of spying on pruneNow (module-internal reference bypasses spy)"

requirements-completed:
  - TELE-05

coverage:
  - id: D1
    description: "debugLog auto-redacts all data arguments through TraceRedactor.redactValue() before console output (D-10)"
    requirement: TELE-05
    verification:
      - kind: unit
        ref: "tests/core/utils/debugLog.test.ts#redacts API keys from object data"
        status: pass
      - kind: unit
        ref: "tests/core/utils/debugLog.test.ts#redacts Bearer tokens from string data"
        status: pass
      - kind: unit
        ref: "tests/core/utils/debugLog.test.ts#does not throw when data is undefined"
        status: pass
      - kind: unit
        ref: "tests/core/utils/debugLog.test.ts#passes through primitive data unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "pruning.ts exports startPruning, scheduleDebouncedPrune, pruneNow with tiered retention (D-26, D-27, D-29, D-36)"
    requirement: TELE-05
    verification:
      - kind: unit
        ref: "tests/core/telemetry/pruning.test.ts#pruneNow removes oldest successful records when count exceeds max"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/pruning.test.ts#pruneNow preserves failed/error records when count exceeds max"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/pruning.test.ts#pruneNow removes records older than retention period"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/pruning.test.ts#scheduleDebouncedPrune debounces multiple calls within 30s window to single execution"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/pruning.test.ts#scheduleDebouncedPrune resets the timer on rapid calls, never exceeds one execution"
        status: pass
    human_judgment: false

# Metrics
duration: 8 min
completed: 2026-07-13
status: complete
---

# Phase 6 Plan 5: Defensive Redaction + Tiered Retention Pruning Summary

**debugLog auto-redaction safety net via TraceRedactor redactValue(), and pruning.ts with failure-prioritized count-based + time-based tiered retention, debounced 30s scheduling, and AITransactionLog.schedulePrune hook wiring**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-13T06:45:00Z
- **Completed:** 2026-07-13T06:53:00Z
- **Tasks:** 2 (both TDD with RED→GREEN commit sequence)
- **Files modified:** 5

## Accomplishments

- debugLog now automatically redacts all data arguments through `traceRedactor.redactValue()` before console output — API keys, Bearer tokens, JSESSIONID, sysparmCK, g_ck, MCP auth headers all get typed placeholders
- 4 tests verify redaction with console spies: API keys in objects, Bearer tokens in strings, undefined passthrough, primitive passthrough
- pruning.ts implements D-25 through D-29, D-36: tiered retention limits (5000/30d transactions, 2000/14d normal traces, 500/7d diagnostic, 1000/30d errors)
- Failure-prioritized pruning: failed/error records preserved; oldest successful records pruned first
- `pruneNow()` per-store count-based + time-based pruning, with per-store error isolation
- `scheduleDebouncedPrune()` 30-second debounce timer, queues at most one additional run if pruning in progress
- `startPruning()` immediate execution + 5-minute interval (D-29)
- `schedulePrune` hook wired from AITransactionLog to `scheduleDebouncedPrune` via namespace-import property assignment
- All 5 pruning tests pass: count-based, failure-priority, time-based, debounce window, timer-reset

## TDD Gate Compliance

- **Task 1 (debugLog):** RED commit `ab9c2ff` → GREEN commit `c88fdc1` ✓
- **Task 2 (pruning):** RED commit `b83885b` → GREEN commit `8f1aa2a` → test refinements `6147f17` ✓
- **REFACTOR:** Not needed — implementations clean and minimal for both tasks

## Task Commits

1. **Task 1 RED: debugLog failing test** - `ab9c2ff` (test)
2. **Task 1 GREEN: debugLog auto-redaction** - `c88fdc1` (feat)
3. **Task 2 RED: pruning failing tests** - `b83885b` (test)
4. **Task 2 GREEN: pruning implementation** - `8f1aa2a` (feat)
5. **Task 2 test refinements** - `6147f17` (test)

## Files Created/Modified

- `src/core/utils/debugLog.ts` - Added import of traceRedactor + redactValue() wrapping before console calls (defensive safety net per D-10)
- `tests/core/utils/debugLog.test.ts` (43 lines, 4 tests) - Console spy verifies redacted placeholders, undefined safety, primitive passthrough
- `src/core/telemetry/pruning.ts` (197 lines) - pruneNow, scheduleDebouncedPrune, startPruning, stopPruning, retention constants, module-level debounce state, AITransactionLog.schedulePrune wiring
- `tests/core/telemetry/pruning.test.ts` (290 lines, 5 tests) - Mock IndexedDBManager, count/time-based pruning, failure-priority, debounce window, timer-reset verification

## Decisions Made

- pruning.ts works directly with IndexedDB via `getDB()` for maximum flexibility across all trace stores, rather than going through AITransactionLogDB (which only has `queryTransactions` for one store). This allows a single `pruneNow()` to iterate all 7 trace stores uniformly.
- `pruneNow` sorts records with failures first (timestamp ASC), then successes (timestamp DESC), keeping failures + newest successes within maxCount. This satisfies D-27 failure-prioritized pruning with a single pass.
- `schedulePrune` hook wired via namespace-import property assignment (`import * as AITransactionLogModule`) since ESM imported `let` bindings are read-only but the module namespace object allows mutation.
- Debounce tests use side-effect tracking (transaction `done` promise and timer-reset verification) instead of spying on `pruneNow`, because module-internal function references in closures bypass the spy.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Test 1 (count-based) initially deleted the newest records instead of oldest — fixed by correcting sort order: successes now sorted DESC (newest first) while failures sort ASC (oldest first in keep-group).
- Tests 4 and 5 (debounce/queue) required redesign: `vi.spyOn(pruneNow)` doesn't intercept calls from `scheduleDebouncedPrune` because the closure captures the local function reference, bypassing the module export. Fixed by tracking side effects (transaction `done` promise counting) instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- debugLog auto-redaction provides D-10 compliance for all future phases
- pruning.ts ready for integration in 06-06 (AITransactionLog lifecycle wiring)
- `schedulePrune` hook connected — `AITransactionLog.close()` will trigger debounced pruning via `schedulePrune?.()`
- Next plan: 06-06 (AITransactionLog integration with AgentOrchestrator)

## Self-Check: PASSED

- [x] `src/core/utils/debugLog.ts` exists (29 lines, imports traceRedactor + redactValue wrapping)
- [x] `tests/core/utils/debugLog.test.ts` exists (43 lines, 4 passing tests)
- [x] `src/core/telemetry/pruning.ts` exists (197 lines, exports pruneNow/scheduleDebouncedPrune/startPruning/stopPruning)
- [x] `tests/core/telemetry/pruning.test.ts` exists (290 lines, 5 passing tests)
- [x] All 9 new tests pass (4 debugLog + 5 pruning)
- [x] All 572 total tests pass across 73 test files (0 regressions)
- [x] All 5 commits verified in git log
- [x] Exports match must_haves: debugLog (modified), pruneNow, scheduleDebouncedPrune, startPruning, RETENTION constants
- [x] AITransactionLog.schedulePrune hook wired to scheduleDebouncedPrune
- [x] Threat mitigations verified: T-06-05 (information disclosure via debugLog), T-06-04 (DoS via pruning)

---

*Phase: 06-transaction-logging-and-diagnostics*
*Completed: 2026-07-13*
