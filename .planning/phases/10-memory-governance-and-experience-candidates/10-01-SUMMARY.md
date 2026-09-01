---
phase: 10-memory-governance-and-experience-candidates
plan: 01
subsystem: memory
tags: [memory, governance, conflict-resolution, indexeddb, procedural-experience]

# Dependency graph
requires:
  - phase: 08-knowledge-base-memory-minisearch-notes
    provides: UserMemoryFact, MemoryEngine, MemoryScorer, UserMemoryStore
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: MemoryDB, WriteJournal, IndexedDBMigrator, isPrimaryWriter
provides:
  - MemoryRecord type with governance metadata (source/confidence/lifecycle/sensitivity/revisionChain)
  - Deterministic conflict resolution (correction > verified > prior > inference)
  - MemoryDB v5 migration (memory_records + procedural_experiences stores)
  - MemoryGovernance facade with all 9 user lifecycle controls
  - MemoryEngine procedural gating (only approved records reach chat context)
affects: [15-ui, 11-enrichment, 18-tool-registry]

# Actuals (#2632)
actuals:
  tokens: 65000
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic conflict resolution via precedence chain (no LLM)"
    - "Object-form namespace facade convention (MemoryGovernance)"
    - "Journaled mutations via WriteJournal + isPrimaryWriter gate"
    - "IDB store-per-entity with registered migrations"

key-files:
  created:
    - src/core/memory/MemoryRecord.ts
    - src/core/memory/MemoryGovernance.ts
    - tests/core/memory/governance/MemoryRecord.test.ts
    - tests/core/memory/governance/MemoryGovernance.test.ts
    - tests/core/memory/governance/MemoryEngine.governance.test.ts
  modified:
    - src/types/harness.ts
    - src/core/storage/MemoryDB.ts
    - src/types/storage.ts
    - src/core/memory/MemoryEngine.ts

key-decisions:
  - "MemoryRecord extends Omit<UserMemoryFact, 'source'> to override source with rich metadata object (D-126)"
  - "Conflict precedence: correction (manual+chain) > verified (manual) > prior (extracted) > inference (imported)"
  - "MemoryGovernance as object-form namespace with journalMutation helper for crash-safe mutations"
  - "Procedural scoring uses keyword overlap against title+description+steps (reuses token budget pattern)"

patterns-established:
  - "Governance facade pattern: async namespace object with isPrimaryWriter gate + WriteJournal mutation"
  - "Procedural gating: status === 'approved' required for retrieval (MEM-05)"

requirements-completed: [MEM-01, MEM-02, MEM-03, MEM-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "MemoryRecord type with governance metadata in harness.ts (MEM-01/02)"
    requirement: MEM-01
    verification:
      - kind: unit
        ref: "tests/core/memory/governance/MemoryRecord.test.ts#MEM-01: MemoryKind taxonomy"
        status: pass
      - kind: unit
        ref: "tests/core/memory/governance/MemoryRecord.test.ts#MEM-02: MemoryRecord governance fields"
        status: pass
    human_judgment: false
  - id: D2
    description: "Deterministic conflict resolution — correction > verified > prior > inference (MEM-03)"
    requirement: MEM-03
    verification:
      - kind: unit
        ref: "tests/core/memory/governance/MemoryRecord.test.ts#MEM-03: resolveConflict — deterministic precedence"
        status: pass
    human_judgment: false
  - id: D3
    description: "MemoryDB v5 migration with memory_records + procedural_experiences stores (D-131)"
    requirement: MEM-02
    verification:
      - kind: unit
        ref: "tests/core/memory/governance/MemoryRecord.test.ts#v5 migration — memory_records + procedural_experiences stores"
        status: pass
    human_judgment: false
  - id: D4
    description: "MemoryGovernance facade with all 9 user lifecycle controls (MEM-04)"
    requirement: MEM-04
    verification:
      - kind: unit
        ref: "tests/core/memory/governance/MemoryGovernance.test.ts#MemoryGovernance — MEM-04: 9 user lifecycle controls"
        status: pass
    human_judgment: false
  - id: D5
    description: "MemoryEngine procedural gating — only approved records retrieved (MEM-05 partial)"
    requirement: MEM-03
    verification:
      - kind: unit
        ref: "tests/core/memory/governance/MemoryEngine.governance.test.ts#MemoryEngine — MEM-05: procedural experience gating"
        status: pass
    human_judgment: false

# Metrics
duration: 23min
completed: 2026-09-02
status: complete
---

# Phase 10 Plan 01: Memory Governance Foundation Summary

**MemoryRecord taxonomy with deterministic conflict resolution, v5 IDB migration, 9-control MemoryGovernance facade, and procedural experience gating**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-01T21:56:35Z
- **Completed:** 2026-09-01T22:20:29Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- MemoryRecord type with full governance metadata (kind, source, lifecycle, sensitivity, revisionChain) in harness.ts
- Deterministic conflict resolution (correction > verified > prior > inference) with revisionChain audit trail
- MemoryDB v5 migration creating memory_records + procedural_experiences stores idempotently
- MemoryGovernance facade exposing all 9 user lifecycle controls (view/source/confidence/edit/pin/forget/disableType/export/cloudExclude)
- MemoryEngine procedural gating — only approved records reach chat context; proposed/rejected are invisible

## Task Commits

Each task was committed atomically:

1. **Task 1: MemoryRecord type + conflict resolution + v5 storage** - `8d88c6c` (feat)
2. **Task 2: MemoryGovernance facade — all 9 user lifecycle controls** - `f89eceb` (feat)
3. **Task 3: MemoryEngine procedural gating — filter unapproved records** - `76d37dc` (feat)

## Files Created/Modified
- `src/types/harness.ts` - Extended with MemoryKind, MemoryRecord, ProceduralExperience, KnowledgeEdgeSource (D-126)
- `src/core/memory/MemoryRecord.ts` - NEW: resolveConflict, computeConflictKey, detectConflicts (D-127)
- `src/core/memory/MemoryGovernance.ts` - NEW: 9-control facade over MemoryDB.memory_records (D-128)
- `src/core/memory/MemoryEngine.ts` - EXTENDED: retrieveProceduralExperience, submitProceduralExperience, procedural gating in retrieveMemoryHints (D-129)
- `src/core/storage/MemoryDB.ts` - EXTENDED: v5 migration with memory_records + procedural_experiences stores (D-131)
- `src/types/storage.ts` - EXTENDED: added update-memory-record to WriteJournalOperation union
- `tests/core/memory/governance/MemoryRecord.test.ts` - NEW: MEM-01/02/3 tests (27 tests)
- `tests/core/memory/governance/MemoryGovernance.test.ts` - NEW: MEM-04 tests (13 tests)
- `tests/core/memory/governance/MemoryEngine.governance.test.ts` - NEW: MEM-05 gating tests (8 tests)

## Decisions Made
- MemoryRecord extends `Omit<UserMemoryFact, 'source'>` to override the source field with rich metadata (required because the new source shape is incompatible with UserMemoryFact's `'explicit' | 'inferred' | 'system'`)
- Conflict precedence maps source.kind to categories: manual+chain → correction, manual → verified, extracted → prior, imported → inference
- MemoryGovernance uses a `journalMutation` helper that wraps WriteJournal.runJournaled for crash-safe, single-writer gated mutations
- Procedural experience scoring uses keyword overlap against title+description+steps (simple but effective for v0.1)
- `submitProceduralExperience` omits `status` from the parameter type since it always sets `status='proposed'` internally

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed template literal corruption in harness.ts**
- **Found during:** Task 1 (adding types to harness.ts)
- **Issue:** The edit tool corrupted the WORKING_MEMORY_TEMPLATE by misplacing a backtick relative to the colon
- **Fix:** Used Python byte-level editing to restore the correct `Goals**:`` sequence
- **Files modified:** src/types/harness.ts
- **Verification:** pnpm lint passes, all tests pass
- **Committed in:** 8d88c6c (Task 1 commit)

**2. [Rule 1 - Bug] Fixed test import paths for governance test directory**
- **Found during:** Task 1 (running tests)
- **Issue:** Test imports used `../../../src/` but the governance subdirectory is one level deeper
- **Fix:** Changed to `../../../../src/` in all governance test files
- **Files modified:** tests/core/memory/governance/MemoryRecord.test.ts
- **Verification:** Tests resolve and pass
- **Committed in:** 8d88c6c (Task 1 commit)

**3. [Rule 1 - Bug] Removed clearMigrations call that prevented v5 migration**
- **Found during:** Task 1 (running migration tests)
- **Issue:** Test beforeEach called `clearMigrations(MEMORY_DB)` which removed the v5 migration from the registry
- **Fix:** Removed the clearMigrations call; migration is registered at module load and is idempotent
- **Files modified:** tests/core/memory/governance/MemoryRecord.test.ts
- **Verification:** Migration tests pass
- **Committed in:** 8d88c6c (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 bug fixes)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None — all issues were auto-fixed via deviation rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Memory governance foundation complete (MEM-01/02/03/04)
- Procedural gating foundation complete (MEM-05 partial — approved-only retrieval)
- Ready for Plan 02 (NoteGraph edge provenance — KNW-01)
- All 858 tests pass, zero NP-STRICT markers

---
*Phase: 10-memory-governance-and-experience-candidates*
*Completed: 2026-09-02*
