---
phase: 05a-llm-wiki-filesystem-sync
reviewed: 2026-08-02T17:05:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/core/notes/NoteFileSync.ts
  - src/core/notes/NoteSchema.ts
  - src/core/notes/NotesDB.ts
  - src/core/notes/NoteQA.ts
  - tests/core/notes/NoteFileSync.test.ts
  - tests/core/notes/NotesDB.test.ts
  - tests/core/notes/NoteMaintenance.test.ts
  - tests/core/notes/NoteQA.test.ts
findings:
  critical: 1
  warning: 4
  info: 6
  total: 11
status: issues
---

# Phase 5a: Code Review Report (gap closure, commits 82004b2..HEAD)

**Reviewed:** 2026-08-02T17:05:00Z
**Depth:** standard (per-file + cross-file call-chain analysis)
**Files Reviewed:** 8
**Status:** issues

## Summary

This review covers the gap-closure execution for the findings of the prior review (05a-REVIEW.md, 14:55): CR-01 native-handle persistence, CR-02 ownership-aware collision, WR-01 per-note debounce, WR-02 event-driven cleanup, WR-03 staleness timestamp diff-writer, WR-04 owned-file reuse, WR-05 snippet-authoritative fallback citations. All seven items are implemented and each has focused tests; the CR-02 and WR-04 logic (`selectTargetFile`/`collideFileName`) is genuinely ownership-aware and the WR-05 rebuild correctly ignores LLM-supplied note identity.

However, the new code introduces one **critical cross-feature defect**: the WR-02 delete/rename cleanup removes the file at the **canonical path**, while CR-02/WR-04 make suffixed files (`Title 1.md`) a first-class owned state. Deleting or renaming a collided note therefore deletes **another note's** backup file and leaves the deleted note's own file orphaned — the exact data-loss class this feature was meant to prevent. The event payloads carry only `title`/`categoryPath` (NotesDB has the exact `lastSyncedFileName` in hand at both emit sites) and no ownership check guards `removeEntry`. Also flagged: an in-flight-sync resurrection race (delete during an active `syncNote`), a rename-cleanup vs debounced-write race that can leave the note with no backup file until the next edit, and spurious `sync:error` emissions on cleanup of notes with no `.md` on disk (masked by a mock that does not match the platform's `NotFoundError` behavior).

## Critical Issues

### CR-01: Delete/rename cleanup removes the WRONG file for collided notes — another note's backup is deleted

**File:** `src/core/notes/NotesDB.ts:306-310` (note:deleted payload), `:206-211` (note:renamed payload); `src/core/notes/NoteFileSync.ts:265-275` (handlers), `:577-608` (removeFileAndEmptyParents)

**Issue:** The event payloads carry only `noteId`/`title`/`categoryPath` (and `oldTitle`/`oldCategoryPath` for rename), and the handlers rebuild the **canonical** path via `buildFilePath(e.categoryPath, e.title)`. But CR-02/WR-04 introduce a first-class state where a note's actual backup file is suffixed: when note A holds `Inbox/React.md` and note B collides to `Inbox/React 1.md` (B.lastSyncedFileName = "React 1.md"), then:

- **Delete B** → handler removes `Inbox/React.md` — **A's backup file is deleted**. B's own `React 1.md` is left orphaned on disk forever (no future event will clean it).
- **Rename B** ("React" → "ReactX") → handler removes `Inbox/React.md` (A's file); B's `React 1.md` stays orphaned; the re-sync then writes `Inbox/ReactX.md`.

`NotesDB.remove()` reads the full note (including `lastSyncedFileName`) *before* deletion, and `save()` has `existing.note.lastSyncedFileName` at the rename-emit site — the exact file is available in both places but never carried in the payload. Additionally, `removeFileAndEmptyParents` performs no ownership check: `dir.removeEntry(fileName)` (line 584) deletes whatever sits at the canonical path, even if its frontmatter id belongs to a different note. The WR-02 lifecycle tests only exercise canonical-file notes, so the collision×cleanup combination is untested.

**Fix:** (1) Extend both payloads with the actual owned file name and remove that file, not the canonical:

```typescript
export interface NoteDeletedEvent {
  noteId: string;
  title: string;
  categoryPath: string;
  lastSyncedFileName?: string; // exact .md this note last wrote (WR-04)
}
// remove(): emit({ noteId: id, title: found.note.title,
//   categoryPath: found.note.categoryPath, lastSyncedFileName: found.note.lastSyncedFileName })
// save() rename: emit({ noteId: parsed.id, oldTitle: existing.note.title,
//   oldCategoryPath: existing.note.categoryPath, lastSyncedFileName: existing.note.lastSyncedFileName })
```

(2) Guard deletion by ownership — before `removeEntry`, read the target file's frontmatter id and remove only when it matches the deleted/renamed note (fall back to `lastSyncedFileName` when the canonical file is not owned):

```typescript
private async removeFileAndEmptyParents(filePath: string, expectedOwnerId?: string): Promise<void> {
  // ... resolve dir as today ...
  const target = await this.tryReadFileInDir(dir, fileName);
  if (target) {
    const ownerId = await this.readOwnerId(target);
    if (expectedOwnerId && ownerId !== null && ownerId !== expectedOwnerId) return; // never remove a foreign file
    await dir.removeEntry(fileName);
  }
  // ... ascend empty parents ...
}
```

(3) Add an integration test: note A writes `React.md`, note B collides to `React 1.md`, then `remove(B)` — assert `React.md` (A's) survives and `React 1.md` is gone.

## Warnings

### WR-01: In-flight sync can resurrect a deleted note's `.md` (TOCTOU)

**File:** `src/core/notes/NoteFileSync.ts:284-290` (cancelPendingSync), `:346-377` (syncNote)

**Issue:** `cancelPendingSync` only cancels a timer that has not fired. If the timer already fired and `syncNote` is between `getNotesDb().get(noteId)` (line 362) and `writeNoteFile` (line 371), the `note:deleted` cleanup removes the file, then the in-flight write recreates it; `updateSyncState` no-ops (note gone), so the orphan `.md` persists indefinitely with the deleted note's content. The test at `NoteFileSync.test.ts:1151` covers only the queued-timer case, not the in-flight case.

**Fix:** Re-verify existence after the write (cheap `get(noteId)`) and remove the just-written file when the note is gone; or have the delete handler also clear the file after a short grace period. Add a test where `syncNote`'s `get()` resolves before `remove()` and the write lands after.

### WR-02: Rename cleanup races the debounced write — the note can end up with NO backup file until its next edit

**File:** `src/core/notes/NotesDB.ts:194-212` (emit order), `src/core/notes/NoteFileSync.ts:272-275, 328-340`

**Issue:** `save()` emits `note:saved` (arming the 50ms debounce) before `note:renamed`, and the rename handler runs `void this.handleNoteRename(...)` fire-and-forget. If the async cleanup (IDB open + `removeEntry`) lags behind the debounced `syncNote`, `selectTargetFile` sees the old file still present — owned (frontmatter id matches) and not externally modified (`lastModified ≈ lastSyncedAt`) — writes the **new** content under the **old** file name and records `lastSyncedFileName = "Old Title.md"`. The pending cleanup then deletes that file. Net effect: the note has no backup on disk, and nothing re-syncs it until the next save.

**Fix:** In the rename handler, cancel the pending debounce timer, `await` the cleanup, then re-`scheduleSync(noteId)` so the write strictly follows the removal:

```typescript
const unsubRenamed = on<NoteRenamedEvent>('note:renamed', async (e) => {
  if (!this._handle) return;
  this.cancelPendingSync(e.noteId);
  await this.handleNoteRename(e.noteId, buildFilePath(e.oldCategoryPath, e.oldTitle));
  this.scheduleSync(e.noteId); // write the new file after the old one is gone
});
```

### WR-03: Cleanup of a note with no `.md` on disk emits a spurious `sync:error` — masked by a mock that diverges from the platform

**File:** `src/core/notes/NoteFileSync.ts:577-608, 610-613`; `tests/core/notes/NoteFileSync.test.ts:113-125`

**Issue:** Real `FileSystemDirectoryHandle.removeEntry(name)` throws `NotFoundError` when the entry does not exist. Deleting or renaming any never-synced note (or a note whose file was already removed) with sync enabled flows into `dir.removeEntry(fileName)` → `NotFoundError` → `emitCleanupError` → `sync:error` (reason 'error'). With the new WR-02 wiring, every such delete/rename spams a misleading backup error into the UI. The mock `removeEntry` (test lines 113-125) silently resolves for missing entries, so tests cannot see this divergence.

**Fix:** Treat `NotFoundError` as a no-op in `removeFileAndEmptyParents`, and make `MockDirHandle.removeEntry` reject with `DOMException('Not found', 'NotFoundError')` for missing entries to match the platform.

### WR-04: `updateSyncState` read-modify-write can clobber a concurrent `save()`

**File:** `src/core/notes/NotesDB.ts:273-282`

**Issue:** `updateSyncState` does `get(id)` then `put({...existing.note, ...state})` with the note read before the put. If a `save()` commits between the two awaits, the put overwrites the newer content/links/version with the stale snapshot (plus the sync state). The pattern predates the gap closure but now also carries `lastSyncedFileName`, and WR-04 makes this write path more frequent (every sync). No version check exists to detect the conflict.

**Fix:** Write the sync state via an object-store cursor update or a version-guarded put (abort when `put`-time version differs from the read version), or route through the journaled `save()` path with a `{ lastSyncedAt, lastSyncedFileName }`-only patch.

## Info

### IN-01: `tagsChanged` is order-sensitive (`JSON.stringify` array compare)

**File:** `src/core/notes/NotesDB.ts:126-127`

**Issue:** `JSON.stringify(existing.note.tags) !== JSON.stringify(parsed.tags)` treats reordered tag arrays as a change. An enrichment acceptance or restore that re-serializes the same tags in a different order re-stamps `tagsGeneratedAt`, marking the note freshly enriched when the enrichment fields did not actually change.

**Fix:** Compare as sets (or sort before stringify).

### IN-02: Restore import stamps enrichment timestamps — imported notes look "freshly enriched"

**File:** `src/core/notes/NoteFileSync.ts:725-741` (updateRestoredNote) × `NotesDB.ts:126-137` (diff-writer)

**Issue:** `updateRestoredNote` merges the file's tags into the existing note, so `save()` sees a tags change and stamps `tagsGeneratedAt`/`summaryGeneratedAt = now`. Imported notes then take the "enriched" branch of `getStaleNotes()` (skipped until the next edit) even though no LLM enrichment ever ran.

**Fix:** Have restore paths write via `restore()`/a dedicated import path that does not trigger the diff-writer, or suppress stamping for `provenance.source === 'import'`.

### IN-03: `restoreSession` prompt-rejection path is silent — no `sync:error` event

**File:** `src/core/notes/NoteFileSync.ts:293-320`

**Issue:** When `queryPermission` returns 'prompt' at startup, `checkPermission` calls `requestPermission`, which rejects without a user gesture; the rejection lands in `restoreSession`'s generic catch (line 316-319), which disables sync and sets an error string but emits **no** `sync:error` (unlike the 'denied' path, which emits `handle_expired`). The UI gets no signal to prompt "Re-select backup folder".

**Fix:** In the catch path, emit `sync:error` with reason `handle_expired` when the handle exists but permission could not be established.

### IN-04 (carry-over): `restoreFromFolder` clobbers imported `updatedAt` and bumps version

**File:** `src/core/notes/NoteFileSync.ts:704-741`, `src/core/notes/NotesDB.ts:148`

**Issue:** `createRestoredNote`/`updateRestoredNote` set `updatedAt` from frontmatter, but `save()` unconditionally overwrites `updatedAt: Date.now()` and increments `version`. Restored notes lose their original edit timestamps, and the next sync rewrites the `.md` with a mutated `updated` field. Unchanged by the gap closure.

**Fix:** Write restore payloads via `restore()` after deriving links, or preserve `updatedAt` in `save()` when the payload carries an explicit older value.

### IN-05 (carry-over): `getByLastSyncedAt()` remains unused in production

**File:** `src/core/notes/NotesDB.ts:258-264`

**Issue:** NoteFileSync reads `lastSyncedAt` via `get()`; no production caller uses `getByLastSyncedAt`. Remove it or wire it in as the D-11 read path.

### IN-06 (carry-over): `setBackupFolder` marks permission `denied` when the user cancels the picker

**File:** `src/core/notes/NoteFileSync.ts:157-181`

**Issue:** The catch-all sets `_lastPermissionState = 'denied'` for any rejection, including `AbortError` from cancelling `showDirectoryPicker()`. A cancel should be a neutral outcome, not a "Backup: Error/denied" state.

**Fix:** Check `err.name === 'AbortError'` and return `{ success: false }` without mutating permission state.

---

_Reviewed: 2026-08-02T17:05:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
