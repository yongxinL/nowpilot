# Phase 8: Knowledge Base (Memory + MiniSearch + Notes) - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 delivers the **persistent knowledge layer**: system-owned memory (conversation / user / preference / working), a **persistent notes MiniSearch index** over the NotesDB (distinct from the Phase-6 ephemeral page index), and the **atomic-note + wikilink core** (LinkParser, NoteGraph, and the three note components' core logic). It is the Phase-8 home of the memory architecture §3.1-3.6, the knowledge model (§21.2), the NoteGraph algorithm (§22.3), and RICH-R-05 (persona persistence in PreferenceMemoryStore `np_persona`).

**Scope is per spec §18 Phase 8** (spec 2656-2696). Create exactly (verbatim §18):

```
src/core/memory/MemoryEngine.ts
src/core/memory/ConversationMemoryStore.ts
src/core/memory/UserMemoryStore.ts
src/core/memory/PreferenceMemoryStore.ts             # persona config (np_persona) lives here
src/core/memory/MemoryScorer.ts
src/core/memory/MemoryExtractor.ts
src/core/search/MiniSearchIndex.ts
src/core/notes/LinkParser.ts
src/core/notes/NoteGraph.ts
src/components/notes/{BacklinksPanel, WikilinkAutocomplete, NoteGraphView}.tsx   # core logic
```

**Knowledge model established here:** atomic notes (unit) + wikilinks (`links[]`, the connective web) + tags (many-to-many labels). `categoryPath` is **declared** on the Note type (populated later by LLM-Wiki in Phase 9). **OKF v0.2 alignment — type declaration only:** add the optional field `Note.type?: string` in `src/types/notes.ts` (default `'Note'` applied at serialization time in Phase 9; no reader/writer consumes it in Phase 8).

Required tests (verbatim §18):

```
tests/core/memory/MemoryEngine.test.ts
tests/core/memory/MemoryScorer.test.ts
tests/core/memory/UserMemoryStore.test.ts
tests/core/search/MiniSearchIndex.test.ts
tests/core/notes/LinkParser.test.ts
```

**DONE-when (verbatim §18 + ROADMAP SC):** Conversation summary + recent turns are returned by MemoryEngine; user memory returns top 5 only (top 3 in tiny mode); preference profile injects compact JSON incl. persona overrides (RICH-R-05); memory retrieval scores are all in [0, 1]; MiniSearch < 50 ms over 1,000 notes; wikilinks resolve with tie-break rule; end-to-end `Page → PageContentService → Note → MiniSearch` path works; `pnpm run verify:phase-8` passes.

**Out of scope (verified in spec §18 / PROJECT.md / REQUIREMENTS.md / prior CONTEXT files):** Memory governance (MEM-01…05, KNW-01) = Phase 10 — Phase 8 ships the stores/scoring/injection, NOT `MemoryRecord` conflict resolution, lifecycle controls, or procedural experience; LLM enrichment (NoteTagger/NoteQA/NoteChatConverter/NoteFileSync/NoteMaintenance, CAT/LLM-WIKI/SYNC/NMEM/WIKI-ID serialization) = Phase 9 — Phase 8 ships LinkParser + NoteGraph + the save-path seam (Flow 3 minus the LLM pipeline); MemoryRecord conflict resolver (O.4) = Phase 10; live chat/agent adoption of `memoryHints` in AgentOrchestrator/useChatStreaming stays deferred (D-69/D-81 create-only discipline — the E2E path is proven by tests, not a live call-site); the `search-notes` **tool registration** (TOL-01) = Phase 18 — Phase 8 provides the index + query, not the tool; full Notes UI in `NotesWorkspace` = Phase 15 — Phase 8 ships the three components' **core logic**; note `.md` sync + OKF serialization = Phase 9 (OKF-WIKI-04 boundary stays). verify:phase-8 re-point (D-92/D-103 analog) is in scope.

**Research-driven notes:** the `verify:phase-8` gate currently targets `tests/core/content tests/addons tests/isolation` (Phase 6/17 territory) and must be re-pointed to the §18 dirs — spec §24 canonical (spec 3612): `tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`. The canonical `Note` interface (spec 4721) is richer than the Phase-2 `NotesDB.Note` placeholder (spec 3290 vs the simplified bootstrap shape at `src/core/storage/NotesDB.ts`) — Phase 8 supersedes to the canonical type with `src/types/notes.ts` as the canonical home (spec 4720). Memory types: `RetrievedMemory`/`UserPreferences` canonical home is `src/core/memory/types.ts` (spec 4571-4595); `WorkingMemory` canonical home is `@/types/harness` (spec 4839 row, Appendix O.10 imports it). `ContextOptimizerInput.memoryHints: RetrievedMemory[]` already exists (Phase 5) and the Phase-7 trust layer already builds the `[MEMORY]` section from `input.memoryHints` (D-94: trust:'retrieved', authority:false) — Phase 8 supplies the **producer** of that seam.
</domain>

<decisions>
## Implementation Decisions

### Memory store placement — §23 split (metadata/local, bodies/IDB)
- **D-104 (Memory storage follows the §23 split — metadata/LRU indices in chrome.storage.local, bodies in MemoryDB):** UserMemoryStore facts persist to **MemoryDB.userFacts** (the Phase-2 foundation store) as the body store; `chrome.storage.local` `np_facts` (max 500, LRU — §15.1) holds the small metadata/LRU index over those facts (ids + recency + useCount). ConversationMemoryStore: **`np_conversation_meta`** (chrome.storage.local) holds the LRU conversation metadata; message **bodies live in MemoryDB.messages** (§3.3 "store message bodies in IndexedDB only"); summaries persist to **MemoryDB.conversationSummaries**. PreferenceMemoryStore: **`np_persona`** (chrome.storage.local, §15.1) holds PersonaProfile + overrides — persona is small config, never a fact (R2). Working memory (§3.6): the budget-capped markdown block persists with the user-facts metadata (small, ≤300 tokens, single-writer, TraceRedactor'd) per Appendix O.10. — **Reversibility:** `costly` — rationale: storage-home assignment is cross-store; moving bodies between IDB and chrome.storage.local later touches the store adapters + LRU wiring.

### MemoryEngine scope — create-only producer (D-69/D-81 discipline)
- **D-105 (MemoryEngine is create-only — it supplies `memoryHints`/preference-profile producers proven by tests; live chat adoption stays deferred):** §18 Phase 8 lists memory files + notes files + the three components and NO ContextOptimizer/AgentOrchestrator modification. MemoryEngine exposes `retrieveConversationMemory()`, `retrieveUserMemory()` (top-5 / top-3 tiny / ≤1000 tokens / never secrets — §3.4), `buildPreferenceProfile()` (compact JSON incl. persona overrides, §3.5), and `retrieveMemoryHints()` producing the `RetrievedMemory[]` the Phase-7 trust layer already consumes. All proven by the §18 required tests + fixture suites. The live AgentOrchestrator/useChatStreaming call-sites that feed `ContextOptimizerInput.memoryHints` are NOT wired here (Phase 15 RICH + NMEM consumers in Phase 9 feed them). The E2E "Page → PageContentService → Note → MiniSearch" path is proven by a service-level test (PageContext → Note creation → NotesDB.put → index upsert → query), not a shipped UI call-site. — **Reversibility:** `reversible` — rationale: additive producer modules; wiring later is a caller edit.
- **D-106 (Conversation summarisation ships as a seam, proven with a deterministic stub):** §3.3 keep last 2/4/6 turns per tier; §15.3 compactor fires at `messageCount % 12 === 0` → keep head (system + first 2) + summary of middle + tail (last 4); archive after 30 min idle; LRU max 10 active / 100 archived (evict-conversation via WriteJournal). MemoryEngine/ConversationMemoryStore implement the compactor rules with the **summariser as a pluggable seam**; tests inject a deterministic stub summariser (the real LLM summariser wiring is a later phase — the M2 rolling observation refinement is preserved as the seam's contract). The 12-message rule, LRU caps, and archive-after-30-min are spec-verbatim (§15.3). — **Reversibility:** `reversible` — rationale: seam + deterministic tests; swapping the stub for an LLM call is a wiring edit.

### Note canonical type + NotesDB reconciliation
- **D-107 (Canonical `Note` home is `src/types/notes.ts`; NotesDB re-exports it — D-72/D-83 precedent):** The Phase-2 `NotesDB.Note` (simplified: `source: string`, no `unresolvedLinks`/`summary`/`categoryPath`/`type`) is superseded. `src/types/notes.ts` becomes the canonical home carrying the spec §21.2 `Note` verbatim (spec 4721-4741: `links[]` = resolved note IDs, `unresolvedLinks[]`, `source` object with `kind`, `aiMeta` with `suggestedLinks`/`concepts`, `summary?`, `categoryPath?`, `type?: string`, `version`) + `OKF_NOTE_DEFAULT_TYPE` + `OkfNoteFrontmatter` + the LLM-WIKI-11 suggestion-gating constants (spec 4758-4762, declared for Phase 9). `src/core/storage/NotesDB.ts` re-exports/imports the canonical type so its `put`/`get` value shape is the canonical Note (D-72 re-export; no parallel copy). No DB migration in Phase 8 — idb value shapes are schema-flexible and the fields are additive; the v4 migration (adds `tags`/`summary` to the notes index + Note `type` population) is Phase 9 (spec 3156). — **Reversibility:** `costly` — rationale: type-home move + NotesDB value-shape change touches every NotesDB consumer and test fixture once, then converges (D-83 precedent cost).
- **D-108 (`Note.type?: string` is declaration-only in Phase 8):** the OKF-aligned field is added to the canonical Note interface and type-checks; NO reader/writer consumes it, no serialization, no migration, no LLM behavior change (spec 2675 DONE-when append — Phase 9 owns population + serialization). Same for `categoryPath` (declared here, populated Phase 9). — **Reversibility:** `reversible` — rationale: additive optional field; Phase 9 fills it.

### MiniSearchIndex — persistent notes wrapper (distinct from the Phase-6 ephemeral page index)
- **D-109 (MiniSearchIndex is a per-surface lazy/memoized persistent notes index, updated incrementally on `note:saved`):** wraps NotesDB into a MiniSearch index with fields `title` + `content` + `tags` (+ `summary` seam for when Phase 9 populates it) per the `search-notes` contract (spec 1608). Built lazily on first query; **upserted incrementally** on the `EventBus` `note:saved` event (Flow 3 emit); deletion removes the note's document. Never persisted to IndexedDB — the index is rebuilt from NotesDB on surface boot (same never-persisted posture as the Phase-6 `PageIndexBuilder`, but persistent within the surface lifetime and over the notes store, not per-tab ephemeral). Perf gate: `< 50 ms over 1,000 notes` (spec 3481) — asserted by a test that indexes 1,000 synthetic notes and queries. — **Reversibility:** `reversible` — rationale: additive wrapper; rebuilding strategy is a local edit.
- **D-110 (Wikilink resolution is ID-based with the spec tie-break; unresolved links tracked):** `LinkParser.parseLinks` extracts `[[Title]]` targets from the markdown body; `resolveLinks` maps each to a note ID via the **resolution order (exact title match → `updated` desc → `id` asc, WIKI-ID-02)**. Resolved targets go to `links[]` (IDs); raw targets with no matching note go to `unresolvedLinks[]` (WIKI-ID-03, rendered distinctly by Phase-15 UI). Deleting a note does NOT rewrite source bodies — dangling edges demote back to `unresolvedLinks[]` at next save/graph rebuild (WIKI-ID-04). The save-path core (Flow 3 minus the LLM pipeline): `LinkParser.parseLinks → resolveLinks → NotesDB.put → EventBus.emit('note:saved')` — proven by tests; the note:saved handler upserts the MiniSearchIndex (D-109). — **Reversibility:** `reversible` — rationale: pure functions + graph ops; the save-wiring later is a caller edit.

### NoteGraph + components (core logic, not the Phase-15 Notes UI)
- **D-111 (NoteGraph ships §22.3 cosine similarity + backlinks core; components carry core logic):** NoteGraph exposes `topKSimilar(note, k = 5)` — bag-of-words cosine, tokenise `content.toLowerCase().match(/[a-z0-9]{3,}/g)`, inline fixed 50-word English stop-word list (shipped inline in NoteGraph.ts per spec 3511), per-note term-frequency map, `cosine = dot(a,b) / (||a|| * ||b||)`, ties broken by `updated` desc then `id` asc (spec 3508-3514). Backlinks are a reverse index over `links[]`. The three `.tsx` files ship their **core logic** (backlink listing data, wikilink autocomplete = MiniSearch title matching per D-04 — no LLM suggestions in v0.1, graph adjacency/rendering data) as thin components; the full `NotesWorkspace` UI integration is Phase 15. — **Reversibility:** `reversible` — rationale: core-logic modules + thin components; Phase 15 consumes them.

### RICH-R-05 persona persistence + UserPreferences supersession
- **D-112 (PreferenceMemoryStore owns `np_persona`; full §3.5 UserPreferences supersedes the Phase-3 minimal shape):** PreferenceMemoryStore persists **`np_persona`** (PersonaProfile + `personaId` + `personaOverrides`, §3.5 / R2) to chrome.storage.local — never the fact store. The Phase-3 minimal `UserPreferences` (src/core/ai/UserPreferences.ts) is superseded to the full §3.5 shape (responseStyle / preferredLanguage / preferStructuredOutput / allowCloudFallbackFromLocal / defaultProviderId? / toolAutonomy / defaultSurface / personaId? / personaOverrides?) at the canonical home **`src/core/memory/types.ts`** (spec 4579-4595, the declared supersession point from Phase 5's context/types.ts:8 and Phase 3's UserPreferences.ts:1-6). Existing consumers (`PersonaInjector`, `ContextOptimizer`, `PromptCacheManager`, `AgentOrchestrator`) keep resolving via the re-export (D-72/D-83 precedent); `fastModel`/`balancedModel` (D-54) remain additive preference fields. PersonaInjector continues to read overrides — now sourced from PreferenceMemoryStore/np_persona, not a fact store (R2, spec 121). Hydration on boot re-reads np_persona. — **Reversibility:** `costly` — rationale: supersession touches the Phase-3 UserPreferences contract + consumers; the D-72 re-export keeps it converging, but the shape move is the one-way-ish part (full §3.5 shape is the locked supersession target per spec 4579).

### MemoryScorer + MemoryExtractor
- **D-113 (MemoryScorer is the §3.4 scoring formula verbatim; MemoryExtractor is a schema+seam, LLM wiring in Phase 9):** MemoryScorer computes the exact weighted blend (spec 618-628: keyword 0.45 · tag 0.25 · recency 0.15 · useCount 0.10 · confidence 0.05), every sub-score normalised to [0,1] (ROADMAP SC#3); recency window = 30 days. MemoryExtractor ships the memory-fact extraction **schema + parse seam** (memoryFacts with confidence, mirroring the `NoteTagResultSchema`/`ConfidentFact` shape at spec 4764-4773); the actual LLM extraction call + NMEM-02 upsert wiring is Phase 9 (spec 3876). — **Reversibility:** `reversible` — rationale: verbatim formula + additive schema; Phase 9 wiring is a caller edit.

### Verification gate
- **D-114 (Re-point `verify:phase-8` to the §18 required test dirs — D-92/D-103 analog):** package.json `verify:phase-8` currently targets `tests/core/content tests/addons tests/isolation` (Phase 6/17 territory). Re-point to the §18 canonical gate string (spec 3612 verbatim): `tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`. — **Reversibility:** `reversible` — rationale: package.json script edit (D-68/D-78/D-92/D-103 precedent).

### the agent's Discretion
- Exact `src/core/memory/` layout (one file per §18 name vs a barrel `index.ts` — mirror `src/core/ai/` convention); whether `src/core/memory/types.ts` holds `RetrievedMemory` + `UserPreferences` only, or also local store types (idb row shapes).
- Whether the note-save core lives in `LinkParser.ts`/`NoteGraph.ts` or a small `notes/save.ts` seam — either satisfies Flow 3 minus the LLM pipeline (D-110).
- Whether `MiniSearchIndex` reuses the Phase-6 `PageIndexBuilder` field/chunk conventions or defines its own note-document shape (both satisfy the `<50 ms/1,000 notes` gate).
- Whether WorkingMemory (Appendix O.10) is a `src/core/memory/WorkingMemory.ts` module + `@/types/harness` type (O.10 exact shape) or folded into `UserMemoryStore.ts`.
- Whether `EventBus` `note:saved` is a declared event type now (Phase 8 emitter) vs Phase 9 (both satisfy D-109's incremental upsert).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 8 block, lines 2656-2696) — Create list, required tests, DONE-when, OKF type-declaration note, E2E path. Sole authority on Phase-8 scope.
- `.planning/PRODUCT_SPEC_v0_1.md` §3.1-3.6 (lines 546-694) — the whole memory chapter: principle, framework (no LangChain/embeddings), ConversationMemory, UserMemoryFact + **scoring formula** (D-113), UserPreferences (D-112), WorkingMemory (D-106/D-104).
- `.planning/PRODUCT_SPEC_v0_1.md` §15.1 (lines 1938-1962) — storage keys: `np_facts` (max 500 LRU), `np_persona`, `np_conversation_meta` (D-104/D-112).
- `.planning/PRODUCT_SPEC_v0_1.md` §15.3 (lines 2005-2010) — LRU eviction + 12-message compactor + archive-after-30-min (D-106).
- `.planning/PRODUCT_SPEC_v0_1.md` §20.4 (line 3156) — v4 migration (Phase 9) adds `tags`/`summary` to the notes index + Note `type`; confirms Phase 8 needs no migration (D-107).
- `.planning/PRODUCT_SPEC_v0_1.md` §21.2 (lines 3287-3322) — canonical `Note` interface + knowledge-model note + OKF v0.2 note (D-107/D-108).
- `.planning/PRODUCT_SPEC_v0_1.md` §22.3 (lines 3506-3514) — NoteGraph cosine similarity + inline stop-word list + tie-break (D-111).
- `.planning/PRODUCT_SPEC_v0_1.md` §26.5 (line 3774) — two distinct MiniSearch index instances: ephemeral page index (Phase 6) vs persistent notes index (Phase 8); they never share storage (D-109).
- `.planning/PRODUCT_SPEC_v0_1.md` §27.7a WIKI-ID-01…04 (lines 3899-3904) — immutable UUID identity, `[[Title]]` syntax, ID-based edges, resolution tie-break, unresolved links, deletion demotion (D-110).
- `.planning/PRODUCT_SPEC_v0_1.md` Flow 3 (line 1690) — the save pipeline: `LinkParser.parseLinks → resolveLinks → NotesDB.put → EventBus.emit('note:saved')` + the Phase-9 additions (NoteTagger/NMEM-02/NoteFileSync) (D-110).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 canonical-type-home rule (lines 4833-4845) — `WorkingMemory`/`MemoryRecord`/`ProceduralExperience` → `@/types/harness`; `RetrievedMemory`/`UserPreferences` → `@/core/memory/types` (D-104/D-112).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 memory types (lines 4900-4920) — `MemoryKind`/`MemoryRecord` are **Phase 10** (MEM-01…05); Phase 8 must not build them (scope fence).
- `.planning/PRODUCT_SPEC_v0_1.md` spec 4571-4595 — `RetrievedMemory` + full `UserPreferences` canonical home `src/core/memory/types.ts` (D-112).
- `.planning/PRODUCT_SPEC_v0_1.md` spec 4720-4774 — `src/types/notes.ts` canonical Note + OKF frontmatter + suggestion-gating constants (D-107).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix O.10 (lines 6596-6622) — Working-memory updater worked example (`src/core/memory/WorkingMemory.ts`, budget-capped/single-writer/redacted, imports from `@/types/harness`) (D-104/D-106).
- `.planning/PRODUCT_SPEC_v0_1.md` §24 (line 3612) — canonical `verify:phase-8` gate string (D-114).
- `.planning/PRODUCT_SPEC_v0_1.md` §10.5 (line 1608) — `search-notes` tool: MiniSearch over notes (title + content + tags + summary); tool registration is Phase 18, index+query is Phase 8 (D-109).
- `.planning/PRODUCT_SPEC_v0_1.md` §2.3 (lines 463-489) — `ContextOptimizerInput.memoryHints: RetrievedMemory[]` (the seam Phase 8's MemoryEngine produces for, D-105).
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §5.2 — MV3 boundaries: memory/AI run in UI contexts only, never the background SW (D-105).
- `.planning/PRODUCT_SPEC_v0_1.md` §23 (line 3554) — "Memory storage: Metadata in chrome.storage.local; bodies in MemoryDB" (D-104).

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 8: Knowledge Base (Memory + MiniSearch + Notes)" (lines 253-267) — goal, depends-on, success criteria (SC#1-5), verification gate.
- `.planning/REQUIREMENTS.md` RICH-R-05 row (line 60) + phase table row (line 695) — the sole v1 requirement (D-112).
- `.planning/phases/07-trust-aware-context-and-receipts/07-CONTEXT.md` — D-94 ([MEMORY] → trust:'retrieved', authority:false — the consumer of Phase-8 memoryHints), D-93 (item pipeline), the "adoption waits until memoryHints exists (Phase 8)" note, D-103 gate-re-point precedent.
- `.planning/phases/06-pagecontentservice-knowledge-acquisition/06-CONTEXT.md` — D-87 (persistent notes MiniSearch wrapper is Phase 8, NOT Phase 6), D-88/D-89 cache, D-92 gate re-point precedent.
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-CONTEXT.md` — PersonaProfile/DEFAULT_PERSONA seeded code-only (np_persona is Phase 8, RICH-R-05); the Phase-3 UserPreferences supersession note (D-112).
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-CONTEXT.md` — MemoryDB/NotesDB foundation stores (D-41/D-42) that Phase 8 writes through (D-104/D-107).
- `.planning/STATE.md` — decision 17 (strict ceiling → new Phase-8 code strict-clean, zero NP-STRICT markers), watch items VAI-04 (re-query npm versions at install — minisearch/idb per STACK), decision 11 (WIKI-ID UUID identity, ADR-NOTE-01).

### Codebase maps (refreshed 2026-08-18)
- `.planning/codebase/ARCHITECTURE.md` — per-surface module singletons; `src/core/` UI-framework-agnostic; MemoryEngine is a side-panel/standalone surface singleton, never background SW.
- `.planning/codebase/STACK.md` — minisearch ^7 + idb v8 (Phase 2) installed; zod ^3.24; no embedding downloads (spec §3.2); versions re-verified via VAI-04.

### Source (integration targets — the Phase-8 consumer/producer contracts)
- `src/core/storage/NotesDB.ts` — the Phase-2 `NotesDB.Note` placeholder (superseded to `src/types/notes.ts`, D-107); `openNotesDB`, notes/concepts stores.
- `src/core/storage/MemoryDB.ts` — messages / userFacts / conversationSummaries stores (D-104 write targets).
- `src/core/storage/WriteJournal.ts` + `src/core/storage/WriteJournalDB.ts` — the `evict-conversation` operation §15.3 requires (D-106).
- `src/core/context/types.ts` (lines 25-32) — the `RetrievedMemory` supersession point → `src/core/memory/types.ts` (D-112).
- `src/core/ai/UserPreferences.ts` — the Phase-3 minimal UserPreferences supersession point (D-112).
- `src/core/context/ContextOptimizer.ts` (line 55) — `memoryHints: RetrievedMemory[]` input (Phase 8's producer seam, D-105).
- `src/core/context/trust/contextItems.ts` (lines 70-79) — builds the `[MEMORY]` section from `input.memoryHints` (D-94; Phase 8 supplies the data).
- `src/core/ai/persona/PersonaInjector.ts` + `PersonaProfile.ts` — reads overrides (now sourced from PreferenceMemoryStore/np_persona, R2, D-112).
- `src/core/ai/PromptCacheManager.ts` (lines 66, 165) + `src/core/ai/AgentOrchestrator.ts` (line 73) — consumers of `UserPreferences.personaOverrides` (D-112 keep resolving).
- `src/core/extraction/PageIndexBuilder.ts` — the Phase-6 ephemeral index pattern MiniSearchIndex models (never-persisted, lazy) against but does NOT reuse storage (D-109).
- `src/core/events/EventBus.ts` — the `note:saved` emit/subscribe surface (D-109/D-110).
- `src/types/harness.ts` — canonical home for `WorkingMemory` (Appendix C.1, spec 4839) (D-104).
- `src/components/notes/NotesWorkspace.tsx` — the Phase-1 scaffold the Phase-8 components' core logic plugs into at Phase 15 (scope fence).
- `tests/core/storage/IndexedDBMigrator.test.ts` + `tests/setup.ts` — fake-indexeddb setup + the migrator test conventions the memory/notes DB tests follow.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/storage/MemoryDB.ts` — `messages` (compound key `[conversationId, seq]`), `userFacts` (keyPath `id`), `conversationSummaries` (keyPath `conversationId`) stores already exist from Phase 2 — MemoryEngine's stores write through them (D-104).
- `src/core/storage/NotesDB.ts` — `notes` (keyPath `id`, indexes byTitle/byUpdated) + `concepts` stores; `getNoteByTitle` already declared — the resolve-links lookups and MiniSearchIndex seed use them (D-107/D-109/D-110).
- `src/core/context/ContextOptimizer.ts` + `src/core/context/trust/contextItems.ts` — `memoryHints: RetrievedMemory[]` input + the `[MEMORY]` section builder (D-94) already shipped; MemoryEngine is the producer (D-105).
- `src/core/ai/persona/PersonaProfile.ts` — `PersonaProfileSchema` + `DEFAULT_PERSONA` (code-seeded, RICH-R-01); PreferenceMemoryStore persists this to `np_persona` (D-112).
- `src/core/ai/UserPreferences.ts` — Phase-3 minimal store (`np_preferences`) + `personaOverridesSchema` — the supersession point the full §3.5 shape replaces at `src/core/memory/types.ts` (D-112).
- `src/core/extraction/PageIndexBuilder.ts` — the Phase-6 lazy/memoized/never-persisted MiniSearch pattern (field set, chunking, top-k) that MiniSearchIndex mirrors at the notes layer (D-109).
- `src/core/events/EventBus.ts` — existing in-surface event surface for the `note:saved` emit/subscribe (D-109).
- `src/types/harness.ts` — canonical type home for `WorkingMemory` (spec 4839); existing reliability + trust types set the verbatim-declaration convention (D-104).
- `tests/setup.ts` — fake-indexeddb wired; memory/notes DB tests reuse the Phase-2 migrator-test conventions.

### Established Patterns
- **Create-only discipline (D-69/D-81/D-105)** — Phase 8 produces memory/notes seams proven by tests; live chat/AgentOrchestrator adoption deferred; no ContextOptimizer/AgentOrchestrator edit.
- **Verbatim spec shapes (D-38/D-113)** — scoring formula, LRU caps, tie-break, cosine algorithm, Note interface, UserPreferences — no invented fields/codes/weights.
- **Canonical type home + re-export supersession (D-72/D-83/D-107/D-112)** — `src/types/notes.ts` and `src/core/memory/types.ts` become canonical; old files re-export so existing imports keep resolving.
- **Metadata-local / bodies-IDB split (§23/D-104)** — chrome.storage.local holds small metadata/LRU/config (np_facts index, np_conversation_meta, np_persona); IndexedDB holds bodies.
- **Single-writer + primary surface (§13/D-106)** — memory writes (working memory, conversation compactor, fact upserts) gate on the primary surface; the Phase-2 WorkspaceElection `isPrimaryWriter()` is available.
- **Gate re-pointing (D-68/D-78/D-92/D-103/D-114)** — `verify:phase-8` edited in package.json to the §18 canonical gate string.
- **TraceRedactor before any persistence/logging (§4.4, D-90)** — memory bodies, working-memory block, and note content pass through redaction before IDB/chrome.storage writes (O.10 redacts the working block).

### Integration Points
- `MemoryEngine.retrieveMemoryHints()` → `RetrievedMemory[]` → (Phase 7 trust layer already consumes) → `ContextOptimizerInput.memoryHints` — the producer seam (D-105).
- `LinkParser.parseLinks → resolveLinks → NotesDB.put → EventBus.emit('note:saved')` → MiniSearchIndex upsert — the Flow-3-minus-LLM save core (D-110/D-109).
- `NoteGraph.topKSimilar` + backlinks → the three note components' core logic → Phase-15 NotesWorkspace UI (D-111).
- `PreferenceMemoryStore` (np_persona) → `PersonaInjector`/`PromptCacheManager`/`AgentOrchestrator` via the re-exported full `UserPreferences` (D-112).
- `verify:phase-8` script in package.json → re-point to `tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` (D-114).
</code_context>

<specifics>
## Specific Ideas

- **"Memory is system-owned; the LLM does not own it" (§3.1)** is the phase's spine — MemoryEngine orchestrates, the LLM never writes memory directly; persona is user *config* in `np_persona`, never a fact (R2, D-112).
- **Two MiniSearch indexes, never shared** — the ephemeral per-tab page index (Phase 6) and the persistent notes index (Phase 8) are distinct instances; notes never go into the page index and page chunks never into the notes index (D-109, spec 3774).
- **Create-only for the pipeline, real for the stores** — MemoryEngine/MiniSearchIndex/NoteGraph are real, working, tested modules; only the *live* chat/AgentOrchestrator wiring and the NotesWorkspace UI are deferred (D-105/D-111).
- **The tie-break is the contract** — wikilinks resolve exact-title → updated-desc → id-asc; edges are IDs, never titles, so rename can't break an edge (WIKI-ID-01/02, D-110).
- **Declared-now, populated-later** — `categoryPath` and `Note.type?: string` are declared in Phase 8, populated/serialized in Phase 9 (OKF alignment, D-108).
- **NP-STRICT ceiling → 0** — new Phase-8 code must be strict-clean; zero new `@ts-expect-error NP-STRICT` markers (STATE.md decision 17).
- **No invented requirement IDs / error codes** — RICH-R-05 is the phase's only v1 requirement; MemoryScorer weights and LRU caps are spec-verbatim (D-113/D-106).
- **verify:phase-8 gate mis-pointing must be fixed** — the gate must run `tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` (D-114).
</specifics>

<deferred>
## Deferred Ideas

- **Memory governance (MEM-01…05, KNW-01)** — Phase 10: `MemoryRecord` conflict resolution (O.4), lifecycle controls (pin/forget/expiry), procedural experience, edge provenance. Phase 8 ships the stores + scoring only.
- **LLM enrichment + filesystem sync** — Phase 9: NoteTagger/NoteQA/NoteChatConverter/NoteFileSync/NoteMaintenance, CAT/LLM-WIKI/SYNC/NMEM-01…03, OKF serialization, `search-notes` RAG.
- **Live `memoryHints` adoption in AgentOrchestrator/useChatStreaming** — deferred (D-69/D-105); Phase 15 RICH + Phase 9 NMEM consumers feed the seam.
- **Full Notes UI in `NotesWorkspace`** (list/editor/backlinks/graph/search) — Phase 15.1; Phase 8 ships component core logic.
- **`search-notes` / `create-note` tool registration** — Phase 18 (TOL-01 tool manifests); Phase 8 ships the index + save core.
- **Real LLM summariser for the 12-message compactor** — later phase; Phase 8 proves the seam with a deterministic stub (D-106).
- **LLM wikilink autocomplete suggestions** — not in v0.1 (D-04); MiniSearch title matching is sufficient (D-111).
- **Embedding-based retrieval** — deferred per §3.2 (no embedding downloads); MiniSearch + cosine is the v0.1 mechanism.

None of these belong in Phase 8 — discussion stayed within phase scope.

</deferred>

---
*Phase: 8-Knowledge Base (Memory + MiniSearch + Notes)*
*Context gathered: 2026-09-01*