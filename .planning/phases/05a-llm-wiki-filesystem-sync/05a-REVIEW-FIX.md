---
phase: 05a-llm-wiki-filesystem-sync
fixed_at: 2026-08-02T17:18:00Z
review_path: .planning/phases/05a-llm-wiki-filesystem-sync/05a-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 5a: Code Review Fix Report

**Fixed at:** 2026-08-02T17:18:00Z
**Source review:** `.planning/phases/05a-llm-wiki-filesystem-sync/05a-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 critical, 4 warning)
- Fixed: 5
- Skipped: 0

All fixes verified: `vitest run tests/core/notes` green (150 tests, was 142 before the gap) and `tsc --noEmit` clean.

## Fixed Issues

### CR-01: Delete/rename cleanup removes the WRONG file for collided notes — another note's backup is deleted

**Files modified:** `src/core/notes/NotesDB.ts`, `src/core/notes/NoteFileSync.ts`, `tests/core/notes/NoteFileSync.test.ts`
**Commit:** `c11f541`
**Applied fix:**
- `NoteDeletedEvent` and `NoteRenamedEvent` payloads now carry `lastSyncedFileName?: string`; `remove()` emits `found.note.lastSyncedFileName` and `save()`'s rename emit carries `existing.note.lastSyncedFileName` (the note's own file, possibly collision-suffixed).
- `NoteFileSync` resolves cleanup paths via a new `resolveCleanupFilePath(categoryPath, title, lastSyncedFileName?)` — the owned file name overrides the canonical `{title}.md`.
- `removeFileAndEmptyParents(filePath, expectedOwnerId?)` is ownership-guarded: before `removeEntry` it reads the target's frontmatter id and refuses to remove a file owned by a DIFFERENT note (unparseable frontmatter is removed, matching `selectTargetFile`'s D-18 fallback).
- Two new lifecycle integration tests: delete and rename of a collided note remove its own `React 1.md` while the other note's canonical `React.md` survives.
- **Status:** fixed: requires human verification (ownership logic)

### WR-01: In-flight sync can resurrect a deleted note's `.md` (TOCTOU)

**Files modified:** `src/core/notes/NoteFileSync.ts`, `tests/core/notes/NoteFileSync.test.ts`
**Commit:** `8ae98c7`
**Applied fix:**
- `syncNote` re-checks note existence AFTER `writeNoteFile`; when the note is gone (deleted while the write was in flight), it removes the just-written file (ownership-guarded, empty parents pruned) and returns without recording sync state.
- New deterministic test: the write is gated mid-flight, `remove()` interleaves, and the assertion confirms the just-written `.md` (and empty `Inbox`) are removed after the write lands.
- **Status:** fixed: requires human verification (race condition)

### WR-02: Rename cleanup races the debounced write — the note can end up with NO backup file until its next edit

**Files modified:** `src/core/notes/NoteFileSync.ts`, `tests/core/notes/NoteFileSync.test.ts`
**Commit:** `1769efe`
**Applied fix:**
- The `note:renamed` handler now: cancels the pending per-note debounce (armed by `note:saved`), `await`s the old-file cleanup, then re-`scheduleSync`s so the new write strictly follows the removal.
- New deterministic test: the cleanup's `removeEntry` is gated; while blocked, the debounce window elapses and no new file appears (proving the write cannot precede the removal), then after release the old file is gone and the new one is written.
- **Status:** fixed: requires human verification (race condition)

### WR-03: Cleanup of a note with no `.md` on disk emits a spurious `sync:error` — masked by a mock that diverges from the platform

**Files modified:** `src/core/notes/NoteFileSync.ts`, `tests/core/notes/NoteFileSync.test.ts`
**Commit:** `d26432e`
**Applied fix:**
- `removeFileAndEmptyParents` swallows `NotFoundError` from `removeEntry` (the file vanished between the existence check and the removal) and proceeds to the empty-parent pass instead of surfacing a backup error.
- `MockDirHandle.removeEntry` now rejects with `DOMException('Not found', 'NotFoundError')` for missing entries, and the rehydrated plain handle does the same — matching the real `FileSystemDirectoryHandle`.
- New tests: deleting a never-synced note with sync enabled emits no `sync:error`; the mock rejects with `NotFoundError` for missing entries.
- **Status:** fixed

### WR-04: `updateSyncState` read-modify-write can clobber a concurrent `save()`

**Files modified:** `src/core/notes/NotesDB.ts`, `tests/core/notes/NotesDB.test.ts`
**Commit:** `5475b53`
**Applied fix:**
- `updateSyncState` now reads, merges, and writes within ONE readwrite transaction (previously `get()` then `put()` in separate transactions) — serialized against every other write to the store, so a concurrent `save()` can never be overwritten by the stale snapshot.
- New tests: a single-transaction spy assertion (1 `IDBDatabase.prototype.transaction` call) and a concurrent `save()` + `updateSyncState()` test proving the newer content always wins regardless of interleaving.
- **Status:** fixed: requires human verification (concurrency)

---

_Fixed: 2026-08-02T17:18:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
