# Phase 05a: LLM-Wiki & Filesystem Sync — Research

**Researched:** 2026-08-02
**Domain:** LLM-powered knowledge enrichment, RAG Q&A, chat/page-to-note conversion, one-way filesystem sync, and note maintenance — layered atop the Phase 5 atomic-note-with-wikilinks core.
**Confidence:** HIGH

## Summary

Phase 5a builds five new services in `src/core/notes/` plus a shared `src/core/ai/LlmService.ts` to add LLM enrichment, RAG Q&A, chat conversion, filesystem backup, and maintenance to the existing note knowledge base. The core architecture is event-driven: `NotesDB.save()` emits `note:saved` on the EventBus, and both `NoteTagger` and `NoteFileSync` subscribe independently as parallel handlers. NoteTagger fires a non-blocking single haiku-tier structured-output LLM call for tags, category, summary, and memory facts as user-gated suggestions. NoteFileSync writes one-way `.md` backups with YAML frontmatter using the File System Access API.

Five services are introduced: **NoteTagger** (single LLM call for enrichment + memory extraction), **NoteQA** (MiniSearch top-N + MemoryEngine → flash-tier RAG synthesis with numbered citations), **NoteChatConverter** (chat/page → pre-filled note draft), **NoteFileSync** (one-way app→filesystem `.md` backup with collision detection and external-change guards), and **NoteMaintenance** (passive staleness/orphan detection). A shared **LlmService** wraps `ProviderAdapter` + `TierResolver` + `StructuredOutput` for all non-orchestration LLM consumers.

**Primary recommendation:** All five note services plus LlmService follow the existing singleton pattern (`ContextOptimizer`, `MemoryEngine`). Plan them as independent modules that subscribe to the `note:saved` EventBus event. Use two independent Zod schemas for NoteTaggerResult (with `enrichment` + `memoryFacts` partitions) and NoteQAResult (with `answer` + `citations` array). The v5 MigrationRunner adds a `backup_config` object store for the `FileSystemDirectoryHandle`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Note enrichment (tags/category/summary via LLM) | API / Backend (`src/core/notes/NoteTagger.ts`) | — | Core service in the notes layer; no browser-tier logic. LLM call via LlmService. |
| Memory extraction from notes (note→memory facts) | API / Backend (`NoteTagger` → `MemoryEngine`) | — | MEM-02 is gated at MemoryEngine.write(); extraction is API-layer |
| RAG Q&A (MiniSearch + memory + LLM synthesis) | API / Backend (`src/core/notes/NoteQA.ts`) | — | Retrieval + synthesis are pure backend; UI is Phase 7 consumer |
| Chat/page → note draft conversion | API / Backend (`src/core/notes/NoteChatConverter.ts`) | — | LLM draft generation; UI pre-fills editor (Phase 7) |
| Filesystem backup (one-way sync .md files) | API / Backend (`src/core/notes/NoteFileSync.ts`) | Browser (File System Access API) | Core sync logic is backend; `showDirectoryPicker()` browser API is the filesystem boundary |
| Backup folder permission management | Browser / Client | API / Backend | Permission checks use `handle.queryPermission()`; handle persisted in IndexedDB |
| External-change detection | API / Backend (`NoteFileSync`) | — | Timestamp comparison logic in the sync service |
| Staleness / orphan detection | API / Backend (`src/core/notes/NoteMaintenance.ts`) | — | Pure query service over NotesDB + NoteGraph |
| Shared LLM service | API / Backend (`src/core/ai/LlmService.ts`) | — | Wraps ProviderAdapter + TierResolver; used by all note services |
| LLM prompt templates | API / Backend (prompt constants) | — | Canonical prompts from PRODUCT_SPEC Appendix A |
| IndexedDB migration v5 | Database / Storage (`MigrationRunner.ts`) | — | Adds `backup_config` object store |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** NoteTagger makes a single haiku-tier, temperature-0 structured-output LLM call via `LlmService`. The response is a single JSON object with two explicit partitions: `enrichment` (tags, categoryPath, summary, suggestedConcepts) and `memoryFacts` (array of {type, content, confidence, reason}). NoteTagger parses once, splits, and routes enrichment as note suggestions and memoryFacts as memory candidates.
- **D-02:** NoteTagger enrichment renders as accept/reject suggestions inline on the note editor (tags/category/summary/concepts). MemoryFacts render as suggestions in a separate "New Memory Facts" notification/side-panel flow. Two independent review surfaces.
- **D-03:** NoteTagger's LLM-reported confidence score is display-only metadata for ranking within memory suggestions. All accepted memoryFacts are stored with confidence=0.5 (`inferred`) per Phase 5 D-07 confidence model. The LLM score is never used as the system confidence tier.
- **D-04:** MemoryFacts with LLM confidence < 0.3 are filtered and never shown as suggestions. Max 3 memoryFacts displayed per note save. Both thresholds are local constants in NoteTagger.
- **D-05:** Enrichment suggestions are stored in-memory only as component state. Lost on session restart. User can manually regenerate any note's enrichment via the "Regenerate tags/summary" toolbar button.
- **D-06:** If autoTag, autoCategorize, and autoSummary toggles are all off, NoteTagger skips the LLM call entirely. If some are on but MEM-02 memory extraction is off, the LLM call runs but generated memoryFacts are discarded.
- **D-07:** NoteTagger fires non-blocking after IndexedDB save. It includes `note.version` in metadata sent with the request. When the LLM response returns, if the note version was incremented, stale suggestions are silently discarded.
- **D-08:** A shared `src/core/ai/LlmService.ts` provides structured LLM calls for NoteTagger, NoteQA, NoteChatConverter, and future non-orchestration LLM consumers. It handles provider resolution via TierResolver (haiku/flash), temperature-0 structured output, and Zod schema validation. AgentOrchestrator remains the path for chat/agent tool-calling flows.
- **D-09:** `FileSystemDirectoryHandle` is persisted in a new `backup_config` object store in the existing NowPilot IndexedDB via MigrationRunner v5. This store holds exactly one record: `{ id: 'backup_folder', handle: FileSystemDirectoryHandle }`. Handle survives extension restarts natively via IndexedDB's structured clone.
- **D-10:** Permission is checked via `handle.queryPermission({ mode: 'readwrite' })` on every sync attempt. If denied, sync is disabled (red "Backup: Error" Tag). On next NotesPage mount, if still denied, show "Re-select folder" prompt. If re-granted, sync resumes automatically.
- **D-11:** A `lastSyncedAt?: number` field is added to NoteSchema. NoteFileSync writes this timestamp after each successful file write. On next save, compare `note.lastSyncedAt` vs `file.lastModified` with 2s tolerance — if file is newer, confirm "Overwrite?" defaulting to Skip.
- **D-12:** On note rename, NoteFileSync tracks old file path and deletes orphan `.md`. On explicit note deletion, the `.md` is deleted and empty category folders are removed. File format: `{categoryPath}/{sanitizedTitle}.md` with YAML frontmatter and markdown body. Title collision resolved via numeric suffixing.
- **D-13:** NoteQA sends numbered snippets `[1]`, `[2]`, etc. to the LLM with noteId metadata in the prompt preamble. The LLM responds with inline `[1]`, `[2]` reference markers. NoteQA post-processes to build citations: `[{ noteId, title, relevantSnippet, referenceNumber }]`. Matches NoteQAResultSchema from Appendix C.
- **D-14:** NoteQA assembles its own prompt directly — system prompt + numbered snippets + memory facts + user question. No ContextOptimizer. Token budget is small (top-5 snippets + memory).
- **D-15:** NoteQA has two modes: `search` (haiku rerank of top-10) and `ask` (flash-tier synthesis with citations). Both share the same entry point with a `mode` parameter.
- **D-16:** In tiny model tier, NoteQA returns MiniSearch top-5 snippets + MemoryEngine relevant facts as raw results with noteId links. No LLM call.
- **D-17:** NoteTagger and NoteFileSync subscribe to `note:saved` independently on the EventBus. They run in parallel — no ordering dependency. NoteTagger fires the non-blocking LLM call. NoteFileSync debounces 50ms then writes the `.md`.
- **D-18:** When user accepts enrichment suggestions, the updated note triggers another `note:saved` → NoteFileSync re-writes the `.md` with the enriched frontmatter.
- **D-19:** Primary surface check for MEM-02 happens only at MemoryEngine.write() time, not at NoteTagger call time. NoteTagger fires the LLM call on both surfaces. Secondary surface memory writes fail gracefully.
- **D-20:** NoteChatConverter drafts a pre-filled note via LlmService. After user edits and saves, the note goes through the full save pipeline: NoteTagger + NoteFileSync + MEM-02 suggestions. Provenance set to `chat-conversion`.
- **D-21:** NoteMaintenance is a passive query service providing `getStaleNotes()` and `getOrphanNotes()`. Also exposes `reanalyzeAll()`. UI-driven — no background monitoring or EventBus subscriptions.

### the agent's Discretion

- LlamService implementation details: provider selection via TierResolver, temperature-0 enforcement, Zod response validation, error handling for malformed JSON (one-shot repair), abort signal propagation.
- NoteTagger LLM prompt template (system prompt + note content formatting + structured output instructions) — planner designs within the single-call JSON contract (D-01).
- NoteQA LLM prompt template (citation instructions, snippet formatting, system prompt for synthesis) — planner designs within the numbered-reference citation contract (D-13).
- NoteChatConverter LLM prompt template (draft title/content/tags/wikilinks/categoryPath) — planner designs within the haiku-tier structured output contract.
- NoteFileSync file format details: YAML frontmatter field ordering, filename sanitization character mapping, collision suffixing algorithm.
- NoteMaintenance staleness comparison logic and orphan detection query implementation.
- EventBus handler registration and error boundary for NoteTagger/NoteFileSync subscriptions.

### Deferred Ideas (OUT OF SCOPE)

- Embedding-based semantic search for notes
- LLM wikilink autocomplete
- Bidirectional filesystem sync
- Background staleness monitoring
- Persistent enrichment suggestions
- AI-suggested note creation from chat (unprompted)
- Image/file attachments in notes
- Restore incremental/delta updates
- Multi-folder backup
- Knowledge-edge provenance (KNW-01): Phase 5b
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTE-02 | User can enrich notes via LLM-Wiki (auto-tag/category/summary in one call), ask notes via RAG with citations, and convert chat/page to notes | NoteTagger (haiku structured-output via LlmService), NoteQA (MiniSearch + MemoryEngine → flash synthesis with numbered citations), NoteChatConverter (haiku draft via LlmService) |
| NOTE-03 | User can sync notes one-way to filesystem (.md with YAML frontmatter) and restore from folder with additive upsert | NoteFileSync (FileSystemDirectoryHandle persisted in v5 IndexedDB, YAML frontmatter via `yaml` npm package, collision suffixing, external-change detection), restore via `showDirectoryPicker()` + additive upsert |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yaml` | 2.9.0 | YAML frontmatter generation/parsing for `.md` backup files | De facto standard YAML library for JS/TS (184M weekly downloads); zero dependencies; runs in browsers; handles YAML 1.1 and 1.2 [VERIFIED: npm registry] |
| `@types/wicg-file-system-access` | 2023.10.7 | TypeScript types for `FileSystemDirectoryHandle`, `FileSystemFileHandle`, `showDirectoryPicker()` | Canonical DefinitelyTyped package for the File System Access API spec [VERIFIED: npm registry] |
| `zod` (existing) | — | Schema validation for NoteTaggerResult, NoteQAResult, NoteDraft | Already in project; used by NoteSchema, ContextItemSchema, MemoryRecord; consistent pattern across the codebase |
| `idb` (existing) | — | IndexedDB access for `backup_config` store (MigrationRunner v5) | Already in project; used by NotesDB, MigrationRunner, MiniSearchNoteIndex |
| `ai` + `@ai-sdk/*` (existing) | — | `generateText` for structured LLM calls via LlmService | Already in project; used by PlannerService, StructuredOutput, ProviderAdapter |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `minisearch` (existing) | — | BM25 retrieval for NoteQA snippet search | Already in project as `noteSearchIndex` singleton; NoteQA consumes `.search()` for top-N snippet retrieval |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `yaml` (eemeli) | `js-yaml` (nodeca) | `yaml` has native browser support, more active maintenance, better TypeScript types, and is already the spec-recommended package. `js-yaml` is heavier and more Node-focused. |
| File System Access API | Native Messaging + Node.js fs | Native Messaging requires a separate host executable and is not available in MV3 extensions; File System Access API is the browser-native approach and requires no additional permissions in the manifest. |
| IndexedDB handle persistence | chrome.storage.local | `chrome.storage.local` cannot store `FileSystemDirectoryHandle` (not JSON-serializable); IndexedDB's structured clone algorithm is the only way to persist handles across extension restarts. |

**Installation:**
```bash
npm install yaml@^2 @types/wicg-file-system-access@2023.10
```

**Version verification:**
```bash
npm view yaml version             # 2.9.0 — verified 2026-08-02
npm view @types/wicg-file-system-access version  # 2023.10.7 — verified 2026-08-02
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `yaml` | npm | ~10 yrs | 184M/wk | github.com/eemeli/yaml | OK | Approved |
| `@types/wicg-file-system-access` | npm | ~4 yrs | 745K/wk | github.com/DefinitelyTyped | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Phase 5a Services                            │
│                                                                      │
│  NotesDB.save()                                                      │
│       │                                                              │
│       ▼                                                              │
│  EventBus.emit('note:saved', { noteId })                             │
│       │                                                              │
│       ├──────────────────────────┬──────────────────────────┐        │
│       ▼                          ▼                          │        │
│  ┌──────────────┐          ┌──────────────┐                │        │
│  │ NoteTagger   │          │ NoteFileSync │                │        │
│  │ (non-blocking│          │ (50ms debounce│               │        │
│  │  LLM call)   │          │  fire+forget) │               │        │
│  └──────┬───────┘          └──────┬───────┘                │        │
│         │                         │                         │        │
│         ▼                         ▼                         │        │
│  ┌──────────────┐          ┌──────────────┐                │        │
│  │  LlmService  │          │ yaml package  │               │        │
│  │  (haiku,zod) │          │ (frontmatter) │               │        │
│  └──────┬───────┘          └──────┬───────┘                │        │
│         │                         │                         │        │
│         ▼                         ▼                         │        │
│  ┌──────────────┐          ┌──────────────┐                │        │
│  │User accepts? │          │FileSystem API│                │        │
│  │ ├─enrich→save │          │ handle.write  │              │        │
│  │ └─mem→MEMengine│         │ categoryPath/ │              │        │
│  └──────────────┘          │ title.md      │               │        │
│                             └──────────────┘                │        │
│                                                              │        │
│  ┌──────────────────────────────────────────────────────┐    │        │
│  │                    NoteQA (RAG)                      │    │        │
│  │  User question → MiniSearch.search(5) + MemoryEngine │    │        │
│  │   → Assembly [1]..[N] numbered snippets              │    │        │
│  │   → LlmService(flash) synthesis with [1][2] markers │    │        │
│  │   → Parse markers → citations[]                     │    │        │
│  └──────────────────────────────────────────────────────┘    │        │
│                                                              │        │
│  ┌──────────────────────────────────────────────────────┐    │        │
│  │              NoteChatConverter                        │    │        │
│  │  Chat messages + MemoryEngine.assemble()             │    │        │
│  │   → LlmService(haiku) → NoteDraft                    │    │        │
│  │   → Pre-filled NoteEditor (user gatekeeper)          │    │        │
│  └──────────────────────────────────────────────────────┘    │        │
│                                                              │        │
│  ┌──────────────────────────────────────────────────────┐    │        │
│  │              NoteMaintenance (passive)                │    │        │
│  │  getStaleNotes(): summaryGeneratedAt < updatedAt     │    │        │
│  │  getOrphanNotes(): 0 wikilinks + 0 backlinks         │    │        │
│  │  reanalyzeAll(): sequential NoteTagger on all notes   │    │        │
│  └──────────────────────────────────────────────────────┘    │        │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/core/
├── ai/
│   ├── LlmService.ts              # NEW — shared structured LLM facade
│   ├── StructuredOutput.ts        # EXISTING — generateWithRepair pattern
│   ├── TierResolver.ts            # EXISTING — haiku/flash selection
│   └── ProviderAdapter.ts         # EXISTING — provider interface
├── notes/
│   ├── NoteTagger.ts              # NEW — enrichment + memory extraction
│   ├── NoteQA.ts                  # NEW — RAG Q&A with citations
│   ├── NoteChatConverter.ts       # NEW — chat/page → note draft
│   ├── NoteFileSync.ts            # NEW — one-way .md backup
│   ├── NoteMaintenance.ts         # NEW — staleness/orphan queries
│   ├── NotesDB.ts                 # EXISTING — CRUD (add lastSyncedAt query)
│   ├── NoteSchema.ts              # EXISTING — extend: lastSyncedAt?, summaryGeneratedAt?, tagsGeneratedAt?
│   ├── MiniSearchNoteIndex.ts     # EXISTING — NoteQA consumes .search()
│   ├── NoteGraph.ts               # EXISTING — NoteMaintenance uses for orphan detection
│   ├── LinkParser.ts              # EXISTING
│   └── types.ts                   # EXISTING — extend with new result types
├── memory/
│   └── MemoryEngine.ts            # EXISTING — NoteQA .retrieve(), NoteTagger .write()
├── storage/
│   └── MigrationRunner.ts         # EXISTING — add v5: backup_config store
└── events/
    └── EventBus.ts                # EXISTING — note:saved subscription
tests/core/
├── ai/
│   └── LlmService.test.ts         # NEW
├── notes/
│   ├── NoteTagger.test.ts         # NEW
│   ├── NoteQA.test.ts             # NEW
│   ├── NoteChatConverter.test.ts  # NEW
│   ├── NoteFileSync.test.ts       # NEW
│   └── NoteMaintenance.test.ts    # NEW
```

### Pattern 1: Module-Level Singleton (Existing Pattern)

**What:** Each service class exports a module-level singleton (or factory function) following `ContextOptimizer`/`MemoryEngine`/`MiniSearchNoteIndex` pattern. Tests call `reset*()` for isolation.

**When to use:** For all five new note services and LlmService — these are long-lived, single-instance services.

**Example:**
```typescript
// src/core/notes/NoteTagger.ts
// Source: Codebase pattern — MemoryEngine.ts, MiniSearchNoteIndex.ts
export class NoteTagger {
  // ...
  async analyze(noteId: string): Promise<NoteTaggerResult> { /* ... */ }
}

let _instance: NoteTagger | null = null;
export function getNoteTagger(): NoteTagger {
  if (!_instance) _instance = new NoteTagger();
  return _instance;
}
export function resetNoteTagger(): void { _instance = null; }
```

### Pattern 2: EventBus Subscription (Existing Pattern)

**What:** Services subscribe to EventBus events, return unsubscribe functions. Handler errors are swallowed by the EventBus. NoteTagger and NoteFileSync subscribe to `note:saved`.

**When to use:** For NoteTagger and NoteFileSync handlers — they react to `note:saved` independently.

**Example:**
```typescript
// Source: Codebase pattern — EventBus.ts
import { on } from '../events/EventBus';

let unsub: (() => void) | null = null;

export function initNoteFileSync(): void {
  if (unsub) return;
  unsub = on<{ noteId: string }>('note:saved', async ({ noteId }) => {
    // debounced fire-and-forget sync
  });
}
```

### Pattern 3: Structured LLM Generation via LlmService (New Pattern)

**What:** LlmService wraps `generateWithRepair` (from `StructuredOutput.ts`) with provider resolution via `TierResolver`. Each consumer calls `llmService.generate({ tier, systemPrompt, userPrompt, schema, abortSignal })`.

**When to use:** For all NoteTagger, NoteQA, and NoteChatConverter LLM calls. Not for AgentOrchestrator (which has its own LLM flow).

**Example:**
```typescript
// src/core/ai/LlmService.ts
// Source: Codebase pattern — StructuredOutput.ts generateWithRepair
import { generateWithRepair } from './StructuredOutput';
import type { ProviderAdapter, ModelTier } from './types';
import type { z } from 'zod';

export class LlmService {
  async generate<T>(params: {
    adapter: ProviderAdapter;
    tier: ModelTier;
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodSchema<T>;
    abortSignal?: AbortSignal;
  }): Promise<T> {
    const prompt = [params.systemPrompt, params.userPrompt].join('\n\n');
    return generateWithRepair(params.adapter, params.tier, prompt, params.schema, params.abortSignal);
  }
}
```

### Pattern 4: YAML Frontmatter File Format (New Pattern)

**What:** `.md` files use YAML frontmatter between `---` delimiters followed by markdown body. Generated via `yaml` package.

**When to use:** For NoteFileSync write and restore operations.

**Example:**
```typescript
// Source: yaml package docs (eemeli.org/yaml)
import { stringify, parse } from 'yaml';

// Write: construct frontmatter object, stringify to YAML, wrap in ---
function buildNoteFile(note: Note): string {
  const frontmatter = {
    id: note.id,
    title: note.title,
    created: note.createdAt,
    updated: note.updatedAt,
    tags: note.tags,
    categoryPath: note.categoryPath || null,
    summary: note.summary || null,
  };
  const yamlStr = stringify(frontmatter, { lineWidth: 0 });
  return `---\n${yamlStr}---\n\n${note.content}`;
}

// Read: extract frontmatter between --- delimiters, parse YAML
function parseNoteFile(fileContent: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = fileContent.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) throw new Error('Invalid frontmatter format');
  const frontmatter = parse(match[1]);
  return { frontmatter, body: match[2] };
}
```

### Pattern 5: File System Directory Handle Persistence (New Pattern)

**What:** `FileSystemDirectoryHandle` is stored in IndexedDB via `idb`. Permission checked on every use. Handle survives extension restarts via structured clone.

**When to use:** For NoteFileSync backup folder management.

**Example:**
```typescript
// Source: Chrome File System Access API docs (developer.chrome.com)
// Persist handle in IndexedDB via idb (MigrationRunner v5 creates the 'backup_config' store)
async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB('NotesDB', 5);
  await db.put('backup_config', { id: 'backup_folder', handle });
}

async function getPersistedHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB('NotesDB', 5);
  const record = await db.get('backup_config', 'backup_folder');
  return record?.handle ?? null;
}

// Permission check before every sync (D-10)
async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const result = await handle.queryPermission({ mode: 'readwrite' });
  if (result === 'granted') return true;
  const granted = await handle.requestPermission({ mode: 'readwrite' });
  return granted === 'granted';
}
```

### Anti-Patterns to Avoid

- **Direct LLM calls in NoteTagger/NoteQA/NoteChatConverter:** Always route through LlmService — ensures consistent provider resolution, temperature-0 enforcement, and Zod validation.
- **Sequential file writes in NoteFileSync:** Use parallel `.md` writes for all notes on a bulk sync — but per-note save uses the 50ms debounce to prevent burst writes.
- **Blocking the save UI on LLM response:** NoteTagger.analyze() must be non-blocking. Fire the LLM call after the IndexedDB write completes. Suggestions arrive asynchronously and never block the save confirmation.
- **Storing memory facts with LLM self-reported confidence:** D-03 mandates all accepted memoryFacts use `confidence: 0.5` (`inferred`). LLM's self-reported score is display-only.
- **Running NoteFileSync without permission check:** Always call `handle.queryPermission()` before any write. Skipping this check leads to `NotAllowedError` on the filesystem operation.
- **Duplicating generateWithRepair logic:** LlmService reuses `StructuredOutput.generateWithRepair` — don't re-implement JSON repair in each service.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML generation/parsing | Custom YAML serializer | `yaml` npm package | Handles quoting, escaping, block/fold styles, multi-line strings, edge cases like null/undefined. Your custom serializer will have bugs at scale. |
| File system directory enumeration | Custom recursive directory walker | `FileSystemDirectoryHandle.values()` + async iteration | Browser-native API handles cross-platform paths, permissions, and async iteration natively. |
| IndexedDB object store management | Raw `indexedDB` calls | `idb` package (already in project) | `idb` provides promise-based API, version upgrade callbacks, and type safety; already used by NotesDB/MigrationRunner. |
| JSON repair from LLM responses | Per-service cleanup logic | `StructuredOutput.repairJSON()` (existing) | Single repair pipeline: strip fences, find JSON boundaries, fix trailing commas, balance brackets, Zod validate. Already proven in PlannerService. |
| Filename sanitization | Custom char-by-char mapping | Centralized utility in NoteFileSync | `/[\\/:*?"<>|]/g → '_'` is the spec (SYNC-04). One canonical function prevents drift between test string and actual implementation. |
| Collision suffixing | Per-service increment logic | Shared helper in NoteFileSync | "Same title + same category → numeric suffix" (SYNC-05). Single implementation used by both write and rename paths. |
| External-change detection | Custom file stat comparison | `file.lastModified` from `handle.getFile()` | Browser File API returns `lastModified` as milliseconds; comparison with `lastSyncedAt` with 2s tolerance (SYNC-06) is a simple numeric diff. |
| Debounce implementation | Custom debounce | Simple setTimeout-based pattern | Vanilla `setTimeout(fn, 50)` with `clearTimeout` is sufficient for the 50ms sync debounce (SYNC-03). No external library needed. |

**Key insight:** The File System Access API is the only non-npm dependency — it's a browser API. Everything else is either existing project dependencies (`zod`, `idb`, `minisearch`, `ai`) or the single new addition (`yaml`). This phase adds minimal external weight.

## Runtime State Inventory

> **Skipped:** This phase is greenfield (new services on existing infrastructure). No rename/refactor/migration requires runtime state inventory.

## Common Pitfalls

### Pitfall 1: FileSystemDirectoryHandle Expiry After Extension Restart

**What goes wrong:** `FileSystemDirectoryHandle` stored in IndexedDB may have its permission revoked by the browser (e.g., user clears site data, browser session ends, or handle becomes stale). Calling `createWritable()` on a stale handle throws `NotAllowedError`.

**Why it happens:** File System Access API permissions are not persistent by default in all Chrome configurations. Handles need permission re-verification after each restart.

**How to avoid:** Always call `handle.queryPermission({ mode: 'readwrite' })` before any file operation (D-10). If denied, request via `handle.requestPermission()`. If still denied, enter "Backup: Error" state and prompt user to re-select folder.

**Warning signs:** `NotAllowedError` on `createWritable()` call; `SecurityError` on `getFileHandle()` call; permission state returns `'denied'` or `'prompt'`.

### Pitfall 2: LLM Response Race Condition with Note Edits

**What goes wrong:** User saves a note, NoteTagger fires an async LLM call. By the time the response arrives (1-5 seconds), the user has already edited and saved again. Stale tags/category/summary suggestions overwrite the user's edits.

**Why it happens:** Network latency between LLM call and response creates a window where the note content has changed.

**How to avoid:** D-07: Include `note.version` in NoteTagger metadata. On response return, compare `note.version` from the original save with the current DB version. If versions differ, silently discard stale suggestions. No UX noise.

**Warning signs:** Tags appearing for wrong note version; summary not matching current content; stale suggestions without any staleness indication.

### Pitfall 3: Malformed JSON from Haiku-Tier Models

**What goes wrong:** Haiku-tier models (esp. Ollama, Gemini Flash) may produce JSON with trailing commas, markdown fences, or missing closing braces — the structured output from a temperature-0 call is not guaranteed to be perfectly valid JSON.

**Why it happens:** Smaller models have higher JSON formatting error rates, especially with complex nested schemas.

**How to avoid:** Reuse `StructuredOutput.repairJSON()` — it already handles fence removal, trailing comma cleanup, brace balancing, and Zod validation. LlmService wraps this. If repair fails, throw `PipelineError` with diagnostic context.

**Warning signs:** `'SCHEMA_INVALID'` errors in NoteTagger; empty/malformed tag suggestions; summary field containing JSON artifacts.

### Pitfall 4: YAML Frontmatter Breaking on Special Characters

**What goes wrong:** Note content or metadata containing characters like `:`, `#`, `[`, `{`, or leading `-` can produce malformed YAML when stringified.

**Why it happens:** YAML is whitespace-sensitive and certain characters have syntactic meaning. A note title like `"Meeting: Q3 Review #5"` or tags like `["[wip]", "-topic"]` need proper quoting.

**How to avoid:** The `yaml` library handles quoting automatically. Use `stringify(frontmatter, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE' })` for consistency. Test with edge-case titles containing colons, hashes, brackets, and multi-line content.

**Warning signs:** YAML parse errors on restore; frontmatter that doesn't render correctly in editors like Obsidian; `yaml.parse()` throwing on filesystem-restored content.

### Pitfall 5: IndexedDB Transaction Conflicts on Version Migration

**What goes wrong:** Adding v5 migration to MigrationRunner while Phase 5 v4 migrations are still running in other tabs can cause `VersionError` or blocked upgrades.

**Why it happens:** IndexedDB version upgrades acquire an exclusive lock. If another tab has the database open at a lower version, the upgrade dialogs `blocked` handler fires.

**How to avoid:** Follow the existing MigrationRunner pattern: v5 migration adds `backup_config` store only if `oldVersion < 5`. The `blocked` callback already exists. Test with `resetMigrationDb('NotesDB')` between tests.

**Warning signs:** `VersionError: The requested version (5) is higher than the existing version (4)`; stuck upgrade dialog; `onblocked` firing in production.

## Code Examples

Verified patterns from official sources and existing codebase:

### LlmService Usage (Structured LLM Call)

```typescript
// Source: Codebase — StructuredOutput.ts generateWithRepair pattern
// Adapted for: NoteTagger, NoteQA, NoteChatConverter
import { LlmService, getLlmService } from '../ai/LlmService';
import { resolveTierModel } from '../ai/TierResolver';
import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
import { z } from 'zod';

const NoteTaggerResultSchema = z.object({
  enrichment: z.object({
    tags: z.array(z.string()).max(5),
    categoryPath: z.string().nullable(),
    summary: z.string(),
    suggestedConcepts: z.array(z.object({
      slug: z.string(),
      label: z.string(),
      summary: z.string(),
    })).default([]),
  }),
  memoryFacts: z.array(z.object({
    type: z.enum(['semantic']),
    content: z.string(),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
  })).max(5),
});
type NoteTaggerResult = z.infer<typeof NoteTaggerResultSchema>;

class NoteTagger {
  async analyze(adapter: ProviderAdapter, noteContent: string, noteVersion: number, abortSignal?: AbortSignal): Promise<NoteTaggerResult> {
    const llm = getLlmService();
    return llm.generate({
      adapter,
      tier: 'FAST', // haiku tier
      systemPrompt: PROMPTS.noteTagger.system,
      userPrompt: `Note content:\n${noteContent}`,
      schema: NoteTaggerResultSchema,
      abortSignal,
    });
  }
}
```

### File System Access API Permission Verification

```typescript
// Source: Chrome File System Access API docs (developer.chrome.com/docs/capabilities/web-apis/file-system-access)
// Adapted for: NoteFileSync permission check (D-10)
async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  readWrite: boolean = true,
): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  // Check current permission state first
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  // Request permission if not granted — this requires a user gesture
  if ((await handle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}
```

### Filename Sanitization for File System

```typescript
// Source: PRODUCT_SPEC v0.1 §27.3 SYNC-04
// Pattern for: NoteFileSync filename generation
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const REPLACEMENT_CHAR = '_';

function sanitizeFilename(title: string): string {
  return title.replace(INVALID_FILENAME_CHARS, REPLACEMENT_CHAR).trim() || 'untitled';
}

function buildFilePath(categoryPath: string, title: string): string {
  const sanitized = sanitizeFilename(title);
  return categoryPath ? `${categoryPath}/${sanitized}.md` : `${sanitized}.md`;
}
```

### YAML Frontmatter Generation

```typescript
// Source: yaml package docs (eemeli.org/yaml) + PRODUCT_SPEC §27.3 SYNC-04
// Pattern for: NoteFileSync file content generation
import { stringify, parse } from 'yaml';
import type { Note } from './NoteSchema';

interface Frontmatter {
  id: string;
  title: string;
  created: number;
  updated: number;
  tags: string[];
  categoryPath: string | null;
  summary: string | null;
}

function toFrontmatter(note: Note, summary?: string): Frontmatter {
  return {
    id: note.id,
    title: note.title,
    created: note.createdAt,
    updated: note.updatedAt,
    tags: note.tags,
    categoryPath: note.categoryPath || null,
    summary: summary || null,
  };
}

function generateNoteFile(note: Note, summary?: string): string {
  const fm = toFrontmatter(note, summary);
  const yamlBody = stringify(fm, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE' });
  return `---\n${yamlBody}---\n\n${note.content}`;
}

function parseNoteFile(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) throw new Error('No YAML frontmatter found');
  const fm = parse(match[1]) as Frontmatter;
  return { frontmatter: fm, body: match[2] };
}
```

### Citation Post-Processing (NoteQA)

```typescript
// Source: PRODUCT_SPEC Appendix C NoteQAResultSchema + CONTEXT.md D-13
// Pattern for: NoteQA citation parsing
import { z } from 'zod';

const NoteQAResultSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({
    noteId: z.string(),
    title: z.string(),
    relevantSnippet: z.string(),
    referenceNumber: z.number().int().positive(),
  })),
});
type NoteQAResult = z.infer<typeof NoteQAResultSchema>;

// D-13: LLM sees [1], [2] markers; NoteQA maps to citation objects
function parseCitations(rawText: string, snippets: Array<{ noteId: string; title: string; snippet: string }>): Array<{
  noteId: string;
  title: string;
  relevantSnippet: string;
  referenceNumber: number;
}> {
  const citations: Array<{ noteId: string; title: string; relevantSnippet: string; referenceNumber: number }> = [];
  const usedRefs = new Set<number>();

  for (const match of rawText.matchAll(/\[(\d+)\]/g)) {
    const refNum = parseInt(match[1], 10);
    if (usedRefs.has(refNum) || refNum < 1 || refNum > snippets.length) continue;
    usedRefs.add(refNum);
    citations.push({
      noteId: snippets[refNum - 1].noteId,
      title: snippets[refNum - 1].title,
      relevantSnippet: snippets[refNum - 1].snippet,
      referenceNumber: refNum,
    });
  }
  return citations;
}
```

### MigrationRunner v5 Template

```typescript
// Source: Codebase — MigrationRunner.ts migrateV4 pattern
// Pattern for: MigrationRunner v5 — adding backup_config store
private async migrateV5(transaction: VersionChangeTransaction): Promise<void> {
  const db = transaction.db;

  // Add backup_config store for FileSystemDirectoryHandle (D-09)
  if (!db.objectStoreNames.contains('backup_config')) {
    db.createObjectStore('backup_config', { keyPath: 'id' });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate LLM calls for tags, category, summary | Single haiku call with structured JSON response (D-01) | v0.1 design | One call is ~3x cheaper and faster; JSON partitioning keeps consumers independent |
| No LLM-Wiki enrichment | NoteTagger auto-suggestions (accept/reject UI) | Phase 5a (new) | User remains gatekeeper; LLM accelerates curation |
| Plain search/vector search | MiniSearch BM25 + LLM rerank (haiku) or synthesis (flash) | Phase 5a (new) | No embedding infrastructure needed; hybrid approach balances cost and quality |
| No filesystem backup | One-way .md YAML frontmatter sync | Phase 5a (new) | Portability + Obsidian compatibility; IndexedDB is primary store |

**Deprecated/outdated:**
- **Multi-call enrichment pattern:** The spec explicitly avoids separate LLM calls for tags, category, and summary. One call with structured JSON is the contract (D-01).
- **Embedding-based vector search for notes:** Deferred to v0.2+. MiniSearch BM25 + LLM hybrid (LLM-WIKI-05/06) is the v0.1 approach.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `yaml` package v2.9.0 stringify/parse works correctly in browser MV3 extension environments (no Node.js APIs) | Standard Stack | Low — `yaml` is designed for browser use and has no Node.js dependencies. Fallback: `js-yaml` also works in browsers. |
| A2 | File System Access API (`showDirectoryPicker`, `queryPermission`, `FileSystemDirectoryHandle`) is available in Chromium 86+ (the target MV3 runtime) | Architecture Patterns | Low — Chrome MV3 extensions run on Chromium 86+ where FSA API is available. Confirmed by Chrome Developer docs. |
| A3 | `idb` package's `openDB` with structured clone can persist `FileSystemDirectoryHandle` across extension restarts | Architecture Patterns | Low — Chrome explicitly documents handle persistence via IndexedDB in the File System Access API guide. |
| A4 | NoteTaggerResult Schema from PRODUCT_SPEC Appendix C (`NoteTagResultSchema`) is the authoritative schema shape — adapted with `enrichment`/`memoryFacts` partitions per D-01 | Code Examples | Low — CONTEXT.md D-01 provides the partition structure and references the Appendix C schema as the base contract. |

## Open Questions (RESOLVED)

1. **ProviderAdapter acquisition for LlmService**
   - What we know: LlmService needs a `ProviderAdapter` to create language models. TierResolver resolves model by tier. AgentOrchestrator already has a provider-selection flow.
   - What's unclear: How does LlmService get its `ProviderAdapter` instance? Via constructor injection? Factory function? Global provider-registry lookup?
   - Recommendation: Follow the `MemoryEngine` pattern — accept `adapter` as a parameter in each method call, with the caller (Phase 7 UI layer) providing the adapter based on user configuration. This keeps LlmService stateless and testable.

2. **NoteTagger abort signal propagation**
   - What we know: D-07 says NoteTagger fires non-blocking after IndexedDB save. Suggestions are in-memory only (D-05) and lost on restart. No persistence needed.
   - What's unclear: Should NoteTagger support abort (e.g., user navigates away before response)? What happens to in-flight requests on extension close?
   - Recommendation: Pass `AbortSignal` through LlmService to `generateText`. On abort, silently discard — no error UX. This matches the "silently discard stale" pattern from D-07.

3. **NoteFileSync tests requiring File System Access API**
   - What we know: File System Access API requires user gesture. Browser APIs aren't available in vitest/jsdom.
   - What's unclear: Can we mock `showDirectoryPicker`, `queryPermission`, `createWritable` for unit tests, or should NoteFileSync tests be integration-only?
   - Recommendation: Mock the File System Access API interfaces in vitest — `FileSystemDirectoryHandle`, `FileSystemFileHandle`, `FileSystemWritableFileStream`. Test the sync logic (filename sanitization, collision suffixing, frontmatter generation) as pure functions. Manual integration testing for actual filesystem writes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test toolchain | ✓ | 26.5.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| Chrome/Chromium (MV3) | Runtime target, File System Access API | ✓ (runtime) | Any 86+ | — |
| `yaml` package | NoteFileSync frontmatter generation | ✗ (needs install) | 2.9.0 | — |
| `@types/wicg-file-system-access` | TypeScript types for FSA API | ✗ (needs install) | 2023.10.7 | — |

**Missing dependencies with no fallback:**
- `yaml` (2.9.0) — required for NoteFileSync YAML frontmatter generation and restore parsing; must be installed via `npm install yaml@^2`

**Missing dependencies with fallback:**
- `@types/wicg-file-system-access` — dev-only type definitions; types can be declared inline if the package is unavailable, but installing it is preferred

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/core/notes/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTE-02 | NoteTagger returns enrichment (tags ≤5, categoryPath, summary, concepts) from haiku LLM call | unit | `vitest run tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| NOTE-02 | NoteTagger returns memoryFacts (≤5, filtered at confidence ≥0.3) with display-only LLM confidence | unit | `vitest run tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| NOTE-02 | NoteTagger discards stale suggestions when note.version differs — stale-overwrite test | unit | `vitest run tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| NOTE-02 | NoteTagger skips LLM call when all enrichment toggles are off (D-06) | unit | `vitest run tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| NOTE-02 | NoteQA returns cited answer with clickable citations from MiniSearch top-5 + MemoryEngine | unit | `vitest run tests/core/notes/NoteQA.test.ts` | ❌ Wave 0 |
| NOTE-02 | NoteQA returns raw results in tiny model tier (no LLM call, D-16) | unit | `vitest run tests/core/notes/NoteQA.test.ts` | ❌ Wave 0 |
| NOTE-02 | NoteQA `search` mode reranks top-10; `ask` mode synthesizes with citations | unit | `vitest run tests/core/notes/NoteQA.test.ts` | ❌ Wave 0 |
| NOTE-02 | NoteChatConverter generates pre-filled NoteDraft (title, content, tags, categoryPath, wikilinks) | unit | `vitest run tests/core/notes/NoteChatConverter.test.ts` | ❌ Wave 0 |
| NOTE-02 | LlmService resolves provider via TierResolver and validates response with Zod schema | unit | `vitest run tests/core/ai/LlmService.test.ts` | ❌ Wave 0 |
| NOTE-03 | NoteFileSync writes .md with YAML frontmatter (id, title, created, updated, tags, categoryPath, summary) + markdown body | unit | `vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| NOTE-03 | NoteFileSync sanitizes filenames (`/\\:*?"<>\|` → `_`) and uses numeric suffix for collisions | unit | `vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| NOTE-03 | NoteFileSync checks `queryPermission()` before writes; enters error state on denial (D-10) | unit | `vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| NOTE-03 | NoteFileSync detects external changes (lastModified > lastSyncedAt + 2s) and confirms overwrite (D-11) | unit | `vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| NOTE-03 | Restore: parses .md files from folder, additive upsert (new/updated/unchanged), preview count | unit | `vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| NOTE-02 | NoteMaintenance.getStaleNotes() returns notes where summaryGeneratedAt < updatedAt | unit | `vitest run tests/core/notes/NoteMaintenance.test.ts` | ❌ Wave 0 |
| NOTE-02 | NoteMaintenance.getOrphanNotes() returns notes with 0 wikilinks + 0 backlinks | unit | `vitest run tests/core/notes/NoteMaintenance.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/core/notes/ --no-coverage`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/core/ai/LlmService.test.ts` — LlmService unit tests (Zod validation, provider resolution, abort propagation)
- [ ] `tests/core/notes/NoteTagger.test.ts` — NoteTagger unit tests (enrichment, memoryFacts, staleness, toggles)
- [ ] `tests/core/notes/NoteQA.test.ts` — NoteQA unit tests (RAG synthesis, search mode, tiny mode, citation parsing)
- [ ] `tests/core/notes/NoteChatConverter.test.ts` — NoteChatConverter unit tests (draft generation, provenance)
- [ ] `tests/core/notes/NoteFileSync.test.ts` — NoteFileSync unit tests (frontmatter, sanitization, collision, permission, external-change, restore)
- [ ] `tests/core/notes/NoteMaintenance.test.ts` — NoteMaintenance unit tests (staleness, orphan detection, reanalyzeAll)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Provider API keys managed by Phase 3; no new auth |
| V3 Session Management | no | Existing session (chrome.storage.session) unchanged |
| V4 Access Control | yes (partial) | `FileSystemDirectoryHandle.queryPermission()` gates filesystem access; `MemoryEngine.isPrimarySurface()` gates memory writes (D-19) |
| V5 Input Validation | yes | `NoteSchema` + Zod validation on all LLM responses (NoteTaggerResultSchema, NoteQAResultSchema, NoteDraftSchema); filename sanitization for path traversal defense |
| V6 Cryptography | no | No new cryptographic operations in this phase |

### Known Threat Patterns for TypeScript + File System Access API + LLM

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM prompt injection via note content | Spoofing / Elevation | Note content is wrapped in user prompt with clear boundaries; system prompt (PROMPTS.noteTagger) instructs "Do not invent facts. Do not include secrets."; `generateWithRepair` validates output against Zod schema — malformed output is rejected |
| Path traversal via categoryPath | Tampering | CAT-05: normalize on save (strip leading/trailing slashes, collapse duplicates, trim segments); sanitize filename (drop `/ \ : * ? " < > \|`); reject `..` path segments |
| Stale LLM suggestions overwriting user edits | Tampering | D-07: version-based staleness check — discard suggestions when `note.version` has changed since the LLM call was initiated |
| Secret leakage in `.md` backup | Information Disclosure | PRODUCT_SPEC §27.6: TraceRedactor redaction runs before writing to disk; password field values are never written |
| Orphan file accumulation on disk | Denial of Service | D-12: NoteFileSync deletes orphaned .md on rename; deletes .md + empty parent folders on note deletion (SYNC-11) |
| Uncontrolled memory writes from secondary surfaces | Elevation | D-19: `MemoryEngine.write()` gates at `isPrimarySurface()` — secondary surface writes fail gracefully |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md` — All 21 locked decisions, discretion areas, deferred ideas
- `.planning/PRODUCT_SPEC_v0_1.md` — §27 LLM-Wiki & Filesystem Sync (LLM-WIKI-01…10, SYNC-01…11, MEM-01…03); §27.5 new core services; §27.8 decisions; Appendix A prompt constants; Appendix C NoteTagResultSchema, NoteQAResultSchema, NoteDraftSchema
- `src/core/notes/NotesDB.ts` — save(), get(), update() CRUD pattern; `note:saved` EventBus emission
- `src/core/notes/NoteSchema.ts` — existing Note, NoteProvenance, Concept schemas; extension points
- `src/core/notes/MiniSearchNoteIndex.ts` — `.search()` interface for NoteQA snippet retrieval
- `src/core/notes/NoteGraph.ts` — getBacklinks(), computeEdges() for NoteMaintenance orphan detection
- `src/core/memory/MemoryEngine.ts` — retrieve() for NoteQA, write() for MEM-02, isPrimarySurface() gate
- `src/core/ai/StructuredOutput.ts` — generateWithRepair() + repairJSON() pattern for LlmService
- `src/core/ai/TierResolver.ts` — resolveTierModel() for haiku/flash selection
- `src/core/ai/providers/ProviderAdapter.ts` — ProviderAdapter interface (createLanguageModel, getDefaultModelForTier)
- `src/core/events/EventBus.ts` — on()/emit() subscription pattern
- `src/core/storage/MigrationRunner.ts` — V4 migration pattern for V5
- `src/core/runtime/BroadcastBus.ts` — isPrimarySurface() for D-19 gating
- `tests/setup.ts` — fake-indexeddb, BroadcastChannel mock, chrome.storage mocks
- `vitest.config.ts` — test framework configuration
- [CITED: eemeli.org/yaml] — yaml package v2 API docs (stringify, parse, Document)
- [CITED: developer.chrome.com/docs/capabilities/web-apis/file-system-access] — File System Access API patterns (showDirectoryPicker, queryPermission, handle persistence in IndexedDB, createWritable)

### Secondary (MEDIUM confidence)
- [CITED: npmjs.com/package/yaml] — Package metadata, version, downloads

### Tertiary (LOW confidence)
- None — all claims are verified against existing codebase or cited from official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `yaml` 2.9.0 and `@types/wicg-file-system-access` are verified on npm; existing dependencies (`zod`, `idb`, `minisearch`, `ai`) are confirmed in `package.json`
- Architecture: HIGH — all patterns derived directly from the existing codebase (singleton pattern, EventBus subscription, generateWithRepair, MigrationRunner upgrade)
- Pitfalls: HIGH — identified from existing code patterns, D-07/D-10/D-11 guard clauses, and File System Access API documentation
- File System Access API patterns: HIGH — verified against Chrome Developer documentation (developer.chrome.com), confirmed Chromium 86+ availability
- YAML patterns: HIGH — verified against official `yaml` package documentation (eemeli.org/yaml)

**Research date:** 2026-08-02
**Valid until:** 2026-09-01 (30 days — this is stable infrastructure; only the `yaml` and `@types/wicg-file-system-access` versions may drift)
