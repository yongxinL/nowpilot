# Phase 05: Knowledge Base - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the persistent knowledge base layer — NotesDB with atomic notes, wikilinks, and a note graph with cosine-similarity backlinks; a MiniSearch-powered search index over notes; and the MemoryEngine orchestrating ConversationMemoryStore, UserMemoryStore, and PreferenceMemoryStore. Conversation memory provides LLM-generated summaries at 12-message boundaries with tier-gated recent-turn injection. User memory is scored by a relevance-primary formula and retrieved with a minimum confidence threshold. Memory writes follow single-writer semantics via BroadcastBus primary election. Notes carry provenance metadata for future import/export.

This is the persistence layer — no UI. New modules in `src/core/memory/` (MemoryEngine, ConversationMemoryStore, UserMemoryStore, PreferenceMemoryStore) and `src/core/notes/` (NotesDB, NoteGraph, LinkParser, search index). Builds on Phase 2 storage topology (Zustand stores + IndexedDB + WriteJournal), Phase 4 context pipeline (ContextAssembler), Phase 4b ContextItem contracts, and Phase 4a MiniSearch patterns. Phase 5a (LLM-Wiki), Phase 7 (Notes UI), and Phase 5b (memory governance) will consume these foundations.
</domain>

<decisions>
## Implementation Decisions

### Note Data Model & Wikilinks
- **D-01:** `content` is the single source of truth — wikilinks are stored as raw `[[title]]` in the markdown body. A derived `links[]` array containing resolved note IDs is fully recomputed on every save. Backlinks are never stored — they are computed from `links[]`. Graph edges are generated from `links[]`. — **Reversibility:** one-way — the note persistence schema becomes the contract for NotesDB, MiniSearch indexing, MemoryEngine retrieval, and Phase 5a LLM-Wiki features; changing to edge-relation-only would require migrating all stored notes.
- **D-02:** Note identity is an immutable UUID (`id`). `title` is display metadata and may change. All graph relationships use `noteId`. Renaming a note updates only the `title` field — existing `links[]` remain valid because they reference IDs, not titles. — **Reversibility:** one-way — the ID-based identity model is baked into every cross-reference (links, backlinks, graph edges, memory references); switching to title-as-identity would break all existing relationships.
- **D-03:** Unresolved wikilinks (links to non-existent notes) are tracked explicitly in an `unresolvedLinks[]` array on the Note. They render with distinct UI styling (dashed underline, muted color, tooltip). Clicking an unresolved link opens a pre-filled "Create Note" dialog. When a note is later created with a matching title, the next save/re-index auto-resolves the link. — **Reversibility:** reversible — the unresolvedLinks[] field and auto-resolution logic are additive; removing them only loses the tracking data.

### Memory Architecture
- **D-04:** The `memoryType` taxonomy field (`working` | `episodic` | `semantic` | `preference` | `procedural`) is encoded on all memory records in Phase 5. The existing three-store architecture (ConversationMemoryStore, UserMemoryStore, PreferenceMemoryStore) remains unchanged. Phase 5 stores and retrieves by type; Phase 5b adds lifecycle management, promotion/demotion rules, and governance. — **Reversibility:** one-way — the taxonomy field becomes part of the MemoryRecord schema; removing it would require migrating all persisted records.
- **D-05:** AI-generated memory writes are strictly limited to conversation summaries in Phase 5. User facts may only be created via explicit user action, approved note-to-memory extraction (Phase 5a), or future governed memory workflows (Phase 5b). Preferences may only be created via explicit user settings or confirmation. Hallucinated facts must not enter memory. — **Reversibility:** one-way — the write boundary is a trust contract; relaxing it later would require re-auditing memory integrity.
- **D-06:** No automatic consolidation, merging, or deduplication across memory stores in Phase 5. Each store (Conversation, User, Preference) owns its records independently. MemoryEngine retrieves from all stores, combines results, and ranks by the retrieval scoring model. Phase 5b handles semantic merging, fact promotion, conflict detection, and cross-store rewrites. — **Reversibility:** reversible — consolidation is additive; adding it in Phase 5b does not change the per-store independence contract.

### Memory Scoring & Retrieval
- **D-07:** Confidence is source-based and immutable: `explicit-user` = 1.0, `verified-state` = 0.8, `previous-explicit` = 0.7, `inferred` = 0.5. Assigned at creation time and never modified by retrieval frequency. `useCount` is tracked separately for retrieval ranking. Conflict resolution uses confidence; retrieval ranking may consider useCount. — **Reversibility:** one-way — confidence is the foundation for Phase 5b conflict resolution precedence; changing the scale or immutability guarantee would invalidate existing conflict decisions.
- **D-08:** Retrieval scoring formula — relevance-primary weighting: `keywordMatch` 35% + `tagMatch` 25% + `recency` 20% + `confidence` 10% + `useCount` 10%. Relevance factors dominate (60%); confidence is a trust signal not a primary driver; useCount influences ranking but cannot overpower relevance. — **Reversibility:** reversible — weights are local constants in MemoryEngine; tuning them doesn't change the schema.
- **D-09:** Tier-gated retrieval with minimum score threshold: top-3 for tiny models, top-5 for small/medium/large. Minimum score threshold = 0.30 — facts below this threshold are excluded even within the top-K limit. Tier-gated count is a maximum, not a guarantee. MemoryEngine owns scoring + threshold filtering + top-K selection; ContextAssembler owns token budgeting + context packing + final truncation. — **Reversibility:** reversible — the threshold and tier caps are local constants.

### Conversation Memory
- **D-10:** LLM-generated summaries at 12-message boundary (`messageCount % 12 === 0`). Uses the active lowest-cost summarization tier (Haiku/Gemini Flash/Nano-class). Summary is 2-3 concise sentences capturing decisions, goals, user preferences, facts, and open tasks. Summary stored as a dedicated memory artifact in MemoryDB. Original messages preserved — never permanently deleted during compaction. Context assembly: `head (system + first key messages)` + `summary` + `tail (most recent messages)`. — **Reversibility:** costly — the summary generation trigger and storage format become the conversation-memory contract; changing it would affect every existing conversation's context assembly.
- **D-11:** Conversation retention uses LRU eviction: max 10 active conversations, max 100 archived conversations. Archive trigger after 30 minutes idle. Eviction removes oldest archived conversations first. No automatic pruning of notes, user facts, or preferences. — **Reversibility:** reversible — LRU thresholds are local constants.

### Notes Search & Graph
- **D-12:** Separate persistent MiniSearch instance for notes, independent from the Phase 4a ephemeral page-content index. Indexed fields: title, content, tags, wikilinkTargets. CRUD operations use incremental updates (add/replace/remove) triggered by `EventBus.emit('note:saved')` after successful note persistence. Full rebuild reserved for startup recovery, import, schema migrations, and corruption recovery. — **Reversibility:** costly — the separate-instance contract and indexed-field set are the search API for Phase 7 UI and Phase 5a RAG; merging with the page index would break lifecycle guarantees.
- **D-13:** Note graph similarity uses hybrid graph-first formula: 50% linkOverlap (Jaccard of `links[]`) + 20% tagOverlap (Jaccard of `tags[]`) + 30% contentCosine (TF-IDF over title + content). Backlinks are derived exclusively from resolved `links[]` — they are deterministic, not similarity-based. Related-note suggestions use the hybrid similarity formula. — **Reversibility:** reversible — the formula weights are local constants in NoteGraph.

### Enrichment & Import
- **D-14:** Concept extraction is deferred to Phase 5a. Phase 5 provides the NotesDB schema (concepts with slug/label/summary/noteIds/aliases) but no extraction logic. User-created tags are the only classification mechanism. — **Reversibility:** reversible — the concept schema is additive; Phase 5a populates existing structures.
- **D-15:** All LLM-generated enrichment (tags, categories, summaries, concepts) in Phase 5a renders as suggestions requiring user acceptance — never auto-applied. Confidence values on suggestions are display metadata only (ranking, ordering, UI indicators). No confidence threshold triggers automatic application. — **Reversibility:** one-way — the user-approval gate is a product policy for knowledge ownership; removing it would let unverified AI output modify user notes.
- **D-16:** `NoteProvenance` field on all notes: `source` (`user-created` | `import` | `chat-conversion` | `ai-generated`), `importedAt`, `originalPath`, `conversationId`, `importSessionId`. Phase 5 defines and persists the schema; Phase 5a populates import provenance on filesystem restore. — **Reversibility:** one-way — provenance is the source-of-truth for import dedup and audit; changing the schema would orphan historical provenance records.
- **D-17:** No note version history in Phase 5. Notes use overwrite semantics — each save replaces previous content. A `version` counter field (incremented on update) supports change tracking and optimistic concurrency. Phase 5b/6 may add revision history later. — **Reversibility:** reversible — adding history is additive; the `version` field provides the extension point.

### the agent's Discretion
- MiniSearch index configuration (BM25 parameters, field weights, tokenizer settings) — planner selects reasonable defaults within the indexed-field contract (D-12).
- LinkParser implementation details (regex for `[[wikilink]]` extraction, tie-break rule for duplicate title resolution) — planner may implement standard Obsidian-compatible syntax.
- Conversation summary prompt template (the exact system prompt sent to the summarization model) — planner designs within the 2-3 sentence/decisions+goals+facts format (D-10).
- MemoryEngine singleton instantiation and internal retrieval pipeline order (which store is queried first, how results are combined before scoring) — planner determines the optimal order.
- EventBus wiring (exact event names beyond `note:saved`, subscription patterns) — planner follows established Phase 1 EventBus patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §3 — Persistent Memory Architecture: ConversationMemory, UserMemoryFact, PreferenceMemory, MemoryEngine contract, retrieval and injection rules
- `.planning/PRODUCT_SPEC_v0_1.md` §3.2–§3.5 — ConversationMemoryStore (summary + recent turns), UserMemoryStore (facts with source/confidence), PreferenceMemoryStore (behavioral settings, persona config)
- `.planning/PRODUCT_SPEC_v0_1.md` §21 — Notes: NoteStore, wikilinks, LinkParser, note graph, backlinks, save pipeline
- `.planning/PRODUCT_SPEC_v0_1.md` §15 — Storage topology: NotesDB + MemoryDB in IndexedDB (v4 migration), LRU eviction (§15.3)
- `.planning/PRODUCT_SPEC_v0_1.md` §27 — LLM-Wiki & Filesystem Sync: NoteTagger, NoteQA, NoteChatConverter, NoteFileSync, MEM-02 note→memory extraction (Phase 5a scope)
- `.planning/PRODUCT_SPEC_v0_1.md` §13 — Primary/surface memory write constraints, BroadcastBus election
- `.planning/PRODUCT_SPEC_v0_1.md` §17.7.5 — R2 reconciliation: Persona in PreferenceMemoryStore, never UserMemoryStore
- `.planning/PRODUCT_SPEC_v0_1.md` Phase 5 file list — files to create in `src/core/memory/` and `src/core/notes/`
- `.planning/PRODUCT_REQUIREMENTS_AGENT_HARNESS.md` §4 MEM-G01 through MEM-G05, KNW-01 — Memory governance (Phase 5b scope, schema readiness in Phase 5)

### Project & Roadmap
- `.planning/PROJECT.md` — Constraints (MV3 rules, cost-effective runtime, NOT @ant-design/x-sdk), Key Decisions (persona in PreferenceMemoryStore, knowledge-first ordering, single haiku call for enrichment in Phase 5a)
- `.planning/ROADMAP.md` Phase 5 — Goal, success criteria (5 items), depends on Phase 4a, requirements NOTE-01/MEM-01/MEM-02
- `.planning/ROADMAP.md` Phase 5a — LLM-Wiki & Filesystem Sync (NOTE-02, NOTE-03), success criteria
- `.planning/ROADMAP.md` Phase 5b — Memory Governance & Experience Candidates (MEM-G01…G05, KNW-01, EVO-04)
- `.planning/REQUIREMENTS.md` — NOTE-01 (atomic notes + wikilinks + graph + MiniSearch), MEM-01 (conversation/user/preference memory), MEM-02 (single-writer memory)

### Prior Phase Context
- `.planning/phases/02-storage-security-foundation/02-CONTEXT.md` — D-04 (domain-specific Zustand stores), D-05 (shared service layer), D-08/D-09 (idb versioned upgrades), storage topology (IndexedDB for chat/notes/memory/diagnostics data)
- `.planning/phases/03-ai-core-pipeline/03-CONTEXT.md` — PersonaProfile + PersonaInjector with PreferenceMemoryStore persona config (user config ≠ inferred fact)
- `.planning/phases/04-context-optimization-pipeline/04-CONTEXT.md` — D-05 (ContextAssembler gathers sources into ContextOptimizerInput, missing sources are optional no-ops), D-18 (sourceId format: `memory.user.fact.abc123`), ContextAssembler receives memoryHints
- `.planning/phases/04a-page-content-extraction/04a-CONTEXT.md` — D-14/D-15 (MiniSearch heading-aware chunks + BM25 ranking — pattern to follow for notes), D-17 (per-tab in-memory cache pattern)
- `.planning/phases/04b-trust-aware-context-receipts/04b-CONTEXT.md` — D-06 (ContextTrustPolicy split ownership — MemoryEngine computes relevance/freshness), D-08 (relevance is query-aware, recomputed per turn), D-09 (sensitivity inheritance from MemoryRecord.sensitivity), MemoryEngine produces ContextItem[] for context pipeline

### Existing Code
- `src/core/storage/NotesStore.ts` — Zustand skeleton for notes UI state (ready: false, notes: [])
- `src/core/storage/MessageStore.ts` — Zustand skeleton for messages UI state (pattern to follow for memory store UIs)
- `src/core/storage/WriteJournal.ts` — Multi-store consistency protocol — used for NotesDB/MemoryDB write transactions
- `src/core/storage/MigrationRunner.ts` — IndexedDB versioned upgrade handlers — Phase 5 extends to v4 (NotesDB + MemoryDB schemas)
- `src/core/extraction/PageIndexBuilder.ts` — MiniSearch instance pattern (heading-aware chunks, BM25) — notes search follows similar pattern
- `src/core/extraction/types.ts` — ExtractionResult discriminated union pattern — follow for NotesDB/MemoryEngine result types
- `src/core/runtime/BroadcastBus.ts` — Cross-surface pub/sub used for primary surface election and `WORKSPACE_UPDATED` events
- `src/core/events/EventBus.ts` — Internal event system — `note:saved` triggers MiniSearch index sync
- `src/core/ai/PersonaInjector.ts` — Persona injection pattern — MemoryEngine preference injection follows similar pattern for context assembly

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **WriteJournal** (`src/core/storage/WriteJournal.ts`): Multi-store consistency protocol — NotesDB and MemoryDB write operations must comply with the `WriteJournalEntry` lifecycle (pending → applying → completed/failed/rolled-back).
- **MigrationRunner** (`src/core/storage/MigrationRunner.ts`): idb versioned upgrade handlers (v1→v2→v3→v4) — Phase 5 adds v4 migration for NotesDB (notes, concepts, links) and MemoryDB (conversation_summaries, user_facts, preferences) object stores.
- **PageIndexBuilder** (`src/core/extraction/PageIndexBuilder.ts`): MiniSearch instance with BM25 + heading-aware chunks — notes search follows the same MiniSearch pattern but with different indexed fields (title, content, tags, wikilinkTargets).
- **BroadcastBus** (`src/core/runtime/BroadcastBus.ts`): Primary surface election — MemoryEngine writes must check `isPrimarySurface()` before committing. Read-only on secondary surfaces.
- **EventBus** (`src/core/events/EventBus.ts`): Internal pub/sub — `note:saved` event triggers MiniSearch incremental index update and NoteGraph recomputation.
- **ContextTrustPolicy** (`src/core/context/ContextTrustPolicy.ts`): Trust/sensitivity assignment — MemoryEngine feeds ContextItem[] with trade/sensitivity metadata into ContextAssembler per Phase 4b contract.

### Established Patterns
- **Module-level singletons**: MemoryEngine, NotesDB, and NoteGraph follow the same singleton pattern as ContextOptimizer, PromptCacheManager, and TokenBudget.
- **Core module isolation**: New `src/core/memory/` and `src/core/notes/` modules must not import from `src/components/`. Same boundary as `src/core/ai/` and `src/core/context/`.
- **Zod validation**: MemoryRecord, Note, ContextItem, and retrieval scoring inputs should use Zod schemas at module boundaries.
- **Discriminated unions**: Result types (e.g., `NoteFindResult`, `MemoryRetrievalResult`) follow the Phase 4a `ExtractionResult` pattern.
- **TDD with vitest**: Test files in `tests/core/memory/` and `tests/core/notes/` mirroring `src/core/memory/` and `src/core/notes/`.
- **IndexedDB via idb 8**: NotesDB and MemoryDB use idb's native versioned upgrade handlers, following the Phase 2 migration pattern.
- **SourceId dot-separated format**: `memory.user.fact.abc123`, `memory.conversation.summary.session-xyz`, `memory.preference.persona.default` per Phase 4 D-18.

### Integration Points
- **ContextAssembler** (`src/core/ai/AgentTurnInput.ts`): Receives `memoryHints: RetrievedMemory[]` from MemoryEngine. Phase 5 MemoryEngine feeds this field; ContextAssembler wraps results in ContextItem[] with trade/sensitivity/provenance metadata.
- **ContextOptimizer** (`src/core/context/ContextOptimizer.ts`): Receives memory-sourced ContextItem[] via optimized context assembly. Memory relevance/freshness scores are consumed during optimization.
- **AgentOrchestrator.runTurn()**: Conversation memory (summary + recent turns) is assembled into the context before each planner loop.
- **PersonaInjector** (`src/core/ai/persona/PersonaInjector.ts`): Reads persona configuration from PreferenceMemoryStore (`np_persona`). MemoryEngine is the intermediary — PersonaInjector calls MemoryEngine.getPreferences().
- **WriteJournal + BroadcastBus**: Memory writes must journal across stores (MemoryDB + IndexedDB) and broadcast `WORKSPACE_UPDATED` on commit. Single-writer enforcement via BroadcastBus primary election.
- **Phase 5a NoteTagger/NoteQA/NoteChatConverter**: Will consume NotesDB (search, CRUD), NoteGraph (related notes), and MemoryEngine (memory upsert from notes, RAG retrieval).
- **Phase 7 Notes UI**: Will consume NotesDB (CRUD), NoteGraph (backlinks, related), MiniSearch (search), and MemoryEngine (preferences for persona).

</code_context>

<specifics>
## Specific Ideas

- `content` is the single source of truth for wikilinks — derived data (links[], backlinks[], graph edges) must never be manually edited.
- LLM-generated conversation summaries must capture decisions, goals, user preferences, facts, and open tasks — not conversational filler.
- Persona configuration (`np_persona`) lives in PreferenceMemoryStore, never in UserMemoryStore — this is a locked product decision from Rev. B (R2 reconciliation).
- Memory write guard: every MemoryEngine.write() call must check `isPrimarySurface()` via BroadcastBus before committing — secondary surfaces are read-only.
- The `note:saved` EventBus event is the canonical trigger for MiniSearch index sync, NoteGraph recomputation, and (in Phase 5a) NoteFileSync and NoteTagger.
- ID-based link resolution means `links[]` contains note IDs, not titles — titles are display metadata only.
- Unresolved wikilinks must not create graph edges — they appear only in the `unresolvedLinks[]` array until the target note is created.
- Notes have no retention/pruning — they are durable user knowledge. Only conversation storage has LRU eviction.
</specifics>

<deferred>
## Deferred Ideas

- **Concept extraction:** Phase 5 provides the NotesDB concept schema but no extraction logic. Phase 5a NoteTagger implements concept extraction as part of auto-tag/category/summary.
- **Memory consolidation/merging:** Phase 5b implements semantic merging, fact promotion (episodic → semantic), conflict detection, and cross-store rewrites. Phase 5 stores are independent with no consolidation.
- **Note version history:** Phase 5b/6 may add NoteHistoryStore with last-N revisions, revert support, diff views, and audit logs. Phase 5 only tracks a version counter.
- **Memory lifecycle governance:** Phase 5b adds working-memory expiration, retention policies, soft deletion, forgotten status, and user-controlled cleanup.
- **LLM enrichment thresholds:** Deferred — Phase 5a renders all enrichment as suggestions requiring user acceptance. No confidence-based auto-apply.
- **Procedural experience store:** Phase 5b implements ProceduralExperience candidates from verified trajectories. Phase 5 defines the taxonomy slot only.
- **Knowledge-edge provenance (KNW-01):** Phase 5b adds explicit-wikilink/imported-frontmatter/ai-suggested/accepted-suggestion edge provenance. Phase 5 stores only the base links[].
- **Active tool discovery (TOL-06):** Phase 8a. Phase 5 MemoryEngine retrieval does not interact with tool schemas.
- **Context quality telemetry (CTX-T06):** Phase 6a. Phase 5 ensures memory-sourced ContextItem[] data is structured for telemetry consumption.
</deferred>

---

*Phase: 05-Knowledge Base*
*Context gathered: 2026-08-01*
