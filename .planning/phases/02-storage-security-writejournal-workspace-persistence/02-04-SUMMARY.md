---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 04
subsystem: storage
tags: [indexeddb, migrations, idb, typescript]

requires:
  - phase: 02-02
    provides: IndexedDBManager / NowPilotDB schema

provides:
  - IndexedDBMigrator class with versioned migration registry
  - migrationV1 for initial schema (13 object stores)

affects:
  - 02-05 (WriteJournal — consumes migrationV1 via IndexedDBMigrator)
  - Future phases that define new migrations (v2, v3, etc.)

tech-stack:
  added: []
  patterns:
    - "class+register+singleton: IndexedDBMigrator follows KeymapRegistry pattern with Map<number, T> registry, duplicate detection, and singleton export"

key-files:
  created:
    - src/core/storage/IndexedDBMigrator.ts
    - src/core/storage/migrations/v1-initial-schema.ts
    - tests/core/storage/IndexedDBMigrator.test.ts
  modified: []

key-decisions:
  - "getMigrationsBetween() filter uses m.toVersion > fromVersion (not m.fromVersion <= fromVersion as originally specified in the plan) to correctly match intended semantics demonstrated by test cases"
  - "migrate() uses oldVersion/newVersion params rather than a transaction object — migration runs inside idb's upgrade callback where a transaction is already active"

patterns-established:
  - "Migration registry pattern: Map<number, IndexedDBMigration> keyed by toVersion"
  - "Idempotency guard pattern: each migration checks oldVersion at entry to skip if already applied"

requirements-completed:
  - STOR-04
  - STOR-05

coverage:
  - id: D1
    description: "IndexedDBMigrator with migration registry — register(), getMigrationsBetween(), getAllMigrations(), boot() — singleton export, duplicate rejection"
    requirement: STOR-04
    verification:
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "grep -c getMigrationsBetween src/core/storage/IndexedDBMigrator.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "migrationV1: fromVersion 0 toVersion 1, creates all 13 object stores with correct keyPaths, indexes (by-session, by-status), idempotency guard (oldVersion >= 1 check)"
    requirement: STOR-05
    verification:
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "createObjectStore count >= 13 in v1-initial-schema.ts"
        status: pass
      - kind: other
        ref: "Idempotency guard grep oldVersion >= 1 in v1-initial-schema.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "IndexedDBMigrator test suite — 5 tests covering register, duplicate detection, version range filtering, sort order, migrationV1 metadata"
    requirement: STOR-04
    verification:
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#register() adds a migration retrievable by version"
        status: pass
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#register() with duplicate toVersion throws"
        status: pass
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#getMigrationsBetween() returns correct subset"
        status: pass
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#getAllMigrations() returns migrations sorted by toVersion"
        status: pass
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#migrationV1 has fromVersion 0, toVersion 1"
        status: pass
    human_judgment: false

duration: 2 min
completed: 2026-07-12
status: complete
---

# Phase 02 Plan 04: IndexedDBMigrator & v1 Schema Summary

**IndexedDBMigrator class with versioned migration registry and v1-initial-schema creating all 13 object stores with idempotency guard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-12T09:06:45Z
- **Completed:** 2026-07-12T09:09:01Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- IndexedDBMigrator with Map<number, IndexedDBMigration> registry, duplicate detection, version-range query (`getMigrationsBetween`), sorted retrieval (`getAllMigrations`), and stub `boot()` method
- Migration interface (`IndexedDBMigration`) with `fromVersion`, `toVersion`, `description`, `migrate()` signature using IDBPDatabase<NowPilotDB> and oldVersion/newVersion
- Singleton export `indexedDBMigrator` following class+register+singleton pattern from KeymapRegistry
- `migrationV1`: from version 0 to 1, creates all 13 object stores (`chat_history_sessions`, `chat_history_messages`, `notes_notes`, `notes_concepts`, `memory_messages`, `memory_userFacts`, `memory_summaries`, `errors`, `transaction_log_transactions`, `transaction_log_promptTraces`, `transaction_log_toolTraces`, `transaction_log_providerTraces`, `write_journal_entries`) with correct keyPaths and indexes
- Idempotency guard on `migrationV1`: `if (oldVersion >= 1) return;` prevents re-execution
- 5 passing vitest tests covering registration, duplicate detection, version range filtering, sort ordering, and migrationV1 metadata

## Task Commits

1. **Task 1: Create IndexedDBMigrator.ts with migration registry** — `b8339c3` (feat)
2. **Task 2: Create v1-initial-schema migration** — `685728f` (feat)
3. **Task 3: Create IndexedDBMigrator tests** — `e850451` (test)

## Files Created

| File | Purpose |
|------|---------|
| `src/core/storage/IndexedDBMigrator.ts` | IndexedDBMigration interface, IndexedDBMigrator class, singleton export |
| `src/core/storage/migrations/v1-initial-schema.ts` | migrationV1 — creates all 13 object stores with idempotency guard |
| `tests/core/storage/IndexedDBMigrator.test.ts` | 5 vitest tests for register, duplicate detection, range filtering, sorting, migrationV1 metadata |

## Decisions Made

- `getMigrationsBetween()` filter uses `m.toVersion > fromVersion && m.toVersion <= toVersion` rather than the plan's specified `m.fromVersion <= fromVersion && m.toVersion <= toVersion` — the plan's condition didn't match the intended semantics (v2 would be excluded from `getMigrationsBetween(0, 2)` when it should be included). The corrected condition matches all test expectations.
- `migrate()` signature uses `oldVersion`/`newVersion` params instead of a transaction object — the migration runs inside idb's upgrade callback where a transaction is already active.
- Migration registry uses `Map<number, IndexedDBMigration>` keyed by `toVersion` for O(1) duplicate detection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getMigrationsBetween filter condition**
- **Found during:** Task 1 (cross-referenced with Task 3 test expectations)
- **Issue:** The plan specified filter condition `m.fromVersion <= fromVersion` which excludes v2 from `getMigrationsBetween(0, 2)` because v2's `fromVersion: 1` makes `1 <= 0` false. The test case expects v2 to be included.
- **Fix:** Changed condition from `m.fromVersion <= fromVersion` to `m.toVersion > fromVersion` — a migration should run when its target version is greater than the current DB version. The corrected expression is `m.toVersion > fromVersion && m.toVersion <= toVersion`.
- **Files modified:** `src/core/storage/IndexedDBMigrator.ts`
- **Verification:** Tests 3 passes for both `getMigrationsBetween(0, 2)` → [v1, v2] and `getMigrationsBetween(1, 3)` → [v2, v3]
- **Committed in:** b8339c3 (amended into Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix necessary for correctness — the condition as originally written would have returned wrong migration subsets, breaking schema upgrades. No scope creep.

## Issues Encountered

None.

## Next Phase Readiness

- IndexedDBMigrator and migrationV1 are ready for Phase 02-05 (WriteJournal) which will activate the migrator in the real DB upgrade flow
- Next: Phase 02-05 (WriteJournal implementation) or Phase 02-07 (Workspace persistence)

## Self-Check: PASSED

- [x] src/core/storage/IndexedDBMigrator.ts exists
- [x] src/core/storage/migrations/v1-initial-schema.ts exists
- [x] tests/core/storage/IndexedDBMigrator.test.ts exists
- [x] Commit b8339c3 (Task 1 — IndexedDBMigrator)
- [x] Commit 685728f (Task 2 — v1-initial-schema)
- [x] Commit e850451 (Task 3 — tests)
- [x] `npx tsc --noEmit` passes
- [x] `npx vitest run tests/core/storage/IndexedDBMigrator.test.ts` passes (5/5)

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-07-12*
