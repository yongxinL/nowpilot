---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 02
subsystem: storage
tags: [indexeddb, idb, schema, dbschema, singleton]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: Test infrastructure for Phase 2 storage (02-01)
provides:
  - IndexedDBManager (NowPilotDB DBSchema with 13 object stores)
  - getDB() singleton connection caching function
  - DB_VERSION constant
  - Comprehensive test suite (5 tests)
affects:
  - 02-03: WriteJournal (depends on write_journal_entries store)
  - 02-04: IndexedDBMigrator (depends on version management)
  - 02-05: Domain data stores (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, AITransactionLogDB)
  - 02-06: EncryptedStorage and Workspace Persistence

# Tech tracking
tech-stack:
  added:
    - idb v8 (openDB, DBSchema, IDBPDatabase types)
  patterns:
    - Module-level singleton (let dbInstance + getDB()) instead of class+singleton
    - DBSchema interface with typed store definitions
    - Versioned upgrade callback with oldVersion checks
    - Connection lifecycle callbacks (blocked, blocking, terminated)

key-files:
  created:
    - src/core/storage/IndexedDBManager.ts
    - tests/core/storage/IndexedDBManager.test.ts
  modified:
    - tsconfig.json (added @ path alias for test module resolution)

key-decisions:
  - Used module-level let dbInstance instead of class+singleton (per RESEARCH.md Pattern 1) for correct IndexedDB connection lifecycle management
  - All 13 object stores created in version 1 upgrade (oldVersion < 1 block) with appropriate keyPaths including compound key for memory_messages
  - Used `@` path alias in tsconfig.json to support vitest's `@` alias from vitest.config.ts for test files

patterns-established:
  - Module-level singleton with exported asynchronous getter function
  - DBSchema interface pattern extending idb's DBSchema with typed store entries
  - Upgrade callback with oldVersion guard for versioned migrations
  - Blocked/blocking/terminated callbacks for connection lifecycle edge cases

requirements-completed:
  - STOR-01
  - STOR-05

coverage:
  - id: D1
    description: "IndexedDBManager with NowPilotDB DBSchema, DB_VERSION, and getDB()"
    requirement: STOR-01
    verification:
      - kind: unit
        ref: tests/core/storage/IndexedDBManager.test.ts#DB_VERSION is 1
        status: pass
      - kind: unit
        ref: tests/core/storage/IndexedDBManager.test.ts#getDB calls openDB with correct params
        status: pass
    human_judgment: false
  - id: D2
    description: "Connection caching (singleton pattern) — second getDB call returns cached instance"
    requirement: STOR-01
    verification:
      - kind: unit
        ref: tests/core/storage/IndexedDBManager.test.ts#getDB caches the connection
        status: pass
      - kind: unit
        ref: tests/core/storage/IndexedDBManager.test.ts#getDB returns same instance on second call
        status: pass
    human_judgment: false
  - id: D3
    description: "Upgrade callback creates all 13 object stores with correct keyPaths and indexes when oldVersion < 1"
    requirement: STOR-05
    verification:
      - kind: unit
        ref: tests/core/storage/IndexedDBManager.test.ts#upgrade callback creates all 13 object stores
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-07-12
status: complete
---

# Phase 2: Storage Plan 2 Summary

**IndexedDBManager with typed DBSchema (13 object stores), DB_VERSION=1, and getDB() singleton connection manager using idb v8**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-12T18:43:00Z
- **Completed:** 2026-07-12T18:50:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `IndexedDBManager.ts` with `NowPilotDB` DBSchema interface defining all 13 object stores with correct key types, value types, and indexes
- Implemented `getDB()` async singleton with module-level `dbInstance` caching (connection lifecycle: `blocked`, `blocking`, `terminated` callbacks)
- Implemented upgrade callback with `oldVersion < 1` guard that creates stores with correct keyPaths (`id` for most, `slug` for notes_concepts, `['conversationId', 'seq']` for memory_messages, `conversationId` for memory_summaries)
- Added `createIndex` calls for `chat_history_messages` (`by-session` on `sessionId`) and `write_journal_entries` (`by-status` on `status`)
- Created comprehensive test suite (5 tests) covering DB_VERSION, openDB params, connection caching, singleton identity, and store creation
- Added `@` path alias to `tsconfig.json` for vitest/vite path resolution compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create IndexedDBManager.ts with DBSchema + getDB()** - `dfab140` (feat)
2. **Task 2: Create IndexedDBManager tests** - `dde6873` (test)

**Plan metadata:** `pending` (docs commit after SUMMARY.md)

## Files Created/Modified

- `src/core/storage/IndexedDBManager.ts` - Created: NowPilotDB DBSchema (13 stores), DB_VERSION=1, getDB() async singleton
- `tests/core/storage/IndexedDBManager.test.ts` - Created: 5 test cases (DB_VERSION, openDB params, caching, singleton, upgrade + 13 stores)
- `tsconfig.json` - Modified: Added `@` path alias for test module resolution

## Decisions Made

- Used module-level `let dbInstance` + `getDB()` pattern instead of class+singleton — per RESEARCH.md Pattern 1, IndexedDB connection management requires singleton at module scope to handle blocking/terminated callbacks correctly
- Added `@` path alias to `tsconfig.json` to support vitest's `resolve.alias` configuration — existing tests didn't need it but `vi.mock` hoisting with relative paths failed in vitest v4
- Used `vi.hoisted()` for test mock variables — vitest requires this pattern when `vi.mock` factory needs to reference module-level variables (hoisting rules)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest v4 `vi.mock` hoisting with relative path imports caused module resolution errors when the module under test was imported alongside a mocked dependency. Resolved by adding `@` path alias to tsconfig.json and using the alias for imports. This also required updating `tsconfig.json` with `baseUrl` and `paths` settings.
- Vitest's `vi.mock` factory cannot reference variables defined at module top level — must use `vi.hoisted()` to declare shared mock variables. The `idbMock` object pattern with mutable `captured.config` container enables sharing between mock factory and test assertions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- IndexedDBManager is the foundational dependency for all Phase 2 storage modules (WriteJournal, Migrator, domain stores)
- All 13 object stores are defined — subsequent plans can create domain-specific managers that use `getDB()` to access their store
- Ready for Plan 02-03: WriteJournal multi-store consistency
- Ready for Plan 02-04: IndexedDBMigrator versioned migrations
- Ready for Plan 02-05: Domain data stores

## Self-Check: PASSED

- [x] `src/core/storage/IndexedDBManager.ts` exists — exports `NowPilotDB`, `DB_VERSION`, `getDB()`
- [x] `tests/core/storage/IndexedDBManager.test.ts` exists — 5 test cases all passing
- [x] `npx tsc --noEmit` passes (clean compilation)
- [x] `npx vitest run tests/core/storage/IndexedDBManager.test.ts` — 5/5 tests pass
- [x] `dfab140` — feat commit with source file
- [x] `dde6873` — test commit with test file
- [x] `26af99b` — docs commit with SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-07-12*
