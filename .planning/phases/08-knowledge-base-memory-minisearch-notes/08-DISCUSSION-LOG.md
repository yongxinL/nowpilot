# Phase 8: Knowledge Base (Memory + MiniSearch + Notes) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 8-knowledge-base-memory-minisearch-notes
**Areas discussed:** Memory store placement, MemoryEngine scope, Note canonical type, MiniSearchIndex design, NoteGraph + components, RICH-R-05 persona persistence, MemoryScorer/MemoryExtractor, verification gate

**Mode:** `--auto` (fully autonomous — recommended option auto-selected for every area, logged below for audit).

---

## Memory store placement

| Option | Description | Selected |
|--------|-------------|----------|
| §23 split (metadata/local, bodies/IDB) | chrome.storage.local holds np_facts index/np_conversation_meta/np_persona; MemoryDB holds message bodies + fact bodies + summaries | ✓ |
| All chrome.storage.local | Simpler, but 10 MB cap risks bodies; violates §3.3 "bodies in IndexedDB only" | |
| All IndexedDB | Bodies fine, but config/metadata in IDB adds boot latency and contradicts §15.1 | |

**User's choice:** Auto (D-104) — §23 split.
**Notes:** MemoryDB stores (messages/userFacts/conversationSummaries) already exist from Phase 2; Phase 8 writes through them.

## MemoryEngine scope

| Option | Description | Selected |
|--------|-------------|----------|
| Create-only producer | MemoryEngine supplies memoryHints/preference-profile producers proven by tests; live chat adoption deferred | ✓ |
| Wire into AgentOrchestrator now | Feeds memoryHints live in Phase 8; requires ContextOptimizer/AgentOrchestrator edits not in §18 | |

**User's choice:** Auto (D-105) — create-only, D-69/D-81 precedent.
**Notes:** Phase 7 CONTEXT explicitly deferred live adoption "until memoryHints exists (Phase 8)" — Phase 8 makes memoryHints exist; wiring stays deferred. Conversation summarisation ships as a pluggable seam with a deterministic test stub (D-106).

## Note canonical type

| Option | Description | Selected |
|--------|-------------|----------|
| src/types/notes.ts canonical + NotesDB re-export | Spec 4720 home; D-72/D-83 re-export precedent; no migration in Phase 8 | ✓ |
| Keep NotesDB.Note as-is | Leaves the simplified Phase-2 shape; diverges from spec §21.2 | |
| New DB migration now | Adds fields via migration in Phase 8; v4 migration is spec-assigned to Phase 9 | |

**User's choice:** Auto (D-107/D-108) — canonical home + re-export; Note.type declaration-only.

## MiniSearchIndex design

| Option | Description | Selected |
|--------|-------------|----------|
| Per-surface lazy/memoized notes index, incremental upsert on note:saved | Persistent within surface lifetime, rebuilt from NotesDB, never stored in IDB; <50 ms/1000 notes | ✓ |
| Full rebuild on every query | Simpler but misses the <50 ms target at 1000 notes | |

**User's choice:** Auto (D-109) — lazy/memoized + incremental upsert on note:saved.

## NoteGraph + components

| Option | Description | Selected |
|--------|-------------|----------|
| Core logic in components + NoteGraph (§22.3 cosine, inline stop-word list) | topKSimilar + backlinks core; thin components; Phase-15 UI deferred | ✓ |
| Full UI in NotesWorkspace | Phase-15 territory (RICH), not in §18 Phase 8 | |

**User's choice:** Auto (D-110/D-111) — ID-based wikilink resolution with spec tie-break; component core logic only.

## RICH-R-05 persona persistence

| Option | Description | Selected |
|--------|-------------|----------|
| PreferenceMemoryStore owns np_persona; full §3.5 UserPreferences supersedes Phase-3 minimal | R2-compliant; re-export keeps consumers resolving | ✓ |
| Keep persona overrides in np_preferences | Diverges from R2 / spec 121; np_persona is the mandated home | |

**User's choice:** Auto (D-112) — np_persona canonical; UserPreferences supersession at src/core/memory/types.ts.

## MemoryScorer / MemoryExtractor

| Option | Description | Selected |
|--------|-------------|----------|
| §3.4 scoring formula verbatim + schema/parse seam | Exact weights, [0,1] normalized; LLM extraction wiring in Phase 9 | ✓ |
| Implement LLM extraction call now | NMEM-02 is Phase 9 (spec 3876) | |

**User's choice:** Auto (D-113) — verbatim scorer + schema seam.

## Verification gate

| Option | Description | Selected |
|--------|-------------|----------|
| Re-point verify:phase-8 to §18 dirs | tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts (spec 3612) | ✓ |
| Leave as-is | Targets Phase 6/17 dirs (tests/core/content tests/addons tests/isolation) — wrong gate | |

**User's choice:** Auto (D-114) — D-92/D-103 analog re-point.

---

## the agent's Discretion

- `src/core/memory/` layout (one file per §18 vs barrel index).
- Whether `src/core/memory/types.ts` holds only RetrievedMemory + UserPreferences, or also local store types.
- Where the Flow-3 save core lives (LinkParser/NoteGraph vs a save.ts seam).
- Whether MiniSearchIndex reuses PageIndexBuilder field conventions or defines its own note-document shape.
- Whether WorkingMemory is a standalone `src/core/memory/WorkingMemory.ts` module or folded into UserMemoryStore.
- Whether `note:saved` EventBus type is declared/emitted in Phase 8 vs Phase 9.

## Deferred Ideas

- Memory governance (MEM-01…05, KNW-01) — Phase 10.
- LLM enrichment + filesystem sync (Phase 9).
- Live memoryHints adoption in AgentOrchestrator/useChatStreaming — deferred (D-69/D-105).
- Full NotesWorkspace UI — Phase 15.1.
- Tool registration (search-notes/create-note) — Phase 18.
- Real LLM summariser for the 12-message compactor — later phase.
- LLM wikilink autocomplete — not in v0.1 (D-04).
- Embedding-based retrieval — deferred per §3.2.