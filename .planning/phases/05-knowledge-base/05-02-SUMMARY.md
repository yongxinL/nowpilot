---
phase: 05-knowledge-base
plan: 02
subsystem: memory
tags: [memory, indexeddb, zod, writejournal, broadcastbus, tdd, scoring, lru]

# Dependency graph
requires:
  - phase: 02-storage-security-foundation
    provides: WriteJournal multi-store consistency protocol, WriteJournalOperation union, BroadcastBus pub/sub
  - phase: 05-knowledge-base (plan 01)
    provides: MigrationRunner v4 memory store schemas (memory_messages compound key, user_facts by-tag/by-confidence, conversation_summaries)
  - phase: 04b-trust-aware-context-receipts
    provides: ContextItem contract (relevance/freshness/trust/sensitivity/instructionAuthority), D-18 sourceId format
provides:
  - MemoryRecord/MemoryScorer pure-compute layer (D-07 CONFIDENCE_MAP, D-08 weighted scoring, D-09 tier-gating)
  - ConversationMemoryStore (tier-gated turns 4/8/12/12, 12-message compact signal, summary save, LRU eviction)
  - UserMemoryStore (immutable confidence from source, useCount ranking, by-tag index) + PreferenceMemoryStore (np_persona)
  - MemoryEngine singleton: ordered retrieval pipeline → ContextItem[], MEM-02 single-writer gate, D-05 AI write boundary, WriteJournal-wrapped writes, D-11 LRU tracking
affects: [05-03-integration, 05a-llm-wiki, 05b-memory-governance, 07-workspace-experience, phase-5b, phase-7]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level cached IndexedDB connection + exported reset{Store}Db() for test isolation (WriteJournal/NotesDB pattern) — one connection per store module, all sharing NotesDB v4"
    - "Public-constructor singleton + getX()/resetX() accessors (PageIndexBuilder/ContextOptimizer pattern) — MemoryEngine"
    - "Zod boundary validation on every store write (UserMemoryFactSchema/MemoryRecordSchema) with discriminated-union results, never thrown operational errors"
    - "Extract<WriteJournalOperation, ...> for store-write ops — single source of truth with the Phase 2 union"
    - "TDD per task: RED (test commit) → GREEN (feat commit) — 6 commits for 3 tasks"

key-files:
  created:
    - src/core/memory/MemoryRecord.ts
    - src/core/memory/types.ts
    - src/core/memory/MemoryScorer.ts
    - src/core/memory/ConversationMemoryStore.ts
    - src/core/memory/UserMemoryStore.ts
    - src/core/memory/PreferenceMemoryStore.ts
    - src/core/memory/MemoryEngine.ts
    - tests/core/memory/MemoryScorer.test.ts
    - tests/core/memory/UserMemoryStore.test.ts
    - tests/core/memory/ConversationMemoryStore.test.ts
    - tests/core/memory/MemoryEngine.test.ts
  modified:
    - src/core/storage/WriteJournal.ts

key-decisions:
  - "Preference item in retrieve() is a single compact JSON ContextItem with sourceId 'memory.preference' (Task 3 action step 3) — the behavior test's 'memory.preference.{key}' pattern is satisfied as a prefix; per-key items would multiply token overhead for no retrieval gain"
  - "MemoryEngine constructor is public (not private as the artifacts table said) — TS forbids module-level `new` on private constructors; matches the ContextOptimizer/PageIndexBuilder pattern the plan itself cites. isPrimarySurface() also public so tests can flip it via spyOn"
  - "MemoryWriteInput also omits createdAt/updatedAt (upsert derives timestamps) — the plan's literal type required them but every behavior test calls write() without them"
  - "MemoryStoreWriteOp = Extract<WriteJournalOperation, 'update-user-memory'|'write-preference'|'compact-conversation'> and 'write-preference' ADDED to the Phase 2 union — the plan assumed it already existed there ('matching WriteJournalOperation union from Phase 2')"
  - "MemoryEngine.write() routes semantic records to UserMemoryStore.upsert (per plan step 4); non-semantic writes surface as failed journal steps (JOURNAL_ERROR) rather than silent success — preference writes go through PreferenceMemoryStore.set, conversation summaries through ConversationMemoryStore.saveSummary (Plan 03)"
  - "Token counts on ContextItem use tokenBudget.estimateTokens() — the canonical estimation service (Phase 4 D-09 prohibits inlined counting)"
  - "UserMemoryStore.getAll() returns all records in the shared store (preference records included per D-04 taxonomy); MemoryEngine filters memoryType==='semantic' before scoring so preference records never leak into D-09 fact tiering (D-06 store independence)"
  - "Test 12 corrected during GREEN: D-11 archives ALL conversations idle >30 min — at the +31min mark both conv-a and conv-b are archived (spec, not the implementation, was right)"

requirements-completed: [MEM-01, MEM-02]

# Coverage metadata — one entry per shipped deliverable
coverage:
  - id: D1
    description: "MemoryRecord Zod schemas + MemoryScorer pure-compute layer — D-07 CONFIDENCE_MAP (explicit-user=1.0, verified-state=0.8, previous-explicit=0.7, inferred=0.5), D-08 weighted scoring (35/25/20/10/10), D-09 tier-gating (tiny≤3, others≤5, MIN_SCORE 0.30), MemoryRecord/UserMemoryFact/ConversationSummary/Preference/RetrievedMemory/ConversationContext schemas"
    requirement: MEM-01
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryScorer.test.ts#scoreFact sub-scores + composite weight, getTopFacts tier-gating, schema validation"
        status: pass
    human_judgment: false
  - id: D2
    description: "Persistent stores over IndexedDB v4 — ConversationMemoryStore (tier-gated tails 4/8/12/12, 12-message compact signal, summary round-trip, evictConversation), UserMemoryStore (source→confidence mapping, immutable confidence, useCount ranking, by-tag index), PreferenceMemoryStore (np_persona, upsert-by-key)"
    requirement: MEM-01
    verification:
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#compact signal, tier counts, eviction"
        status: pass
      - kind: unit
        ref: "tests/core/memory/UserMemoryStore.test.ts#D-07 confidence mapping, incrementUseCount immutability, preference persistence"
        status: pass
    human_judgment: false
  - id: D3
    description: "MemoryEngine orchestrator — ordered retrieval (conversation → scored user facts → compact preferences) producing ContextItem[] with D-18 sourceIds and inherited sensitivity/trust; MEM-02 single-writer gate (NOT_PRIMARY_SURFACE before any mutation); D-05 AI write boundary (WRITE_BOUNDARY_VIOLATION); WriteJournal-wrapped writes with WORKSPACE_UPDATED broadcast; D-11 LRU (10 active / 100 archived / 30-min idle / oldest-first eviction)"
    requirement: MEM-02
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#retrieval ordering, tier-gating, write guards, journal op mapping, LRU eviction"
        status: pass
    human_judgment: false

# Metrics
duration: 33min
completed: 2026-08-02
status: complete
---

# Phase 05 Plan 2: Memory Foundation + Engine Summary

**Complete memory subsystem over IndexedDB v4: Zod MemoryRecord schemas, D-08 weighted MemoryScorer with D-09 tier-gating, three persistent stores (Conversation/User/Preference), and the MemoryEngine singleton — ordered ContextItem[] retrieval, MEM-02 single-writer enforcement, D-05 AI write boundary, WriteJournal crash consistency, and D-11 LRU conversation retention.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-08-01T21:42:55Z
- **Completed:** 2026-08-01T22:16:30Z
- **Tasks:** 3 (all TDD — 6 commits)
- **Files modified:** 12 (11 created, 1 modified)

## Accomplishments

- **MemoryRecord.ts** — Zod schemas for the full memory taxonomy (D-04): MemoryTypeSchema, ConfidenceSourceSchema, `CONFIDENCE_MAP` (D-07 trust-gate), MemoryRecordSchema (uuid id, confidence ∈ [0,1], immutable source), UserMemoryFactSchema (literal semantic), ConversationSummarySchema (messageRange), PreferenceRecordSchema, RetrievedMemorySchema, ConversationContextSchema
- **MemoryScorer.ts** — pure D-08 weighted functions: `WEIGHTS` (35/25/20/10/10), `MIN_SCORE` 0.30, `USE_COUNT_CAP` 20, `TIER_LIMITS` {tiny:3, small:5, medium:5, large:5}, tokenizeQuery (≥2-char terms), scoreFact (keyword/tag/recency/useCount/confidence sub-scores), getTopFacts (threshold filter → sort → top-K → RetrievedMemory with relevanceReasons)
- **ConversationMemoryStore** — appendMessage with auto-incrementing per-conversation seq + `{shouldCompact, messageCount}` signal at the D-10 12-message boundary; getContext returns summary + tier-gated tail (tiny=4, small=8, medium/large=12); saveSummary/getSummaries round-trip; evictConversation clears messages + summary (D-11)
- **UserMemoryStore** — upsert derives immutable confidence from the D-07 source mapping (update path preserves confidence/createdAt/useCount), validates at the UserMemoryFactSchema boundary (VALIDATION_ERROR), generates UUIDs; incrementUseCount touches only useCount + lastUsedAt; findByTag via the by-tag multiEntry index
- **PreferenceMemoryStore** — np_persona persona config as preference-type records (explicit-user, confidence 1.0) in the shared user_facts store; upsert-by-key, getAll as {key: value}, getPersona convenience
- **MemoryEngine** (singleton) — retrieve() pipeline: conversation summary+turns (relevance 1.0, sensitivity public/private) → D-08/D-09 scored user facts (trust=confidence, sensitivity inherited, 30-day freshness) → compact preference JSON (trust 1.0, relevance 0.5); write() with D-05 WRITE_BOUNDARY_VIOLATION guard, MEM-02 isPrimarySurface gate before ANY mutation, WriteJournal 'write-memory-record' + 'broadcast-workspace-update' steps, WORKSPACE_UPDATED publish, useCount increment; trackConversationActivity D-11 LRU (10 active / 100 archived / 30-min idle archive / oldest-first eviction); getPreferences/getPersona/getConversationStats
- **WriteJournal.ts** — added `'write-preference'` to WriteJournalOperation (the plan's types.ts spec required it and assumed it existed)
- 68 unit tests green across 4 memory suites; `pnpm tsc --noEmit` clean

## Task Commits

Each task was committed atomically with RED/GREEN TDD gates:

1. **Task 1: MemoryRecord schemas + MemoryScorer** — RED `28dd278` (test), GREEN `b2324fb` (feat)
2. **Task 2: Conversation/User/Preference stores** — RED `d4eb96d` (test), GREEN `7a332f1` (feat)
3. **Task 3: MemoryEngine orchestrator** — RED `7c996e5` (test), GREEN `e0b85a1` (feat)

**Plan metadata:** pending (committed after SUMMARY)

## Files Created/Modified

- `src/core/memory/MemoryRecord.ts` - All memory Zod schemas + CONFIDENCE_MAP (D-04/D-07)
- `src/core/memory/types.ts` - MemoryRetrievalResult/MemoryWriteResult unions, RetrievalOptions, MemoryStoreWriteOp
- `src/core/memory/MemoryScorer.ts` - WEIGHTS/MIN_SCORE/USE_COUNT_CAP/TIER_LIMITS, tokenizeQuery, scoreFact, getTopFacts
- `src/core/memory/ConversationMemoryStore.ts` - tier-gated turns, compact signal, summaries, eviction
- `src/core/memory/UserMemoryStore.ts` - D-07 confidence, useCount, by-tag index
- `src/core/memory/PreferenceMemoryStore.ts` - np_persona preference records
- `src/core/memory/MemoryEngine.ts` - singleton orchestrator: retrieve/write/LRU/journaling
- `src/core/storage/WriteJournal.ts` - added 'write-preference' to operation union (modified)
- `tests/core/memory/*.test.ts` (4 files, 68 tests)

## Decisions Made

- **Single compact preference ContextItem** (`sourceId: 'memory.preference'`) instead of per-key items — matches Task 3 action step 3; the behavior test's `memory.preference.{key}` pattern holds as a prefix. Per-key items would multiply token overhead for no retrieval gain.
- **Public MemoryEngine constructor + public isPrimarySurface()** — TS cannot `new` a private constructor from module scope; the plan's own cited pattern (ContextOptimizer/PageIndexBuilder) uses public constructors. Public isPrimarySurface lets tests flip it via spyOn for the MEM-02 gate.
- **'write-preference' added to WriteJournalOperation** — the plan's types.ts spec included it as a MemoryStoreWriteOp "matching WriteJournalOperation union from Phase 2", but Phase 2's union lacked it. Additive union extension, zero behavior change; MemoryStoreWriteOp now derives from the union via Extract (single source of truth).
- **write() routes via userStore.upsert per plan step 4** — semantic records persist; non-semantic writes fail the journal step honestly (JOURNAL_ERROR) instead of returning fake success. Preference writes use PreferenceMemoryStore.set; conversation summaries use ConversationMemoryStore.saveSummary (Plan 03 summarization pipeline).
- **tokenBudget.estimateTokens() for ContextItem tokens** — canonical Phase 4 estimation service, honoring the D-09 prohibition on inlined counting.
- **MemoryEngine filters memoryType==='semantic' before fact scoring** — preference records share the user_facts store (D-04 taxonomy) but must never compete in D-09 fact tiering (D-06 store independence).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] 'write-preference' absent from WriteJournalOperation union**
- **Found during:** Task 3 GREEN (tsc)
- **Issue:** The plan's types.ts spec defines `MemoryStoreWriteOp = 'update-user-memory'|'write-preference'|'compact-conversation'` as "matching WriteJournalOperation union from Phase 2" — but Phase 2's union lacks 'write-preference', so the op could never be journaled under the union type.
- **Fix:** Added `'write-preference'` to WriteJournalOperation in WriteJournal.ts; MemoryStoreWriteOp redefined as `Extract<WriteJournalOperation, ...>` (single source of truth).
- **Files modified:** src/core/storage/WriteJournal.ts, src/core/memory/types.ts
- **Verification:** tsc clean; MemoryEngine journal-op mapping tests pass; storage suites unchanged (160 tests green).
- **Committed in:** e0b85a1 (Task 3 GREEN)

**2. [Rule 2 - Missing Critical] WRITE_BOUNDARY_VIOLATION missing from MemoryWriteResult code union**
- **Found during:** Task 1 authoring
- **Issue:** Task 1's types.ts spec lists only 4 write codes, but Task 3's write() spec returns `code: 'WRITE_BOUNDARY_VIOLATION'` for the D-05 guard — the union had to include it.
- **Fix:** Added 'WRITE_BOUNDARY_VIOLATION' to the MemoryWriteResult code union.
- **Files modified:** src/core/memory/types.ts
- **Verification:** tsc clean; WRITE_BOUNDARY_VIOLATION test passes.
- **Committed in:** b2324fb (Task 1 GREEN)

**3. [Rule 2 - Missing Critical] Silent write success when the store rejects the record**
- **Found during:** Task 3 implementation review
- **Issue:** Plan step 4's pseudo-code `executor: () => userStore.upsert(record)` swallows the discriminated-union result — a non-semantic write would complete the journal and return `{success: true, recordId: ''}` with nothing stored.
- **Fix:** The write-memory-record executor now throws when upsert returns failure, failing the journal entry honestly (JOURNAL_ERROR result).
- **Files modified:** src/core/memory/MemoryEngine.ts
- **Verification:** All write tests pass; non-semantic writes now surface as JOURNAL_ERROR.
- **Committed in:** e0b85a1 (Task 3 GREEN)

**4. [Rule 1 - Bug] Test expectation fixes during Task 3 GREEN**
- **Found during:** Task 3 GREEN verification
- **Issue:** Three test-authoring mistakes: (a) Test 5 asserted zero completed journal entries, but the test's own successful write legitimately created one; (b) Test 12 (idle archive) expected only conv-a archived at +31min, but D-11 archives ALL conversations idle >30 min — conv-b was also idle; (c) determinism test compared two retrieves across a real-clock tick — freshness/relevance use the D-08 30-day decay against Date.now(), so a pinned clock is required for identical inputs.
- **Fix:** Asserted exactly one completed entry from the blocked-write test (proving the blocked write created none); corrected idle-archive expectations to the spec's behavior; pinned Date.now in the determinism test.
- **Files modified:** tests/core/memory/MemoryEngine.test.ts
- **Verification:** 16/16 MemoryEngine tests pass.
- **Committed in:** e0b85a1 (Task 3 GREEN)

**5. [Rule 3 - Blocking] Private constructor incompatible with module-level singleton**
- **Found during:** Task 3 GREEN (tsc)
- **Issue:** The artifacts table lists a private MemoryEngine constructor, but TS rejects `new MemoryEngine()` from module scope (getMemoryEngine).
- **Fix:** Public constructor (the plan cites the ContextOptimizer/PageIndexBuilder pattern, which uses public constructors); singleton usage documented.
- **Files modified:** src/core/memory/MemoryEngine.ts
- **Verification:** tsc clean; all suites pass.
- **Committed in:** e0b85a1 (Task 3 GREEN)

**6. [Rule 3 - Blocking] MemoryWriteInput required caller-supplied timestamps**
- **Found during:** Task 3 GREEN (tsc)
- **Issue:** The plan's literal write() type `Omit<MemoryRecord,'id'|'useCount'|'confidence'>` still requires createdAt/updatedAt, but every behavior test calls write() without them and upsert derives both.
- **Fix:** MemoryWriteInput additionally omits createdAt/updatedAt.
- **Files modified:** src/core/memory/MemoryEngine.ts
- **Verification:** tsc clean; all write tests pass.
- **Committed in:** e0b85a1 (Task 3 GREEN)

---

**Total deviations:** 6 auto-fixed (2 bug, 3 missing-critical, 1 blocking)
**Impact on plan:** All auto-fixes were type-contract corrections and honesty fixes surfaced by the TDD/tsc gates — no scope creep, no architectural changes beyond the additive WriteJournalOperation union member the plan itself assumed.

## Issues Encountered

- **Pre-existing AI provider test failures (out of scope):** 6 tests in `tests/core/ai/StreamAdapter.test.ts` and `tests/core/ai/providers/ProviderAdapter.test.ts` fail with `capturedOnChunk is not a function` — verified pre-existing (git diff of AI paths across all 6 plan commits is empty; failing tests import only AI modules). Logged to `.planning/phases/05-knowledge-base/deferred-items.md`; not fixed per executor scope boundary.
- **`Extract<WriteJournalOperation, ...>` investigation:** initial tsc failures looked like TypeScript distributivity issues; root cause was simply that 'write-preference' never existed in the Phase 2 union (see Deviation 1).

## TDD Gate Compliance

All three tasks followed RED → GREEN with committed gates:

| Task | RED commit | GREEN commit | Status |
|------|-----------|--------------|--------|
| 1 (schemas + scorer) | `28dd278` | `b2324fb` | Pass |
| 2 (stores) | `d4eb96d` | `7a332f1` | Pass |
| 3 (engine) | `7c996e5` | `e0b85a1` | Pass |

REFACTOR gates: none needed — GREEN implementations were already minimal and clean.

## Known Stubs

None — no placeholder values, TODO data paths, or unwired components shipped. `isPrimarySurface()` returns `true` by default with a `// TODO: wire BroadcastBus primary election (Plan 03)` comment — this is the plan's explicit Phase 5 contract (election wiring is Plan 03 scope; the guard is fully testable and enforced).

## Next Phase Readiness

- **Plan 05-03 (integration + verify):** MemoryEngine is ready for ContextAssembler/ContextOptimizer wiring — ContextItem[] contract (kind/sourceId/trust/sensitivity) matches the Phase 4b ContextTrustPolicy split (MemoryEngine owns relevance/freshness). Surface election wiring (isPrimarySurface TODO) and LLM summarization at the 12-message boundary are the Plan 03 integrations.
- **Phase 5a (LLM-Wiki):** UserMemoryStore + D-05 write boundary ready for governed note→memory extraction; ConfidenceSource/immutable-confidence contract is the Phase 5b conflict-resolution foundation.
- **Phase 7 (Notes UI):** PreferenceMemoryStore np_persona feeds the persona runtime; ConversationMemoryStore/UserMemoryStore APIs are the memory-panel data sources.
- NOTE-01 / MEM-01 / MEM-02 shared-requirement accounting: MEM-01 and MEM-02 completed here; NOTE-01 remains Pending until 05-03 finishes (shared-ID gate).

---

*Phase: 05-knowledge-base*
*Completed: 2026-08-02*

## Self-Check: PASSED

- All 11 created files verified on disk (7 source + 4 test)
- All 6 task commits verified in git log (28dd278, b2324fb, d4eb96d, 7a332f1, 7c996e5, e0b85a1)
- Final verification run: 68/68 memory tests pass; memory+storage+notes = 160/160; `pnpm tsc --noEmit` clean; AI suite failures pre-existing (deferred)
