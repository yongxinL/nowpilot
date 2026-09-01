# Phase 9: LLM-Wiki & Filesystem Sync - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 extends the atomic-note-with-wikilinks core (Phase 8) with **LLM enrichment** (auto-tag/categorize/summarize, RAG "Ask notes", chat/page-to-note capture), a **hierarchical category system** mapping to filesystem folders, **Memory↔Notes integration**, and **one-way app→filesystem backup** with OKF v0.2-aligned YAML frontmatter and import-for-restore. It is the Phase-9 home of §27 (CAT-01…05, LLM-WIKI-01…11, SYNC-01…11, NMEM-01…03, WIKI-ID-01…04, OKF-WIKI-01…03 — 37 v1 requirements).

**Scope is per spec §18 Phase 9 / §27.** Create exactly (verbatim §27.5):

```
src/core/notes/NoteTagger.ts           # LLM: tags + category + summary + memory facts
src/core/notes/NoteQA.ts               # RAG Q&A: MiniSearch + memory + LLM synthesis + citations
src/core/notes/NoteChatConverter.ts    # Chat/page (+memory) → structured note draft
src/core/notes/NoteFileSync.ts         # One-way app→filesystem .md sync + restore
src/core/notes/NoteMaintenance.ts      # Staleness/orphan detection, bulk analysis
```

Plus: populate `Note.type` + `categoryPath` (declared Phase 8), v4 migration (idempotent: adds `tags`/`summary` to notes index + `Note.type` population), `notes_backup_config` IDB store (SYNC-01), Options→Notes LLM toggles (LLM-WIKI-02), and the `search-notes` AI-enhanced rerank (LLM-WIKI-05).

**DONE-when (verbatim §18 + ROADMAP SC):** Save pipeline runs NoteTagger.analyze() non-blocking after IDB write with accept/reject; "Ask notes" RAG (balanced tier) returns cited answers, tiny mode falls back to plain MiniSearch; showDirectoryPicker() + handle persist in notes_backup_config (Standalone only); per-save .md sync with OKF v0.2 YAML frontmatter + nested folders + collision suffixing + external-change guard; restore parser tolerates OKF keys + ignores unknown fields, wikilinks remain body edge syntax; NMEM-02 upserts facts only on primary surface, v4 migration idempotent. Gate: `pnpm run verify:phase-9`.

**Out of scope (verified §27.9 / prior CONTEXT):** Bidirectional sync, embedding/vector search, LLM wikilink autocomplete (D-04), real-time collaboration, filesystem-as-primary-store, image/file attachments, auto-create notes from chat unprompted. Memory governance (MEM-01…05) = Phase 10. Full NotesWorkspace UI = Phase 15. Tool registration (search-notes/create-note) = Phase 18. BacklinksPanel/NoteGraphView/WikilinkAutocomplete/NotePreview untouched (§3800).
</domain>

<decisions>
## Implementation Decisions

### NoteTagger LLM wiring — reuse Phase-3 AI runtime (D-01/D-07)
- **D-115 (NoteTagger uses the existing AI runtime — ProviderRouter fast tier, temperature-0, single structured-JSON call):** NoteTagger.analyze(note) calls the Phase-3 AI runtime (ProviderRouter/ILLMProvider) at **fast tier, temperature 0**, returning one structured JSON payload `{ tags[], categoryPath, summary, memoryFacts[] }` (D-01 single-call). Does NOT build a new LLM pipeline — reuses AgentOrchestrator's provider seam or the direct ProviderRouter.invoke() path the Phase-3 runtime exposes. Non-blocking: fired after NotesDB.put + EventBus.emit('note:saved'), suggestions applied on accept. — **Reversibility:** `reversible` — additive module; swapping the provider seam is a caller edit.
- **D-116 (LLM-WIKI-11 suggestion confidence gating — threshold 0.60, max 3 facts / 5 tags):** Every returned item carries `confidence ∈ [0,1]`. Items below `NOTE_SUGGESTION_DISPLAY_THRESHOLD = 0.60` silently discarded. At most `NOTE_SUGGESTION_MAX_FACTS_PER_SAVE = 3` memoryFacts and `NOTE_SUGGESTION_MAX_TAGS_PER_SAVE = 5` tags shown per save, descending confidence. Accepted items persist at reported confidence; rejected items discarded, never re-suggested for same `{noteId, version}`. Stale suggestions (note edited before async return) discarded. — **Reversibility:** `reversible` — constants + gating logic, local to NoteTagger.

### NoteQA RAG — balanced-tier synthesis with citations (LLM-WIKI-06)
- **D-117 (NoteQA "Ask notes" = MiniSearch top-5 + memory facts → balanced-tier synthesis + per-statement citations):** Retrieval: MiniSearchIndex top-5 + MemoryEngine.retrieveMemoryHints() facts (NMEM-01). Synthesis at **balanced tier** (D-07) with per-statement citations → ephemeral @ant-design/x Bubble with clickable citation Tags (Flow 13). Tiny mode falls back to plain MiniSearch results, no LLM synthesis (§524). — **Reversibility:** `reversible` — additive RAG module; tier swap is config.

### NoteChatConverter — chat/page → note draft with memory context (LLM-WIKI-07, NMEM-03)
- **D-118 (NoteChatConverter uses conversation messages + MemoryEngine.assemble() facts for richer drafts):** "Save to note" on any assistant message → NoteChatConverter drafts title/content/tags/wikilinks/categoryPath using both conversation messages AND MemoryEngine.assemble() facts (NMEM-03) → pre-filled NoteEditor for user review (user is gatekeeper). — **Reversibility:** `reversible` — additive converter; memory-context enrichment is optional input.

### NoteFileSync — Standalone-only, IDB handle store, OKF frontmatter (SYNC-01…11)
- **D-119 (showDirectoryPicker() Standalone-only; handle persisted in notes_backup_config IDB store):** FileSystemDirectoryHandle persisted in `notes_backup_config` IndexedDB store (SYNC-01 — handles non-serializable, cannot use chrome.storage.local). On NotesPage mount verify `handle.queryPermission()`; denied/missing → sync disabled + banner. — **Reversibility:** `reversible` — additive store + sync module.
- **D-120 (OKF v0.2 YAML frontmatter per SYNC-04 — yaml ^2 library):** Per-save `.md` = OKF v0.2 YAML frontmatter + markdown body (wikilinks inline). Fields: `type` (default `Note`), `title`, `description` (=summary), `id` (UUID, WIKI-ID-01), `created`/`updated` (epoch), `tags[]`, `categoryPath`, `generated` ({by, at}), `status` (default `stable`). Uses `yaml` ^2 (already in STACK). Filename sanitized (`/ \ : * ? " < > |` → `_`), collision → numeric suffix (`My Note (1).md`). 50ms debounce, fire-and-forget. External-change guard (2s tolerance) → confirm overwrite, default Skip. Delete-on-sync removes `.md` + empty category folders. — **Reversibility:** `costly` — on-disk format is a published contract; changing frontmatter shape needs a migration.
- **D-121 (Restore parser tolerates OKF keys, preserves UUID identity + wikilinks — SYNC-09):** "Restore from backup" via showDirectoryPicker() → walk tree → parse `.md` frontmatter → upsert (id exists → update; id missing → create; additive). Reads OKF-aligned frontmatter, tolerates + preserves unknown OKF keys. `id` read from OKF extension key to preserve identity + wikilink edges on round-trip. Restore preview modal (SYNC-10). — **Reversibility:** `reversible` — additive restore path.

### NoteMaintenance — user-initiated, algorithmic (LLM-WIKI-08/09/10, D-06)
- **D-122 (NoteMaintenance is user-initiated + passive timestamp comparison — no background jobs):** Staleness: `summaryGeneratedAt`/`tagsGeneratedAt` vs `updated` → "Regenerate" hint (LLM-WIKI-08). Orphan detection: algorithmic (0 wikilinks + 0 backlinks → "Orphan" badge, LLM-WIKI-09). "Re-analyze all notes" user-initiated only, sequential, real-time stats (LLM-WIKI-10). No MV3 background jobs (D-06). — **Reversibility:** `reversible` — additive coordinator.

### Memory↔Notes (NMEM-01…03) — primary-surface fact routing
- **D-123 (NMEM-02: on-save LLM call extracts memory facts → routed through MemoryEngine, primary surface only):** Same NoteTagger call extracts memoryFacts[] (MemoryExtractor schema) → routed through MemoryEngine for conflict resolution + storage. Notes→Memory only (D-05). Runs on primary surface only (§13, isPrimaryWriter gate). — **Reversibility:** `reversible` — additive routing through existing MemoryEngine seam.

### categoryPath + Note.type — populated/serialized in Phase 9 (D-108 handoff)
- **D-124 (categoryPath + Note.type declared in Phase 8, populated + serialized in Phase 9):** `categoryPath` populated by NoteTagger LLM suggestion (CAT-03) + user edit; serialized to OKF frontmatter (SYNC-04) + maps to folder path (CAT-04). `Note.type?: string` populated at serialization (default `'Note'`, OKF-WIKI-01). Both normalized on save (CAT-05). — **Reversibility:** `reversible` — additive population/serialization of existing declared fields.

### v4 migration — idempotent (spec 3156, SYNC-01 store)
- **D-125 (v4 migration is idempotent — adds tags/summary to notes index + Note.type population + notes_backup_config store):** v4 adds `tags`/`summary` to the notes IDB index, populates `Note.type` (skip if already present — idempotent), and creates the `notes_backup_config` store. Spec 20.4/3156. — **Reversibility:** `costly` — DB migration; rollback needs a down-migration.

### the agent's Discretion
- Exact NoteTagger→ProviderRouter invoke path (direct invoke() vs AgentOrchestrator wrapper — both satisfy D-115; prefer the lighter direct path unless AgentOrchestrator adds needed observability).
- Whether NoteQA synthesis streams (balanced-tier Bubble) or returns one-shot — both satisfy LLM-WIKI-06.
- Whether NoteFileSync debounce is a module-level timer or hook-scoped — both satisfy SYNC-03.
- Whether NoteMaintenance lives in one file or splits staleness/orphan/bulk — both satisfy D-122.
- Whether the OKF `generated`/`status` fields use the exact SYNC-04 casing — spec is authoritative.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 9 block) — Create list, required tests, DONE-when. Sole authority on Phase-9 scope.
- `.planning/PRODUCT_SPEC_v0_1.md` §27 (lines 3796-3925) — full LLM-Wiki & Filesystem Sync spec: §27.1 Category, §27.2 LLM Features, §27.3 Filesystem Sync, §27.4 Memory↔Notes, §27.5 New Services, §27.6 Reliability/Privacy, §27.7 Method, §27.7a WIKI-ID-01…04, §27.8 Decisions (D-01…D-08), §27.9 Out of Scope.
- `.planning/PRODUCT_SPEC_v0_1.md` §20.4 (line 3156) — v4 migration (idempotent, tags/summary index + Note.type).
- `.planning/PRODUCT_SPEC_v0_1.md` §24 (line 3612) — canonical verify:phase-9 gate string.
- `.planning/PRODUCT_SPEC_v0_1.md` §10.5 (line 1608) — search-notes tool contract (AI-enhanced rerank = Phase 9, tool registration = Phase 18).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 (spec 4764-4773) — NoteTagResultSchema / ConfidentFact / suggestion-gating constants (NOTE_SUGGESTION_DISPLAY_THRESHOLD, MAX_FACTS/TAGS).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 (spec 4720-4774) — canonical Note + OKF frontmatter + suggestion-gating constants (D-107/D-120).
- `.planning/PRODUCT_SPEC_v0_1.md` §21.2 (lines 3287-3322) — canonical Note interface (categoryPath/type declared Phase 8, populated Phase 9).
- `.planning/PRODUCT_SPEC_v0_1.md` §26.5 (line 3774) — two distinct MiniSearch indexes (ephemeral page vs persistent notes); NoteQA adds AI rerank over the notes index.
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §5.2 — MV3 boundaries: LLM-Wiki runs in UI contexts only, never background SW.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 9: LLM-Wiki & Filesystem Sync" — goal, depends-on, 37 requirements, success criteria, verification gate.
- `.planning/REQUIREMENTS.md` — CAT-01…05, LLM-WIKI-01…11, SYNC-01…11, NMEM-01…03, WIKI-ID-01…04, OKF-WIKI-01…03 rows + phase-9 table row.
- `.planning/phases/08-knowledge-base-memory-minisearch-notes/08-CONTEXT.md` — D-104…D-114 (memory/notes foundation Phase 9 builds on), D-108 (categoryPath/type declared→populated handoff), D-110 (LinkParser/resolveLinks), D-109 (MiniSearchIndex).
- `.planning/phases/07-trust-aware-context-and-receipts/07-CONTEXT.md` — D-94 ([MEMORY] consumer), D-103 gate-re-point precedent.
- `.planning/phases/06-pagecontentservice-knowledge-acquisition/06-CONTEXT.md` — D-87/D-92 (PageContentService feeds NoteChatConverter), gate-re-point precedent.
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-CONTEXT.md` — AI runtime (ProviderRouter/AgentOrchestrator) NoteTagger reuses; PersonaProfile/PersonaInjector.
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-CONTEXT.md` — NotesDB/MemoryDB/WriteJournal foundation; IDB store conventions.
- `.planning/STATE.md` — decision 17 (strict-clean, NP-STRICT=0), VAI-04 (re-query npm: yaml, @types/wicg-file-system-access), decision 11 (WIKI-ID UUID).

### Codebase maps (refreshed 2026-08-18)
- `.planning/codebase/ARCHITECTURE.md` — per-surface singletons; src/core/ UI-framework-agnostic.
- `.planning/codebase/STACK.md` — yaml ^2, @types/wicg-file-system-access, minisearch ^7, idb v8, zod ^3.24.

### Source (integration targets)
- `src/core/storage/NotesDB.ts` — notes/concepts stores, openNotesDB (NoteTagger/NoteFileSync read/write target; v4 migration target).
- `src/core/storage/MemoryDB.ts` — userFacts/conversationSummaries/messages (NMEM-02 write target).
- `src/core/memory/MemoryEngine.ts` — retrieveMemoryHints() (NMEM-01 RAG), assemble() (NMEM-03), fact upsert (NMEM-02).
- `src/core/memory/MemoryExtractor.ts` — memoryFacts schema (NMEM-02 extraction).
- `src/core/memory/PreferenceMemoryStore.ts` — np_persona (RICH-R-05, persona context for drafts).
- `src/core/search/MiniSearchIndex.ts` — persistent notes index (NoteQA retrieval + AI rerank LLM-WIKI-05).
- `src/core/notes/LinkParser.ts` — parseLinks/resolveLinks (WIKI-ID-02/03; NoteChatConverter suggests wikilinks).
- `src/core/ai/ProviderRouter.ts` / `src/core/ai/AgentOrchestrator.ts` — Phase-3 AI runtime NoteTagger/NoteQA invoke.
- `src/core/ai/persona/PersonaProfile.ts` — PersonaProfileSchema (draft enrichment context).
- `src/core/events/EventBus.ts` — note:saved emit (NoteTagger trigger).
- `src/types/notes.ts` — canonical Note (categoryPath/type declared; Phase 9 populates + serializes).
- `src/components/chat/useChatStreaming.ts` — "Save to note" entry point (NoteChatConverter).
- `tests/setup.ts` — fake-indexeddb; IDB test conventions.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/storage/NotesDB.ts` — notes (keyPath id, byTitle/byUpdated) + concepts stores; NoteTagger/NoteFileSync read/write, v4 migration target.
- `src/core/storage/MemoryDB.ts` — userFacts/conversationSummaries/messages stores (NMEM-02 write target).
- `src/core/memory/MemoryEngine.ts` — retrieveMemoryHints(), assemble(), fact upsert (NMEM-01/02/03).
- `src/core/memory/MemoryExtractor.ts` — memoryFacts schema + parse seam (NMEM-02).
- `src/core/search/MiniSearchIndex.ts` — lazy/memoized persistent notes index (NoteQA retrieval + LLM-WIKI-05 rerank).
- `src/core/notes/LinkParser.ts` — parseLinks/resolveLinks (WIKI-ID-02/03/04).
- `src/core/ai/ProviderRouter.ts` + AgentOrchestrator — Phase-3 AI runtime (NoteTagger/NoteQA invoke at fast/balanced tier).
- `src/core/events/EventBus.ts` — note:saved emit/subscribe (NoteTagger trigger).
- `src/types/notes.ts` — canonical Note with categoryPath? + type? declared (Phase 9 populates + serializes).

### Established Patterns
- **Verbatim spec shapes (D-38)** — OKF frontmatter fields, LLM-WIKI constants, SYNC-04 field table — no invented fields.
- **Create-only discipline (D-69/D-81)** — Phase 9 produces LLM-Wiki seams proven by tests; live chat adoption of memoryHints deferred.
- **Single-writer + primary surface (§13)** — NMEM-02 fact upsert gates on isPrimaryWriter.
- **TraceRedactor before persist/log/write (§27.6)** — note content/paths redacted before IDB/logging/disk.
- **Gate re-pointing (D-114 precedent)** — verify:phase-9 re-pointed to §18 dirs.
- **Non-serializable handle in IDB (SYNC-01/D-08)** — FileSystemDirectoryHandle → notes_backup_config store, never chrome.storage.local.

### Integration Points
- NoteTagger.analyze() → ProviderRouter (fast, temp-0) → structured JSON {tags, categoryPath, summary, memoryFacts}.
- NoteTagger → NotesDB.put + EventBus.emit('note:saved') (non-blocking post-save).
- NoteQA → MiniSearchIndex top-5 + MemoryEngine.retrieveMemoryHints() → balanced-tier synthesis + citations.
- NoteChatConverter → conversation messages + MemoryEngine.assemble() → NoteEditor pre-fill.
- NoteFileSync → notes_backup_config IDB store + showDirectoryPicker() (Standalone) → .md write/restore.
- NMEM-02 → MemoryEngine fact upsert (primary surface only).
- v4 migration → NotesDB index (tags/summary) + Note.type population + notes_backup_config store.
</code_context>

<specifics>
## Specific Ideas

- **Single LLM call for tags+category+summary+facts (D-01)** is the phase's efficiency spine — one fast call, structured JSON, cheaper/faster than multiple.
- **OKF-compatible, not OKF-constrained (D-02a)** — UUID id stays source of truth (OKF extension key), wikilinks stay body edges; strict-OKF markdown-link edges deferred to v0.2+.
- **categoryPath maps 1:1 to folders (D-03/D-02)** — hierarchical, `/` separator, normalized on save.
- **Notes→Memory only (D-05)** — notes are user-curated; extracting facts enriches chat without polluting notes.
- **fast tier for analysis, balanced for synthesis (D-07)** — tag/category/summary = low complexity (fast); RAG synthesis benefits from balanced.
- **NP-STRICT ceiling → 0** — new Phase-9 code strict-clean (STATE.md decision 17).
- **No invented requirement IDs / error codes** — 37 v1 requirements are CAT/LLM-WIKI/SYNC/NMEM/WIKI-ID/OKF-WIKI.
</specifics>

<deferred>
## Deferred Ideas

- **Memory governance (MEM-01…05, KNW-01)** — Phase 10: MemoryRecord conflict resolution, lifecycle controls, procedural experience.
- **Bidirectional filesystem sync** — Phase v0.2+ (requires polling/Native Messaging), explicit §27.9 out of scope.
- **Embedding/vector search** — deferred per §3.2 (no embedding downloads); MiniSearch + cosine is v0.1.
- **LLM wikilink autocomplete** — not in v0.1 (D-04); MiniSearch title matching sufficient.
- **Full NotesWorkspace UI** (list/editor/backlinks/graph/search) — Phase 15.1.
- **search-notes / create-note tool registration** — Phase 18 (TOL-01).
- **Real-time collaborative editing, image/file attachments, auto-create notes from chat** — §27.9 out of scope.

None of these belong in Phase 9 — discussion stayed within phase scope.
</deferred>

---
*Phase: 9-LLM-Wiki & Filesystem Sync*
*Context gathered: 2026-09-01*
