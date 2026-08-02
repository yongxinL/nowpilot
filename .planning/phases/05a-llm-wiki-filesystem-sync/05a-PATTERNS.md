# Phase 05a: LLM-Wiki & Filesystem Sync - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 16 total (10 new, 3 modified, 6 test files)
**Analogs found:** 16 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/ai/LlmService.ts` | service | request-response (LLM) | `src/core/ai/StructuredOutput.ts` + `src/core/memory/MemoryEngine.ts` | exact (same role + same AI pipeline) |
| `src/core/notes/NoteTagger.ts` | service | event-driven (note:saved → LLM) | `src/core/memory/MemoryEngine.ts` + `src/core/ai/StructuredOutput.ts` | exact (same singleton + LLM pattern) |
| `src/core/notes/NoteQA.ts` | service | request-response (RAG) | `src/core/memory/MemoryEngine.ts` + `src/core/notes/MiniSearchNoteIndex.ts` | role-match (retrieval + synthesis service) |
| `src/core/notes/NoteChatConverter.ts` | service | request-response (LLM transform) | `src/core/ai/StructuredOutput.ts` | role-match (structured LLM output) |
| `src/core/notes/NoteFileSync.ts` | service | event-driven + file-I/O | `src/core/notes/NotesDB.ts` + `src/core/notes/MiniSearchNoteIndex.ts` | partial (IndexedDB + persist patterns, filesystem is new) |
| `src/core/notes/NoteMaintenance.ts` | service | request-response (query) | `src/core/notes/NoteGraph.ts` + `src/core/notes/NotesDB.ts` | exact (passive query service + singleton) |
| `src/core/notes/NoteSchema.ts` **(modify)** | model | struct | `src/core/notes/NoteSchema.ts` (existing) | exact (extending own schema) |
| `src/core/notes/NotesDB.ts` **(modify)** | service | CRUD | `src/core/notes/NotesDB.ts` (existing) | exact (adding query to own methods) |
| `src/core/storage/MigrationRunner.ts` **(modify)** | service | CRUD (migration) | `src/core/storage/MigrationRunner.ts` (existing migrateV4) | exact (following own v4 pattern) |
| `tests/core/ai/LlmService.test.ts` | test | — | `tests/core/ai/StructuredOutput.test.ts` | exact (same directory, same pattern) |
| `tests/core/notes/NoteTagger.test.ts` | test | — | `tests/core/notes/NotesDB.test.ts` | exact (same directory, same pattern) |
| `tests/core/notes/NoteQA.test.ts` | test | — | `tests/core/notes/NotesDB.test.ts` | exact (same directory, same pattern) |
| `tests/core/notes/NoteChatConverter.test.ts` | test | — | `tests/core/notes/NotesDB.test.ts` | exact (same directory, same pattern) |
| `tests/core/notes/NoteFileSync.test.ts` | test | — | `tests/core/notes/NotesDB.test.ts` | exact (same directory, same pattern) |
| `tests/core/notes/NoteMaintenance.test.ts` | test | — | `tests/core/notes/NotesDB.test.ts` | exact (same directory, same pattern) |
| `tests/core/storage/MigrationRunner.test.ts` **(extend)** | test | — | `tests/core/storage/MigrationRunner.test.ts` (existing v4 tests) | exact (following own v4 test pattern) |

---

## Pattern Assignments

### 1. `src/core/ai/LlmService.ts` (service, request-response)

**Analogs:** `src/core/ai/StructuredOutput.ts` (lines 73-104) + `src/core/memory/MemoryEngine.ts` (lines 111-142, 442-463)

**Imports pattern** (from StructuredOutput.ts lines 1-6 + MemoryEngine.ts lines 1-15):
```typescript
import { generateText } from 'ai';
import type { z } from 'zod';
import { PipelineError } from './PipelineError';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { ModelTier } from './types';
import { resolveTierModel } from './TierResolver';
```

**Core pattern — generateWithRepair wrapper** (from StructuredOutput.ts lines 73-104):
```typescript
export async function generateWithRepair<T>(
  adapter: ProviderAdapter,
  tier: ModelTier,
  prompt: string,
  schema: z.ZodSchema<T>,
  abortSignal?: AbortSignal,
): Promise<T> {
  const { modelId } = resolveTierModel(adapter, tier);
  const model = adapter.createLanguageModel(modelId);

  const systemPrompt = [
    'You are a JSON response generator. Respond ONLY with a valid JSON object.',
    'Do not include markdown fences, explanations, or any text outside the JSON.',
    prompt,
  ].join('\n');

  try {
    const { text } = await generateText({
      model,
      messages: [{ role: 'system', content: systemPrompt }],
      abortSignal,
    });
    return repairJSON(text, schema);
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    if (isSchemaError(err) && err.name === 'AbortError') {
      throw new PipelineError('ABORTED', 'Request was aborted.', {});
    }
    throw new PipelineError('UNKNOWN', 'Structured output generation failed.', { originalError: String(err) });
  }
}
```

**Singleton pattern** (from MemoryEngine.ts lines 442-463):
```typescript
// ── Singleton (module-level, ContextOptimizer pattern) ──────────────────────
let _instance: LlmService | null = null;

export function getLlmService(): LlmService {
  if (!_instance) {
    _instance = new LlmService();
  }
  return _instance;
}

export function resetLlmService(): void {
  _instance = null;
}
```

**Error handling** — reuse `PipelineError` (from PipelineError.ts lines 1-32):
```typescript
import { PipelineError } from './PipelineError';
// Error codes: 'SCHEMA_INVALID' (terminal), 'ABORTED' (terminal), 'UNKNOWN' (terminal)
```

**What LlmService adds on top of generateWithRepair:**
- Accepts `systemPrompt` + `userPrompt` separately, joins them
- Exposes `generate<T>({ adapter, tier, systemPrompt, userPrompt, schema, abortSignal })`
- Reuses `repairJSON()` from StructuredOutput for JSON repair
- Reuses `resolveTierModel()` from TierResolver for haiku/flash resolution

---

### 2. `src/core/notes/NoteTagger.ts` (service, event-driven)

**Analogs:** `src/core/memory/MemoryEngine.ts` (singleton) + `src/core/ai/StructuredOutput.ts` (LLM call)

**Imports pattern** (from MemoryEngine.ts lines 1-15 + NotesDB.ts line 4):
```typescript
import type { z } from 'zod';
import { getLlmService } from '../ai/LlmService';
import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
import { getNotesDb } from './NotesDB';
import { on } from '../events/EventBus';
import type { Note } from './NoteSchema';
```

**Singleton pattern** (from MemoryEngine.ts lines 442-463):
```typescript
export class NoteTagger {
  async analyze(adapter: ProviderAdapter, noteId: string, noteContent: string, noteVersion: number, abortSignal?: AbortSignal): Promise<NoteTaggerResult> {
    const llm = getLlmService();
    return llm.generate({
      adapter,
      tier: 'FAST',
      systemPrompt: PROMPTS.noteTagger.system,
      userPrompt: `Note content:\n${noteContent}`,
      schema: NoteTaggerResultSchema,
      abortSignal,
    });
  }
}

let _instance: NoteTagger | null = null;
export function getNoteTagger(): NoteTagger {
  if (!_instance) _instance = new NoteTagger();
  return _instance;
}
export function resetNoteTagger(): void { _instance = null; }
```

**EventBus subscription pattern** (from EventBus.ts lines 16-25 + RESEARCH.md Pattern 2):
```typescript
// EventBus subscription — Source: EventBus.ts on() signature
let unsub: (() => void) | null = null;

export function initNoteTagger(): void {
  if (unsub) return;
  unsub = on<{ noteId: string }>('note:saved', async ({ noteId }) => {
    // fire non-blocking LLM call; silently discard on version mismatch (D-07)
  });
}
```

**Zod schema — NoteTaggerResult** (from RESEARCH.md lines 467-484 + NoteSchema.ts line 1):
```typescript
import { z } from 'zod';

export const NoteTaggerResultSchema = z.object({
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
```

**Error handling — silently discard** (D-07): No thrown errors. LLM failures and stale suggestions are silently discarded. Matches EventBus `emit()` try/catch-swallow pattern (EventBus.ts lines 27-37):
```typescript
// EventBus handlers must not throw — swallow errors
entry.handlers.forEach((handler) => {
  try { handler(payload); } catch { /* swallow */ }
});
```

---

### 3. `src/core/notes/NoteQA.ts` (service, request-response)

**Analogs:** `src/core/memory/MemoryEngine.ts` (retrieval pipeline lines 159-248) + `src/core/notes/MiniSearchNoteIndex.ts` (search lines 191-213)

**Singleton + imports** (from MemoryEngine.ts lines 442-463 + MiniSearchNoteIndex.ts lines 1-5):
```typescript
import type { z } from 'zod';
import { getLlmService } from '../ai/LlmService';
import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
import { getMemoryEngine } from '../memory/MemoryEngine';
import { noteSearchIndex } from './MiniSearchNoteIndex';
import type { Note } from './NoteSchema';

export class NoteQA {
  // ...
}

let _instance: NoteQA | null = null;
export function getNoteQA(): NoteQA {
  if (!_instance) _instance = new NoteQA();
  return _instance;
}
export function resetNoteQA(): void { _instance = null; }
```

**Search retrieval pattern** (from MiniSearchNoteIndex.ts lines 191-213):
```typescript
// BM25-ranked search with title boosting — NoteQA consumes for snippet retrieval
search(query: string, limit = 20): NoteSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const results = this.index.search(trimmed).slice(0, limit);
  return results.map((result) => {
    // enrich with snippet, matchedFields, etc.
  });
}
```

**Memory retrieval pattern** (from MemoryEngine.ts lines 159-248 — `retrieve()`):
```typescript
async retrieve(options: RetrievalOptions): Promise<MemoryRetrievalResult> {
  // 1. Conversation memory
  // 2. User facts: D-08 scored
  const topFacts = getTopFacts(facts, options.query, options.tier);
  // 3. Preferences
  return { success: true, items };
}
```

**NoteQA modes (D-15):**
- `search` mode: MiniSearch top-10 → haiku rerank
- `ask` mode: MiniSearch top-5 + MemoryEngine → flash synthesis with citations
- Tiny model tier: raw MiniSearch + MemoryEngine results, no LLM call (D-16)

**Citation parsing** (from RESEARCH.md lines 596-629):
```typescript
// D-13: LLM sees [1], [2] markers; NoteQA maps to citation objects
function parseCitations(rawText: string, snippets: Array<{ noteId: string; title: string; snippet: string }>): Citation[] {
  const citations: Citation[] = [];
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

---

### 4. `src/core/notes/NoteChatConverter.ts` (service, request-response)

**Analog:** `src/core/ai/StructuredOutput.ts` (structured LLM output)

**Singleton + imports** (from MemoryEngine.ts pattern):
```typescript
import type { z } from 'zod';
import { getLlmService } from '../ai/LlmService';
import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
import { getMemoryEngine } from '../memory/MemoryEngine';

export class NoteChatConverter {
  async convert(adapter: ProviderAdapter, chatMessages: string[], abortSignal?: AbortSignal): Promise<NoteDraft> {
    const memory = getMemoryEngine();
    const context = await memory.assemble(); // MEM-03
    const llm = getLlmService();
    return llm.generate({
      adapter,
      tier: 'FAST', // haiku
      systemPrompt: PROMPTS.noteChatConverter.system,
      userPrompt: `Context:\n${context}\n\nChat:\n${chatMessages.join('\n')}`,
      schema: NoteDraftSchema,
      abortSignal,
    });
  }
}

let _instance: NoteChatConverter | null = null;
export function getNoteChatConverter(): NoteChatConverter {
  if (!_instance) _instance = new NoteChatConverter();
  return _instance;
}
export function resetNoteChatConverter(): void { _instance = null; }
```

**NoteDraft Zod schema** (from RESEARCH.md lines 596-604 pattern + NoteSchema.ts line 1):
```typescript
export const NoteDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  categoryPath: z.string(),
  wikilinks: z.array(z.string()),
});
type NoteDraft = z.infer<typeof NoteDraftSchema>;
```

**Provenance** — when the user saves the draft, set `provenance: { source: 'chat-conversion' }` (D-20, NoteProvenanceSchema from NoteSchema.ts line 8).

---

### 5. `src/core/notes/NoteFileSync.ts` (service, event-driven + file-I/O)

**Analogs:** `src/core/notes/NotesDB.ts` (IndexedDB access pattern lines 10-20) + `src/core/notes/MiniSearchNoteIndex.ts` (persist/load pattern lines 129-163)

**Imports pattern** (from NotesDB.ts lines 1-8 + MiniSearchNoteIndex.ts lines 1-2):
```typescript
import { openDB, type IDBPDatabase } from 'idb';
import { migrationRunner } from '../storage/MigrationRunner';
import { on } from '../events/EventBus';
import { getNotesDb } from './NotesDB';
import { stringify, parse } from 'yaml';
import type { Note } from './NoteSchema';
```

**EventBus subscription** (from RESEARCH.md Pattern 2):
```typescript
let unsub: (() => void) | null = null;

export function initNoteFileSync(): void {
  if (unsub) return;
  unsub = on<{ noteId: string }>('note:saved', async ({ noteId }) => {
    // debounce 50ms, then fire-and-forget sync (D-17)
  });
}
```

**IndexedDB access pattern for backup_config** (from NotesDB.ts lines 10-20):
```typescript
async function openNotesDb(): Promise<IDBPDatabase> {
  // Open at version 5 (v5 includes backup_config store)
  await migrationRunner.migrate('NotesDB', 5);
  return openDB('NotesDB', 5);
}
```

**Persist/Load handle pattern** (from MiniSearchNoteIndex.ts lines 122-163 — db open/close with finally):
```typescript
private async openDb(): Promise<IDBPDatabase> {
  await migrationRunner.migrate('NotesDB', 5);
  const db = await openDB('NotesDB', 5);
  return db;
}

async saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await this.openDb();
  try {
    await db.put('backup_config', { id: 'backup_folder', handle });
  } finally {
    db.close();
  }
}

async getHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await this.openDb();
  try {
    const record = await db.get('backup_config', 'backup_folder');
    return record?.handle ?? null;
  } finally {
    db.close();
  }
}
```

**Permission check pattern** (from RESEARCH.md lines 507-524):
```typescript
async function verifyPermission(handle: FileSystemDirectoryHandle, readWrite: boolean = true): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = {};
  if (readWrite) options.mode = 'readwrite';
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if ((await handle.requestPermission(options)) === 'granted') return true;
  return false;
}
```

**YAML frontmatter** (from RESEARCH.md lines 550-587):
```typescript
import { stringify, parse } from 'yaml';

function generateNoteFile(note: Note, summary?: string): string {
  const fm = {
    id: note.id, title: note.title, created: note.createdAt,
    updated: note.updatedAt, tags: note.tags,
    categoryPath: note.categoryPath || null, summary: summary || null,
  };
  const yamlBody = stringify(fm, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE' });
  return `---\n${yamlBody}---\n\n${note.content}`;
}
```

**Filename sanitization** (from RESEARCH.md lines 533-542):
```typescript
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
function sanitizeFilename(title: string): string {
  return title.replace(INVALID_FILENAME_CHARS, '_').trim() || 'untitled';
}
function buildFilePath(categoryPath: string, title: string): string {
  const sanitized = sanitizeFilename(title);
  return categoryPath ? `${categoryPath}/${sanitized}.md` : `${sanitized}.md`;
}
```

**Debounce pattern** — simple `setTimeout(fn, 50)` with `clearTimeout` (RESEARCH.md lines 393).

---

### 6. `src/core/notes/NoteMaintenance.ts` (service, request-response)

**Analog:** `src/core/notes/NoteGraph.ts` (passive query service, singleton lines 107-193) + `src/core/notes/NotesDB.ts` (CRUD query lines 136-180)

**Imports pattern** (from NoteGraph.ts lines 1 + 188-193):
```typescript
import type { Note } from './NoteSchema';
import { getNotesDb } from './NotesDB';
import { getNoteGraph } from './NoteGraph';
```

**Singleton — NoteGraph-style** (from NoteGraph.ts lines 107-193):
```typescript
export class NoteMaintenance {
  private static _instance: NoteMaintenance | null = null;
  private constructor() {}

  static getInstance(): NoteMaintenance {
    if (!NoteMaintenance._instance) {
      NoteMaintenance._instance = new NoteMaintenance();
    }
    return NoteMaintenance._instance;
  }

  static resetInstance(): void {
    NoteMaintenance._instance = null;
  }

  async getStaleNotes(): Promise<Note[]> { /* ... */ }
  async getOrphanNotes(): Promise<Note[]> { /* ... */ }
  async reanalyzeAll(): Promise<void> { /* ... */ }
}

export function getNoteMaintenance(): NoteMaintenance {
  return NoteMaintenance.getInstance();
}
export const noteMaintenance = getNoteMaintenance();
```

**Query pattern** (from NotesDB.ts lines 136-157 — `get()` + `getAll()`):
```typescript
async getAll(): Promise<Note[]> {
  const db = await openNotesDb();
  return (await db.getAll('notes')) as Note[];
}
```

**Orphan detection** (from NoteGraph.ts lines 125-128 — `getBacklinks()`):
```typescript
getBacklinks(noteId: string, allNotes: Note[]): string[] {
  return allNotes.filter((n) => n.links.includes(noteId)).map((n) => n.id);
}
```
NoteMaintenance orphan detection: notes where `note.links.length === 0 && getBacklinks(noteId, all).length === 0`.

**Staleness detection** — simple date comparison: `tagsGeneratedAt < updatedAt` or `summaryGeneratedAt < updatedAt`.

---

### 7. `src/core/notes/NoteSchema.ts` (modify — model, struct)

**Analog:** `src/core/notes/NoteSchema.ts` (extending own schema)

**Existing NoteSchema** (lines 24-36) — extend with new optional fields:
```typescript
export const NoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()),
  categoryPath: z.string().default(''),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number().int().nonnegative().default(1),
  provenance: NoteProvenanceSchema,
  links: z.array(z.string()).default([]),
  unresolvedLinks: z.array(z.string()).default([]),
  // ── Phase 5a additions ──
  summary: z.string().optional(),
  lastSyncedAt: z.number().optional(),            // D-11: NoteFileSync timestamp
  summaryGeneratedAt: z.number().optional(),       // NoteMaintenance staleness
  tagsGeneratedAt: z.number().optional(),          // NoteMaintenance staleness
});
```

**New schemas to add** (from RESEARCH.md lines 467-484, 596-604):
```typescript
// NoteTaggerResultSchema — enrichment + memoryFacts partitions (D-01)
// NoteQAResultSchema — answer + citations[] (D-13)
// NoteDraftSchema — pre-filled note draft from NoteChatConverter
```

**Existing NoteProvenance source already includes `'chat-conversion'`** (line 8) — no change needed for NoteChatConverter.

---

### 8. `src/core/notes/NotesDB.ts` (modify — CRUD)

**Analog:** `src/core/notes/NotesDB.ts` (existing methods lines 49-211)

**Update database version** — openNotesDb() line 17: change from 4 to 5:
```typescript
// Before (line 17):
await migrationRunner.migrate('NotesDB', 4);
dbPromise = openDB('NotesDB', 4);

// After:
await migrationRunner.migrate('NotesDB', 5);
dbPromise = openDB('NotesDB', 5);
```

**Add query method** (pattern from existing `getAll()` lines 154-157):
```typescript
/** Query notes by lastSyncedAt — used by NoteFileSync for external-change detection (D-11). */
async getByLastSyncedAt(id: string): Promise<number | undefined> {
  const existing = await this.get(id);
  if (existing.success) {
    return existing.note.lastSyncedAt;
  }
  return undefined;
}

/** Update only the lastSyncedAt field after a successful file sync (D-11). */
async updateLastSyncedAt(id: string, timestamp: number): Promise<void> {
  const db = await openNotesDb();
  const existing = await this.get(id);
  if (!existing.success) return;
  const updated: Note = { ...existing.note, lastSyncedAt: timestamp };
  await db.put('notes', updated);
}
```

**Extend types.ts** — add new result types (from existing pattern lines 1-40):
```typescript
export type NoteTaggerResult = { ... };
export type NoteQAResult = { ... };
export type NoteDraft = { ... };
```

---

### 9. `src/core/storage/MigrationRunner.ts` (modify — migration)

**Analog:** `src/core/storage/MigrationRunner.ts` (existing migrateV4 lines 66-134)

**Add v5 migration step in upgrade()** (from lines 29-31):
```typescript
// In the upgrade callback, add after the v4 block:
if (oldVersion < 5) {
  await this.migrateV5(transaction);
}
```

**migrateV5 method** (from migrateV4 pattern lines 66-134):
```typescript
private async migrateV5(
  transaction: VersionChangeTransaction,
): Promise<void> {
  const db = transaction.db;

  // Add backup_config store for FileSystemDirectoryHandle (D-09)
  if (!db.objectStoreNames.contains('backup_config')) {
    db.createObjectStore('backup_config', { keyPath: 'id' });
  }
}
```

**Update target version** in migrate() default call — but NOT in MigrationRunner itself (NotesDB's openNotesDb() handles this by calling migrate('NotesDB', 5)).

---

### 10-15. Test Files (6 files)

**Test analog:** `tests/core/notes/NotesDB.test.ts` (lines 1-167)

**Common import + setup pattern** (from NotesDB.test.ts lines 1-6, 26-29):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetNotesDb } from '../../../src/core/notes/NotesDB';
import { resetJournalDb } from '../../../src/core/storage/WriteJournal';

describe('ClassName', () => {
  beforeEach(async () => {
    await resetNotesDb();
    await resetJournalDb();
  });

  it('describes behavior', async () => {
    // arrange + act + assert
    expect(result).toEqual({ success: true });
  });
});
```

**Specific test patterns per file:**

**LlmService.test.ts** — follow `tests/core/ai/StructuredOutput.test.ts` (lines 1-51):
```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { getLlmService } from '../../../src/core/ai/LlmService';
import { PipelineError } from '../../../src/core/ai/PipelineError';
// Test: Zod validation, provider resolution, abort propagation
```

**NoteTagger.test.ts** — follow `tests/core/notes/NotesDB.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getNoteTagger, resetNoteTagger } from '../../../src/core/notes/NoteTagger';
import { resetNotesDb } from '../../../src/core/notes/NotesDB';
// Test: enrichment returns (tags ≤5, categoryPath, summary, concepts)
// Test: memoryFacts (≤5, confidence ≥0.3 filtered)
// Test: stale suggestions discarded (version mismatch)
// Test: skips LLM call when all toggles off (D-06)
```

**NoteQA.test.ts** — follow `tests/core/notes/NotesDB.test.ts`:
```typescript
// Test: search mode reranks top-10
// Test: ask mode returns cited answer with citations array
// Test: tiny mode returns raw results without LLM call
// Test: citation parsing (parseCitations function)
```

**NoteChatConverter.test.ts** — follow `tests/core/notes/NotesDB.test.ts`:
```typescript
// Test: draft returns title, content, tags, categoryPath, wikilinks
```

**NoteFileSync.test.ts** — follow `tests/core/notes/NotesDB.test.ts`:
```typescript
// Test: YAML frontmatter generation (id, title, created, updated, tags, categoryPath, summary)
// Test: filename sanitization (/\\:*?"<>| → _)
// Test: collision suffixing (numeric)
// Test: permission check (mocked queryPermission)
// Test: external-change detection (lastModified > lastSyncedAt + 2s)
// Test: restore parses .md files, additive upsert
// NOTE: Mock File System Access API interfaces (FileSystemDirectoryHandle, FileSystemFileHandle, etc.)
```

**NoteMaintenance.test.ts** — follow `tests/core/notes/NotesDB.test.ts`:
```typescript
// Test: getStaleNotes() — summaryGeneratedAt < updatedAt
// Test: getOrphanNotes() — 0 wikilinks + 0 backlinks
// Test: reanalyzeAll() — iterates all notes through NoteTagger
```

**vitest config** — already configured with jsdom + fake-indexeddb (vitest.config.ts lines 1-15):
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

---

## Shared Patterns

### Module-Level Singleton

**Source:** `src/core/memory/MemoryEngine.ts` (lines 442-463) + `src/core/notes/NoteGraph.ts` (lines 107-120)

**Apply to:** LlmService, NoteTagger, NoteQA, NoteChatConverter, NoteFileSync, NoteMaintenance

```typescript
// Option A (MemoryEngine style) — for services needing constructor params:
let _instance: ServiceName | null = null;
export function getServiceName(): ServiceName {
  if (!_instance) _instance = new ServiceName();
  return _instance;
}
export function resetServiceName(): void { _instance = null; }

// Option B (NoteGraph style) — for pure stateless services:
export class ServiceName {
  private static _instance: ServiceName | null = null;
  private constructor() {}
  static getInstance(): ServiceName { /* ... */ }
  static resetInstance(): void { ServiceName._instance = null; }
}
```

### EventBus Subscription

**Source:** `src/core/events/EventBus.ts` (lines 16-25)

**Apply to:** NoteTagger (note:saved), NoteFileSync (note:saved)

```typescript
import { on } from '../events/EventBus';

let unsub: (() => void) | null = null;

export function initHandler(): void {
  if (unsub) return; // idempotent — no double subscription
  unsub = on<{ noteId: string }>('note:saved', async ({ noteId }) => {
    // handler body — errors are swallowed by EventBus (line 33)
  });
}
```

### Error Handling — PipelineError

**Source:** `src/core/ai/PipelineError.ts` (lines 34-56)

**Apply to:** LlmService, NoteTagger (LLM calls), NoteQA (LLM calls), NoteChatConverter (LLM calls)

```typescript
import { PipelineError } from './PipelineError';
// Throw for LLM failures: new PipelineError('SCHEMA_INVALID', msg, diagnostic)
// Throw for aborts: new PipelineError('ABORTED', 'Request was aborted.', {})
// Throw for unknown: new PipelineError('UNKNOWN', msg, { originalError: String(err) })
```

### Discriminated Union Results

**Source:** `src/core/notes/types.ts` (lines 19-29) — `NoteFindResult`, `NoteSaveResult`

**Apply to:** NoteQA, NoteFileSync, NoteMaintenance (return success/error unions)

```typescript
type ServiceResult<T, E extends string = never> =
  | { success: true; data: T }
  | { success: false; error: string; code: E | 'DB_ERROR' | 'NOT_FOUND' | 'PERMISSION_DENIED' };
```

### IndexedDB Access with finally-close

**Source:** `src/core/notes/MiniSearchNoteIndex.ts` (lines 122-163)

**Apply to:** NoteFileSync (backup_config store operations)

```typescript
private async openDb(): Promise<IDBPDatabase> {
  await migrationRunner.migrate('NotesDB', 5);
  const db = await openDB('NotesDB', 5);
  return db;
}

async someOperation(): Promise<void> {
  const db = await this.openDb();
  try {
    // ...operation...
  } finally {
    db.close();
  }
}
```

### Zod Schema at Module Boundaries

**Source:** `src/core/notes/NoteSchema.ts` (lines 1-53)

**Apply to:** All new service files (NoteTaggerResultSchema, NoteQAResultSchema, NoteDraftSchema)

```typescript
import { z } from 'zod';
export const SomeSchema = z.object({ /* ... */ });
export type SomeType = z.infer<typeof SomeSchema>;
```

### Core Module Isolation

**Source:** Established convention (CONTEXT.md lines 143-144)

**Rule:** `src/core/notes/` and `src/core/ai/` must NOT import from `src/components/`. Services are pure backend/API layer.

---

## No Analog Found

| File | Role | Data Flow | Reason | Resolution |
|------|------|-----------|--------|------------|
| _(none)_ | — | — | All new files have close analogs in the existing codebase | — |

NoteFileSync's filesystem I/O is the most novel data flow, but the IndexedDB persistence patterns (from MiniSearchNoteIndex and NotesDB) and EventBus subscription (from EventBus) provide solid analogs for the surrounding infrastructure. The File System Access API calls themselves follow standard Chrome Dev docs patterns documented in RESEARCH.md.

---

## Metadata

**Analog search scope:** `src/core/ai/`, `src/core/notes/`, `src/core/memory/`, `src/core/events/`, `src/core/storage/`, `tests/core/`
**Files scanned for analogs:** 15 source files + 4 test files
**Pattern extraction date:** 2026-08-02
**Key patterns:**
1. Module-level singleton (`getServiceName()` / `resetServiceName()`)
2. EventBus subscription (`on('note:saved', handler)`)
3. Structured LLM output via `repairJSON()` + `generateWithRepair()`
4. IndexedDB `openDB()` with `finally { db.close() }`
5. Discriminated union results (`{ success, data } | { success, error, code }`)
6. Zod schema validation at module boundaries
7. MigrationRunner `oldVersion < N` upgrade steps
8. vitest + fake-indexeddb + jsdom test infrastructure
