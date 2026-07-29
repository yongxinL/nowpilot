---
phase: 02-storage-security-foundation
plan: 02
subsystem: storage
tags: [idb, indexeddb, fake-indexeddb, write-journal, migration, consistency]

requires:
  - phase: 02-storage-security-foundation
    plan: 01
    provides: Zustand store patterns, chromeStorageAdapter, ApiKeyStore/CryptoService

provides:
  - WriteJournal with pending→applying→completed lifecycle for multi-store write consistency
  - MigrationRunner with v1→v4 idempotent IndexedDB schema upgrades
  - Test infrastructure: fake-indexeddb/auto registration and chrome.storage.session mock
  - unlimitedStorage permission in wxt.config.ts for IndexedDB quota management

affects:
  - 02-03 (WorkspaceStore migration): Will use WriteJournal for workspace writes
  - 02-04 (CryptoService integration): Will consume MigrationRunner for IndexedDB setup
  - Phase 5 (Notes): Will build NotesDB on top of MigrationRunner
  - Phase 6 (Diagnostics): Will build DiagnosticsDB on top of MigrationRunner

tech-stack:
  added:
    - idb ^8.0.3 — IndexedDB wrapper (simple, promise-based, ESM-native)
    - fake-indexeddb ^6.2.5 — In-memory IndexedDB implementation for jsdom tests
  patterns:
    - WriteJournal: module-scoped singleton with exported async functions (following BroadcastBus pattern)
    - MigrationRunner: class-based orchestrator wrapping idb's openDB with versioned upgrade callbacks
    - Step executor registry: callers register executors by name; WriteJournal resolves them during replay

key-files:
  created:
    - src/core/storage/WriteJournal.ts — Multi-store write consistency journal (createEntry, commitEntry, replayJournal, repairEntry)
    - src/core/storage/MigrationRunner.ts — IndexedDB versioned migration orchestrator (v1→v4)
    - tests/core/storage/WriteJournal.test.ts — 8 tests covering full journal lifecycle
    - tests/core/storage/MigrationRunner.test.ts — 5 tests covering migration, idempotency, data migration
  modified:
    - tests/setup.ts — Added fake-indexeddb/auto import (top), chrome.storage.session mock (Map-backed)
    - wxt.config.ts — Added unlimitedStorage to manifest permissions
    - package.json / package-lock.json — Added idb and fake-indexeddb dependencies

key-decisions:
  - "Step executor registry pattern: WriteJournal stores only step name/status/error in IndexedDB; executors are resolved from a Map during replay, keeping serialized entries small and decoupling step logic from the journal"
  - "Module-level resetJournalDb / resetMigrationDb helpers exported for test isolation: each test deletes and recreates the IndexedDB database to prevent state leakage"
  - "Idempotency via guard checks: MigrationRunner checks objectStoreNames.contains() and indexNames.contains() before creating, allowing repeated migrate() calls on the same version to be no-ops"

coverage:
  - id: WJ-01
    description: WriteJournal.createEntry persists entries with pending status in WriteJournalDB
    verification:
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#WriteJournal createEntry should create an entry with pending status and persist it in WriteJournalDB
        status: pass
    human_judgment: false
  - id: WJ-02
    description: WriteJournal.commitEntry transitions through pending→applying→completed lifecycle
    verification:
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#WriteJournal commitEntry should transition through pending→applying→completed and execute each step
        status: pass
    human_judgment: false
  - id: WJ-03
    description: WriteJournal.replayJournal recovers crashed non-terminal entries on startup
    verification:
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#WriteJournal replayJournal should find a pending entry from crash and replay to completed
        status: pass
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#WriteJournal replayJournal should find an applying entry, increment attempts, replay, and mark completed
        status: pass
    human_judgment: false
  - id: WJ-04
    description: WriteJournal.replayJournal marks entries as failed on step error, skips terminal entries
    verification:
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#WriteJournal replayJournal should mark entry as failed if a step throws during replay
        status: pass
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#WriteJournal replayJournal should skip entries with terminal statuses
        status: pass
    human_judgment: false
  - id: WJ-05
    description: WriteJournal.repairEntry validates and fixes orphaned entries (lazy repair)
    verification:
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#WriteJournal repairEntry should validate step completion and fix orphaned entries
        status: pass
    human_judgment: false
  - id: MR-01
    description: MigrationRunner creates full v1→v4 schema with all stores and indexes
    verification:
      - kind: unit
        ref: tests/core/storage/MigrationRunner.test.ts#MigrationRunner fresh migration v1→v4 should create all stores and indexes
        status: pass
    human_judgment: false
  - id: MR-02
    description: MigrationRunner incremental migration from v2 only executes needed steps
    verification:
      - kind: unit
        ref: tests/core/storage/MigrationRunner.test.ts#MigrationRunner incremental migration from v2 should only execute v3 and v4 steps
        status: pass
    human_judgment: false
  - id: MR-03
    description: MigrationRunner is idempotent (double-migrate is a no-op)
    verification:
      - kind: unit
        ref: tests/core/storage/MigrationRunner.test.ts#MigrationRunner idempotency should be a no-op when migrating the same DB twice
        status: pass
    human_judgment: false
  - id: MR-04
    description: MigrationRunner handles blocked/blocking callbacks for concurrent connections
    verification:
      - kind: unit
        ref: tests/core/storage/MigrationRunner.test.ts#MigrationRunner blocked callback should warn when migration is blocked
        status: pass
    human_judgment: false
  - id: MR-05
    description: MigrationRunner v4 data migration transforms and preserves existing records
    verification:
      - kind: unit
        ref: tests/core/storage/MigrationRunner.test.ts#MigrationRunner v4 data migration should read from old store and write transformed data
        status: pass
    human_judgment: false
  - id: INFRA-01
    description: Test infrastructure set up with fake-indexeddb and chrome.storage.session mock
    verification:
      - kind: unit
        ref: npm ls idb fake-indexeddb --depth=0
        status: pass
      - kind: unit
        ref: npx vitest run (all 102 tests pass)
        status: pass
    human_judgment: false

requirements-completed:
  - STORAGE-01

duration: 8min
completed: 2026-07-29
status: complete
---

# Phase 02: Storage & Security Foundation — Plan 02 Summary

**WriteJournal for multi-store write consistency, MigrationRunner for idempotent IndexedDB schema upgrades, and test infrastructure with fake-indexeddb + chrome.storage.session mock**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-29T12:07:30Z
- **Completed:** 2026-07-29T12:15:30Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Installed idb ^8.0.3 and fake-indexeddb ^6.2.5; added `unlimitedStorage` permission to wxt.config.ts
- Updated tests/setup.ts with `import 'fake-indexeddb/auto'` at top and full Map-backed chrome.storage.session mock
- Implemented WriteJournal module (src/core/storage/WriteJournal.ts): createEntry, commitEntry, replayJournal, repairEntry, getEntry, getEntriesByStatus — all with proper pending→applying→completed lifecycle and step executor registry pattern
- Implemented MigrationRunner class (src/core/storage/MigrationRunner.ts): migrate() with v1→v4 versioned upgrade callbacks, idempotency guards, and blocked/blocking handler infrastructure
- Wrote 13 total new tests (8 WriteJournal, 5 MigrationRunner); full test suite passes 102 tests across 15 files

## Task Commits

Each task was committed atomically:

1. **Task 1: Install idb + fake-indexeddb and update test infrastructure** — `e133667` (chore)
2. **Task 2 (RED): WriteJournal test file** — `d76324e` (test)
3. **Task 2 (GREEN): WriteJournal implementation** — `ca67b62` (feat)
4. **Task 3 (RED): MigrationRunner test file** — `f776cd6` (test)
5. **Task 3 (GREEN): MigrationRunner implementation** — `8e2f436` (feat)

## Files Created/Modified

- `src/core/storage/WriteJournal.ts` — WriteJournal module with createEntry, commitEntry, replayJournal, repairEntry, query helpers
- `src/core/storage/MigrationRunner.ts` — MigrationRunner class with v1→v4 versioned upgrade orchestration
- `tests/core/storage/WriteJournal.test.ts` — 8 tests covering full journal lifecycle and replay recovery
- `tests/core/storage/MigrationRunner.test.ts` — 5 tests covering migration, idempotency, and data migration
- `tests/setup.ts` — Added fake-indexeddb/auto import at top and chrome.storage.session mock (Map-backed, independent from local)
- `wxt.config.ts` — Added unlimitedStorage to manifest permissions array
- `package.json` — Added idb ^8.0.3, fake-indexeddb ^6.2.5
- `package-lock.json` — Updated with new dependency resolution

## Decisions Made

- **Step executor registry pattern**: WriteJournal stores only step name/status/error in IndexedDB. Executors are resolved from a Map during replay/crash recovery. This keeps serialized entries small and allows different callers to provide different executor implementations without changing the journal.
- **Exported DB reset helpers**: Both WriteJournal and MigrationRunner export `resetJournalDb()` / `resetMigrationDb()` functions for test isolation. Each beforeEach hook deletes and recreates the IndexedDB database to prevent state leakage across tests.
- **Idempotency via guard checks**: MigrationRunner checks `objectStoreNames.contains()` and `indexNames.contains()` before creating stores/indexes. This allows calling migrate() multiple times with the same target version to be a safe no-op.
- **Module-scoped singleton for WriteJournal**: Following the BroadcastBus pattern (PATTERNS.md), WriteJournal uses module-scoped `dbPromise` caching and exported async functions rather than a class. This keeps the API consistent with existing patterns.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface

The MigrationRunner's `blocked`/`blocking` callbacks handle concurrent IndexedDB connections gracefully (T-02-10). The WriteJournal's attempts counter and terminal status transitions prevent infinite retry loops (T-02-07). No new threat surface beyond what the plan's threat model covers.

## Known Stubs

None — both WriteJournal and MigrationRunner are fully implemented with all specified functions and tests. The step executor registry pattern is complete (callers register executors; WriteJournal resolves them during commit/replay).

## Issues Encountered

- **fake-indexeddb `openDB` version constraint**: When opening a database that has been migrated to v4, you cannot open with `openDB(name, 1)` — fake-indexeddb enforces the real IndexedDB rule that you cannot open a database at a lower version than its current version. Fixed tests to use `openDB(name)` (no version) for post-migration inspection.
- **DB state leakage across tests**: WriteJournal's `getDb()` caches the database connection promise, so `indexedDB.deleteDatabase` alone was insufficient for cleanup. Fixed by exporting `resetJournalDb()` that closes the cached connection and deletes the database with proper async await.

## Next Phase Readiness

- WriteJournal ready for WorkspaceStore migration (02-03) — committed writes will go through the journal for crash-safe multi-store consistency
- MigrationRunner ready for IndexedDB migration setup (02-04) — all IndexedDB databases can use the runner for versioned schema upgrades
- Test infrastructure ready for all downstream phases — fake-indexeddb enables in-memory IndexedDB testing in jsdom without browser dependencies

---

*Phase: 02-storage-security-foundation*
*Completed: 2026-07-29*
