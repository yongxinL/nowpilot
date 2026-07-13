---
phase: 06-transaction-logging-and-diagnostics
plan: 01
subsystem: telemetry
tags: [jszip, types, telemetry, trace-collector, execution-context]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime
    provides: ExecutionContext and TraceCollector integration patterns
provides:
  - Shared type contract (19 type definitions) for all downstream telemetry plans
  - JSZip installed for ZIP export assembly
  - 4 test scaffold files with todo placeholders
affects:
  - 06-02 (TraceRedactor — imports types for redacted trace shapes)
  - 06-04 (AITransactionLog — imports TraceCollector, ExecutionContext types)
  - 06-05 (pruning — imports AITransaction, Severity types)
  - 06-07 (export — imports ExportOptions, ExportManifest, JSZip)

# Tech tracking
tech-stack:
  added: [JSZip 3.10.1]
  patterns: [Enum + type alias + interface co-location (contextTypes.ts analog)]

key-files:
  created:
    - src/core/telemetry/types.ts (368 lines — all 19 types)
    - tests/core/telemetry/TraceRedactor.test.ts (scaffold)
    - tests/core/telemetry/AITransactionLog.test.ts (scaffold)
    - tests/core/telemetry/pruning.test.ts (scaffold)
    - tests/core/telemetry/export.test.ts (scaffold)
  modified:
    - package.json (added jszip@3.10.1)
    - pnpm-lock.yaml (updated)

key-decisions:
  - "TraceEvent is a discriminated union with type (7 variants) and data field typed per variant"
  - "DefaultTraceCollector stores TraceEvent[] with JS private field #events"
  - "on* methods accept Omit<FullType, 'id' | 'operationId'> — collector generates id, caller fills operationId"
  - "ModelContextTier imported from contextTypes.ts, not redefined — avoids type drift"
  - "ExportOptions dateRange uses {from, to} number timestamps, not Date objects"

patterns-established:
  - "Pattern: types.ts follows contextTypes.ts structure — enums first, type aliases, interfaces, classes last"

requirements-completed:
  - TELE-01
  - TELE-02
  - TELE-03
  - TELE-04

coverage:
  - id: D1
    description: "JSZip installed at exact version 3.10.1 for export ZIP assembly"
    verification:
      - kind: unit
        ref: "node -e 'require(\"./package.json\").dependencies.jszip === \"3.10.1\"'"
        status: pass
    human_judgment: false
  - id: D2
    description: "types.ts exports all 19 core type definitions with correct TypeScript"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (project-level check — 0 errors from types.ts)"
        status: pass
    human_judgment: false
  - id: D3
    description: "TraceCollector interface has 7 on* methods + getAllEvents() + clear() per D-07"
    verification:
      - kind: unit
        ref: "src/core/telemetry/types.ts (TraceCollector interface)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ExecutionContext interface has 5 fields per D-02 (traceCollector, operationId, abortSignal, verbosity, privacyMode)"
    verification:
      - kind: unit
        ref: "src/core/telemetry/types.ts (ExecutionContext interface)"
        status: pass
    human_judgment: false
  - id: D5
    description: "4 telemetry test scaffold files with vitest imports and it.todo placeholders"
    verification:
      - kind: unit
        ref: "npx vitest run tests/core/telemetry/ --exit-code 0 (30 todo tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-07-13
status: complete
---

# Phase 06 Plan 01: Telemetry Type Definitions + JSZip + Test Scaffolds

**JSZip installed at 3.10.1, 19 shared telemetry type definitions created, 4 test scaffolds with vitest todo placeholders**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-13T06:17:48Z
- **Completed:** 2026-07-13T06:20:56Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- **JSZip 3.10.1 installed** at exact pinned version (no caret) for ZIP export assembly in downstream plan 06-07. Package legitimacy verified: npm registry, ~10 yrs, 45M weekly downloads, High source reputation (Stuk/jszip).
- **src/core/telemetry/types.ts** created with all 19 type definitions: Severity enum, TraceVerbosity enum, TransactionStatus/TransactionType union types, AITransaction, PromptTrace, ToolTrace, ProviderAttempt, ProviderTrace, CacheTrace, MemoryTrace, WriteJournalTrace interfaces, TraceEvent discriminated union, TraceCollector interface + DefaultTraceCollector class, ExecutionContext, TraceTree, ExportOptions, ExportManifest. ModelContextTier imported from contextTypes.ts (not redefined). Traces the contextTypes.ts structural pattern.
- **TraceCollector interface** with exactly 7 on\* methods (onPlannerCall, onProviderAttempt, onToolExecution, onRendererCall, onCacheEvent, onMemoryEvent, onWriteJournalEvent) plus getAllEvents() and clear() per D-07.
- **DefaultTraceCollector class** with JS private field #events, each on\* method pushing { type, data } TraceEvent to the array.
- **ExecutionContext interface** with all 5 fields per D-02: traceCollector, operationId, abortSignal, verbosity, privacyMode.
- **4 test scaffold files** created in tests/core/telemetry/ with vitest imports, describe blocks, and 30 it.todo placeholders covering the expected test surface for downstream plans.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install JSZip dependency** - `0a5d27e` (chore)
2. **Task 2: Create telemetry/types.ts with all core type definitions** - `56c4c8e` (feat)
3. **Task 3: Create test file scaffolds for telemetry tests** - `baf1770` (test)

## Files Created/Modified

- `src/core/telemetry/types.ts` — 368 lines, all 19 type definitions for the telemetry system
- `package.json` — added `"jszip": "3.10.1"` (exact version, no caret)
- `pnpm-lock.yaml` — updated with JSZip entry
- `tests/core/telemetry/TraceRedactor.test.ts` — 10 todo tests for redaction patterns
- `tests/core/telemetry/AITransactionLog.test.ts` — 7 todo tests for lifecycle methods
- `tests/core/telemetry/pruning.test.ts` — 7 todo tests for retention/pruning logic
- `tests/core/telemetry/export.test.ts` — 6 todo tests for export/manifest assembly

## Decisions Made

- **TraceEvent union structure:** Discriminated union with `type` (7 variants) and `data` field typed per variant — follows the plan specification exactly. This enables type-narrowed access to trace data in DiagnosticsPanel rendering.
- **DefaultTraceCollector implementation:** Each on\* method generates `id` via `crypto.randomUUID()` and stores a `TraceEvent` in the private `#events` array. `getAllEvents()` returns a shallow copy. The `operationId` is filled in by the caller at event emission time (or later by AITransactionLog.close()).
- **ModelContextTier reuse:** Imported from `../../context/contextTypes` rather than redefined, avoiding type drift across the codebase.
- **ExportOptions dateRange:** Uses `{ from: number; to: number }` (Unix timestamps in ms) for IndexedDB query compatibility, not Date objects.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Pre-existing test failures (unrelated):** `tests/core/storage/IndexedDBManager.test.ts` has 2 pre-existing failures where the test expects `DB_VERSION = 1` but the source declares `DB_VERSION = 2`. These failures existed before this plan's changes and are not caused by any work in this plan. They affect 526 of 556 total passing tests (excluding the 30 todo tests).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 19 telemetry type definitions are ready for consumption by downstream plans:
  - Plan 06-02 (TraceRedactor) imports Severity, TraceRedactor pattern types
  - Plan 06-03 (AITransactionLogDB + IndexedDB schema) imports AITransaction, PromptTrace, ToolTrace, ProviderTrace, CacheTrace, MemoryTrace, WriteJournalTrace
  - Plan 06-04 (AITransactionLog) imports TraceCollector, ExecutionContext, DefaultTraceCollector, TraceTree
  - Plan 06-05 (pruning) imports Severity, TransactionStatus, AITransaction
  - Plan 06-07 (export) imports ExportOptions, ExportManifest and uses JSZip
- 4 test scaffold files provide the test harness structure — downstream plans fill in real test cases.
- JSZip at 3.10.1 ready for ZIP export assembly.

## Self-Check: PASSED

- [x] `"jszip": "3.10.1"` in package.json (exact version, no caret) — verified
- [x] `src/core/telemetry/types.ts` exists with all 19 type definitions — verified (368 lines)
- [x] TraceCollector interface has 7 on\* methods + getAllEvents + clear per D-07 — verified
- [x] ExecutionContext interface has all 5 fields per D-02 — verified
- [x] ModelContextTier imported from contextTypes, not redefined — verified
- [x] 4 test scaffold files exist with vitest imports and it.todo placeholders — verified (30 todo tests)
- [x] `npx tsc --noEmit` — 0 errors from our file (pre-existing errors in other files unchanged)
- [x] All 3 commits verified in git log
