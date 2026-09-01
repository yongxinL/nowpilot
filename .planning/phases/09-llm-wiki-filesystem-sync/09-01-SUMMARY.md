---
phase: 09-llm-wiki-filesystem-sync
plan: 01
subsystem: notes, memory, storage
tags: [llm, wiki, filesystem, sync, yaml, zod, idb, structured-output]

requires:
  - phase: 08-knowledge-base-memory-minisearch-notes
    provides: Note spine (notes.ts + NotesDB), MemoryEngine, MemoryExtractor, save.ts seam, EventBus
provides:
  - NoteTagger service (LLM enrichment: tags + category + summary + memory facts)
  - Shared Zod schemas (NoteTagResult, NoteQAResult, NoteDraft) + gateSuggestions
  - v4 IDB migration (notes_backup_config store + Note.type population)
  - MemoryEngine.assemble() (NMEM-03 memory context contract)
  - MemoryEngine.upsert() (NMEM-02 fact persistence)
  - normalizeCategoryPath() (CAT-01/05)
affects: [phase-10-memory-governance, phase-15-workspace-ui, phase-09-plan-02]

actuals:
  tokens: 85000
  tasks: 3
  commits: 4

tech-stack:
  added: [yaml@^2.9.0, @types/wicg-file-system-access@^2023.10.7]
  patterns:
    - "StructuredOutput.requestJson for single fast-tier temp-0 LLM structured JSON calls"
    - "gateSuggestions() for confidence threshold + per-save cap enforcement"
    - "IndexedDBMigrator.registerMigration for conditional idempotent DB migrations"
    - "Post-open data population (Note.type) deferred from versionchange transaction"

key-files:
  created:
    - src/core/notes/NoteTagger.ts
    - src/core/notes/schemas.ts
    - tests/core/notes/NoteTagger.test.ts
    - tests/core/notes/schemas.test.ts
    - tests/core/storage/migrations/v4-notes-backup-config.test.ts
  modified:
    - src/core/storage/NotesDB.ts
    - src/core/memory/MemoryEngine.ts
    - src/types/notes.ts
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Note.type population deferred to post-open (populateNoteTypeDefaults) — versionchange transaction cannot open readwrite transactions on existing stores"
  - "MemoryEngine.upsert transforms NoteTagger memoryFacts ({content, confidence}) to canonical UserMemoryFact shape with source='inferred'"
  - "NoteTagger.analyze uses ProviderRegistry.getById to resolve the ILLMProvider instance for the callProviderJsonMode callback"

patterns-established:
  - "LLM enrichment via StructuredOutput.requestJson with Zod schema validation"
  - "Non-blocking post-save pipeline: EventBus → analyze → stale-guard → gate → emit"
  - "Confidence-based suggestion gating with configurable thresholds and caps"

requirements-completed: [LLM-WIKI-01, LLM-WIKI-11, NMEM-02, CAT-01, CAT-05, WIKI-ID-01, OKF-WIKI-01, SYNC-01]

coverage:
  - id: D1
    description: "NoteTagger.analyze() makes single fast-tier temp-0 structured JSON call returning NoteTagResult"
    requirement: LLM-WIKI-01
    verification:
      - kind: unit
        ref: tests/core/notes/NoteTagger.test.ts#NoteTagger.analyze (LLM-WIKI-01)
        status: pass
    human_judgment: false
  - id: D2
    description: "gateSuggestions() enforces 0.60 threshold + 5 tags/3 facts cap (LLM-WIKI-11)"
    requirement: LLM-WIKI-11
    verification:
      - kind: unit
        ref: tests/core/notes/schemas.test.ts#gateSuggestions (LLM-WIKI-11)
        status: pass
    human_judgment: false
  - id: D3
    description: "v4 migration creates notes_backup_config store idempotently + populates Note.type (SYNC-01, D-125)"
    requirement: SYNC-01
    verification:
      - kind: unit
        ref: tests/core/storage/migrations/v4-notes-backup-config.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: "NMEM-02 memoryFacts routed through MemoryEngine.upsert on primary surface only"
    requirement: NMEM-02
    verification:
      - kind: unit
        ref: tests/core/notes/NoteTagger.test.ts#NoteTagger NMEM-02 memory-fact routing
        status: pass
    human_judgment: false
  - id: D5
    description: "normalizeCategoryPath() strips/collapses/trims/rejects segments (CAT-01/05)"
    requirement: CAT-01
    verification:
      - kind: unit
        ref: tests/core/notes/schemas.test.ts#normalizeCategoryPath (CAT-01/05)
        status: pass
    human_judgment: false
  - id: D6
    description: "MemoryEngine.assemble() returns compact memory context string (NMEM-03)"
    requirement: NMEM-03
    verification:
      - kind: unit
        ref: tests/core/notes/NoteTagger.test.ts (integration via MemoryEngine mock)
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-01
status: complete
---

# Phase 9 Plan 01: LLM Enrichment Spine Summary

**NoteTagger service with single fast-tier structured JSON call, confidence gating, v4 IDB migration, and MemoryEngine.assemble/upsert — all proven by tests**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-01T10:31:37Z
- **Completed:** 2026-09-01T10:57:44Z
- **Tasks:** 3 (1 checkpoint + 2 auto)
- **Files modified:** 8

## Accomplishments
- Installed yaml@^2.9.0 (OKF frontmatter) + @types/wicg-file-system-access@^2023.10.7 (FS Access API types)
- Created NoteTagger service: single fast-tier temp-0 structured JSON call via StructuredOutput (D-115)
- Implemented non-blocking post-save pipeline with stale-guard (version check) and confidence gating
- Created shared Zod schemas (NoteTagResult, NoteQAResult, NoteDraft) + gateSuggestions + normalizeCategoryPath
- Bumped NotesDB to v4 with notes_backup_config store (SYNC-01) and Note.type population (D-125)
- Added MemoryEngine.assemble() (NMEM-03) and MemoryEngine.upsert() (NMEM-02)
- All 779 tests green (86 test files), zero new NP-STRICT markers

## Task Commits

Each task was committed atomically:

1. **Task 1: Checkpoint (package legitimacy)** - APPROVED (pre-execution)
2. **Task 2: Install packages + v4 migration + schemas** - `9ff3eb0` (feat)
3. **Task 3 RED: NoteTagger failing tests** - `d72b96d` (test)
4. **Task 3 GREEN: NoteTagger implementation** - `7b7e4bd` (feat)

## Files Created/Modified
- `src/core/notes/NoteTagger.ts` - LLM enrichment facade (analyze, handleNoteSaved, init)
- `src/core/notes/schemas.ts` - Zod schemas + gateSuggestions + normalizeCategoryPath
- `src/core/storage/NotesDB.ts` - v4 migration, notes_backup_config store, populateNoteTypeDefaults
- `src/core/memory/MemoryEngine.ts` - assemble() + upsert() methods
- `src/types/notes.ts` - suggestion constants + OkfNoteFrontmatter fields + OkfFrontmatter alias
- `tests/core/notes/NoteTagger.test.ts` - LLM-WIKI-01/11, NMEM-02, CAT-01 tests
- `tests/core/notes/schemas.test.ts` - gateSuggestions + normalizeCategoryPath tests
- `tests/core/storage/migrations/v4-notes-backup-config.test.ts` - v4 idempotency tests
- `package.json` + `pnpm-lock.yaml` - yaml + @types/wicg-file-system-access

## Decisions Made
- Note.type population deferred to post-open (populateNoteTypeDefaults) — versionchange transaction cannot open readwrite transactions on existing stores
- MemoryEngine.upsert transforms NoteTagger memoryFacts ({content, confidence}) to canonical UserMemoryFact shape with source='inferred'
- NoteTagger.analyze uses ProviderRegistry.getById to resolve the ILLMProvider instance for the callProviderJsonMode callback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Note.type population moved outside versionchange transaction**
- **Found during:** Task 2 (v4 migration implementation)
- **Issue:** IndexedDB's versionchange transaction does not permit opening a new readwrite transaction on existing stores — `db.transaction()` throws InvalidStateError
- **Fix:** Split into two parts: migration creates the store (allowed in versionchange), populateNoteTypeDefaults() runs after openNotesDB() returns
- **Files modified:** src/core/storage/NotesDB.ts
- **Verification:** v4 migration test passes (idempotent open twice)
- **Committed in:** 9ff3eb0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness. The migration framework's versionchange context cannot open nested transactions. No scope creep.

## Issues Encountered
None — the auto-fix was the only deviation and it was necessary for correctness.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — all implemented functions are fully wired with real data sources.

## Threat Flags
None — all threat mitigations from the plan's threat model are implemented:
- T-P9-01: NoteTagResultSchema via StructuredOutput (Zod validation)
- T-P9-02: Note content passed as data, not system instruction
- T-P9-03: MemoryFacts validated by MemoryExtractor schema before MemoryEngine.upsert
- T-P9-04: Version-check stale guard in NoteTagger.processNoteSaved
- T-P9-SC: Package-legitimate gate cleared (yaml@2.9.0, @types/wicg-file-system-access@2023.10.7)

## Next Phase Readiness
- NoteTagger service ready for Plan 02 (NoteQA, NoteChatConverter)
- MemoryEngine.assemble() ready for NMEM-03 consumption by NoteChatConverter
- v4 migration provides notes_backup_config store for NoteFileSync (Plan 03+)
- Schemas shared across all downstream LLM services

---
*Phase: 09-llm-wiki-filesystem-sync*
*Completed: 2026-09-01*
