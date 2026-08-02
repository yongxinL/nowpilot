---
phase: 05a-llm-wiki-filesystem-sync
plan: 02
subsystem: notes
tags: [rag, llm, minisearch, memory, structured-output, zod]

# Dependency graph
requires:
  - phase: 05
    provides: NotesDB, NoteGraph, MiniSearchNoteIndex, MemoryEngine, EventBus, NoteProvenanceSchema
  - phase: 05a-01
    provides: LlmService facade, NoteSchema 5a fields (NoteQAResultSchema, NoteDraftSchema), NoteTagger
provides:
  - NoteQA — RAG Q&A (ask/search modes, numbered citations, tiny-tier fallback)
  - NoteChatConverter — chat/page → pre-filled NoteDraft (haiku + MEM-03 context)
  - NoteMaintenance — passive staleness/orphan queries + reanalyzeAll
affects: [phase 07, verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level singleton (MemoryEngine pattern) for request-response LLM services"
    - "NoteGraph static-instance singleton for passive query service"

key-files:
  created:
    - src/core/notes/NoteQA.ts
    - src/core/notes/NoteChatConverter.ts
    - src/core/notes/NoteMaintenance.ts
    - tests/core/notes/NoteQA.test.ts
    - tests/core/notes/NoteChatConverter.test.ts
    - tests/core/notes/NoteMaintenance.test.ts
  modified: []

key-decisions:
  - "NoteQA ask mode maps 'FLASH tier' (plan/SPEC terminology) to ModelTier BALANCED — the codebase ModelTier union is FAST|BALANCED|ADVANCED with no FLASH member"
  - "Tiny model tier (D-16) implemented via NoteQaTier = ModelTier | 'TINY' — the ModelContextTier union (tiny/small/medium/large) is for MemoryEngine retrieve(), not LLM calls"
  - "NoteChatConverter memory context uses MemoryEngine.retrieve() + item join — the SPEC's MemoryEngine.assemble() method does not exist in the codebase (documented gap, MEM-03 intent preserved)"
  - "Marker-derived citations are authoritative; the LLM citations array is validated + deduplicated only when the answer has no inline markers"
  - "NoteSearchResult has no title — snippet titles for the prompt preamble and citations are resolved from NotesDB"
  - "reanalyzeAll counts NoteTagger.analyze() returning null as failed (analyze() never throws — fire-and-forget contract)"

requirements-completed: [NOTE-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "NoteQA ask mode — RAG synthesis with numbered citations mapping [N] to source notes"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#returns cited answer with correct citations"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#retrieves top-5 MiniSearch snippets"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#injects MemoryEngine context"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#returns couldn't find answer when no snippets are relevant"
        status: pass
    human_judgment: false
  - id: D2
    description: "NoteQA search mode — haiku rerank of top-10 with BM25 fallback on LLM failure"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#reranks top-10 via haiku"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#falls back to BM25 order on LLM failure"
        status: pass
    human_judgment: false
  - id: D3
    description: "NoteQA tiny model tier — raw MiniSearch + MemoryEngine results, no LLM call"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#tiny model tier (D-16)"
        status: pass
    human_judgment: false
  - id: D4
    description: "parseCitations — range validation and deduplication of [N] markers"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#parseCitations"
        status: pass
    human_judgment: false
  - id: D5
    description: "NoteChatConverter — NoteDraft (title/content/tags/categoryPath/wikilinks) via haiku + MemoryEngine context"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteChatConverter.test.ts#returns NoteDraft with title, content, tags, categoryPath, wikilinks"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteChatConverter.test.ts#includes MemoryEngine retrieve() context (MEM-03)"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteChatConverter.test.ts#formats chat messages with [N] prefixes"
        status: pass
    human_judgment: false
  - id: D6
    description: "NoteMaintenance — getStaleNotes, getOrphanNotes, reanalyzeAll with success/fail counts and note:enriched emission"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteMaintenance.test.ts#getStaleNotes"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteMaintenance.test.ts#getOrphanNotes"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteMaintenance.test.ts#reanalyzeAll"
        status: pass
    human_judgment: false
  - id: D7
    description: "Chat-draft provenance 'chat-conversion' on user save — Phase 7 UI scope per D-20 (NoteProvenanceSchema already accepts the value)"
    requirement: NOTE-02
    verification: []
    human_judgment: true
    rationale: "The save path is UI-driven (Phase 7 scope). Schema accepts 'chat-conversion'; end-to-end save flow requires the UI."

# Metrics
duration: 24min
completed: 2026-08-02
status: complete
---

# Phase 05a Plan 2: NoteQA + NoteChatConverter + NoteMaintenance Summary

**RAG Q&A with validated numbered citations, chat→draft conversion with MEM-03 memory context, and passive staleness/orphan maintenance queries — all three NOTE-02 user-facing services on the Plan 1 foundation**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-02T04:08:00Z
- **Completed:** 2026-08-02T04:32:00Z
- **Tasks:** 2
- **Files modified:** 6 (3 source, 3 test)

## Accomplishments
- NoteQA with dual modes: ask (MiniSearch top-5 + MemoryEngine facts → BALANCED-tier synthesis with `[1]..[N]` markers parsed into validated Citation[]) and search (top-10 → haiku rerank with BM25 fallback)
- Tiny model tier (D-16): both modes return raw results with noteId links, zero LLM calls
- NoteChatConverter: single haiku-tier structured call producing NoteDraft with all fields, user-fact context via MemoryEngine retrieve(), [N]-prefixed chat messages + optional source URL
- NoteMaintenance: getStaleNotes (enrichment-timestamp staleness + 60s grace for never-enriched notes), getOrphanNotes (0 wikilinks + 0 backlinks), reanalyzeAll (sequential, {total, enriched, failed}, note:enriched per success)
- Empty-question guard: no MiniSearch/LLM calls on empty input

## Task Commits

Each task was committed atomically:

1. **Task 1: NoteQA — RAG Q&A with search/ask modes, numbered citations, tiny-tier fallback** - `f0bd21a` (feat)
2. **Task 2: NoteChatConverter + NoteMaintenance** - `76c39c7` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/core/notes/NoteQA.ts` - RAG Q&A service: query() entry (ask/search/tiny), parseCitations export, self-contained prompt assembly (D-14)
- `src/core/notes/NoteChatConverter.ts` - chat/page → NoteDraft via haiku + memory context
- `src/core/notes/NoteMaintenance.ts` - getStaleNotes/getOrphanNotes/reanalyzeAll
- `tests/core/notes/NoteQA.test.ts` - 11 tests
- `tests/core/notes/NoteChatConverter.test.ts` - 5 tests
- `tests/core/notes/NoteMaintenance.test.ts` - 10 tests

## Decisions Made
- FLASH-tier terminology from SPEC/CONTEXT maps to ModelTier `BALANCED` (no FLASH member exists in the codebase union)
- Tiny tier surfaced as `NoteQaTier = ModelTier | 'TINY'` on the query params — matches D-16 without touching the shared ModelTier union
- MEM-03 context assembled from `MemoryEngine.retrieve()` items (the SPEC'd `assemble()` method does not exist in MemoryEngine; retrieve + join is the in-codebase analog)
- Marker-derived citations are authoritative; LLM-supplied citations used only when answer text has no markers, then range-validated and deduplicated
- Snippet titles resolved from NotesDB since NoteSearchResult carries no title field
- reanalyzeAll treats null from NoteTagger.analyze() as failure (analyze never throws)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MemoryEngine.assemble() does not exist in codebase**
- **Found during:** Task 2 (NoteChatConverter implementation)
- **Issue:** Plan/SPEC (D-20, MEM-03) calls `getMemoryEngine().assemble()` for draft context — MemoryEngine only exposes `retrieve()` returning ContextItem[].
- **Fix:** NoteChatConverter calls `retrieve()` and joins item texts into the context block. MEM-03 intent (user facts/preferences context in drafts) preserved.
- **Files modified:** src/core/notes/NoteChatConverter.ts
- **Verification:** 'includes MemoryEngine retrieve() context (MEM-03)' test passes
- **Committed in:** 76c39c7 (Task 2 commit)

**2. [Rule 3 - Blocking] ModelTier has no FLASH or TINY members**
- **Found during:** Task 1 (NoteQA implementation)
- **Issue:** Plan specifies FLASH tier for ask mode and `tier === 'TINY'` checks; the shared ModelTier union is FAST|BALANCED|ADVANCED.
- **Fix:** Ask mode uses BALANCED (flash-class tier in provider tables); new exported `NoteQaTier = ModelTier | 'TINY'` for the tiny-mode branch. Shared types untouched — zero ripple to providers/TierResolver.
- **Files modified:** src/core/notes/NoteQA.ts
- **Verification:** tiny-tier tests assert no LLM call; ask-mode test asserts BALANCED tier
- **Committed in:** f0bd21a (Task 1 commit)

**3. [Rule 3 - Blocking] MemoryEngine.retrieve() signature differs from plan**
- **Found during:** Task 1 (NoteQA implementation)
- **Issue:** Plan: `retrieve({ query, tier: 'FAST', maxItems: 3 })`. Actual: `retrieve({ conversationId, query, tier: 'tiny'|'small'|'medium'|'large' })` — no maxItems, no model tiers, conversationId required.
- **Fix:** Call with placeholder conversationId, 'medium' context tier, slice(0, 3) for the D-14 budget.
- **Files modified:** src/core/notes/NoteQA.ts, src/core/notes/NoteChatConverter.ts
- **Verification:** context-injection tests pass
- **Committed in:** f0bd21a, 76c39c7

**4. [Rule 3 - Missing Critical] NoteSearchResult carries no title**
- **Found during:** Task 1 (NoteQA implementation)
- **Issue:** The prompt preamble and Citation require titles; MiniSearch results only have noteId/score/matchedFields/snippet.
- **Fix:** resolveSnippetTitles() reads titles from NotesDB for the top-N results.
- **Files modified:** src/core/notes/NoteQA.ts
- **Verification:** citation title assertions pass
- **Committed in:** f0bd21a

**5. [Rule 3 - Blocking] NotesDB.save() clobbers timestamps and re-derives links**
- **Found during:** Task 2 (NoteMaintenance tests)
- **Issue:** Tests seeded notes via save() — updatedAt is overwritten to Date.now() and links[] are re-derived from content, so staleness/orphan fixtures were destroyed.
- **Fix:** Tests seed via notesDb.restore() (raw put) for exact field control.
- **Files modified:** tests/core/notes/NoteMaintenance.test.ts
- **Verification:** all 10 NoteMaintenance tests pass
- **Committed in:** 76c39c7

**6. [Rule 3 - Blocking] Plan's LLM-failure semantics for reanalyzeAll mismatch NoteTagger**
- **Found during:** Task 2 (NoteMaintenance implementation)
- **Issue:** Plan: "LLM call threw, silently caught". NoteTagger.analyze() never throws — returns null on failure (fire-and-forget contract).
- **Fix:** Count null as failed; still satisfies must_have {total, enriched, failed}.
- **Files modified:** src/core/notes/NoteMaintenance.ts
- **Verification:** success/fail count test passes
- **Committed in:** 76c39c7

---

**Total deviations:** 6 auto-fixed (6 Rule 3)
**Impact on plan:** All deviations adapt to the real codebase API surface without changing plan intent. Shared types untouched. No scope creep.

## Issues Encountered
- Executor subagent returned empty twice for this plan (no commits, no files, no error) — orchestrated inline execution fallback used instead. No code impact.
- 05a-02 plan written against idealized APIs (assemble(), FLASH/TINY tiers) — root cause of deviations 1-3; documented for future planner awareness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- NOTE-02 services complete; ready for 05a-03 (NoteFileSync — NOTE-03) and Phase 7 UI wiring (draft editor, citation rendering, maintenance badges)
- Phase verification will check NOTE-02 requirements against actual behavior
- MemoryEngine.assemble() gap noted — if MEM-03 wants a dedicated method, it should be added to MemoryEngine itself (out of scope here)

---
*Phase: 05a-llm-wiki-filesystem-sync*
*Completed: 2026-08-02*
