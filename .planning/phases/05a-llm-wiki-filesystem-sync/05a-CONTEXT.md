# Phase 5a: LLM-Wiki & Filesystem Sync - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the AI enrichment layer on top of the Phase 5 knowledge base. Five new services in `src/core/notes/` plus a shared `src/core/ai/LlmService.ts` for structured LLM calls: NoteTagger (single haiku call for tags + category + summary + memory facts), NoteQA (MiniSearch + memory → flash-tier RAG synthesis with numbered citations), NoteChatConverter (chat/page → pre-filled note draft), NoteFileSync (one-way app→FS .md backup with IndexedDB-persisted FileSystemDirectoryHandle), and NoteMaintenance (passive staleness/orphan queries). All enrichment renders as user accept/reject suggestions. Memory extraction from NoteTagger is user-gated. File sync is fire-and-forget with 50ms debounce. Adds v5 IndexedDB migration for `backup_config` store. Depends on Phase 5 NotesDB, NoteGraph, MiniSearchNoteIndex, MemoryEngine, and Phase 3 ProviderRouter/TierResolver.
</domain>

<decisions>
## Implementation Decisions

### NoteTagger Schema & LLM Call

- **D-01:** NoteTagger makes a single haiku-tier, temperature-0 structured-output LLM call via `LlmService`. The response is a single JSON object with two explicit partitions: `enrichment` (tags, categoryPath, summary, suggestedConcepts) and `memoryFacts` (array of {type, content, confidence, reason}). NoteTagger parses once, splits, and routes enrichment as note suggestions and memoryFacts as memory candidates. — **Reversibility:** one-way — the NoteTaggerResult schema is the contract for the LLM prompt and all downstream consumers; changing the partition structure would require updating the prompt, parsing, and UI.
- **D-02:** NoteTagger enrichment renders as accept/reject suggestions inline on the note editor (tags/category/summary/concepts). MemoryFacts render as suggestions in a separate "New Memory Facts" notification/side-panel flow. Two independent review surfaces. — **Reversibility:** costly — the split review UX touches both the note editor component and the memory notification system; merging them later requires reworking both surfaces.

### Memory Extraction & MEM-02

- **D-03:** NoteTagger's LLM-reported confidence score is display-only metadata for ranking within memory suggestions. All accepted memoryFacts are stored with confidence=0.5 (`inferred`) per Phase 5 D-07 confidence model. The LLM score is never used as the system confidence tier. — **Reversibility:** one-way — the mapping from LLM self-score to `inferred` is a trust boundary; changing it would mean LLM self-assessments influence the conflict resolution precedence model in Phase 5b.
- **D-04:** MemoryFacts with LLM confidence < 0.3 are filtered and never shown as suggestions. Max 3 memoryFacts displayed per note save. Both thresholds are local constants in NoteTagger. — **Reversibility:** reversible — the threshold and cap are local constants.
- **D-05:** Enrichment suggestions (tags, categoryPath, summary, concepts, memoryFacts) are stored in-memory only as component state. Lost on session restart. User can manually regenerate any note's enrichment via the "Regenerate tags/summary" toolbar button (LLM-WIKI-04). — **Reversibility:** reversible — switching to persistent suggestions would require a new IndexedDB store + UI changes but wouldn't break the enrichment contract.
- **D-06:** If autoTag, autoCategorize, and autoSummary toggles are all off, NoteTagger skips the LLM call entirely. If some are on but MEM-02 memory extraction is off, the LLM call runs but generated memoryFacts are discarded. — **Reversibility:** reversible — the toggle logic is local to NoteTagger; the LLM prompt always asks for the full structured output regardless of toggle state to keep the prompt invariant.

### NoteTagger Staleness

- **D-07:** NoteTagger fires non-blocking after IndexedDB save. It includes `note.version` in metadata sent with the request. When the LLM response returns, if the note version was incremented (user edited before suggestions arrived), stale suggestions are silently discarded. No UX noise, no stale-overwrite risk. — **Reversibility:** one-way — the version-based staleness check is the coordination contract between NoteTagger and the note editor; discarding stale suggestions means enrichment is never auto-applied to edited content.

### Shared LLM Service

- **D-08:** A shared `src/core/ai/LlmService.ts` provides structured LLM calls for NoteTagger, NoteQA, NoteChatConverter, and future non-orchestration LLM consumers. It handles provider resolution via TierResolver (haiku/flash), temperature-0 structured output, and Zod schema validation. AgentOrchestrator remains the path for chat/agent tool-calling flows. — **Reversibility:** costly — LlamService becomes a shared dependency across multiple modules; removing it would require each consumer to implement its own LLM call path.

### NoteFileSync: Handle Persistence

- **D-09:** `FileSystemDirectoryHandle` is persisted in a new `backup_config` object store in the existing NowPilot IndexedDB via MigrationRunner v5. This store holds exactly one record: `{ id: 'backup_folder', handle: FileSystemDirectoryHandle }`. Handle survives extension restarts natively via IndexedDB's structured clone. — **Reversibility:** one-way — the v5 migration and backup_config store become part of the MigrationRunner schema; removing them requires a v6 migration to clean up.
- **D-10:** Permission is checked via `handle.queryPermission({ mode: 'readwrite' })` on every sync attempt. If denied, sync is disabled (red "Backup: Error" Tag). On next NotesPage mount, if still denied, show "Re-select folder" prompt. If re-granted, sync resumes automatically. — **Reversibility:** one-way — the per-save permission check is the safety contract for filesystem writes; relaxing it would let stale handles silently fail.

### NoteFileSync: Sync Behavior

- **D-11:** A `lastSyncedAt?: number` field is added to NoteSchema. NoteFileSync writes this timestamp after each successful file write. On next save, compare `note.lastSyncedAt` vs `file.lastModified` with 2s tolerance — if file is newer, confirm "This file was modified externally. Overwrite?" defaulting to Skip (SYNC-06). — **Reversibility:** costly — adding a field to NoteSchema is a schema migration; removing it later requires another migration.
- **D-12:** On note rename (title or categoryPath change), NoteFileSync tracks the old file path and deletes the orphaned `.md`. On explicit note deletion, the `.md` is deleted and empty category folders are removed (SYNC-11). File format: `"{categoryPath}/{sanitizedTitle}.md"` with YAML frontmatter and markdown body. Title collision resolved via numeric suffixing (SYNC-05). — **Reversibility:** reversible — the cleanup logic is additive; disabling it only leaves orphan files.

### NoteQA: Citation & RAG

- **D-13:** NoteQA sends numbered snippets `[1]`, `[2]`, etc. to the LLM with noteId metadata in the prompt preamble (not visible to the LLM's text). The LLM responds with inline `[1]`, `[2]` reference markers. NoteQA post-processes the response to build a citations array: `[{ noteId, title, relevantSnippet, referenceNumber }]`. This matches the existing NoteQAResultSchema from Appendix C. — **Reversibility:** one-way — the numbered-marker citation format is the LLM prompt contract; changing it would mean all existing NoteQA responses would not parse correctly.
- **D-14:** NoteQA assembles its own prompt directly — system prompt + numbered snippets + memory facts + user question. No ContextOptimizer. The token budget is small (top-5 snippets + memory) and the flow is independent of the chat pipeline. — **Reversibility:** reversible — switching to ContextOptimizer later would be additive, not breaking.
- **D-15:** NoteQA has two modes: `search` (haiku rerank of top-10, triggered by < 3 MiniSearch results or explicit "AI Search", returns ranked snippets) and `ask` (flash-tier synthesis with citations, returns cited answer). Both share the same NoteQA entry point with a `mode` parameter. — **Reversibility:** reversible — adding a third mode is additive.

### Tiny Mode Fallback

- **D-16:** In tiny model tier, NoteQA returns MiniSearch top-5 snippets + MemoryEngine relevant facts as raw results with noteId links. No LLM call. Memory context is still included because it adds value without token cost. — **Reversibility:** reversible — the tiny-mode path is a conditional branch in NoteQA.

### Save Pipeline Coordination

- **D-17:** NoteTagger and NoteFileSync subscribe to `note:saved` independently on the EventBus. They run in parallel — no ordering dependency. NoteTagger fires the non-blocking LLM call. NoteFileSync debounces 50ms then writes the `.md` using the note's current content (before enrichment suggestions are applied). — **Reversibility:** one-way — the EventBus subscription pattern is the coordination contract; serializing them later would require a coordinator service.
- **D-18:** When user accepts enrichment suggestions, the updated note triggers another `note:saved` → NoteFileSync re-writes the `.md` with the enriched frontmatter (tags, category, summary). This naturally keeps the backup in sync with accepted metadata. — **Reversibility:** reversible — this is a natural consequence of the EventBus pattern; no special coordination needed.
- **D-19:** Primary surface check for MEM-02 happens only at MemoryEngine.write() time, not at NoteTagger call time. NoteTagger fires the LLM call on both surfaces — enrichment suggestions show everywhere. Secondary surface memory writes fail gracefully with "Save from primary surface to update memory." — **Reversibility:** one-way — the write-gating at MemoryEngine is the single-writer contract from Phase 5 MEM-02/D-05.
- **D-20:** NoteChatConverter drafts a pre-filled note via LlmService (haiku tier + MemoryEngine.assemble() context). After user edits and saves, the note goes through the full save pipeline: NoteTagger + NoteFileSync + MEM-02 suggestions. The provenance field is set to `chat-conversion`. — **Reversibility:** one-way — the full-pipeline path for chat-converted notes means chat drafts always get enrichment; making them an exception later would break the "same as any note save" guarantee.

### NoteMaintenance

- **D-21:** NoteMaintenance is a passive query service providing `getStaleNotes()` (summaryGeneratedAt < updatedAt, or tagsGeneratedAt < updatedAt) and `getOrphanNotes()` (0 wikilinks + 0 backlinks). It also exposes `reanalyzeAll()` for LLM-WIKI-10 bulk re-analysis. UI-driven — no background monitoring or EventBus subscriptions. — **Reversibility:** reversible — adding reactive monitoring later would be additive.

### the agent's Discretion

- LlamService implementation details: provider selection via TierResolver, temperature-0 enforcement, Zod response validation, error handling for malformed JSON (one-shot repair), abort signal propagation.
- NoteTagger LLM prompt template (system prompt + note content formatting + structured output instructions) — planner designs within the single-call JSON contract (D-01).
- NoteQA LLM prompt template (citation instructions, snippet formatting, system prompt for synthesis) — planner designs within the numbered-reference citation contract (D-13).
- NoteChatConverter LLM prompt template (draft title/content/tags/wikilinks/categoryPath) — planner designs within the haiku-tier structured output contract.
- NoteFileSync file format details: YAML frontmatter field ordering, filename sanitization character mapping, collision suffixing algorithm.
- NoteMaintenance staleness comparison logic and orphan detection query implementation.
- EventBus handler registration and error boundary for NoteTagger/NoteFileSync subscriptions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §27 — LLM-Wiki & Filesystem Sync: complete requirement set CAT-01…05, LLM-WIKI-01…10, SYNC-01…11, MEM-01…03
- `.planning/PRODUCT_SPEC_v0_1.md` §27.2 — LLM Features: single haiku call (LLM-WIKI-01), toggles (LLM-WIKI-02), summary field (LLM-WIKI-03), regeneration (LLM-WIKI-04), AI-enhanced search (LLM-WIKI-05), RAG (LLM-WIKI-06), chat-to-note (LLM-WIKI-07), staleness (LLM-WIKI-08), orphans (LLM-WIKI-09), re-analyze all (LLM-WIKI-10)
- `.planning/PRODUCT_SPEC_v0_1.md` §27.3 — One-Way Filesystem Sync: SYNC-01…11 (showDirectoryPicker, permissions, debounce, file format, collision, external-change, backup status, restore)
- `.planning/PRODUCT_SPEC_v0_1.md` §27.4 — Memory ↔ Notes Integration: MEM-01 (memory-aware RAG), MEM-02 (note→memory extraction), MEM-03 (chat context for drafts)
- `.planning/PRODUCT_SPEC_v0_1.md` §27.5 — New Core Services: file list and roles
- `.planning/PRODUCT_SPEC_v0_1.md` §27.6 — Reliability & Privacy: TraceRedactor before all persistence
- `.planning/PRODUCT_SPEC_v0_1.md` §27.8 — Decisions: D-01 (single call), D-02 (dual-friendly format), D-03 (category path-based), D-04 (no LLM wikilinks), D-05 (notes→memory direction), D-06 (user-initiated maintenance), D-07 (haiku/flash tiers), D-08 (backup handle in IndexedDB)
- `.planning/PRODUCT_SPEC_v0_1.md` §27.10 — UX Flow Summary: daily writing, research, chat-to-note, restore, backup
- `.planning/PRODUCT_SPEC_v0_1.md` Flow 12 (Save to Note), Flow 13 (Ask Your Notes RAG), Flow 14 (Set Backup Folder), Flow 15 (Restore from Folder)
- `.planning/PRODUCT_SPEC_v0_1.md` §19.16 (Backup Folder Permission Revoked), §19.17 (External .md Change), §19.18 (NoteTagger LLM Failure), §19.19 (RAG No Results)
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C — NoteQAResultSchema, NoteTaggerResultSchema
- `.planning/PRODUCT_SPEC_v0_1.md` §13 — Concurrency rules: memory writes single-writer, IndexedDB transactions, 5s tab timeout, 50ms sync debounce reference
- `.planning/PRODUCT_SPEC_v0_1.md` §15 — Storage topology: notes_backup_config in IndexedDB (§15 NoteStoreExtensions), v4 migration extended to v5

### Project & Roadmap
- `.planning/PROJECT.md` — Constraints (MV3 rules, cost-effective runtime, NOT @ant-design/x-sdk), Key Decisions (single haiku call for enrichment, knowledge-first ordering)
- `.planning/ROADMAP.md` Phase 5a — Goal, success criteria (5 items), depends on Phase 5, requirements NOTE-02/NOTE-03
- `.planning/REQUIREMENTS.md` — NOTE-02 (LLM-Wiki: auto-tag/category/summary, RAG with citations, chat/page-to-note), NOTE-03 (one-way filesystem sync + restore)
- `.planning/REQUIREMENTS.md` — MEM-01 (memory-aware RAG), MEM-02 (note→memory extraction), MEM-03 (chat context for drafts)

### Prior Phase Context
- `.planning/phases/05-knowledge-base/05-CONTEXT.md` — D-01 (content as single source of truth), D-02 (UUID identity), D-03 (unresolved wikilinks), D-05 (AI memory writes limited to conversation summaries + NoteTagger MEM-02), D-12 (persistent MiniSearch notes index), D-14 (concept schema defined, no extraction yet), D-15 (all enrichment as suggestions, user-gated), D-16 (NoteProvenance schema), D-17 (no version history)
- `.planning/phases/04b-trust-aware-context-receipts/04b-CONTEXT.md` — D-06 (MemoryEngine computes relevance/freshness), D-08 (relevance is query-aware, per-turn), D-09 (sensitivity inheritance from MemoryRecord)
- `.planning/phases/04a-page-content-extraction/04a-CONTEXT.md` — D-14/D-15 (MiniSearch heading-aware chunks + BM25 — reuse pattern for NoteQA), D-17 (per-tab cache pattern — analogous to NotesDB cache)
- `.planning/phases/03-ai-core-pipeline/03-CONTEXT.md` — ProviderRouter/TierResolver pattern, PersonaInjector

### Existing Code
- `src/core/notes/NotesDB.ts` — Note CRUD; NoteTagger and NoteFileSync hook into `note:saved` after these writes
- `src/core/notes/NoteSchema.ts` — Note, Concept, NoteProvenance schemas; `lastSyncedAt` extension point for NoteFileSync
- `src/core/notes/MiniSearchNoteIndex.ts` — Persistent BM25 search index; NoteQA consumes for snippet retrieval
- `src/core/notes/NoteGraph.ts` — Backlinks, similarity; NoteMaintenance uses for orphan detection
- `src/core/notes/LinkParser.ts` — Wikilink extraction; NoteChatConverter may use for wikilink suggestions
- `src/core/memory/MemoryEngine.ts` — retrieve() for NoteQA context, write() for MEM-02 after user accept
- `src/core/memory/MemoryScorer.ts` — D-08 scoring formula; memory fact ranking on retrieval
- `src/core/ai/TierResolver.ts` — resolveTierModel for haiku/flash provider selection; LlmService uses this
- `src/core/ai/ProviderRouter.ts` — Provider selection; LlmService wraps this for non-orchestration calls
- `src/core/ai/StructuredOutput.ts` — JSON repair pattern; LlmService should reuse or extend this pattern
- `src/core/storage/MigrationRunner.ts` — v4→v5 migration adds `backup_config` object store
- `src/core/events/EventBus.ts` — note:saved event triggers NoteTagger + NoteFileSync
- `src/core/runtime/BroadcastBus.ts` — Primary surface election; gating for MEM-02 writes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **NotesDB** (`src/core/notes/NotesDB.ts`): Full CRUD with WriteJournal consistency. NoteTagger, NoteFileSync, and NoteMaintenance read from here; NoteTagger enrichment and NoteFileSync sync status write back.
- **MiniSearchNoteIndex** (`src/core/notes/MiniSearchNoteIndex.ts`): Persistent BM25 search. NoteQA uses `.search()` for snippet retrieval; NoteTagger may use for concept/tag suggestion context.
- **MemoryEngine** (`src/core/memory/MemoryEngine.ts`): retrieve() feeds NoteQA RAG context and NoteChatConverter draft context. write() handles MEM-02 after user accepts memory facts.
- **NoteGraph** (`src/core/notes/NoteGraph.ts`): Backlinks and similarity. NoteMaintenance queries for orphan detection (0 wikilinks + 0 backlinks).
- **TierResolver** (`src/core/ai/TierResolver.ts`): resolveTierModel() for haiku/flash provider selection. All LlmService calls go through this.
- **StructuredOutput** (`src/core/ai/StructuredOutput.ts`): One-shot JSON repair pattern. LlmService extends this for all enrichment/QA/conversion LLM calls.
- **EventBus** (`src/core/events/EventBus.ts`): `note:saved` is the trigger for NoteTagger (non-blocking LLM) and NoteFileSync (50ms debounced sync).
- **WriteJournal** (`src/core/storage/WriteJournal.ts`): NotesDB uses this; NoteFileSync writes don't need journaling (fire-and-forget, IndexedDB is primary store).
- **BroadcastBus** (`src/core/runtime/BroadcastBus.ts`): isPrimarySurface() check gates MemoryEngine.write() for MEM-02 after user accept.
- **MigrationRunner** (`src/core/storage/MigrationRunner.ts`): v4→v5 migration pattern — add `backup_config` object store for FileSystemDirectoryHandle.

### Established Patterns
- **Module-level singletons**: NoteTagger, NoteQA, NoteChatConverter, NoteFileSync, NoteMaintenance, and LlamService follow the same singleton pattern as ContextOptimizer and MemoryEngine.
- **Core module isolation**: `src/core/notes/` and `src/core/ai/` must not import from `src/components/`. Same boundary as Phase 3/4/5.
- **Zod validation at module boundaries**: NoteTaggerResult, NoteQAResult, NoteDraft should use Zod schemas at their interfaces.
- **Discriminated unions for result types**: NoteTaggerResult, NoteQAResult, NoteDraft follow Phase 4a ExtractionResult pattern.
- **TDD with vitest**: Test files in `tests/core/notes/` mirroring `src/core/notes/`.
- **Structured output via temperature-0 + JSON repair**: Pattern from PlannerService — reuse for all LlmService calls.
- **EventBus subscription pattern**: Handlers register on init, fire internal promises, never let errors escape.

### Integration Points
- **EventBus `note:saved`** — The canonical trigger. NoteTagger and NoteFileSync both subscribe independently as parallel handlers. NoteTagger fires the non-blocking LLM call; NoteFileSync debounces and writes the .md.
- **LlmService** — New shared service in `src/core/ai/`. Wraps ProviderRouter + TierResolver + StructuredOutput. Used by NoteTagger (haiku, enrichment), NoteQA (haiku/flash, RAG), NoteChatConverter (haiku, draft generation). Not used by AgentOrchestrator (chat/agent flows).
- **MigrationRunner v5** — Adds `backup_config` object store to the existing IndexedDB. Backup folder handle and sync metadata live here.
- **NoteSchema extension** — Add `lastSyncedAt?: number` and possibly `summaryGeneratedAt?: number`, `tagsGeneratedAt?: number` for staleness detection.
- **NoteProvenance** — `chat-conversion` source already defined in Phase 5 D-16. NoteChatConverter sets this on drafted notes.
- **Phase 7 Notes UI** — Consumes NoteQA for RAG, NoteMaintenance for staleness/orphan badges, NoteFileSync for backup status display.
- **Phase 5b Memory Governance** — Consumes MEM-02 extracted facts with `inferred` confidence. The NoteTagger→MemoryEngine path is the foundation for governed extraction.

</code_context>

<specifics>
## Specific Ideas

- Single structured JSON response from NoteTagger with explicit `enrichment` and `memoryFacts` partitions — one parse, clear boundary.
- MemoryFacts LLM confidence is display-only for suggestion ranking; system stores `inferred` (0.5) per Phase 5 D-07. Threshold ≤ 0.3 filtered, max 3 per save.
- Enrichment suggestions are in-memory only — lost on restart. "Regenerate" button is the recovery path.
- NoteFileSync writes immediately on save, re-syncs after enrichment acceptance (another note:saved). Backup always reflects current accepted state.
- Numbered reference markers [1], [2] for NoteQA citations — LLM sees snippet numbers, NoteQA maps to noteIds post-response.
- Primary surface check only at MemoryEngine.write() time — NoteTagger runs everywhere, memory writes gated at commit.
- NoteChatConverter drafts go through full save pipeline — same as any note. Provenance = `chat-conversion`.
- NoteMaintenance is passive and UI-driven — no background monitoring or EventBus subscriptions.
- v5 IndexedDB migration for backup_config store — single record, FileSystemDirectoryHandle persists natively.
- Permission checked on every sync — red "Backup: Error" state with re-select prompt on denial.
</specifics>

<deferred>
## Deferred Ideas

- **Embedding-based semantic search for notes**: Deferred to v0.2+. MiniSearch BM25 + LLM reranking (LLM-WIKI-05) sufficient for v0.1.
- **LLM wikilink autocomplete**: Spec D-04 explicitly drops from v0.1. MiniSearch title matching is sufficient.
- **Bidirectional filesystem sync**: Requires polling/Native Messaging. Out of scope per §27.9.
- **Background staleness monitoring**: D-06 says maintenance is user-initiated. No background jobs in MV3.
- **Persistent enrichment suggestions**: In-memory only per D-05. Adding persistence would require a new IndexedDB store + UI for pending queue management.
- **AI-suggested note creation from chat (unprompted)**: Out of scope per §27.9. NoteChatConverter requires explicit user action ("Save to note").
- **Image/file attachments in notes**: Out of scope per §27.9.
- **Restore incremental/delta updates**: Phase 5a restore is full-folder "additive upsert." Incremental sync between folder and IndexedDB would need change tracking.
- **Multi-folder backup**: Single backup folder per D-08. Multiple folders would need handle management and folder selection UI.
- **Knowledge-edge provenance (KNW-01)**: Phase 5b. AI-suggested wikilinks in NoteChatConverter drafts remain proposals until user accepts.
</deferred>

---

*Phase: 5a-LLM-Wiki & Filesystem Sync*
*Context gathered: 2026-08-02*
