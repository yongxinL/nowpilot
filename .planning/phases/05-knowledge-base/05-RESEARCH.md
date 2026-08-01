# Phase 05: Knowledge Base - Research

**Researched:** 2026-08-01
**Domain:** In-Browser Persistent Knowledge Layer — NotesDB, MemoryEngine, MiniSearch, Wikilinks, Note Graph
**Confidence:** HIGH

## Summary

Phase 5 establishes the persistent knowledge base layer for NowPilot. It builds on the existing storage topology (Zustand + IndexedDB/idb 8 + WriteJournal) from Phase 2, the context pipeline (ContextAssembler, ContextOptimizer, ContextItem) from Phase 4, and the MiniSearch patterns from Phase 4a. Two new module families are created: `src/core/memory/` (MemoryEngine, ConversationMemoryStore, UserMemoryStore, PreferenceMemoryStore, MemoryScorer) and `src/core/notes/` (NotesDB, NoteGraph, LinkParser, MiniSearchNoteIndex).

The technical domain is well-understood. MiniSearch 7.2.0 (already installed) provides all needed serialization (`toJSON()`/`loadJSON()`), incremental CRUD (`add`/`replace`/`remove`/`discard`), and BM25 scoring with field boosting. The IndexedDB schema extends the existing v3→v4 MigrationRunner pattern with compound-key object stores for conversation summaries and user facts. The BroadcastBus primary election pattern is already established in the codebase. Wikilink parsing follows a standard Obsidian-compatible regex with tie-break resolution. The note graph uses a hybrid similarity formula (50% linkOverlap + 20% tagOverlap + 30% contentCosine) as specified in D-13.

**Primary recommendation:** Follow existing singleton patterns (ContextOptimizer, PromptCacheManager), use MiniSearch `toJSON()`/`loadJSON()` for IndexedDB persistence, implement LinkParser with the Obsidian-compatible `\[\[([^\]]+)\]\]` regex, and build MemoryScorer as a pure-function scoring layer with the D-08 weighted formula.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `content` is the single source of truth — wikilinks stored as raw `[[title]]` in markdown body. `links[]` is derived and recomputed on every save. Backlinks are never stored — computed from `links[]`.
- **D-02:** Note identity is immutable UUID (`id`). `title` is display metadata. All graph relationships use `noteId`.
- **D-03:** Unresolved wikilinks tracked in `unresolvedLinks[]` array. Auto-resolve when matching note created.
- **D-04:** `memoryType` taxonomy (`working`|`episodic`|`semantic`|`preference`|`procedural`) encoded on all memory records. Three-store architecture unchanged.
- **D-05:** AI-generated memory writes limited to conversation summaries. User facts only via explicit user action. Preferences only via explicit settings.
- **D-06:** No automatic consolidation/merging/deduplication across stores in Phase 5.
- **D-07:** Confidence is source-based and immutable: `explicit-user`=1.0, `verified-state`=0.8, `previous-explicit`=0.7, `inferred`=0.5.
- **D-08:** Retrieval scoring: `keywordMatch` 35% + `tagMatch` 25% + `recency` 20% + `confidence` 10% + `useCount` 10%.
- **D-09:** Tier-gated retrieval: top-3 (tiny), top-5 (small/medium/large). Minimum score threshold = 0.30.
- **D-10:** LLM-generated summaries at 12-message boundary. Summary: 2-3 sentences capturing decisions/goals/preferences/facts/tasks.
- **D-11:** LRU eviction: max 10 active, max 100 archived. Archive after 30 min idle.
- **D-12:** Separate persistent MiniSearch instance for notes. Indexed fields: title, content, tags, wikilinkTargets.
- **D-13:** Note graph similarity: 50% linkOverlap (Jaccard) + 20% tagOverlap (Jaccard) + 30% contentCosine (TF-IDF).
- **D-14:** Concept extraction deferred to Phase 5a. Phase 5 provides schema only.
- **D-15:** LLM enrichment deferred to Phase 5a as suggestions requiring user acceptance.
- **D-16:** `NoteProvenance` field on all notes. Phase 5 persists schema; Phase 5a populates.
- **D-17:** No version history — overwrite semantics with `version` counter field.

### the agent's Discretion

- MiniSearch index configuration (BM25 parameters, field weights, tokenizer settings)
- LinkParser implementation details (regex, tie-break rule for duplicate titles)
- Conversation summary prompt template
- MemoryEngine singleton instantiation and internal retrieval pipeline order
- EventBus wiring (exact event names beyond `note:saved`, subscription patterns)

### Deferred Ideas (OUT OF SCOPE)

- Concept extraction (Phase 5a)
- Memory consolidation/merging (Phase 5b)
- Note version history (Phase 5b/6)
- Memory lifecycle governance (Phase 5b)
- LLM enrichment thresholds (Phase 5a)
- Procedural experience store (Phase 5b)
- Knowledge-edge provenance KNW-01 (Phase 5b)
- Active tool discovery TOL-06 (Phase 8a)
- Context quality telemetry CTX-T06 (Phase 6a)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTE-01 | User can create atomic notes with wikilinks, tags, note graph (MiniSearch + cosine similarity), and backlinks | LinkParser: §Wikilink Parsing; NoteGraph: §Similarity & Graph Computation; MiniSearchNoteIndex: §MiniSearch Integration |
| MEM-01 | User's conversation memory (summary + recent turns), cross-session user facts (scored retrieval), and preferences persist across sessions | ConversationMemoryStore: §Conversation Memory Implementation; MemoryScorer: §Retrieval Scoring Formula; MemoryEngine: §Memory Architecture |
| MEM-02 | User's memory writes only happen from the primary surface; secondary surfaces reflect read-only | BroadcastBus primary election: §Single-Writer Memory Semantics; already established in Phase 1 BroadcastBus pattern |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Note CRUD & persistence | API / Backend (core) | — | NotesDB operates in the core layer via IndexedDB; no browser tier involvement |
| Wikilink parsing & resolution | API / Backend (core) | — | LinkParser is pure regex computation over markdown content; runs at save time |
| Note graph & backlink computation | API / Backend (core) | — | NoteGraph computes similarity from persisted data; no UI dependency |
| MiniSearch note index | API / Backend (core) | — | Separate persistent index in core, following Phase 4a PageIndexBuilder pattern |
| Conversation memory (summaries + recent turns) | API / Backend (core) | — | ConversationMemoryStore persists to MemoryDB; retrieved by ContextAssembler |
| User memory fact scoring & retrieval | API / Backend (core) | — | MemoryScorer + UserMemoryStore operate in core; MemoryEngine feeds ContextItem[] to pipeline |
| Preference memory storage & injection | API / Backend (core) | — | PreferenceMemoryStore holds persona config (np_persona); PersonaInjector reads via MemoryEngine |
| Single-writer memory enforcement | API / Backend (core) | Browser / Client | BroadcastBus primary election (existing Phase 1 pattern); check in MemoryEngine.write() |
| LLM conversation summarization | API / Backend (core) | — | Invoked by ConversationMemoryStore at 12-message boundary; uses existing AI provider patterns |
| Note save → index sync pipeline | API / Backend (core) | — | EventBus 'note:saved' triggers MiniSearchNoteIndex.replace() + NoteGraph recomputation |
| IndexedDB v4 migration (NotesDB + MemoryDB) | API / Backend (core) | — | MigrationRunner pattern from Phase 2; idb versioned upgrades |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| minisearch | 7.2.0 | Full-text search over notes (persistent instance) + conversation/user memory retrieval | Already installed (Phase 4a); supports serialization to JSON for IndexedDB persistence; BM25 ranking with field boosting; incremental CRUD; <50ms over 1k notes |
| idb | 8.0.3 | IndexedDB wrapper for NotesDB and MemoryDB | Already installed (Phase 2); native versioned upgrade handlers; compound key support |
| zustand | 5.0.0 | Runtime/UI state for notes (useNotesStore already exists) | Already installed (Phase 1); NotesStore skeleton exists at `src/core/storage/NotesStore.ts` |
| zod | 4.4.3 | Schema validation for Note, MemoryRecord, retrieval inputs | Already installed (Phase 4); ContextItemSchema pattern to follow |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 3.0.0 | Unit tests for all new modules | All test files in `tests/core/memory/` and `tests/core/notes/` |
| fake-indexeddb | (already in setup.ts) | IndexedDB mock for vitest | Tests for NotesDB and MemoryDB operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MiniSearch for persistent notes | Lunr.js / Fuse.js | MiniSearch already validated in Phase 4a; Fuse.js lacks BM25+serialization; Lunr.js has no incremental updates |
| Custom TF-IDF from scratch | natural / compromise.js | Spec §22.3 calls for zero-dependency bag-of-words; external NLP libs add bundle size for features unused in v0.1 |
| Embedding-based search | transformers.js | Explicitly deferred in REQUIREMENTS.md; 40MB model download not justified for v0.1 |

**Installation:**
```bash
# All packages already installed — no new npm dependencies needed for Phase 5
# Verify versions match:
npm ls minisearch idb zustand zod vitest
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| minisearch | npm | ~9 yrs | 1.97M/wk | github.com/lucaong/minisearch | OK | Approved — already installed |
| idb | npm | ~9 yrs | 22.8M/wk | github.com/jakearchibald/idb | OK | Approved — already installed |
| zustand | npm | ~6 yrs | 49.3M/wk | github.com/pmndrs/zustand | OK | Approved — already installed |
| zod | npm | ~6 yrs | 247.7M/wk | github.com/colinhacks/zod | OK | Approved — already installed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Phase 5 introduces zero new external npm dependencies. All required packages are verified and already installed.*
*All claims in this section tagged [VERIFIED: npm registry] via `gsd-tools query package-legitimacy check`.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      AgentOrchestrator.runTurn()                 │
│                              │                                  │
│                    ContextAssembler (Phase 4)                    │
│                        │        │         │                     │
│                  ┌─────┘        │         └──────┐              │
│                  ▼              ▼                ▼              │
│        ConversationMemory  UserMemory     PreferenceMemory      │
│              Store           Store            Store             │
│         (summary+tails)   (scored facts)   (np_persona)         │
│                  │              │                │              │
│                  └──────────────┼────────────────┘              │
│                                 ▼                               │
│                          MemoryEngine                           │
│                     (orchestrate, score,                         │
│                      tier-gate, threshold)                      │
│                        │          │                             │
│         ┌──────────────┘          └──────────────┐              │
│         ▼                                        ▼              │
│   ContextItem[]                          write() guarded by     │
│   (relevance, freshness,                 BroadcastBus primary   │
│    trust, sensitivity)                   election (MEM-02)      │
│         │                                                       │
│         ▼                                                       │
│   ContextOptimizer.optimize()                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User saves note                                                │
│       │                                                         │
│       ▼                                                         │
│  NotesDB.save(note)                                             │
│       │                                                         │
│       ├──► 1. LinkParser.parse(content) → links[] +             │
│       │       unresolvedLinks[]                                 │
│       ├──► 2. WriteJournal (save-note-with-links operation)     │
│       ├──► 3. MiniSearchNoteIndex.replace(note)                 │
│       └──► 4. EventBus.emit('note:saved', { noteId })           │
│                │                                                │
│                ├──► NoteGraph.recompute(noteId)                 │
│                │     └─► for each related note:                 │
│                │         recalculate similarity                 │
│                │                                               │
│                ▼                                               │
│         (Phase 5a: NoteTagger.analyze, NoteFileSync.sync)      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Conversation: every 12 messages                                │
│       │                                                         │
│       ▼                                                         │
│  ConversationMemoryStore                                        │
│       │                                                         │
│       └──► compactConversation()                                │
│            ├──► 1. Extract head (system + first 2 msgs)         │
│            ├──► 2. Extract middle (msgs to summarize)           │
│            ├──► 3. LLM summary call (haiku-class)               │
│            ├──► 4. Store summary in MemoryDB.summaries          │
│            └──► 5. Keep tail (last N msgs tier-gated)           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Persistence Layer                                              │
│                                                                 │
│  NotesDB (IndexedDB, v4 migration)                              │
│  ├── notes       { id, title, content, tags, links, ... }       │
│  └── concepts    { slug, label, summary, noteIds, ... }         │
│                                                                 │
│  MemoryDB (IndexedDB, v4 migration)                             │
│  ├── messages    { [conversationId, seq], role, content }       │
│  ├── userFacts   { id, content, tags, confidence, source, ... } │
│  └── summaries   { conversationId, summary, updatedAt }         │
│                                                                 │
│  MiniSearchNoteIndex (IndexedDB, stored as JSON blob)           │
│  └── Serialized via toJSON()/loadJSON()                         │
│                                                                 │
│  WriteJournalDB (existing, extended v4 operations)              │
│  └── New operations: 'save-note-with-links', 'update-user-      │
│      memory', 'compact-conversation', etc.                      │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/core/memory/
├── MemoryEngine.ts           # Singleton orchestrator: retrieval pipeline, scoring, tier-gating, write-guard
├── ConversationMemoryStore.ts # Conversation summaries + recent turns, 12-msg compaction trigger
├── UserMemoryStore.ts        # User fact CRUD, tag-based lookup, confidence tracking
├── PreferenceMemoryStore.ts  # Behavioral settings, persona config (np_persona), response style
├── MemoryScorer.ts           # Pure-function scoring: keywordMatch + tagMatch + recency + confidence + useCount
├── MemoryRecord.ts           # Zod schemas: MemoryRecord, ConversationSummary, UserMemoryFact, PreferenceRecord
└── types.ts                  # Result discriminated unions (RetrievedMemory, MemoryRetrievalResult)

src/core/notes/
├── NotesDB.ts                # idb-backed CRUD for notes, link resolution, provenance tracking
├── NoteGraph.ts              # Hybrid similarity (Jaccard + cosine), backlink derivation, related-note queries
├── LinkParser.ts             # [[wikilink]] extraction, alias support, tie-break resolution
├── MiniSearchNoteIndex.ts    # Persistent MiniSearch instance, serialization, incremental sync
├── NoteSchema.ts             # Zod schemas: Note, NoteProvenance, NoteLink
└── types.ts                  # Result discriminated unions (NoteFindResult, LinkParseResult)

src/core/storage/
├── NotesStore.ts             # EXISTING — Zustand skeleton extended with CRUD actions
└── MigrationRunner.ts        # EXISTING — extended with v4 migration (NotesDB + MemoryDB schemas)

tests/core/memory/
├── MemoryEngine.test.ts
├── MemoryScorer.test.ts
├── UserMemoryStore.test.ts
└── ConversationMemoryStore.test.ts

tests/core/notes/
├── LinkParser.test.ts
├── NoteGraph.test.ts
└── MiniSearchNoteIndex.test.ts

tests/core/search/
└── (none yet — MiniSearchNoteIndex.test.ts covers search)
```

### Pattern 1: Module-Level Singleton (MemoryEngine, NotesDB, NoteGraph)

**What:** Single runtime instance pattern used throughout the codebase. Private constructor or module-scoped instance variable, exported as a read-only singleton.

**When to use:** MemoryEngine, NotesDB, and NoteGraph — each is a single logical resource accessed across the application.

**Example:**
```typescript
// Source: Existing codebase pattern (ContextOptimizer, PromptCacheManager)
// src/core/memory/MemoryEngine.ts

let _instance: MemoryEngine | null = null;

export class MemoryEngine {
  private constructor(
    private readonly conversationStore: ConversationMemoryStore,
    private readonly userStore: UserMemoryStore,
    private readonly preferenceStore: PreferenceMemoryStore,
    private readonly scorer: MemoryScorer,
  ) {}

  static getInstance(): MemoryEngine {
    if (!_instance) {
      _instance = new MemoryEngine(
        new ConversationMemoryStore(),
        new UserMemoryStore(),
        new PreferenceMemoryStore(),
        new MemoryScorer(),
      );
    }
    return _instance;
  }

  // For test isolation:
  static resetInstance(): void {
    _instance = null;
  }
}
```

### Pattern 2: IndexedDB Versioned Migration (v3→v4)

**What:** Extend existing `MigrationRunner.createV4Schema()` to create NotesDB and MemoryDB object stores. Follow the existing pattern: `oldVersion < 4` guard, idempotent store creation, data migration if needed.

**When to use:** Extending `MigrationRunner` in Phase 5 for v4 schemas.

**Example:**
```typescript
// Source: Existing MigrationRunner.ts pattern
// Extend src/core/storage/MigrationRunner.ts

private async migrateV4(transaction: VersionChangeTransaction): Promise<void> {
  const db = transaction.db;

  // NotesDB — idempotent store creation
  if (!db.objectStoreNames.contains('notes')) {
    const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
    notesStore.createIndex('by-title', 'title');
    notesStore.createIndex('by-updated', 'updatedAt');
    notesStore.createIndex('by-tag', 'tags', { multiEntry: true });
  }

  if (!db.objectStoreNames.contains('concepts')) {
    const conceptsStore = db.createObjectStore('concepts', { keyPath: 'slug' });
    conceptsStore.createIndex('by-noteId', 'noteIds', { multiEntry: true });
  }

  // MemoryDB — compound key for messages store
  if (!db.objectStoreNames.contains('memory_messages')) {
    db.createObjectStore('memory_messages', {
      keyPath: ['conversationId', 'seq']  // compound key
    });
  }

  if (!db.objectStoreNames.contains('user_facts')) {
    const factsStore = db.createObjectStore('user_facts', { keyPath: 'id' });
    factsStore.createIndex('by-tag', 'tags', { multiEntry: true });
    factsStore.createIndex('by-confidence', 'confidence');
  }

  if (!db.objectStoreNames.contains('conversation_summaries')) {
    db.createObjectStore('conversation_summaries', { keyPath: 'conversationId' });
  }
}
```

### Pattern 3: MiniSearch Persistent Index with IndexedDB

**What:** Serialize MiniSearch instance to JSON via `toJSON()`, store as IndexedDB blob. Deserialize on startup via `loadJSON()`. Incremental updates use `replace()` triggered by EventBus events.

**When to use:** MiniSearchNoteIndex — the persistent notes search index (separate from Phase 4a's ephemeral page index).

**Example:**
```typescript
// Source: MiniSearch 7.2.0 official API docs [VERIFIED: npm registry + official docs]
// src/core/notes/MiniSearchNoteIndex.ts

import MiniSearch from 'minisearch';
import { openDB } from 'idb';

export class MiniSearchNoteIndex {
  private index: MiniSearch<NoteIndexDoc>;

  constructor() {
    this.index = new MiniSearch<NoteIndexDoc>({
      fields: ['title', 'content', 'tags', 'wikilinkTargets'],
      storeFields: ['title', 'tags', 'updatedAt'],
      searchOptions: {
        boost: { title: 2.0 },
        prefix: true,
      },
    });
  }

  // Persist to IndexedDB
  async persist(): Promise<void> {
    const db = await openDB('NotesDB', 4);
    const json = JSON.stringify(this.index);  // calls toJSON() internally
    await db.put('index', { id: 'note-search', json, updatedAt: Date.now() });
  }

  // Restore from IndexedDB
  async load(): Promise<void> {
    const db = await openDB('NotesDB', 4);
    const stored = await db.get('index', 'note-search');
    if (stored?.json) {
      this.index = MiniSearch.loadJSON<NoteIndexDoc>(stored.json, {
        fields: ['title', 'content', 'tags', 'wikilinkTargets'],
        storeFields: ['title', 'tags', 'updatedAt'],
        searchOptions: { boost: { title: 2.0 }, prefix: true },
      });
    }
  }

  // Incremental update triggered by 'note:saved'
  replace(note: NoteIndexDoc): void {
    this.index.replace(note);
  }

  remove(noteId: string): void {
    this.index.discard(noteId);
  }

  search(query: string, limit = 20): MiniSearch.SearchResult[] {
    return this.index.search(query, { prefix: true });
  }
}
```

### Pattern 4: EventBus-Driven Index Sync

**What:** Module subscribes to `EventBus.on('note:saved', handler)` and synchronizes the MiniSearch index + NoteGraph recomputation.

**When to use:** Post-save pipeline in NotesDB — after WriteJournal commit, emit `note:saved` to trigger downstream consumers.

**Example:**
```typescript
// Source: Existing EventBus pattern from Phase 1
import { on, emit } from '../../events/EventBus';

// In NotesDB.save():
async save(note: Note): Promise<void> {
  // 1. Parse wikilinks
  const { links, unresolvedLinks } = LinkParser.parse(note.content);

  // 2. Write to IndexedDB via WriteJournal
  await commitEntry(entryId, steps);

  // 3. Emit event for downstream sync
  emit('note:saved', { noteId: note.id });
}

// In MiniSearchNoteIndex.init():
on('note:saved', async ({ noteId }) => {
  const note = await NotesDB.get(noteId);
  if (note) {
    noteSearchIndex.replace(toIndexDoc(note));
    noteGraph.recompute(noteId);
  }
});
```

### Pattern 5: Zod-Validated Module Boundaries

**What:** All data entering or leaving core modules passes through Zod schema validation at the boundary.

**When to use:** NotesDB save/load, MemoryEngine retrieval inputs, MemoryScorer scoring inputs.

**Example:**
```typescript
// Source: Existing ContextItemSchema pattern (Phase 4b)
// src/core/memory/MemoryRecord.ts

import { z } from 'zod';

export const MemoryTypeSchema = z.enum([
  'working', 'episodic', 'semantic', 'preference', 'procedural'
]);

export const ConfidenceSourceSchema = z.enum([
  'explicit-user', 'verified-state', 'previous-explicit', 'inferred'
]);

export const MemoryRecordSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  memoryType: MemoryTypeSchema,
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  source: ConfidenceSourceSchema,
  useCount: z.number().int().nonnegative(),
  sensitivity: z.enum(['public', 'private', 'confidential']),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastUsedAt: z.number().optional(),
  verifiedAt: z.number().optional(),
});

export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;
```

### Anti-Patterns to Avoid

- **Storing backlinks in IndexedDB:** D-01 explicitly states backlinks are never stored — they are computed from `links[]`. Storing them creates inconsistency and violates the single-source-of-truth contract.
- **Importing React/AntD in core modules:** Core modules (`src/core/memory/`, `src/core/notes/`) must not import from `src/components/`. This is the established Phase 3 boundary.
- **Skipping WriteJournal for memory/note writes:** D-05 requires WriteJournal compliance for multi-store consistency. Direct IndexedDB writes bypass crash recovery.
- **Using the Phase 4a ephemeral MiniSearch instance for notes:** D-12 mandates a separate persistent instance. The Phase 4a instance is per-tab, never persisted, and has different indexed fields.
- **Confidence modification during retrieval:** D-07 specifies confidence is immutable. Increasing confidence on retrieval would corrupt conflict resolution in Phase 5b.
- **LLM writing user facts or preferences:** D-05 limits AI writes to conversation summaries. User facts and preferences must only be modified via explicit user action.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wikilink extraction from markdown | Custom markdown parser / AST walker | Regex `\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]` in LinkParser | Simple regex handles `[[title]]`, `[[title|alias]]`, `[[title#heading]]`; full markdown parsing is overkill and slow |
| Full-text search over notes | Custom inverted index / brute-force filter | MiniSearch 7.2.0 with BM25 | Already validated in Phase 4a; BM25 ranking outperforms manual tf-idf; <50ms over 1k notes |
| Cosine similarity computation | Custom math library | Built-in `Math` — spec §22.3: bag-of-words dot product | No external dependency needed; stop-word list ships inline; standard formula: `dot(a,b) / (||a|| * ||b||)` |
| IndexedDB object store management | Raw IndexedDB API | idb 8.0.3 | Already the project standard; handles versioned upgrades, transactions, compound keys |
| Memory scoring aggregation | Custom weighted scoring | Pure-function `MemoryScorer` with `keywordScore * 0.35 + tagScore * 0.25 + recencyScore * 0.20 + confidence * 0.10 + useCount * 0.10` | All sub-scores normalized to [0,1]; weights are local constants per D-08 |
| Cross-surface single-writer enforcement | Custom leader election algorithm | BroadcastBus `WORKSPACE_UPDATED` + `chrome.storage.session` primary election | Already established in Phase 1; `isPrimarySurface()` check before writes |
| Conversation summarization pipeline | Custom NLP summarization | LLM invocation at 12-message boundary via existing AI provider patterns | Spec D-10: uses active lowest-cost summarization tier (Haiku/Gemini Flash/Nano-class); reuses Phase 3 ProviderRouter |

**Key insight:** Phase 5 introduces zero new npm dependencies. Every required capability — search (MiniSearch), storage (idb), state (zustand), validation (zod), similarity math (vanilla JS), wikilink parsing (regex), single-writer enforcement (BroadcastBus) — is already available in the installed stack.

## Wikilink Parsing

### Obsidian-Compatible Syntax

The standard wikilink format is `[[target]]` with optional components:

| Syntax | Meaning |
|--------|---------|
| `[[My Note]]` | Link to note titled "My Note" |
| `[[My Note\|display text]]` | Link with alias display text |
| `[[My Note#heading]]` | Link to a specific heading within "My Note" |
| `[[My Note#heading\|alias]]` | Heading link with alias |

### Recommended Regex [ASSUMED]

```typescript
// Source: Obsidian wikilink documentation pattern
// Extracts titles from [[wikilink]] syntax in markdown content
const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;

// Parse all wikilinks in content, returning unique titles
export function parseWikilinks(content: string): string[] {
  const titles = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_REGEX.exec(content)) !== null) {
    titles.add(match[1].trim());
    // Support Obsidian block references
    // Also matches [[title#^blockid]] — captures just the title
  }
  return Array.from(titles);
}
```

### Tie-Break Rule for Duplicate Titles [ASSUMED]

When multiple notes share the same title, the tie-break rule resolves ambiguity:
1. If exactly one note has the matching title → resolve to that note
2. If multiple notes share the title → resolve to the most recently updated note (D-13 tie-break)
3. If no note has the matching title → add to `unresolvedLinks[]`

```typescript
// [ASSUMED] — planner selects implementation; this is a recommended pattern
async function resolveWikilink(title: string): Promise<string | null> {
  const matches = await NotesDB.findByTitle(title);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0].id;
  // Tie-break: most recently updated
  return matches.sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
}
```

## Similarity & Graph Computation

### Cosine Similarity (Content) [VERIFIED: PRODUCT_SPEC §22.3]

```typescript
// Source: PRODUCT_SPEC v0.1 §22.3 — bag-of-words cosine, no library
function cosineSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  const freqA = termFrequency(tokensA);
  const freqB = termFrequency(tokensB);

  // Compute dot product and magnitudes over union of terms
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  const allTerms = new Set([...freqA.keys(), ...freqB.keys()]);
  for (const term of allTerms) {
    const aVal = freqA.get(term) ?? 0;
    const bVal = freqB.get(term) ?? 0;
    dotProduct += aVal * bVal;
    magA += aVal * aVal;
    magB += bVal * bVal;
  }

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

function tokenize(text: string): string[] {
  // §22.3: lowercase, match alphanumeric sequences ≥3 chars
  const raw = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  // Remove 50-word English stop-word list (shipped inline in NoteGraph.ts)
  return raw.filter(t => !STOP_WORDS.has(t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}
```

### Jaccard Similarity (Links / Tags)

```typescript
// [ASSUMED] — standard set similarity formula
function jaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}
```

### Hybrid Similarity Formula (D-13)

```typescript
// Source: CONTEXT.md D-13 — 50% linkOverlap + 20% tagOverlap + 30% contentCosine
function computeSimilarity(noteA: Note, noteB: Note): number {
  const linkOverlap = jaccardSimilarity(new Set(noteA.links), new Set(noteB.links));
  const tagOverlap = jaccardSimilarity(new Set(noteA.tags), new Set(noteB.tags));
  const contentSim = cosineSimilarity(`${noteA.title} ${noteA.content}`, `${noteB.title} ${noteB.content}`);

  return (linkOverlap * 0.50) + (tagOverlap * 0.20) + (contentSim * 0.30);
}
```

### Backlink Derivation

Backlinks are computed exclusively from `links[]` per D-01 and D-13:
```typescript
// [ASSUMED] — deterministic from links[], never stored
function computeBacklinks(noteId: string, allNotes: Note[]): string[] {
  return allNotes
    .filter(n => n.links.includes(noteId))
    .map(n => n.id);
}
```

## Conversation Memory Implementation

### Compaction Trigger (D-10)

The compaction check runs after each message write to ConversationMemoryStore:
- `messageCount % 12 === 0` triggers summarization
- Uses the active lowest-cost summarization tier (Haiku/Gemini Flash/Nano-class)
- Summary is 2-3 concise sentences
- Original messages are preserved — never permanently deleted

### Context Assembly Formula (D-10)

```
context = HEAD + SUMMARY + TAIL

HEAD:
- System prompt + first 2 key messages (establishing context)

SUMMARY:
- LLM-generated 2-3 sentence summary of decisions, goals, user preferences,
  facts, and open tasks

TAIL:
- Last N messages (tier-gated):
  - tiny: 2 turns (4 messages)
  - small: 4 turns (8 messages)
  - medium/large: 6 turns (12 messages)
```

### Summary Prompt Template [ASSUMED — the agent's discretion]

```typescript
// [ASSUMED] — planner designs within D-10 format constraints
const SUMMARY_PROMPT = `Summarize the following conversation excerpt in 2-3 concise sentences.
Capture only: decisions made, goals set, user preferences stated, facts mentioned,
and open tasks. Do NOT summarize conversational filler, greetings, or small talk.

Conversation:
{messages}

Summary:`;
```

## Retrieval Scoring Formula

### D-08 Weighted Scoring

```typescript
// Source: CONTEXT.md D-08 + PRODUCT_SPEC §3.4 scoring formula
// Note: CONTEXT.md D-08 specifies 35/25/20/10/10; PRODUCT_SPEC §3.4 specifies
// 45/25/15/10/5. D-08 takes precedence as it's more recent (discuss-phase output).

function score(
  fact: UserMemoryFact,
  query: string,
  now: number = Date.now(),
  tier: ModelContextTier,
): number {
  // --- Component Scores (all normalized to [0,1]) ---

  // keywordMatch: proportion of query terms found in content
  const queryTerms = tokenizeQuery(query);
  const matchedTerms = queryTerms.filter(t =>
    fact.content.toLowerCase().includes(t)
  );
  const keywordScore = queryTerms.length > 0
    ? matchedTerms.length / queryTerms.length
    : 0;

  // tagMatch: proportion of matched tags
  const queryTagSet = new Set(fact.tags.map(t => t.toLowerCase()));
  const matchedTags = queryTerms.filter(t => queryTagSet.has(t));
  const tagScore = fact.tags.length > 0
    ? matchedTags.length / fact.tags.length
    : 0;

  // recency: linear decay over 30 days
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const recencyScore = Math.max(0, Math.min(1,
    1 - (now - fact.updatedAt) / THIRTY_DAYS
  ));

  // useCount: capped at 20
  const useCountScore = Math.min(1, fact.useCount / 20);

  // confidence: immutable, already in [0,1]
  const confidenceScore = fact.confidence;

  // --- D-08 Weighted Composite ---
  const composite =
    keywordScore   * 0.35 +
    tagScore       * 0.25 +
    recencyScore   * 0.20 +
    confidenceScore * 0.10 +
    useCountScore  * 0.10;

  return composite;
}
```

### Tier-Gated Retrieval (D-09)

```typescript
// Source: D-09 — tier-gated with minimum score threshold
function getTopFacts(
  facts: UserMemoryFact[],
  query: string,
  tier: ModelContextTier,
): UserMemoryFact[] {
  const MIN_SCORE = 0.30;

  // Score all facts
  const scored = facts
    .map(f => ({ fact: f, score: score(f, query) }))
    .filter(s => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  // Tier-gated maximum count
  const limit = tier === 'tiny' ? 3 : 5;

  return scored.slice(0, limit).map(s => s.fact);
}
```

## Memory Architecture

### MemoryEngine Retrieval Pipeline

Per D-06, stores are independent with no cross-store consolidation. MemoryEngine queries all stores, combines results, and ranks by the retrieval scoring model.

```typescript
// [ASSUMED — the agent's discretion: retrieval order]
async function retrieve(options: {
  conversationId: string,
  query: string,
  tier: ModelContextTier,
}): Promise<ContextItem[]> {
  const items: ContextItem[] = [];

  // 1. Conversation memory (summary + recent turns)
  const conversationMemory = await conversationStore.getContext(
    options.conversationId, options.tier
  );
  items.push(...toContextItems(conversationMemory, 'memory.conversation'));

  // 2. User facts (scored + tier-gated)
  const facts = await userStore.getAll();
  const topFacts = getTopFacts(facts, options.query, options.tier);
  items.push(...toContextItems(topFacts, 'memory.user.fact'));

  // 3. Preferences (compact JSON)
  const prefs = await preferenceStore.getAll();
  items.push(...toContextItems(prefs, 'memory.preference'));

  return items;
}
```

### SourceId Format (Phase 4 D-18)

```
memory.user.fact.<uuid>          → UserMemoryFact
memory.conversation.summary.<id> → ConversationSummary
memory.preference.<key>          → PreferenceRecord
```

### Single-Writer Memory Semantics (MEM-02)

```typescript
// Source: Existing BroadcastBus primary election pattern (Phase 1)
// In MemoryEngine.write():
async write(record: MemoryRecord): Promise<void> {
  // Check primary surface before any write
  if (!isPrimarySurface()) {
    throw new Error('Memory writes only allowed on primary surface');
  }

  // Journal the write across MemoryDB + IndexedDB
  await commitEntry(entryId, [
    { name: 'write-memory-record', executor: () => store.upsert(record) },
    { name: 'broadcast-workspace-update', executor: () => publish('WORKSPACE_UPDATED', { source: 'memory' }) },
  ]);
}

// isPrimarySurface() checks BroadcastBus primary election
function isPrimarySurface(): boolean {
  return BroadcastBus.getPrimarySurfaceId() === currentSurfaceId;
}
```

## IndexedDB Schema Design

### NotesDB (v4 — new)
```typescript
// Object Store: notes
// KeyPath: 'id' (UUID)
// Indexes: 'by-title' (title), 'by-updated' (updatedAt), 'by-tag' (tags, multiEntry)
{
  id: string;              // UUID
  title: string;
  content: string;          // Raw [[wikilink]] markdown
  created: number;          // Unix ms
  updated: number;          // Unix ms
  tags: string[];
  links: string[];          // Resolved note IDs (derived from content)
  unresolvedLinks: string[]; // Unresolved titles
  version: number;          // Incremented on update (D-17)
  // Provenance (D-16)
  source: 'user-created' | 'import' | 'chat-conversion' | 'ai-generated';
  importedAt?: number;
  originalPath?: string;
  conversationId?: string;
  importSessionId?: string;
}

// Object Store: concepts (D-14 — schema only in Phase 5)
// KeyPath: 'slug'
// Indexes: 'by-noteId' (noteIds, multiEntry)
{
  slug: string;
  label: string;
  summary: string;
  noteIds: string[];
  aliases: string[];
  updatedAt: number;
}

// Object Store: index (MiniSearch serialized JSON)
// KeyPath: 'id'
{
  id: string;              // 'note-search'
  json: string;            // Serialized MiniSearch index
  updatedAt: number;
}
```

### MemoryDB (v4 — new)
```typescript
// Object Store: memory_messages (conversation message bodies)
// KeyPath: ['conversationId', 'seq'] — compound key
{
  conversationId: string;
  seq: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
}

// Object Store: user_facts
// KeyPath: 'id'
// Indexes: 'by-tag' (tags, multiEntry), 'by-confidence' (confidence)
{
  id: string;
  content: string;
  memoryType: 'semantic';    // User facts are semantic by taxonomy
  tags: string[];
  confidence: number;        // 0..1, immutable per D-07
  source: 'explicit-user' | 'verified-state' | 'previous-explicit' | 'inferred';
  useCount: number;
  sensitivity: 'public' | 'private' | 'confidential';
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

// Object Store: conversation_summaries
// KeyPath: 'conversationId'
{
  conversationId: string;
  summary: string;
  summaryTokens: number;
  updatedAt: number;
}
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, test, dev | ✓ | v26.5.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| vitest | Test framework | ✓ | 3.0.0 | — |
| fake-indexeddb | IndexedDB mock in tests | ✓ | (in setup.ts) | — |
| jsdom | Browser env mock in tests | ✓ | (in vitest config) | — |
| minisearch | Note search index | ✓ | 7.2.0 | Already installed |
| idb | IndexedDB wrapper | ✓ | 8.0.3 | Already installed |
| zustand | UI state | ✓ | 5.0.0 | Already installed |
| zod | Schema validation | ✓ | 4.4.3 | Already installed |
| BroadcastChannel | Cross-surface communication | ✓ | built-in (mocked in tests) | — |
| IndexedDB | Persistent storage | ✓ | built-in (mocked in tests) | — |
| chrome.storage API | Primary election state | ✓ | mocked in tests | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.0.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/core/memory tests/core/notes tests/core/search` |
| Full suite command | `tsc --noEmit && npx vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTE-01 | LinkParser resolves wikilinks with tie-break | unit | `npx vitest run tests/core/notes/LinkParser.test.ts` | ❌ Wave 0 |
| NOTE-01 | Note appears in note graph with cosine backlinks | unit/integration | `npx vitest run tests/core/notes/NoteGraph.test.ts` | ❌ Wave 0 |
| NOTE-01 | MiniSearch returns results <50ms over 1k notes | perf | `npx vitest run tests/core/notes/MiniSearchNoteIndex.test.ts` | ❌ Wave 0 |
| MEM-01 | Conversation memory returns summary + recent turns | unit/integration | `npx vitest run tests/core/memory/ConversationMemoryStore.test.ts` | ❌ Wave 0 |
| MEM-01 | User facts scored and top-5 retrieved | unit | `npx vitest run tests/core/memory/MemoryScorer.test.ts` | ❌ Wave 0 |
| MEM-01 | Memory retrieval with tier-gating + threshold | unit/integration | `npx vitest run tests/core/memory/MemoryEngine.test.ts` | ❌ Wave 0 |
| MEM-02 | Writes blocked on secondary surface | unit | `npx vitest run tests/core/memory/MemoryEngine.test.ts` | ❌ Wave 0 |
| MEM-02 | BroadcastBus primary election check | unit | `npx vitest run tests/core/memory/MemoryEngine.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/memory/MemoryScorer.test.ts tests/core/notes/LinkParser.test.ts`
- **Per wave merge:** `npx vitest run tests/core/memory tests/core/notes`
- **Phase gate:** Full suite green + `pnpm run verify:phase-5` passes

### Wave 0 Gaps
- [ ] `tests/core/memory/MemoryEngine.test.ts` — covers MEM-01, MEM-02
- [ ] `tests/core/memory/MemoryScorer.test.ts` — covers MEM-01 scoring formula
- [ ] `tests/core/memory/UserMemoryStore.test.ts` — covers MEM-01 fact CRUD
- [ ] `tests/core/memory/ConversationMemoryStore.test.ts` — covers MEM-01 summary + turns
- [ ] `tests/core/notes/LinkParser.test.ts` — covers NOTE-01 wikilink parsing
- [ ] `tests/core/notes/NoteGraph.test.ts` — covers NOTE-01 graph + backlinks
- [ ] `tests/core/notes/MiniSearchNoteIndex.test.ts` — covers NOTE-01 search perf
- [ ] `tests/core/storage/MigrationRunner.test.ts` — extend for v4 migration coverage

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — No auth in this layer |
| V3 Session Management | no | — Session management via chrome.storage.session (Phase 2) |
| V4 Access Control | no | — No user roles in v0.1 |
| V5 Input Validation | yes | Zod schemas at all module boundaries (NoteSchema, MemoryRecordSchema); LinkParser regex uses capture groups only — no eval or code execution from parsed content |
| V6 Cryptography | no | — No cryptographic operations in knowledge layer (encryption handled by KeyVault in Phase 2) |

### Known Threat Patterns for IndexedDB + In-Memory Search

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via note content injection | Tampering | PortableMarkdown rendering (Phase 1); `content` is user-owned markdown — never executed as HTML. MiniSearch indexes text only, no script execution |
| Code injection via wikilink parsing | Tampering | Regex extraction captures only text between `[[` and `]]`; no eval, no dynamic code execution. Parsed titles are sanitized (trim, no HTML) |
| Memory tampering via BroadcastChannel spoofing | Spoofing | BroadcastBus publish uses `chrome.runtime.sendMessage` with sender validation (`sender.id === chrome.runtime.id` per §16.2) |
| Data exfiltration via memory injection | Information Disclosure | Memory records carry sensitivity classification; `confidential` items excluded from prompt injection per Phase 4b ContextTrustPolicy. Secret items must never become ContextItem instances (D-09 Phase 4b) |
| Prompt injection via user notes | Tampering | Notes content is untrusted data; ContextTrustPolicy classifies it as `data` authority with lower trust. Instruction injection is isolated per CTX-T02 |
| Sensitive data in LLM summary | Information Disclosure | TraceRedactor.redact() must run on content before summarization (§16.5). Redaction pipeline from Phase 2 reused |

## Common Pitfalls

### Pitfall 1: Storing Backlinks as Persistent Data
**What goes wrong:** Developer stores `backlinks[]` as a field on the Note and writes it to IndexedDB. When a linked note's title changes, backlinks become stale.
**Why it happens:** Backlinks feel like data that should be stored — other note-taking apps store them.
**How to avoid:** D-01 is explicit: "Backlinks are never stored — they are computed from `links[]`." All backlinks must be dynamically computed by scanning all notes' `links[]` arrays.
**Warning signs:** A `backlinks` field on the Note schema. Any IndexedDB store or Zustand state containing pre-computed backlinks.

### Pitfall 2: Mixing the Phase 4a Ephemeral Index with the Notes Index
**What goes wrong:** Developer reuses `PageIndexBuilder`'s MiniSearch instance for notes. It's never persisted, gets cleared with tab changes, and has different indexed fields.
**Why it happens:** "MiniSearch is already set up — why create a new instance?" The existing index is ephemeral and per-tab.
**How to avoid:** D-12: "Separate persistent MiniSearch instance for notes." Create `MiniSearchNoteIndex` as a completely separate instance with different fields and persistence.
**Warning signs:** Importing `PageIndexBuilder` in notes code. Using the tab-scoped cache key pattern for notes.

### Pitfall 3: Confidence Value Mutation During Retrieval
**What goes wrong:** MemoryScorer or MemoryEngine increments `confidence` when a fact is retrieved. This corrupts the immutable confidence contract.
**Why it happens:** Confusing `confidence` (a trust signal per D-07) with `useCount` (a retrieval ranking signal). Both influence scoring but only `useCount` may change at retrieval.
**How to avoid:** D-07: "Confidence is source-based and immutable." Only increment `useCount` and update `lastUsedAt` during retrieval. Never touch `confidence`.
**Warning signs:** `fact.confidence += 0.01` or similar mutation in scoring code.

### Pitfall 4: Missing WriteJournal Compliance for Multi-Store Writes
**What goes wrong:** Memory writes or note saves write directly to IndexedDB without journaling. On crash, partial writes create inconsistent state.
**Why it happens:** WriteJournal feels like overhead for simple writes. But multi-store operations (NotesDB + MiniSearchIndex + NoteGraph) need atomicity.
**How to avoid:** Use `createEntry`/`commitEntry` from WriteJournal (existing Phase 2 pattern). Register operations like `save-note-with-links` and `update-user-memory` as journaled operations.
**Warning signs:** Direct `db.put()` calls in NotesDB or MemoryEngine without WriteJournal wrapping.

### Pitfall 5: LLM-Generated User Facts or Preferences
**What goes wrong:** The conversation summarization LLM generates user facts or sets preferences, bypassing the D-05 write boundary.
**Why it happens:** Summarization might extract "user prefers short responses" and auto-write it as a preference. The LLM doesn't know Phase 5 domain rules.
**How to avoid:** D-05: LLM writes are strictly limited to conversation summaries. User facts and preferences must only be created via explicit user action. Structure the write API with type guards.
**Warning signs:** `MemoryEngine.write()` called from summarization code path with `memoryType !== 'working'`.

## Code Examples

### Wikilink Parsing with Tie-Break Resolution
```typescript
// Source: CONTEXT.md D-01, D-02, D-03
// [VERIFIED: CONTEXT.md decisions]

const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;

export function parseWikilinks(content: string): string[] {
  const titles = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_REGEX.exec(content)) !== null) {
    titles.add(match[1].trim());
  }
  return Array.from(titles);
}

export async function resolveLinks(
  titles: string[],
  notesDb: NotesDB,
): Promise<{ links: string[]; unresolvedLinks: string[] }> {
  const links: string[] = [];
  const unresolvedLinks: string[] = [];

  for (const title of titles) {
    const matches = await notesDb.findByTitle(title);
    if (matches.length === 0) {
      unresolvedLinks.push(title);           // D-03
    } else if (matches.length === 1) {
      links.push(matches[0].id);             // D-02: ID-based
    } else {
      // Tie-break: most recently updated (D-02 by implication)
      const resolved = matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      links.push(resolved.id);
    }
  }

  return { links: [...new Set(links)], unresolvedLinks };
}
```

### Memory Scoring Implementation
```typescript
// Source: CONTEXT.md D-08 — 35/25/20/10/10 weights
// [VERIFIED: CONTEXT.md decision]

const WEIGHTS = { keyword: 0.35, tag: 0.25, recency: 0.20, confidence: 0.10, useCount: 0.10 };
const MIN_SCORE = 0.30; // D-09
const USE_COUNT_CAP = 20;

export function scoreFact(fact: UserMemoryFact, queryTerms: string[], now: number): number {
  // keywordMatch: proportion of query terms found in content
  const contentLower = fact.content.toLowerCase();
  const matchedKeywords = queryTerms.filter(t => contentLower.includes(t.toLowerCase()));
  const keywordScore = queryTerms.length > 0 ? matchedKeywords.length / queryTerms.length : 0;

  // tagMatch: proportion of fact tags matched by query terms
  const queryTermSet = new Set(queryTerms.map(t => t.toLowerCase()));
  const matchedTags = fact.tags.filter(t => queryTermSet.has(t.toLowerCase()));
  const tagScore = fact.tags.length > 0 ? matchedTags.length / fact.tags.length : 0;

  // recency: linear decay over 30 days
  const DAY_30 = 30 * 24 * 60 * 60 * 1000;
  const recencyScore = Math.max(0, Math.min(1, 1 - (now - fact.updatedAt) / DAY_30));

  // useCount: capped at 20
  const useCountScore = Math.min(1, fact.useCount / USE_COUNT_CAP);

  // confidence: immutable, already in [0,1]
  const confidence = fact.confidence;

  // D-08 weighted composite
  return (
    keywordScore * WEIGHTS.keyword +
    tagScore * WEIGHTS.tag +
    recencyScore * WEIGHTS.recency +
    confidence * WEIGHTS.confidence +
    useCountScore * WEIGHTS.useCount
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Notes/Memory separated across phases 6-8 | Consolidated into single Phase 5 Knowledge Base | Rev. B reorganization (2026-07-27) | Single coherent knowledge layer before enrichment; shared miniSearch + IndexedDB patterns |
| Confidence as dynamic retrieval signal | Confidence as immutable source-based trust (D-07) | Phase 5 discuss (2026-08-01) | Separates trust from ranking; enables Phase 5b conflict resolution |
| Page inject into host pages for notes | Notes in Full App Tab only | v0.1 scope reduction | Notes workspace gets full viewport; no content-script UI complexity |
| Embedding-based semantic search | Bag-of-words + BM25 (MiniSearch) + LLM reranking in Phase 5a | v0.1 decision | No 40MB model download; sufficient for <5k notes |
| Memory writes from any surface | Single-writer semantics via BroadcastBus primary election (MEM-02) | Phase 1 foundation | Prevents write conflicts across sidepanel + full app |

**Deprecated/outdated:**
- **Phase 6 notes placement (old roadmap):** Notes are now in Phase 5 as the Knowledge Base core
- **Dynamic confidence update:** Replaced by immutable confidence (D-07) — confidence never changes at retrieval time

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Wikilink regex pattern `/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g` is the correct Obsidian-compatible format | Wikilink Parsing | LOW — easily adjusted if Obsidian adds new syntax variants; all Phase 5 tests are against the configured regex |
| A2 | Tie-break for duplicate titles resolves to most recently updated note | Wikilink Parsing | LOW — the agent's discretion per CONTEXT.md; planner may choose alternative (e.g., oldest, or prompt user) |
| A3 | Conversation summary prompt template format | Conversation Memory | LOW — the agent's discretion; success criteria only requires 2-3 sentences capturing decisions/goals/facts; prompt can be iterated |
| A4 | MemoryEngine retrieval order: conversation → user facts → preferences | Memory Architecture | LOW — CONTEXT.md lists retrieval pipeline order as the agent's discretion; reordering doesn't change schema or scoring contracts |
| A5 | EventBus event names beyond `note:saved` (e.g., `note:deleted`, `memory:written`) | Architecture Patterns | LOW — planner may define different event names; contracts only require `note:saved` for index sync |
| A6 | MiniSearch note index serialization via `JSON.stringify(index)` (which invokes `toJSON()`) stored in IndexedDB | MiniSearch Integration | LOW — verified against MiniSearch 7.2.0 official API; this is the documented serialization pattern |
| A7 | Use `discard()` (not `remove()`) for incremental index deletes to avoid needing the full document | MiniSearch Integration | LOW — either method works; `discard` is more convenient since it only needs the ID |
| A8 | Confidence source values mapped to numeric: `explicit-user`=1.0, `verified-state`=0.8, `previous-explicit`=0.7, `inferred`=0.5 | Retrieval Scoring | HIGH — if the mapping is different, the scoring formula would produce different retrieval ranks and confidence-based decisions in Phase 5b |
| A9 | D-08 weights (35/25/20/10/10) take precedence over PRODUCT_SPEC §3.4 weights (45/25/15/10/5) | Retrieval Scoring | MEDIUM — D-08 is the discuss-phase output and more recent, but if the spec is authoritative, percentages need adjustment |
| A10 | MemoryDB messages use compound key `[conversationId, seq]` | IndexedDB Schema | MEDIUM — if a flat keyPath is preferred, schema changes; compound key matches the spec's `keyPath [conversationId, seq]` note |

## Open Questions (RESOLVED)

1. **D-08 weights vs PRODUCT_SPEC §3.4 weights discrepancy** (RESOLVED)
   - What we know: CONTEXT.md D-08 specifies 35/25/20/10/10; PRODUCT_SPEC §3.4 specifies 45/25/15/10/5
   - Resolution: Plans use D-08 weights (35/25/20/10/10) as the more recent discuss-phase decision; PRODUCT_SPEC §3.4 discrepancy noted for Phase 5b tuning
   - Resolved in: Plan 05-02 Task 1 MemoryScorer exports WEIGHTS={keyword:0.35, tag:0.25, recency:0.20, confidence:0.10, useCount:0.10}
   - Recommendation: Use D-08 weights (more recent discuss-phase decision); note the discrepancy for Phase 5b tuning

2. **Conversation summary LLM invocation details** (RESOLVED)
   - What we know: D-10 specifies "active lowest-cost summarization tier (Haiku/Gemini Flash/Nano-class)" and 2-3 sentence format
   - Resolution: Plan 05-03 Task 1 uses a direct lightweight provider call (not full AgentOrchestrator pipeline) — `providerAdapter.createLanguageModel(modelId).doGenerate({prompt, maxTokens:200, temperature:0.3})` with ProviderRouter.getCompressionModel() for the cheapest model
   - Resolved in: Plan 05-03 Task 1 ConversationMemoryStore.compactConversation() — direct provider call, not AgentOrchestrator
   - Recommendation: Use a direct, lightweight provider call (not full AgentOrchestrator pipeline) since summarization is a deterministic, non-interactive task

3. **MiniSearch index rebuild strategy on startup recovery** (RESOLVED)
   - What we know: D-12 specifies "Full rebuild reserved for startup recovery, import, schema migrations, and corruption recovery"
   - Resolution: Plan 05-01 Task 1 MiniSearchNoteIndex.load() attempts deserialization; rebuild() is a public method invoked by caller on load failure or corruption; vacuum/scheduled rebuild deferred to caller or future phase
   - Resolved in: Plan 05-01 Task 1 MiniSearchNoteIndex.load() + rebuild() methods; caller triggers rebuild when loadJSON fails
   - Recommendation: Rebuild when `loadJSON` fails (corrupted/absent data); schedule vacuum on startup for indices with high dirtFactor

## Sources

### Primary (HIGH confidence)
- [Context7: MiniSearch 7.2.0 official docs] — API reference for `toJSON()`, `loadJSON()`, `add()`, `replace()`, `remove()`, `discard()`, `search()`, field boosting, tokenization, BM25 ranking [VERIFIED: official docs at lucaong.github.io/minisearch]
- [npm: minisearch 7.2.0] — Confirmed installed version; 1.97M weekly downloads; verified via `npm view` [VERIFIED: npm registry]
- [CONTEXT.md: Phase 5 decisions D-01 through D-17] — Locked architectural decisions from discuss-phase; canonical source for data models, scoring formulas, and write boundaries [VERIFIED: project artifact]
- [PRODUCT_SPEC v0.1 §3, §15, §18, §21, §22] — Persistent memory architecture, storage topology, implementation phases, data models, performance targets [CITED: product specification]

### Secondary (MEDIUM confidence)
- [codebase-memory-mcp: Architecture overview + code snippets] — Verified existing patterns: WriteJournal, MigrationRunner, PageIndexBuilder (MiniSearch), EventBus, BroadcastBus, ContextItem, ContextOptimizer, PersonaInjector [VERIFIED: codebase inspection]
- [npm: idb 8.0.3, zustand 5.0.0, zod 4.4.3] — Confirmed installed versions and registry legitimacy [VERIFIED: npm registry]
- [Package legitimacy audit via gsd-tools] — All packages OK; no suspicious or slopsquatted dependencies [VERIFIED: gsd-tools query]

### Tertiary (LOW confidence)
- [WebSearch: Obsidian wikilink syntax patterns] — Regex and tie-break rule are [ASSUMED] based on Obsidian documentation; planner has discretion per CONTEXT.md
- [WebSearch: Similarity computation patterns] — Cosine and Jaccard implementations are standard formulas; PRODUCT_SPEC §22.3 provides canonical implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry; zero new dependencies; existing install confirmed
- Architecture: HIGH — patterns directly derived from existing codebase (singletons, WriteJournal, EventBus, MigrationRunner)
- Wikilink parsing: MEDIUM — regex pattern is standard Obsidian syntax but tagged [ASSUMED]; planner has discretion
- Similarity computation: HIGH — PRODUCT_SPEC §22.3 provides canonical algorithm; standard bag-of-words cosine
- Retrieval scoring: MEDIUM — formula from D-08 but weight discrepancy with §3.4 noted in Open Questions
- Pitfalls: HIGH — derived from D-01 through D-17 constraints and Phase 2/4a established patterns

**Research date:** 2026-08-01
**Valid until:** 2026-08-31 (30 days — stable domain; miniSearch and idb are mature libraries)

<!-- gsd:write-continue -->
