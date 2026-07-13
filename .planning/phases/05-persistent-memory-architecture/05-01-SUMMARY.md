---
phase: 05-persistent-memory-architecture
plan: 01
subsystem: memory
tags: [memory-types, minisearch, zod, test-scaffold]

# Dependency graph
requires:
  - phase: 04-context-adaptive-execution
    provides: ContextOptimizerInput with memory/preferences fields
provides:
  - minisearch@7.2.0 production dependency
  - Shared memory type definitions (7 interfaces + 3 Zod schemas + 1 error class)
  - test scaffold directory with 5 placeholder test files
affects:
  - All subsequent Phase 5 plans (05-02 through 05-07)

# Tech tracking
tech-stack:
  added:
    - minisearch v7.2.0 (full-text search for memory retrieval)
  patterns:
    - Zod schema + TS interface co-location (same pattern as contextTypes.ts)
    - Dual export pattern: interface + z.infer type per schema-backed type
    - Custom Error class with readonly code property
    - vi.hoisted() + vi.mock() for IndexedDBManager in store test scaffolds
    - createMockX factory functions for integration test scaffolds

key-files:
  created:
    - src/core/memory/memoryTypes.ts (109 lines)
    - tests/core/memory/MemoryScorer.test.ts
    - tests/core/memory/UserMemoryStore.test.ts
    - tests/core/memory/ConversationMemoryStore.test.ts
    - tests/core/memory/PreferenceMemoryStore.test.ts
    - tests/core/memory/MemoryEngine.test.ts
  modified:
    - package.json (minisearch added)
    - pnpm-lock.yaml (minisearch resolution)
    - .gitignore (package-lock.json excluded — pnpm project)

key-decisions:
  - "Installed minisearch via pnpm (not npm as plan specified) since the project uses pnpm for dependency management"
  - "Scaffold test files do NOT import from non-existent source modules — source files will be created in later wave plans (05-03 through 05-06)"
  - "Application of vi.hoisted() mock pattern from domainStores.test.ts in store test scaffolds for future IndexedDB mocking"

requirements-completed:
  - MEM-01
  - MEM-02
  - MEM-03
  - MEM-04

coverage:
  - id: D1
    description: "minisearch@7.2.0 installed as production dependency in package.json"
    requirement: MEM-01
    verification:
      - kind: other
        ref: "grep -c minisearch package.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "memoryTypes.ts exports 7 interfaces (UserMemoryFact, MemoryScore, ConversationSummary, PreferencePayload, MemoryAssembleResult, MemoryExtractionResult, MemoryWriteRequest)"
    requirement: MEM-01
    verification:
      - kind: other
        ref: "tsc --noEmit passes with 0 memoryTypes errors"
        status: pass
    human_judgment: false
  - id: D3
    description: "memoryTypes.ts exports 3 Zod schemas (userMemoryFactSchema, extractionResultSchema, preferenceSchema)"
    requirement: MEM-01
    verification:
      - kind: other
        ref: "grep -c each schema export"
        status: pass
    human_judgment: false
  - id: D4
    description: "5 scaffold test files in tests/core/memory/"
    requirement: MEM-01
    verification:
      - kind: other
        ref: "ls tests/core/memory/*.test.ts == 5 files"
        status: pass
    human_judgment: false

# Metrics
duration: 4 min
completed: 2026-07-13
status: complete
---

# Phase 5 Plan 01: Package Install + Memory Types + Test Scaffolding

**minisearch@7.2.0 dependency installed, 7 shared memory type interfaces + 3 Zod schemas + MemoryCapExceededError in memoryTypes.ts, test scaffold directory with 5 placeholder test files**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-13T01:11:34Z
- **Completed:** 2026-07-13T01:15:39Z
- **Tasks:** 2 (merged into single commit after pnpm fix)
- **Files modified/created:** 8

## Accomplishments

- Installed minisearch@7.2.0 production dependency for full-text search index (MemoryEngine retrieval)
- Created `src/core/memory/memoryTypes.ts` (109 lines) with:
  - 7 TypeScript interfaces: `UserMemoryFact`, `MemoryScore`, `ConversationSummary`, `PreferencePayload`, `MemoryAssembleResult`, `MemoryExtractionResult`, `MemoryWriteRequest`
  - 3 Zod schemas: `userMemoryFactSchema`, `extractionResultSchema`, `preferenceSchema`
  - `MemoryCapExceededError` custom error class with `code = 'MEMORY_CAP_EXCEEDED'`
  - Dual export pattern (TS interface + z.infer type) following `contextTypes.ts` convention
- Created `tests/core/memory/` directory with 5 scaffold test files:
  - `MemoryScorer.test.ts` — pure utility scaffold (no I/O)
  - `UserMemoryStore.test.ts` — store scaffold with vi.hoisted() getDB mock
  - `ConversationMemoryStore.test.ts` — store scaffold with vi.hoisted() getDB mock
  - `PreferenceMemoryStore.test.ts` — store scaffold with vi.hoisted() getDB mock
  - `MemoryEngine.test.ts` — integration scaffold (createMockX factories in later wave)
- All 5 scaffold tests pass as skipped (todo tests)
- Added `package-lock.json` to `.gitignore` (project uses pnpm, not npm)

## Task Commits

1. **Task 1 + 2 (merged): Install minisearch + create memoryTypes + test scaffold** - `5598f16` (feat)

**Note:** The soft reset to fix the pnpm install merged both tasks into a single commit. Both planned deliverables are present.

## Files Created/Modified

- `src/core/memory/memoryTypes.ts` (109 lines) — Shared memory type definitions with Zod schemas
- `tests/core/memory/MemoryScorer.test.ts` — Pure utility scaffold (no mocks needed)
- `tests/core/memory/UserMemoryStore.test.ts` — Store scaffold with vi.hoisted() getDB mock
- `tests/core/memory/ConversationMemoryStore.test.ts` — Store scaffold with vi.hoisted() getDB mock
- `tests/core/memory/PreferenceMemoryStore.test.ts` — Store scaffold with vi.hoisted() getDB mock
- `tests/core/memory/MemoryEngine.test.ts` — Integration scaffold (createMockX factories deferred)
- `package.json` — Added minisearch@7.2.0 to dependencies
- `pnpm-lock.yaml` — Updated with minisearch@7.2.0 resolution
- `.gitignore` — Added package-lock.json exclusion

## Decisions Made

- Used `pnpm` instead of `npm` (plan specified npm, but project uses pnpm for dependency management). Ensures lockfile consistency with existing project conventions.
- Scaffold test files avoid importing from non-existent source modules — source files (`UserMemoryStore.ts`, `ConversationMemoryStore.ts`, etc.) will be created in later wave plans. This ensures tests run cleanly now and will be updated when sources exist.
- Store test scaffolds include the `vi.hoisted()` + `vi.mock()` pattern for IndexedDBManager ready for when the store implementations are added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used pnpm instead of npm for minisearch install**
- **Found during:** Task 1 (Install minisearch)
- **Issue:** Plan instructed `npm install minisearch@7.2.0`, but the project uses `pnpm` (pnpm-lock.yaml, pnpm overrides in package.json). npm install created a package-lock.json and corrupted the pnpm lockfile.
- **Fix:** Restored pnpm-lock.yaml from git, installed via `pnpm add minisearch@7.2.0`, added `package-lock.json` to `.gitignore`
- **Files modified:** package.json, pnpm-lock.yaml, .gitignore
- **Verification:** `grep minisearch package.json` returns match; `grep minisearch pnpm-lock.yaml` returns 3 matches; tests pass
- **Committed in:** 5598f16

**2. [Rule 2 - Missing Critical] Scaffold test files fixed to not import from non-existent source modules**
- **Found during:** Task 1 verification (vitest test run)
- **Issue:** Scaffold files imported from source modules (`UserMemoryStore`, `ConversationMemoryStore`, etc.) that don't exist yet — causing vitest transform failures
- **Fix:** Removed all imports from non-existent modules. Store scaffolds keep the vi.hoisted() mock pattern for IndexedDBManager; MemoryEngine scaffold keeps only the describe/it.todo for now. When source modules are created in later waves, tests will be updated to import from them.
- **Files modified:** All 5 test scaffold files
- **Verification:** `npx vitest run tests/core/memory/` — all 5 files pass as skipped (todo)
- **Committed in:** 5598f16

**3. [Rule 3 - Blocking] Both tasks merged into single commit after soft reset**
- **Found during:** Task 2 (git history correction)
- **Issue:** Soft reset to fix pnpm install merged both task changes into a single staged state. Re-creating two separate commits would have required manual split.
- **Fix:** Accepted single commit with all changes. Both Task 1 and Task 2 deliverables are present.
- **Verification:** All acceptance criteria pass
- **Committed in:** 5598f16

---

**Total deviations:** 3 (2 blocking, 1 missing critical)
**Impact on plan:** All fixes ensure project conventions are followed and tests run cleanly. No scope creep.

## Issues Encountered

- The plan's `npm install` instruction conflicted with the project's pnpm setup. Fixed by switching to pnpm and excluding the npm lockfile.
- Vitest failed on scaffold files importing non-existent modules. Fixed by removing imports while keeping the mock infrastructure (vi.hoisted) that references existing modules.
- Both tasks ended up in a single commit after the soft reset. This is cosmetic — all planned deliverables are present.

## Known Stubs

- All 5 scaffold test files have `it.todo('placeholder — tests added in wave 2-4')` — these are intentional stubs to be filled when source modules are created in later waves.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Foundation layer complete: minisearch installed, shared type definitions ready, test directory scaffolded
- Next plan: 05-02 — Schema migration v2 (IndexedDBManager DB_VERSION=2, NowPilotDB extension, MemoryDB extended signatures)
- All subsequent Phase 5 plans (05-02 through 05-07) can import from `memoryTypes.ts` and use the test scaffold structure

---

*Phase: 05-persistent-memory-architecture*
*Completed: 2026-07-13*
