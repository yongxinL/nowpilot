---
phase: 05-knowledge-base
verified: 2026-08-02T09:30:00Z
status: human_needed
score: 36/36 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Benchmark MiniSearchNoteIndex.search() latency across 1,000 indexed notes (ROADMAP SC2: '<50ms across 1,000 notes')"
    expected: "Search returns in under 50ms for a 1,000-note index"
    why_human: "No benchmark/performance test exists in the phase suites; search() is synchronous in-memory BM25 (architecturally fast), but the specific <50ms/1,000-notes contract is not exercised by any test"
  - test: "Confirm the end-to-end automatic summarization trigger: appendMessage() returns shouldCompact=true at the 12-message boundary, and compactConversation() is invoked by the production turn loop"
    expected: "After the 12th message in a real conversation, an LLM summary is generated and stored automatically without manual intervention"
    why_human: "shouldCompact/compactConversation are unit-tested at the store level, but no production caller (AgentOrchestrator/UI turn loop) wires shouldCompact → compactConversation — the trigger is documented as 'the caller decides'. End-to-end automatic summarization requires the Phase 7 UI turn loop"
---

# Phase 5: Knowledge Base Verification Report

**Phase Goal:** User can create atomic notes with wikilinks, browse a note graph with backlinks, and have conversation/user/preference memory persist across sessions
**Verified:** 2026-08-02T09:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LinkParser.parse extracts `[[title]]`, `[[title\|alias]]`, `[[title#section]]` → title only | ✓ VERIFIED | `src/core/notes/LinkParser.ts` (WIKILINK_REGEX + Set dedup) + 11 tests green |
| 2 | resolveLinks tie-break to most recently updated; unresolved tracked | ✓ VERIFIED | LinkParser.ts:54 + test 'tie-breaks duplicate titles to the most recently updated note' |
| 3 | NotesDB.save validates, parses wikilinks, resolves links[], emits 'note:saved' after commit | ✓ VERIFIED | `src/core/notes/NotesDB.ts:54-133` + NotesDB.test.ts (persist, emit, version) |
| 4 | MiniSearch BM25 search with `<mark>` snippets | ✓ VERIFIED | `src/core/notes/MiniSearchNoteIndex.ts` buildSnippet (WR-07 escape+token restore) + 7 tests |
| 5 | persist()/load() round-trip preserves search results | ✓ VERIFIED | MiniSearchNoteIndex.ts:129-163 + WR-01 tests (fresh instance restores/deletes) |
| 6 | NoteGraph.getBacklinks computed dynamically, never stored | ✓ VERIFIED | `src/core/notes/NoteGraph.ts:126-128` + integration test |
| 7 | getRelatedNotes 50% linkOverlap + 20% tagOverlap + 30% contentCosine | ✓ VERIFIED | NoteGraph.ts:92-100 (D-13) + 12 tests |
| 8 | Same note saved twice → version increments, no duplicate rows | ✓ VERIFIED | NotesDB.ts:72-73 + test 'increments the version counter on update' |
| 9 | Interrupted save → journal replay/rollback, no partial writes | ✓ VERIFIED | WriteJournal executor registry (WR-05) + integration test 'startup replay recovers interrupted entry' |
| 10 | NotesDB.getAll() returns [] when empty | ✓ VERIFIED | NotesDB.ts:154-157 + test |
| 11 | Write operations return discriminated unions, never throw | ✓ VERIFIED | NoteSaveResult/NoteFindResult in types.ts; save/get error paths return unions |
| 12 | D-15: enrichment deferred to 5a, suggestions never auto-applied | ✓ VERIFIED | No enrichment auto-apply code in phase; concepts store schema-only (MigrationRunner v4) |
| 13 | scoreFact uses D-08 weights 35/25/20/10/10 → [0,1] | ✓ VERIFIED | `src/core/memory/MemoryScorer.ts` WEIGHTS + 33 tests |
| 14 | getTopFacts: tiny≤3, small/medium/large≤5, all ≥0.30 | ✓ VERIFIED | MemoryScorer.ts TIER_LIMITS + MIN_SCORE + tests + integration test |
| 15 | getContext returns summary + 4/8/12 recent messages by tier | ✓ VERIFIED | ConversationMemoryStore.ts RECENT_MESSAGE_LIMITS (4/8/12/12 = ROADMAP's 2/4/6 *turns* per RESEARCH §Context Assembly) + test |
| 16 | appendMessage compact signal at messageCount % 12 === 0 | ✓ VERIFIED | ConversationMemoryStore.ts:184-201 + tests (boundary, WR-09 atomic seq) |
| 17 | upsert validates Zod, confidence from D-07 source map, immutable | ✓ VERIFIED | UserMemoryStore.ts:57-93 + CONFIDENCE_MAP + tests |
| 18 | incrementUseCount increments useCount/lastUsedAt, confidence untouched | ✓ VERIFIED | UserMemoryStore.ts:119-130 + test |
| 19 | PreferenceMemoryStore.get('np_persona') returns config or null | ✓ VERIFIED | PreferenceMemoryStore.ts + tests |
| 20 | retrieve returns ContextItem[] ordered conversation → facts → preferences with D-18 sourceIds | ✓ VERIFIED | MemoryEngine.ts:159-248 + Tests 1/3 |
| 21 | write() rejects with NOT_PRIMARY_SURFACE when !isPrimarySurface | ✓ VERIFIED | MemoryEngine.ts:276-282 + behavioral Test 5 + real BroadcastBus election test |
| 22 | write() wraps in WriteJournal with matching op + WORKSPACE_UPDATED broadcast | ✓ VERIFIED | MemoryEngine.ts:284-321 + Test 6 |
| 23 | Deterministic retrieval; same record id overwrites (no dupes) | ✓ VERIFIED | Test 'retrieval is deterministic' + upsert-by-key tests |
| 24 | retrieve with no memories returns empty items (downstream empty state) | ✓ VERIFIED | Test 9 'retrieve with no stored memory returns success with empty items' |
| 25 | All memory writes return discriminated unions, never throw | ✓ VERIFIED | MemoryWriteResult/MemoryRetrievalResult in types.ts |
| 26 | Secondary-surface writes blocked BEFORE any IndexedDB mutation (backstop) | ✓ VERIFIED | Test 5 asserts zero journal entries created + no fact persisted for blocked write |
| 27 | AI-pipeline semantic/preference writes rejected WRITE_BOUNDARY_VIOLATION | ✓ VERIFIED | MemoryEngine.ts:264-273 + Test 10 (D-05) |
| 28 | trackConversationActivity: max 10 active / 100 archived / 30-min idle / oldest-first eviction | ✓ VERIFIED | MemoryEngine.ts:356-415 + Tests 11/12/13; CR-01 fix (no dual membership) verified in code |
| 29 | Primary disconnect → re-election → surviving surface becomes primary (backstop) | ✓ VERIFIED | BroadcastBus.ts election API + BroadcastBus.test.ts (clear restores open gate; remote election applied) |
| 30 | compactConversation invokes LLM at 12-boundary on haiku-class tier, stores summary, never deletes messages | ✓ VERIFIED | ConversationMemoryStore.ts:218-279 + 6 behavioral tests (model tier, boundary, resilience) |
| 31 | AgentTurnInput factory populates memoryHints/preferences from MemoryEngine | ✓ VERIFIED | `src/core/ai/AgentTurnInput.ts` createAgentTurnInputWithMemory + integration test |
| 32 | PersonaInjector reads np_persona via MemoryEngine.getPersona() (single intermediary) | ✓ VERIFIED | PersonaInjector.ts loadPersonaFromMemory (WR-08 PersonaProfileSchema validation) + integration test |
| 33 | verify:phase-5 runs tsc --noEmit then all notes+memory suites, exit 0 | ✓ VERIFIED | Ran `npm run verify:phase-5`: tsc clean, 10 suites, 142/142 tests, exit 0 |
| 34 | Integration test proves save→index→search→backlinks cycle | ✓ VERIFIED | tests/core/integration/phase05.test.ts 'full notes lifecycle' |
| 35 | Integration test proves write→retrieve→ContextItem[]→scored→tier-gated | ✓ VERIFIED | phase05.test.ts 'full memory lifecycle' + tier-gating test |
| 36 | Summarization failure (empty/provider error) preserves messages, no data loss | ✓ VERIFIED | EMPTY_SUMMARY/PROVIDER_ERROR/DELIMITER_ERROR tests — messages preserved |

**Score:** 36/36 truths verified (0 present, behavior-unverified)

### Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| SC1 | Atomic note with wikilinks, tie-break resolution, graph with cosine backlinks | ✓ VERIFIED | Integration test; LinkParser/NoteGraph tests |
| SC2 | MiniSearch search <50ms across 1,000 notes | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Synchronous in-memory BM25 (architecturally fast); no benchmark test exercises the <50ms/1,000-notes contract → human verification |
| SC3 | Summary + recent turns (2/4/6 turns); auto-summarize after every 12 messages | ✓ VERIFIED (mechanism) | 4/8/12 messages (= 2/4/6 turns, RESEARCH §Context Assembly); %12 compact signal + tested compactConversation. *Trigger wiring note:* no production turn loop calls compactConversation — see human verification #2 |
| SC4 | Facts scored (keyword+tag+recency+useCount+confidence), top-5 (top-3 tiny) injected | ✓ VERIFIED | MemoryScorer D-08/D-09 + MemoryEngine.retrieve → ContextItem[] → createAgentTurnInputWithMemory.memoryHints |
| SC5 | Memory writes only from primary surface (BroadcastBus election); secondary read-only | ✓ VERIFIED | BroadcastBus setPrimarySurfaceId/isPrimarySurface + MemoryEngine gate + behavioral tests |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/notes/NoteSchema.ts` | Zod Note/Provenance/Concept schemas | ✓ VERIFIED | 1.6KB substantive; all fields per spec |
| `src/core/notes/LinkParser.ts` | WIKILINK_REGEX + parseWikilinks + resolveLinks | ✓ VERIFIED | 63 lines, tie-break by updatedAt desc |
| `src/core/notes/NotesDB.ts` | Journaled CRUD, note:saved event, restore() | ✓ VERIFIED | 211 lines; WriteJournal 'save-note-with-links' + payload replay |
| `src/core/notes/MiniSearchNoteIndex.ts` | Persistent BM25, persist/load, <mark> snippets | ✓ VERIFIED | 230 lines; WR-07 XSS-safe snippet builder |
| `src/core/notes/NoteGraph.ts` | Dynamic backlinks + 50/20/30 hybrid | ✓ VERIFIED | 193 lines; singleton + stateless compute |
| `src/core/notes/types.ts` | NoteIndexDoc, NoteFindResult, NoteSaveResult | ✓ VERIFIED | Discriminated unions |
| `src/core/storage/MigrationRunner.ts` | v4 stores: notes/concepts/index + memory skeletons | ✓ VERIFIED | Idempotent guards on all createObjectStore |
| `src/core/storage/NotesStore.ts` | Zustand CRUD mirror | ✓ VERIFIED | WR-02: mirrors persisted derived note |
| `src/core/memory/MemoryRecord.ts` | Zod schemas + CONFIDENCE_MAP | ✓ VERIFIED | D-04/D-07 taxonomy |
| `src/core/memory/MemoryScorer.ts` | D-08 weights, tier limits | ✓ VERIFIED | Pure functions, deterministic |
| `src/core/memory/ConversationMemoryStore.ts` | Tier-gated tails, compact signal, LLM compaction | ✓ VERIFIED | 317 lines; WR-06 sanitizer + WR-09 atomic seq |
| `src/core/memory/UserMemoryStore.ts` | D-07 confidence, immutable, by-tag index | ✓ VERIFIED | 137 lines |
| `src/core/memory/PreferenceMemoryStore.ts` | np_persona preferences | ✓ VERIFIED | 138 lines |
| `src/core/memory/MemoryEngine.ts` | Orchestrator: retrieve/write/LRU/journaling | ✓ VERIFIED | 463 lines; CR-01/WR-03/WR-05 fixes present |
| `src/core/runtime/BroadcastBus.ts` | Primary surface election API | ✓ VERIFIED | setPrimarySurfaceId/getPrimarySurfaceId/isPrimarySurface + cross-context broadcast (WR-04) |
| `src/core/ai/AgentTurnInput.ts` | createAgentTurnInputWithMemory | ✓ VERIFIED | Memory-aware turn factory |
| `src/core/ai/persona/PersonaInjector.ts` | loadPersonaFromMemory via MemoryEngine | ✓ VERIFIED | WR-08 schema validation + fallback |
| `src/core/knowledgeBaseBootstrap.ts` | Startup: index load, election, journal replay | ✓ VERIFIED | Wired into main.tsx, SidePanelShell, AppShell |
| `package.json` verify:phase-5 | tsc + 10 explicit suites | ✓ VERIFIED | Ran: exit 0, 142 tests |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| NotesDB.save | MiniSearchNoteIndex | WriteJournal 'update-index' step (replace + persist) | ✓ WIRED | Atomic within journal entry; stronger than event-driven |
| NotesDB.save | EventBus | emit('note:saved') after commit | ✓ WIRED | Emitted; index sync done inside journal step (IN-01: no subscribers — intent covered by in-journal sync) |
| NotesDB.save | NoteGraph | notesDb.getAll() + getBacklinks on demand | ✓ WIRED | Graph is stateless; integration test proves backlinks |
| MemoryEngine.write | WriteJournal | isPrimarySurface() checked BEFORE createEntry | ✓ WIRED | Code order + test asserts no journal entry on blocked write |
| UserMemoryStore.upsert | CONFIDENCE_MAP | D-07 trust-gate | ✓ WIRED | Confidence assigned once, immutable |
| MemoryEngine.retrieve | ContextItem[] | trust/sensitivity metadata per Phase 4b | ✓ WIRED | trust=confidence, sensitivity inherited, relevance/freshness computed |
| PersonaInjector | MemoryEngine.getPersona | Single intermediary (not PreferenceMemoryStore direct) | ✓ WIRED | loadPersonaFromMemory |
| createAgentTurnInputWithMemory | MemoryEngine.retrieve/getPreferences/getPersona | memoryHints/preferences/personaBehavior | ✓ WIRED | Integration test |
| verify:phase-5 | 10 test suites | Explicit file list (non-vacuous) | ✓ WIRED | Missing file → exit 1; all present, exit 0 |
| compactConversation | FAST tier model | providerAdapter.getDefaultModelForTier('FAST') | ✓ WIRED | Test asserts haiku-class, never conversation tier |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| MiniSearchNoteIndex | index/docs | NotesDB.save update-index step + load() at bootstrap | Yes — real IndexedDB 'index' store round-trip | ✓ FLOWING |
| NoteGraph.getBacklinks | links[] | notesDb.getAll() real notes | Yes — derived from persisted links[] | ✓ FLOWING |
| MemoryEngine.retrieve | items | ConversationMemoryStore/UserMemoryStore/PreferenceMemoryStore (IndexedDB v4) | Yes — real store reads | ✓ FLOWING |
| createAgentTurnInputWithMemory | memoryHints/preferences | MemoryEngine.retrieve/getPreferences | Yes — real memory pipeline | ✓ FLOWING |
| loadPersonaFromMemory | persona | MemoryEngine.getPersona → user_facts store | Yes — real np_persona record | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase gate: tsc + 10 suites | `npm run verify:phase-5` | 10 files, 142 tests passed, tsc clean, exit 0 | ✓ PASS |
| MEM-02 gate (behavioral) | MemoryEngine.test.ts 'real BroadcastBus election' + Test 5 | NOT_PRIMARY_SURFACE; no journal entry; no persisted fact | ✓ PASS (run within gate) |
| Compact boundary (behavioral) | ConversationMemoryStore.test.ts | %12 signal only at boundary; haiku model requested | ✓ PASS (run within gate) |
| WR-05 crash replay (behavioral) | phase05.test.ts 'startup replay recovers' | entry completed, index rebuilt + persisted | ✓ PASS (run within gate) |
| Pre-existing AI failures (out of scope) | `npx vitest run tests/core/ai/StreamAdapter.test.ts tests/core/ai/providers/ProviderAdapter.test.ts` | 6 failed / 26 passed — matches deferred-items.md exactly; phase-5 commits touch none of these files | ℹ️ CONFIRMED PRE-EXISTING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| NOTE-01 | 05-01, 05-03 | Atomic notes with wikilinks, tags, note graph (MiniSearch + cosine), backlinks | ✓ SATISFIED | NotesDB/LinkParser/MiniSearchNoteIndex/NoteGraph + integration tests |
| MEM-01 | 05-02, 05-03 | Conversation memory (summary + recent turns), cross-session facts (scored), preferences persist | ✓ SATISFIED | MemoryScorer/stores/MemoryEngine + summarization + AI feed |
| MEM-02 | 05-02, 05-03 | Memory writes only from primary surface; secondary read-only | ✓ SATISFIED | BroadcastBus election + MemoryEngine gate + behavioral tests |

**Orphaned requirements:** None. All Phase 5 requirement IDs (NOTE-01, MEM-01, MEM-02) are claimed and satisfied. NOTE-02/NOTE-03 are Phase 5a requirements, correctly unclaimed here.

### Code Review Fixes Verification (CR-01..WR-09)

All 10 findings verified fixed in code (commits 1a8ceae..e64f35e, all present in `git log`):

| Finding | Commit | Code Evidence | Verified |
| ------- | ------ | ------------- | -------- |
| CR-01 LRU dual membership | 1a8ceae | MemoryEngine.ts:380-384 removes from archived before pushing to active; includes guards | ✓ |
| WR-01 index never persisted | 26ab6c2 | NotesDB.ts update-index persists; bootstrap load(); entrypoints call initializeKnowledgeBase | ✓ |
| WR-02 NotesStore mirror divergence | 7e45b2e | NotesStore.ts:49-50 re-fetches persisted note | ✓ |
| WR-03 dead AI-write path | 4e0df20 | persistMemoryRecord routes by memoryType (preference/working/episodic/semantic) | ✓ |
| WR-04 election never propagates | 91f4ad1+26ab6c2 | BroadcastBus PRIMARY_SURFACE_ELECTED broadcast + remote apply; bootstrap elects | ✓ |
| WR-05 journal replay unwired | af14554 | registerStepExecutor/replayJournal/repairEntry + payload on entries + bootstrap registration | ✓ |
| WR-06 prompt delimiter injection | 060912b | sanitizeExcerpt + DELIMITER_ERROR invariant assertion | ✓ |
| WR-07 stored-XSS snippets | b7ce116 | placeholder tokens + escapeHtml + token restore (only `<mark>` possible) | ✓ |
| WR-08 persona cast without validation | 1810f4e | PersonaProfileSchema.safeParse + DEFAULT_PERSONA fallback | ✓ |
| WR-09 appendMessage seq race | e64f35e | Single readwrite tx: cursor count + put atomic | ✓ |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX/PLACEHOLDER markers in any phase-5 modified file | — | None |
| — | — | No stub/empty implementations; all 19 artifacts substantive (avg >100 lines) | — | None |

### Human Verification Required

### 1. Search latency at scale (ROADMAP SC2)

**Test:** Benchmark `MiniSearchNoteIndex.search()` with an index of 1,000 notes (e.g., rebuild(1000 docs) then time 100 searches).
**Expected:** Search returns in under 50ms (in-memory BM25 with title boost + prefix is architecturally fast; a `performance.now()` harness should confirm).
**Why human:** No benchmark test exists in the phase suites — the contract is a performance claim only verifiable by measurement, not presence.

### 2. End-to-end automatic summarization trigger (ROADMAP SC3)

**Test:** In a live conversation flow (Phase 7 UI turn loop), append 12 messages and confirm a summary is generated/stored without manual intervention.
**Expected:** `appendMessage()` returns `shouldCompact: true` at the 12-message boundary and the production caller invokes `compactConversation()` (FAST tier), storing a ≤500-char summary while preserving all messages.
**Why human:** `shouldCompact`/`compactConversation` are fully unit-tested at the store level, but no production caller (AgentOrchestrator/UI) currently wires the signal to the compaction call — the design documents "the caller decides". The mechanism is complete; the automatic trigger in a real turn loop needs end-to-end confirmation.

### Gaps Summary

No gaps found. All 36 plan must-have truths verified (36/36), all 5 roadmap success criteria met at the mechanism level, all 10 code-review fixes confirmed in code and commits, and the `verify:phase-5` gate passes (tsc clean, 142/142 tests, exit 0). The 6 pre-existing StreamAdapter/ProviderAdapter test failures were independently reproduced and confirmed untouched by phase-5 commits — they remain documented in `deferred-items.md` as out of scope.

Two items require human confirmation (status: human_needed, not gaps_found): the SC2 sub-50ms search latency has no benchmark test, and the SC3 automatic summarization trigger is unit-tested at the store level but not wired into a production turn loop (Phase 7 UI scope). Neither is a blocker for this phase's contract.

---

_Verified: 2026-08-02T09:30:00Z_
_Verifier: the agent (gsd-verifier)_
