---
phase: 05-persistent-memory-architecture
plan: 04
subsystem: memory
tags: [conversation-memory, user-facts, minisearch, two-pass-retrieval, conflict-resolution, tdd]
requires:
  - phase: 05-02
    provides: MemoryDB extended with v2 fields (memory_messages, memory_userFacts, memory_summaries)
  - phase: 05-03
    provides: MiniSearchIndex, MemoryScorer (5-factor scoring), conflictResolver (D-16/D-17)
provides:
  - ConversationMemoryStore with tier-based turn counts (2/4/6), rolling cumulative summaries, conversation archiving
  - UserMemoryStore with two-pass MiniSearch→5-factor retrieval, versioned fact CRUD with conflict resolution, MiniSearch index synchronization
affects:
  - Phase 05-05 (PreferenceMemoryStore, MemoryExtractor)
  - Phase 05-06 (MemoryEngine — consumes both stores)
tech-stack:
  added: []
  patterns:
    - TDD RED→GREEN per task (2 plans × 2 commits each = 4 commits)
    - Class+singleton + try/catch + debugLog (matching MemoryDB/PromptCacheManager pattern)
    - vi.hoisted() + vi.mock() pattern for test mocking (matching domainStores.test.ts)
key-files:
  created:
    - src/core/memory/ConversationMemoryStore.ts (106 lines)
    - src/core/memory/UserMemoryStore.ts (170 lines)
  modified:
    - src/core/storage/stores/MemoryDB.ts — added getAllSummaries() method
    - src/core/search/MiniSearchIndex.ts — added 'status' to storeFields
    - tests/core/memory/ConversationMemoryStore.test.ts — replaced scaffold with 12 real tests
    - tests/core/memory/UserMemoryStore.test.ts — replaced scaffold with 10 real tests
key-decisions:
  - "ConversationMemoryStore.getContext returns individual messages (not pairs) with tier-based counts: tiny=4 (2 turns × 2), small=8 (4×2), medium/large=12 (6×2)"
  - "UserMemoryStore.search filters superseded facts from MiniSearch candidates before scoring — 'status' added to MiniSearchIndex storeFields for search-result filtering"
  - "MemoryDB.getAllSummaries added for getActiveCount/getArchivedCount summary scanning"
  - "normalizeFact() helper used to bridge MemoryDB's optional v2 fields with UserMemoryFact's required schema"
requirements-completed:
  - MEM-01
  - MEM-02
coverage:
  - id: D1
    description: "ConversationMemoryStore.getContext returns tier-capped recent turns + summary; excludes archived conversations"
    requirement: MEM-01
    verification:
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#getContext"
        status: pass
    human_judgment: false
  - id: D2
    description: "ConversationMemoryStore.summarize merges cumulatively (D-19) or creates new summary; sets state=active"
    requirement: MEM-01
    verification:
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#summarize"
        status: pass
    human_judgment: false
  - id: D3
    description: "ConversationMemoryStore.archive sets state=archived with archivedAt timestamp"
    requirement: MEM-01
    verification:
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#archive"
        status: pass
    human_judgment: false
  - id: D4
    description: "ConversationMemoryStore.getActiveCount/getArchivedCount filter by state"
    requirement: MEM-01
    verification:
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#getActiveCount / getArchivedCount"
        status: pass
    human_judgment: false
  - id: D5
    description: "UserMemoryStore.search two-pass MiniSearch→5-factor scoring, top-3 (tiny) or top-5 (rest)"
    requirement: MEM-02
    verification:
      - kind: unit
        ref: "tests/core/memory/UserMemoryStore.test.ts#search"
        status: pass
    human_judgment: false
  - id: D6
    description: "UserMemoryStore.upsert validates via Zod, resolves conflicts via conflictResolver, syncs MiniSearch"
    requirement: MEM-02
    verification:
      - kind: unit
        ref: "tests/core/memory/UserMemoryStore.test.ts#upsert"
        status: pass
    human_judgment: false
  - id: D7
    description: "UserMemoryStore.rebuildIndex rebuilds MiniSearch from active facts; called on construction"
    requirement: MEM-02
    verification:
      - kind: unit
        ref: "tests/core/memory/UserMemoryStore.test.ts#rebuildIndex"
        status: pass
    human_judgment: false
  - id: D8
    description: "UserMemoryStore.getFact retrieves fact by ID"
    requirement: MEM-02
    verification:
      - kind: unit
        ref: "tests/core/memory/UserMemoryStore.test.ts#getFact"
        status: pass
    human_judgment: false
duration: ~7 min
completed: 2026-07-13
status: complete
---

# Phase 05 Plan 04: ConversationMemoryStore + UserMemoryStore

**ConversationMemoryStore (tier-based turns, rolling cumulative summaries, archiving) and UserMemoryStore (two-pass MiniSearch→5-factor retrieval, versioned fact CRUD with conflict resolution, MiniSearch index synchronization) — both built TDD-style with 22 passing tests**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-13T01:30:36Z
- **Completed:** 2026-07-13T01:37:18Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6

## Accomplishments

- ConversationMemoryStore with `getContext(conversationId, tier)` returning tier-based recent turns (2/4/6 = 4/8/12 messages) + optional summary, excluding archived conversations
- `summarize()` rolling cumulative merge per D-19 — appends new LLM summary with `\n---\n` separator, tracks messageCount
- `archive()` state transition to 'archived' with `archivedAt` timestamp
- `getActiveCount()` / `getArchivedCount()` summary scanning via MemoryDB.getAllSummaries
- UserMemoryStore with `search(query, tier)` two-pass retrieval: MiniSearch narrows to top-20, MemoryScorer 5-factor scores to top-3 (tiny) / top-5 (rest)
- `upsert()` validates via `userMemoryFactSchema.parse()`, resolves conflicts via `conflictResolver.resolve()`, syncs MiniSearch index via `replaceFact`
- `rebuildIndex()` loads active facts from MemoryDB, calls `miniSearchIndex.rebuild()` — called on construction
- `getFact()` / `evictFact()` for single-fact retrieval and cap/pruning enforcement
- `status` added to MiniSearchIndex storeFields for search-result status filtering
- `normalizeFact()` helper bridges MemoryDB's optional v2 fields with `UserMemoryFact`'s required Zod schema
- MemoryDB.getAllSummaries added for summary scanning
- All 22 tests pass across both test files; TypeScript compiles without new errors

## Task Commits

Each task was committed atomically following TDD RED→GREEN cycle:

1. **Task 1 (TDD RED): ConversationMemoryStore failing tests** — `f9ca415` (test)
2. **Task 1 (TDD GREEN): ConversationMemoryStore implementation** — `1e43a89` (feat)
3. **Task 2 (TDD RED): UserMemoryStore failing tests** — `993ced0` (test)
4. **Task 2 (TDD GREEN): UserMemoryStore implementation** — `36b5ce4` (feat)

## Files Created/Modified

- `src/core/memory/ConversationMemoryStore.ts` (106 lines) — Class with getContext, summarize, archive, getActiveCount, getArchivedCount; singleton export
- `src/core/memory/UserMemoryStore.ts` (170 lines) — Class with search, upsert, getFact, rebuildIndex, evictFact; normalizeFact helper; singleton export
- `src/core/storage/stores/MemoryDB.ts` — Added `getAllSummaries()` method
- `src/core/search/MiniSearchIndex.ts` — Added `'status'` to storeFields array
- `tests/core/memory/ConversationMemoryStore.test.ts` (229 lines, 12 tests) — Replaced scaffold with full test suite
- `tests/core/memory/UserMemoryStore.test.ts` (260 lines, 10 tests) — Replaced scaffold with full test suite

## Decisions Made

- ConversationMemoryStore.getContext returns individual message {role, content} entries, not aggregated pairs — the tier turn count (2/4/6) represents user+assistant turn pairs, so the actual message count is 2x the tier value
- UserMemoryStore.search filters superseded facts from MiniSearch candidates before scoring — added `'status'` to MiniSearchIndex storeFields so status is available in search results
- normalizeFact() helper used to bridge MemoryDB's optional v2 fields (status?, tags?, useCount?, lastUsedAt?) with UserMemoryFact's required Zod schema — ensures type safety without changing MemoryDB return types
- MemoryDB.getAllSummaries added rather than direct getDB access — keeps the store wrapper pattern consistent and avoids mixing getDB calls outside MemoryDB

## Deviations from Plan

None - plan executed exactly as written. All 22 tests pass with 0 deviations.

## TDD Gate Compliance

- **RED Gate:** Present — `test(05-04)` commits exist: f9ca415, 993ced0
- **GREEN Gate:** Present — `feat(05-04)` commits exist: 1e43a89, 36b5ce4
- **REFACTOR:** Not needed — implementation clean and minimal for both tasks
- **Status:** All gates PASS

## Issues Encountered

- `IDBKeyRange` not available in jsdom test environment — MemoryDB.getMessages uses `IDBKeyRange.bound(...)` which throws ReferenceError. Fixed by stubbing `globalThis.IDBKeyRange` in vi.hoisted() block in both test files.
- TypeScript compatibility between MemoryDB's optional v2 fields and UserMemoryFact's required Zod schema — resolved by adding normalizeFact() helper with defaults.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ConversationMemoryStore ready for MemoryEngine.assemble() (P06) for context retrieval and MemoryEngine.extract() (P06) for summarization/archiving
- UserMemoryStore ready for MemoryEngine.assemble() (P06) for fact retrieval and MemoryEngine.extract() (P06) for fact upsert/cap enforcement
- Next plans: 05-05 (PreferenceMemoryStore + MemoryExtractor) and 05-06 (MemoryEngine)

## Self-Check

- [x] `src/core/memory/ConversationMemoryStore.ts` exists (106 lines)
- [x] `src/core/memory/UserMemoryStore.ts` exists (170 lines)
- [x] `tests/core/memory/ConversationMemoryStore.test.ts` exists (12 tests)
- [x] `tests/core/memory/UserMemoryStore.test.ts` exists (10 tests)
- [x] All 4 commits verified in git log
- [x] All 22 tests pass
- [x] TypeScript compiles with no new errors (pre-existing errors in AgentOrchestrator/RendererService/ChunkBuffer tests unchanged)
- [x] Exports match must_haves: ConversationMemoryStore, conversationMemoryStore, UserMemoryStore, userMemoryStore

---

*Phase: 05-persistent-memory-architecture*
*Completed: 2026-07-13*
