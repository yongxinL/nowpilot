# Phase 5a: LLM-Wiki & Filesystem Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 5a-LLM-Wiki & Filesystem Sync
**Areas discussed:** NoteTagger Schema & MEM-02 Boundary, NoteFileSync: Persistence & Permissions, NoteQA Citation & Response Format, Save Pipeline Coordination

---

## NoteTagger Schema & MEM-02 Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Single schema with discriminator field | One JSON with `enrichment` + `memoryFacts` partitions | ✓ |
| Two sub-calls from a wrapper | Two sub-handlers, more decoupled | |
| Separate memory extraction from enrichment | Two LLM calls, breaks single-call D-01 | |

**User's choice:** Single structured response with explicit `enrichment` and `memoryFacts` partitions. The LLM performs a single Haiku call and returns one JSON object. NoteTagger parses once, splits result. Enrichment routes to note suggestions (accept/reject inline). MemoryFacts route to memory suggestions (side panel, also accept/reject). The NoteTagger never writes directly to MemoryEngine.

**Notes:** Memory facts remain separate from note enrichment — tags/category/summary are note metadata, memoryFacts are candidate memory records. Example schema provided with `enrichment: {tags, categoryPath, summary, suggestedConcepts}` and `memoryFacts: [{type, content, confidence, reason}]`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single suggestion panel with both sets | One panel: enrichment + memory | |
| Split review: enrichment inline, memory in side panel | Separate review surfaces | ✓ |
| Enrichment inline, memory silently batched | Accumulate in pending queue | |

**User's choice:** Split review — enrichment accepts/rejects inline on note editor, memory facts in separate notification/side-panel flow.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Map LLM score to `inferred` (0.5) always | Display score only, store 0.5 | |
| Use LLM score as `inferred` but cap at 0.5 | LLM score ≥ threshold → display ranked, store 0.5 | ✓ |
| Create `llm-suggested` tier at 0.4 | New confidence tier | |

**User's choice:** LLM self-reported confidence is display-only for suggestion ranking. System stores `inferred` (0.5). LLM score can't elevate the confidence tier.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Threshold 0.3, max 3 per note | Filter below 0.3, cap at 3 | ✓ |
| Threshold 0.5, max 2 per note | Higher quality bar | |
| Show all, let user decide | No filtering | |

**User's choice:** MemoryFacts with LLM confidence < 0.3 filtered out. Max 3 displayed per note save.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Stale suggestions silently discarded | Version mismatch → drop | ✓ |
| Stale suggestions show with warning | Banner on outdated suggestions | |
| Cancel in-flight on edit | Abort and re-trigger | |

**User's choice:** Version-based staleness check. If note was edited before suggestions arrive (version mismatch), silently discard. No UX noise.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Skip call if all enrichment toggles off | No LLM call when no features enabled | ✓ |
| Always make the call, filter in UI | Run call, filter display only | |
| Split prompt dynamically | Build prompt per-toggle | |

**User's choice:** Skip the LLM call entirely if autoTag, autoCategorize, and autoSummary are all off.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Direct LLM call via ProviderRouter | Bypass orchestrator | |
| Reuse AgentOrchestrator.runTurn | Full pipeline | |
| Shared NoteTaggerService wrapping LLM | Common utility | ✓ |

**User's choice:** Shared `LlmService` in `src/core/ai/LlmService.ts` — general-purpose structured-call utility for NoteTagger, NoteQA, NoteChatConverter, and future non-orchestration consumers.

---

| Option | Description | Selected |
|--------|-------------|----------|
| src/core/ai/LlmService.ts — general-purpose | AI core utility | ✓ |
| src/core/notes/NotesLlmService.ts — notes-specific | Within notes module | |

**User's choice:** General-purpose in `src/core/ai/`. Reusable across modules.

---

## NoteFileSync: Persistence & Permissions

| Option | Description | Selected |
|--------|-------------|----------|
| New object store in existing DB, v5 migration | Single DB, same connection | ✓ |
| Separate IndexedDB database | `NowPilotBackup` standalone | |

**User's choice:** New `backup_config` object store in existing NowPilot IndexedDB via MigrationRunner v5. Consistent with Phase 2 pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Check permission on every save; re-prompt once | Per-sync check, one re-prompt | ✓ |
| Assume permission persists; check on mount | Mount-only check | |
| Persist permission state, check periodically | Cached state, every N saves | |

**User's choice:** `handle.queryPermission({mode:'readwrite'})` on every sync. If denied → red "Backup: Error" + re-verify on next mount + "Re-select folder" prompt.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Per-note field in NoteSchema (`lastSyncedAt`) | Note holds its own sync timestamp | ✓ |
| In-memory Map in NoteFileSync | Lost on restart | |
| In backup_config IndexedDB store | Queries alongside handle | |

**User's choice:** Add `lastSyncedAt?: number` to NoteSchema. NoteFileSync writes this after each successful sync. Enables per-note external-change detection.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — track old path and clean up | Delete orphaned .md on rename | ✓ |
| No — only clean up on explicit delete | Orphans accumulate | |

**User's choice:** On note rename (title or categoryPath change), delete the old .md file. Same cleanup logic as explicit deletion.

---

## NoteQA Citation & Response Format

| Option | Description | Selected |
|--------|-------------|----------|
| Numbered reference markers mapped post-response | [1]/[2] markers → noteId map | ✓ |
| LLM returns noteId directly in JSON | Structured response | |
| Natural citations with note titles | Fuzzy-match titles | |

**User's choice:** Send numbered snippets to LLM with noteId metadata in prompt preamble. LLM responds with inline [1], [2] markers. NoteQA post-processes to build citations array with noteId, title, snippet, referenceNumber.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Text answer + structured citations array | Plain text + post-processed citations | ✓ |
| Fully structured JSON from LLM | JSON response with citations inline | |

**User's choice:** LLM returns plain text with [1], [2] markers. NoteQA parses markers and maps to structured citations array. Matches Appendix C NoteQAResultSchema.

---

| Option | Description | Selected |
|--------|-------------|----------|
| MiniSearch + memory facts, no synthesis | Both sources, just no LLM | ✓ |
| MiniSearch only, skip memory too | Pure search | |

**User's choice:** Tiny mode returns MiniSearch top-5 + memory facts as raw results with noteId links. No LLM call. Memory context adds value without token cost.

---

| Option | Description | Selected |
|--------|-------------|----------|
| NoteQA assembles its own prompt directly | No ContextOptimizer | ✓ |
| Reuse ContextOptimizer.optimize() | Full pipeline | |

**User's choice:** NoteQA builds its own prompt inline. Token budget is small (top-5 snippets + memory), independent of chat pipeline.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Separate mode within NoteQA | `search` and `ask` modes | ✓ |
| Part of MiniSearchNoteIndex | Index-level feature | |

**User's choice:** NoteQA has two modes: `search` (haiku rerank of top-10) and `ask` (flash-tier synthesis with citations). Shared entry point.

---

## Save Pipeline Coordination

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel independent handlers on EventBus | Both subscribe to note:saved independently | |
| NoteFileSync waits for NoteTagger enrichment acceptance | Delayed sync | |
| NoteFileSync writes immediately; re-syncs on enrichment accept | Immediate + re-sync | ✓ |

**User's choice:** NoteFileSync writes .md immediately on note:saved. When user accepts enrichment (another note:saved with updated metadata), NoteFileSync re-writes with enriched frontmatter.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Check primary surface only at MemoryEngine.write() time | Enrichment everywhere, write gated | ✓ |
| Skip NoteTagger entirely on secondary surfaces | No enrichment on secondary | |
| Fire on secondary, queue memory writes | Cross-surface queue | |

**User's choice:** NoteTagger runs on both surfaces — enrichment suggestions show everywhere. MemoryEngine.write() check gates MEM-02 at commit time only. Secondary surfaces show "Save from primary surface to update memory."

---

| Option | Description | Selected |
|--------|-------------|----------|
| Passive query service, UI-driven | getStaleNotes(), getOrphanNotes() | ✓ |
| EventBus subscriber, reactive | note:saved → update state | |

**User's choice:** NoteMaintenance is a passive query service. No background monitoring or EventBus subscriptions. User-initiated per D-06.

---

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory only — lost on session restart | Component state only | ✓ |
| Temporary IndexedDB store | Persistent pending queue | |
| Store on Note itself | suggestedTags etc. on schema | |

**User's choice:** Pending enrichment suggestions are in-memory component state. Lost on restart. "Regenerate" toolbar button (LLM-WIKI-04) is the recovery path.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full pipeline — same as any note save | NoteTagger + FileSync + MEM-02 | ✓ |
| Partial pipeline — skip NoteTagger | Sync only | |

**User's choice:** After NoteChatConverter drafts and user saves, the note goes through the full save pipeline — NoteTagger (may refine draft's enrichment) + NoteFileSync + MEM-02. Provenance = `chat-conversion`.

---

## the agent's Discretion

- LlamService implementation details: provider selection, temperature-0 enforcement, Zod response validation, JSON repair, abort propagation.
- NoteTagger LLM prompt template (system prompt, content formatting, structured output instructions).
- NoteQA LLM prompt template (citation instructions, snippet formatting, synthesis system prompt).
- NoteChatConverter LLM prompt template (draft structure, wikilink suggestions).
- NoteFileSync file format: YAML frontmatter field ordering, filename sanitization, collision suffixing.
- NoteMaintenance staleness comparison logic, orphan query implementation.
- EventBus handler registration and error boundary for NoteTagger/NoteFileSync.

## Deferred Ideas

- LLM wikilink autocomplete (D-04 — out of scope)
- Bidirectional filesystem sync (§27.9 — out of scope)
- Embedding-based vector search (§27.9 — out of scope)
- Persistent enrichment suggestions (memory-only per D-05)
- AI-suggested note creation from chat unprompted (§27.9 — out of scope)
- Image/file attachments in notes (§27.9 — out of scope)
