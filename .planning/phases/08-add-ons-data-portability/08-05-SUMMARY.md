---
phase: 08-add-ons-data-portability
plan: 05
subsystem: addon
tags: [gqm, teamgqm, indexeddb, writejournal, idb, tdd]

# Dependency graph
requires:
  - phase: 02-05
    provides: WriteJournal module with begin/markStepStart/markStepComplete/markCompleted
  - phase: 02-03
    provides: IndexedDB getDB() singleton
  - phase: 02-08
    provides: WriteJournalOperation union type in WriteJournalEntry

provides:
  - GQM data model (Goal, Question, Metric) with type discriminator for IndexedDB querying
  - GQMDataService class+singleton with full CRUD via WriteJournal
  - 'save-gqm-data' operation type in WriteJournalOperation union
  - 7-passing tests for all GQM CRUD operations

affects:
  - 08-06 (TeamGQM Side Panel page reads from GQMDataService)
  - 08-07 (TeamGQM Full App page uses GQMDataService for editing)
  - IndexedDB migration plan (add gqm store to DBSchema)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED→GREEN cycle for data service + data model
    - WriteJournal lifecycle wrapping all IndexedDB writes (begin → markStepStart → tx → markStepComplete → markCompleted)
    - discriminated type field for entity querying in schemaless IndexedDB stores

key-files:
  created:
    - src/addons/teamgqm/data/gqmTypes.ts (Goal, Question, Metric, GQMNode types)
    - src/addons/teamgqm/services/GQMDataService.ts (class+singleton, WriteJournal-backed CRUD)
    - tests/addons/teamgqm/GQMDataService.test.ts (7 tests)
  modified:
    - src/core/storage/WriteJournalEntry.ts (added 'save-gqm-data' operation type)

key-decisions:
  - "GQMDataService uses #getGqmDB() helper casting getDB() to untyped IDBPDatabase since gqm store not yet in DBSchema — store will be added via future IndexedDB migration plan"
  - "createGoal/createQuestion/createMetric input types exclude type/parentId fields — service fills these automatically"
  - "deleteNode uses soft-delete (deleted flag) per D-11; no hard-delete path"
  - "getChildren uses in-memory filter after getAll — gqm store is small (hundreds not thousands), single store read is fine"

requirements-completed:
  - ADDON-08

coverage:
  - id: D1
    description: "GQM data model with Goal, Question, Metric discriminated types (goal/question/metric) for IndexedDB querying"
    requirement: ADDON-08
    verification:
      - kind: unit
        ref: "src/addons/teamgqm/data/gqmTypes.ts exports Goal, Question, Metric, GQMNode"
        status: pass
    human_judgment: false

  - id: D2
    description: "WriteJournalOperation union includes 'save-gqm-data' operation type"
    requirement: ADDON-08
    verification:
      - kind: unit
        ref: "src/core/storage/WriteJournalEntry.ts includes 'save-gqm-data' in union and zod schema"
        status: pass
    human_judgment: false

  - id: D3
    description: "GQMDataService.createGoal stores goal with type:goal discriminator via WriteJournal"
    requirement: ADDON-08
    verification:
      - kind: unit
        ref: "tests/addons/teamgqm/GQMDataService.test.ts#createGoal"
        status: pass
    human_judgment: false

  - id: D4
    description: "GQMDataService.createQuestion stores question with parentId referencing goal"
    requirement: ADDON-08
    verification:
      - kind: unit
        ref: "tests/addons/teamgqm/GQMDataService.test.ts#createQuestion"
        status: pass
    human_judgment: false

  - id: D5
    description: "GQMDataService.createMetric stores metric with parentId referencing question"
    requirement: ADDON-08
    verification:
      - kind: unit
        ref: "tests/addons/teamgqm/GQMDataService.test.ts#createMetric"
        status: pass
    human_judgment: false

  - id: D6
    description: "GQMDataService.getChildren returns all child entities for a given parent"
    requirement: ADDON-08
    verification:
      - kind: unit
        ref: "tests/addons/teamgqm/GQMDataService.test.ts#getChildren"
        status: pass
    human_judgment: false

  - id: D7
    description: "GQMDataService.updateNode updates title/description and bumps updatedAt"
    requirement: ADDON-08
    verification:
      - kind: unit
        ref: "tests/addons/teamgqm/GQMDataService.test.ts#updateNode"
        status: pass
    human_judgment: false

  - id: D8
    description: "GQMDataService.deleteNode soft-deletes (sets deleted flag) via WriteJournal"
    requirement: ADDON-08
    verification:
      - kind: unit
        ref: "tests/addons/teamgqm/GQMDataService.test.ts#deleteNode"
        status: pass
    human_judgment: false

  - id: D9
    description: "GQMDataService.getTree returns full Goal→Questions→Metrics hierarchy"
    requirement: ADDON-08
    verification:
      - kind: unit
        ref: "tests/addons/teamgqm/GQMDataService.test.ts#getTree"
        status: pass
    human_judgment: false

# Metrics
duration: 5 min
completed: 2026-07-19
status: complete
---

# Phase 8 Plan 5: TeamGQM Data Model + WriteJournal-backed GQMDataService

**GQM data model (Goal, Question, Metric with discriminated type field) and GQMDataService class+singleton with full WriteJournal-backed CRUD — all 7 tests passing via TDD RED→GREEN cycle**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-19T22:23:00Z
- **Completed:** 2026-07-19T22:26:30Z
- **Tasks:** 2 (1 TDD RED, 1 TDD GREEN)
- **Files modified:** 4

## Accomplishments

- **GQM type definitions** in `gqmTypes.ts` — Goal, Question, Metric interfaces with `type` discriminator field, pure type-only exports following PageContext.ts pattern
- **GQMDataService** class + singleton with 7 methods:
  - `createGoal`, `createQuestion`, `createMetric` — all via WriteJournal with operation `'save-gqm-data'`
  - `getChildren(parentId)` — returns non-deleted child entities (in-memory filter)
  - `updateNode(id, updates)` — merges partial updates, bumps `updatedAt`, journaled
  - `deleteNode(id)` — soft-delete via `deleted: true` flag, journaled
  - `getTree(goalId)` — assembles full Goal→Questions→Metrics hierarchy
- **WriteJournalEntry extended** — `'save-gqm-data'` added to `WriteJournalOperation` union type and zod schema
- **7 tests passing** — covers all CRUD operations, WriteJournal verification, hierarchy assembly

## Task Commits

Each task was committed atomically following TDD cycle:

1. **Task 1 (TDD RED): Add failing test for GQMDataService** - `96dc85b` (test)
2. **Task 2 (TDD GREEN): Implement GQMDataService with WriteJournal-backed CRUD** - `634fbcc` (feat)

## Files Created/Modified

### Created
- `src/addons/teamgqm/data/gqmTypes.ts` — Goal, Question, Metric, GQMNode type definitions
- `src/addons/teamgqm/services/GQMDataService.ts` — WriteJournal-backed CRUD service (class + singleton)
- `tests/addons/teamgqm/GQMDataService.test.ts` — 7 tests covering all CRUD operations

### Modified
- `src/core/storage/WriteJournalEntry.ts` — Added `'save-gqm-data'` to WriteJournalOperation union and zod schema

## Decisions Made

- **GQMDataService uses `#getGqmDB()` helper** casting `getDB()` result to untyped `IDBPDatabase<Record<string, unknown>>` — the `gqm` object store is not yet in the `NowPilotDB` DBSchema (will be added by a future IndexedDB migration plan)
- **Input types exclude `type` and `parentId`** — `CreateGoalInput` omits `type`/`parentId` (service sets automatically); `CreateQuestionInput`/`CreateMetricInput` omit `type` but include `parentId` (caller specifies the parent)
- **Soft-delete design** — `deleteNode` sets `deleted: true` flag (not hard delete), preserving data for potential undo or recovery per threat model T-08-15
- **getChildren uses in-memory filter** after reading all entities — the gqm store is expected to contain hundreds (not thousands) of entities, single store read is simpler than maintaining composite indexes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] GQMDataService needed type cast for getDB()**
- **Found during:** Task 2 (GQMDataService implementation)
- **Issue:** The `gqm` object store isn't in the `NowPilotDB` DBSchema, causing TypeScript errors on `db.transaction('gqm', ...)` — this is by design since the store migration happens in a separate plan
- **Fix:** Added `#getGqmDB()` private method that casts `getDB()` via `unknown` to `IDBPDatabase<Record<string, unknown>>`
- **Files modified:** `src/addons/teamgqm/services/GQMDataService.ts`
- **Verification:** TypeScript compiles with no errors from modified files; tests pass
- **Committed in:** `634fbcc` (Task 2 commit)

**2. [Rule 3 - Blocking] Input types in GQMDataService didn't match test expectations**
- **Found during:** Task 2 verification (TypeScript compilation)
- **Issue:** `Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>` still required `type: 'goal'` and `parentId: null`, but the test (and logical API) should accept just user-provided fields
- **Fix:** Changed `CreateGoalInput` to also omit `type` and `parentId`; changed `CreateQuestionInput`/`CreateMetricInput` to omit `type` (service fills these in automatically)
- **Files modified:** `src/addons/teamgqm/services/GQMDataService.ts`
- **Verification:** TS compiles clean, all 7 tests pass
- **Committed in:** `634fbcc` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness and type safety. No scope creep.

## TDD Gate Compliance

- **RED Gate:** Present — `test(08-05): add failing test for GQMDataService` (96dc85b)
- **GREEN Gate:** Present — `feat(08-05): implement GQMDataService with WriteJournal-backed CRUD` (634fbcc)
- **REFACTOR:** Not needed — implementation clean and minimal
- **Status:** All gates PASS

## Issues Encountered

- **Pre-existing TypeScript errors** in unrelated test files (SPANavigationWatcher, ContextOptimizer, useVoiceInput, etc.) — these are not caused by this plan's changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GQM data model and CRUD service ready for TeamGQM Side Panel (Plan 08-06) and Full App (Plan 08-07) pages
- The `gqm` IndexedDB object store will need to be added to the DBSchema and migration in a future plan before the service works at runtime
- WriteJournalEntry now supports `'save-gqm-data'` for all GQM entity writes
- Next plan: 08-06

## Self-Check: PASSED

- [x] `src/addons/teamgqm/data/gqmTypes.ts` exists with Goal, Question, Metric, GQMNode exports
- [x] `src/addons/teamgqm/services/GQMDataService.ts` exists with class + singleton
- [x] `tests/addons/teamgqm/GQMDataService.test.ts` exists with 7 tests
- [x] Both TDD commits verified in git log (RED + GREEN)
- [x] All 7 GQM tests pass
- [x] WriteJournalEntry includes 'save-gqm-data' in both union type and zod schema
- [x] No TS errors from modified files

---

*Phase: 08-add-ons-data-portability*
*Completed: 2026-07-19*
