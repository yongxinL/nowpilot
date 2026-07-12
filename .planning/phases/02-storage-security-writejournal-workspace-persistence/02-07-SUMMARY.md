---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 07
subsystem: storage
tags:
  - indexeddb
  - domain-stores
  - crud
  - singleton

# Dependency graph
requires:
  - phase: 02-02
    provides: IndexedDBManager with DBSchema, getDB(), 13 object stores
  - phase: 02-01 (debugLog)
    provides: debugLog utility for error reporting
provides:
  - ChatHistoryDB domain store (sessions + messages)
  - NotesDB domain store (notes + concepts)
  - MemoryDB domain store (messages + userFacts + summaries)
  - ErrorStore (FIFO-limited error log, max 100 entries)
  - AITransactionLogDB (transactions + prompt/tool/provider traces)
  - Shared test suite verifying correct object store routing for all 5 stores
affects:
  - Phase 5 (memory engine)
  - Phase 6 (telemetry/diagnostics)
  - Phase 7 (chat UI, agent, notes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - class + singleton export per domain store
    - getDB() from IndexedDBManager for all IndexedDB access
    - debugLog('error', ...) in every catch block
    - ErrorStore FIFO enforcement with sort + delete oldest

key-files:
  created:
    - src/core/storage/stores/ChatHistoryDB.ts
    - src/core/storage/stores/NotesDB.ts
    - src/core/storage/stores/MemoryDB.ts
    - src/core/storage/stores/ErrorStore.ts
    - src/core/storage/stores/AITransactionLogDB.ts
    - tests/core/storage/domainStores.test.ts
  modified: []

key-decisions:
  - "MemoryDB.getMessages uses IDBKeyRange.bound for composite key query on [conversationId, seq]"
  - "ErrorStore FIFO enforcement: getAll → sort by timestamp ascending → delete oldest entries when count exceeds 100"
  - "Each store exports both class (for extensibility/testing) and singleton (for app-wide use)"

patterns-established:
  - "Domain store pattern: import getDB, import debugLog, class with typed CRUD methods, singleton export, try/catch on all operations"

requirements-completed:
  - STOR-05
  - STOR-07

coverage:
  - id: D1
    description: ChatHistoryDB with session and message CRUD operations
    requirement: STOR-05
    verification:
      - kind: unit
        ref: tests/core/storage/domainStores.test.ts#ChatHistoryDB.createSession calls db.put with correct store
        status: pass
    human_judgment: false
  - id: D2
    description: NotesDB with note and concept CRUD operations
    requirement: STOR-05
    verification:
      - kind: unit
        ref: tests/core/storage/domainStores.test.ts#NotesDB.createNote calls db.put with correct store
        status: pass
    human_judgment: false
  - id: D3
    description: MemoryDB with message, userFact, and summary CRUD operations
    requirement: STOR-05
    verification:
      - kind: unit
        ref: tests/core/storage/domainStores.test.ts#MemoryDB.putUserFact calls db.put with correct store
        status: pass
    human_judgment: false
  - id: D4
    description: ErrorStore with FIFO-enforced error logging (max 100 entries)
    requirement: STOR-05
    verification:
      - kind: unit
        ref: tests/core/storage/domainStores.test.ts#ErrorStore.logError calls db.put and enforces FIFO
        status: pass
    human_judgment: false
  - id: D5
    description: AITransactionLogDB with transaction, prompt trace, tool trace, and provider trace logging
    requirement: STOR-05
    verification:
      - kind: unit
        ref: tests/core/storage/domainStores.test.ts#AITransactionLogDB.logTransaction calls db.put with correct store
        status: pass
    human_judgment: false
  - id: D6
    description: No message bodies stored in chrome.storage.local — all data goes through IndexedDB domain stores
    requirement: STOR-07
    verification:
      - kind: unit
        ref: tests/core/storage/domainStores.test.ts (all 5 tests verify correct IndexedDB routing)
        status: pass
    human_judgment: false

# Metrics
duration: 2 min
completed: 2026-07-12
status: complete
---

# Phase 02 Plan 07: Domain Store Classes Summary

**All five domain storage classes (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, AITransactionLogDB) implemented with typed CRUD operations, singleton exports, and shared test coverage**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-12T09:18:27Z
- **Completed:** 2026-07-12T09:20:56Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- **ChatHistoryDB** — session create/read/list + message add/query-by-session using `by-session` index
- **NotesDB** — note CRUD + concept create/get via `notes_concepts` store
- **MemoryDB** — message add/query with `IDBKeyRange.bound` composite key, user fact CRUD, summary CRUD
- **ErrorStore** — error logging with FIFO enforcement at 100 entries (getAll → sort by timestamp → delete oldest)
- **AITransactionLogDB** — transaction log + prompt/tool/provider trace logging
- **Test suite** — 5 test cases (one per store) verifying correct object store routing via mocked `getDB()`

## Task Commits

Each task was committed atomically:

1. **Task 1: ChatHistoryDB + NotesDB** - `b973200` (feat)
2. **Task 2: MemoryDB + ErrorStore** - `87b2de9` (feat)
3. **Task 3: AITransactionLogDB + tests** - `e1ec7c5` (feat)

## Files Created/Modified

- `src/core/storage/stores/ChatHistoryDB.ts` — ChatHistoryDB class + singleton (5 CRUD methods)
- `src/core/storage/stores/NotesDB.ts` — NotesDB class + singleton (7 CRUD methods)
- `src/core/storage/stores/MemoryDB.ts` — MemoryDB class + singleton (6 CRUD methods)
- `src/core/storage/stores/ErrorStore.ts` — ErrorStore class + singleton (3 methods, FIFO enforcement)
- `src/core/storage/stores/AITransactionLogDB.ts` — AITransactionLogDB class + singleton (5 methods)
- `tests/core/storage/domainStores.test.ts` — 5 test cases verifying correct IndexedDB object store routing

## Decisions Made

- **IDBKeyRange.bound for composite key queries** — `MemoryDB.getMessages` uses `IDBKeyRange.bound([conversationId, 0], [conversationId, Infinity])` to query messages by conversation ID with composite `[conversationId, seq]` key
- **ErrorStore FIFO via sort-then-delete** — When error count exceeds 100, fetches all errors via `getAll`, sorts by timestamp ascending, deletes oldest entries. Simpler than maintaining a separate pointer while correct for the error store use case
- **All stores follow class + singleton pattern** — Each file exports both a class (for extensibility and DI in tests) and a singleton instance (for straightforward app-wide consumption)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **IDBKeyRange import fix** — `IDBKeyRange` is a global built-in, not an export from the `idb` package. Initial `import type { IDBKeyRange } from 'idb'` caused a TypeScript error. Fixed by removing the import and using the global directly. Committed in Task 2 commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 5 domain stores ready for consumption by Phase 5 (memory engine), Phase 6 (telemetry), and Phase 7 (chat UI, notes UI)
- Shared test pattern established for domain store integration testing
- Ready for Phase 02 Plan 08 (final plan — WorkspaceStore persistence)

## Self-Check

- [x] All 6 created files exist on disk
- [x] All 3 commits present in git history (b973200, 87b2de9, e1ec7c5)
- [x] `npx tsc --noEmit` exits 0
- [x] `npx vitest run tests/core/storage/domainStores.test.ts` — 5/5 tests pass
- [x] SUMMARY.md written and committed

**Status: PASSED**

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-07-12*
