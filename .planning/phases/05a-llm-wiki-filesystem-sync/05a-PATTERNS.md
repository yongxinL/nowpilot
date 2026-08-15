# Phase 5a: LLM-Wiki & Filesystem Sync - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 21 new/modified + 6 tests
**Analogs found:** 18 / 21 (3 with no exact codebase analog — new platform surface)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/notes/NoteTagger.ts` | service | request-response (one-shot haiku) | `src/core/memory/MemoryExtractor.ts` | exact |
| `src/core/notes/NoteQA.ts` | service | request-response (RAG synthesis) | `MemoryExtractor.ts` (AI machinery) + `src/core/search/MiniSearchIndex.ts` (retrieval) + `MemoryEngine.assemble()` (context) + `useStreamingLLM.ts` (tier resolution) | exact (composition of 4) |
| `src/core/notes/NoteChatConverter.ts` | service | request-response (one-shot haiku) | `src/core/memory/MemoryExtractor.ts` | exact |
| `src/core/notes/NoteFileSync.ts` | service | file-I/O (FS Access API) | **none** — new platform surface; `src/core/storage/ImportExport.ts` (parse/merge precedent) + `src/core/storage/NotesDB.ts` (Note shape) | partial (parse precedent only) |
| `src/core/notes/NoteMaintenance.ts` | service | batch/transform (pure, no LLM) | `src/core/notes/NoteGraph.ts` (pure derivations) | role-match |
| `src/components/notes/SaveToNoteDialog.tsx` | component | request-response (modal dialog) | `src/components/OnboardingModal.tsx` (dialog surface) + `NotesPage.tsx` tag-chips/Popconfirm + `ChatPage.tsx` footer actions | partial (no antd `Modal` exists yet) |
| `src/components/options/NotesSection.tsx` | component | config (CRUD toggles) | `OptionsPage.tsx` content-trust Card + `src/core/registry/TrustSettingsStore.ts` (toggle store) | exact |
| `src/components/options/ImportExportSection.tsx` | component | file-I/O (restore from folder) | `OptionsPage.tsx` Card section + `ImportExport.ts` merge core | role-match |
| `src/core/storage/migrations/v4_notes_backup_config.ts` | migration | batch (schema upgrade) | `MemoryDB.ts` `userFactsV2Migration` (L97-140) + `IndexedDBMigrator.ts` runner | exact |
| `tests/core/notes/{NoteTagger,NoteQA,NoteChatConverter}.test.ts` | test | request-response (stubbed LLM) | `tests/core/memory/MemoryExtractor.test.ts` (`makeStub` closure) | exact |
| `tests/core/notes/NoteFileSync.test.ts` | test | file-I/O (mock FS handles) | **none** — needs `tests/core/notes/fixtures/mockFsHandle.ts` (plain-object mock) | no analog |
| `tests/core/notes/NoteMaintenance.test.ts` | test | batch (pure) | `tests/core/notes/NoteGraph.test.ts` | exact |
| `tests/core/storage/migrations/v4.test.ts` | test | batch (fake-indexeddb) | `tests/core/storage/IndexedDBMigrator.test.ts` / `MemoryDB.test.ts` | exact |
| `src/core/ai/persona/PersonaInjector.ts` (MODIFIED) | config | — | `PersonaInjector.ts` L27 union (`'planner'\|'executor'\|'renderer'\|'memoryExtractor'`) | in-place edit |
| `src/core/prompts/index.ts` (MODIFIED) | config | — | `PROMPTS.noteQA` L89-94 (amend to JSON contract) | in-place edit |
| `src/core/error/errorCodes.ts` (MODIFIED) | config | — | Phase-5 block L105-118 (`MEMORY_EXTRACT_FAILED` precedent) | in-place edit |
| `src/core/storage/NotesDB.ts` (MODIFIED) | config | — | `DB_VERSION` L67 + `openNotesDB` L73-82 (bump to v4, route through `runMigrations`) | in-place edit |
| `src/core/storage/Setting.ts` (MODIFIED) | config | — | `STORAGE_KEY_REGISTRY` L60-82 (`np_persona` precedent) | in-place edit |
| `src/components/pages/NotesPage.tsx` (MODIFIED) | component | CRUD + event-driven | same file — `handleSave` L331-386 (hook NoteTagger/NoteFileSync) + toolbar L787-830 (Ask-notes + backup Tag) | in-place edit |
| `src/components/pages/ChatPage.tsx` (MODIFIED) | component | request-response | same file — `items` map L128-184 (add "Save to note" overflow on assistant bubbles) | in-place edit |
| `src/components/pages/OptionsPage.tsx` (MODIFIED) | component | config | same file — Card layout L74-113 (insert NotesSection + ImportExportSection) | in-place edit |
| `package.json` (MODIFIED) | config | — | `verify:phase-5` L26 pattern (add `verify:phase-5a`) | in-place edit |

---

## Pattern Assignments

### `src/core/notes/NoteTagger.ts` (service, request-response — haiku tier)

**Analog:** `src/core/memory/MemoryExtractor.ts` (verified Phase-5 code — copy the shape verbatim)

**Imports pattern** (MemoryExtractor.ts L16-29):
```typescript
import { z } from 'zod';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { estimateTokens } from '@/core/context/TokenBudget';
import { PersonaInjector } from '@/core/ai/persona/PersonaInjector';
import type { PersonaProfile } from '@/core/ai/persona/PersonaProfile';
import { PROMPTS } from '@/core/prompts';
import {
  isStructuredOutputFailed,
  requestJson,
  type StructuredOutputContext,
} from '@/core/ai/StructuredOutput';
import type { PromptSection, ProviderId } from '@/core/ai/types';
```
*(plus `import type { Note } from '@/core/storage/NotesDB';` for the input shape)*

**Zod contract** (MemoryExtractor.ts L31-45 — the 5a schema is seeded in `PROMPTS.noteTagger`, RESEARCH Pattern "Haiku service wiring"; NoteTagger's own schema lives in NoteTagger.ts):
```typescript
export const NoteTaggerResultSchema = z.object({
  tags: z.array(z.object({ value: z.string().min(1), confidence: z.number().min(0).max(1) })).max(10),
  categoryPath: z.string().nullable(),
  summary: z.string().min(1),
  memoryFacts: z.array(z.object({ content: z.string().min(1), confidence: z.number().min(0).max(1) })).max(10),
});
```

**Options interface** (MemoryExtractor.ts L47-60 — `operationId` required; `providerId ?? 'anthropic'`, `model ?? 'claude-haiku-4-latest'`, `timeoutMs ?? 30_000`, `abortSignal` optional):
```typescript
export interface ExtractMemoryOptions {
  operationId: string;
  persona?: PersonaProfile;
  prefs?: UserPreferences;
  providerId?: ProviderId;      // Default: 'anthropic'
  model?: string;               // Default: 'claude-haiku-4-latest'
  timeoutMs?: number;           // Default: 30s
  abortSignal?: AbortSignal;
}
```

**Core pattern — GR-3 inject + F-4 sections + requestJson + never-throws** (MemoryExtractor.ts L77-139, THE template):
```typescript
const system = PersonaInjector.inject('noteTagger', PROMPTS.noteTagger.system, {
  persona: opts.persona,
  prefs: opts.prefs,
});
const inputText = JSON.stringify({ title: note.title, content: note.content });
const sections: PromptSection[] = [
  { kind: 'system', text: system, tokens: estimateTokens(system), stable: true, sourceId: 'note-tagger' },
  { kind: 'user_input', text: inputText, tokens: estimateTokens(inputText), stable: false, sourceId: 'note-tagger-input' },
];
try {
  const result = await requestJson(NoteTaggerResultSchema, sections, {
    operationId: opts.operationId,
    providerId: opts.providerId ?? 'anthropic',
    model: opts.model ?? 'claude-haiku-4-latest',
    timeoutMs: opts.timeoutMs ?? 30_000,
    callProviderJsonMode,
    abortSignal: opts.abortSignal ?? new AbortController().signal,
  });
  return result;   // mapped shape; memoryFacts route to MemoryEngine.addFacts (NMEM-02, single-writer D-05)
} catch (err) {
  debugLog(
    ERROR_CODES.NOTE_TAGGER_FAILED,   // NEW code — see errorCodes.ts edit below
    isStructuredOutputFailed(err) ? 'note tagging failed after one repair' : 'note tagging failed',
    { module: 'NoteTagger', extra: { operationId: opts.operationId } },  // R-10: code + op ONLY
  );
  return null;   // §22.1: NEVER throws, NEVER blocks the save
}
```

**Confidence gating (LLM-WIKI-11, display-side)** — the caller (NotesPage suggestion store) applies after `analyze` returns:
```typescript
const DISPLAY_THRESHOLD = 0.60;
const MAX_TAGS = 5;
const MAX_FACTS = 3;
const displayableTags = (result?.tags ?? [])
  .filter((t) => t.confidence >= DISPLAY_THRESHOLD)
  .sort((a, b) => b.confidence - a.confidence)
  .slice(0, MAX_TAGS);   // below-threshold items silently discarded — NEVER stored
```

**Fire-and-forget call site** (NotesPage.handleSave, after `putNote` + postcondition — §22.1):
```typescript
await putNote(dbRef.current!, note);
const persisted = await getNote(dbRef.current!, note.id);   // postcondition evidence
// ...then NEVER awaited:
void NoteTagger.analyze({ id: note.id, version: note.version, title, content }, opts)
  .then((suggestion) => suggestionStore.setFor(note.id, note.version, suggestion))
  .catch(() => {});   // analyze() already returns null — belt-and-braces
```

### `src/core/notes/NoteQA.ts` (service, request-response — flash tier RAG)

**Analog:** MemoryExtractor AI machinery (flash defaults) + MiniSearchIndex retrieval + MemoryEngine.assemble context + useStreamingLLM tier check.

**Retrieval pattern** (`src/core/search/MiniSearchIndex.ts` L84-100 — no `limit` search option; slice AFTER search):
```typescript
export function searchNotes(index, query, opts?: { limit?: number }): Array<{ id: string; score: number }> {
  if (!query || query.trim().length === 0) return [];
  const results = index.search(query, { prefix: true, fuzzy: 0.2, boost: { title: 2, tags: 1.5 } });
  const top = results[0]?.score ?? 1;
  return results.slice(0, opts?.limit ?? 10).map((r) => ({ id: r.id as string, score: top > 0 ? r.score / top : 0 }));
}
```
NoteQA: `searchNotes(index, question, { limit: 5 })` → top-5; **zero hits → return the "no matching notes" result with 0 provider calls** (D-05a-08).

**Memory context** (`src/core/memory/MemoryEngine.ts` L158-246 — `assemble(db, deps, { query, conversationId, tier })` returns `{ memories, workingMemoryBlock, preferences }`; ≤3 facts used; NEVER more). NMEM-01 facts ride the `user_input`/`context` section as `stable: false` **untrusted** data (GR-7 — the `UNTRUSTED_DATA_SEMANTICS` anchor stays in `PROMPTS.noteQA`).

**Flash-tier resolution** (`src/components/pages/useStreamingLLM.ts` L173-180, L196 — NoteQA mirrors this):
```typescript
const invocation = getProviderRouter().createStageInvocation({
  operationId, tier: 'flash', maxTokens: 1024,
  privacyMode: privacyModeFromPrefs(prefs), configuredProviders: configuredFromRegistry(),
});
const tier = classifyModelContext(invocation.modelContextWindow);   // tiny → plain MiniSearch, 0 calls (D-05a-07)
```
NoteQA still calls `requestJson(NoteQAResultSchema, sections, { ...invocation-provided providerId/model, callProviderJsonMode, abortSignal })` — the SAME MemoryExtractor catch → `debugLog(NOTE_QA_FAILED, ...)` → `null` shape.

**Structured contract (D-05a-06 — amended `PROMPTS.noteQA`; citations carry noteId for clickable Tags):**
```typescript
export const NoteQAResultSchema = z.object({
  answer: z.string().min(1),                       // markdown, cited per statement
  citations: z.array(z.object({ noteId: z.string().min(1), title: z.string().min(1) })).max(5),
});
```

### `src/core/notes/NoteChatConverter.ts` (service, request-response — haiku tier)

**Analog:** MemoryExtractor verbatim (same imports/sections/requestJson/catch shape; stage `'noteChatConvert'`; `PROMPTS.noteChatConvert` L95-100 already seeds the `{title, content, tags<=5, categoryPath, wikilinks}` contract). Input = bounded conversation excerpt (last N messages — NEVER the full transcript) + `MemoryEngine.assemble()` facts (NMEM-03) via the `user_input` section. Failure → `debugLog(NOTE_CONVERT_FAILED, ...)` → `null`; the dialog shows a generic draft state.

### `src/core/notes/NoteFileSync.ts` (service, file-I/O — NEW FS Access API surface)

**No codebase analog** — the File System Access API has no existing consumer. Pattern sources:

**Handle persistence (D-08 — IndexedDB store, never chrome.storage):** `FileSystemHandle` is `[Serializable]`; persist the directory handle via idb `put` into the new `notes_backup_config` store (see v4 migration below). On mount: `await handle.queryPermission({ mode: 'readwrite' })` → not `'granted'` → sync disabled + Re-select banner (D-05a-16 — NO auto-reprompt).

**Write path (WICG verified — createWritable/write/close; changes flush on close):**
```typescript
async function writeFile(dirHandle: FileSystemDirectoryHandle, relPath: string[], contents: string): Promise<void> {
  let cur = dirHandle;
  for (const seg of relPath.slice(0, -1)) cur = await cur.getDirectoryHandle(seg, { create: true });
  const fileHandle = await cur.getFileHandle(relPath[relPath.length - 1], { create: true });
  const writable = await fileHandle.createWritable();   // throws DOMException if no write permission
  await writable.write(contents);
  await writable.close();
}
```
**Frontmatter serialize (SYNC-04 — `yaml` `stringify`, RESEARCH Code Example):**
```typescript
import { stringify } from 'yaml';
function serializeNote(note: Note): string {
  return `---\n${stringify({
    id: note.id, created: note.created, updated: note.updated,
    tags: note.tags, categoryPath: note.categoryPath, summary: note.summary,
  })}---\n\n${note.content}`;   // stringify always ends '\n'; stringify omits undefined
}
```

**Parse/restore precedent (`src/core/storage/ImportExport.ts`):** mirror `parseImportPayload` L293-306 (validate-then-use), `isNote` L399-414 (record-level shape gate — the frontmatter Zod `MetaSchema` from RESEARCH replaces the manual guards), `skipMalformed` L502-515 (log-and-skip malformed, never persist), and `mergeNotes` L592-634 for the additive upsert (SYNC-09 recency check: preserve local when local `updated` ≥ folder `updated`; never delete local notes absent from the folder — SYNC-10):
```typescript
// ImportExport.ts L598-609 — the additive upsert skeleton restore mirrors:
for (const note of data.notes ?? []) {
  if (!isNote(note)) { skipMalformed('note', note); continue; }
  const existing = await getNote(db, note.id);
  if (existing !== undefined && existing.updated >= note.updated) { kept++; continue; }  // recency
  await putNote(db, note); upserted++;
}
```

**Error/redaction:** `redactSensitive` before every `.md` write + log (§27.6/R-10 — same import as ImportExport.ts L38-39); filename sanitization `/ \ : * ? " < > |` → `_` (inline regex, fixed 8-char set); external-change guard `(await fileHandle.getFile()).lastModified > lastSyncAt + 2_000` → confirm (default Skip); delete-on-sync via `removeEntry` + empty-folder cleanup via `values()`. Tests use **plain-object mock handles** injected via structural DI (Pitfall 7) — never real handles, never fake-indexeddb clones.

### `src/core/notes/NoteMaintenance.ts` (service, batch/transform — pure, no LLM)

**Analog:** `src/core/notes/NoteGraph.ts` — pure + deterministic derived functions over `Note[]` (no wall-clock, no RNG, no store writes; UI consumes derived data only, L10-13).

**Pattern — pure exported functions (NoteGraph.ts L87-112 shape):**
```typescript
// NoteGraph.ts — the module shape NoteMaintenance copies (pure, typed, deterministic):
export function backlinkIndex(notes: readonly Pick<Note, 'id' | 'links'>[]): Map<string, string[]> { ... }
```
NoteMaintenance exports: `isStale(note, nowMs)` (LLM-WIKI-08 — `updated > summaryGeneratedAt/tagsGeneratedAt`), `isOrphan(note, backlinks)` (LLM-WIKI-09 — `links.length === 0 && backlinks.length === 0`), and a sequential bulk re-analysis coordinator (LLM-WIKI-10 — real-time stats, honors `np_notes_llm_features` toggles; toggle off → **0 LLM calls**). Determinism rule: `nowMs` injected (NoteGraph L10-13 precedent); orphan detection reuses `NoteGraph.backlinkIndex`.

### `src/components/notes/SaveToNoteDialog.tsx` (component, request-response — modal)

**Analog:** no antd `Modal` exists yet — compose from:
- **Dialog surface:** `src/components/OnboardingModal.tsx` L54-77 (ErrorBoundary-wrapped Card dialog, STR-driven copy, never-throws store calls).
- **Editable draft fields:** `NotesPage.tsx` tag chips L1037-1071 (closable `Tag` + add-Input) and title Input L936-945 — the dialog reuses these field patterns for the LLM-drafted `{title, content, tags, categoryPath, wikilinks}`.
- **Per-message entry point:** `ChatPage.tsx` footer actions L156-181 — the "Save to note" overflow affordance on assistant bubbles follows this footer/action pattern (D-05a-09).

**Modal state + confirm pattern (antd `Modal`, from RESEARCH Standard Stack):** `open`/`onOk`/`onCancel`; Save → `putNote` via `openNotesDB()` (never throws — `STORE_WRITE` log, NotesDB L85-95) → `getEventBus().emit('note:saved', { noteId })` → close; Cancel → discard draft. Side-panel saves open in the side panel (R-3), the note appears in Standalone via the existing `note:saved` refresh (NotesPage L197-218).

### `src/components/options/NotesSection.tsx` + `ImportExportSection.tsx` (components, config)

**Analog (exact):** `OptionsPage.tsx` content-trust Card L91-112 + `TrustSettingsStore.ts` (the toggle-store pattern).

**Card section pattern (OptionsPage.tsx L91-112 — new sections are sibling `<Card>`s inside the same ErrorBoundary):**
```tsx
<Card title={STR.options.contentTrust}>
  <Typography.Text type="secondary">{STR.options.trustHelper}</Typography.Text>
  <Divider style={{ margin: '12px 0' }} />
  {TRUST_SOURCES.map((row) => (
    <div key={row.kind} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Typography.Text>{row.label}</Typography.Text>
      <Switch checked={prefs[row.kind]} onChange={(on) => void handleTrustToggle(row.kind, on)} />
    </div>
  ))}
</Card>
```

**Toggle-store pattern (`src/core/registry/TrustSettingsStore.ts` L79-125 — NotesSection's `np_notes_llm_features` store copies this):** zustand store over `{ prefs }`, `chrome.storage.local` write-through (NOT zustand storage middleware — Pitfall 7), Zod-gated parse on init (`parseTrustPrefs` L52-60), optimistic set + rollback on write failure (L111-125), `chrome.storage.onChanged` remove-then-add listener (L96-108, T-1-11). Registration: add `np_notes_llm_features: { area: 'local' }` to `STORAGE_KEY_REGISTRY` (Setting.ts L60-82 — `np_persona` precedent).

**Backup-folder config (D-05a-14):** `showDirectoryPicker({ mode: 'readwrite', id: 'nowpilot-backup' })` runs **Standalone-only** (extension-context failures — RESEARCH Pitfall 1); the returned handle persists via idb into `notes_backup_config` (structured clone — never chrome.storage). NotesSection also hosts the "Re-analyze all notes" control (LLM-WIKI-10, user-initiated + sequential with real-time stats).

**ImportExportSection "Restore from folder" (D-05a-17):** `showDirectoryPicker` → walk tree (`values()` + `getFileHandle`) → `parseMarkdownNote` per file → preview Modal "Found N notes (X new, Y updated, Z unchanged)" → additive upsert through the `mergeNotes`-style path (ImportExport.ts L592-634). Confirm dialog uses antd `Modal` (RESTORE strings already seeded — `STR.notes.restorePreview`).

### `src/core/storage/migrations/v4_notes_backup_config.ts` (migration)

**Analog (exact):** `src/core/storage/MemoryDB.ts` `userFactsV2Migration` L97-140 + registry entry L143-147.

**Migration shape (IndexedDBMigrator.ts L45-50 interface; MemoryDB.ts L97-140 pattern — guarded store creation + sync dispatch, never await inside upgrade):**
```typescript
export const notesBackupConfigV4Migration: IndexedDBMigration = {
  fromVersion: 1,   // NotesDB is at DB_VERSION 1 today (NotesDB.ts L67)
  toVersion: 4,     // spec §18 line 2832 "v4 migration idempotent"
  description: 'v1→v4: add notes_backup_config store (FileSystemDirectoryHandle)',
  migrate(db, tx) {
    // Fresh-install guard — the runner fires every step in [oldVersion, newVersion):
    if (!db.objectStoreNames.contains('notes')) {
      const notes = db.createObjectStore('notes', { keyPath: 'id' });
      notes.createIndex('by-updated', 'updated');
      notes.createIndex('by-tags', 'tags', { multiEntry: true });
    }
    if (!db.objectStoreNames.contains('concepts')) {
      db.createObjectStore('concepts', { keyPath: 'slug' });
    }
    if (!db.objectStoreNames.contains('notes_backup_config')) {
      db.createObjectStore('notes_backup_config', { keyPath: 'id' });   // the FS handle row
    }
    return Promise.resolve();
  },
};

export const notesDBMigrations: DBVersionMigration = {
  dbName: 'NotesDB',
  dbVersion: 4,
  migrations: [notesBackupConfigV4Migration],
};
```
**Critical wiring (RESEARCH Pitfall 8):** `openNotesDB()` (NotesDB.ts L73-82) must route through `runMigrations(notesDBMigrations)` at the bumped version — otherwise a warm-open at v1 + migrator at v4 hits `onblocked` (an open connection blocks the upgrade). No data-carve on existing Note rows (fields already shipped in Phase 5 — A4).

### `src/core/ai/persona/PersonaInjector.ts` (MODIFIED — PipelineStage union)

**In-place edit (L27):**
```typescript
export type PipelineStage = 'planner' | 'executor' | 'renderer' | 'memoryExtractor'
  | 'noteTagger' | 'noteQA' | 'noteChatConvert';
```
`inject()` L53-63 needs no other change — the persona block stays byte-stable (prompt-cache invariant).

### `src/core/prompts/index.ts` (MODIFIED — noteQA JSON contract)

**In-place edit (L89-94):** amend `PROMPTS.noteQA.system` to the JSON contract (Phase-5a-owned prompt — RESEARCH Open Q1 resolved): `{answer: string, citations: [{noteId, title}]}` + keep the `UNTRUSTED_DATA_SEMANTICS` anchor ("Answer only from the provided notes; if the notes do not contain the answer, say so"). `noteTagger`/`noteChatConvert` L83-100 are already correct.

### `src/core/error/errorCodes.ts` (MODIFIED)

**In-place edit (after L115, Phase-5 block):**
```typescript
NOTE_TAGGER_FAILED: 'NOTE_TAGGER_FAILED',
NOTE_QA_FAILED: 'NOTE_QA_FAILED',
NOTE_CONVERT_FAILED: 'NOTE_CONVERT_FAILED',
```
Patterned on `MEMORY_EXTRACT_FAILED` L112 — logs carry code + module + operationId only (R-10).

### `src/components/pages/NotesPage.tsx` (MODIFIED)

**Hook points (all verified in the current file):**
1. **Save pipeline** — after `putNote` + postcondition `getNote` (L365-373): fire `void NoteTagger.analyze(...)` and `void NoteFileSync.scheduleWrite(...)` (50ms debounce, SYNC-03) — NEVER awaited (§22.1). Failure degrades to `STR.notes.taggerFailed` hint.
2. **Toolbar** (L787-830) — add the Ask-notes inline input (D-05a-05, `STR.notes.askPlaceholder` L59) + inline answer card (Bubble + citation Tags, D-05a-06) + backup status `Tag` (`STR.notes.backupOn/Off/Error` L63-65) + Configure button + permission-loss banner (D-05a-16, `STR.notes.backupBannerLost` L67).
3. **Editor suggestion bar** (D-05a-01) — new dismissible bar near the top of the editor column (L933-1011 area); tag chips reuse the L1037-1071 pattern; category inline path input (D-05a-03) with AntD `status="error"` red border for invalid segments (CAT-05).
4. **Orphan badge "Find context"** (D-05a-13) — NoteMaintenance `isOrphan` on the note card (L647-748) → triggers NoteQA RAG.

### `src/components/pages/ChatPage.tsx` (MODIFIED)

**Hook point:** the `items` map L128-184 — add a "Save to note" overflow action on assistant bubbles (D-05a-09) following the existing `footer` pattern (L156-181): `m.role === 'assistant' && m.status === 'completed'` → action button → `NoteChatConverter.convert(messages)` → `SaveToNoteDialog` (side-panel in place, D-05a-12). No prompt assembly in the component (GR-3 — the converter is the core).

### `src/components/pages/OptionsPage.tsx` (MODIFIED)

**Hook point:** insert `<NotesSection />` and `<ImportExportSection />` as sibling Cards after the content-trust Card (L91-112 pattern; `STR.options.*` copy seeded).

---

## Shared Patterns

### Authentication
**N/A** — local-first single-user extension; no auth in 5a (ASVS V2/V3 n/a). The only "permission" surface is the File System Access permission model: pick-time grant + `queryPermission` re-check on mount + Re-select banner (SYNC-02, D-05a-16).

### Error Handling (Golden Rule 9 + R-10)
**Source:** `src/core/error/errorCodes.ts` L7-118 + `debugLog` usage in `MemoryExtractor.ts` L131-137.
**Apply to:** All five services + UI save paths.
```typescript
catch (err) {
  debugLog(ERROR_CODES.NOTE_TAGGER_FAILED, 'note tagging failed', {
    module: 'NoteTagger', extra: { operationId: opts.operationId } });  // code + module + op ONLY
  return null;   // never throws, never blocks (services)
}
```
Rules: every catch logs a canonical code (never free-form); never log raw model bodies / note content / FS paths; failures degrade to null/hint — never a blocking error; stores reuse `STORE_READ`/`STORE_WRITE` (never new codes for idb).

### Validation (GR-4 / Zod)
**Source:** `src/core/ai/StructuredOutput.ts` L92-167 (`requestJson` — zodToJsonSchema → attempt → safeParse → **exactly one repair** → `STRUCTURED_OUTPUT_FAILED`; `maxRetries: 0` at the router; never hand-parse).
**Apply to:** All NoteTagger/NoteQA/NoteChatConverter calls; frontmatter parse on restore (Zod `MetaSchema`, RESEARCH Code Example — `parseDocument` never throws).
```typescript
// The ONLY structured-output gate — never regex JSON surgery:
const result = await requestJson(NoteTaggerResultSchema, sections, {
  operationId, providerId: opts.providerId ?? 'anthropic', model: opts.model ?? 'claude-haiku-4-latest',
  timeoutMs: opts.timeoutMs ?? 30_000, callProviderJsonMode,
  abortSignal: opts.abortSignal ?? new AbortController().signal,
});
```

### AI-call routing (GR-3 / PersonaInjector)
**Source:** `src/core/ai/persona/PersonaInjector.ts` L53-63.
**Apply to:** Every AI call — `PersonaInjector.inject(stage, PROMPTS.<stage>.system, { persona, prefs })`; sections: `system` `stable: true` + `user_input` `stable: false` (F-4 — repair appends a section, never rebuilds the cached prefix). `estimateTokens` is the ONLY token counter.

### Non-blocking fire-and-forget (§22.1)
**Source:** `NotesPage.tsx` L365-378 (`void reconcileAfterSave(note)` precedent).
**Apply to:** NoteTagger + NoteFileSync in `handleSave` — strictly AFTER `putNote` + postcondition, never awaited; failures degrade to seeded hints (`STR.notes.taggerFailed`).

### Memory single-writer (D-05)
**Source:** `src/core/memory/MemoryEngine.ts` L336-353 (`addFacts`) + L158-246 (`assemble`).
**Apply to:** NoteTagger memoryFacts → `MemoryEngine.addFacts` (NMEM-02, notes→memory ONLY); NoteQA/NoteChatConverter context → `MemoryEngine.assemble` (≤3 facts). Services never touch the memory stores directly (R-4).

### Retrieval (MiniSearch only)
**Source:** `src/core/search/MiniSearchIndex.ts` L84-100 (`searchNotes` → `{id, score}` normalized [0,1]).
**Apply to:** NoteQA + Ask-notes — slice top-5 AFTER search (minisearch 7.2 has no `limit`); zero hits → helpful message, 0 calls (D-05a-08); tiny tier → plain MiniSearch, 0 calls (D-05a-07).

### IndexedDB migration plumbing (D-14)
**Source:** `src/core/storage/IndexedDBMigrator.ts` L137-245 (`runMigrations`) + MemoryDB.ts L97-159.
**Apply to:** v4 migration + `openNotesDB` re-route — never hand-patch stores on open; guarded store creation; sync dispatch (never await inside upgrade); D-12 degraded mode on failure.

### Redaction (R-10 / §27.6)
**Source:** `src/core/storage/ImportExport.ts` L38-39 + L250-254 (`redactSensitive` + `assertNoSecrets`).
**Apply to:** Every `.md` write + any sync log/diagnostic — passwords never written; FS paths + note content redacted from Diagnostics/exports; RAG answers + page indexes ephemeral (never persisted).

### Testing
**Source:** `tests/core/memory/MemoryExtractor.test.ts` — the `makeStub` closure (L50-67) + 6-case shape (valid/defaults, one repair, STRUCTURED_OUTPUT_FAILED→null, provider reject→null, PersonaInjector route pin, schema boundary). `@vitest-environment node` for core AI tests; plain-object FS-handle mocks for NoteFileSync (never fake-indexeddb clones); fake-indexeddb for the v4 migration test.

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns + WICG/yaml docs):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/notes/NoteFileSync.ts` | service | file-I/O | File System Access API has no existing consumer; patterns from WICG spec + Chrome docs (RESEARCH Pattern 2); ImportExport.ts supplies the parse/merge precedent |
| `tests/core/notes/NoteFileSync.test.ts` | test | file-I/O | Needs a new shared fixture `tests/core/notes/fixtures/mockFsHandle.ts` (plain-object handle — RESEARCH Pitfall 7) |
| `src/components/notes/SaveToNoteDialog.tsx` | component | request-response | No antd `Modal` exists yet — compose from OnboardingModal (dialog surface) + NotesPage field patterns + ChatPage footer actions |

## Metadata

**Analog search scope:** `src/core/{memory,search,notes,ai,storage,error,prompts}`, `src/components/{pages,notes,options,OnboardingModal}`, `tests/core/{memory,storage,notes}`; knowledge-graph seams verified via direct read.
**Files scanned:** 20 analog files (all ≤ 1,177 lines — single-pass reads)
**Pattern extraction date:** 2026-08-14
