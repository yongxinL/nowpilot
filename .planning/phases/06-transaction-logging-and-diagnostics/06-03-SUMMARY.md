---
phase: 06-transaction-logging-and-diagnostics
plan: 03
subsystem: storage-telemetry
tags: [indexeddb, db-version-3, trace-stores, aitransaction-logdb, writejournal, typescript]
requires:
  - phase: 06-01
    provides: Full product spec telemetry types (AITransaction, PromptTrace, ToolTrace, ProviderTrace, CacheTrace, MemoryTrace, WriteJournalTrace, TraceTree)
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: IndexedDBManager with DB_VERSION 2, WriteJournalOperation types
provides:
  - DB_VERSION 3 upgrade with 3 new trace stores and by-operationId indexes on all 7 stores
  - Full AITransactionLogDB class with 12 methods (7 log*, getTransaction, getTraceTree, queryTransactions, getTotalCount, deleteTraces)
  - Extended WriteJournalOperation with transaction-log-batch for AITransactionLog integration
affects:
  - 06-04 (AITransactionLog orchestration layer consumes AITransactionLogDB and WriteJournalOperation)
  - 06-05 (pruning.ts uses getTotalCount/deleteTraces)
  - 06-08 (DiagnosticsPanel uses getTraceTree/queryTransactions)
tech-stack:
  added: []
  patterns:
    - Upgrade callback uses _transaction.objectStore() for adding indexes to existing stores (not db.transaction())
    - DBSchema value types mirror telemetry types inline with type assertions at use sites
    - Class+singleton with all methods wrapped in try-catch + debugLog error handling
key-files:
  created: []
  modified:
    - src/core/storage/IndexedDBManager.ts
    - src/core/storage/WriteJournalEntry.ts
    - src/core/storage/stores/AITransactionLogDB.ts
    - tests/core/storage/IndexedDBManager.test.ts
    - tests/core/storage/domainStores.test.ts
key-decisions:
  - "Used _transaction.objectStore() inside upgrade callback for adding indexes during migration (idb v8 provides the upgrade transaction as the 4th parameter)"
  - "DBSchema inline value types use string for enum fields to avoid coupling DBSchema to telemetry types; runtime type assertions bridge the gap"
  - "queryTransactions uses in-memory filter after getAll() to support complex multi-dimensional filtering across type/status/provider/severity/date/search"
  - "transaction_log_transactions uses startedAt (product spec field) for by-timestamp index — existing v2 records with startTime are exempted from the index"
requirements-completed:
  - TELE-01
  - TELE-02
  - TELE-03
  - TELE-04
duration: 12 min
completed: 2026-07-13
status: complete
---

# Phase 6 Plan 3: IndexedDB Schema Evolution + AITransactionLogDB Replacement

**IndexedDB DB_VERSION 3 migration with 3 new trace stores and by-operationId indexes on all 7 stores, extended WriteJournalOperation for transaction-log-batch, and full AITransactionLogDB with 12 methods including getTraceTree() trace assembly from all stores**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-13T06:20:00Z
- **Completed:** 2026-07-13T06:32:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- **DB_VERSION 3 upgrade** — 3 new trace stores (cache_traces, memory_traces, write_journal_traces) with by-operationId indexes; by-operationId, by-status, by-severity, by-timestamp indexes on all 4 existing transaction stores; full product spec DBSchema types for all 7 transaction stores
- **AITransactionLogDB full replacement** — 93-line stub replaced with 12-method class: 7 log* methods (transaction, prompt, tool, provider, cache, memory, writeJournal), getTransaction, getTraceTree (Promise.all parallel assembly from all 7 stores), queryTransactions (type/status/provider/severity/date-range/free-text filters), getTotalCount, deleteTraces (batch delete for pruning)
- **WriteJournalOperation extended** — `transaction-log-batch` added to both type union and zod schema for AITransactionLog batch-write lifecycle
- **All 541 existing tests pass** with 69 test files passing and 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Evolve IndexedDB schema to DB_VERSION 3** - `61c96e4` (feat)
2. **Task 2: Extend WriteJournalOperation and replace AITransactionLogDB** - `3910bc7` (feat)

## Files Created/Modified

- `src/core/storage/IndexedDBManager.ts` — DB_VERSION=3, oldVersion<3 upgrade block with 3 new stores + 7 indexes, extended DBSchema with 7 full product spec store types
- `src/core/storage/WriteJournalEntry.ts` — Added `transaction-log-batch` to WriteJournalOperation union type and zod schema
- `src/core/storage/stores/AITransactionLogDB.ts` — Complete replacement: 12 methods, type-only imports from telemetry/types, try-catch+debugLog error handling, singleton export
- `tests/core/storage/IndexedDBManager.test.ts` — Updated DB_VERSION assertion to 3, added v3 upgrade mock with transaction.objectStore assertions, verified 16 store creations
- `tests/core/storage/domainStores.test.ts` — Updated AITransaction mock object to match new product spec type shape

## Decisions Made

- **Upgrade transaction for index creation:** Used `_transaction.objectStore(storeName).createIndex()` inside the upgrade callback (idb v8 gives the upgrade transaction as the 4th parameter) instead of `db.transaction()` which would create a separate transaction
- **Inline DBSchema types:** DBSchema value types use `string` for enum fields to avoid coupling `IndexedDBManager.ts` to `telemetry/types.ts`; type assertions (`as unknown as AITransaction`) at use sites bridge the gap
- **`startedAt` for timestamp index:** Used the product spec field name `startedAt` for the by-timestamp index (not `startTime` from the old stub schema). Existing v2 records with `startTime` are schemaless and excluded from the index
- **In-memory queryTransactions filter:** Using `getAll()` followed by in-memory filtering (instead of a cursor on by-timestamp) enables arbitrary multi-dimensional filter combinations without complex IndexedDB key range construction

## Deviations from Plan

None - plan executed exactly as written. All tasks completed with full verification passing.

## Issues Encountered

- IndexedDBManager.test.ts required updates: DB_VERSION assertion, openDB version param, and upgrade callback mock needed `objectStore` method for v3 index creation. All fixed with 5 tests passing.
- domainStores.test.ts stubbed transaction object didn't match new `AITransaction` type shape. Fixed by adding required fields (sessionId, conversationId, workspaceId, activeSurface, userTurnId, providerId, verbosity, privacyMode).
- No runtime issues encountered.

## User Setup Required

None - no external service configuration required. JSZip dependency deferred to export plan (06-06 or equivalent).

## Next Phase Readiness

- AITransactionLogDB ready for 06-04 (AITransactionLog orchestration layer) with full 12-method API
- WriteJournalOperation extended with `transaction-log-batch` for AITransactionLog batch-write lifecycle
- All 7 trace stores have by-operationId indexes enabling fast getTraceTree assembly
- queryTransactions supports all filter dimensions needed by DiagnosticsPanel (06-08)
- Next plan: 06-04

---

*Phase: 06-transaction-logging-and-diagnostics*
*Completed: 2026-07-13*

## Self-Check: PASSED

- [x] `src/core/storage/IndexedDBManager.ts` exists — DB_VERSION=3, extended DBSchema, v3 upgrade block with 3 new stores and 7 indexes
- [x] `src/core/storage/WriteJournalEntry.ts` exists — includes `transaction-log-batch` in type union and zod schema
- [x] `src/core/storage/stores/AITransactionLogDB.ts` exists — full 12-method implementation with type-only imports
- [x] `.planning/phases/06-transaction-logging-and-diagnostics/06-03-SUMMARY.md` exists
- [x] All 3 commits verified in git log: 61c96e4, 3910bc7, 190bc36
- [x] All 541 tests pass (69 test files, 0 failures)
- [x] TypeScript compiles with no new errors in modified files
