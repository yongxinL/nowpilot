# Phase 05: Knowledge Base - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 05-Knowledge Base
**Areas discussed:** Wikilink storage model, Memory scoring formula (confidence + weighting), Notes ↔ MiniSearch coordination, Conversation summarization, KB-08 Memory Type Taxonomy, KB-12 AI Memory Write Policy, KB-05 Note Identity & Rename, KB-06 Unresolved Wikilinks, KB-09 Memory Consolidation Policy, KB-10 Context Retrieval Limits, KB-07 Knowledge Graph Similarity Formula, KB-13 Concept Store Lifecycle, KB-11 Versioning Strategy, KB-15 Retention & Pruning, KB-14 LLM Wiki Confidence Threshold, KB-16 Import & Provenance

---

## Wikilink Storage Model

| Option | Description | Selected |
|--------|-------------|----------|
| Inline markdown only | Store wikilinks as raw [[title]] in content. Parse at render/search time. | |
| Edge relations + inline | Store both inline text AND derived links[] with note IDs. recomputed on every save. | ✓ |
| Edge relations only | Convert [[title]] to normalized refs on save, strip from body. | |

**User's choice:** Edge relations + inline. `content` is source of truth; `links[]` is derived index with resolved note IDs, fully recomputed on every save. Backlinks never stored — computed from links[]. Graph edges generated from links[].

---

## Memory Scoring — Confidence

| Option | Description | Selected |
|--------|-------------|----------|
| Source-based | Confidence = explicit-user (1.0) > verified-state (0.8) > previous-explicit (0.7) > inferred (0.5). Immutable after creation. | ✓ |
| Hybrid source + usage | Base confidence × usage factor. Adaptive but non-deterministic. | |
| Usage-based only | All facts start at 0.5, increase with usage. Ignores source provenance. | |

**User's choice:** Source-based confidence. Confidence represents factual trustworthiness, not retrieval popularity. Assigned at creation, remains stable unless source changes. `useCount` tracked separately. Retrieval ranking may consider useCount; conflict resolution must use confidence.

---

## Memory Scoring — Formula Weights

| Option | Description | Selected |
|--------|-------------|----------|
| Equal weighting | All 5 factors equally weighted (20% each). | |
| Relevance-primary | keywordMatch 35% + tagMatch 25% + recency 20% + confidence 10% + useCount 10%. | ✓ |
| Recency-primary | Recency 40% dominates. | |

**User's choice:** Relevance-primary weighting. Relevance factors (keywordMatch + tagMatch) = 60%. Confidence is trust signal, not primary driver. UseCount influences but cannot overpower relevance.

---

## Notes ↔ MiniSearch Coordination

| Option | Description | Selected |
|--------|-------------|----------|
| Separate instance, re-index on write | Dedicated instance, full re-index on each CRUD write. | |
| Separate instance, incremental update | Dedicated instance, per-document add/replace/remove. | ✓ |
| Single shared MiniSearch | One instance across page and notes with source discriminator. | |

**User's choice:** Separate persistent MiniSearch instance with incremental CRUD updates via `EventBus('note:saved')`. Full rebuild for startup/import/migration only. Indexed fields: title, content, tags, wikilinkTargets.

---

## Conversation Summarization

| Option | Description | Selected |
|--------|-------------|----------|
| LLM summary after 12 messages | Cheapest tier generates 2-3 sentence summary at 12-message boundary. | ✓ |
| Extractive summary | TF-IDF keyword extraction — no LLM call. | |
| Sliding window only | Keep last N turns, drop everything older. | |

**User's choice:** LLM-generated summaries at 12-message boundary, cheapest summarization tier. 2-3 sentences covering decisions, goals, preferences, facts, open tasks. Stored as memory artifacts; original messages preserved. Context assembly: head + summary + recent tail.

---

## KB-08: Memory Type Taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Phased introduction | Phase 5 uses only 3 stores; type field added in Phase 5b. | |
| Encode taxonomy now | Add memoryType to all records now. Phase 5b adds lifecycle/governance. | ✓ |
| 1:1 store mapping | Conversation=episodic, User=semantic, Preference=preference. | |

**User's choice:** Encode taxonomy now. `memoryType` field (`working` | `episodic` | `semantic` | `preference` | `procedural`) on all records. Existing 3-store architecture unchanged. Phase 5 stores/preserves/retrieves by type. Phase 5b adds governance.

---

## KB-12: AI Memory Write Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Summarization only | Only conversation summaries are AI→memory writes. | ✓ |
| Summarization + explicit tool | Add 'remember-this' tool with user confirmation. | |
| Automatic fact extraction | MemoryEngine scans every AI response for facts. | |

**User's choice:** Summarization only for Phase 5. User facts only via explicit user action, Phase 5a note→memory extraction, or Phase 5b governance. Preferences only via explicit user settings/confirmation.

---

## KB-05: Note Identity & Rename Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Immutable ID, wikilinks use IDs | UUID ID, title is display metadata. Renames don't break links. | ✓ |
| Title as identity | Title is ID — renaming breaks all links. | |
| Title as primary, ID as fallback | Dual-key model with edge cases. | |

**User's choice:** Immutable UUID IDs. `title` is display only. All graph relationships use `noteId`. Rename updates only `title` — no broken links, no graph rebuild.

---

## KB-06: Unresolved Wikilinks

| Option | Description | Selected |
|--------|-------------|----------|
| Track as unresolved, display differently | `unresolvedLinks[]` array, distinct UI, auto-resolve on creation. | ✓ |
| Silently drop on save | Strip from links[], ignore. | |
| Create stub notes automatically | Auto-create empty stubs. | |

**User's choice:** Track in `unresolvedLinks[]`. Distinct UI (dashed underline, muted color, tooltip). Click opens pre-filled Create Note dialog. Auto-resolve when matching note created.

---

## KB-09: Memory Consolidation Policy

| Option | Description | Selected |
|--------|-------------|----------|
| No auto-consolidation | Stores independent, no merging. Phase 5b for governance. | ✓ |
| Basic deduplication only | Hash-based exact-content dedup on retrieval. | |
| Full consolidation pipeline | Semantic merge + promotion + conflict on every write. | |

**User's choice:** No automatic consolidation. Each store owns records independently. MemoryEngine retrieves from all, combines, scores. Phase 5b handles dedup, promotion, conflict detection.

---

## KB-10: Context Retrieval Limits

| Option | Description | Selected |
|--------|-------------|----------|
| Tier-gated, score threshold | top-3 (tiny) / top-5 (other) + 0.30 minimum score. | ✓ |
| Tier-gated only, no threshold | Always exact top-K regardless of relevance. | |
| Token-budget gated | Limits based on token budget, not count. | |

**User's choice:** Tier-gated with 0.30 minimum score threshold. Top-K is maximum, not guarantee. MemoryEngine owns scoring+threshold+selection; ContextAssembler owns token budgeting+packing.

---

## KB-07: Knowledge Graph Similarity Formula

| Option | Description | Selected |
|--------|-------------|----------|
| TF-IDF + cosine | Cosine over title+content vectors. | |
| Jaccard over tag+wikilink | Structural overlap only. | |
| Hybrid graph-first | 50% linkOverlap + 20% tagOverlap + 30% contentCosine. | ✓ |

**User's choice:** Hybrid: 50% link overlap + 20% tag overlap + 30% content cosine. Backlinks from resolved links only (deterministic). Related-note suggestions use hybrid formula.

---

## KB-13: Concept Store Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 5a | Schema ready, no extraction. Phase 5a NoteTagger implements. | ✓ |
| Skeleton concept store now | Minimal ConceptStore, empty, Phase 5a populates. | |
| Full concept extraction now | LLM extraction in Phase 5 — premature. | |

**User's choice:** Defer concept extraction to Phase 5a. Phase 5 provides NotesDB schema but no extraction logic. User-created tags only classification mechanism.

---

## KB-11: Versioning Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| No versioning | Overwrite semantics. `version` counter only. | ✓ |
| Simple revert history | Last 3-5 versions as snapshots. | |
| Full edit log | Append-only operation log for full history. | |

**User's choice:** No version history. Overwrite semantics. `version` counter field for change tracking + optimistic concurrency. Phase 5b/6 may add history later.

---

## KB-15: Retention & Pruning

| Option | Description | Selected |
|--------|-------------|----------|
| No pruning | No auto deletion. Phase 5b for governance. | |
| Conversation LRU only | 10 active / 100 archived, 30-min archive trigger. | ✓ |
| Full retention with soft delete | Trash for notes, forgotten status for memories. | |

**User's choice:** Conversation LRU only (max 10 active, max 100 archived). Notes and memories have no pruning — durable user knowledge. Phase 5b for memory governance.

---

## KB-14: LLM Wiki Confidence Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Define threshold now | Store threshold in Phase 5, enforce in Phase 5a. | |
| Defer entirely to Phase 5a | Phase 5a decides threshold and schema. | |
| No threshold — always suggested | All enrichment requires user acceptance. Confidence is display only. | ✓ |

**User's choice:** Always suggested, never auto-applied. Confidence is display metadata (ranking, ordering, UI indicators). No threshold triggers automatic application. AI suggests, user decides.

---

## KB-16: Import & Provenance

| Option | Description | Selected |
|--------|-------------|----------|
| Provenance field on all notes | NoteProvenance with source, importedAt, originalPath. | ✓ |
| No provenance, merge silently | Imported notes indistinguishable from user-created. | |
| Separate import log | External ImportLog, clean Note type. | |

**User's choice:** `NoteProvenance` on all notes. Source (`user-created` / `import` / `chat-conversion` / `ai-generated`), `importedAt`, `originalPath`, `conversationId`, `importSessionId`. Phase 5 defines schema; Phase 5a populates on import.

---

## the agent's Discretion

- MiniSearch index configuration (BM25 parameters, field weights, tokenizer settings)
- LinkParser regex and tie-break rule for duplicate title resolution
- Conversation summary prompt template
- MemoryEngine internal retrieval pipeline order
- EventBus event names beyond `note:saved` and subscription patterns

## Deferred Ideas

- Concept extraction → Phase 5a (NoteTagger)
- Memory consolidation/merging → Phase 5b (governance)
- Note version history → Phase 5b/6
- Memory lifecycle governance → Phase 5b
- LLM enrichment confidence thresholds → N/A (always user-approved)
- Procedural experience store → Phase 5b
- Knowledge-edge provenance (KNW-01) → Phase 5b
- Active tool discovery (TOL-06) → Phase 8a
- Context quality telemetry (CTX-T06) → Phase 6a
