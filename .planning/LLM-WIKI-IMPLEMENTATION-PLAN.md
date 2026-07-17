---
feature: LLM-Wiki & Filesystem Sync
spec: .planning/LLM-WIKI-SPEC.md
extends: Phase 7 (Notes system, AI runtime)
status: ready-for-implementation
model: DeepSeek V4 (Flash-tier for synthesis, Haiku-tier for analysis)
date: 2026-07-17
---

# Implementation Plan: LLM-Wiki & Filesystem Sync

## Model Strategy

**DeepSeek V4** is already supported via the OpenAI-compatible provider adapter (`@ai-sdk/openai` / `ProviderRegistry`). No new provider work needed.

| Task type | Tier | Why |
|-----------|------|-----|
| Tag + category + summary extraction | Haiku-tier (Flash model, low temp) | Low-complexity structured output. Cheap, fast. |
| RAG Q&A answer synthesis | Flash-tier (V4, medium temp) | Conversational quality needed for synthesized answers. |
| Chat-to-note conversion | Haiku-tier | Structured extraction similar to tagging. |
| Semantic search reranking | Haiku-tier | Simple ranking task, no reasoning needed. |

The existing `generateText` call pattern in `MemoryExtractor.ts:103` is reused directly. No prompt library or LangChain — all prompts are inline template strings validated via Zod `safeParse`.

---

## External References

| Component | Repo | What to reference |
|-----------|------|-------------------|
| Filesystem sync | `github.com/GoogleChromeLabs/file-system-access-demo` | `showDirectoryPicker()`, handle persistence in IndexedDB, read/write/delete patterns for `NoteFileSync.ts` |
| Wikilinks resolution | `github.com/foambubble/foam` | `[[title]]` parsing, backlinks panel, graph view. Our `LinkParser.ts` already follows this pattern. |
| Hierarchical categories | `github.com/dendronhq/dendron` | `parent.child.note` path notation, tree view UI. References for `CAT-02` category tree and `NotesSection.tsx`. |
| LLM + Chrome extension | `github.com/chathub-dev/chathub` | Multi-provider LLM setup in a Chrome extension. Prompt management, provider switching. Relevant for `NoteTagger.ts` provider resolution. |
| RAG (simplest form) | `github.com/run-llama/LlamaIndexTS` (`examples/simple-rag`) | Search → retrieve chunks → pass to LLM. Reference for `NoteQA.ts` flow (we use MiniSearch instead of LlamaIndex, same pattern). |

> **Note:** Only the File System Access API demo is essential reading — that API has nontrivial handle persistence quirks. Everything else follows patterns already established in the NowPilot codebase (`MemoryExtractor`, `ProviderRegistry`, `LinkParser`).

---

## Wave 0: Foundation (types, storage, provider wiring)

**Depends on:** Nothing. Blocks all downstream waves.

### Plan 01: Core types + storage + model wiring

| # | Task | File | Effort |
|---|------|------|--------|
| 1.1 | Extend `Note` interface: add `summary`, `categoryPath`, `summaryGeneratedAt`, `tagsGeneratedAt` (all optional) | `src/core/notes/LinkParser.ts` | 5m |
| 1.2 | Extend MiniSearch fields: add `tags` and `summary` to `fields: ['title', 'content', 'tags', 'summary']` | `src/core/notes/LinkParser.ts` | 2m |
| 1.3 | Extend `NowPilotDB` schema type: add `notes_backup_config` store definition | `src/core/storage/IndexedDBManager.ts` | 10m |
| 1.4 | Add DB_VERSION 3→4 migration: create `notes_backup_config` object store (`{ keyPath: 'id' }`) | `src/core/storage/IndexedDBManager.ts` + `migrations/` | 15m |
| 1.5 | Extend `NotesDB` methods: add optional fields to all signatures; add `getNoteByTitle(title: string)` using `getAll()` + client-side filter | `src/core/storage/stores/NotesDB.ts` | 15m |
| 1.6 | Create `NoteTagger.ts` service: wraps `generateText` with Haiku-tier model accessor (follows `MemoryExtractor` pattern — Zod `safeParse` on output, single retry, never throws) | `src/core/notes/NoteTagger.ts` (new) | 45m |
| 1.7 | Write prompt for NoteTagger: "Analyze this note. Return tags, categoryPath, summary, memoryFacts." Include existing category paths in context so the LLM can place the note correctly. | inline in `NoteTagger.ts` | 20m |
| 1.8 | Add `np_notes_llm_features` to chrome.storage.local defaults: `{ autoTag: true, autoCategorize: true, autoSummary: true, aiSearch: true }` | `src/core/stores/workspaceStore.ts` or independent helper | 10m |

**must_haves:**
- `NotesDB.getNoteByTitle('MySQL Setup')` returns matching note or undefined
- `NoteTagger.analyze(title, content, categories)` returns `{ tags: string[], categoryPath: string|null, summary: string, memoryFacts: MemoryFact[] }`
- IndexedDB `notes_backup_config` store exists after migration
- MiniSearch returns results with `tags` and `summary` in store fields

---

## Wave 1: One-Way Filesystem Sync

**Depends on:** Wave 0 (notes_backup_config store, extended Note type).

### Plan 02: NoteFileSync service + backup UI

| # | Task | File | Effort |
|---|------|------|--------|
| 2.1 | Create `NoteFileSync.ts` service class: `init(handle)`, `sync(note, action)`, `deleteByNote(note)`, `getStatus()`, `getHandle()`, `clearHandle()` | `src/core/notes/NoteFileSync.ts` (new) | 2h |
| 2.2 | Implement `sync()`: resolve path `{categoryPath}/{sanitizedTitle}.md`, create nested dirs via `FileSystemDirectoryHandle.getDirectoryHandle(..., { create: true })`, write file via `getFileHandle(..., { create: true })` → `createWritable()` | `src/core/notes/NoteFileSync.ts` | 1.5h |
| 2.3 | Implement YAML frontmatter serialization: manual `JSON.stringify`-like writer for flat key-value pairs (avoid `yaml` dep for v0.1 — `summary` values may contain quotes/newlines, use simple escaping) | `src/core/notes/NoteFileSync.ts` | 1h |
| 2.4 | Implement file name sanitization: replace `/ \ : * ? " < > \|` with `_` | `src/core/notes/NoteFileSync.ts` | 10m |
| 2.5 | Implement title collision resolution: scan directory, find highest `{title} (N).md` suffix | `src/core/notes/NoteFileSync.ts` | 30m |
| 2.6 | Implement external change detection: `file.getFile().lastModified` vs in-memory `lastSyncTimestamp`; 2s tolerance window; show `App.useApp().modal.confirm()` on conflict (SYNC-06) | `src/core/notes/NoteFileSync.ts` | 45m |
| 2.7 | Implement permission check on init: `handle.queryPermission()`, set status to `error` if denied | `src/core/notes/NoteFileSync.ts` | 15m |
| 2.8 | Implement 50ms debounce for rapid saves | `src/core/notes/NoteFileSync.ts` | 10m |
| 2.9 | Implement `deleteByNote()`: delete file, remove empty parent folders recursively (SYNC-11) | `src/core/notes/NoteFileSync.ts` | 20m |
| 2.10 | Add sync status Tag to NotesPage toolbar: `Backup: On/Off/Error` with tooltip | `src/core/pages/NotesPage.tsx` | 20m |
| 2.11 | Add "Set backup folder" button to NotesPage toolbar (or NotesSection in Options): `showDirectoryPicker()` → persist handle → init sync | `src/core/pages/NotesPage.tsx` | 20m |

**must_haves:**
- `NoteFileSync.sync(note)` writes `path/to/category/Note Title.md` with correct frontmatter
- `NoteFileSync.getStatus()` returns `'active' | 'disabled' | 'error'`
- Folder picker button calls `showDirectoryPicker()` and stores handle in IndexedDB
- External edit conflict dialog appears when file was modified outside app
- Sync Tag in toolbar updates reactively (useState from NoteFileSync.getStatus())

---

## Wave 2: LLM-Powered Save Pipeline

**Depends on:** Wave 0 (NoteTagger), Wave 1 (NoteFileSync).

### Plan 03: Auto-tag, auto-categorize, auto-summarize on save

| # | Task | File | Effort |
|---|------|------|--------|
| 3.1 | Wire save pipeline in `NotesPage.handleSave()`: after `NotesDB.updateNote()`, call `NoteTagger.analyze()` (if enabled), then `NoteFileSync.sync()`, then `NoteMaintenance.updateTimestamps()` | `src/core/pages/NotesPage.tsx` | 30m |
| 3.2 | Build tag suggestion UI in NoteEditor: after LLM returns, render `Tag.CloseIcon` for each suggested tag with ✓/✗ icons. Accepted tags merge into `note.tags`. Rejected tags are discarded. | `src/components/notes/NoteEditor.tsx` | 1h |
| 3.3 | Build category input in NoteEditor: `Input` component pre-filled with LLM-suggested `categoryPath`. Normalize on blur (no leading/trailing slashes, no `..`, no empty segments). Red border on invalid. | `src/components/notes/NoteEditor.tsx` | 30m |
| 3.4 | Build summary display + regenerate button: single line below toolbar showing `summary` text with a small "Regenerate" link. | `src/components/notes/NoteEditor.tsx` | 20m |
| 3.5 | Build staleness hint: when `note.updated > tagsGeneratedAt`, show compact `Alert` below preview: "Content has changed — [Regenerate tags/summary]". | `src/components/notes/NoteEditor.tsx` | 20m |
| 3.6 | Wire feature toggles: read `np_notes_llm_features` before calling `NoteTagger`. Skip LLM call if toggle is off. | `src/core/pages/NotesPage.tsx` | 15m |

**must_haves:**
- Saving a note triggers LLM call → tag suggestions appear in editor with accept/reject
- Category input allows typing, validates on blur, red border on invalid path
- Regenerate button re-runs the LLM call and updates inline
- Staleness hint appears when content was edited after last LLM analysis
- Toggling a feature off in chrome.storage prevents the LLM call

---

## Wave 3: Search + Q&A

**Depends on:** Wave 0 (MiniSearch index extended, NoteTagger available).

### Plan 04: Semantic search reranking + RAG Q&A

| # | Task | File | Effort |
|---|------|------|--------|
| 4.1 | Create `NoteQA.ts` service: `ask(query, allNotes)` — MiniSearch retrieval → LLM synthesis → return `{ answer, citations }` | `src/core/notes/NoteQA.ts` (new) | 1.5h |
| 4.2 | Implement Flash-tier LLM call for Q&A: pass top-5 snippets + query, ask for answer with per-statement citations. Validate with Zod schema. | `src/core/notes/NoteQA.ts` | 1h |
| 4.3 | Implement MEM-01: call `MemoryEngine.assemble()` for relevant user facts, include in LLM context alongside note snippets | `src/core/notes/NoteQA.ts` | 30m |
| 4.4 | Build "Ask notes" UI: `Input.Search` at top of NotesPage main area. On submit, call `NoteQA.ask()`, render `@ant-design/x` Bubble inline with answer text + citation `Tag`s | `src/core/pages/NotesPage.tsx` | 1h |
| 4.5 | Build semantic search reranking: in NoteList search, when results < 3 or AI toggle is on, call Haiku-tier LLM to rerank top-10 MiniSearch results. Return ranked list. | `src/components/notes/NoteList.tsx` | 45m |
| 4.6 | Build AI search toggle button in NoteList search bar | `src/components/notes/NoteList.tsx` | 15m |
| 4.7 | Add summary line to NoteList items: `Typography.Text` (type: secondary, ellipsis) below each title showing first sentence of summary | `src/components/notes/NoteList.tsx` | 15m |

**must_haves:**
- `NoteQA.ask("How to deploy?")` returns answer with ≥1 citation referencing a note title
- Citation Tags navigate to the source note (click → selectNote → scroll editor)
- AI search toggle shows "AI" indicator on ranked results
- Summary text is visible in NoteList below each note title (truncated to 1 line)
- Bubble component renders inline, does not persist to IndexedDB

---

## Wave 4: Chat-to-Note + Memory Integration

**Depends on:** Wave 0 (NoteTagger), Wave 2 (save pipeline).

### Plan 05: Save chat as note + Note → Memory extraction

| # | Task | File | Effort |
|---|------|------|--------|
| 5.1 | Create `NoteChatConverter.ts` service: `convert(messages, memoryContext)` → LLM call → returns `{ title, content, tags, categoryPath, wikilinks }` | `src/core/notes/NoteChatConverter.ts` (new) | 1h |
| 5.2 | Implement MEM-03: call `MemoryEngine.assemble()` for user facts, pass alongside messages to LLM for richer note draft | `src/core/notes/NoteChatConverter.ts` | 20m |
| 5.3 | Enhance `SaveToNoteDialog`: on open, call `NoteChatConverter.convert()` for the selected message + surrounding context. Pre-fill title/content/tags in the dialog. Show preview pane using `NotePreview`. | `src/components/notes/SaveToNoteDialog.tsx` | 1.5h |
| 5.4 | Add "Save to note" menu item in `ChatMessage.tsx` three-dot menu → opens `SaveToNoteDialog` with message content | `src/components/chat/ChatMessage.tsx` | 20m |
| 5.5 | Implement MEM-02: in `NoteTagger`, extract `memoryFacts` from note content (same schema as `MemoryExtractor`). Route through `MemoryEngine.handleMemoryWrite()` using existing idempotency key pattern. | `src/core/notes/NoteTagger.ts` | 45m |
| 5.6 | Wire MEM-02 into save pipeline: after tagger returns, call memory engine for fact upsert (fire-and-forget, non-blocking) | `src/core/pages/NotesPage.tsx` | 15m |

**must_haves:**
- "Save to note" on a message opens dialog with LLM-drafted title, tags, content
- User can edit draft before saving
- Saving creates a note in NotesDB + triggers sync to filesystem
- Memory facts extracted from note content appear in MemoryEngine (visible in Diagnostics or MemorySection)
- NoteQA answers include memory facts when relevant

---

## Wave 5: Category System + Maintenance

**Depends on:** Wave 2 (categoryPath field populated), Wave 3 (NoteList).

### Plan 06: Category tree, orphan detection, bulk maintenance

| # | Task | File | Effort |
|---|------|------|--------|
| 6.1 | Build category tree in NoteList: toggle between flat list and AntD `Tree` grouped by `categoryPath` segments. "Uncategorized" node for notes without category. Click category → filter list. | `src/components/notes/NoteList.tsx` | 1.5h |
| 6.2 | Create `NoteMaintenance.ts` service: `findOrphans(notes)` returns notes with 0 wikilinks + 0 backlinks; `findStale(notes)` returns notes with `updated > tagsGeneratedAt` | `src/core/notes/NoteMaintenance.ts` (new) | 20m |
| 6.3 | Build orphan badge in NoteList: `Tag` (size: small) beside orphan note titles. Click → "Find context" → triggers `NoteQA.ask()` for that note's title/content to surface related notes. | `src/components/notes/NoteList.tsx` | 30m |
| 6.4 | Implement `regenerateAll()` in NoteMaintenance: iterate all notes, call NoteTagger for each, update IndexedDB, sync to filesystem. Sequential (not parallel) to respect rate limits. | `src/core/notes/NoteMaintenance.ts` | 30m |

**must_haves:**
- Category tree shows `InfoTech → Database → MySQL Setup` as nested tree nodes
- Orphan badge shows on notes with 0 connections
- "Find context" on orphan opens RAG Q&A with suggestions
- `regenerateAll()` processes notes sequentially without blocking UI

---

## Wave 6: Options Pages

**Depends on:** Waves 2-5 (all features implemented, need toggles/config).

### Plan 07: NotesSection + Import/Export enhancements

| # | Task | File | Effort |
|---|------|------|--------|
| 7.1 | Create `NotesSection.tsx` following `FeatureFlagsSection` pattern: 4 `Switch` toggles for LLM features; backup folder display with "Change folder" button; bulk maintenance button with stats | `src/components/options/NotesSection.tsx` (new) | 1.5h |
| 7.2 | Implement LLM feature toggle persistence: read/write `np_notes_llm_features` via `chrome.storage.local` | `src/components/options/NotesSection.tsx` | 15m |
| 7.3 | Implement bulk maintenance UI: "Re-analyze all notes" button → loading state → call `NoteMaintenance.regenerateAll()` → show progress ("12/47 notes processed") → completion message | `src/components/options/NotesSection.tsx` | 45m |
| 7.4 | Register NotesSection in Options: add `{ key: 'notes', label: 'Notes' }` to `OPTIONS_SECTIONS`; add `case 'notes'` to OptionsPage section router | `src/components/options/OptionsRoot.tsx`, `OptionsPage.tsx` | 10m |
| 7.5 | Add "Restore from folder" button to `ImportExportSection.tsx`: `showDirectoryPicker()` → walk tree → parse `.md` files with YAML frontmatter → preview modal → upsert | `src/components/options/ImportExportSection.tsx` | 1.5h |
| 7.6 | Implement restore YAML frontmatter parser: regex-based (extract `---...---` block, parse key-value pairs). Reconstruct `categoryPath` from file's directory path. Handle missing `id` (generate new). | `src/components/options/ImportExportSection.tsx` | 1h |
| 7.7 | Implement import preview modal: "Found N notes (X new, Y updated, Z unchanged). Proceed?" with AntD `Table` showing note title, status (new/updated/unchanged). | `src/components/options/ImportExportSection.tsx` | 45m |

**must_haves:**
- Notes section appears in Options sidebar
- 4 toggles persist and take effect immediately
- "Re-analyze all notes" shows live progress
- "Restore from folder" previews before importing
- Restored notes preserve category hierarchy from folder structure

---

## Wave 7: Tests & Polish

**Depends on:** All previous waves complete.

### Plan 08: Test coverage + edge cases

| # | Task | File | Effort |
|---|------|------|--------|
| 8.1 | Unit tests for `NoteTagger.analyze()`: mock `generateText`, verify Zod validation, verify empty-fallback on LLM failure | `tests/core/notes/NoteTagger.test.ts` (new) | 30m |
| 8.2 | Unit tests for `NoteQA.ask()`: mock MiniSearch + `generateText`, verify citation format, verify memory fact inclusion | `tests/core/notes/NoteQA.test.ts` (new) | 30m |
| 8.3 | Unit tests for `NoteChatConverter.convert()`: mock messages, verify structured output | `tests/core/notes/NoteChatConverter.test.ts` (new) | 30m |
| 8.4 | Unit tests for `NoteFileSync`: mock `FileSystemDirectoryHandle`, verify path resolution, sanitization, collision, external change detection | `tests/core/notes/NoteFileSync.test.ts` (new) | 45m |
| 8.5 | Unit tests for `NoteMaintenance`: verify orphan detection, staleness detection, regenerate-all sequence | `tests/core/notes/NoteMaintenance.test.ts` (new) | 30m |
| 8.6 | Component tests for NoteEditor: verify tag suggestions render, category input validation, staleness hint visibility | `tests/components/NoteEditor.test.tsx` (modify) | 30m |
| 8.7 | Component tests for NoteList: verify summary display, orphan badge, category tree toggle | `tests/components/NoteList.test.tsx` (modify) | 30m |
| 8.8 | Component tests for SaveToNoteDialog: verify LLM pre-fill | `tests/components/SaveToNoteDialog.test.tsx` (new) | 30m |
| 8.9 | Component tests for NotesSection: verify toggle persistence, bulk maintenance UI | `tests/components/NotesSection.test.tsx` (new) | 30m |
| 8.10 | Integration test: full save pipeline (save note → tagger → sync → maintenance timestamps) | `tests/core/notes/NotesPipeline.test.ts` (new) | 30m |

**must_haves:**
- All new core services have unit test coverage
- Mocked LLM calls use deterministic test fixtures
- Component tests use Testing Library with AntD-aware rendering
- Integration test covers end-to-end save pipeline

---

## Dependency Graph

```
Wave 0 (Foundation)
  │
  ├── Wave 1 (Filesystem Sync)
  │     │
  │     └── (parallel with Wave 2)
  │
  ├── Wave 2 (LLM Save Pipeline)
  │     │
  │     ├── Wave 3 (Search + Q&A)
  │     │     │
  │     │     └── Wave 5 (Category + Maintenance)
  │     │
  │     └── Wave 4 (Chat-to-Note + Memory)
  │
  └── Waves 2-5 complete ──► Wave 6 (Options)
                                 │
                                 └── Wave 7 (Tests)
```

**Parallelizable:** Wave 1 and Wave 2 can run in parallel (different files, no dependency). Wave 3 and Wave 4 can run in parallel after Wave 2.

---

## Implementation Order (Sequential Safe Path)

| Order | Plan | Est. hours | Cumulative |
|-------|------|-----------|------------|
| 1 | Plan 01: Foundation | 3h | 3h |
| 2 | Plan 02: Filesystem Sync | 7h | 10h |
| 3 | Plan 03: LLM Save Pipeline | 3.5h | 13.5h |
| 4 | Plan 04: Search + Q&A | 5.5h | 19h |
| 5 | Plan 05: Chat-to-Note + Memory | 5h | 24h |
| 6 | Plan 06: Category + Maintenance | 2.5h | 26.5h |
| 7 | Plan 07: Options Pages | 6.5h | 33h |
| 8 | Plan 08: Tests & Polish | 5h | 38h |

**Total estimated effort:** ~38 hours (~1 week with parallel waves).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| DeepSeek V4 structured output variability | Single-LLM-call prompt (D-01) uses JSON with `jsonrepair` fallback (already in deps). Temperature 0 for extraction tasks. |
| `FileSystemDirectoryHandle` persistence loss after browser restart | SYNC-02 checks permission on mount; user can re-select folder in one click. |
| Cloud-sync agent (iCloud/Drive) triggers false external-edit warnings | 2-second tolerance window in SYNC-06. |
| Large note collections cause LLM context overflow for category suggestions | Pass only category paths (not all content) to LLM. Paths for 500 notes ≈ 5KB — well within limits. |
| MiniSearch index rebuild on every save is O(n) | LinkParser already rebuilds on save. Adding `tags` + `summary` to search fields adds negligible overhead. |
