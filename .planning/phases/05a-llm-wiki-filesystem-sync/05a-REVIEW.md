---
phase: 05a-llm-wiki-filesystem-sync
reviewed: 2026-08-02T16:30:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/core/ai/LlmService.ts
  - src/core/notes/NoteTagger.ts
  - src/core/notes/NoteQA.ts
  - src/core/notes/NoteChatConverter.ts
  - src/core/notes/NoteMaintenance.ts
  - src/core/notes/NoteFileSync.ts
  - src/core/notes/NoteSchema.ts
  - src/core/notes/NotesDB.ts
  - src/core/notes/MiniSearchNoteIndex.ts
  - src/core/storage/MigrationRunner.ts
findings:
  critical: 2
  warning: 5
  info: 8
  total: 15
status: issues
---

# Phase 5a: Code Review Report

**Reviewed:** 2026-08-02T16:30:00Z
**Depth:** standard (per-file + cross-file import/call-chain analysis)
**Files Reviewed:** 10
**Status:** issues

## Summary

Reviewed the five new Phase 5a services (LlmService, NoteTagger, NoteQA, NoteChatConverter, NoteFileSync, NoteMaintenance) plus the shared schema/storage changes (NoteSchema, NotesDB, MiniSearchNoteIndex, MigrationRunner). The architecture is sound — singleton pattern, Zod-validated module boundaries, fire-and-forget EventBus handlers, and the D-01..D-21 decisions are mostly honored. Cross-file verification confirmed several claimed behaviors (v5 migration, `note:saved` payload version, lastSyncedAt preservation in `save()`, marker-authoritative citations).

However, two critical defects were found in NoteFileSync: (1) the handle-persistence path converts a real `FileSystemDirectoryHandle` into a content-less plain-data snapshot (the platform object has no `lastModified`/`content`/`permissionState` members), so after any extension restart the rehydrated "handle" is a phantom that cannot write to disk — the D-09 persistence guarantee is silently broken; and (2) the external-change/collision guard decides overwrite-vs-collide purely from timestamps and never checks the existing file's frontmatter `id`, so two notes with the same sanitized title can silently overwrite each other's backup file. Additionally, `handleNoteRename`/`handleNoteDelete` are never called anywhere (D-12 cleanup is dead in the app), the staleness timestamps (`tagsGeneratedAt`/`summaryGeneratedAt`) have no writer in the entire codebase, and the single-timer debounce drops earlier notes in a burst.

## Critical Issues

### CR-01: Handle persistence destroys real handle fidelity — backup sync silently non-functional after restart

**File:** `src/core/notes/NoteFileSync.ts:206-216` (persistHandle), `:700-721` (toPlainHandle), `:724-800` (rehydrateHandle)

**Issue:** `persistHandle()` unconditionally converts the handle to a plain-data snapshot via `toPlainHandle()`. But the real platform objects expose **no** `lastModified`, `content`, or `permissionState` members — verified against `node_modules/@types/wicg-file-system-access/index.d.ts` (`FileSystemFileHandle` = kind/getFile/createWritable; `FileSystemDirectoryHandle` = kind/getDirectoryHandle/getFileHandle/removeEntry/resolve/values). So for a real handle (from `showDirectoryPicker()` in `setBackupFolder()`):

- every file is persisted as `lastModified: 0, content: ''` (line 707-708),
- the directory's `permissionState` is always `'prompt'` (line 717-718).

After an extension restart, `loadPersistedHandle()` rehydrates this snapshot into an **in-memory fake** (`rehydrateHandle`/`rehydrateFile`): `queryPermission()` returns `'prompt'`, `requestPermission()` returns `'prompt'`, so `checkPermission()` fails and `restoreSession()` disables sync with reason `handle_expired` — the user must re-select the folder every session. Even if permission passed, all writes would mutate the phantom in-memory tree, never touching the real filesystem. The D-09 guarantee ("handle survives extension restarts") is broken, and the failure is silent: `sync:error` is emitted, but the backup silently stops working. The file's own comment (lines 678-683) acknowledges that native handles "structured-clone natively into IndexedDB" — the plain snapshot was only needed for test doubles with own enumerable functions, yet it is applied unconditionally. The test suite cannot catch this because the class-based mocks do carry `lastModified`/`content`/`permissionState` as own properties, making test behavior diverge from production.

**Fix:** Persist the native handle directly — Chrome structured-clones `FileSystemHandle` natively:

```typescript
async persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await this.openDb();
  try {
    // Chrome persists FileSystemHandle natively via structured clone (D-09).
    // Keep toPlainHandle() only for non-native/test-double handles.
    await db.put('backup_config', { id: BACKUP_CONFIG_KEY, handle });
  } finally {
    db.close();
  }
}
```

If the plain-data snapshot must stay (cross-runtime fallback), branch on whether the handle is a native platform object (e.g., `handle.constructor?.name === 'FileSystemDirectoryHandle'` or duck-type via `Symbol.asyncIterator` presence) and never snapshot native handles.

### CR-02: Collision guard uses timestamps only — a note silently overwrites another note's backup file

**File:** `src/core/notes/NoteFileSync.ts:310-334` (syncNote), `:381-398` (collideFileName)

**Issue:** The external-change/collision decision never verifies **ownership** of the existing file. `tryGetExistingFile()` returns the canonical `{title}.md` and `externalChange` is computed solely as `existing.lastModified > note.lastSyncedAt + 2000ms`. Two notes with the same sanitized title (the exact scenario D-12/SYNC-05 exists for):

1. Note A saves → writes `React.md`, A.lastSyncedAt = tA.
2. Note B saves ~1s later → `React.md` is older than B.lastSyncedAt(0)+2s → external → writes `React 1.md`, B.lastSyncedAt = tB.
3. Note B saves again 500ms later → `React.md.lastModified` (tA) is *not* newer than B.lastSyncedAt(tB)+2s → **B overwrites `React.md` — A's file — with B's content** (and B.lastSyncedAt = tB′).

A's backup file is silently clobbered, and the notes then ping-pong ownership of the canonical file depending on whose `lastSyncedAt` is newer. The SUMMARY's claim "re-sync of the SAME note overwrites its own file (D-18), a DIFFERENT note's file collides to a suffix (D-12)" is not what the code implements — the write path is timestamp-only, not ownership-aware. The backup `.md` (the feature's entire purpose) is corrupted with wrong content, and `restoreFromFolder` would later import it under the wrong file's id.

**Fix:** Check the existing file's frontmatter `id` before deciding overwrite vs collide:

```typescript
const existing = await this.tryGetExistingFile(note);
let externalChange = false;
if (existing) {
  // Ownership: a file whose frontmatter id differs is another note's file —
  // always collide (D-12), regardless of timestamps.
  let ownerId: string | null = null;
  try { ownerId = parseNoteFile(await existing.text()).frontmatter.id ?? null; } catch { /* unparseable */ }
  if (ownerId !== null && ownerId !== note.id) {
    externalChange = true; // different note's file → suffixed write
  } else {
    const lastSyncedAt = note.lastSyncedAt ?? 0;
    externalChange = existing.lastModified > lastSyncedAt + EXTERNAL_CHANGE_TOLERANCE_MS;
  }
}
```

## Warnings

### WR-01: Single-timer debounce drops earlier notes in a save burst

**File:** `src/core/notes/NoteFileSync.ts:273-281`

**Issue:** `scheduleSync()` clears the pending timer and re-arms it for the **latest** `noteId`. Any two `note:saved` events within 50ms of each other for *different* notes lose the earlier note's sync entirely. This is not hypothetical: `restoreFromFolder()` sequentially calls `save()` per restored note (each emitting `note:saved`), so restoring N notes with an active backup folder backs up only the last one — the rest are never written until their next save. The debounce coalesces across notes instead of per note.

**Fix:** Keep a per-note debounce map (or a pending-set flushed on the timer):

```typescript
private _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
private scheduleSync(noteId: string): void {
  const existing = this._debounceTimers.get(noteId);
  if (existing) clearTimeout(existing);
  this._debounceTimers.set(noteId, setTimeout(() => {
    this._debounceTimers.delete(noteId);
    void this.syncNote(noteId);
  }, DEBOUNCE_MS));
}
```

### WR-02: D-12 rename/delete cleanup is never wired — dead code in the app

**File:** `src/core/notes/NoteFileSync.ts:457-475`

**Issue:** `handleNoteRename()` and `handleNoteDelete()` are exported but have **zero callers** in `src/` (verified by grep). `NotesDB.remove()` emits no event, and no event (e.g. `note:deleted`) or old-path tracking exists anywhere. The SUMMARY claims "D-12 cleanup: handleNoteRename deletes orphan .md; handleNoteDelete deletes .md + empty parent folders" as accomplished, but in the running app renaming or deleting a note leaves the orphan `.md` on disk forever. The unit tests exercise the helpers directly, which masks the missing wiring.

**Fix:** Emit a `note:deleted`/`note:renamed` event from the delete/rename paths and subscribe in `initNoteFileSync()`, or invoke these methods from the UI deletion flow in Phase 7 — and add an integration test that exercises the full save→delete→cleanup chain, not just the helpers.

### WR-03: Staleness timestamps (`tagsGeneratedAt`/`summaryGeneratedAt`) have no writer — getStaleNotes degenerates

**File:** `src/core/notes/NoteMaintenance.ts:50-66`, `src/core/notes/NoteSchema.ts:39-40`

**Issue:** Verified by grep: nothing in `src/` ever writes `tagsGeneratedAt` or `summaryGeneratedAt`. NoteTagger never persists enrichment (D-05 — in-memory only), and `reanalyzeAll()` doesn't either. Consequently `getStaleNotes()` can never observe the "enriched but stale since edit" state it was designed for: every note without the fields falls into the "never enriched" branch, which returns stale for any note edited more than 60s after creation. Every existing note is permanently "stale" — the LLM-WIKI-08 staleness feature degenerates into "everything is stale".

**Fix:** Write the timestamps at the point enrichment is accepted/persisted — e.g., in `NotesDB.save()` when the incoming payload changes `tags`/`summary` vs the persisted note, or explicitly in the Phase 7 acceptance flow; `reanalyzeAll()` should set them after each successful `analyze()`.

### WR-04: Repeated saves after an external change accumulate unbounded suffixed files

**File:** `src/core/notes/NoteFileSync.ts:328`, `:381-398`

**Issue:** Once a note's canonical file is flagged as externally modified, every subsequent save compares against the canonical `{title}.md` (still newer than lastSyncedAt) and writes a **new** suffix via `collideFileName()` — but the previously written `{title} 1.md` is never considered, because `collideFileName` starts from 1 and the "ownership" of the last-written collided file is never recorded. Re-saves therefore produce `Title 1.md`, `Title 2.md`, `Title 3.md`, … indefinitely, none of which ever becomes the canonical target. This also spreads duplicate copies of the same note's backup across the folder.

**Fix:** Persist the actual file name last written (e.g., alongside `lastSyncedAt` in the note, or as part of the backup_config record) and compare/reuse that file on re-sync; only create a new suffix when the owned file itself is gone or externally modified.

### WR-05: NoteQA fallback citations trust LLM-supplied noteId/title verbatim

**File:** `src/core/notes/NoteQA.ts:160-176`

**Issue:** When the answer contains no inline markers, `buildCitations()` validates only `referenceNumber` range and deduplicates, then pushes the LLM-supplied citation object **verbatim** — including `noteId` and `title` that the LLM fabricated. The code comment states the prohibition ("never cite non-existent notes"), and the marker path correctly rebuilds citations from `snippets[refNum-1]`, but the fallback path bypasses the snippet array entirely, so a hallucinated citation can reference a non-existent note and be rendered as fact in the UI. D-13 requires citations to map to actual source notes.

**Fix:** Rebuild the fallback citations from the snippet array by index, ignoring the LLM's noteId/title fields:

```typescript
for (const c of llmResult.citations ?? []) {
  if (used.has(c.referenceNumber)) continue;
  if (c.referenceNumber < 1 || c.referenceNumber > snippets.length) continue;
  used.add(c.referenceNumber);
  const s = snippets[c.referenceNumber - 1];
  out.push({ noteId: s.noteId, title: s.title, relevantSnippet: s.snippet, referenceNumber: c.referenceNumber });
}
```

## Info

### IN-01: `getFileHandleWithCollision` is dead code — and re-encodes the plan's original collision bug

**File:** `src/core/notes/NoteFileSync.ts:434-451`

**Issue:** Never called (grep confirms); superseded by `collideFileName()`. It also contains the exact bug the SUMMARY claims was fixed: `dir.getFileHandle(candidate, { create: true })` never throws `NotFoundError`, so the "retry on NotFoundError" loop always returns the first candidate — the method could never produce a suffixed name. Delete it.

### IN-02: `NotesDB.getByLastSyncedAt()` is unused outside tests

**File:** `src/core/notes/NotesDB.ts:184-190`

**Issue:** NoteFileSync reads `note.lastSyncedAt` via `get()`; no production caller uses `getByLastSyncedAt`. Either wire it into NoteFileSync (it would be the natural D-11 read path) or remove it.

### IN-03: `NoteTagger.analyze()` has unused `_noteId` / `_noteVersion` parameters

**File:** `src/core/notes/NoteTagger.ts:99-119`

**Issue:** Both params are ignored; D-07 staleness is enforced in the handler via payload version + re-read. Keeping version in the signature is misleading — either enforce staleness inside `analyze()` (single responsibility) or drop the params and have callers (`reanalyzeAll`) do the version check.

### IN-04: `restoreFromFolder` loses imported file timestamps — `save()` clobbers `updatedAt` and bumps version

**File:** `src/core/notes/NoteFileSync.ts:606-643`, `src/core/notes/NotesDB.ts:92`

**Issue:** `createRestoredNote`/`updateRestoredNote` set `updatedAt` from the file's frontmatter, but `NotesDB.save()` unconditionally overwrites `updatedAt: Date.now()` and bumps `version`. Imported notes therefore (a) lose their original edit timestamps, and (b) the next sync rewrites the `.md` with a mutated `updated` field. If preserving file metadata matters for restore fidelity, restore should write via `restore()` (raw put) after deriving links, or `save()` should preserve `updatedAt` when the payload carries an explicit older value.

### IN-05: Tiny-mode ask results carry memory sourceIds as `noteId` — not real note ids

**File:** `src/core/notes/NoteQA.ts:187-201`

**Issue:** In tiny ask mode, memory items map `item.sourceId` (e.g. `memory.user.fact.<uuid>`, `memory.preference`) into the `NoteSearchResult.noteId` field. Any UI linking to that noteId will fail. Consider a distinct marker (e.g. `memory:<sourceId>`) or a separate result shape for memory items.

### IN-06: Dead variable in empty-parent cleanup

**File:** `src/core/notes/NoteFileSync.ts:489-509`

**Issue:** `let current = dir;` … `current = target;` — `current` is assigned but never read. Remove it.

### IN-07: `setBackupFolder()` marks permission `denied` when the user cancels the picker

**File:** `src/core/notes/NoteFileSync.ts:156-180`

**Issue:** The catch-all sets `_lastPermissionState = 'denied'` and returns an error for *any* rejection, including `AbortError` from the user simply cancelling the folder picker. A cancel is not a denial and should not flip the UI to the "Backup: Error" state. Check `err.name === 'AbortError'` and return a neutral result without mutating state.

### IN-08: User content is placed in the system role (inherited from `generateWithRepair`)

**File:** `src/core/ai/LlmService.ts:31`, `src/core/ai/StructuredOutput.ts:83-94`

**Issue:** `generateWithRepair` puts the *entire* joined prompt (including NoteQA's user question, note content, and NoteChatConverter's chat messages) inside a `system` message. The phase explicitly chose to inherit this behavior, but it weakens the stable-prefix/prompt-injection boundary (CTX-T01/T02 spirit) for the new note-content consumers — user notes and chat messages are now system-level instructions. Note for the future: `LlmService.generate` should split system vs user roles (`{ role: 'system', content: systemPrompt }` + `{ role: 'user', content: userPrompt }`) once `generateWithRepair` supports it.

---

_Reviewed: 2026-08-02T16:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
