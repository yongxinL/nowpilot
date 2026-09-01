---
phase: 08-knowledge-base-memory-minisearch-notes
verified: 2026-09-01T16:35:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 8: Knowledge Base (Memory + MiniSearch + Notes) Verification Report

**Phase Goal:** Atomic notes with wikilinks, MiniSearch over notes, a MemoryEngine covering working/episodic/semantic/preference/procedural memory, and PreferenceMemoryStore (`np_persona`) where persona config lives.
**Verified:** 2026-09-01T16:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Conversation summary + recent turns are returned by MemoryEngine (SC#1) | ✓ VERIFIED | `MemoryEngine.retrieveConversationMemory()` (MemoryEngine.ts:38-46) delegates to `ConversationMemoryStore.getSummary` + `getRecentTurns(6)`. Test `MemoryEngine.test.ts > CONVERSATION` asserts summary + recentTurns returned. |
| 2 | User memory returns top 5 (top 3 in tiny mode); preference profile injects compact JSON incl. persona overrides RICH-R-05 (SC#2) | ✓ VERIFIED | `MEMORY_HINTS_TOP_K = 5`, `MEMORY_HINTS_TINY_K = 3` (MemoryEngine.ts:23-27). `buildPreferenceProfile()` reads `usePreferenceMemoryStore.getState()` incl. `personaOverrides` (MemoryEngine.ts:89-101). Tests: `MemoryEngine.test.ts > USER MEMORY` + `> RICH-R-05 DONE-WHEN`. |
| 3 | Memory retrieval scores all in [0, 1] (SC#3) | ✓ VERIFIED | `MemoryScorer.scoreMemory()` implements verbatim weights (0.45/0.25/0.15/0.10/0.05), all sub-scores clamped to [0,1] (MemoryScorer.ts:42-84). Test `MemoryScorer.test.ts > SUB-SCORE BOUNDS` asserts `≥ 0` and `≤ 1` with extreme inputs (100-day-old, useCount 999, confidence 1). |
| 4 | MiniSearch < 50 ms over 1,000 notes (SC#4) | ✓ VERIFIED | `MiniSearchIndex.test.ts > (8) PERF GATE` builds 1,000 synthetic notes, asserts `Date.now() - t0 < 50`. Gate run confirms pass. |
| 5 | Wikilinks resolve with tie-break rule; end-to-end Page → Note → MiniSearch path works (SC#5) | ✓ VERIFIED | `LinkParser.resolveLinks()` uses `getAllFromIndex('notes','byTitle',target)` + exact-title filter + `updated desc → id asc` sort (LinkParser.ts:53-71). Tests: `LinkParser.test.ts` tie-break (updated desc, id asc). E2E: `notes-search-e2e.test.ts > (1)` proves PageContext → Note → saveNote → MiniSearchIndex → query. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/notes.ts` | Canonical Note (§21.2 verbatim) + OKF constants; Note.type?: string declaration-only | ✓ VERIFIED | 58-line interface incl. links/unresolvedLinks/aiMeta/source/summaryGeneratedAt/tagsGeneratedAt/type?. Exports OKF_NOTE_DEFAULT_TYPE, OkfNoteFrontmatter, NOTE_SUGGESTION_DISPLAY_THRESHOLD. |
| `src/core/memory/types.ts` | Canonical memory types (RetrievedMemory + UserPreferences §3.5 + UserMemoryFact §3.4 + enums) | ✓ VERIFIED | Re-exported by context/types, MemoryDB, ai/UserPreferences. |
| `src/core/memory/PreferenceMemoryStore.ts` | np_persona owner (RICH-R-05), zod-validated hydrate, single-writer, R2 | ✓ VERIFIED | `name: 'np_persona'`, npPersonaSchema, hydrate() with safeParse, isPrimaryWriter() gate, zero storage imports. |
| `src/core/memory/MemoryEngine.ts` | Create-only orchestrator: retrieveConversationMemory / retrieveUserMemory / buildPreferenceProfile / retrieveMemoryHints | ✓ VERIFIED | All 4 methods present. No ContextOptimizer/AgentOrchestrator imports (create-only). |
| `src/core/memory/MemoryScorer.ts` | §3.4 verbatim scoring + exported weight constants | ✓ VERIFIED | MEMORY_SCORE_KEYWORD=0.45 etc., MEMORY_RECENCY_WINDOW_DAYS=30, scoreMemory() pure function. |
| `src/core/memory/UserMemoryStore.ts` | np_facts LRU ≤500 + MemoryDB.userFacts + redaction + single-writer | ✓ VERIFIED | NP_FACTS_MAX=500, redactSensitiveValue before IDB put, isPrimaryWriter gate. |
| `src/core/memory/ConversationMemoryStore.ts` | Compactor seam + LRU 10/100 + journaled evict | ✓ VERIFIED | CONVERSATION_COMPACTOR_MODULO=12, ACTIVE_MAX=10, ARCHIVED_MAX=100, IDLE_ARCHIVE_MS=30min, runJournaled evict. |
| `src/core/memory/WorkingMemory.ts` | O.10 + redaction + 300-token cap | ✓ VERIFIED | MAX_WORKING_MEMORY_TOKENS=300, redactSensitiveValue, isPrimaryWriter gate. |
| `src/core/memory/MemoryExtractor.ts` | memoryFacts schema + parseMemoryFacts seam | ✓ VERIFIED | memoryFactsSchema (zod), parseMemoryFacts typed result. No LLM wiring. |
| `src/core/search/MiniSearchIndex.ts` | Lazy/memoized notes index, note:saved upsert, perf gate, zero-storage | ✓ VERIFIED | spec-1608 fields, storeFields incl. 'updated', boost title:3, discard() remove, wireNoteSaved() at module load, 0 chrome.storage imports. |
| `src/core/notes/LinkParser.ts` | WIKILINK_RE, parseLinks, resolveLinks (WIKI-ID-02), demoteDangling | ✓ VERIFIED | WIKI-ID-02 tie-break via getAllFromIndex + sort, 0 getNoteByTitle. |
| `src/core/notes/save.ts` | NOTE_SAVED_EVENT, NoteSavedPayload, saveNote seam | ✓ VERIFIED | Flow-3-minus-LLM: parse → resolve → put → emit. |
| `src/core/notes/NoteGraph.ts` | STOP_WORDS(50), topKSimilar cosine, computeBacklinks | ✓ VERIFIED | STOP_WORDS = exactly 50 entries (test-pinned), [a-z0-9]{3,} tokeniser, TF cosine, updated-desc/id-asc tie-break. |
| `src/components/notes/BacklinksPanel.tsx` | BacklinkEntry reverse index + thin list | ✓ VERIFIED | Uses computeBacklinks, BacklinkEntry {noteId,title,updated}, sorted updated desc. 8 tests pass. |
| `src/components/notes/WikilinkAutocomplete.tsx` | MiniSearch title matching, AUTOCOMPLETE_MAX=10, no LLM | ✓ VERIFIED | searchSuggestions(), NoteHit via MiniSearchIndex, 0 AI-module imports. 13 tests pass. |
| `src/components/notes/NoteGraphView.tsx` | GraphNode/GraphEdge adjacency from topKSimilar + computeBacklinks | ✓ VERIFIED | buildGraphAdjacency(), kinds current/similar/backlink. 7 tests pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `MemoryEngine.ts` | `ConversationMemoryStore.ts` | getSummary + getRecentTurns | ✓ WIRED | MemoryEngine.ts:18, retrieveConversationMemory delegates |
| `MemoryEngine.ts` | `PreferenceMemoryStore.ts` | buildPreferenceProfile reads np_persona | ✓ WIRED | MemoryEngine.ts:19, getState().personaOverrides |
| `MemoryEngine.ts` | `UserMemoryStore.ts` | getScoredFacts for retrieveUserMemory | ✓ WIRED | MemoryEngine.ts:17, scored facts → RetrievedMemory[] |
| `UserMemoryStore.ts` | `MemoryDB.ts` | db.put('userFacts') | ✓ WIRED | UserMemoryStore.ts:21,113-114 |
| `UserMemoryStore.ts` | `MemoryScorer.ts` | scoreMemory | ✓ WIRED | UserMemoryStore.ts:23,161 |
| `MiniSearchIndex.ts` | `NotesDB.ts` | seedFromNotesDB(db.getAll('notes')) | ✓ WIRED | MiniSearchIndex.ts:20,71-74 |
| `MiniSearchIndex.ts` | `save.ts` | on(NOTE_SAVED_EVENT) subscription | ✓ WIRED | MiniSearchIndex.ts:22,110-134 |
| `LinkParser.ts` | `NotesDB.ts` | db.getAllFromIndex('notes','byTitle') | ✓ WIRED | LinkParser.ts:60 |
| `save.ts` | `LinkParser.ts` | parseLinks + resolveLinks | ✓ WIRED | save.ts:14,36-37 |
| `save.ts` | `EventBus.ts` | emit(NOTE_SAVED_EVENT) | ✓ WIRED | save.ts:11,41 (EventBus.ts itself untouched — 0 note:saved refs) |
| `WikilinkAutocomplete.tsx` | `MiniSearchIndex.ts` | NoteHit + query | ✓ WIRED | WikilinkAutocomplete.tsx:13,117 |
| `BacklinksPanel.tsx` | `NoteGraph.ts` | computeBacklinks | ✓ WIRED | BacklinksPanel.tsx:14,30 |
| `NoteGraphView.tsx` | `NoteGraph.ts` | topKSimilar + computeBacklinks | ✓ WIRED | NoteGraphView.tsx:16 |
| `PreferenceMemoryStore.ts` | (no storage imports) | R2: zero MemoryDB | ✓ WIRED | grep confirms 0 `from '../storage/` imports |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| MemoryEngine | summary/recentTurns | ConversationMemoryStore → MemoryDB.messages/summaries | Yes | ✓ FLOWING |
| MemoryEngine | scored facts | UserMemoryStore → MemoryDB.userFacts | Yes (redacted at write) | ✓ FLOWING |
| MemoryEngine | preference profile | PreferenceMemoryStore → chrome.storage.local.np_persona | Yes | ✓ FLOWING |
| MiniSearchIndex | search hits | NotesDB.notes (real Notes) | Yes | ✓ FLOWING |
| LinkParser | resolved links | NotesDB byTitle index | Yes (canonical IDs) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| verify:phase-8 gate | `pnpm run verify:phase-8` | 72 tests / 10 files pass, exit 0 | ✓ PASS |
| Component tests | `npx vitest run tests/components/notes` | 28 tests / 3 files pass | ✓ PASS |
| MemoryEngine conversation | `MemoryEngine.test.ts > CONVERSATION` | summary + recentTurns returned | ✓ PASS |
| MemoryScorer bounds | `MemoryScorer.test.ts > SUB-SCORE BOUNDS` | all scores ∈ [0,1] | ✓ PASS |
| MiniSearch perf | `MiniSearchIndex.test.ts > (8) PERF GATE` | < 50 ms over 1,000 notes | ✓ PASS |
| Wikilink tie-break | `LinkParser.test.ts > resolveLinks` | updated-desc winner | ✓ PASS |
| E2E path | `notes-search-e2e.test.ts > (1)` | full Page→Note→index→query | ✓ PASS |
| RICH-R-05 | `notes-search-e2e.test.ts > (2)` | override.tone:concise in profile | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED (no probe scripts declared for Phase 8)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RICH-R-05 | 08-01, 08-02, 08-05 | Persona persists across sessions/surfaces, stored in PreferenceMemoryStore (np_persona), NOT the fact store | ✓ SATISFIED | PreferenceMemoryStore owns np_persona (chrome.storage.local), R2 zero storage imports, buildPreferenceProfile reads np_persona. E2E test proves override round-trip. |

No orphaned requirements: REQUIREMENTS.md maps only RICH-R-05 to Phase 8; all plans claiming RICH-R-05 accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER markers found in any phase-8 file. No stub patterns (no `return null/empty`). |

### Human Verification Required

None — all behaviors verified by automated tests. The code is present, wired, and behaviorally proven.

### Gaps Summary

None. All 5 Roadmap Success Criteria verified against the codebase. RICH-R-05 (the phase's only v1 requirement) is satisfied: PreferenceMemoryStore owns `np_persona`, persona config persists to chrome.storage.local, never the fact store (R2), and `buildPreferenceProfile()` injects persona overrides into compact JSON.

---

_Verified: 2026-09-01T16:35:00Z_
_Verifier: the agent (gsd-verifier)_
