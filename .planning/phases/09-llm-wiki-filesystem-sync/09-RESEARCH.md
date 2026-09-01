# Phase 9: LLM-Wiki & Filesystem Sync - Research

**Researched:** 2026-09-01
**Domain:** LLM enrichment (auto-tag/categorize/summarize), RAG Q&A, filesystem backup sync, memory-notes integration
**Confidence:** HIGH

## Summary

Phase 9 extends the atomic-note-with-wikilinks core (Phase 8) with five new services: NoteTagger (LLM enrichment), NoteQA (RAG Q&A), NoteChatConverter (chat-to-note), NoteFileSync (one-way app→filesystem backup), and NoteMaintenance (staleness/orphan detection). The phase delivers 37 requirements across 6 requirement families.

The AI runtime is fully reusable — ProviderRouter, StructuredOutput, and TierResolver from Phase 3 provide the invoke path. NoteTagger uses StructuredOutput.requestJson() with a Zod schema at the fast tier, temperature-0, for one structured call returning tags+category+summary+memoryFacts. NoteQA combines MiniSearchIndex retrieval with MemoryEngine hints for balanced-tier synthesis.

The filesystem sync is Standalone-only using the File System Access API (showDirectoryPicker), with FileSystemDirectoryHandle persisted in a new `notes_backup_config` IndexedDB store (non-serializable, cannot use chrome.storage.local). The on-disk format is OKF v0.2-compatible YAML frontmatter with UUID identity preserved.

**Primary recommendation:** Install `yaml@^2.9.0` and `@types/wicg-file-system-access@^2023.10.5` (both missing from package.json despite CONTEXT D-120 claiming yaml is "already in STACK"), create the v4 IDB migration for the `notes_backup_config` store, and gate-re-point verify:phase-9 to spec §24 scope.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LLM auto-tagging (NoteTagger) | API/Backend (UI context) | — | Runs in side panel/standalone UI only (MV3 boundary §0.2); uses fast-tier provider call |
| RAG Q&A (NoteQA) | API/Backend (UI context) | — | MiniSearch + MemoryEngine + balanced-tier LLM synthesis; ephemeral, never persisted |
| Chat-to-note (NoteChatConverter) | API/Backend (UI context) | — | Consumes conversation messages + MemoryEngine.assemble(); drafts for user review |
| Filesystem backup (NoteFileSync) | Browser/Client | — | File System Access API is browser-only; Standalone-only per SYNC-01 |
| Memory↔Notes routing (NMEM-02) | API/Backend (UI context) | — | Primary-surface-only fact upsert via MemoryEngine |
| Maintenance (NoteMaintenance) | API/Backend (UI context) | — | Algorithmic timestamp comparison; user-initiated bulk analysis |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-115:** NoteTagger uses existing AI runtime — ProviderRouter fast tier, temperature-0, single structured-JSON call
- **D-116:** LLM-WIKI-11 confidence gating — threshold 0.60, max 3 facts / 5 tags per save
- **D-117:** NoteQA "Ask notes" = MiniSearch top-5 + memory facts → balanced-tier synthesis + per-statement citations
- **D-118:** NoteChatConverter uses conversation messages + MemoryEngine.assemble() facts for richer drafts
- **D-119:** showDirectoryPicker() Standalone-only; handle persisted in notes_backup_config IDB store
- **D-120:** OKF v0.2 YAML frontmatter per SYNC-04 — yaml ^2 library
- **D-121:** Restore parser tolerates OKF keys, preserves UUID identity + wikilinks
- **D-122:** NoteMaintenance is user-initiated + passive timestamp comparison — no background jobs
- **D-123:** NMEM-02: on-save LLM call extracts memory facts → routed through MemoryEngine, primary surface only
- **D-124:** categoryPath + Note.type declared in Phase 8, populated + serialized in Phase 9
- **D-125:** v4 migration is idempotent — adds tags/summary to notes index + Note.type population + notes_backup_config store

### the agent's Discretion
- Exact NoteTagger→ProviderRouter invoke path (direct invoke() vs AgentOrchestrator wrapper — both satisfy D-115; prefer the lighter direct path)
- Whether NoteQA synthesis streams or returns one-shot
- Whether NoteFileSync debounce is module-level timer or hook-scoped
- Whether NoteMaintenance lives in one file or splits staleness/orphan/bulk
- Whether the OKF `generated`/`status` fields use the exact SYNC-04 casing

### Deferred Ideas (OUT OF SCOPE)
- Memory governance (MEM-01…05, KNW-01) = Phase 10
- Bidirectional filesystem sync = Phase v0.2+
- Embedding/vector search = deferred per §3.2
- LLM wikilink autocomplete = not in v0.1 (D-04)
- Full NotesWorkspace UI = Phase 15.1
- search-notes / create-note tool registration = Phase 18

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yaml | ^2.9.0 | OKF v0.2 YAML frontmatter serialization/parsing for .md sync (SYNC-04) | Industry-standard YAML library; D-120 mandates yaml ^2 |
| minisearch | ^7.2.0 | Note retrieval for NoteQA RAG (top-5) + AI rerank (LLM-WIKI-05) | Already in STACK; D-109 persistent notes index |
| idb | ^8.0.3 | IndexedDB wrapper for notes_backup_config store + v4 migration | Already in STACK; D-08 handle persistence |
| zod | ^4.4.3 | Runtime validation for NoteTagResultSchema, NoteQAResultSchema, NoteDraftSchema | Already in STACK; all cross-boundary data uses Zod |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/wicg-file-system-access | ^2023.10.5 | TypeScript types for File System Access API (showDirectoryPicker, FileSystemDirectoryHandle, queryPermission) | NoteFileSync module (SYNC-01/02/09) |

### New Packages Required

| Package | npm Version | Status | Action |
|---------|-------------|--------|--------|
| yaml | 2.9.0 | **NOT IN package.json** — must be installed | `pnpm add yaml@^2.9.0` |
| @types/wicg-file-system-access | 2023.10.7 | **NOT IN package.json** — must be installed | `pnpm add -D @types/wicg-file-system-access@^2023.10.5` |

**Note:** CONTEXT.md D-120 states "yaml ^2 (already in STACK)" but `npm view yaml version` confirms 2.9.0 exists while package.json has no yaml entry. This is a critical gap — the package must be installed before NoteFileSync can serialize OKF frontmatter.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| yaml ^2 | js-yaml ^4 | js-yaml is equally valid but D-120 explicitly mandates yaml ^2 |
| StructuredOutput.requestJson | Raw provider.stream() + manual parse | StructuredOutput provides repair loop + JSON mode; matches Appendix L pattern already used by PlannerService |
| AgentOrchestrator wrapper | Direct ProviderRouter + TierResolver | AgentOrchestrator is heavier (trajectory, caps); NoteTagger needs a single structured call, not the full loop |

**Installation:**
```bash
pnpm add yaml@^2.9.0
pnpm add -D @types/wicg-file-system-access@^2023.10.5
```

**Version verification:**
- `npm view yaml version` → 2.9.0 (published 2026-05-11)
- `npm view @types/wicg-file-system-access version` → 2023.10.7 (published 2023-10)

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| yaml | npm | ~15 yrs (2011) | ~200M/wk | github.com/eemeli/yaml | [ASSUMED] | Planner must add checkpoint:human-verify before install |
| @types/wicg-file-system-access | npm | ~3 yrs (2023) | ~3M/wk | DefinitelyTyped | [ASSUMED] | Planner must add checkpoint:human-verify before install |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Packages discovered via CONTEXT.md decisions and spec §27.3 that have not been verified against an authoritative source are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ UI Context (Side Panel / Standalone)                            │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ NoteEditor   │    │ AskNotes UI  │    │ ChatMessage      │  │
│  │ (save flow)  │    │ (RAG query)  │    │ ("Save to note") │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                   │                      │            │
│  ┌──────▼───────────────────▼──────────────────────▼─────────┐  │
│  │                   saveNote() [save.ts]                    │  │
│  │  parseLinks → resolveLinks → NotesDB.put → emit('note:   │  │
│  │  saved')                                                 │  │
│  └──────┬──────────────────────────────────────────────────┘  │
│         │ EventBus.emit('note:saved')                           │
│  ┌──────▼──────────────────────────────────────────────────┐  │
│  │                    NoteTagger.analyze()                   │  │
│  │  ProviderRouter (fast, temp-0) → StructuredOutput →      │  │
│  │  {tags, categoryPath, summary, memoryFacts}              │  │
│  │  gateSuggestions() → UI accept/reject                    │  │
│  └──────┬────────────────────────────┬─────────────────────┘  │
│         │                            │                         │
│  ┌──────▼────────────┐    ┌─────────▼────────────┐           │
│  │ MemoryEngine      │    │ NoteFileSync         │           │
│  │ (NMEM-02 upsert)  │    │ (OKF .md write)      │           │
│  │ primary surface   │    │ 50ms debounce        │           │
│  └───────────────────┘    └──────────────────────┘           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    NoteQA.ask()                          │  │
│  │  MiniSearch top-5 + MemoryEngine.retrieveMemoryHints()   │  │
│  │  → balanced-tier synthesis → citations                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               NoteChatConverter.draft()                  │  │
│  │  conversation messages + MemoryEngine.assemble()         │  │
│  │  → NoteDraftSchema → NoteEditor pre-fill                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               NoteMaintenance (user-initiated)           │  │
│  │  staleness: summaryGeneratedAt/updated comparison       │  │
│  │  orphan: NoteGraph.computeBacklinks() → 0 links badge   │  │
│  │  bulk: sequential re-analyze with real-time stats       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   IndexedDB       │
                    │  ├─ notes         │
                    │  ├─ concepts      │
                    │  └─ notes_backup_ │
                    │     config        │
                    └───────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  File System      │
                    │  (showDirectory-  │
                    │   Picker handle)  │
                    │  {categoryPath}/  │
                    │  {title}.md      │
                    └───────────────────┘
```

### Recommended Project Structure
```
src/core/notes/
├── LinkParser.ts          # [existing] WIKI-ID-02/03/04 wikilink parse/resolve
├── NoteGraph.ts           # [existing] cosine similarity + backlinks
├── save.ts                # [existing] note:saved emit seam
├── NoteTagger.ts          # [NEW] LLM enrichment: tags+category+summary+facts
├── NoteQA.ts              # [NEW] RAG Q&A: MiniSearch+memory+synthesis+citations
├── NoteChatConverter.ts   # [NEW] chat/page → structured note draft
├── NoteFileSync.ts        # [NEW] one-way .md sync + restore
├── NoteMaintenance.ts     # [NEW] staleness/orphan/bulk analysis
└── schemas.ts             # [NEW] NoteTagResultSchema, NoteQAResultSchema, NoteDraftSchema, gateSuggestions

src/core/storage/
├── NotesDB.ts             # [existing + v4 migration] notes_backup_config store
└── IndexedDBMigrator.ts   # [existing] migration framework

src/types/
└── notes.ts               # [existing] Note interface + OKF frontmatter + constants

tests/core/notes/
├── LinkParser.test.ts     # [existing]
├── note-canonical.test.ts # [existing]
├── NoteGraph.test.ts      # [existing]
├── NoteTagger.test.ts     # [NEW]
├── NoteQA.test.ts         # [NEW]
├── NoteChatConverter.test.ts # [NEW]
├── NoteFileSync.test.ts   # [NEW]
└── NoteMaintenance.test.ts # [NEW]

tests/core/storage/
└── migrations/
    └── v4-notes-backup-config.test.ts  # [NEW] v4 migration idempotency
```

### Pattern 1: Structured LLM Call via StructuredOutput
**What:** Single fast-tier, temperature-0 structured JSON call returning tags+category+summary+memoryFacts
**When to use:** NoteTagger.analyze() — the phase's efficiency spine (D-01)
**Example:**
```typescript
// Source: StructuredOutput.ts (Appendix L pattern already in codebase)
import { requestJson } from '../ai/StructuredOutput';
import { resolveTier } from '../ai/TierResolver';
import { ProviderRegistry } from '../ai/ProviderRegistry';
import { route } from '../ai/ProviderRouter';

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

### Pattern 2: OKF v0.2 Frontmatter Serialization
**What:** YAML frontmatter block + markdown body for .md backup files
**When to use:** NoteFileSync.writeNote() per SYNC-04
**Example:**
```typescript
// Source: spec §27.3 SYNC-04 canonical emitted example (spec 3844-3862)
import { stringify } from 'yaml';

function serializeNote(note: Note): string {
  const frontmatter = stringify({
    type: note.type ?? 'Note',
    title: note.title,
    description: note.summary,
    id: note.id,
    created: note.created,
    updated: note.updated,
    tags: note.tags,
    categoryPath: note.categoryPath,
    generated: { by: 'nowpilot/fast-tier', at: new Date().toISOString() },
    status: 'stable',
  });
  return `---\n${frontmatter}---\n${note.content}`;
}
```

### Pattern 3: File System Access API Handle Persistence
**What:** FileSystemDirectoryHandle persisted in IDB, permission verified on mount
**When to use:** NoteFileSync initialization (SYNC-01/02)
**Example:**
```typescript
// Source: SYNC-01/SYNC-02 — handle in notes_backup_config IDB store
async function getBackupHandle(db: IDBPDatabase): Promise<FileSystemDirectoryHandle | null> {
  const record = await db.get('notes_backup_config', 'backup_handle');
  if (!record) return null;
  const handle = record.handle as FileSystemDirectoryHandle;
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission !== 'granted') return null; // SYNC-02: banner + disabled
  return handle;
}
```

### Pattern 4: RAG Retrieval + Synthesis Pipeline
**What:** MiniSearch top-5 + MemoryEngine facts → balanced-tier synthesis with citations
**When to use:** NoteQA.ask() per LLM-WIKI-06
**Example:**
```typescript
// Source: LLM-WIKI-06 / D-117 — balanced-tier synthesis with citations
async function askQuestion(query: string): Promise<NoteQAResult> {
  const noteHits = await MiniSearchIndex.query(db, query); // top-5 via search
  const memoryHints = await MemoryEngine.retrieveMemoryHints(query); // NMEM-01
  const context = [...noteHits.map(h => h.content), ...memoryHints.map(h => h.content)];
  // Balanced-tier synthesis with per-statement citations
  const synthesis = await synthesizeWithCitations(query, context, 'balanced');
  return synthesis;
}
```

### Anti-Patterns to Avoid
- **Background jobs for maintenance:** NoteMaintenance must be user-initiated per D-06 — no MV3 alarms/background timers
- **Bidirectional sync:** Explicitly out of scope (§27.9) — don't build polling/file watcher
- **chrome.storage.local for handles:** FileSystemDirectoryHandle is non-serializable — must use IDB (SYNC-01/D-08)
- **Conflating Note.type with identity:** type is OKF metadata; id (UUID) is identity (WIKI-ID-01, D-108)
- **Embedding/vector search:** Deferred per §3.2 — MiniSearch + cosine is the v0.1 approach

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML serialization | Custom frontmatter serializer | yaml ^2 library | Edge cases in quoting, escaping, multiline strings |
| JSON repair from LLM | Custom regex/parse logic | StructuredOutput (Appendix L) | Already handles fences, malformed JSON, one-shot repair |
| Structured JSON extraction | Manual stream consumption | StructuredOutput.requestJson() | Repair loop + Zod validation built in |
| File path sanitization | Custom regex | `/[\\/:*?"<>|]/g → '_'` pattern (SYNC-04) | Simple, well-defined character set |
| IDB versioning | Custom migration framework | IndexedDBMigrator.registerMigration() | Already supports conditional blocks, idempotent migrations |

**Key insight:** The codebase already has StructuredOutput (for LLM JSON), IndexedDBMigrator (for IDB versioning), and ProviderRouter (for AI routing). Phase 5 services are additive modules that reuse these seams — no custom infrastructure needed.

## Common Pitfalls

### Pitfall 1: Missing yaml/@types/wicg-file-system-access packages
**What goes wrong:** CONTEXT.md D-120 claims "yaml ^2 (already in STACK)" but `package.json` has no yaml or @types/wicg-file-system-access entry. NoteFileSync cannot compile.
**Why it was assumed:** STACK.md is outdated relative to actual package.json.
**How to avoid:** Install both packages before any NoteFileSync work begins.
**Warning signs:** `Cannot find module 'yaml'` compile error; `showDirectoryPicker` type errors.

### Pitfall 2: Gate mismatch — verify:phase-9
**What goes wrong:** Current package.json has `verify:phase-9: tsc --noEmit && vitest run && pnpm run lint` but spec §24 defines `tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations`. Tests outside this scope would run/fail unexpectedly.
**Why it matters:** D-114 precedent established gate re-pointing per phase.
**How to avoid:** Re-point verify:phase-9 to spec §24 scope before implementation begins.
**Warning signs:** Unrelated test failures in verify:phase-9.

### Pitfall 3: MemoryEngine.assemble() doesn't exist yet
**What goes wrong:** NMEM-03 (D-118) references `MemoryEngine.assemble()` for NoteChatConverter, but MemoryEngine.ts currently only has `retrieveConversationMemory`, `retrieveUserMemory`, `buildPreferenceProfile`, `retrieveMemoryHints`.
**Why it matters:** NoteChatConverter needs memory context for richer drafts.
**How to avoid:** Create `assemble()` in Phase 9 — returns a compact memory context string from user facts/preferences (similar to `retrieveMemoryHints` but formatted for note drafting).
**Warning signs:** TypeScript compile error when NoteChatConverter calls `MemoryEngine.assemble()`.

### Pitfall 4: v4 migration framework semantics
**What goes wrong:** NotesDB is currently at `NOTES_DB_VERSION = 1`. The v4 migration requires creating `notes_backup_config` store + populating `Note.type` + adding tags/summary to MiniSearch index. The IndexedDBMigrator framework uses `registerMigration` with conditional blocks — incorrect `fromVersion`/`toVersion` ordering can skip or double-apply.
**Why it matters:** D-125 mandates idempotent migration. Idb's `openDB` with `targetVersion: 4` triggers upgrade from v1→v4, but registered migrations apply based on `fromVersion <= oldVersion + 1`.
**How to avoid:** Use inline `upgrade()` callback in NotesDB.openNotesDB for v1 bootstrap (existing), and a registered v4 migration for the new store. The framework's `openVersionedDB` applies registered migrations where `m.toVersion > oldVersion && m.fromVersion <= oldVersion + 1` — a v1→v4 migration with `fromVersion: 1, toVersion: 4` fires correctly from v1.
**Warning signs:** `notes_backup_config` store missing after migration; Note.type not populated.

### Pitfall 5: FileSystemDirectoryHandle non-serializability
**What goes wrong:** Attempting to persist FileSystemDirectoryHandle in chrome.storage.local (which uses JSON serialization) — handle becomes `{}` and loses all methods.
**Why it matters:** SYNC-01/D-08 explicitly mandates IDB storage.
**How to avoid:** Always use `notes_backup_config` IDB store. FileSystemHandle is structured-cloneable (supported by IDB) but not JSON-serializable.
**Warning signs:** `handle.getFileHandle is not a function` at restore time.

### Pitfall 6: Stale async LLM suggestions
**What goes wrong:** NoteTagger.analyze() is non-blocking (D-115). If the user edits the note before the async LLM call returns, stale suggestions would be applied to newer content.
**Why it matters:** LLM-WIKI-11 explicitly requires discarding stale suggestions.
**How to avoid:** Capture `note.version` at analyze() call time; on response, compare with current `note.version`. Discard if mismatched.
**Warning signs:** Tags/summary from old content appearing after edit+regenerate race.

### Pitfall 7: External-change guard tolerance
**What goes wrong:** SYNC-06 requires detecting external file changes (lastModified newer than last sync, 2s tolerance). Without the tolerance, legitimate rapid app writes trigger false conflict dialogs.
**Why it matters:** The 50ms debounce (SYNC-03) + near-simultaneous writes could appear as "external" changes without tolerance.
**How to avoid:** Track `lastSyncTimestamp` per note; compare with `file.lastModified` using `> lastSyncTimestamp + 2000` threshold.
**Warning signs:** Spurious "Overwrite?" dialogs on rapid save.

## Code Examples

### OKF v0.2 Frontmatter Serialization (SYNC-04)
```typescript
// Source: spec §27.3 SYNC-04 field table (spec 3830-3863)
import { stringify, parse } from 'yaml';
import type { Note } from '@/types/notes';

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

export function parseNoteFromMarkdown(md: string): { frontmatter: OkfFrontmatter; body: string } {
  const match = md.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) throw new Error('No valid OKF frontmatter found');
  const frontmatter = parse(match[1]) as OkfFrontmatter;
  return { frontmatter, body: match[2] };
}
```

### LLM-WIKI-11 Suggestion Gating
```typescript
// Source: spec Appendix C.1 (spec 4776-4786) + notes.ts
import type { NoteTagResult } from '@/types/notes';
import {
  NOTE_SUGGESTION_DISPLAY_THRESHOLD,
  NOTE_SUGGESTION_MAX_TAGS_PER_SAVE,
  NOTE_SUGGESTION_MAX_FACTS_PER_SAVE,
} from '@/types/notes';

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

### NoteTagger Invoke Pattern
```typescript
// Source: D-115 + StructuredOutput (Appendix L pattern)
import { z } from 'zod';
import { requestJson } from '@/core/ai/StructuredOutput';
import { resolveTier } from '@/core/ai/TierResolver';
import { route } from '@/core/ai/ProviderRouter';
import { ProviderRegistry } from '@/core/ai/ProviderRegistry';

export const NoteTagResultSchema = z.object({
  tags: z.array(z.object({ value: z.string(), confidence: z.number().min(0).max(1) })).max(10),
  categoryPath: z.string().nullable(),
  summary: z.string(),
  memoryFacts: z.array(z.object({ content: z.string(), confidence: z.number().min(0).max(1) })).max(10).default([]),
});

export async function analyzeNote(note: Note, operationId: string, abortSignal: AbortSignal): Promise<NoteTagResult> {
  const resolution = resolveTier('fast');
  if (!resolution) throw new Error('FAST_TIER_UNCONFIGURED');

  const prompt = `Analyze this note and return structured JSON.
Title: ${note.title}
Content: ${note.content}
Existing categories: ${getExistingCategories().join(', ')}`;

  return requestJson(NoteTagResultSchema, prompt, {
    operationId,
    providerId: resolution.providerId,
    model: resolution.model,
    timeoutMs: 15_000,
    callProviderJsonMode: async (p, schema, signal) => {
      const routed = await route({
        operationId, tier: 'fast', systemPrompt: p,
        providerCandidates: ProviderRegistry.getAll().filter(e => e.enabled).map(e => e.provider!),
        modelForProvider: (pid) => pid === resolution.providerId ? resolution.model : undefined,
        allowCloudFallbackFromLocal: true, abortSignal: signal,
      });
      // Extract JSON from stream...
      return jsonText;
    },
    abortSignal,
  });
}
```

### NoteQA RAG Pipeline
```typescript
// Source: LLM-WIKI-06 / D-117 — MiniSearch top-5 + memory + balanced synthesis
export async function askNotes(query: string, db: IDBPDatabase<NotesDBV1>): Promise<NoteQAResult> {
  // Retrieval: MiniSearch top-5 (notes index already has summary/tags fields per v4 migration)
  const noteHits = await MiniSearchIndex.query(db, query);
  // Memory facts: NMEM-01 — MemoryEngine.retrieveMemoryHints
  const memoryHints = await MemoryEngine.retrieveMemoryHints(query, { tier: 'balanced' });

  const context = [
    ...noteHits.map(h => `[Note: ${h.title}] ${h.content.slice(0, 200)}`),
    ...memoryHints.map(h => `[Memory: ${h.type}] ${h.content}`),
  ];

  // Balanced-tier synthesis with per-statement citations
  const synthesis = await synthesizeWithCitations(query, context);
  return synthesis;
}
```

### v4 Migration (notes_backup_config store)
```typescript
// Source: spec §20.4 (spec 3156) + IndexedDBMigrator pattern
import { registerMigration } from './IndexedDBMigrator';

registerMigration('NotesDB', {
  fromVersion: 1,
  toVersion: 4,
  description: 'Add notes_backup_config store; populate Note.type; add tags/summary to search index',
  migrate: async (db) => {
    // Create notes_backup_config store (idempotent — skip if exists)
    if (!db.objectStoreNames.contains('notes_backup_config')) {
      db.createObjectStore('notes_backup_config', { keyPath: 'key' });
    }
    // Note.type population (idempotent — skip if already set)
    const notesStore = db.transaction('notes', 'readwrite').objectStore('notes');
    let cursor = await notesStore.openCursor();
    while (cursor) {
      if (!cursor.value.type) {
        await cursor.update({ ...cursor.value, type: 'Note' });
      }
      cursor = await cursor.continue();
    }
    // MiniSearch index fields (tags/summary) — handled by MiniSearchIndex rebuild
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple LLM calls (tags, category, summary separately) | Single structured JSON call (D-01) | Phase 9 design | Cheaper/faster; one fast-tier call returns all fields |
| Flat note storage | OKF v0.2 YAML frontmatter + folder tree | Phase 9 (rev 2026-08-12) | Interoperability with generic OKF consumers |
| No AI enrichment | LLM auto-tagging + RAG Q&A | Phase 9 | Notes become first-class knowledge retrieval targets |

**Deprecated/outdated:**
- STACK.md claiming yaml is already installed — it's NOT in package.json (verified 2026-09-01)
- MemoryEngine.assemble() referenced in decisions but not yet implemented

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `yaml@^2.9.0` is the correct package for OKF frontmatter | Standard Stack | If wrong package, frontmatter serialization fails at runtime |
| A2 | `@types/wicg-file-system-access@^2023.10.5` provides showDirectoryPicker types | Standard Stack | If types missing, NoteFileSync won't compile |
| A3 | MemoryEngine.assemble() should be created in Phase 9 | Architecture Patterns | If method belongs elsewhere, NMEM-03 contract breaks |
| A4 | StructuredOutput.requestJson is the lighter invoke path satisfying D-115 | Don't Hand-Roll | If AgentOrchestrator wrapper needed, adds complexity |
| A5 | NOTES_DB_VERSION bump from 1→4 triggers migration correctly | Common Pitfalls | If migration framework skips, notes_backup_config store won't be created |

## Open Questions

1. **MemoryEngine.assemble() exact contract**
   - What we know: D-118 references it for NoteChatConverter's memory context enrichment
   - What's unclear: Exact return type and whether it's a formatting wrapper around retrieveMemoryHints or a separate concept
   - Recommendation: Implement as `assemble(query?: string): Promise<string>` returning compact memory context for note drafting; defer to Phase 10 for MEM-01…05 governance

2. **NoteFileSync test strategy in jsdom**
   - What we know: File System Access API is not available in jsdom
   - What's unclear: How to unit test NoteFileSync without browser APIs
   - Recommendation: Abstract FS operations behind an interface; inject mock for tests; integration test in extension context

3. **v4 migration from v1 (skip v2/v3)**
   - What we know: NotesDB is at v1; spec §20.4 says "v4 migration" adds the store
   - What's unclear: Whether intermediate v2/v3 migrations exist or this is a direct v1→v4 bump
   - Recommendation: Direct v1→v4 bump with `NOTES_DB_VERSION = 4` and a single registered migration with `fromVersion: 1, toVersion: 4`

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Path-based categoryPath, `/` separator, normalized | Pattern: categoryPath normalization in save pipeline |
| CAT-02 | NoteList tree grouped by "Uncategorized" | UI component reads categoryPath, groups client-side |
| CAT-03 | LLM suggests category during auto-tagging | NoteTagger.analyze() returns categoryPath in structured JSON |
| CAT-04 | Backup saves as `{categoryPath}/{title}.md` | NoteFileSync builds nested folder path from categoryPath |
| CAT-05 | Normalize on save; invalid segments flagged | Save pipeline validates + UI shows AntD red border |
| LLM-WIKI-01 | One fast-tier temp-0 call: ≤5 tags + category + summary | NoteTagger via StructuredOutput at fast tier |
| LLM-WIKI-02 | Independent toggles: autoTag/autoCategorize/autoSummary/aiSearch | Options → Notes → np_notes_llm_features store |
| LLM-WIKI-03 | Optional summary field in NoteList | Note.summary persisted, displayed as secondary text |
| LLM-WIKI-04 | "Regenerate" toolbar button | Re-runs NoteTagger.analyze() in place |
| LLM-WIKI-05 | AI-enhanced search rerank | MiniSearch fuzzy → fast-tier rerank if <3 results |
| LLM-WIKI-06 | "Ask your notes" RAG with citations | NoteQA: MiniSearch + MemoryEngine + balanced synthesis |
| LLM-WIKI-07 | "Save to note" → NoteChatConverter draft | Conversation messages + MemoryEngine.assemble() → NoteEditor |
| LLM-WIKI-08 | Staleness detection | summaryGeneratedAt/tagsGeneratedAt vs updated comparison |
| LLM-WIKI-09 | Orphan detection (0 links + 0 backlinks) | NoteGraph.computeBacklinks() → badge |
| LLM-WIKI-10 | "Re-analyze all notes" user-initiated | Sequential batch with real-time stats |
| LLM-WIKI-11 | Confidence gating (threshold 0.60, max 3 facts/5 tags) | gateSuggestions() in schemas.ts |
| SYNC-01 | showDirectoryPicker Standalone-only; IDB store | notes_backup_config store in NotesDB v4 migration |
| SYNC-02 | queryPermission on mount; banner if denied | NoteFileSync init verifies handle permission |
| SYNC-03 | Per-save .md write; 50ms debounce; fire-and-forget | Debounced sync after note:saved event |
| SYNC-04 | OKF v0.2 YAML frontmatter | serializeNoteToMarkdown() with yaml library |
| SYNC-05 | Title collision → numeric suffix | Scan existing files before write |
| SYNC-06 | External-change guard (2s tolerance) | Compare lastModified vs lastSyncTimestamp |
| SYNC-07 | No folder → no-ops; "Backup: off" | handle null → all ops become no-ops |
| SYNC-08 | Status Tag (On/Off/Error) | UI indicator from NoteSyncState |
| SYNC-09 | Restore from backup via showDirectoryPicker | Walk tree → parse frontmatter → upsert by id |
| SYNC-10 | Restore preview modal | "Found N notes (X new, Y updated, Z unchanged)" |
| SYNC-11 | Delete-on-sync removes .md + empty folders | NoteFileSync handles deletion |
| NMEM-01 | Memory-aware RAG | NoteQA includes MemoryEngine.retrieveMemoryHints() |
| NMEM-02 | On-save memory fact extraction | NoteTagger → MemoryExtractor → MemoryEngine.upsert() |
| NMEM-03 | "Save from chat" uses MemoryEngine.assemble() | NoteChatConverter calls assemble() for context |
| WIKI-ID-01 | Immutable UUID identity | id from crypto.randomUUID(), never changes |
| WIKI-ID-02 | [[Title]] syntax, resolveLinks() on save | LinkParser.parseLinks + resolveLinks (existing) |
| WIKI-ID-03 | Unresolved links in unresolvedLinks[] | LinkParser returns unresolved targets |
| WIKI-ID-04 | Deletion doesn't rewrite bodies; demote to unresolved | LinkParser.demoteDangling (existing) |
| OKF-WIKI-01 | type default 'Note' | OKF_NOTE_DEFAULT_TYPE constant |
| OKF-WIKI-02 | generated/status trust-lifecycle families | generated: {by, at}, status: 'draft'|'stable' |
| OKF-WIKI-03 | id as OKF extension key for round-trip | id in frontmatter preserves identity on restore |
| OKF-WIKI-04 | v0.1 boundary — NO OKF markdown-link edges | Wikilinks stay in body; verified in DONE-when |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| yaml ^2.9.0 | NoteFileSync frontmatter | ✗ Must install | 2.9.0 on npm | None — required |
| @types/wicg-file-system-access | NoteFileSync types | ✗ Must install | 2023.10.7 on npm | None — required |
| minisearch ^7.2.0 | NoteQA retrieval | ✓ | 7.2.0 | — |
| idb ^8.0.3 | notes_backup_config store | ✓ | 8.0.3 | — |
| zod ^4.4.3 | Schema validation | ✓ | 4.4.3 | — |
| File System Access API | NoteFileSync | ✓ (Standalone/Chrome) | Browser native | Sync disabled in side panel |

**Missing dependencies with no fallback:**
- yaml@^2.9.0 — must install before NoteFileSync can compile
- @types/wicg-file-system-access@^2023.10.5 — must install for type safety

**Missing dependencies with fallback:**
- File System Access API unavailable in side panel → sync disabled (per SYNC-07, by design)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.7 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test -- tests/core/notes/NoteTagger.test.ts` |
| Full suite command | `pnpm run verify:phase-9` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | categoryPath normalization | unit | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| LLM-WIKI-01 | Single LLM call returns structured JSON | unit (mocked provider) | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| LLM-WIKI-11 | Confidence gating drops below 0.60 | unit | `pnpm test -- tests/core/notes/schemas.test.ts` | ❌ Wave 0 |
| LLM-WIKI-06 | NoteQA RAG with citations | unit (mocked MiniSearch + MemoryEngine) | `pnpm test -- tests/core/notes/NoteQA.test.ts` | ❌ Wave 0 |
| SYNC-04 | OKF frontmatter serialization round-trip | unit | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| SYNC-09 | Restore preserves UUID + wikilinks | unit (mocked FS) | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| NMEM-02 | Memory fact routing via MemoryEngine | unit | `pnpm test -- tests/core/notes/NoteTagger.test.ts` | ❌ Wave 0 |
| WIKI-ID-01 | UUID identity preserved on restore | unit | `pnpm test -- tests/core/notes/NoteFileSync.test.ts` | ❌ Wave 0 |
| v4 migration | Idempotent store creation + Note.type | unit (fake-indexeddb) | `pnpm test -- tests/core/storage/migrations/v4-notes-backup-config.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- tests/core/notes/{module}.test.ts`
- **Per wave merge:** `pnpm run verify:phase-9`
- **Phase gate:** Full verify:phase-9 green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/notes/NoteTagger.test.ts` — covers LLM-WIKI-01/11, NMEM-02
- [ ] `tests/core/notes/NoteQA.test.ts` — covers LLM-WIKI-06
- [ ] `tests/core/notes/NoteChatConverter.test.ts` — covers LLM-WIKI-07, NMEM-03
- [ ] `tests/core/notes/NoteFileSync.test.ts` — covers SYNC-04/09/11, WIKI-ID-01, OKF-WIKI-03
- [ ] `tests/core/notes/NoteMaintenance.test.ts` — covers LLM-WIKI-08/09/10
- [ ] `tests/core/notes/schemas.test.ts` — covers LLM-WIKI-11 gateSuggestions
- [ ] `tests/core/storage/migrations/v4-notes-backup-config.test.ts` — covers v4 idempotency
- [ ] Package install: `pnpm add yaml@^2.9.0 && pnpm add -D @types/wicg-file-system-access@^2023.10.5`
- [ ] Gate re-point: verify:phase-9 to spec §24 scope

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | zod schemas for all LLM outputs (NoteTagResultSchema, NoteQAResultSchema, NoteDraftSchema) |
| V6 Cryptography | no | — |
| V7 Error Handling | yes | debugLog + TraceRedactor before persist/log/disk (§27.6) |

### Known Threat Patterns for Chrome MV3 + LLM

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM prompt injection via note content | Tampering | Note content is untrusted data (CTX-02); system prompts separate from user content; structured output via JSON schema |
| Sensitive data in backup files | Information Disclosure | TraceRedactor before disk write (§27.6); password values never written (§16.4) |
| Malformed YAML frontmatter | Tampering | yaml library handles escaping; restore parser tolerates unknown keys (OKF §11) |
| Stale async suggestions applied to newer content | Tampering | version-check on NoteTagger response (LLM-WIKI-11) |

## Sources

### Primary (HIGH confidence)
- `src/types/notes.ts` — canonical Note interface, OkfNoteFrontmatter, OKF_NOTE_DEFAULT_TYPE, NOTE_SUGGESTION_DISPLAY_THRESHOLD [VERIFIED: src/types/notes.ts:26-81]
- `src/core/storage/NotesDB.ts` — NotesDB schema, openNotesDB, NOTES_DB_VERSION=1 [VERIFIED: src/core/storage/NotesDB.ts:26-89]
- `src/core/ai/StructuredOutput.ts` — requestJson with repair loop [VERIFIED: src/core/ai/StructuredOutput.ts:46-107]
- `src/core/storage/IndexedDBMigrator.ts` — registerMigration, openVersionedDB [VERIFIED: src/core/storage/IndexedDBMigrator.ts:52-157]
- `src/core/memory/MemoryEngine.ts` — retrieveMemoryHints, retrieveUserMemory [VERIFIED: src/core/memory/MemoryEngine.ts:33-116]
- `src/core/memory/MemoryExtractor.ts` — memoryFactsSchema, parseMemoryFacts [VERIFIED: src/core/memory/MemoryExtractor.ts:14-78]
- `src/core/search/MiniSearchIndex.ts` — query, buildIndex, NoteDoc, NOTE_SEARCH_FIELDS [VERIFIED: src/core/search/MiniSearchIndex.ts:39-155]
- `src/core/notes/LinkParser.ts` — parseLinks, resolveLinks, demoteDangling [VERIFIED: src/core/notes/LinkParser.ts:25-100]
- `src/core/events/EventBus.ts` — on/emit for note:saved [VERIFIED: src/core/events/EventBus.ts:16-54]
- `src/core/ai/ProviderRouter.ts` — route(), ProviderRouteInput [VERIFIED: src/core/ai/ProviderRouter.ts:198-283]
- `src/core/ai/ILLMProvider.ts` — ILLMProvider interface, requestJson [VERIFIED: src/core/ai/ILLMProvider.ts:42-46]

### Secondary (MEDIUM confidence)
- `.planning/PRODUCT_SPEC_v0_1.md` §27.3 SYNC-04 — OKF frontmatter field table (spec 3830-3863)
- `.planning/PRODUCT_SPEC_v0_1.md` §24 verify:phase-9 — `tests/core/notes tests/core/storage/migrations` (spec 3613)
- `.planning/PRODUCT_SPEC_v0_1.md` §20.4 — v4 migration policy (spec 3156)
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 — NoteTagResultSchema, gateSuggestions (spec 4764-4786)
- `.planning/phases/09-llm-wiki-filesystem-sync/09-CONTEXT.md` — D-115…D-125 decisions

### Tertiary (LOW confidence)
- npm registry: yaml@2.9.0 exists (verified via npm view)
- npm registry: @types/wicg-file-system-access@2023.10.7 exists (verified via npm view)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm view; integration targets read from source
- Architecture: HIGH — all integration points confirmed by reading source files
- Pitfalls: HIGH — based on existing codebase patterns and MV3 constraints

**Research date:** 2026-09-01
**Valid until:** 2026-10-01 (stable — core dependencies unchanged)
