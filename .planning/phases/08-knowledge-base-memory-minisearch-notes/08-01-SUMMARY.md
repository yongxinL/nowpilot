---
phase: 08-knowledge-base-memory-minisearch-notes
plan: 01
subsystem: memory, storage, types
tags: [zustand, zod, chrome-storage, indexeddb, notes, persona, canonical-types]

requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: MemoryDB/NotesDB IDB foundation, isPrimaryWriter, chromeStorageAdapter
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: PersonaProfileSchema, DEFAULT_PERSONA, Phase-3 UserPreferences store
  - phase: 06-pagecontentservice-knowledge-acquisition
    provides: D-83 re-export precedent (context/types.ts)
  - phase: 07-trust-aware-context-and-receipts
    provides: ContextItem/ContextReceiptEntry types in @/types/harness

provides:
  - Canonical Note type at src/types/notes.ts (spec 4721-4741 verbatim)
  - Canonical memory types at src/core/memory/types.ts (RetrievedMemory, UserPreferences S3.5, UserMemoryFact S3.4)
  - WorkingMemory + WORKING_MEMORY_TEMPLATE at src/types/harness.ts
  - Re-export supersessions (NotesDB, MemoryDB, context/types, ai/UserPreferences)
  - PreferenceMemoryStore owning np_persona (RICH-R-05)

affects: [08-02, 08-03, 08-04, 08-05, 09-llm-wiki]

actuals:
  tokens: 85000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns: [canonical-type-home-with-re-export-supersession, zustand-persist-single-writer-gated, zod-validated-hydrate]

key-files:
  created:
    - src/types/notes.ts
    - src/core/memory/types.ts
    - src/core/memory/PreferenceMemoryStore.ts
    - tests/core/notes/note-canonical.test.ts
    - tests/core/memory/PreferenceMemoryStore.test.ts
  modified:
    - src/core/storage/NotesDB.ts
    - src/core/storage/MemoryDB.ts
    - src/core/context/types.ts
    - src/core/ai/UserPreferences.ts
    - src/types/harness.ts
    - tests/core/ai/UserPreferences.test.ts
    - tests/core/ai/persona/PersonaInjector.test.ts
    - tests/core/ai/PromptCacheManager.test.ts
    - tests/core/context/ContextOptimizer.test.ts
    - tests/core/context/trust/assemble-trust.test.ts
    - tests/core/context/trust/contextItems.test.ts
    - tests/core/context/trust/stable-prefix.snapshot.test.ts

key-decisions:
  - "Note.type?: string declaration-only in Phase 8 (D-108) — zero consumers, grep-asserted"
  - "personaOverrides kept in np_preferences partialize (Open Q3: live readers in contextItems/PromptCacheManager/PersonaInjector)"
  - "UserPreferences required S3.5 fields use zod defaults (responseStyle='mixed', preferredLanguage='en', etc.)"
  - "PreferenceMemoryStore uses api.setState (not immer recipe) to avoid type inference conflicts"
  - "Phase-3 UserPreferences.store survives D-112 supersession with re-export + initialPreferences defaults"

patterns-established:
  - "Canonical type home + re-export supersession: new home declares verbatim, old file imports + re-exports (D-72/D-83/D-107/D-112)"
  - "Single-writer gated zustand persist: isPrimaryWriter() check before setState, debugLog on skip"

requirements-completed: [RICH-R-05]

coverage:
  - id: D1
    description: "Canonical Note type at src/types/notes.ts (spec 4721-4741 verbatim) with OKF constants"
    requirement: RICH-R-05
    verification:
      - kind: unit
        ref: tests/core/notes/note-canonical.test.ts#round-trips canonical fields
        status: pass
      - kind: unit
        ref: tests/core/notes/note-canonical.test.ts#exports OKF_NOTE_DEFAULT_TYPE
        status: pass
    human_judgment: false
  - id: D2
    description: "Memory type homes (RetrievedMemory + UserPreferences S3.5 + UserMemoryFact S3.4) at src/core/memory/types.ts"
    requirement: RICH-R-05
    verification:
      - kind: unit
        ref: tests/core/ai tests/core/context (286 tests green after supersession)
        status: pass
    human_judgment: false
  - id: D3
    description: "PreferenceMemoryStore owns np_persona — zod-validated hydrate, single-writer-gated, idempotent, R2-never-fact-store (RICH-R-05)"
    requirement: RICH-R-05
    verification:
      - kind: unit
        ref: tests/core/memory/PreferenceMemoryStore.test.ts#RICH-R-05 round-trip
        status: pass
      - kind: unit
        ref: tests/core/memory/PreferenceMemoryStore.test.ts#IDEMPOTENCY
        status: pass
      - kind: unit
        ref: tests/core/memory/PreferenceMemoryStore.test.ts#CONCURRENCY
        status: pass
      - kind: unit
        ref: tests/core/memory/PreferenceMemoryStore.test.ts#ZOD VALIDATION
        status: pass
    human_judgment: false
  - id: D4
    description: "WorkingMemory + WORKING_MEMORY_TEMPLATE appended to src/types/harness.ts (D-104, C.1)"
    requirement: RICH-R-05
    verification:
      - kind: unit
        ref: "tsc --noEmit strict-clean (harness.ts type-checks)"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-09-01
status: complete
---

# Phase 8 Plan 01: Canonical Type Homes + PreferenceMemoryStore Summary

**Canonical Note type spine (D-107/D-108), memory type homes (D-112/D-113), and RICH-R-05 PreferenceMemoryStore np_persona with zod-validated hydrate and single-writer gate**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-01T03:47:07Z
- **Completed:** 2026-09-01T04:02:41Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Canonical Note (spec 4721-4741 verbatim) declared at src/types/notes.ts with OKF_NOTE_DEFAULT_TYPE + OkfNoteFrontmatter + NOTE_SUGGESTION_DISPLAY_THRESHOLD; Note.type?: string declaration-only (D-108)
- Memory type homes at src/core/memory/types.ts: RetrievedMemory (spec 4572), full S3.5 UserPreferences + schema (spec 4579 + D-54), S3.4 UserMemoryFact (spec 601) + tone/brevity enums + personaOverridesSchema
- WorkingMemory + WORKING_MEMORY_TEMPLATE appended to src/types/harness.ts (D-104/C.1)
- Re-export supersessions: NotesDB (Note), MemoryDB (UserMemoryFact), context/types (RetrievedMemory), ai/UserPreferences (full S3.5 shape) — all consumers resolve with zero edits
- PreferenceMemoryStore (np_persona) implements RICH-R-05: zustand + persist + chromeStorageAdapter, zod-validated hydrate (T-8-01), single-writer-gated (D-106), idempotent repeat-hydration, R2-never-fact-store

## Task Commits

Each task was committed atomically:

1. **Task 1: TRACER — canonical Note spine** - `58e31a5` (feat)
2. **Task 2: Memory type homes + supersession re-exports** - `7b3db94` (feat)
3. **Task 3: UserPreferences supersession + PreferenceMemoryStore** - `6a46e9e` (feat)

## Files Created/Modified
- `src/types/notes.ts` — Canonical Note (§21.2 verbatim) + OKF constants (D-107/D-108)
- `src/core/memory/types.ts` — Canonical memory types (RetrievedMemory + UserPreferences S3.5 + UserMemoryFact S3.4 + enums)
- `src/core/memory/PreferenceMemoryStore.ts` — np_persona owner (RICH-R-05)
- `src/types/harness.ts` — WorkingMemory + WORKING_MEMORY_TEMPLATE appended (D-104)
- `src/core/storage/NotesDB.ts` — Note placeholder deleted, canonical re-export (D-107)
- `src/core/storage/MemoryDB.ts` — UserMemoryFact superseded to canonical shape (D-104)
- `src/core/context/types.ts` — RetrievedMemory replaced with re-export (D-112)
- `src/core/ai/UserPreferences.ts` — Re-exports full S3.5 shape, updates initialPreferences/partialize (D-112/Pitfall 3)
- `tests/core/notes/note-canonical.test.ts` — TRACER proof: put/get round-trip + constants
- `tests/core/memory/PreferenceMemoryStore.test.ts` — RICH-R-05 proof: round-trip/R2/idempotency/concurrency/zod
- 7 test files updated with required S3.5 fields (D-112 supersession fixture fix)

## Decisions Made
- Note.type?: string declaration-only in Phase 8 (D-108) — grep-asserted zero consumers
- personaOverrides kept in np_preferences partialize (Open Q3: live readers in contextItems.ts, PromptCacheManager.ts, PersonaInjector.ts)
- UserPreferences required S3.5 fields use zod .default() (responseStyle='mixed', preferredLanguage='en', etc.)
- PreferenceMemoryStore uses api.setState (not immer recipe form) to avoid type inference conflicts with persist middleware
- Phase-3 UserPreferences.store survives D-112 supersession with re-export + initialPreferences defaults

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing tests fail after D-112 UserPreferences supersession**
- **Found during:** Task 3 (UserPreferences store supersession)
- **Issue:** 7 test files constructed UserPreferences objects without the new required S3.5 fields (responseStyle, preferredLanguage, etc.), causing TS2740 type errors
- **Fix:** Added base required §3.5 fields to all test fixtures (basePrefs helper + inline objects)
- **Files modified:** tests/core/ai/UserPreferences.test.ts, tests/core/ai/persona/PersonaInjector.test.ts, tests/core/ai/PromptCacheManager.test.ts, tests/core/context/ContextOptimizer.test.ts, tests/core/context/trust/assemble-trust.test.ts, tests/core/context/trust/contextItems.test.ts, tests/core/context/trust/stable-prefix.snapshot.test.ts
- **Verification:** All 286 tests pass across 31 test files
- **Committed in:** 6a46e9e (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to keep consumer tests green after the D-112 supersession. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Canonical type spine + persona store complete and tested
- Ready for plan 08-02 (MemoryEngine + UserMemoryStore + MemoryScorer + ConversationMemoryStore)
- All 286 consumer tests green after supersession

## Self-Check: PASSED

- All 5 created files exist on disk
- All 3 task commits present in git log (58e31a5, 7b3db94, 6a46e9e)
- Lint (tsc --noEmit) clean
- 286 tests pass across 31 test files

---
*Phase: 08-knowledge-base-memory-minisearch-notes*
*Completed: 2026-09-01*
