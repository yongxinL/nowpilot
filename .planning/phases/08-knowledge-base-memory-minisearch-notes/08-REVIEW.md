---
phase: 08-knowledge-base-memory-minisearch-notes
reviewed: 2026-09-01T12:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - src/components/notes/BacklinksPanel.tsx
  - src/components/notes/NoteGraphView.tsx
  - src/components/notes/WikilinkAutocomplete.tsx
  - src/core/ai/UserPreferences.ts
  - src/core/context/types.ts
  - src/core/memory/ConversationMemoryStore.ts
  - src/core/memory/MemoryEngine.ts
  - src/core/memory/MemoryExtractor.ts
  - src/core/memory/MemoryScorer.ts
  - src/core/memory/PreferenceMemoryStore.ts
  - src/core/memory/types.ts
  - src/core/memory/UserMemoryStore.ts
  - src/core/memory/WorkingMemory.ts
  - src/core/notes/LinkParser.ts
  - src/core/notes/NoteGraph.ts
  - src/core/notes/save.ts
  - src/core/search/MiniSearchIndex.ts
  - src/core/storage/MemoryDB.ts
  - src/core/storage/NotesDB.ts
  - src/core/storage/WriteJournal.ts
  - src/types/harness.ts
  - src/types/notes.ts
  - tests/components/notes/BacklinksPanel.test.tsx
  - tests/components/notes/NoteGraphView.test.tsx
  - tests/components/notes/WikilinkAutocomplete.test.tsx
  - tests/core/ai/persona/PersonaInjector.test.ts
  - tests/core/ai/PromptCacheManager.test.ts
  - tests/core/ai/UserPreferences.test.ts
  - tests/core/context/ContextOptimizer.test.ts
  - tests/core/context/trust/assemble-trust.test.ts
  - tests/core/context/trust/contextItems.test.ts
  - tests/core/context/trust/stable-prefix.snapshot.test.ts
  - tests/core/memory/ConversationMemoryStore.test.ts
  - tests/core/memory/MemoryEngine.test.ts
  - tests/core/memory/MemoryExtractor.test.ts
  - tests/core/memory/MemoryScorer.test.ts
  - tests/core/memory/PreferenceMemoryStore.test.ts
  - tests/core/memory/UserMemoryStore.test.ts
  - tests/core/memory/WorkingMemory.test.ts
  - tests/core/notes/LinkParser.test.ts
  - tests/core/notes/note-canonical.test.ts
  - tests/core/memory/MemoryEngine.test.ts
  - tests/core/notes/NoteGraph.test.ts
  - tests/core/search/MiniSearchIndex.test.ts
  - tests/core/search/notes-search-e2e.test.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-09-01T12:00:00Z
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

Phase 8 delivers the knowledge base, memory system, MiniSearch notes index, and supporting infrastructure. The implementation is generally solid with good test coverage and clear architectural patterns. However, I found one critical bug in the MiniSearchIndex `upsert` function that will cause runtime errors on note updates, several warnings around data mutation and documentation issues, and minor quality concerns.

## Critical Issues

### CR-01: MiniSearchIndex.upsert() throws on existing document IDs

**File:** `src/core/search/MiniSearchIndex.ts:93-96`
**Issue:** The exported `upsert` function always calls `idx.add()`, but MiniSearch 7.2.0 throws an error when adding a document with an ID that already exists ("A document with the same id already exists"). The internal `wireNoteSaved` handler correctly uses `idx.has()` + `idx.replace()` for updates, but the public `upsert` function does not. Any caller using `upsert` to update an existing note will crash.
**Fix:**
```typescript
export async function upsert(db: IDBPDatabase<NotesDBV1>, note: Note): Promise<void> {
  const idx = await getIndex(db);
  const doc = noteToDoc(note);
  if (idx.has(note.id)) {
    idx.replace(doc);
  } else {
    idx.add(doc);
  }
}
```

## Warnings

### WR-01: saveNote mutates its input parameter

**File:** `src/core/notes/save.ts:38-39`
**Issue:** `saveNote` directly mutates the `note` parameter (`note.links = ...; note.unresolvedLinks = ...`). Callers that reuse the note object after saving will silently see modified state. This violates the principle of least surprise and could cause subtle bugs in React components that pass store objects directly.
**Fix:** Clone the note before mutating:
```typescript
const savedNote = { ...note, links: resolution.links, unresolvedLinks: resolution.unresolvedLinks };
await db.put('notes', savedNote);
emit(NOTE_SAVED_EVENT, { noteId: savedNote.id } as NoteSavedPayload);
return { note: savedNote, emitted: true };
```

### WR-02: saveNote `emitted` field is always true

**File:** `src/core/notes/save.ts:42`
**Issue:** The return type claims `emitted` indicates "whether the emit reached at least one listener," but it is hardcoded to `true`. The actual `emit()` return value is ignored. This is misleading for callers who might rely on this field to confirm event delivery.
**Fix:** Check the emit result or remove the field:
```typescript
const emitted = emit(NOTE_SAVED_EVENT, { noteId: note.id } as NoteSavedPayload);
return { note, emitted: emitted !== false };
```

### WR-03: MemoryDB `byUser` index on non-existent field

**File:** `src/core/storage/MemoryDB.ts:78`
**Issue:** The `userFacts` store creates an index `byUser` on field `userId`, but `UserMemoryFact` (the value type) has no `userId` field. This creates a permanent empty index in every database instance — a schema dead-code artifact that could confuse future developers and wastes a small amount of storage.
**Fix:** Either remove the index or add `userId` to `UserMemoryFact`:
```typescript
// Option A: Remove the index
const userFacts = database.createObjectStore('userFacts', { keyPath: 'id' });

// Option B: Add userId to UserMemoryFact type and createIndex
```

### WR-04: LinkParser.demoteDangling JSDoc block is broken

**File:** `src/core/notes/LinkParser.ts:76,79`
**Issue:** Lines 76 and 79 start with `//` instead of ` * `, breaking the JSDoc block. The JSDoc effectively ends at line 75, so parameters and return value are undocumented. IDEs and documentation generators will not parse this correctly.
**Fix:**
```typescript
/**
 * WIKI-ID-04 demotion — recompute links[] membership against the live note
 * set. A save/rebuild moves dangling IDs (no longer in `liveIds`) back to
 * `unresolvedLinks` (raw title string), WITHOUT rewriting any source body.
 *
 * `idToTitle` is the ID → raw title mapping captured at resolve time so a
 * demoted edge recovers its original title string.
 *
 * Pure function — no db.put call. Returns { links, unresolvedLinks }.
 */
```

### WR-05: ConversationMemoryStore compactor no-op with exactly 7 messages

**File:** `src/core/memory/ConversationMemoryStore.ts:257-267`
**Issue:** With exactly 7 messages, `head = slice(0,3)`, `tail = slice(-4)`, `middle = slice(3, -4) = slice(3, 3) = []`. The compactor fires, calls `summarizer.summarize([])`, stores an empty summary, and deletes nothing. This is wasteful and could confuse diagnostics.
**Fix:** Add a guard for empty middle:
```typescript
if (middle.length === 0) return;
```

### WR-06: Typo in SECRET_KEY_DENYLIST

**File:** `src/core/security/redactSensitive.ts:20`
**Issue:** `'openikey'` is missing the `a` — should be `'openaikey'`. While the fallback regex `/key|token|secret|authorization/i` catches `openaikey` (it contains `key`), the denylist entry is misleading and would fail if the regex were ever tightened.
**Fix:**
```typescript
const SECRET_KEY_DENYLIST = ['apikey', 'openaikey', 'geminikey'];
```

## Info

### IN-01: UserMemoryStore.getTopFacts and getScoredFacts duplicate logic

**File:** `src/core/memory/UserMemoryStore.ts:142-193`
**Issue:** Both functions contain nearly identical query-term splitting, IDB fetch, scoring, and sorting logic. If one is modified without the other, behavior could diverge.
**Fix:** Extract a shared internal function:
```typescript
async function scoreAllFacts(query: string, now: number): Promise<Array<{ fact: UserMemoryFact; score: number }>> { ... }
export async function getTopFacts(query, opts) { return (await scoreAllFacts(...)).slice(0, k).map(s => s.fact); }
export async function getScoredFacts(query, opts) { return (await scoreAllFacts(...)).slice(0, k); }
```

### IN-02: WikilinkAutocomplete useEffect depends on searchFn reference

**File:** `src/components/notes/WikilinkAutocomplete.tsx:131`
**Issue:** `searchFn` is in the useEffect dependency array. If a parent passes an inline arrow function (`searchFn={(q) => ...}`), the effect re-runs every render, causing duplicate searches and potential race conditions.
**Fix:** Document that callers must memoize `searchFn` with `useCallback`, or use a ref to hold the latest searchFn without triggering re-runs.

### IN-03: WorkingMemory.updateWorkingMemory interpolates field names into regex

**File:** `src/core/memory/WorkingMemory.ts:81`
**Issue:** `new RegExp(\`(- \\*\\*${field}\\*\\*:).*\`, 'g')` interpolates `field` directly into a regex pattern. Current field names are safe (`Name`, `Role / Team`, etc.), but future additions with regex special characters (`.`, `*`, `+`, `(`, etc.) would break the replacement.
**Fix:** Escape the field name or use a string-replace approach:
```typescript
const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const re = new RegExp(`(- \\*\\*${escapedField}\\*\\*:).*`, 'g');
```

---

_Reviewed: 2026-09-01T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
