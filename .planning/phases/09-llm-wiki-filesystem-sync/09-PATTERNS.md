# Phase 9: LLM-Wiki & Filesystem Sync - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 13 (5 new services + 1 schemas + 1 migration + 6 test files)
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/notes/NoteTagger.ts` | service | request-response | `src/core/ai/StructuredOutput.ts` + `src/core/memory/MemoryExtractor.ts` | exact |
| `src/core/notes/NoteQA.ts` | service | request-response | `src/core/search/MiniSearchIndex.ts` + `src/core/memory/MemoryEngine.ts` | exact |
| `src/core/notes/NoteChatConverter.ts` | service | transform | `src/core/memory/MemoryEngine.ts` + `src/core/notes/save.ts` | role-match |
| `src/core/notes/NoteFileSync.ts` | service | file-I/O | `src/core/storage/NotesDB.ts` + `src/core/notes/save.ts` | role-match |
| `src/core/notes/NoteMaintenance.ts` | service | batch | `src/core/notes/NoteGraph.ts` + `src/core/search/MiniSearchIndex.ts` | role-match |
| `src/core/notes/schemas.ts` | utility | transform | `src/core/memory/MemoryExtractor.ts` + `src/types/notes.ts` | exact |
| `src/core/storage/NotesDB.ts` (modified) | model | CRUD | `src/core/storage/IndexedDBMigrator.ts` | exact |
| `tests/core/notes/NoteTagger.test.ts` | test | — | `tests/core/notes/LinkParser.test.ts` | exact |
| `tests/core/notes/NoteQA.test.ts` | test | — | `tests/core/notes/LinkParser.test.ts` | exact |
| `tests/core/notes/NoteChatConverter.test.ts` | test | — | `tests/core/notes/LinkParser.test.ts` | exact |
| `tests/core/notes/NoteFileSync.test.ts` | test | — | `tests/core/notes/LinkParser.test.ts` | role-match |
| `tests/core/notes/NoteMaintenance.test.ts` | test | — | `tests/core/notes/NoteGraph.test.ts` | exact |
| `tests/core/storage/migrations/v4-notes-backup-config.test.ts` | test | — | `tests/core/storage/IndexedDBMigrator.test.ts` | exact |

## Pattern Assignments

### `src/core/notes/NoteTagger.ts` (service, request-response)

**Primary analog:** `src/core/ai/StructuredOutput.ts` (lines 1-107)
**Secondary analog:** `src/core/memory/MemoryExtractor.ts` (lines 1-78), `src/core/ai/TierResolver.ts` (lines 1-120)

**Imports pattern** (from StructuredOutput.ts lines 1-6 + MemoryExtractor.ts lines 7-8):
```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ProviderId } from '../ai/types';
import { requestJson } from '../ai/StructuredOutput';
import { resolveTier } from '../ai/TierResolver';
import { ProviderRegistry } from '../ai/ProviderRegistry';
import { debugLog } from '../log/debugLog';
```

**Core LLM invoke pattern** (from StructuredOutput.ts lines 37-90 + TierResolver.ts lines 67-119):
```typescript
// 1. Resolve tier → concrete (providerId, model)
const resolution = resolveTier('fast');
if (!resolution) throw new Error('FAST_TIER_UNCONFIGURED');

// 2. Build prompt with note content
const prompt = `Analyze this note and return structured JSON...`;

// 3. Call requestJson with Zod schema + timeout + abort
const result = await requestJson(NoteTagResultSchema, prompt, {
  operationId,
  providerId: resolution.providerId,
  model: resolution.model,
  timeoutMs: 15_000,
  callProviderJsonMode: (p, schema, signal) =>
    provider.requestJson(p, schema, signal),
  abortSignal,
});
```

**Schema definition pattern** (from MemoryExtractor.ts lines 14-21):
```typescript
export const NoteTagResultSchema = z.object({
  tags: z.array(z.object({
    value: z.string(),
    confidence: z.number().min(0).max(1),
  })).max(10),
  categoryPath: z.string().nullable(),
  summary: z.string(),
  memoryFacts: z.array(memoryFactsSchema).max(10).default([]),
});

export type NoteTagResult = z.infer<typeof NoteTagResultSchema>;
```

**Non-blocking post-save pattern** (from MiniSearchIndex.ts lines 108-135):
```typescript
// Subscribe to note:saved event, fire-and-forget analysis
const unsub = on<NoteSavedPayload>(NOTE_SAVED_EVENT, (payload) => {
  void (async () => {
    try {
      const db = await openNotesDB();
      const note = await db.get('notes', payload.noteId);
      if (note) {
        const capturedVersion = note.version;
        const result = await analyzeNote(note, operationId, abortSignal);
        // Discard stale suggestions (LLM-WIKI-11)
        const current = await db.get('notes', payload.noteId);
        if (current?.version !== capturedVersion) return;
        // Apply gated suggestions...
      }
    } catch {
      // Swallow — EventBus handlers must not throw.
    }
  })();
});
```

**Error handling pattern** (from StructuredOutput.ts lines 22-35):
```typescript
// StructuredOutputError carries retryable=false for terminal failures
export class StructuredOutputError extends Error {
  readonly code = STRUCTURED_OUTPUT_FAILED;
  readonly retryable = false;
  readonly raw: { first: string; second: string };
}
```

---

### `src/core/notes/NoteQA.ts` (service, request-response)

**Primary analog:** `src/core/search/MiniSearchIndex.ts` (lines 1-155)
**Secondary analog:** `src/core/memory/MemoryEngine.ts` (lines 1-116), `src/core/ai/StructuredOutput.ts`

**Imports pattern** (from MiniSearchIndex.ts lines 14-23 + MemoryEngine.ts lines 14-20):
```typescript
import type { IDBPDatabase } from 'idb';
import type { NotesDBV1 } from '../storage/NotesDB';
import { openNotesDB } from '../storage/NotesDB';
import type { Note } from '../../types/notes';
import { query as miniSearchQuery, NoteHit } from './MiniSearchIndex';
import { MemoryEngine } from '../memory/MemoryEngine';
import { requestJson } from '../ai/StructuredOutput';
import { resolveTier } from '../ai/TierResolver';
```

**RAG retrieval + synthesis pattern** (from MiniSearchIndex.ts lines 85-90 + MemoryEngine.ts lines 110-115):
```typescript
export async function askNotes(query: string, db: IDBPDatabase<NotesDBV1>): Promise<NoteQAResult> {
  // Retrieval: MiniSearch top-5 (persistent notes index)
  const noteHits = await miniSearchQuery(db, query);
  // Memory facts: NMEM-01 — MemoryEngine.retrieveMemoryHints
  const memoryHints = await MemoryEngine.retrieveMemoryHints(query, { tier: 'balanced' });

  const context = [
    ...noteHits.map(h => ({ source: h.id, title: h.title, snippet: h.content.slice(0, 200) })),
    ...memoryHints.map(h => ({ source: `memory:${h.id}`, title: h.type, snippet: h.content })),
  ];

  // Balanced-tier synthesis with per-statement citations
  const resolution = resolveTier('balanced');
  if (!resolution) {
    // Tiny mode fallback: plain MiniSearch results, no LLM
    return { answer: null, citations: [], fallback: true };
  }

  const synthesis = await requestJson(NoteQAResultSchema, buildSynthesisPrompt(query, context), {
    operationId: generateOperationId(),
    providerId: resolution.providerId,
    model: resolution.model,
    timeoutMs: 25_000,
    callProviderJsonMode: (p, schema, signal) => provider.requestJson(p, schema, signal),
    abortSignal,
  });

  return synthesis;
}
```

**Module state pattern** (from MiniSearchIndex.ts lines 67-83):
```typescript
// Module-level state (per-surface singleton)
let cachedResult: NoteQAResult | null = null;

export const __test__ = {
  reset(): void {
    cachedResult = null;
  },
};

export const NoteQA = { askNotes, __test__ };
```

---

### `src/core/notes/NoteChatConverter.ts` (service, transform)

**Primary analog:** `src/core/memory/MemoryEngine.ts` (lines 33-115)
**Secondary analog:** `src/core/notes/save.ts` (lines 1-43), `src/core/notes/LinkParser.ts`

**Imports pattern** (from save.ts lines 9-14 + MemoryEngine.ts lines 14-19):
```typescript
import type { IDBPDatabase } from 'idb';
import type { NotesDBV1 } from '../storage/NotesDB';
import type { Note } from '../../types/notes';
import { MemoryEngine } from '../memory/MemoryEngine';
import { parseLinks } from './LinkParser';
import { debugLog } from '../log/debugLog';
```

**Draft generation pattern** (from MemoryEngine.ts lines 89-101 + save.ts lines 32-42):
```typescript
export interface NoteDraft {
  title: string;
  content: string;
  tags: string[];
  wikilinks: string[];
  categoryPath: string | null;
  summary: string;
}

export async function draftFromChat(
  messages: Array<{ role: string; content: string }>,
  memoryContext?: string,
): Promise<NoteDraft> {
  // NMEM-03: Use MemoryEngine.assemble() for memory context
  const memoryFacts = memoryContext ?? await MemoryEngine.assemble();

  const prompt = `Convert this conversation into a structured note draft.
Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Memory context:
${memoryFacts}

Return JSON: { title, content, tags[], wikilinks[], categoryPath, summary }`;

  const resolution = resolveTier('fast');
  if (!resolution) throw new Error('FAST_TIER_UNCONFIGURED');

  const draft = await requestJson(NoteDraftSchema, prompt, {
    operationId: generateOperationId(),
    providerId: resolution.providerId,
    model: resolution.model,
    timeoutMs: 15_000,
    callProviderJsonMode: (p, schema, signal) => provider.requestJson(p, schema, signal),
    abortSignal,
  });

  return draft;
}
```

**Object-form namespace export** (from MemoryEngine.ts lines 33, 115):
```typescript
export const NoteChatConverter = {
  draftFromChat,
  __test__ };
```

---

### `src/core/notes/NoteFileSync.ts` (service, file-I/O)

**Primary analog:** `src/core/storage/NotesDB.ts` (lines 1-89)
**Secondary analog:** `src/core/notes/save.ts` (lines 1-43)

**Imports pattern** (from NotesDB.ts lines 23-24 + save.ts lines 9-11):
```typescript
import type { IDBPDatabase } from 'idb';
import type { NotesDBV1 } from '../storage/NotesDB';
import { openNotesDB } from '../storage/NotesDB';
import type { Note } from '../../types/notes';
import { stringify, parse } from 'yaml';
import { on } from '../events/EventBus';
import { NOTE_SAVED_EVENT, type NoteSavedPayload } from '../notes/save';
import { debugLog } from '../log/debugLog';
```

**OKF frontmatter serialization** (from RESEARCH.md Pattern 2):
```typescript
interface OkfFrontmatter {
  type: string;
  title: string;
  description?: string;
  id: string;
  created: number;
  updated: number;
  tags?: string[];
  categoryPath?: string;
  generated: { by: string; at: string };
  status: 'draft' | 'stable';
}

export function serializeNoteToMarkdown(note: Note, tier: string): string {
  const fm: OkfFrontmatter = {
    type: note.type ?? 'Note',
    title: note.title,
    description: note.summary,
    id: note.id,
    created: note.created,
    updated: note.updated,
    tags: note.tags,
    categoryPath: note.categoryPath,
    generated: { by: `nowpilot/${tier}`, at: new Date().toISOString() },
    status: 'stable',
  };
  const yamlBlock = stringify(fm);
  return `---\n${yamlBlock}---\n\n${note.content}`;
}
```

**IDB handle persistence pattern** (from NotesDB.ts lines 56-76):
```typescript
// FileSystemDirectoryHandle persisted in notes_backup_config IDB store
async function getBackupHandle(db: IDBPDatabase<NotesDBV1>): Promise<FileSystemDirectoryHandle | null> {
  const tx = db.transaction('notes_backup_config', 'readonly');
  const store = tx.objectStore('notes_backup_config');
  const record = await store.get('backup_handle');
  if (!record) return null;
  const handle = record.handle as FileSystemDirectoryHandle;
  // SYNC-02: verify permission on access
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission !== 'granted') return null;
  return handle;
}

async function persistBackupHandle(db: IDBPDatabase<NotesDBV1>, handle: FileSystemDirectoryHandle): Promise<void> {
  const tx = db.transaction('notes_backup_config', 'readwrite');
  const store = tx.objectStore('notes_backup_config');
  await store.put({ key: 'backup_handle', handle });
  await tx.done;
}
```

**Debounced sync pattern** (from MiniSearchIndex.ts lines 108-135):
```typescript
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncTimestamp = 0;

function wireFileSync(): void {
  on<NoteSavedPayload>(NOTE_SAVED_EVENT, (payload) => {
    void (async () => {
      try {
        const db = await openNotesDB();
        const handle = await getBackupHandle(db);
        if (!handle) return; // SYNC-07: no handle → no-op

        // SYNC-03: 50ms debounce, fire-and-forget
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          void syncNoteToFilesystem(db, handle, payload.noteId);
        }, 50);
      } catch (err) {
        debugLog('NOTE_SYNC_ERROR', { noteId: payload.noteId, error: String(err) });
      }
    })();
  });
}
```

**Filename sanitization** (from RESEARCH.md Pattern 2):
```typescript
function sanitizeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function buildFilePath(note: Note): string {
  const folder = note.categoryPath ?? '';
  const filename = sanitizeFilename(note.title);
  return folder ? `${folder}/${filename}.md` : `${filename}.md`;
}
```

---

### `src/core/notes/NoteMaintenance.ts` (service, batch)

**Primary analog:** `src/core/notes/NoteGraph.ts` (lines 106-132)
**Secondary analog:** `src/core/search/MiniSearchIndex.ts` (lines 67-83)

**Imports pattern** (from NoteGraph.ts lines 17 + MiniSearchIndex.ts lines 14-22):
```typescript
import type { IDBPDatabase } from 'idb';
import type { NotesDBV1 } from '../storage/NotesDB';
import { openNotesDB } from '../storage/NotesDB';
import type { Note } from '../../types/notes';
import { computeBacklinks } from './NoteGraph';
import { debugLog } from '../log/debugLog';
```

**Staleness detection pattern** (from NoteGraph.ts lines 114-132):
```typescript
export interface StalenessResult {
  noteId: string;
  isStale: boolean;
  lastGenerated: number;
  noteUpdated: number;
}

export function detectStaleness(note: Note): StalenessResult {
  // LLM-WIKI-08: summaryGeneratedAt/tagsGeneratedAt vs updated comparison
  const lastGenerated = Math.max(note.summaryGeneratedAt ?? 0, note.tagsGeneratedAt ?? 0);
  return {
    noteId: note.id,
    isStale: lastGenerated > 0 && note.updated > lastGenerated,
    lastGenerated,
    noteUpdated: note.updated,
  };
}
```

**Orphan detection pattern** (from NoteGraph.ts lines 114-132):
```typescript
export function detectOrphans(notes: Note[]): string[] {
  const backlinks = computeBacklinks(notes);
  const orphans: string[] = [];
  for (const note of notes) {
    // LLM-WIKI-09: 0 wikilinks + 0 backlinks → orphan
    const hasOutgoing = note.links.length > 0;
    const hasIncoming = (backlinks.get(note.id)?.length ?? 0) > 0;
    if (!hasOutgoing && !hasIncoming) orphans.push(note.id);
  }
  return orphans;
}
```

**Bulk analysis pattern** (user-initiated, sequential):
```typescript
export interface BulkAnalysisStats {
  processed: number;
  total: number;
  tagged: number;
  categorized: number;
  summarized: number;
  errors: number;
}

export async function reanalyzeAllNotes(
  onProgress: (stats: BulkAnalysisStats) => void,
  abortSignal: AbortSignal,
): Promise<BulkAnalysisStats> {
  const db = await openNotesDB();
  const notes = await db.getAll('notes');
  const stats: BulkAnalysisStats = { processed: 0, total: notes.length, tagged: 0, categorized: 0, summarized: 0, errors: 0 };

  for (const note of notes) {
    if (abortSignal.aborted) break;
    try {
      const result = await analyzeNote(note, generateOperationId(), abortSignal);
      // Apply results...
      stats.processed++;
      if (result.tags.length > 0) stats.tagged++;
      if (result.categoryPath) stats.categorized++;
      if (result.summary) stats.summarized++;
    } catch {
      stats.errors++;
    }
    onProgress({ ...stats });
  }
  return stats;
}
```

---

### `src/core/notes/schemas.ts` (utility, transform)

**Primary analog:** `src/core/memory/MemoryExtractor.ts` (lines 1-78)
**Secondary analog:** `src/types/notes.ts` (lines 1-81)

**Imports pattern** (from MemoryExtractor.ts lines 7-8 + notes.ts lines 1-17):
```typescript
import { z } from 'zod';
import type { Note } from '../../types/notes';
import {
  NOTE_SUGGESTION_DISPLAY_THRESHOLD,
  NOTE_SUGGESTION_MAX_TAGS_PER_SAVE,
  NOTE_SUGGESTION_MAX_FACTS_PER_SAVE,
} from '../../types/notes';
```

**Schema definition pattern** (from MemoryExtractor.ts lines 14-21):
```typescript
// NoteTagResultSchema — single structured JSON output
export const NoteTagResultSchema = z.object({
  tags: z.array(z.object({
    value: z.string(),
    confidence: z.number().min(0).max(1),
  })).max(10),
  categoryPath: z.string().nullable(),
  summary: z.string(),
  memoryFacts: z.array(z.object({
    content: z.string(),
    confidence: z.number().min(0).max(1),
  })).max(10).default([]),
});

// NoteQAResultSchema — RAG synthesis output
export const NoteQAResultSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({
    noteId: z.string(),
    title: z.string(),
    snippet: z.string(),
  })).max(5),
  confidence: z.number().min(0).max(1),
});

// NoteDraftSchema — chat-to-note draft
export const NoteDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  wikilinks: z.array(z.string()).default([]),
  categoryPath: z.string().nullable(),
  summary: z.string().optional(),
});
```

**Suggestion gating pattern** (from RESEARCH.md Pattern LLM-WIKI-11):
```typescript
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

---

### `src/core/storage/NotesDB.ts` (modified — v4 migration)

**Primary analog:** `src/core/storage/IndexedDBMigrator.ts` (lines 52-157)
**Secondary analog:** `tests/core/storage/IndexedDBMigrator.test.ts` (lines 43-178)

**Schema extension pattern** (from NotesDB.ts lines 43-54):
```typescript
export interface NotesDBV1 extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { byTitle: string; byUpdated: number };
  };
  concepts: {
    key: string;
    value: Concept;
    indexes: { byLabel: string };
  };
  // v4: notes_backup_config for FileSystemDirectoryHandle (SYNC-01)
  notes_backup_config: {
    key: string;
    value: { key: string; handle: FileSystemDirectoryHandle };
  };
}
```

**Migration registration pattern** (from IndexedDBMigrator.test.ts lines 60-70, 83-92):
```typescript
import { registerMigration } from './IndexedDBMigrator';

registerMigration('NotesDB', {
  fromVersion: 1,
  toVersion: 4,
  description: 'Add notes_backup_config store; populate Note.type; add tags/summary to search index',
  migrate: async (db, oldVersion) => {
    // Idempotent: skip if already present
    if (!db.objectStoreNames.contains('notes_backup_config')) {
      db.createObjectStore('notes_backup_config', { keyPath: 'key' });
    }
    // Note.type population (idempotent — skip if already set)
    if (oldVersion < 4) {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      let cursor = await store.openCursor();
      while (cursor) {
        if (!cursor.value.type) {
          await cursor.update({ ...cursor.value, type: 'Note' });
        }
        cursor = await cursor.continue();
      }
      await tx.done;
    }
  },
});
```

**Version bump** (from NotesDB.ts line 27):
```typescript
export const NOTES_DB_VERSION = 4; // was 1 — v4 adds notes_backup_config + Note.type population
```

---

### `tests/core/storage/migrations/v4-notes-backup-config.test.ts` (test)

**Primary analog:** `tests/core/storage/IndexedDBMigrator.test.ts` (lines 1-180)

**Test structure pattern** (from IndexedDBMigrator.test.ts lines 1-48):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { DBSchema } from 'idb';

describe('v4 NotesDB migration — notes_backup_config store + Note.type population', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    const migrator = await import('../../../src/core/storage/IndexedDBMigrator');
    migrator.clearMigrations('NotesDB');
  });

  it('(1) idempotent: opening the migrated DB twice does not throw or duplicate stores', async () => {
    // Register v1→v4 migration, open twice, assert no error
  });

  it('(2) fresh-open-at-v4: notes_backup_config store exists', async () => {
    // Open at v4 directly, assert store exists
  });

  it('(3) backward-compatible: v1 data retained after upgrade to v4', async () => {
    // Open at v1, write data, upgrade to v4, assert data intact
  });

  it('(4) Note.type populated with default "Note" when missing', async () => {
    // Write note without type, migrate, assert type === 'Note'
  });

  it('(5) Note.type NOT overwritten when already set', async () => {
    // Write note with type='Concept', migrate, assert type still 'Concept'
  });
});
```

---

### `tests/core/notes/NoteTagger.test.ts` (test)

**Primary analog:** `tests/core/notes/LinkParser.test.ts` (lines 1-182)

**Test structure pattern** (from LinkParser.test.ts lines 10-43, 150-181):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { IDBPDatabase } from 'idb';
import { openNotesDB, type NotesDBV1 } from '@/core/storage/NotesDB';
import type { Note } from '@/core/storage/NotesDB';
import { on } from '@/core/events/EventBus';
import { NOTE_SAVED_EVENT, type NoteSavedPayload } from '@/core/notes/save';

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: over.id ?? 'note-1',
    title: over.title ?? 'Note',
    content: over.content ?? '',
    created: over.created ?? 1000,
    updated: over.updated ?? 1000,
    tags: over.tags ?? [],
    links: over.links ?? [],
    unresolvedLinks: over.unresolvedLinks ?? [],
    source: over.source ?? { kind: 'manual' },
    aiMeta: over.aiMeta ?? { suggestedLinks: [], concepts: [] },
    version: over.version ?? 1,
    ...over,
  };
}

describe('NoteTagger', () => {
  let db: IDBPDatabase<NotesDBV1>;
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    db = await openNotesDB();
  });

  it('(1) LLM-WIKI-01: single call returns structured JSON with tags+category+summary', async () => {
    // Mock provider, call analyzeNote, assert shape
  });

  it('(2) LLM-WIKI-11: suggestions below 0.60 confidence are discarded', () => {
    // Call gateSuggestions with mixed confidence, assert filtering
  });

  it('(3) LLM-WIKI-11: max 5 tags / 3 facts per save', () => {
    // Call gateSuggestions with excess items, assert cap
  });

  it('(4) NMEM-02: memoryFacts routed through MemoryEngine on primary surface', async () => {
    // Mock isPrimaryWriter=true, trigger analyze, assert MemoryEngine.upsert called
  });

  it('(5) stale suggestions discarded when note edited before async return', async () => {
    // Capture version, edit note, deliver stale result, assert discarded
  });
});
```

---

### `tests/core/notes/NoteQA.test.ts` (test)

**Primary analog:** `tests/core/notes/LinkParser.test.ts` (lines 10-43)

**Test structure pattern:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { IDBPDatabase } from 'idb';
import { openNotesDB, type NotesDBV1 } from '@/core/storage/NotesDB';
import type { Note } from '@/core/storage/NotesDB';

describe('NoteQA', () => {
  let db: IDBPDatabase<NotesDBV1>;
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    db = await openNotesDB();
  });

  it('(1) LLM-WIKI-06: balanced-tier synthesis returns cited answer', async () => {
    // Seed notes, mock provider, call askNotes, assert citations
  });

  it('(2) LLM-WIKI-06: tiny mode falls back to plain MiniSearch (no LLM)', async () => {
    // Mock resolveTier('balanced') → null, assert fallback=true
  });

  it('(3) NMEM-01: memory hints included in RAG context', async () => {
    // Mock MemoryEngine.retrieveMemoryHints, assert context includes memory
  });

  it('(4) MiniSearch top-5 retrieval feeds synthesis', async () => {
    // Seed 10 notes, assert only top-5 used in context
  });
});
```

---

### `tests/core/notes/NoteFileSync.test.ts` (test)

**Primary analog:** `tests/core/notes/LinkParser.test.ts` (lines 10-43)

**Test structure pattern:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

// Mock File System Access API
const mockFileSystem = new Map<string, string>();

describe('NoteFileSync', () => {
  beforeEach(() => {
    mockFileSystem.clear();
    // Inject mock FileSystemDirectoryHandle
  });

  it('(1) SYNC-04: OKF v0.2 frontmatter round-trip', () => {
    const note = makeNote({ title: 'Test', content: 'Body', tags: ['a', 'b'] });
    const md = serializeNoteToMarkdown(note, 'fast');
    const { frontmatter, body } = parseNoteFromMarkdown(md);
    expect(frontmatter.id).toBe(note.id);
    expect(frontmatter.title).toBe(note.title);
    expect(body).toBe(note.content);
  });

  it('(2) SYNC-05: title collision → numeric suffix', async () => {
    // Write "Test.md", write again, assert "Test (1).md"
  });

  it('(3) SYNC-09: restore preserves UUID identity + wikilinks', async () => {
    // Serialize note with [[Link]], parse back, assert id + content preserved
  });

  it('(4) SYNC-06: external-change guard (2s tolerance)', async () => {
    // Write file, modify externally within 2s, assert no conflict dialog
  });

  it('(5) WIKI-ID-01: UUID identity preserved on round-trip', () => {
    const note = makeNote({ id: 'uuid-123' });
    const md = serializeNoteToMarkdown(note, 'fast');
    const { frontmatter } = parseNoteFromMarkdown(md);
    expect(frontmatter.id).toBe('uuid-123');
  });
});
```

---

### `tests/core/notes/NoteChatConverter.test.ts` (test)

**Primary analog:** `tests/core/notes/LinkParser.test.ts` (lines 10-43)

**Test structure pattern:**
```typescript
import { describe, it, expect } from 'vitest';

describe('NoteChatConverter', () => {
  it('(1) LLM-WIKI-07: chat messages → structured note draft', async () => {
    const messages = [
      { role: 'user', content: 'What is ServiceNow?' },
      { role: 'assistant', content: 'ServiceNow is a cloud platform...' },
    ];
    const draft = await draftFromChat(messages);
    expect(draft.title).toBeTruthy();
    expect(draft.content).toBeTruthy();
  });

  it('(2) NMEM-03: memory context enriches draft', async () => {
    const memoryContext = 'User prefers concise answers';
    const draft = await draftFromChat(messages, memoryContext);
    // Assert memory context influenced the draft
  });

  it('(3) draft includes wikilinks from content', async () => {
    const messages = [{ role: 'assistant', content: 'See [[ServiceNow]] and [[ITSM]]' }];
    const draft = await draftFromChat(messages);
    expect(draft.wikilinks).toContain('ServiceNow');
    expect(draft.wikilinks).toContain('ITSM');
  });
});
```

---

### `tests/core/notes/NoteMaintenance.test.ts` (test)

**Primary analog:** `tests/core/notes/NoteGraph.test.ts` (pattern)

**Test structure pattern:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { IDBPDatabase } from 'idb';
import { openNotesDB, type NotesDBV1 } from '@/core/storage/NotesDB';
import type { Note } from '@/core/storage/NotesDB';

describe('NoteMaintenance', () => {
  let db: IDBPDatabase<NotesDBV1>;
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    db = await openNotesDB();
  });

  it('(1) LLM-WIKI-08: staleness detected when updated > summaryGeneratedAt', () => {
    const note = makeNote({ updated: 2000, summaryGeneratedAt: 1000 });
    expect(detectStaleness(note).isStale).toBe(true);
  });

  it('(2) LLM-WIKI-08: not stale when summaryGeneratedAt >= updated', () => {
    const note = makeNote({ updated: 1000, summaryGeneratedAt: 2000 });
    expect(detectStaleness(note).isStale).toBe(false);
  });

  it('(3) LLM-WIKI-09: orphan = 0 links + 0 backlinks', async () => {
    const notes = [
      makeNote({ id: 'a', links: [] }),
      makeNote({ id: 'b', links: ['a'] }),
    ];
    const orphans = detectOrphans(notes);
    expect(orphans).toContain('b'); // b links to a, but nothing links to b
    expect(orphans).not.toContain('a'); // a has incoming from b
  });

  it('(4) LLM-WIKI-10: bulk re-analyze is sequential with progress', async () => {
    // Seed 3 notes, call reanalyzeAllNotes, assert progress callback fires
  });
});
```

---

## Shared Patterns

### Structured LLM Call (NoteTagger + NoteQA)
**Source:** `src/core/ai/StructuredOutput.ts` (lines 37-90)
**Apply to:** NoteTagger.ts, NoteQA.ts

All structured LLM calls follow the same pattern:
1. `resolveTier('fast' | 'balanced')` → concrete `(providerId, model)`
2. Build prompt string with context
3. `requestJson(Schema, prompt, { operationId, providerId, model, timeoutMs, callProviderJsonMode, abortSignal })`
4. Zod schema validates the parsed result

### EventBus Subscription (NoteTagger + NoteFileSync)
**Source:** `src/core/search/MiniSearchIndex.ts` (lines 108-135)
**Apply to:** NoteTagger.ts, NoteFileSync.ts

Post-save async work subscribes to `NOTE_SAVED_EVENT`:
```typescript
on<NoteSavedPayload>(NOTE_SAVED_EVENT, (payload) => {
  void (async () => {
    try { /* async work */ } catch { /* swallow */ }
  })();
});
```

### Object-Form Namespace Export
**Source:** `src/core/memory/MemoryEngine.ts` (line 33), `src/core/search/MiniSearchIndex.ts` (line 155)
**Apply to:** All new services

```typescript
export const ServiceName = {
  methodA,
  methodB,
  __test__ };
```

### Test Reset Pattern
**Source:** `tests/setup.ts` (lines 9-11), `tests/core/notes/LinkParser.test.ts` (line 70)
**Apply to:** All test files

```typescript
beforeEach(async () => {
  (globalThis as any).__resetIndexedDB();
  db = await openNotesDB();
});
```

### Zod Schema Definition
**Source:** `src/core/memory/MemoryExtractor.ts` (lines 14-21)
**Apply to:** schemas.ts

```typescript
export const SomeSchema = z.object({
  field: z.string(),
  confidence: z.number().min(0).max(1),
});
export type SomeType = z.infer<typeof SomeSchema>;
```

### IDB Store Access
**Source:** `src/core/storage/NotesDB.ts` (lines 56-76)
**Apply to:** NoteFileSync.ts, v4 migration

```typescript
const tx = db.transaction('store_name', 'readwrite');
const store = tx.objectStore('store_name');
await store.put({ key: 'id', value: data });
await tx.done;
```

### Error Handling with debugLog
**Source:** `src/core/memory/MemoryExtractor.ts` (lines 66-70), `src/core/ai/ProviderRouter.ts` (lines 116-118)
**Apply to:** All new services

```typescript {
  debugLog('ERROR_CODE', 'descriptive message', {
    contextField: value,
  });
}
```

### Primary Surface Gate (NMEM-02)
**Source:** `src/core/workspace/WorkspaceStore.ts` (isPrimaryWriter — Phase 1 returns true)
**Apply to:** NoteTagger.ts (NMEM-02 fact routing)

```typescript
import { WorkspaceStore } from '../workspace/WorkspaceStore';

if (WorkspaceStore.isPrimaryWriter()) {
  await MemoryEngine.upsert(facts);
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/notes/NoteFileSync.ts` (FS Access API parts) | service | file-I/O | No existing File System Access API usage in codebase; must abstract behind injectable interface for testing |
| `tests/core/notes/NoteFileSync.test.ts` (FS mocking) | test | — | No existing FS mock pattern; must create mock FileSystemDirectoryHandle |

---

## Metadata

**Analog search scope:** `src/core/ai/`, `src/core/memory/`, `src/core/storage/`, `src/core/search/`, `src/core/notes/`, `src/core/events/`, `src/types/`, `tests/core/notes/`, `tests/core/storage/`
**Files scanned:** 15
**Pattern extraction date:** 2026-09-01
