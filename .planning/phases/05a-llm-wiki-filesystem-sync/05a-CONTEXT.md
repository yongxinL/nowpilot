# Phase 5a: LLM-Wiki & Filesystem Sync - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers LLM enrichment over the Phase-5 note layer plus one-way local-filesystem sync. Concretely (spec §18 Phase 5a block, lines 2792–2833): five core services under `src/core/notes/` — `NoteTagger` (LLM tags + category + summary + memory facts), `NoteQA` (RAG Q&A over MiniSearch + memory with citations), `NoteChatConverter` (chat/page → structured note draft), `NoteFileSync` (one-way app→filesystem `.md` sync), `NoteMaintenance` (staleness/orphan detection, bulk analysis) — plus UI: `SaveToNoteDialog`, `NotesSection` (Options: LLM toggles, backup config, bulk maintenance), `ImportExportSection` (+ "Restore from folder"), and the `v4_notes_backup_config` IndexedDB migration (new store + Note fields). It implements the full §27 requirement set: LLM-WIKI-01…11, CAT-01…05, SYNC-01…11, NMEM-01…03.

**Scope authority (G0):** Spec-authoritative. Phase 5a = the §18 Phase-5a block + §27 (LLM-Wiki & Filesystem Sync, lines 3818–3914) + `verify:phase-5a` (spec line 3686: `tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations`).

**Boundary notes:**
- **Consumes Phase 5 outputs** — atomic notes with wikilinks (`NotesDB`), the persistent `MiniSearchIndex` (notes), `MemoryEngine` (single-writer orchestration), the `MemoryExtractor` haiku-tier schema + PersonaInjector stage (D-05-10 seam), and the trust-aware optimizer (Phase 4b). All of these exist and are green.
- **Not touched:** BacklinksPanel, NoteGraphView, WikilinkAutocomplete, NotePreview — the atomic-note + wikilink core is preserved unchanged (§27).
- **AI + IndexedDB in Side Panel/Standalone only (R-3);** background SW untouched. `showDirectoryPicker()` is **Standalone view only** (§27, SYNC-01); Side Panel gets only the `ChatMessage` "Save to note" affordance.
- **One-way export-first sync** (§27.9): never bidirectional, no live folder watch (out of scope v0.1).
- **MiniSearch is the only retrieval** — no embeddings, no vector store (LLM-WIKI-05, §7.7).
- **Memory stays single-writer** (D-05): NMEM-02 notes→memory only via MemoryEngine; memory never auto-writes notes.
- **No new packages beyond approved stack** — `yaml ^2` (YAML frontmatter) and `@types/wicg-file-system-access` (FileSystemDirectoryHandle types) are approved but **not yet installed**; everything else (minisearch, defuddle/turndown for page text) is already in `package.json`.

</domain>

<decisions>
## Implementation Decisions

### Auto-Tagging Suggestion UX (LLM-WIKI-01/02/04/08/11, CAT-03)
- **D-05a-01 [inline suggestion bar in editor]:** Tag/category/summary suggestions surface as a dismissible suggestion bar/banner near the top of the note editor — clickable tag chips + proposed category path + summary snippet. Co-located with the user's editing context. Not a separate panel, not a notification.
- **D-05a-02 [per-item toggle + Accept all]:** Each suggested tag has its own accept/decline toggle, plus a one-click "Accept all" for the whole batch. Confidence-gated items below the LLM-WIKI-11 threshold (≥0.60, max 3 facts / 5 tags) are silently discarded before display — never shown.
- **D-05a-03 [category as inline path input + suggestion]:** The category field is an inline path input (segments joined by `/`, CAT-01 normalization). When NoteTagger returns a suggested categoryPath it pre-fills as a *proposed* value with accept / edit / dismiss controls; the user can freely edit segments. Invalid segments flagged per CAT-05 (AntD red border).
- **D-05a-04 [persist acceptance; re-suggest only on content change]:** Accepted tags/category/summary persist into the note (accepted items stored at their reported confidence). Rejected items are remembered per note (never re-suggested for the same `{noteId, version}`, LLM-WIKI-11). Staleness detection (summaryGeneratedAt/tagsGeneratedAt vs updated, LLM-WIKI-08) drives the "Content has changed — Regenerate tags/summary" hint, which re-triggers suggestions.

### "Ask Notes" RAG Surface (LLM-WIKI-05/06, NMEM-01)
- **D-05a-05 [inline search box in Notes view]:** "Ask notes" lives as an inline search/ask input in the Notes page toolbar — not a dedicated page, not a chat preset. Co-located with the notes being referenced.
- **D-05a-06 [inline answer card + citation chips]:** Answers render as an ephemeral inline answer card under the search input — synthesized markdown (flash tier) with clickable citation Tags linking to source notes (click → open/navigate to the note). Dismissible. Matches the spec's @ant-design/x Bubble + citation Tags (Flow 13).
- **D-05a-07 [one merged input, AI-enhanced]:** A single search input runs MiniSearch; AI synthesis engages when the user asks a natural-language question, when hits < 3, or when "AI Search" is enabled (LLM-WIKI-05). No separate plain-vs-AI modes in the UI. Tiny mode falls back to plain MiniSearch (§18 3rd bullet, spec line 514).
- **D-05a-08 [zero hits = helpful message, no LLM call]:** Empty retrieval → a message like "No matching notes found" with NO provider call (matches ROADMAP SC #2 "zero hits yields a helpful message with no wasted LLM call").

### Save-to-Note Entry Points (LLM-WIKI-07/09, NMEM-03, §27.10)
- **D-05a-09 [per-message overflow action on assistant messages]:** "Save to note" is an action in each assistant message's overflow/hover menu (ChatMessage affordance) — not a chat toolbar button. This is the only Side-Panel entry point (§27 surfaces).
- **D-05a-10 [SaveToNoteDialog modal with preview]:** The LLM-drafted title/content/tags/wikilinks/categoryPath opens in a `SaveToNoteDialog` modal for review (edit-in-modal, then Save creates the note or Cancel). No navigation to the Notes editor.
- **D-05a-11 [page capture gets the same LLM-drafted dialog]:** The page→note flow also routes through `NoteChatConverter` → `SaveToNoteDialog`, drafting from the extracted `PageContext` (Phase 4a). Consistent drafting; user is the gatekeeper.
- **D-05a-12 [side panel drafts in-place]:** Side-panel saves open the dialog in the side panel (R-3 permits AI + IndexedDB there); no navigation jump to Standalone. The note then appears in Standalone via the existing note sync/refresh (note:saved event).
- **D-05a-13 [orphan "Find context" triggers RAG]:** The algorithmic orphan badge (LLM-WIKI-09, 0 wikilinks + 0 backlinks) offers "Find context", which triggers the NoteQA RAG path for that note.

### Filesystem Sync UX & Config (SYNC-01…11, CAT-04)
- **D-05a-14 [folder picker in both Options + Notes toolbar]:** Primary config lives in Options → Notes (NotesSection backup config); the Notes toolbar carries a quick "Backup: on/off [Configure]" indicator + button (SYNC-07). `showDirectoryPicker()` runs Standalone-only; the `FileSystemDirectoryHandle` persists in the `notes_backup_config` IndexedDB store (SYNC-01, non-serializable → not chrome.storage).
- **D-05a-15 [status Tag + last-error tooltip]:** Green "Backup: On" / gray "Backup: Off" / red "Backup: Error" Tag in the Notes toolbar; hover tooltip shows the last sync error (SYNC-08). No notification spam on state changes.
- **D-05a-16 [permission-loss banner with Re-select + Dismiss]:** In-Notes banner "Backup folder not accessible [Re-select folder] [Dismiss]" when `queryPermission()` fails (SYNC-02); sync stays disabled until the folder is re-selected. No auto-reprompt on every mount.
- **D-05a-17 [restore lives in Options → Import/Export with count preview]:** "Restore from folder" sits in Options → Import/Export, opening the preview modal "Found N notes (X new, Y updated, Z unchanged)" with [Import] [Cancel] (SYNC-09/10). Additive upsert — local notes not in the folder are never deleted. No restore-history/undo feature (out of scope).

### Core Service Contracts (locked by spec — implementation discretion only)
- NoteTagger: ONE haiku-tier temperature-0 call per save (tags + categoryPath + summary + memoryFacts), non-blocking after the IndexedDB write; save never waits (§22.1, D-05-10). Toggle-gated by `np_notes_llm_features` (autoTag/autoCategorize/autoSummary/aiSearch, LLM-WIKI-02). Routes through PersonaInjector (GR-3) + `requestJson` one-repair (GR-4).
- NoteQA: flash-tier synthesis over MiniSearch top-5 + memory facts (NMEM-01); cited markdown output (LLM-WIKI-06). "Re-analyze all notes" is user-initiated + sequential with real-time stats (LLM-WIKI-10).
- NoteChatConverter: haiku-tier draft of {title, content, tags ≤5, categoryPath, wikilinks} using conversation messages + `MemoryEngine.assemble()` (NMEM-03).
- NoteFileSync: fire-and-forget per-save write with 50 ms debounce (SYNC-03); YAML frontmatter `{id, created, updated, tags, categoryPath, summary}` (SYNC-04, `yaml ^2`); filename sanitization + collision suffixing (SYNC-04/05); external-change guard (2 s tolerance, default Skip, SYNC-06); delete-on-sync + empty-folder cleanup (SYNC-11).
- NoteMaintenance: staleness (timestamp comparison, LLM-WIKI-08) + orphan detection (algorithmic, no LLM, LLM-WIKI-09) + bulk re-analysis coordinator (LLM-WIKI-10).

### Security / Privacy (locked)
- TraceRedactor runs before indexing, logging, or writing to disk; password values never written to `.md`; filesystem paths + note content redacted from Diagnostics/exports (§27.6). RAG answers + page indexes are ephemeral (never persisted).

### the agent's Discretion
- Exact suggestion-bar component structure/placement inside the NotesPage layout (inline bar variant styling, dismiss persistence).
- Exact `np_notes_llm_features` setting shape + storage key + Zod schema (PreferenceMemoryStore precedent), and the exact `notes_backup_config` store schema beyond the handle field.
- Exact NoteTagger/NoteQA/NoteChatConverter public API surfaces (options, per-stage timeout/abort, tier defaults) following the `MemoryExtractor` precedent (operationId, providerId/model defaults, haiku tier).
- Exact NoteFileSync debounce/permission-check/write mechanics (50 ms debounce, permission re-check cadence, folder-tree walk).
- Exact v4 migration mechanics (idempotent upgrade path, new Note fields vs store) — spec line 2832 "v4 migration idempotent" is the contract.
- Exact `verify:phase-5a` script shape — spec line 3686 gives `tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations`; follow the §24 chain template (eslint + prettier + tsc + wxt build + vitest run) consistent with prior phases.
- Whether the summary snippet appears in the NoteList secondary text (LLM-WIKI-03) inline or behind a hover.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec (authoritative)
- `.planning/PRODUCT_SPEC_v0_1.md` §27 — LLM-Wiki & Filesystem Sync (lines 3818–3914). **The canonical requirement set:** §27.1 CAT-01…05 (category system), §27.2 LLM-WIKI-01…11 (incl. LLM-WIKI-11 suggestion confidence gating + staleness), §27.3 SYNC-01…11 (one-way sync), §27.4 NMEM-01…03 (memory↔notes), §27.5 core services, §27.6 reliability/privacy, §27.7/27.7a note-taking method + identity (WIKI-ID), §27.8 decisions (D-01 single call, D-07 haiku/flash, D-08 IDB handle), §27.9 out of scope, §27.10 UX flows.
- `.planning/PRODUCT_SPEC_v0_1.md` §18 Phase 5a block (lines 2792–2833) — create list (5 core services, SaveToNoteDialog, NotesSection, ImportExportSection, v4 migration), required tests (NoteTagger/NoteQA/NoteChatConverter/NoteFileSync/NoteMaintenance/v4 `.test.ts`), DONE-when list.
- `.planning/PRODUCT_SPEC_v0_1.md` §18 line 3686 — the `verify:phase-5a` script definition.
- `.planning/PRODUCT_SPEC_v0_1.md` §22.1 Performance (lines 3550–3572) — "save never waits" + non-blocking LLM contract.
- `.planning/PRODUCT_SPEC_v0_1.md` §0.5 Golden Rules + §0.2 (lines ~65–226) — GR-3 (PersonaInjector), GR-4 (Zod + one repair), GR-9 (canonical codes), R-3 (panel/standalone-only), R-10 (redaction).
- `.planning/PRODUCT_SPEC_v0_1.md` §26.5 MiniSearch integration (lines ~1075–1098) — persistent notes index; minimal-mode routing (Ask notes tiny fallback).
- `.planning/PRODUCT_SPEC_v0_1.md` §15.1 Note model + stores (lines ~1954–1986) — NotesDB shape the v4 migration extends; `notes_backup_config` store.

### Project planning artifacts
- `.planning/ROADMAP.md` Phase 5a (lines 379–393) — goal, LLM-WIKI-01…03 + SYNC-01…02, success criteria (SC #1 non-blocking suggestions, SC #2 cited answers + tiny fallback + zero-hit no-call, SC #3 user-gated chat→note, SC #4 folder export .md + collision + delete-on-sync + external guard, SC #5 additive restore).
- `.planning/REQUIREMENTS.md` LLM-WIKI-01…03 + SYNC-01…02 rows (lines 97–103).
- `.planning/phases/05-knowledge-base-memory-minisearch-notes/05-CONTEXT.md` — **D-05-10** (MemoryExtractor haiku stage = NoteTagger/NoteQA memory-upsert seam), D-05-02/07 (MemoryEngine single-writer + memoryHints seam), D-05-11/12 (persistent MiniSearch index lifecycle), D-05-18 (np_persona writer), deferred items pointing at 5a (LLM-Wiki enrichment, filesystem sync).
- `.planning/phases/04b-trust-aware-context-and-receipts/04b-CONTEXT.md` — the trust envelope NoteQA/NoteChatConverter context feeds flow through (retrieved data never instructs).
- `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-CONTEXT.md` — `PageContext` extraction + turndown-as-markdown pipeline (page→note source).
- `AGENTS.md` — 10 golden rules, risk register (R-3, R-5 host-page UI/write-back absent in v0.1, R-8 no-success-without-evidence, R-10 redaction), approved stack (`yaml ^2`, `@types/wicg-file-system-access` approved — install needed).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/notes/NoteGraph.ts` + `LinkParser.ts` — wikilink resolution; NoteChatConverter drafts wikilinks against the same resolution (exact title → updated desc → id asc).
- `src/core/search/MiniSearchIndex.ts` — the PERSISTENT notes index (title+content+tags+summary+categoryPath, in-memory, rebuilt on Notes view mount). NoteQA/LLM-WIKI-05 retrieval + "Ask notes" reuse this directly; NoteFileSync/restore reconstruct the index after upsert.
- `src/core/memory/MemoryEngine.ts` — single-writer orchestration (`assemble()` for NMEM-03/01 context; `addFacts` path for NMEM-02 persistence). NoteTagger memoryFacts route here.
- `src/core/memory/MemoryExtractor.ts` — the existing haiku-tier extraction schema + PersonaInjector stage + `requestJson` pattern = the exact template NoteTagger/NoteChatConverter/NoteQA follow (GR-3/GR-4, operationId, structured Zod + one repair, never throws → returns null).
- `src/core/ai/StructuredOutput.ts` (`requestJson`) + `src/core/ai/persona/PersonaInjector.ts` + `src/core/ai/TierResolver.ts` (haiku/flash) — the AI-call machinery all five services use.
- `src/core/prompts/index.ts` — `noteTagger` / `noteQA` / `noteChatConvert` / `memoryExtractor` PROMPTS already seeded with tier + cacheable flags; prompts get the suggested tags/category/summary/memoryFacts + wikilinks JSON contracts.
- `src/core/storage/NotesDB.ts` — `Note` type already carries the §27 LLM-Wiki fields (`summary`, `categoryPath`, `summaryGeneratedAt`, `tagsGeneratedAt`, `aiMeta.suggestedLinks`, `version`). `putNote` + `listNotes` + by-tags/by-updated indexes. v4 migration extends the DB schema (notes_backup_config store).
- `src/components/pages/NotesPage.tsx` — full list + editor + graph + backlinks + save pipeline (parseLinks → resolveLinks → putNote → note:saved). The save pipeline is where NoteTagger (non-blocking) + NoteFileSync hook in; the toolbar is where Ask-notes + backup status live.
- `src/components/pages/OptionsPage.tsx` — existing Card sections (Account/Appearance/content-trust) with the per-section pattern NotesSection/ImportExportSection extend.
- `src/components/pages/useStreamingLLM.ts` — the AI-call hook pattern (optimizer → planner/renderer ctx); NoteQA synthesis could share the streaming/optimizer seam but is an ephemeral one-shot answer.
- `src/core/security/TraceRedactor.ts` + `redactSensitive.ts` — R-10 redaction precedent for the .md write path and any sync logging (§27.6).
- `src/core/storage/ImportExport.ts` — Phase-2 import/export core (JSON+ZIP, scoped groups, manifest) that ImportExportSection's "Restore from folder" extends for the folder-source case.

### Established Patterns
- **Spec-verbatim paths (§8.5/§18) + Appendix C types (R-1)** — all five services land at the §18 create-list paths; Note types stay in NotesDB (already verbatim).
- **Non-blocking AI stages (§22.1)** — NoteTagger/NoteChatConverter never block the save; failures log a canonical GR-9 code and return null (MemoryExtractor precedent).
- **GR-3 / PersonaInjector** — every AI call routes through a PersonaInjector stage; prompts from `@/core/prompts`.
- **GR-4 / Zod + one repair** — `requestJson` for all structured output; never hand-parse.
- **Single-writer memory (D-05)** — NMEM-02 via MemoryEngine, primary surface only.
- **In-memory ephemeral RAG** — Ask notes answer + page indexes never persisted (§27.6).
- **verify:phase-N gate** — §24 chain; verify:phase-5a per spec line 3686.

### Integration Points
- `NotesPage.tsx` save pipeline → NoteTagger (non-blocking suggestions bar) + NoteFileSync (fire-and-forget .md) + NoteMaintenance staleness/orphan badges.
- `NotesPage.tsx` toolbar → Ask-notes inline input + answer card + backup status Tag + configure button.
- `ChatPage.tsx` / side-panel `ChatMessage` → "Save to note" overflow action → NoteChatConverter → SaveToNoteDialog.
- `OptionsPage.tsx` → NotesSection (np_notes_llm_features toggles, backup folder config, re-analyze all) + ImportExportSection (Restore from folder).
- `NotesDB` v4 migration → `notes_backup_config` store (FileSystemDirectoryHandle) — idb upgrade path (Phase-2 IndexedDBMigrator precedent).
- `MemoryEngine` → NMEM-02 fact persistence + NMEM-01/03 retrieval context (single-writer preserved).
- `MiniSearchIndex` → NoteQA retrieval + post-restore rebuild.
- R-3: all AI + IndexedDB + FileSystem handles live in Side Panel/Standalone only; background SW untouched.

</code_context>

<specifics>
## Specific Ideas

- **Through-line (auto):** Phase 5a is the product's "understand → extend" layer — the LLM turns the user's notes into an organized, answerable, portable knowledge base, while keeping the user in control at every accept/reject/import gate. Suggestions and drafts are always proposals; the user is the gatekeeper (§27.10).
- **P5a-1 (user):** All four surfaces are conservative and non-disruptive — inline suggestion bar (not a panel), inline Ask box (not a page), modal draft (not a navigation), status Tag (not notifications). The note editor stays the center of gravity.
- **P5a-2 (user):** Fire-and-forget everywhere AI or disk is touched — saves never wait on LLM or filesystem; failures degrade to a helpful hint, never a blocking error.
- **P5a-3 (user):** Confidence gating (LLM-WIKI-11) is the anti-noise contract — the UI only ever surfaces items ≥ 0.60, capped, stale-version-discarded; rejections remembered so users aren't re-nagged.
- **P5a-4 (user):** Sync is export-first backup, not a source of truth — additive restore never deletes local notes; external-change guard protects user edits.

</specifics>

<deferred>
## Deferred Ideas

- **Bidirectional filesystem sync / live folder watch** — v2, SYNC-03 (out of scope §27.9; correct-scope reason: requires polling/Native Messaging).
- **Embedding-based / vector retrieval** — v2, EMB-01 (MiniSearch remains v1 retrieval).
- **LLM wikilink autocomplete suggestions** — not in v0.1 (D-04, §27.7); NoteChatConverter still suggests wikilinks in drafted notes.
- **Restore history / undo of last import** — out of scope for the SYNC-09/10 additive restore; would add storage + UI.
- **Auto-create notes from chat unprompted** — explicitly out of scope (§27.9); chat→note is always user-initiated + gatekept.
- **Image/file attachments in notes** — out of scope (§27.9); Phase 7a multimodal territory.

None — discussion stayed within phase scope; deferred items tracked above.

</deferred>

---

*Phase: 5a-LLM-Wiki & Filesystem Sync*
*Context gathered: 2026-08-14*
