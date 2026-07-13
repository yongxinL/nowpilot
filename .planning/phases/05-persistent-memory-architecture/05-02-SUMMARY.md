---
phase: 05-persistent-memory-architecture
plan: 02
subsystem: storage
tags: [indexeddb, schema-migration, idb, typescript, memory-db]

# Dependency graph
requires:
  - phase: 05-01
    provides: package install + memory types + test scaffolding
provides:
  - DB_VERSION=2 in IndexedDBManager.ts
  - Extended NowPilotDB interface with versioned-fact-model fields (status, tags, useCount, lastUsedAt) on memory_userFacts
  - Extended NowPilotDB interface with conversation-state fields (state, archivedAt) on memory_summaries
  - Extended MemoryDB method parameter types matching the v2 schema
affects:
  - Phase 05-03 (UserMemoryStore — consumes putUserFact with new fields)
  - Phase 05-04 (ConversationMemoryStore — consumes putSummary with new fields)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - IndexedDB schemaless migration: bump DB_VERSION, add no-op upgrade callback, extend TypeScript interface

key-files:
  created: []
  modified:
    - src/core/storage/IndexedDBManager.ts — DB_VERSION=2, NowPilotDB extended, v2 upgrade branch
    - src/core/storage/stores/MemoryDB.ts — putUserFact, getAllUserFacts, putSummary, getSummary extended

key-decisions:
  - "v2 upgrade branch is intentionally a no-op — IndexedDB object stores are schemaless at the value level; new optional fields are added via put() at runtime with defaults"
  - "All 6 new fields are optional (? marking) — existing v1 records survive migration with undefined defaults"

patterns-established:
  - "Pattern: IndexedDB schema migrations follow schemaless pattern — bump DB_VERSION, add explanatory comment in upgrade callback, extend TypeScript interface. No store recreation or data migration needed for optional field additions."

requirements-completed:
  - MEM-01
  - MEM-02

coverage:
  - id: D1
    description: "DB_VERSION is 2 (bumped from 1), NowPilotDB interface extended with 4 optional fields on memory_userFacts and 2 on memory_summaries, v2 upgrade callback has oldVersion < 2 branch"
    requirement: MEM-01
    verification:
      - kind: unit
        ref: "grep: DB_VERSION = 2 in IndexedDBManager.ts"
        status: pass
      - kind: unit
        ref: "grep: oldVersion < 2 in IndexedDBManager.ts"
        status: pass
      - kind: unit
        ref: "grep: status.*active.*superseded in IndexedDBManager.ts"
        status: pass
      - kind: unit
        ref: "grep: state.*active.*archived in IndexedDBManager.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "MemoryDB method parameter types extended with v2 fields — putUserFact and getAllUserFacts return type include status/tags/useCount/lastUsedAt; putSummary and getSummary return type include state/archivedAt"
    requirement: MEM-02
    verification:
      - kind: unit
        ref: "grep: status.*active.*superseded in MemoryDB.ts (2 occurrences)"
        status: pass
      - kind: unit
        ref: "grep: state.*active.*archived in MemoryDB.ts (2 occurrences)"
        status: pass
      - kind: unit
        ref: "grep: tags in MemoryDB.ts"
        status: pass
      - kind: unit
        ref: "grep: useCount in MemoryDB.ts"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit: no IndexedDBManager/MemoryDB errors"
        status: pass
      - kind: unit
        ref: "npx vitest run tests/core/storage/domainStores.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-07-13
status: complete
---

# Phase 5 Plan 2: IndexedDB Schema v2 — Versioned Fact Model + Conversation State Fields

**Bumped DB_VERSION from 1 to 2, extended NowPilotDB TypeScript interface with versioned-fact-model fields (status, tags, useCount, lastUsedAt) and conversation-state fields (state, archivedAt), extended MemoryDB method parameter types to match**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-13T11:17:56Z
- **Completed:** 2026-07-13T11:19:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- DB_VERSION bumped from 1 to 2 in IndexedDBManager.ts
- NowPilotDB interface extended: memory_userFacts.value gains `status?`, `tags?`, `useCount?`, `lastUsedAt?` optional fields; memory_summaries.value gains `state?`, `archivedAt?` optional fields
- v2 upgrade callback added with no-op body (schemaless stores — new fields added at runtime via put() with defaults)
- MemoryDB.putUserFact and getAllUserFacts return type extended with the same 4 optional fields
- MemoryDB.putSummary and getSummary return type extended with state and archivedAt optional fields
- All 5 existing domain store tests pass unchanged; TypeScript compiles with no errors in modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Bump DB_VERSION to 2 and extend NowPilotDB interface with v2 fields** - `18080ad` (feat)
2. **Task 2: Extend MemoryDB method parameter types with v2 fields** - `9c22262` (feat)

## Files Created/Modified

- `src/core/storage/IndexedDBManager.ts` — DB_VERSION=2, NowPilotDB memory_userFacts and memory_summaries extended, v2 upgrade branch
- `src/core/storage/stores/MemoryDB.ts` — putUserFact, getAllUserFacts, putSummary, getSummary parameter/return types extended

## Decisions Made

- v2 upgrade branch is intentionally a no-op — IndexedDB object stores are schemaless at the value level. New optional fields don't require store re-creation; they're added via put() at runtime and have undefined defaults at read time.
- All 6 new fields are optional (`?` in TypeScript) — existing v1 records survive migration without data loss. Records without these fields get `undefined` at read time; consuming code provides runtime defaults.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — both tasks executed cleanly. Pre-existing TypeScript errors in unrelated files (ProviderRegistry, test files for AgentOrchestrator, RendererService, ChunkBuffer, ContextOptimizer) are unchanged and unrelated to this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- IndexedDB schema v2 ready for Phase 05-03 (UserMemoryStore) which consumes MemoryDB.putUserFact with status, tags, useCount, lastUsedAt fields
- Ready for Phase 05-04 (ConversationMemoryStore) which consumes MemoryDB.putSummary with state, archivedAt fields
- NowPilotDB interface changes consumed by idb type-safe openDB call in getDB()
- Next plan: 05-03

## Self-Check: PASSED

- [x] `DB_VERSION = 2` in IndexedDBManager.ts
- [x] `oldVersion < 2` branch in upgrade callback
- [x] 4 new optional fields on `memory_userFacts.value`: status, tags, useCount, lastUsedAt
- [x] 2 new optional fields on `memory_summaries.value`: state, archivedAt
- [x] MemoryDB.putUserFact param type extended with 4 optional fields
- [x] MemoryDB.getAllUserFacts return type extended with 4 optional fields
- [x] MemoryDB.putSummary param type extended with 2 optional fields
- [x] MemoryDB.getSummary return type extended with 2 optional fields
- [x] TypeScript compiles with no errors in modified files
- [x] All 5 domain store tests pass
- [x] Commits verified: 18080ad, 9c22262

---

*Phase: 05-persistent-memory-architecture*
*Completed: 2026-07-13*
