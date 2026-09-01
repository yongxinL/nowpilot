---
phase: 08-knowledge-base-memory-minisearch-notes
plan: 03
subsystem: search
tags: [minisearch, wikilink, notes, full-text-search, link-parser]

requires:
  - phase: 08-knowledge-base-memory-minisearch-notes/08-01
    provides: canonical Note type (src/types/notes.ts), NotesDB with byTitle/byUpdated indexes
  - phase: 08-knowledge-base-memory-minisearch-notes/08-02
    provides: memory subsystem (MemoryEngine, stores, WriteJournal)
provides:
  - MiniSearchIndex — lazy/memoized per-surface notes index (D-109)
  - LinkParser — wikilink parse/resolve with WIKI-ID-02 tie-break (D-110)
  - save.ts — Flow-3-minus-LLM save seam (parse -> resolve -> put -> emit)
  - note:saved typed event (NOTE_SAVED_EVENT + NoteSavedPayload)
affects: [08-04, 08-05, 08-06]

actuals:
  tokens: 53000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Lazy/memoized MiniSearch singleton over NotesDB (mirrors PageIndexBuilder)"
    - "Pure-function LinkParser with getAllFromIndex + explicit sort tie-break"
    - "Typed event constant in notes module (EventBus.ts untouched)"

key-files:
  created:
    - src/core/notes/LinkParser.ts
    - src/core/notes/save.ts
    - src/core/search/MiniSearchIndex.ts
    - tests/core/notes/LinkParser.test.ts
    - tests/core/search/MiniSearchIndex.test.ts
  modified: []

key-decisions:
  - "MiniSearch 7.2.0 has no upsert — using add for new docs, replace for updates"
  - "demoteDangling takes idToTitle map to recover raw title strings on demotion"

patterns-established:
  - "note:saved subscription wired at module load, re-invocable via __test__.reset"
  - "WIKI-ID-02 tie-break: getAllFromIndex + exact-title filter + updated-desc-then-id-asc sort"

requirements-completed: []

duration: 16min
completed: 2026-09-01
status: complete
---

# Phase 8 Plan 3: Notes Core (MiniSearchIndex + LinkParser + save.ts) Summary

**Wikilink save-path core (LinkParser + save.ts) and the lazy/memoized per-surface MiniSearchIndex with <50ms/1,000-notes perf gate**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-01T04:40:57Z
- **Completed:** 2026-09-01T04:57:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- LinkParser (D-110): parseLinks extracts [[Title]] targets (deduped, trimmed); resolveLinks applies WIKI-ID-02 tie-break via getAllFromIndex + exact-title filter + updated-desc-then-id-asc sort (never getNoteByTitle); demoteDangling handles WIKI-ID-04 without rewriting bodies
- save.ts (D-110): NOTE_SAVED_EVENT typed constant + NoteSavedPayload; saveNote runs parse -> resolve -> NotesDB.put -> emit note:saved (Flow 3 minus LLM)
- MiniSearchIndex (D-109): lazy/memoized per-surface notes index with spec-1608 fields, stored `updated` (the 08-04 tie-break key), incremental note:saved upsert, remove via discard, <50ms/1,000-notes perf gate asserted, zero-storage-import posture

## Task Commits

Each task was committed atomically:

1. **Task 1: TRACER — save-path core (LinkParser + save.ts)** - `73b7245` (feat)
2. **Task 2: MiniSearchIndex — persistent per-surface notes index** - `0a51ae4` (feat)

## Files Created/Modified
- `src/core/notes/LinkParser.ts` - WIKILINK_RE, parseLinks, resolveLinks (WIKI-ID-02 tie-break), demoteDangling (WIKI-ID-04)
- `src/core/notes/save.ts` - NOTE_SAVED_EVENT, NoteSavedPayload, saveNote (Flow-3-minus-LLM seam)
- `src/core/search/MiniSearchIndex.ts` - lazy/memoized MiniSearch wrapper, note:saved subscription, __test__ seam
- `tests/core/notes/LinkParser.test.ts` - 14 tests: extraction, tie-break, exact-title, unresolvedLinks, demotion, saveNote
- `tests/core/search/MiniSearchIndex.test.ts` - 10 tests: lazy build, fields, stored updated, upsert, remove, perf gate, zero-storage

## Decisions Made
- MiniSearch 7.2.0 has no `upsert` method — using `add` for new documents and `replace` for updates (which internally discards the old version and adds the new one by ID)
- `demoteDangling` takes an `idToTitle` map parameter so demoted edges recover their original raw title string (rather than keeping the dangling ID)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MiniSearch 7.2.0 lacks upsert method**
- **Found during:** Task 2 (MiniSearchIndex implementation)
- **Issue:** Plan specified `index.upsert(noteToDoc(note))` but MiniSearch 7.2.0 has no `upsert` method (API: add/addAll/remove/discard/replace)
- **Fix:** Used `add` for new documents and `replace` for updates (replace internally discards old + adds new by ID)
- **Files modified:** src/core/search/MiniSearchIndex.ts
- **Verification:** All 10 MiniSearchIndex tests pass, including the upsert test
- **Committed in:** 0a51ae4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal — the upsert/replace distinction is internal to the index; the public behavior (incremental add without rebuild) is identical.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MiniSearchIndex + save.ts seam is ready for plan 08-04 (search UI components) and plan 08-05 (E2E)
- The note:saved subscription is wired and re-invocable via __test__.reset
- LinkParser tie-break is proven and ready for the NoteGraph backlinks in later plans

## Self-Check: PASSED

- All 5 created files exist on disk
- Commit 73b7245 (Task 1) found in git log
- Commit 0a51ae4 (Task 2) found in git log
- All 24 tests pass (14 LinkParser + 10 MiniSearchIndex)
- All grep guards pass (0 NP-STRICT, 0 chrome.storage, 0 getNoteByTitle, EventBus.ts untouched)

---
*Phase: 08-knowledge-base-memory-minisearch-notes*
*Completed: 2026-09-01*
