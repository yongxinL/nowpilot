# Phase 5: Knowledge Base (Memory + MiniSearch + Notes) - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the persistent knowledge layer. Users write **atomic notes** with wikilinks (`[[…]]`), browse a **note graph** (d3-force) and **backlinks** in the Standalone Notes view, **full-text search** notes via MiniSearch (< 50 ms over 1,000 notes), and benefit from **budgeted conversation/user/preference memory** injection (top-5 / top-3 tiny, ≤ 1000 tokens, scores in [0,1], preference profile as compact JSON incl. persona overrides). It also completes the end-to-end **Page → PageContentService → Note → MiniSearch** path.

Concretely (spec §18 Phase-5 create list, lines 2752–2790): `MemoryEngine` + `ConversationMemoryStore` + `UserMemoryStore` + `PreferenceMemoryStore` (np_persona writer moves here) + `MemoryScorer` + `MemoryExtractor` under `src/core/memory/`, the persistent `MiniSearchIndex` under `src/core/search/`, `LinkParser` + `NoteGraph` under `src/core/notes/`, and the Notes UI: `BacklinksPanel`, `WikilinkAutocomplete`, `NoteGraphView` (core logic) under `src/components/notes/`.

**Scope authority (G0):** Spec-authoritative. Phase 5 = the §18 Phase-5 block (KNW-01…05) + the §3 persistent-memory architecture (conversation/user/preference/working memory) + §26.5 MiniSearch integration + §21.2/§21.3/§21.4 data models (already landed in `NotesDB.ts`/`MemoryDB.ts` in Phase 2) + `verify:phase-5` (spec line 3685).

**Boundary notes:**
- **Notes UI = core logic in `src/components/notes/`; editor already exists as a no-op placeholder** — `NotesPage.tsx` renders the UI-SPEC E5 empty state with a no-op "New note" CTA (D-15, Phase 1). Phase 5 replaces the placeholder with the real editor + list + graph.
- **Memory injection wires into the existing seam** — `ContextOptimizerInput.memoryHints: RetrievedMemory[]` (already in `src/core/ai/types.ts`); the hook currently passes `memoryHints: []`. Phase 5 feeds real retrieved memory here. Golden Rule 3: the hook imports a core builder, no prompt assembly in the hook.
- **LLM-Wiki (NoteTagger/NoteQA/NoteChatConverter/NoteFileSync) is Phase 5a, NOT here.** Phase 5 ships the atomic-note core + memory engine + MiniSearch index only. The `categoryPath` field exists on `Note` (already in `NotesDB.ts`) but is populated in 5a.
- **Memory = system-owned (§3.1).** The LLM does not own persistent memory. Single-writer on the primary surface (§13) — memory never auto-writes notes (D-05); notes→memory direction exists only via the LLM-Wiki MemoryExtractor schema in Phase 5a.
- **Working memory (§3.6)** — the always-on Markdown block lives in `UserMemoryStore` (inferred artefact, ≤ 300 tokens), NOT persona. Persona is user config in `PreferenceMemoryStore` (`np_persona`), R2/R-7.
- **R-3:** memory + IndexedDB + MiniSearch all live in Side Panel/Standalone only; background SW untouched.
- **No new packages** — MiniSearch (`minisearch ^7`, approved stack) + d3-force (`d3-force ^3`, approved) only; no embeddings, no vector DB (deferred per §3.2/§26.5).

</domain>

<decisions>
## Implementation Decisions

### Memory Stores & Ownership (KNW-04)
- **D-05-01 [store paths verbatim]:** The six memory modules land at the §18/§8.5 paths (`src/core/memory/{MemoryEngine,ConversationMemoryStore,UserMemoryStore,PreferenceMemoryStore,MemoryScorer,MemoryExtractor}.ts`). R-1 — no invented paths. `RetrievedMemory`/`UserPreferences` stay in `src/core/memory/types.ts` (C.1 home, already seeded in Phase 3); the stores import (never re-declare) them.
- **D-05-02 [MemoryEngine = single orchestrator]:** `MemoryEngine` is the ONLY entry point surfaces use for memory read/write (§3.2). It owns: store dispatch, scoring (via MemoryScorer), summarisation (via the existing 12-message compactor rules §15.3), budget enforcement, and injection assembly. Surfaces never talk to the individual stores directly. Single-writer on the primary surface (§13), cross-surface via BroadcastBus primary election (§17.6/§20.10, Standalone tie-break).
- **D-05-03 [ConversationMemoryStore]:** Per-conversation rolling summary + recent turns (§3.3, `ConversationMemory` shape). Rules: last-2 turns tiny / 4 small / 6 medium-large; summarise older after every 12 messages; message bodies in IndexedDB only (reuse `MemoryDB` `MemoryMessage` row — already `conversationId+seq` keyed, Phase 2). LRU per §15.3 (10 active / 100 archived, archive after 30 min idle, evict via `evict-conversation` WriteJournal op).
- **D-05-04 [UserMemoryStore]:** Cross-session fact/preference/pattern memory (§3.4 `UserMemoryFact` shape: id/content/type/tags/confidence/source/createdAt/updatedAt/lastUsedAt/useCount). Working memory (Appendix O.10 block, ≤ 300 tokens) lives here as `source: 'inferred'` (D-05-09). Write paths never throw (PATTERNS Shared Pattern 1); every catch calls debugLog with a canonical code (GR-9).

### Memory Scoring & Injection (KNW-04, KNW-05)
- **D-05-05 [MemoryScorer = §3.4 verbatim weights]:** `score = keywordScore*0.45 + tagScore*0.25 + recencyScore*0.15 + useCountScore*0.10 + confidenceScore*0.05`, every sub-score normalised to [0,1] (keyword = matched/total query terms; tag = matched/max(1,tags); recency = clamp(1 − (now−updatedAt)/(30d),0,1); useCount = min(1,count/20); confidence passes through). Deterministic + pure (injectable clock for recency tests, Pitfall 6 precedent).
- **D-05-06 [injection budget]:** top-5 memories maximum, top-3 in tiny mode, total memory injection ≤ 1000 tokens (Golden Rule 6, §3.4). Never inject secrets or raw customer data (R-10 redaction precedent). Degrade per §2.4 — never truncate mid-structure.
- **D-05-07 [injection seam]:** Retrieved memory travels through the existing `ContextOptimizerInput.memoryHints: RetrievedMemory[]` (type already in `src/core/ai/types.ts`). The hook calls a core builder (Golden Rule 3); no prompt assembly in `useStreamingLLM.ts`. `MemoryEngine` produces `RetrievedMemory[]` (id/content/type/tags/score) with scores in [0,1].
- **D-05-08 [preference injection = compact JSON]:** `PreferenceMemoryStore` injects `UserPreferences` as compact JSON (incl. `personaId`/`personaOverrides`), not verbose prose (§3.5). This is what the optimizer's stable `preferences` PromptSection (Phase 4) already consumes — Phase 5 feeds it real data.
- **D-05-09 [working memory block]:** The always-on Markdown profile (§3.6, fixed template, ≤ 300 tokens, injected with the memory section BEFORE retrieved facts so it can never crowd them out) lives in `UserMemoryStore` as `source: 'inferred'`. Never blurs into persona (R2).
- **D-05-10 [MemoryExtractor = LLM stage, save-time non-blocking]:** `MemoryExtractor` (haiku tier) extracts durable facts/preferences/patterns from conversation. Runs on the primary surface only, non-blocking after the IndexedDB write (never blocks a save — Phase-5a NoteTagger precedent, §22.1 "save never waits"). Routes through PersonaInjector like every other AI stage (GR-3); the schema is the existing memoryExtractor stage schema (Phase 3 seeded the inject() across all 4 stages incl. memoryExtractor, D-11).

### MiniSearch (KNW-03, SC#5)
- **D-05-11 [persistent notes index]:** `MiniSearchIndex` = the PERSISTENT notes index (§26.5/§27) over Note `title + content + tags + summary` (+ categoryPath when 5a populates it). Distinct instance from the ephemeral page index (§26); never shares storage. `minisearch ^7`, `search` tool mapping: `{query, limit}` (spec §9.8 search-notes) → scores in [0,1].
- **D-05-12 [index lifecycle]:** Index built/rebuilt from `NotesDB` on demand (Standalone Notes view mount), kept in memory (MiniSearch is in-memory by design). Incremental add/remove on note CRUD; no durable index store in 5 (persistence = NotesDB; rebuild is cheap at ≤ 5,000 notes). < 50 ms over 1,000 notes (SC#3).
- **D-05-13 [Page → Note → MiniSearch path]:** SC#5 is satisfied when a captured page (`PageContentService` → `PageContext`, Phase 4a) can be saved as a note (`source.kind: 'page-export'`, already in the `Note` type) and that note is searchable via the persistent notes index. The save-to-note affordance itself is a plain manual "New note from page" — the LLM-drafted SaveToNoteDialog is Phase 5a (LLM-WIKI-07). No LLM involved in the 5 core path.

### Notes Core & UI (KNW-01, KNW-02, SC#1, SC#2)
- **D-05-14 [wikilink tie-break, verbatim]:** `LinkParser.parseLinks()` extracts raw `[[Title]]` targets from the markdown body (inline `[[…]]`). `resolveLinks()` maps each to a note ID via the resolution order (exact title match → `updated` desc → `id` asc, WIKI-ID-02). Resolved targets → `links[]` (IDs); original display text preserved inline; unresolved → `unresolvedLinks[]` (raw strings, rendered muted/dashed + "create note" affordance, WIKI-ID-03). On save, a bounded save-time reconciliation promotes matching `unresolvedLinks[]` → `links[]` when a new note's title matches (MiniSearch title lookup, primary surface only, never blocks save).
- **D-05-15 [notes store CRUD]:** Create/edit/save/delete through `NotesDB` (already Phase-2, `Note` + `Concept` verbatim §21.2). Note `id` = `crypto.randomUUID()` immutable (WIKI-ID-01); `title` mutable display text. Save pipeline: parseLinks → resolveLinks → NotesDB.put → EventBus `note:saved` (§20.11 Flow 3). Write paths never throw; GR-9 codes.
- **D-05-16 [editor UX]:** Real Notes page replaces the E5 placeholder. Standalone Notes view = list + editor (§21.2 col 3: title + star, body via `PortableMarkdown` — already Phase 1, wikilink + unresolved-link styling, tag chips). `WikilinkAutocomplete` (≤ 50 ms p95 ≤ 5,000 notes) offers existing titles as the user types `[[`; LLM-wikilink *suggestions* are NOT in v0.1 (D-04) — MiniSearch title matching is sufficient.
- **D-05-17 [note graph + backlinks]:** `NoteGraphView` (d3-force ^3, approved) renders notes + `links[]` edges; `BacklinksPanel` lists in-links per note. Empty states per UI-SPEC §21.2/§26 (e.g. "Create at least 3 notes to see the graph"). Node click → open note. Graph is derived (no separate graph store) — NoteGraph computes edges from `links[]`/backlink indices on demand.

### Persona Writer Migration (R-7 / R2)
- **D-05-18 [np_persona writer moves to PreferenceMemoryStore]:** Phase 3 shipped `personaConfig.ts` (D-09) as a READ-ONLY Setting accessor for `np_persona`. Phase 5's `PreferenceMemoryStore` becomes the WRITER (R2, §3.5, RICH-R-05) — persona is user config, never a fact. Keep the Phase-3 accessor working (read path unchanged) or re-route reads to the store; no behavior regression on the Phase-3 persona pipeline (PersonaInjector reads resolvePersona → readPersona/readPersonaPrefs). `UserPreferences.personaId`/`personaOverrides` stay the injected compact-JSON shape.

### Verification
- **D-05-19 [verify:phase-5 gate]:** spec line 3685 = `tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`. Follow the §24 chain template consistent with prior phases (eslint + prettier + tsc + wxt build + vitest run) in `package.json`.

### the agent's Discretion
- Exact MemoryEngine public API surface (assemble/inject/update/subscribe) — single-entry orchestration, keep it minimal and pure.
- Exact store hydration + memory section assembly mechanics inside ContextOptimizer/ContextPack (`memoryHints` → `memory`/`preferences` sections).
- Exact MiniSearch field weights / `prefix`/`fuzzy` options for title+content+tags+summary.
- Exact NoteGraph d3-force layout params + node/edge styling (dark/light theme tokens).
- Exact working-memory Markdown template (Appendix O.10 fixed template, ≤ 300 tokens).
- Exact `verify:phase-5` script shape (follow the §24 chain + spec line 3685).
- Whether the Phase-5 save-to-note entry point lives in the Notes page toolbar, the page feed, or both.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec (authoritative)
- `.planning/PRODUCT_SPEC_v0_1.md` §18 Phase 5 block (lines 2752–2790) — create list (MemoryEngine, Conversation/User/PreferenceMemoryStore, MemoryScorer, MemoryExtractor, MiniSearchIndex, LinkParser, NoteGraph, notes UI core logic), required tests, DONE-when (conversation summary + recent turns; user memory top-5/top-3 tiny; preference compact JSON incl. persona; scores in [0,1]; MiniSearch < 50 ms over 1,000 notes; wikilinks resolve with tie-break; end-to-end Page→PageContentService→Note→MiniSearch; verify:phase-5).
- `.planning/PRODUCT_SPEC_v0_1.md` §3 Persistent Memory Architecture (lines 536–684) — §3.1 system-owned memory + three layers; §3.2 framework (MiniSearch + MemoryEngine, no LangChain/embeddings); §3.3 ConversationMemory shape + turn/summarise rules (incl. M2 rolling-summary enhancement); §3.4 UserMemoryFact + retrieval scoring weights + injection rules (top-5/top-3 tiny/≤1000 tokens/never secrets); §3.5 UserPreferences compact-JSON injection + np_persona home; §3.6 WorkingMemory Markdown block (≤300 tokens, Appendix O.10).
- `.planning/PRODUCT_SPEC_v0_1.md` §15.1 + §15.3 LRU Eviction (MemoryEngine) (lines ~1954–1986) — NotesDB/MemoryDB store layout, np_conversation_meta/np_facts (max 500 LRU), 10-active/100-archived conversations, 12-message compactor (keep head + LLM summary of middle + tail last 4), archive after 30 min idle, evict via WriteJournal.
- `.planning/PRODUCT_SPEC_v0_1.md` §20.11 Flow 3 Save a Note + §20.12 Note Sync State (lines 1669–1700, 3324) — save pipeline (parseLinks → resolveLinks → NotesDB.put → note:saved event); LLM-Wiki pipeline note (NoteTagger/MemoryExtractor/NoteFileSync) marked Phase 5a.
- `.planning/PRODUCT_SPEC_v0_1.md` §21.2 Note (lines 3357–3384) — Note + Concept types VERBATIM (already in NotesDB.ts); notes live in IndexedDB not chrome.storage.
- `.planning/PRODUCT_SPEC_v0_1.md` §21.3/§21.4 Conversation Metadata + Memory Bodies (lines 3401–3419) — MemoryMessage (conversationId+seq) + Fact types (already in MemoryDB.ts).
- `.planning/PRODUCT_SPEC_v0_1.md` §26.5 MiniSearch integration (lines ~1075–1098) — persistent notes index vs ephemeral page index (distinct instances, never shared storage), 2,000-token page budget + selectRelevant topk, minimal-mode routing.
- `.planning/PRODUCT_SPEC_v0_1.md` §22.1 Performance Targets (lines 3550–3572) — MiniSearch < 50 ms over 1,000 notes; wikilink autocomplete < 50 ms p95 ≤ 5,000 notes; resolveLinks < 20 ms.
- `.planning/PRODUCT_SPEC_v0_1.md` §27.1 Notes Methodology + WIKI-ID-01..03 (lines ~3876–3888) — atomic notes + wikilinks core; immutable note ID; `[[Title]]` → note ID via resolution order (exact title → updated desc → id asc); unresolved links rendered distinctly + create-note affordance + save-time reconciliation.
- `.planning/PRODUCT_SPEC_v0_1.md` §9.8 search-notes tool row (line 1589) — `{ query, limit }` → MiniSearch over notes (title + content + tags + summary); the tool seam the index powers.
- `.planning/PRODUCT_SPEC_v0_1.md` §0.5 Golden Rules + §0.2 (lines ~65–226) — GR-3 (all AI calls consume an OptimizedContext via PersonaInjector), GR-4 (Zod + one repair), GR-6 (memory budgets: ≤1000 tokens/top-5/top-3 tiny, working memory ≤300), GR-9 (canonical codes), R-7 (persona in PreferenceMemoryStore not fact store), R-10 (redaction).
- `.planning/PRODUCT_SPEC_v0_1.md` §18 line 3685 — the `verify:phase-5` script definition.
- `.planning/PRODUCT_SPEC_v0_1.md` §13 (primary surface / single-writer, lines ~1785–1795) — memory writes single-writer on the primary surface; cross-surface via BroadcastBus election with version check.

### Project planning artifacts
- `.planning/ROADMAP.md` Phase 5 (lines 329–344) — goal, KNW-01…05, success criteria (note CRUD + wikilink tie-break; d3-force graph + backlinks; MiniSearch < 50 ms / 1,000 notes; memory top-5/top-3 tiny scores [0,1] + preference compact JSON incl. persona; end-to-end Page→PageContentService→Note→MiniSearch).
- `.planning/REQUIREMENTS.md` KNW-01…05 rows (lines 89–93) — atomic note-taking + wikilinks; note graph + backlinks; MiniSearch full-text; MemoryEngine budget enforcement; memory injection ≤ 1000 tokens/top-5, working memory ≤ 300.
- `.planning/phases/04b-trust-aware-context-and-receipts/04b-CONTEXT.md` — D-4b-01 (RetrievedMemory structural no-op in 4b → real data in Phase 5), D-4b-09 (memoryHints seam), the memory/tool trust envelope Phase 5 feeds.
- `.planning/phases/04-context-adaptive-execution/04-CONTEXT.md` — the `memoryHints` / `preferences` PromptSection seams ContextOptimizer already exposes (Phase 5 feeds them real data).
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-CONTEXT.md` — D-09 np_persona read-only accessor (`personaConfig.ts`, Phase-3) that Phase 5's PreferenceMemoryStore supersedes as writer; persona pipeline (PersonaInjector 4-stage inject incl. memoryExtractor); P-3b canonical type-home seeds (`RetrievedMemory`/`UserPreferences` in `src/core/memory/types.ts`).
- `AGENTS.md` — 10 golden rules, risk register (R-1 no invented paths, R-3 panel/standalone-only, R-7 persona config not fact store, R-10 redaction), approved stack (`minisearch ^7`, `d3-force ^3`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/storage/NotesDB.ts` — Phase-2 store: `Note` + `Concept` types VERBATIM §21.2 (id/title/content/created/updated/tags/links/unresolvedLinks/source/aiMeta/summary/categoryPath/version), `getNoteByTitle()` in-memory scan, non-throwing idb upgrade, GR-9 codes. All note CRUD + wikilink storage land here.
- `src/core/storage/MemoryDB.ts` — Phase-2 store: `MemoryMessage` (conversationId+seq composite key), `Fact` (id/content/confidence/source/created), `ConversationSummary`. The conversation-memory + user-memory storage substrate.
- `src/core/memory/types.ts` — C.1 canonical home for `RetrievedMemory` + `UserPreferences` (P-3b, seeded Phase 3). Stores import these; never re-declare (R-1).
- `src/core/ai/types.ts` — `ContextOptimizerInput.memoryHints: RetrievedMemory[]` (line 158) + `promptSections`/`preferences` PromptSection kinds — the memory injection seam already exists.
- `src/core/context/ContextOptimizer.ts` + `ContextPack.ts` — where `memoryHints` → `memory`/`preferences` sections happens; `reduceMemoryTopK` degradation step exists (Phase 4) — Phase 5 feeds real memory into it.
- `src/components/pages/useStreamingLLM.ts` — currently passes `memoryHints: []` (lines ~182–184) — the Phase-5 wiring target (Golden Rule 3: call a core builder).
- `src/components/pages/NotesPage.tsx` — the E5 empty-state placeholder (no-op "New note" CTA, D-15). Phase 5 replaces it with the real list + editor.
- `src/core/ai/persona/personaConfig.ts` — Phase-3 `np_persona` read-only accessor (D-09); PreferenceMemoryStore becomes the writer (D-05-18).
- `src/core/security/TraceRedactor.ts` / `redactSensitive.ts` — R-10 redaction precedent for any memory/log path (never raw sensitive text).
- `PortableMarkdown` (Phase 1) — the body renderer (wikilink + unresolved-link styling hooks, §21.2 col 3).

### Established Patterns
- **Spec-verbatim paths (§8.5/§18) + Appendix C types (R-1)** — all six memory modules + search + notes land at the §18 create-list paths; types stay in their C.1 homes.
- **Single-writer / system-owned memory (§3.1, §13)** — MemoryEngine is the one orchestration entry; surfaces never write stores directly.
- **Deterministic pure scoring** — MemoryScorer with injectable clock (Pitfall 6 precedent from 03a buildOutcome).
- **GR-3 / PersonaInjector** — MemoryExtractor is an AI stage that routes through PersonaInjector (Phase-3 D-11 4-stage inject incl. memoryExtractor).
- **GR-4 / Zod fixtures** — public store/service boundaries get Zod schema gates.
- **GR-9 / debugLog codes** — every catch uses a canonical code; write paths never throw (PATTERNS Shared Pattern 1).
- **verify:phase-N gate** — §24 chain; verify:phase-5 per spec line 3685.

### Integration Points
- `ContextOptimizerInput.memoryHints` — memory injection seam: MemoryEngine → `RetrievedMemory[]` → optimizer `memory`/`preferences` sections (D-05-07/08).
- `NotesDB` + `EventBus 'note:saved'` — note CRUD + graph re-derivation + MiniSearch incremental index (D-05-12/15).
- `useStreamingLLM.ts` — replaces `memoryHints: []` with real retrieved memory; Golden Rule 3 intact (D-05-07).
- `NotesPage.tsx` → real Notes view (list + editor + graph + backlinks + search), `src/components/notes/*` core logic (D-05-16/17).
- `personaConfig.ts` (read) + `PreferenceMemoryStore` (write) — np_persona writer migration, no Phase-3 regression (D-05-18).
- R-3: everything runs in Side Panel/Standalone only; background SW untouched.
- Phase-5a seams: NoteTagger/NoteQA/NoteChatConverter/NoteFileSync consume the note core + MiniSearch index + MemoryExtractor schema (D-05-10).

</code_context>

<specifics>
## Specific Ideas

- **Through-line (auto):** Phase 5 is the knowledge layer the product's core value depends on — notes + wikilinks + search + memory are the connective web. It ships on the Phase-2 storage substrate (NotesDB/MemoryDB already verbatim) and the Phase-4 optimizer seams; the UI surfaces the graph the user navigates.
- **P5-1 (auto):** Memory stays system-owned and single-writer (§3.1/§13); MemoryEngine is the single entry point — no store access leaks into surfaces.
- **P5-2 (auto):** Budgets are non-negotiable (Golden Rule 6) — top-5/top-3 tiny, ≤ 1000 tokens memory, ≤ 300 working memory, scores in [0,1]; degrade per §2.4, never truncate mid-structure.
- **P5-3 (auto):** MiniSearch is the one retrieval engine (no embeddings, §3.2/§26.5); the notes index is persistent in memory and cheap to rebuild.
- **P5-4 (auto):** The wikilink tie-break (exact title → updated desc → id asc) and immutable note IDs are the note-graph correctness contract (WIKI-ID-01/02/03).

</specifics>

<deferred>
## Deferred Ideas

- **LLM-Wiki enrichment** (NoteTagger auto-tags/category/summary + accept/reject, NoteQA "Ask notes" RAG, NoteChatConverter chat/page→note, NoteMaintenance orphan/staleness) — Phase 5a (LLM-WIKI-01..10, CAT-01..05).
- **Filesystem sync** (one-way .md export, restore-from-folder, delete-on-sync, external-change guard) — Phase 5a (SYNC-01..11).
- **Memory governance** (cap/decay/privacy-preserving compression, conflict precedence, view/edit/pin/forget/disable/export with provenance) — Phase 5b (MEM-01..03).
- **Durable memory indexing / vector or embedding-based retrieval** — deferred per §3.2/§26.5 (MiniSearch is sufficient for v0.1).
- **LLM wikilink autocomplete suggestions** (D-04, §27.1) — not in v0.1; manual `[[` autocomplete ships in Phase 5.
- **Prompt Inspector / durable context receipts** — Phase 6 (telemetry AITransactionLog), from the 04b receipt data.
- **Tool registration for `search-notes`** — the MiniSearchIndex powers it (D-05-11); the ExecutorService tool registration is Phase 8's ToolCapabilityManifest suite.

None — discussion stayed within phase scope; deferred items tracked above.

</deferred>

---

*Phase: 5-Knowledge Base (Memory + MiniSearch + Notes)*
*Context gathered: 2026-08-13*
