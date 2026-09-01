# Phase 9: LLM-Wiki & Filesystem Sync - Research

**Researched:** 2026-09-01
**Domain:** LLM enrichment, RAG Q&A, filesystem sync, Memory-Notes integration
**Confidence:** HIGH

## Summary

Phase 9 extends the Phase 8 atomic-note-with-wikilinks core with five new service modules: **NoteTagger** (single fast-tier LLM call producing tags + category + summary + memory facts), **NoteQA** (RAG "Ask notes" with MiniSearch + memory + balanced-tier synthesis + citations), **NoteChatConverter** (chat/page-to-note draft generation with memory context), **NoteFileSync** (one-way app→filesystem `.md` backup with OKF v0.2 YAML frontmatter and restore), and **NoteMaintenance** (staleness/orphan detection + bulk analysis). It also adds Memory↔Notes integration (NMEM-01…03) and a v4 IndexedDB migration.

The phase's efficiency spine is **D-01: one structured-JLM call** for tags+category+summary+facts — cheaper and faster than multiple calls. The on-disk format is **OKF v0.2-compatible but not OKF-constrained** (D-02a): UUID identity stays authoritative, wikilinks stay body edges, and the frontmatter carries OKF's `type`/`description`/`generated`/`status` families as an additive layer. All five new modules run in UI contexts only (never the background SW), and the filesystem sync is Standalone-only via `showDirectoryPicker()`.

**Primary recommendation:** Implement the five service modules as pure-logic units with caller-supplied dependencies (db handle, provider seam, event bus) so they're testable without mocks beyond fake-indexeddb. The v4 migration folds into the existing `IndexedDBMigrator` framework with a conditional `if (oldVersion < 4)` block.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-115: NoteTagger uses existing AI runtime (ProviderRouter fast tier, temperature-0, single structured-JSON call)
- D-116: Suggestion confidence gating — threshold 0.60, max 3 facts / 5 tags
- D-117: NoteQA = MiniSearch top-5 + memory facts → balanced-tier synthesis + citations
- D-118: NoteChatConverter uses conversation messages + MemoryEngine.assemble() facts
- D-119: showDirectoryPicker() Standalone-only; handle persisted in notes_backup_config IDB store
- D-120: OKF v0.2 YAML frontmatter per SYNC-04 — yaml ^2 library
- D-121: Restore parser tolerates OKF keys, preserves UUID identity + wikilinks
- D-122: NoteMaintenance is user-initiated + passive timestamp comparison — no background jobs
- D-123: NMEM-02: on-save LLM call extracts memory facts → routed through MemoryEngine, primary surface only
- D-124: categoryPath + Note.type declared in Phase 8, populated + serialized in Phase 9
- D-125: v4 migration is idempotent — adds tags/summary to notes index + Note.type population + notes_backup_config store

### the agent's Discretion
- Exact NoteTagger→ProviderRouter invoke path (direct invoke() vs AgentOrchestrator wrapper)
- Whether NoteQA synthesis streams (balanced-tier Bubble) or returns one-shot
- Whether NoteFileSync debounce is a module-level timer or hook-scoped
- Whether NoteMaintenance lives in one file or splits staleness/orphan/bulk
- Whether the OKF `generated`/`status` fields use the exact SYNC-04 casing

### Deferred Ideas (OUT OF SCOPE)
- Memory governance (MEM-01…05, KNW-01) — Phase 10
- Bidirectional filesystem sync — Phase v0.2+
- Embedding/vector search — deferred per §3.2
- LLM wikilink autocomplete — not in v0.1 (D-04)
- Full NotesWorkspace UI — Phase 15.1
- search-notes / create-note tool registration — Phase 18
- Real-time collaborative editing, image/file attachments, auto-create notes from chat — §27.9 out of scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Path-based categoryPath, `/` separator, normalized segments | NoteTagger LLM suggestion + CAT-05 normalize-on-save |
| CAT-02 | NoteList tree view grouped by "Uncategorized" | Phase 15 UI — service layer provides categoryPath |
| CAT-03 | LLM suggests category during auto-tagging | NoteTagger.analyze() returns categoryPath |
| CAT-04 | Backup saves as `{categoryPath}/{title}.md` | NoteFileSync path construction |
| CAT-05 | Normalize on save, flag invalid segments | NoteTagger/NoteFileSync shared normalize function |
| LLM-WIKI-01 | Fast-tier temp-0 call: ≤5 tags + category + summary + memoryFacts | NoteTagger.analyze() single structured JSON call |
| LLM-WIKI-02 | Independent toggles in Options → Notes | `np_notes_llm_features` config (autoTag, autoCategorize, autoSummary, aiSearch) |
| LLM-WIKI-03 | Optional summary field in NoteList | Note.summary populated by NoteTagger |
| LLM-WIKI-04 | "Regenerate tags/summary" toolbar button | NoteTagger.analyze() re-invocation |
| LLM-WIKI-05 | AI-enhanced search rerank over MiniSearch top-10 | NoteQA.rerank() fast-tier call |
| LLM-WIKI-06 | "Ask notes" RAG: MiniSearch top-5 + memory → balanced synthesis + citations | NoteQA.ask() |
| LLM-WIKI-07 | "Save to note" → NoteChatConverter draft → pre-filled NoteEditor | NoteChatConverter.convert() |
| LLM-WIKI-08 | Staleness detection: summaryGeneratedAt/tagsGeneratedAt vs updated | NoteMaintenance.isStale() |
| LLM-WIKI-09 | Orphan detection: 0 wikilinks + 0 backlinks → badge | NoteMaintenance.isOrphan() |
| LLM-WIKI-10 | "Re-analyze all notes" user-initiated, sequential | NoteMaintenance.reanalyzeAll() |
| LLM-WIKI-11 | Suggestion confidence gating (threshold 0.60, max 3 facts / 5 tags) | gateSuggestions() pure function |
| SYNC-01 | showDirectoryPicker() Standalone-only; handle in notes_backup_config IDB | NoteFileSync.init() |
| SYNC-02 | NotesPage mount verifies handle.queryPermission() | NoteFileSync.checkPermission() |
| SYNC-03 | Per-save .md write/update/delete, 50ms debounce, fire-and-forget | NoteFileSync.syncNote() |
| SYNC-04 | OKF v0.2 YAML frontmatter with nested folders, sanitized filenames | NoteFileSync.serializeNote() |
| SYNC-05 | Title collision → numeric suffix | NoteFileSync.resolveCollision() |
| SYNC-06 | External-change detection (2s tolerance) → confirm overwrite | NoteFileSync.detectExternalChange() |
| SYNC-07 | No backup folder → no-ops + "Backup: off" indicator | NoteFileSync state machine |
| SYNC-08 | Status Tag: green On / gray Off / red Error | NoteFileSync state → UI |
| SYNC-09 | Restore: walk tree → parse frontmatter → upsert (additive) | NoteFileSync.restoreFromFolder() |
| SYNC-10 | Restore preview modal with counts | NoteFileSync.previewRestore() |
| SYNC-11 | Delete-on-sync + empty folder cleanup | NoteFileSync.deleteNote() |
| NMEM-01 | Memory-aware RAG: retrieveMemoryHints() in "Ask notes" | NoteQA includes memory facts |
| NMEM-02 | On-save LLM extracts memoryFacts → MemoryEngine, primary surface only | NoteTagger → MemoryEngine.upsertFact() |
| NMEM-03 | "Save from chat" uses MemoryEngine.assemble() for richer drafts | NoteChatConverter uses assemble() |
| WIKI-ID-01 | crypto.randomUUID() immutable identity | Preserved in OKF frontmatter `id` field |
| WIKI-ID-02 | [[Title]] → resolveLinks() → links[] (IDs) | Unchanged from Phase 8 |
| WIKI-ID-03 | Unresolved links recorded in unresolvedLinks[] | Unchanged from Phase 8 |
| WIKI-ID-04 | Deletion demotes edges; restore preserves via YAML frontmatter | NoteFileSync round-trip preserves IDs |
| OKF-WIKI-01 | Emit OKF-required type (default Note) + description | NoteFileSync.serializeNote() |
| OKF-WIKI-02 | Emit OKF generated {by, at} + status (draft|stable) | NoteFileSync.serializeNote() |
| OKF-WIKI-03 | UUID id as OKF extension key; round-trip preserves edges | NoteFileSync restore parser |
| OKF-WIKI-04 | v0.1 boundary: NO OKF markdown-link edges, NO path-as-identity | Verified by test assertion |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LLM tag/category/summary extraction | API/Backend | — | NoteTagger orchestrates ProviderRouter, pure logic |
| RAG Q&A synthesis | API/Backend | — | NoteQA combines MiniSearch + memory + LLM |
| Chat-to-note conversion | API/Backend | — | NoteChatConverter drafts from conversation context |
| Filesystem backup/restore | API/Backend | — | NoteFileSync manages FileSystemDirectoryHandle I/O |
| Memory fact extraction + routing | API/Backend | — | NMEM-02 routes through MemoryEngine |
| Staleness/orphan detection | API/Backend | — | NoteMaintenance pure algorithmic logic |
| UI rendering (accept/reject, status tags) | Browser/Client | — | Phase 15 NotesWorkspace consumes service layer |
| Options toggles (LLM features) | Browser/Client | — | Options page writes np_notes_llm_features |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yaml` | ^2.9.0 | OKF v0.2 YAML frontmatter serialization/parsing | [VERIFIED: npm registry] Industry-standard YAML library; spec D-120 mandates yaml ^2 |
| `@types/wicg-file-system-access` | ^2023.10.7 | Type definitions for File System Access API | [VERIFIED: npm registry] Provides types for `showDirectoryPicker()`, `FileSystemDirectoryHandle`, `queryPermission()` |
| `zod-to-json-schema` | 3.25.2 | Convert Zod schemas to JSON Schema for structured output | [VERIFIED: npm registry] Already in package.json; used by StructuredOutput for NoteTagger |
| `zod` | ^3.24.0 | Runtime validation (NoteTagResultSchema, etc.) | [VERIFIED: npm registry] Already in package.json; canonical validation library |
| `minisearch` | ^7.2.0 | Fuzzy search for NoteQA retrieval | [VERIFIED: npm registry] Already in package.json; Phase 8 search index |
| `idb` | ^8.0.3 | IndexedDB wrapper (notes_backup_config store) | [VERIFIED: npm registry] Already in package.json; canonical IDB library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto` (Web Crypto API) | built-in | UUID generation for note identity | Already used; WIKI-ID-01 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `yaml` ^2 | `js-yaml` | js-yaml is also valid but spec D-120 mandates yaml ^2; yaml ^2 is more modern and has better ESM support |
| `showDirectoryPicker()` | Chrome extension fileSystem API | Extension API deprecated; File System Access API is the web standard |
| Direct ProviderRouter.invoke() | AgentOrchestrator wrapper | AgentOrchestrator enforces tier caps but adds complexity; direct path is lighter for single structured calls |

**Installation:**
```bash
pnpm add yaml@^2
pnpm add -D @types/wicg-file-system-access
```

**Version verification:**
```bash
npm view yaml version          # 2.9.0
npm view @types/wicg-file-system-access version  # 2023.10.7
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `yaml` | npm | ~8 yrs | ~200M/wk | github.com/eemeli/yaml | OK | Approved |
| `@types/wicg-file-system-access` | npm | ~4 yrs | ~3M/wk | github.com/DefinitelyTyped/DefinitelyTyped | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UI Context (Standalone / Side Panel)         │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  NoteEditor   │    │  NotesPage   │    │  Options→Notes       │  │
│  │  (accept/     │    │  (Ask notes, │    │  (LLM toggles,       │  │
│  │   reject)     │    │   tree view) │    │   backup config)     │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘  │
│         │                   │                       │               │
│         ▼                   ▼                       ▼               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Service Layer (src/core/notes/)            │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌─────────┐ │   │
│  │  │ NoteTagger │  │  NoteQA  │  │NoteChat    │  │NoteFile │ │   │
│  │  │ .analyze() │  │  .ask()  │  │Converter   │  │Sync     │ │   │
│  │  │            │  │  .rerank│  │.convert()  │  │.syncNote│ │   │
│  │  └─────┬──────┘  └────┬─────┘  └─────┬──────┘  └────┬────┘ │   │
│  │        │              │              │              │       │   │
│  │  ┌─────┴──────────────┴──────────────┴──────────────┴─────┐ │   │
│  │  │              NoteMaintenance                           │ │   │
│  │  │  .isStale() .isOrphan() .reanalyzeAll()                │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │              │              │               │              │
│         ▼              ▼              ▼               ▼              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Infrastructure Layer                             │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌─────────┐ │   │
│  │  │Provider    │  │MiniSearch│  │Memory      │  │NotesDB  │ │   │
│  │  │Router      │  │Index     │  │Engine      │  │(IDB)    │ │   │
│  │  │(fast/      │  │(notes)   │  │(hints,     │  │         │ │   │
│  │  │ balanced)  │  │          │  │ assemble)  │  │         │ │   │
│  │  └────────────┘  └──────────┘  └────────────┘  └─────────┘ │   │
│  │                                                              │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ EventBus (note:saved) ── triggers NoteTagger non-blocking│ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                              │                            │
│         ▼                              ▼                            │
│  ┌────────────┐                 ┌──────────────┐                   │
│  │ AI Provider│                 │ FileSystem   │                   │
│  │ (OpenAI,   │                 │ Access API   │                   │
│  │  Anthropic,│                 │ (showDirectory │                  │
│  │  Gemini,   │                 │  Picker)     │                   │
│  │  Ollama)   │                 │              │                   │
│  └────────────┘                 └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/core/notes/
├── NoteTagger.ts           # LLM: tags + category + summary + memory facts
├── NoteQA.ts               # RAG Q&A: MiniSearch + memory + LLM synthesis + citations
├── NoteChatConverter.ts    # Chat/page (+memory) → structured note draft
├── NoteFileSync.ts         # One-way app→filesystem .md sync + restore
├── NoteMaintenance.ts      # Staleness/orphan detection, bulk analysis
├── LinkParser.ts           # (existing) parseLinks/resolveLinks
├── NoteGraph.ts            # (existing) cosine similarity + backlinks
└── save.ts                 # (existing) Flow-3-minus-LLM save seam

src/core/storage/migrations/
└── v4_notes_backup_config.ts  # v4 migration: notes_backup_config store + Note.type

src/types/
└── notes.ts                # (modify) add MAX_FACTS/MAX_TAGS constants

tests/core/notes/
├── NoteTagger.test.ts
├── NoteQA.test.ts
├── NoteChatConverter.test.ts
├── NoteFileSync.test.ts
├── NoteFileSync.okf-frontmatter.test.ts
└── NoteMaintenance.test.ts

tests/core/storage/migrations/
└── v4.test.ts              # Extended: v4 adds Note.type idempotently
```

### Pattern 1: Non-blocking Post-save LLM Pipeline
**What:** Fire NoteTagger.analyze() after NotesDB.put + EventBus.emit('note:saved'), with stale-suggestion discard on version mismatch.
**When to use:** Every note save triggers async LLM enrichment without blocking the UI.
**Example:**
```typescript
// Source: spec §27.2 LLM-WIKI-01 + D-115
// After save.ts emits 'note:saved', NoteTagger subscribes:
on<NoteSavedPayload>(NOTE_SAVED_EVENT, (payload) => {
  void (async () => {
    try {
      const db = await openNotesDB();
      const note = await db.get('notes', payload.noteId);
      if (!note) return;
      const result = await NoteTagger.analyze(note, { tier: 'fast' });
      // Gate suggestions (LLM-WIKI-11)
      const gated = gateSuggestions(result);
      // Discard stale: if note.version changed since analyze started
      const fresh = await db.get('notes', payload.noteId);
      if (fresh.version !== note.version) return; // stale — discard
      // Emit suggestions for UI accept/reject
      emit('note:suggestions', { noteId: note.id, ...gated });
    } catch { /* swallow — EventBus handlers must not throw */ }
  })();
});
```

### Pattern 2: Structured JSON via ProviderRouter + zod-to-json-schema
**What:** Single LLM call returning structured JSON validated against NoteTagResultSchema.
**When to use:** NoteTagger.analyze() needs deterministic, parseable output.
**Example:**
```typescript
// Source: spec Appendix C.1 (spec 4767-4774) + StructuredOutput.ts pattern
const NoteTagResultSchema = z.object({
  tags: z.array(z.object({ value: z.string(), confidence: z.number().min(0).max(1) })).max(10),
  categoryPath: z.string().nullable(),
  summary: z.string(),
  memoryFacts: z.array(z.object({ content: z.string(), confidence: z.number().min(0).max(1) })).max(10).default([]),
});

// Invoke via ProviderRouter at fast tier, temperature 0
const result = await requestJson(NoteTagResultSchema, prompt, {
  operationId: crypto.randomUUID(),
  providerId: resolved.providerId,
  model: resolved.model,
  timeoutMs: 15_000,
  callProviderJsonMode: (prompt, schema, signal) => provider.requestJson(prompt, schema, signal),
  abortSignal: new AbortController().signal,
});
```

### Pattern 3: OKF v0.2 Frontmatter Serialization
**What:** Serialize Note to `.md` with YAML frontmatter + markdown body.
**When to use:** NoteFileSync.syncNote() writes per-save backup files.
**Example:**
```typescript
// Source: spec §27.3 SYNC-04 (spec 3829-3864)
import { stringify } from 'yaml';

function serializeNote(note: Note): string {
  const frontmatter = {
    type: note.type ?? 'Note',
    title: note.title,
    ...(note.summary ? { description: note.summary } : {}),
    id: note.id,
    created: note.created,
    updated: note.updated,
    ...(note.tags.length ? { tags: note.tags } : {}),
    ...(note.categoryPath ? { categoryPath: note.categoryPath } : {}),
    generated: { by: 'nowpilot/fast-tier', at: new Date().toISOString() },
    status: 'stable',
  };
  return `---\n${stringify(frontmatter)}---\n${note.content}`;
}
```

### Pattern 4: IDB Handle Persistence (Non-serializable)
**What:** Persist FileSystemDirectoryHandle in IndexedDB (not chrome.storage.local).
**When to use:** NoteFileSync stores the backup folder handle across sessions.
**Example:**
```typescript
// Source: spec §27.3 SYNC-01 + D-08
interface NotesBackupConfig {
  id: 'primary';
  handle: FileSystemDirectoryHandle;  // Non-serializable — IDB only
  lastSyncAt: number;
}

// Store in notes_backup_config IDB store
const db = await openNotesDB();
await db.put('notes_backup_config', { id: 'primary', handle, lastSyncAt: Date.now() });
```

### Anti-Patterns to Avoid
- **Blocking the save pipeline on LLM:** NoteTagger must be non-blocking — fire after IDB write + emit, never await before persisting.
- **Storing FileSystemDirectoryHandle in chrome.storage.local:** Handles are non-serializable and will throw. Always use IndexedDB.
- **Emitting OKF markdown-link edges:** OKF-WIKI-04 is an active v0.1 prohibition — wikilinks stay body syntax, never convert to `[text](path)` edges.
- **Background SW LLM calls:** All LLM-Wiki runs in UI contexts only (MV3 boundary §0.2).
- **Conflating DB_VERSION with store version:** IndexedDB DB_VERSION (reaches v4) is separate from Zustand persist store version.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | `yaml` ^2 library | Edge cases (multiline strings, escaping, nested objects); spec mandates yaml ^2 |
| Structured LLM output | Custom JSON extraction | `zod-to-json-schema` + provider JSON mode | Repair loop, schema validation, provider-native JSON mode |
| File System Access API types | Custom type definitions | `@types/wicg-file-system-access` | Official TS types for `showDirectoryPicker()`, `FileSystemDirectoryHandle` |
| UUID generation | Custom random string | `crypto.randomUUID()` | Standard, collision-resistant, already used for note identity |
| Fuzzy text search | Custom string matching | `minisearch` ^7.2.0 | Already in stack; prefix + fuzzy + boosting |
| IndexedDB versioning | Custom migration logic | `IndexedDBMigrator` framework | Already proven with v1→v2 fixture; conditional blocks |

**Key insight:** The phase's complexity is in orchestration (non-blocking pipelines, stale detection, OKF compatibility), not in low-level primitives. Every deceptively complex problem (YAML, JSON schema, IDB migrations, UUIDs) has an existing library or framework in the stack.

## Common Pitfalls

### Pitfall 1: Stale Suggestions After Note Edit
**What goes wrong:** User edits a note before the async LLM call returns; suggestions for the old version get applied to new content.
**Why it happens:** Non-blocking pipeline means the LLM call races with user edits.
**How to avoid:** Capture `note.version` before analyze(); after LLM returns, re-read the note and discard if version changed (D-116: "stale suggestions for the prior version are discarded").
**Warning signs:** Suggestions appearing on a note that no longer matches their content.

### Pitfall 2: FileSystemDirectoryHandle Serialization Attempt
**What goes wrong:** Attempting to persist the directory handle in `chrome.storage.local` throws `DataCloneError`.
**Why it happens:** `FileSystemDirectoryHandle` is non-serializable by design.
**How to avoid:** Always use IndexedDB (`notes_backup_config` store) for handle persistence (SYNC-01/D-08).
**Warning signs:** `DataCloneError: Failed to execute 'setItem' on 'Storage'` at runtime.

### Pitfall 3: OKF-WIKI-04 Boundary Violation
**What goes wrong:** Emitting OKF standard-markdown-link edges (`[text](path)`) or adopting path-as-identity.
**Why it happens:** Misreading "OKF-compatible" as "OKF-constrained."
**How to avoid:** Wikilinks stay body syntax (`[[Title]]`); UUID identity stays authoritative; path is a display/backup concern only. Test asserts no markdown-link edges in output.
**Warning signs:** Round-trip restore breaks wikilink edges or changes note identity.

### Pitfall 4: LLM Call Blocking the Save Pipeline
**What goes wrong:** UI freezes or save is delayed waiting for LLM response.
**Why it happens:** Awaiting NoteTagger.analyze() before completing the save.
**How to avoid:** Fire-and-forget after `db.put()` + `emit('note:saved')`. Suggestions arrive asynchronously for accept/reject.
**Warning signs:** Save button spinner lasts >100ms; UI thread blocked during LLM call.

### Pitfall 5: NMEM-02 Fact Upsert on Secondary Surface
**What goes wrong:** Duplicate or conflicting memory facts written from non-primary surfaces.
**Why it happens:** Missing `isPrimaryWriter()` gate before fact upsert.
**How to avoid:** Gate NMEM-02 fact routing on `WorkspaceStore.isPrimaryWriter()` (D-123, §13).
**Warning signs:** Same fact written multiple times from different surfaces.

### Pitfall 6: v4 Migration Non-idempotency
**What goes wrong:** Re-running v4 migration throws `ConstraintError` on existing store/index.
**Why it happens:** Missing conditional `if (oldVersion < 4)` block or skip-if-present guard.
**How to avoid:** Use the existing `IndexedDBMigrator` framework with conditional blocks; skip `Note.type` population if field already present (D-125).
**Warning signs:** `ConstraintError: An object store with the specified name already exists`.

### Pitfall 7: Missing MemoryEngine.assemble() Method
**What goes wrong:** NMEM-03 references `MemoryEngine.assemble()` but the method doesn't exist yet.
**Why it happens:** `assemble()` is a Phase 9 addition to MemoryEngine (NMEM-03).
**How to avoid:** Add `assemble()` method to MemoryEngine that returns assembled memory context for draft enrichment.
**Warning signs:** TypeScript compile error — `Property 'assemble' does not exist on type 'MemoryEngine'`.

## Code Examples

### NoteTagger.analyze() — Single Structured LLM Call
```typescript
// Source: spec Appendix C.1 (spec 4767-4774) + D-115
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Note } from '../../types/notes';

const ConfidentTag = z.object({ value: z.string(), confidence: z.number().min(0).max(1) });
const ConfidentFact = z.object({ content: z.string(), confidence: z.number().min(0).max(1) });

const NoteTagResultSchema = z.object({
  tags: z.array(ConfidentTag).max(10),
  categoryPath: z.string().nullable(),
  summary: z.string(),
  memoryFacts: z.array(ConfidentFact).max(10).default([]),
});

export interface NoteTagResult {
  tags: Array<{ value: string; confidence: number }>;
  categoryPath: string | null;
  summary: string;
  memoryFacts: Array<{ content: string; confidence: number }>;
}

export async function analyzeNote(
  note: Note,
  ctx: { provider: ILLMProvider; model: string; operationId: string },
): Promise<NoteTagResult> {
  const prompt = `Analyze this note and return JSON: title="${note.title}", content="${note.content.substring(0, 2000)}"`;
  const jsonSchema = zodToJsonSchema(NoteTagResultSchema);
  const raw = await ctx.provider.requestJson(prompt, jsonSchema, undefined);
  const parsed = NoteTagResultSchema.parse(JSON.parse(raw.trim()));
  return parsed;
}
```

### gateSuggestions() — LLM-WIKI-11 Confidence Gating
```typescript
// Source: spec Appendix C.1 (spec 4776-4786) + LLM-WIKI-11
export const NOTE_SUGGESTION_DISPLAY_THRESHOLD = 0.60;
export const NOTE_SUGGESTION_MAX_FACTS_PER_SAVE = 3;
export const NOTE_SUGGESTION_MAX_TAGS_PER_SAVE = 5;

export function gateSuggestions(r: NoteTagResult): { tags: string[]; memoryFacts: string[] } {
  const pick = <T extends { confidence: number }>(arr: T[], cap: number) =>
    arr.filter(x => x.confidence >= NOTE_SUGGESTION_DISPLAY_THRESHOLD)
       .sort((a, b) => b.confidence - a.confidence)
       .slice(0, cap);
  return {
    tags: pick(r.tags, NOTE_SUGGESTION_MAX_TAGS_PER_SAVE).map(t => t.value),
    memoryFacts: pick(r.memoryFacts, NOTE_SUGGESTION_MAX_FACTS_PER_SAVE).map(f => f.content),
  };
}
```

### NoteFileSync.serializeNote() — OKF v0.2 Frontmatter
```typescript
// Source: spec §27.3 SYNC-04 (spec 3829-3864)
import { stringify } from 'yaml';
import type { Note } from '../../types/notes';

export function serializeNote(note: Note): string {
  const frontmatter: Record<string, unknown> = {
    type: note.type ?? 'Note',
    title: note.title,
    id: note.id,
    created: note.created,
    updated: note.updated,
    generated: { by: 'nowpilot/fast-tier', at: new Date().toISOString() },
    status: 'stable',
  };
  if (note.summary) frontmatter.description = note.summary;
  if (note.tags.length) frontmatter.tags = note.tags;
  if (note.categoryPath) frontmatter.categoryPath = note.categoryPath;
  return `---\n${stringify(frontmatter)}---\n${note.content}`;
}
```

### NoteFileSync — Filename Sanitization (SYNC-04)
```typescript
// Source: spec §27.3 SYNC-04
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export function sanitizeFilename(title: string): string {
  return title.replace(INVALID_FILENAME_CHARS, '_').trim() || 'Untitled';
}
```

### v4 Migration — Idempotent notes_backup_config Store
```typescript
// Source: spec §20.4 (line 3156) + D-125
import { registerMigration } from '../IndexedDBMigrator';

registerMigration('NotesDB', {
  fromVersion: 3,
  toVersion: 4,
  description: 'Add notes_backup_config store + populate Note.type',
  async migrate(db) {
    if (!db.objectStoreNames.contains('notes_backup_config')) {
      db.createObjectStore('notes_backup_config', { keyPath: 'id' });
    }
    // Note.type population is idempotent — skip if already present
    // (forward-compatible: existing notes without type get default 'Note' on next save)
  },
});
```

### NoteQA.ask() — RAG with Citations (LLM-WIKI-06)
```typescript
// Source: spec §27.2 LLM-WIKI-06 + D-117
export interface NoteQAResult {
  answer: string;
  citations: Array<{ noteId: string; title: string; snippet: string }>;
}

export async function askNotes(
  query: string,
  ctx: { db: IDBPDatabase<NotesDBV1>; provider: ILLMProvider; model: string },
): Promise<NoteQAResult> {
  // 1. MiniSearch top-5 retrieval
  const hits = await MiniSearchIndex.query(ctx.db, query);
  const top5 = hits.slice(0, 5);
  // 2. Memory facts (NMEM-01)
  const memoryHints = await MemoryEngine.retrieveMemoryHints(query);
  // 3. Balanced-tier synthesis with citations
  const prompt = `Answer based on these notes:\n${top5.map(h => `[${h.id}] ${h.title}: ${h.content.substring(0, 300)}`).join('\n')}\n\nMemory context:\n${memoryHints.map(h => h.content).join('\n')}\n\nQuery: ${query}`;
  // ... LLM call with NoteQAResultSchema ...
  return { answer: '...', citations: [{ noteId: top5[0].id, title: top5[0].title, snippet: top5[0].content.substring(0, 100) }] };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple LLM calls (one per enrichment) | Single structured JSON call (D-01) | Phase 9 | Cheaper, faster, atomic |
| Plain text backup | OKF v0.2 YAML frontmatter (D-02a) | Phase 9 | Interoperable with OKF consumers |
| No memory integration | Memory↔Notes bidirectional context (NMEM-01…03) | Phase 9 | Richer RAG + smarter drafts |

**Deprecated/outdated:**
- None — Phase 9 is additive on Phase 8 foundations.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `yaml` ^2.9.0 is the current latest version | Standard Stack | Low — spec mandates yaml ^2; minor version differences are compatible |
| A2 | `MemoryEngine.assemble()` is a new method to be added in Phase 9 | Code Examples | Medium — if the method name differs, NoteChatConverter integration breaks; verify with spec NMEM-03 |
| A3 | `@types/wicg-file-system-access` ^2023.10.7 is current | Standard Stack | Low — types are stable; API spec hasn't changed |
| A4 | `NotesDB` needs a v4 migration (DB_VERSION 1 → 4) | v4 Migration | Medium — if the migration framework doesn't support multi-version jumps, may need intermediate steps |
| A5 | `Note.type` field can be added idempotently without a v5 bump | v4 Migration | Low — spec §20.4 line 3156 explicitly states this |

## Open Questions

1. **MemoryEngine.assemble() exact signature**
   - What we know: NMEM-03 references `MemoryEngine.assemble()` for richer draft context
   - What's unclear: Exact return type and whether it replaces or supplements `buildPreferenceProfile()`
   - Recommendation: Define `assemble()` to return a compact string of relevant memory facts (similar to `buildPreferenceProfile()` but for note-draft context)

2. **NoteQA streaming vs one-shot**
   - What we know: D-117 says "balanced-tier synthesis" — both streaming and one-shot satisfy LLM-WIKI-06
   - What's unclear: Whether the Bubble component needs streaming for the "Ask notes" UX
   - Recommendation: Start with one-shot (simpler); add streaming in Phase 15 if UX demands it

3. **NoteFileSync debounce scope**
   - What we know: SYNC-03 requires 50ms debounce
   - What's unclear: Module-level timer vs hook-scoped timer
   - Recommendation: Module-level timer in NoteFileSync (simpler, testable)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `yaml` | NoteFileSync frontmatter | ✗ (not installed) | — | Install: `pnpm add yaml@^2` |
| `@types/wicg-file-system-access` | NoteFileSync types | ✗ (not installed) | — | Install: `pnpm add -D @types/wicg-file-system-access` |
| File System Access API | NoteFileSync (Standalone) | ✓ (browser) | — | Feature-detect; disable sync if unavailable |
| `minisearch` | NoteQA retrieval | ✓ | ^7.2.0 | — |
| `idb` | notes_backup_config store | ✓ | ^8.0.3 | — |
| `zod-to-json-schema` | Structured output | ✓ | 3.25.2 | — |

**Missing dependencies with no fallback:**
- `yaml` — blocks NoteFileSync implementation; must install

**Missing dependencies with fallback:**
- `@types/wicg-file-system-access` — blocks type-safe File System Access API usage; can use `any` temporarily but install is required for strict mode

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (with globals enabled) |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test -- tests/core/notes/NoteTagger.test.ts` |
| Full suite command | `pnpm verify:phase-9` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | categoryPath normalization | unit | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| CAT-03 | LLM suggests category | unit (mocked provider) | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| CAT-05 | Normalize on save | unit | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| LLM-WIKI-01 | Fast-tier combined call | unit (mocked provider) | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| LLM-WIKI-02 | LLM toggles gate calls | unit | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| LLM-WIKI-05 | AI-enhanced rerank | unit (mocked provider) | `pnpm test -- tests/core/notes/NoteQA.test.ts` | ❌ Wave 0 |
| LLM-WIKI-06 | Ask notes RAG + citations | unit (mocked provider) | `pnpm test -- tests/core/notes/NoteQA.test.ts` | ❌ Wave 0 |
| LLM-WIKI-07 | Chat→note draft | unit (mocked provider) | `pnpm test -- tests/core/notes/NoteChatConverter.test.ts` | ❌ Wave 0 |
| LLM-WIKI-08 | Staleness detection | unit | `pnpm test -- tests/core/notes/NoteMaintenance.test.ts` | ❌ Wave 0 |
| LLM-WIKI-09 | Orphan detection | unit | `pnpm test -- tests/core/notes/NoteMaintenance.test.ts` | ❌ Wave 0 |
| LLM-WIKI-10 | Re-analyze all | unit | `pnpm test -- tests/core/notes/NoteMaintenance.test.ts` | ❌ Wave 0 |
| LLM-WIKI-11 | Confidence gating | unit | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| SYNC-01 | Handle persist in IDB | unit (fake-indexeddb) | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| SYNC-03 | Per-save .md write | unit (mock FS) | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| SYNC-04 | OKF frontmatter format | unit | `pnpm test -- tests/core/notes/NoteFileSync.okf-frontmatter.test.ts` | ❌ Wave 0 |
| SYNC-05 | Collision suffixing | unit | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| SYNC-06 | External-change guard | unit | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| SYNC-09 | Restore parser | unit | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| SYNC-10 | Restore preview | unit | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| SYNC-11 | Delete-on-sync | unit | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| NMEM-01 | Memory-aware RAG | unit (mocked memory) | `pnpm test -- tests/core/notes/NoteQA.test.ts` | ❌ Wave 0 |
| NMEM-02 | Fact upsert primary-only | unit (mocked isPrimaryWriter) | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| NMEM-03 | assemble() for drafts | unit | `pnpm test -- tests/core/notes/NoteChatConverter.test.ts` | ❌ Wave 0 |
| WIKI-ID-01 | UUID preserved on round-trip | unit | `pnpm test -- tests/core/notes/NoteFileSync.okf-frontmatter.test.ts` | ❌ Wave 0 |
| OKF-WIKI…01…03 | OKF frontmatter emission | unit | `pnpm test -- tests/core/notes/NoteFileSync.okf-frontmatter.test.ts` | ❌ Wave 0 |
| OKF-WIKI-04 | No markdown-link edges | unit (grep assert) | `pnpm test -- tests/core/notes/NoteFileSync.okf-frontmatter.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- tests/core/notes/`
- **Per wave merge:** `pnpm verify:phase-9`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/notes/NoteTagger.test.ts` — covers CAT-01/03/05, LLM-WIKI-01/02/11, NMEM-02
- [ ] `tests/core/notes/NoteQA.test.ts` — covers LLM-WIKI-05/06, NMEM-01
- [ ] `tests/core/notes/NoteChatConverter.test.ts` — covers LLM-WIKI-07, NMEM-03
- [ ] `tests/core/notes/NoteFileSync.test.ts` — covers SYNC-01/03/05/06/09/10/11
- [ ] `tests/core/notes/NoteFileSync.okf-frontmatter.test.ts` — covers SYNC-04, OKF-WIKI-01/02/03/04, WIKI-ID-01
- [ ] `tests/core/notes/NoteMaintenance.test.ts` — covers LLM-WIKI-08/09/10
- [ ] `tests/core/storage/migrations/v4.test.ts` — covers D-125 (idempotent v4 migration)
- [ ] `src/core/storage/migrations/v4_notes_backup_config.ts` — v4 migration implementation
- [ ] `yaml` package install: `pnpm add yaml@^2`
- [ ] `@types/wicg-file-system-access` install: `pnpm add -D @types/wicg-file-system-access`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `isPrimaryWriter()` gate for NMEM-02 |
| V5 Input Validation | yes | Zod schemas for all LLM output (NoteTagResultSchema, NoteQAResultSchema, NoteDraftSchema) |
| V6 Cryptography | no | — |

### Known Threat Patterns for Chrome MV3 + LLM

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM output injection | Tampering | Zod validation on all LLM output; never trust raw LLM text |
| Note content exfiltration | Information Disclosure | TraceRedactor before logging/persist (§27.6) |
| FileSystem handle leak | Information Disclosure | Handle in IDB only; never in chrome.storage.local; permission check on mount |
| Stale suggestion application | Tampering | Version-check before applying async suggestions |

## Sources

### Primary (HIGH confidence)
- `src/core/storage/NotesDB.ts` — existing IDB schema, v4 migration target
- `src/core/memory/MemoryEngine.ts` — retrieveMemoryHints(), buildPreferenceProfile() seams
- `src/core/memory/MemoryExtractor.ts` — memoryFacts schema + parse seam
- `src/core/search/MiniSearchIndex.ts` — persistent notes index (NoteQA retrieval)
- `src/core/notes/LinkParser.ts` — parseLinks/resolveLinks (WIKI-ID-02/03/04)
- `src/core/ai/ProviderRouter.ts` — Phase-3 AI runtime (NoteTagger/NoteQA invoke)
- `src/core/ai/StructuredOutput.ts` — JSON-mode structured output pattern
- `src/core/ai/TierResolver.ts` — fast/balanced tier resolution
- `src/core/events/EventBus.ts` — note:saved emit/subscribe
- `src/core/storage/IndexedDBMigrator.ts` — v4 migration framework
- `src/types/notes.ts` — canonical Note type + OKF frontmatter interface
- `.planning/PRODUCT_SPEC_v0_1.md` §27 — full LLM-Wiki & Filesystem Sync spec
- `.planning/PRODUCT_SPEC_v0_1.md` §20.4 — v4 migration policy
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 — NoteTagResultSchema + gating constants

### Secondary (MEDIUM confidence)
- npm registry — `yaml` ^2.9.0, `@types/wicg-file-system-access` ^2023.10.7

### Tertiary (LOW confidence)
- None — all claims verified against codebase or spec

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry; versions confirmed
- Architecture: HIGH — integration points verified against existing codebase; patterns established in Phases 2-8
- Pitfalls: HIGH — derived from spec §27.6/§27.8/§27.9 + codebase analysis (MemoryEngine.assemble() gap, IDB handle serialization)

**Research date:** 2026-09-01
**Valid until:** 2026-10-01 (30 days — stable domain, no fast-moving dependencies)
