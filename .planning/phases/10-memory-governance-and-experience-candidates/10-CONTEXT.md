# Phase 10: Memory Governance and Experience Candidates - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Auto-review:** 2026-09-01 — all prior decisions (D-104…D-125) confirmed valid. Auto-selected recommended options for all gray areas.

<domain>
## Phase Boundary

Phase 10 delivers **memory governance**: `MemoryRecord` enrichment (source/confidence/lifecycle/sensitivity/verified-at metadata per MEM-02), deterministic conflict precedence (MEM-03), full user lifecycle controls (MEM-04), separate procedural experience storage with verification+approval gating (MEM-05), and knowledge-edge provenance tracking (KNW-01). It is the Phase-10 home of §28.4 (MEM-01…05, KNW-01 — 6 v1 requirements).

**Scope is per spec §18 Phase 10 / §28.4.** Create exactly:

```
src/core/memory/MemoryRecord.ts         # MemoryRecord type + conflict resolution (MEM-01/02/03)
src/core/memory/ProceduralExperience.ts # ProceduralExperience store + gating (MEM-05)
src/core/memory/MemoryGovernance.ts     # User lifecycle controls facade (MEM-04)
src/core/notes/NoteGraphProvenance.ts   # Edge provenance extension (KNW-01)
```

Plus: v5 IDB migration (memory_records store + Note graph edge provenance fields), MemoryGovernance UI state contracts (data shapes for Phase 15 UI), and conflict-resolution test fixtures.

**DONE-when (verbatim §18 + ROADMAP SC):** Conflict precedence test passes (correction > verified > prior > inference); user controls (view/source/confidence/edit/pin/forget/type-disable/export/cloud-exclude) available; procedural experience activates only after verification + approval; Notes→Memory boundary preserved. Gate: `pnpm run verify:phase-10`.

**Out of scope (verified §28.4 / prior CONTEXT):** Memory creation/extraction (Phase 8 MemoryEngine, Phase 9 NoteTagger NMEM-02); LLM enrichment (Phase 9); full governance UI rendering (Phase 15); tool registration (Phase 18); embedding/vector search (deferred); bidirectional sync (v0.2+).
</domain>

<decisions>
## Implementation Decisions

### MemoryRecord type + canonical home (MEM-01/02)
- **D-126 (MemoryRecord canonical home is `@/types/harness` — Appendix C.1 spec 4900-4915):** `MemoryRecord`, `MemoryKind`, `ProceduralExperience`, `KnowledgeEdgeSource` types go in `src/types/harness.ts` per Appendix C.1 canonical-type-home rule (spec 4833). Phase 8's `types.ts` scope fence ("do NOT declare memory-kind or memory-record types here") is lifted for Phase 10 — these are governance records, not retrieval types. `MemoryRecord` extends `UserMemoryFact` (Phase 8) with `source: {kind:'extracted'|'manual'|'imported', noteId?, conversationId?}`, `confidence: number ∈ [0,1]`, `lifecycle: {status:'active'|'pinned'|'forgotten', verifiedAt?: number, expiresAt?: number}`, `sensitivity: 'normal'|'personal'|'secret'`. — **Reversibility:** `costly` — canonical type home; moving later touches all governance consumers.

### Conflict resolution — deterministic precedence (MEM-03)
- **D-127 (Conflict resolution = deterministic precedence, no LLM):** When two records claim the same fact (matched by content hash + tags overlap), resolve by `correction > verified > prior > inference`. Tie-break: higher `confidence` → more recent `verifiedAt` → `id` asc. The winning record absorbs the loser's `source` history into a `revisionChain[]` (audit trail). No LLM call — pure deterministic function `resolveConflict(a, b): MemoryRecord`. — **Reversibility:** `reversible` — pure function; swap algorithm is a local edit.

### User lifecycle controls (MEM-04)
- **D-128 (MemoryGovernance facade exposes all 9 controls as pure functions):** `view(recordId)`, `source(recordId)`, `confidence(recordId)`, `edit(recordId, patch)`, `pin(recordId)`, `forget(recordId)` (soft-delete: status='forgotten'), `disableType(type)` (disable all records of a MemoryKind), `export(filter?)` (JSON serialization, redacted), `cloudExclude(recordId)` (flag to exclude from any cloud sync). All mutate MemoryDB records via WriteJournal (single-writer gate). UI rendering is Phase 15 — Phase 10 ships the data contract + facade. — **Reversibility:** `reversible` — additive facade over existing MemoryDB.

### Procedural experience storage + gating (MEM-05)
- **D-129 (ProceduralExperience stored in separate MemoryDB store, activated only after verification + approval):** New `procedural_experiences` store in MemoryDB (v5 migration). `ProceduralExperience` type: `{id, title, description, steps[], source, confidence, status:'proposed'|'verified'|'approved'|'rejected', verifiedAt?, approvedAt?}`. Gating: `status === 'approved'` required for retrieval by MemoryEngine. Verification = automated check (steps parseable, no contradictions). Approval = user action (Phase 15 UI). Until approved, records are invisible to `retrieveMemoryHints()`. — **Reversibility:** `costly` — new IDB store; rollback needs down-migration.

### Knowledge edge provenance (KNW-01)
- **D-130 (NoteGraph edges carry `source: KnowledgeEdgeSource` — extend NoteGraph from Phase 8):** `KnowledgeEdgeSource = 'explicit' | 'imported' | 'suggested' | 'accepted'` (spec §28.4 KNW-01). Extend `NoteGraph.topKSimilar()` to tag each edge with its provenance. `explicit` = user-created wikilink; `imported` = from filesystem restore; `suggested` = LLM/NoteTagger suggestion not yet accepted; `accepted` = suggested → user-confirmed. Stored on the `Note` type's `links[]` as `Array<{noteId, source}>`. v5 migration adds the source field (default 'explicit' for existing links). — **Reversibility:** `costly` — Note type shape change touches all graph consumers.

### Storage layer — v5 migration
- **D-131 (v5 migration: new `memory_records` store + `procedural_experiences` store + Note links provenance):** Extends `MemoryDB` (currently at v1 per `MEMORY_DB_VERSION` in `src/core/storage/MemoryDB.ts`). Adds `memory_records` (keyPath `id`, indexes byKind/byStatus/byConfidence) for governance-enriched records. Adds `procedural_experiences` (keyPath `id`). Extends `Note.links[]` with source field. Idempotent: skip if stores exist. — **Reversibility:** `one-way` — DB migration; rollback needs a down-migration.

### the agent's Discretion
- Whether `MemoryRecord` is a wrapper around `UserMemoryFact` or a superset type — both satisfy MEM-02.
- Whether conflict resolution lives in `MemoryRecord.ts` or a dedicated `MemoryConflictResolver.ts` — both satisfy D-127.
- Whether `NoteGraphProvenance.ts` extends `NoteGraph.ts` directly or is a wrapper module — both satisfy KNW-01.
- Whether procedural experience verification is a pure function or uses a schema validator — both satisfy MEM-05.
- Whether the v5 migration adds `memory_records` as a new store or extends `userFacts` with governance fields — both satisfy the DONE-when.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 10 block) — Create list, required tests, DONE-when. Sole authority on Phase-10 scope.
- `.planning/PRODUCT_SPEC_v0_1.md` §28.4 (lines ~3926-3980) — Memory governance requirements: MEM-01…05, KNW-01 verbatim.
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 (spec 4900-4915) — `MemoryKind`, `MemoryRecord`, `ProceduralExperience`, `KnowledgeEdgeSource` canonical types.
- `.planning/PRODUCT_SPEC_v0_1.md` §20.4 (line 3156) — v4 migration precedent; v5 follows same pattern.
- `.planning/PRODUCT_SPEC_v0_1.md` §24 — canonical verify:phase-10 gate string.
- `.planning/PRODUCT_SPEC_v0_1.md` §3.1-3.6 — memory framework (Phase 8 builds on this).
- `.planning/PRODUCT_SPEC_v0_1.md` §22.3 — NoteGraph cosine + backlinks (D-130 extends this).
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §5.2 — MV3 boundaries: governance runs in UI contexts only.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 10: Memory Governance and Experience Candidates" — goal, depends-on, requirements, success criteria.
- `.planning/REQUIREMENTS.md` — MEM-01…05, KNW-01 rows + phase-10 table row.
- `.planning/phases/09-llm-wiki-filesystem-sync/09-CONTEXT.md` — D-123 (NMEM-02 fact routing), D-125 (v4 migration precedent).
- `.planning/phases/08-knowledge-base-memory-minisearch-notes/08-CONTEXT.md` — D-104 (storage split), D-105 (MemoryEngine scope), D-112 (PreferenceMemoryStore), D-113 (MemoryScorer/Extractor).
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-CONTEXT.md` — MemoryDB foundation, WriteJournal, IndexedDBMigrator.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — per-surface singletons; src/core/ UI-framework-agnostic.
- `.planning/codebase/STACK.md` — idb v8, zod ^3.24.

### Source (integration targets)
- `src/types/harness.ts` — canonical home for MemoryRecord/ProceduralExperience/KnowledgeEdgeSource (D-126).
- `src/core/memory/types.ts` — UserMemoryFact, RetrievedMemory (MemoryRecord extends UserMemoryFact).
- `src/core/memory/MemoryEngine.ts` — retrieveMemoryHints, upsert (governance gates these).
- `src/core/memory/UserMemoryStore.ts` — userFacts store (memory_records extends this pattern).
- `src/core/storage/MemoryDB.ts` — MemoryDB foundation (v5 migration target).
- `src/core/storage/IndexedDBMigrator.ts` — v4→v5 migration follows v2→v3→v4 precedent.
- `src/core/notes/NoteGraph.ts` — topKSimilar + backlinks (D-130 extends).
- `src/types/notes.ts` — Note type (links[] provenance extension).
- `src/core/events/EventBus.ts` — governance event emit/subscribe.
- `tests/setup.ts` — fake-indexeddb; test conventions.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/storage/MemoryDB.ts` — userFacts/messages/conversationSummaries stores; v5 migration adds memory_records + procedural_experiences.
- `src/core/memory/UserMemoryStore.ts` — getScoredFacts, upsertFact pattern (memory_records follows same facade-over-IDB pattern).
- `src/core/memory/MemoryEngine.ts` — retrieveMemoryHints, assemble, upsert (governance layer gates/extends these).
- `src/core/memory/MemoryScorer.ts` — scoring formula (governance adds lifecycle-aware filtering).
- `src/core/notes/NoteGraph.ts` — topKSimilar, computeBacklinks (D-130 adds edge provenance).
- `src/core/storage/IndexedDBMigrator.ts` — registerMigration pattern for v5.
- `src/types/harness.ts` — canonical type home (existing reliability/trust types set the convention).

### Established Patterns
- **Canonical type home + re-export supersession (D-72/D-83/D-107/D-112)** — `@/types/harness` for governance records.
- **Metadata-local / bodies-IDB split (§23/D-104)** — chrome.storage.local for LRU indices/config, IDB for record bodies.
- **Single-writer + primary surface (§13)** — governance mutations gate on isPrimaryWriter.
- **WriteJournal for crash-safe persistence (D-41)** — all governance mutations journaled.
- **Gate re-pointing (D-92/D-103/D-114)** — verify:phase-10 re-pointed to §18 dirs.
- **TraceRedactor before persist/log (D-90)** — memory content redacted before IDB/logging.
- **Non-serializable handle in IDB (D-08)** — precedent for storing complex objects in IDB.

### Integration Points
- `MemoryRecord` → `MemoryDB.memory_records` store (v5 migration).
- `ProceduralExperience` → `MemoryDB.procedural_experiences` store (v5 migration).
- `MemoryGovernance` facade → `MemoryEngine` (gates retrieveMemoryHints for procedural records).
- `NoteGraph.topKSimilar` → edge source tagging (D-130).
- `Note.links[]` → `{noteId, source}` objects (v5 migration).
- `verify:phase-10` → package.json script re-point.
</code_context>

<specifics>
## Specific Ideas

- **Conflict resolution is deterministic (no LLM)** — D-127's precedence chain is pure logic; the `revisionChain[]` audit trail preserves history without needing AI judgment.
- **Procedural experience is invisible until approved** — MEM-05's gating means `retrieveMemoryHints()` filters `status !== 'approved'` records; the store can accumulate proposed procedures without affecting chat.
- **User controls are data contracts first, UI second** — Phase 10 ships the facade + types; Phase 15 wires the actual buttons/toggles.
- **Edge provenance defaults to 'explicit'** — existing wikilinks (Phase 8) are user-created; only new edges from LLM suggestions or imports get tagged differently.
- **v5 migration is idempotent** — follows the exact v4 pattern (skip if stores exist, skip if fields present).
- **NP-STRICT ceiling → 0** — new Phase-10 code strict-clean (STATE.md decision 17).
- **No invented requirement IDs / error codes** — 6 v1 requirements are MEM-01…05, KNW-01.
</specifics>

<deferred>
## Deferred Ideas

- **Full governance UI** (pin/forget/disable/export/cloud-exclude controls) — Phase 15.
- **Procedural experience approval UI** — Phase 15.
- **Conflict resolution review UI** (browse revisionChain) — Phase 15.
- **Tool registration for memory governance** — Phase 18.
- **Real LLM-based conflict resolution** — not in v0.1; deterministic is the v0.1 mechanism.
- **Embedding-based duplicate detection** — deferred per §3.2.

None of these belong in Phase 10 — discussion stayed within phase scope.
</deferred>

---

*Phase: 10-Memory Governance and Experience Candidates*
*Context gathered: 2026-09-01*
