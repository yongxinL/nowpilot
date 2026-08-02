---
phase: 05a-llm-wiki-filesystem-sync
plan: 03
type: execute
wave: 2
depends_on: [05a-01]
files_modified:
  - src/core/notes/NoteFileSync.ts
  - tests/core/notes/NoteFileSync.test.ts
autonomous: true
requirements: [NOTE-03]

must_haves:
  truths:
    - "NoteFileSync.initNoteFileSync() subscribes to EventBus note:saved and debounces 50ms before writing .md file"
    - "NoteFileSync write produces .md files with YAML frontmatter (id, title, created, updated, tags, categoryPath, summary) at {categoryPath}/{sanitizedTitle}.md"
    - "NoteFileSync checks handle.queryPermission({ mode: 'readwrite' }) before every sync attempt per D-10"
    - "NoteFileSync detects external changes via file.lastModified > note.lastSyncedAt + 2s tolerance per D-11"
    - "NoteFileSync resolves title collisions via numeric suffixing ({title} 1.md, {title} 2.md) per D-12"
    - "NoteFileSync deletes orphaned .md on note rename and deletes .md + empty parent folders on note deletion per D-12"
    - "NoteFileSync.restoreFromFolder() parses .md files from a user-selected directory and performs additive upsert (never deletes local notes) with preview count 'Found N notes (X new, Y updated, Z unchanged)'"
  artifacts:
    - src/core/notes/NoteFileSync.ts
  key_links:
    - "NoteFileSync → EventBus note:saved (independent subscription, parallel to NoteTagger per D-17)"
    - "NoteFileSync → FileSystemDirectoryHandle via IndexedDB backup_config store (persisted handle per D-09)"
    - "NoteFileSync → yaml package (stringify/parse for frontmatter generation and restore)"
    - "NoteFileSync → NotesDB.getByLastSyncedAt() + updateLastSyncedAt() (external-change detection per D-11)"
prohibitions:
  - "MUST NOT write files without prior successful permission check — queryPermission({ mode: 'readwrite' }) must return 'granted' before any createWritable() call"
  - "MUST NOT overwrite externally-modified files without user confirmation — compare lastModified vs lastSyncedAt + 2s tolerance per D-11, prompt 'Overwrite?' defaulting to Skip"
  - "MUST NOT delete notes from IndexedDB during restore — restore is additive-upsert only; local notes not in the backup folder are never deleted"
---

<objective>
Build the NoteFileSync service: one-way app→filesystem .md backup with YAML frontmatter, EventBus-driven debounced writes, File System Access API permission management, external-change detection, collision resolution, rename/delete cleanup, and folder restore with additive upsert. This completes NOTE-03.

Purpose: Users get portable, Obsidian-compatible .md backups of their notes that stay in sync on every save — with safety guards against permission loss, external edits, and data loss.
Output: Working NoteFileSync service with full test suite covering write, collision, external-change, rename/delete cleanup, and restore paths.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-RESEARCH.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-PATTERNS.md
@.planning/phases/05-knowledge-base/05-01-SUMMARY.md
@src/core/notes/NoteSchema.ts
@src/core/notes/NotesDB.ts
@src/core/storage/MigrationRunner.ts
@src/core/events/EventBus.ts
@tests/setup.ts
</context>

<tasks>

<task type="auto">
  <name>NoteFileSync: EventBus handler, permission management, debounced .md writes with YAML frontmatter, collision resolution, external-change detection</name>
  <read_first>
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md — D-09 (FileSystemDirectoryHandle in backup_config store), D-10 (permission check every sync), D-11 (lastSyncedAt + 2s tolerance for external changes), D-12 (collision suffixing, rename/delete cleanup, file path format), D-17 (EventBus parallel subscription), D-18 (re-sync on enrichment acceptance)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-RESEARCH.md — Architecture Patterns: Pattern 4 (YAML Frontmatter), Pattern 5 (Handle Persistence). Code Examples: Permission verification (lines 504–524), Filename sanitization (lines 529–543), YAML frontmatter generation (lines 550–587)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-PATTERNS.md — Pattern #5 (NoteFileSync, lines 326–428): EventBus subscription + IndexedDB access + YAML + debounce
@src/core/notes/NotesDB.ts — getByLastSyncedAt(), updateLastSyncedAt() from Plan 05a-01; save() for writing updated notes
@src/core/events/EventBus.ts — on() for note:saved subscription
@src/core/storage/MigrationRunner.ts — v5 backup_config store created in Plan 05a-01
  </read_first>
  <files>
    src/core/notes/NoteFileSync.ts
    tests/core/notes/NoteFileSync.test.ts
  </files>
  <action>
Create NoteFileSync (src/core/notes/NoteFileSync.ts) as a module-level singleton (MemoryEngine pattern).

**Architecture:** NoteFileSync is an event-driven service that subscribes to EventBus `note:saved` independently from NoteTagger (D-17: parallel, no ordering dependency). On each save, it debounces 50ms then writes a `.md` file using the File System Access API.

**Imports:** `yaml` (stringify, parse), `idb` (openDB), `on` from EventBus, `getNotesDb` from NotesDB, `migrationRunner` from MigrationRunner.

**Core state:**
- `_handle: FileSystemDirectoryHandle | null` — the persisted backup folder handle
- `_syncEnabled: boolean` — true when handle is set and permission is granted
- `_debounceTimer: ReturnType<typeof setTimeout> | null` — 50ms debounce timer
- Module-level constants: `DEBOUNCE_MS = 50`, `EXTERNAL_CHANGE_TOLERANCE_MS = 2000`, `INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g`

**Methods:**

1. **`async setBackupFolder(): Promise<{ success: boolean; error?: string }>`** (called from Phase 7 UI, requires user gesture):
   - Call `window.showDirectoryPicker()` to get a FileSystemDirectoryHandle.
   - Verify permission via `verifyPermission(handle)` helper.
   - If granted: store handle in IndexedDB backup_config store via `this.persistHandle(handle)`. Set `_handle = handle`, `_syncEnabled = true`. Return `{ success: true }`.
   - If denied: return `{ success: false, error: 'Permission denied' }`.

2. **`async checkPermission(): Promise<boolean>`** — calls `handle.queryPermission({ mode: 'readwrite' })`. If 'denied', sets `_syncEnabled = false`. If 'prompt', attempts `handle.requestPermission()`. Returns true only if 'granted'.

3. **`async persistHandle(handle: FileSystemDirectoryHandle): Promise<void>`** — opens NotesDB v5 via `openDB('NotesDB', 5)`, puts `{ id: 'backup_folder', handle }` into the backup_config store. Uses try/finally with `db.close()` (MiniSearchNoteIndex pattern).

4. **`async loadPersistedHandle(): Promise<FileSystemDirectoryHandle | null>`** — opens NotesDB v5, gets 'backup_folder' record from backup_config, returns handle or null. Called on service initialization.

5. **`initNoteFileSync(): void`** (idempotent — if `unsub` already set, no-op):
   - Load persisted handle via `loadPersistedHandle()`. If handle exists, check permission via `checkPermission()`.
   - Subscribe to EventBus: `unsub = on<{ noteId: string }>('note:saved', async ({ noteId }) => { ... })`.
   - Handler: debounce 50ms. On fire, call `this.syncNote(noteId)`.

6. **`async syncNote(noteId: string): Promise<void>`** (fire-and-forget, errors swallowed):
   - If `!_syncEnabled || !_handle`: return silently.
   - Verify permission via `checkPermission()`. If denied: set `_syncEnabled = false`, emit `sync:error` event with reason 'permission_denied', return.
   - Load note from NotesDB.get(noteId). If not found, return.
   - **External-change check (D-11):** Try to get the existing file, compare `file.lastModified` vs `note.lastSyncedAt`. If file.lastModified > note.lastSyncedAt + 2000ms → external change detected. Emit `sync:external-change` event with `{ noteId, title, localModified: note.updatedAt, fileModified: file.lastModified }`. Skip this sync — user confirmation needed.
   - Build file content via `buildNoteFile(note)`: YAML frontmatter (id, title, createdAt, updatedAt, tags, categoryPath, summary) + markdown body. Use `yaml.stringify(fm, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE' })`.
   - Build file path: `buildFilePath(note.categoryPath, sanitizeFilename(note.title))`.
   - Create directory structure: split categoryPath on '/', recursively create directories via `handle.getDirectoryHandle(segment, { create: true })`.
   - **Collision resolution (D-12):** Try `dirHandle.getFileHandle(filename, { create: true })`. If a file with the same title already exists in the same category, append a numeric suffix: `{title} 1.md`, `{title} 2.md`, etc. — try each in sequence until one is available.
   - Write file: get a writable via `fileHandle.createWritable()`, write content via `writable.write(content)`, close via `writable.close()`.
   - Update note's `lastSyncedAt` to `Date.now()` via NotesDB.updateLastSyncedAt(noteId, Date.now()).

7. **`async restoreFromFolder(): Promise<{ preview: { total: number; newCount: number; updatedCount: number; unchangedCount: number }; notes: Array<{ noteId: string; title: string; action: 'new' | 'updated' | 'unchanged' }> }>`** (called from Phase 7 UI, requires user gesture):
   - `const handle = await window.showDirectoryPicker()` — user selects the backup folder.
   - Recursively walk the directory: iterate `handle.values()`, for each `.md` file call `await fileHandle.getFile()` → `await file.text()` → parse frontmatter via `parseNoteFile(text)`.
   - For each parsed note: check NotesDB for existing note by id. If not found → "new". If found and `parsed.updated > existingNote.updatedAt` → "updated". Otherwise → "unchanged".
   - Build preview: "Found N notes (X new, Y updated, Z unchanged)".
   - **Additive upsert (NEVER delete):** For "new" notes, create via NotesDB.save() with the parsed content. For "updated" notes, update via NotesDB.save() with merged content (parsed content wins for body, tags, categoryPath; existing id/createdAt preserved). "Unchanged" notes are skipped.
   - Local notes NOT in the backup folder are NEVER touched (no deletions).
   - Return preview object + list of notes with actions.

8. **`async handleNoteRename(oldNoteId: string, oldFilePath: string): Promise<void>`** — called after a note's title or categoryPath changes. Delete the old `.md` file at oldFilePath via `handle.removeEntry(filename)`. If the parent category folder is now empty, remove it too (D-12).

9. **`async handleNoteDelete(noteId: string, filePath: string): Promise<void>`** — called when a note is deleted. Delete the `.md` file. Remove empty parent folders up the category path (D-12).

**Helper functions (exported for testing):**
- `sanitizeFilename(title: string): string` — replaces invalid chars (`/\:*?"<>|`) with `'_'`, trims, falls back to `'untitled'`.
- `buildFilePath(categoryPath: string, title: string): string` — `categoryPath ? '${categoryPath}/${sanitized}.md' : '${sanitized}.md'`.
- `buildNoteFile(note: Note): string` — YAML frontmatter + markdown body.
- `parseNoteFile(content: string): { frontmatter: NoteFrontmatter; body: string }` — regex match `/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/`, parse YAML. Throw if no frontmatter found.
- `verifyPermission(handle: FileSystemDirectoryHandle, readWrite?: boolean): Promise<boolean>` — queryPermission + requestPermission fallback.

**Error handling:** All file I/O errors in EventBus handlers are caught and emitted as `sync:error` events with `{ noteId, error, reason }`. The handler never throws (EventBus swallows anyway). Backup status is reflected via `getSyncStatus(): { enabled: boolean; handleExists: boolean; permissionState: PermissionState }`.

**Test suite** (tests/core/notes/NoteFileSync.test.ts):
Mock FileSystemDirectoryHandle, FileSystemFileHandle, FileSystemWritableFileStream — these are browser-only APIs not available in vitest/jsdom. Create mock implementations with jest.fn() for:
- `showDirectoryPicker` → returns mock FileSystemDirectoryHandle
- `queryPermission` / `requestPermission` → returns 'granted'/'denied'/'prompt'
- `getDirectoryHandle` → returns mock handle (or throws NotFoundError)
- `getFileHandle` → returns mock file handle
- `createWritable` → returns mock writable stream
- `removeEntry` → mock remove
- `getFile` → returns mock File with lastModified

Tests:
- **YAML frontmatter:** "buildNoteFile produces valid YAML frontmatter with all fields" — create a Note, call buildNoteFile, assert output matches expected format with --- delimiters. "parseNoteFile parses YAML frontmatter back into object" — round-trip test.
- **Filename sanitization:** "sanitizeFilename replaces invalid chars with underscore" — test `"Meeting: Q3 Review"` → `"Meeting_ Q3 Review"`. "sanitizeFilename handles empty string" → `"untitled"`.
- **Collision:** "buildFilePath with collision resolves to suffix" — create file at path, try same title, assert `{title} 1.md` created.
- **Permission:** "syncNote skips write when permission is denied" — set mock queryPermission to 'denied', call syncNote, assert createWritable NOT called. "syncNote succeeds when permission is granted" — set to 'granted', assert written.
- **External change:** "syncNote detects external change and skips write" — set file.lastModified > note.lastSyncedAt + 2000ms, assert file NOT overwritten. "syncNote writes when file is not newer" — file.lastModified is earlier, assert write proceeds.
- **Debounce:** "multiple rapid saves debounce to single write" — fire 3 note:saved events within 30ms, assert syncNote called only once after 50ms.
- **EventBus:** "initNoteFileSync subscribes to note:saved" — verify EventBus.on called with 'note:saved'.
- **Restore:** "parseNoteFile extracts frontmatter and body" — test fixture .md file. "restoreFromFolder returns correct preview counts" — mock folder with 5 .md files, 2 new, 2 updated, 1 unchanged, assert counts. "restore never deletes local notes" — mock folder with subset of local notes, assert non-matching local notes untouched.
- **Rename/delete cleanup:** "handleNoteRename deletes old .md" — assert removeEntry called with old filename. "handleNoteDelete removes file and empty parent" — assert removeEntry called, then check if parent is empty.
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteFileSync.test.ts --no-coverage</automated>
  </verify>
  <done>
NoteFileSync test suite passes: YAML frontmatter round-trips correctly; filenames sanitized (invalid chars → underscore); title collisions resolved with numeric suffixing; permission denied → sync skipped gracefully; external changes detected (2s tolerance) → overwrite skipped; 50ms debounce coalesces rapid saves; EventBus note:saved subscription works; restore parses .md files and performs additive upsert with correct preview counts; rename deletes orphan .md; note deletion cleans up .md and empty parent folders.
  </done>
  <acceptance_criteria>
    1. initNoteFileSync() loads persisted handle from IndexedDB backup_config store (D-09).
    2. EventBus note:saved handler debounces 50ms before fire (D-17, standard timeout pattern).
    3. Permission verified via handle.queryPermission({ mode: 'readwrite' }) before every write (D-10).
    4. Permission denied → _syncEnabled false, error event emitted, write skipped.
    5. YAML frontmatter includes id, title, created, updated, tags, categoryPath, summary + markdown body.
    6. Filename sanitization: `/\:*?"<>|` → `'_'`; empty → `'untitled'`.
    7. File path: `{categoryPath}/{sanitizedTitle}.md`.
    8. Collision: duplicate title → `{title} 1.md`, `{title} 2.md`, etc. (D-12).
    9. External change: `file.lastModified > lastSyncedAt + 2000ms` → skip overwrite, emit external-change event (D-11).
    10. Successful write → notesDB.updateLastSyncedAt(noteId, Date.now()) (D-11).
    11. restoreFromFolder() walks directory, parses .md files, additive upsert: new notes created, updated notes merged, unchanged skipped.
    12. Restore preview: "Found N notes (X new, Y updated, Z unchanged)" — local notes not in folder NEVER deleted.
    13. handleNoteRename() deletes old .md file (D-12).
    14. handleNoteDelete() deletes .md file and empty parent category folders (D-12).
    15. buildNoteFile/parseNoteFile round-trip: create file → parse → assert frontmatter fields match original.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>NoteFileSync: restore workflow + re-sync on enrichment acceptance + backup status + edge cases</name>
  <read_first>
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md — D-18 (re-sync on enrichment acceptance: note:saved → NoteFileSync re-writes .md with enriched frontmatter)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-RESEARCH.md — Common Pitfalls §1 (handle expiry after restart), §4 (YAML special characters), Pitfall §5 (IndexedDB transaction conflicts)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-PATTERNS.md — Pattern #5 (lines 400–428: permission check, YAML frontmatter, debounce)
@src/core/notes/NoteFileSync.ts — existing methods from Task 1; add getSyncStatus(), recovery paths
  </read_first>
  <files>
    src/core/notes/NoteFileSync.ts
    tests/core/notes/NoteFileSync.test.ts
  </files>
  <action>
Extend NoteFileSync with restore edge cases, re-sync on enrichment, backup status reporting, and handle-expiry recovery:

**1. Re-sync on enrichment acceptance (D-18):**
When a user accepts enrichment suggestions (tags, category, summary), the note is re-saved by the UI. This triggers another `note:saved` event → NoteFileSync naturally re-writes the `.md` with the enriched frontmatter. No special coordination needed — this is a natural consequence of the EventBus pattern. Verify in test: after enrichment acceptance, the .md file contains updated tags and summary in its YAML frontmatter.

**2. getSyncStatus() method:**
```
getSyncStatus(): { enabled: boolean; handleExists: boolean; permissionState: 'granted' | 'denied' | 'prompt' | 'unknown'; lastSyncAt?: number; error?: string }
```
Called by Phase 7 UI to display backup status (green "Backup: Active" / red "Backup: Error" / yellow "Backup: Paused").

**3. Handle-expiry recovery (Pitfall 1):**
On `initNoteFileSync()`, if `loadPersistedHandle()` returns a handle but `checkPermission()` returns 'denied':
- Set `_syncEnabled = false`.
- Emit `sync:error` event with reason `'handle_expired'`.
- The Phase 7 UI on NotesPage mount checks `getSyncStatus()` — if permissionState is 'denied', show "Re-select backup folder" prompt.
- User calls `setBackupFolder()` again to pick a new folder. Permission re-granted → `_syncEnabled = true`, sync resumes automatically (D-10).

**4. YAML edge cases (Pitfall 4):**
The `yaml` library's `defaultStringType: 'QUOTE_DOUBLE'` option handles most special characters. Add explicit test cases:
- Note title with colon: `"Meeting: Q3 Review"` — frontmatter round-trip preserves colon.
- Note title with hash: `"Topic #1"` — frontmatter round-trip preserves hash.
- Note content with YAML-significant characters (leading `-`, `[`, `{`) — the markdown body (outside frontmatter delimiters) is never parsed as YAML, so these are safe.
- Note with emoji in title and content — Unicode round-trip preserved.

**5. Restore edge cases:**
- Empty folder → restore returns `{ total: 0, newCount: 0, updatedCount: 0, unchangedCount: 0 }`.
- Malformed .md file (no frontmatter) → skipped with error logged, does not crash the restore loop.
- .md file with invalid UUID id → skipped (cannot match to NotesDB).
- Duplicate id across two .md files → first wins, second is skipped with warning.
- Very large note content (>100KB markdown body) → restored successfully (test with fixture).

**6. Sync edge cases:**
- `syncNote` called with non-existent noteId → silently return (note may have been deleted between event emission and debounce fire).
- `syncNote` called when `_handle` is null → silently return (backup folder not configured).
- Category path with deep nesting (e.g., "projects/nowpilot/features/notes") → directory structure created recursively.
- File system write fails with `NotAllowedError` → catch, set `_syncEnabled = false`, emit `sync:error` with reason `'not_allowed'`.

**7. Idempotency of init:**
- `initNoteFileSync()` called twice → second call is no-op (`if (unsub) return`).
- `resetNoteFileSync()` for test isolation → clears unsub, _handle, _syncEnabled, _debounceTimer.

**Extended test suite** (add to existing NoteFileSync.test.ts):
- "re-sync after enrichment acceptance writes updated frontmatter" — simulate save → sync → accept enrichment → save → sync, assert second .md has updated tags/summary
- "getSyncStatus returns correct state" — test each state (granted with handle, denied, no handle)
- "handle expiry triggers error event and disables sync" — load handle, set permission to denied, assert syncEnabled false, sync:error emitted
- "re-select folder after expiry re-enables sync" — call setBackupFolder, assert syncEnabled true
- "YAML round-trip with special characters" — title with colon, hash, emoji; content with markdown syntax
- "restore skips malformed .md files" — fixture with missing frontmatter, assert skipped, remaining files processed
- "restore skips duplicate id files" — two files with same UUID, first processed, second skipped
- "restore from empty folder" — assert zero counts
- "sync with non-existent noteId returns silently" — assert no error thrown
- "sync with null handle returns silently" — assert no error thrown
- "sync with NotAllowedError disables sync and emits error" — mock createWritable to throw NotAllowedError
- "deep category path creates nested directories" — mock getDirectoryHandle chain, assert called with { create: true } for each segment
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteFileSync.test.ts --no-coverage</automated>
  </verify>
  <done>
All NoteFileSync edge cases covered: re-sync on enrichment acceptance updates .md frontmatter; handle expiry detected and recovery path tested; YAML special characters round-trip correctly; restore handles malformed files, duplicate IDs, empty folders gracefully; sync with missing notes/null handles/NotAllowedError handled safely; deep categoryPath creates nested directories; getSyncStatus reports correct state; init is idempotent.
  </done>
  <acceptance_criteria>
    1. Enrichment acceptance → note re-saved → .md re-written with updated frontmatter (D-18).
    2. getSyncStatus() returns { enabled, handleExists, permissionState, lastSyncAt }.
    3. Handle permission expired → sync disabled, sync:error event emitted, UI prompts re-select.
    4. setBackupFolder() after expiry → re-enables sync, permission re-verified.
    5. YAML round-trip preserves special characters (colon, hash, emoji) in title and content.
    6. Restore skips malformed .md files (no frontmatter), continues processing remaining files.
    7. Restore skips .md files with invalid/duplicate UUIDs.
    8. Restore from empty folder returns zero counts.
    9. syncNote with non-existent noteId or null handle → silent return.
    10. NotAllowedError on write → sync disabled, error event emitted.
    11. initNoteFileSync() is idempotent; resetNoteFileSync() cleans up for test isolation.
    12. Deep category paths create recursive directory structure.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| NotesDB → NoteFileSync → File System Access API | Note content crosses from IndexedDB (trusted) to user filesystem (trusted boundary — files written to user-chosen directory) |
| User filesystem → NoteFileSync (restore) | User-chosen .md files read back into IndexedDB — content is user-owned but parsed frontmatter must be validated |
| EventBus note:saved → NoteFileSync handler | Multiple subscribers; handler errors must not crash event dispatch |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05a-10 | Spoofing | NoteFileSync.restoreFromFolder() | medium | mitigate | Zod NoteSchema validation on all restored notes before writing to IndexedDB. Malformed frontmatter → skipped with warning. Missing id field → skipped. Invalid UTF-8 → skipped. restore never deletes local notes (additive-upsert only). |
| T-05a-11 | Tampering | NoteFileSync external-change detection | high | mitigate | D-11: file.lastModified compared against note.lastSyncedAt with 2s tolerance. Externally-modified file → overwrite skipped, user prompted "Overwrite?" defaulting to Skip. Without this: user's external Obsidian edits would be silently overwritten by app saves. |
| T-05a-12 | Tampering | NoteFileSync handleNoteDelete | medium | mitigate | D-12: on note deletion, only the note's own .md file and empty parent folders are removed. Folder traversal: cleanup ascends the path, removing only EMPTY directories. A directory with any remaining files is preserved. |
| T-05a-13 | Information Disclosure | NoteFileSync .md file content | low | accept | .md files are written to user-selected directory on their own filesystem — same trust level as the IndexedDB store. Passwords/sensitive fields already redacted by TraceRedactor per §27.6 before any persistence. |
| T-05a-14 | Denial of Service | NoteFileSync restore large folder | low | accept | Sequential processing of .md files — no memory explosion. Very large files (>10MB) still processed (browser File API handles streaming). Malformed YAML caught by yaml.parse() errors. |
| T-05a-15 | Elevation | NoteFileSync permission bypass | high | mitigate | D-10: handle.queryPermission({ mode: 'readwrite' }) called before EVERY sync attempt. If 'denied', sync is disabled (red "Backup: Error" state). re-enabling requires explicit user gesture (showDirectoryPicker). No write can occur without current 'granted' state. |
</threat_model>

<verification>
  1. `npx vitest run tests/core/notes/NoteFileSync.test.ts --no-coverage` — all NoteFileSync tests pass
  2. `npx tsc --noEmit` — no type errors from NoteFileSync and File System Access API types
</verification>

<success_criteria>
[ ] EventBus note:saved subscription fires debounced sync (50ms)
[ ] Permission check before every write (D-10)
[ ] YAML frontmatter round-trips: id, title, created, updated, tags, categoryPath, summary
[ ] Filename sanitization: invalid chars → underscore
[ ] Collision suffixing: duplicate title → numeric suffix
[ ] External change: file.lastModified > lastSyncedAt+2s → skip overwrite (D-11)
[ ] restoreFromFolder(): additive upsert, preview counts, never deletes local notes
[ ] Rename: old .md deleted, new .md written (D-12)
[ ] Delete: .md deleted, empty parent folders removed (D-12)
[ ] Re-sync on enrichment acceptance: updated frontmatter in .md (D-18)
[ ] Handle expiry → error state → re-select → recovery
[ ] Edge cases: missing note, null handle, NotAllowedError, deep paths, malformed restore
</success_criteria>

<output>
Create `.planning/phases/05a-llm-wiki-filesystem-sync/05a-03-SUMMARY.md` when done
</output>
