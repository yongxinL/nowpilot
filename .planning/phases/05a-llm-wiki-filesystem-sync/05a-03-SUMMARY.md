---
phase: 05a-llm-wiki-filesystem-sync
plan: 03
subsystem: notes
tags: [filesystem-sync, file-system-access-api, yaml, indexeddb, eventbus, debounce]

# Dependency graph
requires:
  - phase: 05a-01
    provides: NotesDB v5 (backup_config store via MigrationRunner), NoteSchema lastSyncedAt field, EventBus note:saved, getByLastSyncedAt/updateLastSyncedAt
  - phase: 05
    provides: NotesDB CRUD, NoteSchema, EventBus emit/on pattern
provides:
  - NoteFileSync — one-way app→filesystem .md backup with YAML frontmatter, debounced EventBus writes, permission management, collision/external-change guards, rename/delete cleanup, folder restore with additive upsert (NOTE-03)
affects: [phase 07, verify-work, phase 05a verification]

# Tech tracking
tech-stack:
  added: [yaml (2.9.0 — already in package.json, installed to node_modules), @types/wicg-file-system-access (already present)]
  patterns:
    - "FileSystemDirectoryHandle persistence via plain-data snapshot + rehydration — own-enumerable functions throw DataCloneError in IndexedDB structured clone; the snapshot mirrors the browser platform object's prototype-method shape"
    - "External-change collision flow: newer file → sync:external-change event + fall-through to D-12 numeric-suffix write (never silent skip, never overwrite)"
    - "Directory-path vs file-path resolution flag (resolveDir isFilePath) — cleaning up empty parents requires resolving the target directory itself, not its parent"
    - "lastSyncedAt preservation in NotesDB.save() — re-saves must not reset the sync timestamp (D-11/D-18)"

key-files:
  created:
    - src/core/notes/NoteFileSync.ts
    - tests/core/notes/NoteFileSync.test.ts
  modified:
    - src/core/notes/NotesDB.ts

key-decisions:
  - "Handle persistence stores a plain-data tree snapshot (kind/name/permissionState/children with lastModified+content), rehydrated into a functional handle on load — structured clone throws DataCloneError on own enumerable functions (mock classes proved this; the real platform object's prototype-method shape is what the snapshot mirrors)"
  - "External-change guard never silently skips: it emits sync:external-change AND falls through to a D-12 collision write ({title} 1.md) so the note is still backed up without touching the user's newer file"
  - "Collision resolution is write-path-invariant: getFileHandleWithCollision was replaced by explicit canonical-file check + collideFileName; re-sync of the SAME note overwrites its own file (D-18), a DIFFERENT note's file collides to a suffix (D-12)"
  - "NotesDB.save() now preserves lastSyncedAt from the persisted note when the incoming payload omits it — without this, every enrichment-accepted re-save reset the timestamp and triggered a false external-change skip (real D-11 bug)"
  - "resolveDir takes an isFilePath flag: directory-path resolution returns the target directory itself so empty-parent cleanup removes entries from the directory ABOVE"

requirements-completed: [NOTE-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "NoteFileSync .md write — YAML frontmatter (id/title/created/updated/tags/categoryPath/summary) + markdown body at {categoryPath}/{sanitizedTitle}.md via 50ms-debounced EventBus note:saved handler (D-17)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#buildNoteFile produces valid YAML frontmatter with all fields"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#multiple rapid saves debounce to a single write"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#deep category path creates nested directories recursively"
        status: pass
    human_judgment: false
  - id: D2
    description: "Permission management — queryPermission({mode:'readwrite'}) before every sync (D-10), denial disables sync and emits sync:error; handle-expiry recovery + re-select folder re-enables (D-10, Pitfall 1)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#syncNote skips write when permission is denied"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#handle expiry emits sync:error and disables sync"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#re-select folder after expiry re-enables sync"
        status: pass
    human_judgment: false
  - id: D3
    description: "External-change detection — file.lastModified > lastSyncedAt + 2s tolerance → sync:external-change event + collided suffix write, never overwriting the newer file (D-11)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#syncNote detects external change and skips write"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#syncNote writes when file is not newer"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#collision: duplicate title resolves to numeric suffix"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rename/delete cleanup — orphan .md deleted on rename; .md + empty parent category folders removed on delete; non-empty parents preserved (D-12, T-05a-12)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#handleNoteRename deletes the old .md"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#handleNoteDelete removes file and empty parent folders"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#handleNoteDelete preserves non-empty parent folders"
        status: pass
    human_judgment: false
  - id: D5
    description: "restoreFromFolder — recursive .md walk, YAML frontmatter parse, additive upsert (new/updated/unchanged), preview counts, malformed/invalid/duplicate-id skipped, local notes never deleted (SYNC-09/10, T-05a-10)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#restoreFromFolder returns correct preview counts and upserts"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#restore never deletes local notes absent from the folder"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#restore skips malformed .md files without crashing"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#restore skips invalid and duplicate UUID ids"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#restore from empty folder returns zero counts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Re-sync on enrichment acceptance — note re-save triggers note:saved → .md rewritten with enriched tags/summary frontmatter (D-18)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#re-sync after enrichment acceptance writes updated frontmatter"
        status: pass
    human_judgment: false
  - id: D7
    description: "Backup status + edge cases — getSyncStatus states, YAML special-character round-trip (colon/hash/emoji), non-existent note, null handle, NotAllowedError disables sync, init idempotency"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#getSyncStatus reports granted state with handle and lastSyncAt"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#YAML round-trip preserves colon, hash, and emoji in title and content"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#syncNote with NotAllowedError disables sync and emits error"
        status: pass
    human_judgment: false

# Metrics
duration: 28min
completed: 2026-08-02
status: complete
---

# Phase 05a Plan 3: NoteFileSync Summary

**One-way app→filesystem .md backup service with YAML frontmatter, EventBus-driven 50ms debounced writes, per-sync permission checks, collision/external-change guards, rename/delete cleanup, and additive-upsert folder restore — NOTE-03 complete**

## Performance

- **Duration:** 28 min
- **Started:** 2026-08-02T14:19:00Z
- **Completed:** 2026-08-02T14:47:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 new source, 1 new test, 1 modified) — 1635 insertions

## Accomplishments

- NoteFileSync singleton: `note:saved` EventBus subscription (independent of NoteTagger, D-17) → 50ms debounce → `syncNote()` → File System Access API write of `{categoryPath}/{sanitizedTitle}.md`
- Obsidian-compatible file format: YAML frontmatter (id, title, created, updated, tags, categoryPath, summary — quoted via `yaml` `defaultStringType: 'QUOTE_DOUBLE'`) + markdown body; `parseNoteFile` round-trip
- FileSystemDirectoryHandle persisted in v5 `backup_config` store (D-09) — plain-data snapshot + rehydration so structured clone never sees own enumerable functions (DataCloneError)
- D-10 permission verification (`queryPermission({mode:'readwrite'})`) on every sync attempt; denial disables sync, emits `sync:error` (reason `permission_denied`/`handle_expired`/`not_allowed`); `getSyncStatus()` + re-select recovery for the Phase 7 UI
- D-11 external-change detection (2s tolerance): newer file → `sync:external-change` event + **collision write** to `{title} 1.md` (never overwrites, never loses the backup)
- D-12 cleanup: `handleNoteRename` deletes orphan .md; `handleNoteDelete` deletes .md + empty parent folders bottom-up (non-empty parents preserved); collision numeric suffixing
- `restoreFromFolder()`: recursive .md walk, additive upsert (new/updated/unchanged) with preview counts, malformed/invalid-UUID/duplicate-id files skipped, local notes NEVER deleted (T-05a-10/12)
- D-18 re-sync: enrichment acceptance → re-save → `.md` rewritten with enriched frontmatter (verified in test)
- Bug fix in NotesDB: `save()` preserves `lastSyncedAt` across re-saves — critical for D-11/D-18 correctness
- 35 tests passing; `npx tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1+2: NoteFileSync service + full edge-case suite** - `dd826a5` (feat)
   (Both tasks share the same two files — implementation and tests — so they form one atomic commit.)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `src/core/notes/NoteFileSync.ts` - The service: `setBackupFolder`, `checkPermission`, `persistHandle`/`loadPersistedHandle` (plain-data snapshot + rehydrate), `initNoteFileSync` (idempotent, 50ms debounce), `syncNote` (D-10 → D-11 → collision → write → `updateLastSyncedAt`), `restoreFromFolder`, `handleNoteRename`/`handleNoteDelete`, `getSyncStatus`, `resetRuntimeState`; exports `sanitizeFilename`, `buildFilePath`, `buildNoteFile`, `parseNoteFile`, `verifyPermission`, constants, event payload types
- `tests/core/notes/NoteFileSync.test.ts` - 35 tests with class-based File System Access API mocks (structured-clone-safe, matching the real platform object shape)
- `src/core/notes/NotesDB.ts` - `save()` preserves `lastSyncedAt` from the persisted note when the payload omits it

## Decisions Made

- Handle persistence as a plain-data tree snapshot (own-enumerable functions throw `DataCloneError` in IndexedDB structured clone — this is why the real FileSystemDirectoryHandle persists natively and mocks must be class-based)
- External-change guard is never a silent skip: event + collided write keeps the backup complete
- Collision ownership: same-note re-sync overwrites its own file (D-18); a different note's title collides to a numeric suffix (D-12)
- `resolveDir` gained an `isFilePath` flag — directory-path resolution must return the target directory itself, otherwise empty-parent cleanup removes entries from the wrong directory
- YAML keys are quoted by `yaml.stringify` with `defaultStringType: 'QUOTE_DOUBLE'` — assertions match the actual output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Structured clone DataCloneError on handle persistence**
- **Found during:** Task 1 (setBackupFolder tests)
- **Issue:** `db.put('backup_config', { handle })` with mock/variadic handles threw `DataCloneError` — own enumerable function properties can't be cloned. The real FileSystemDirectoryHandle works because its methods live on the prototype.
- **Fix:** `persistHandle` stores a plain-data snapshot (`toPlainHandle` deep walk); `loadPersistedHandle` rehydrates a functional handle (`rehydrateHandle`/`rehydrateFile` with live child-list mutation). Test mocks are class-based (methods on prototype).
- **Files modified:** src/core/notes/NoteFileSync.ts, tests/core/notes/NoteFileSync.test.ts
- **Verification:** loadPersistedHandle rehydrates a functional handle test passes; all sync tests pass
- **Committed in:** dd826a5

**2. [Rule 1 - Bug] Empty-parent cleanup resolved the wrong directory**
- **Found during:** Task 1 (handleNoteDelete tests)
- **Issue:** `resolveDir('Inbox')` dropped the last segment and returned the ROOT, so the parent-emptiness check always saw ≥1 child and empty parents were never removed.
- **Fix:** `resolveDir(filePath, create, isFilePath)` — file paths drop the last segment, directory paths resolve the target itself; cleanup removes the empty entry from the directory above.
- **Files modified:** src/core/notes/NoteFileSync.ts
- **Verification:** 'handleNoteDelete removes file and empty parent folders' passes
- **Committed in:** dd826a5

**3. [Rule 1 - Bug] NotesDB.save() clobbered lastSyncedAt → false external-change skips**
- **Found during:** Task 2 (re-sync on enrichment acceptance test)
- **Issue:** A re-save with an omitted `lastSyncedAt` (UI saves the full note object) reset the timestamp to undefined; the next sync then treated the app's own file as externally modified (D-11 false positive) and refused to write enriched frontmatter.
- **Fix:** `NotesDB.save()` preserves `lastSyncedAt` from the persisted note when the incoming payload omits it.
- **Files modified:** src/core/notes/NotesDB.ts
- **Verification:** 're-sync after enrichment acceptance writes updated frontmatter' passes; full notes/storage suite (176 tests) green
- **Committed in:** dd826a5

**4. [Rule 3 - Blocking] Mock FSA handle persistence needed structured-clone-safe design**
- **Found during:** Task 1 (all handle-dependent tests)
- **Issue:** vitest/jsdom lacks File System Access API; naive `vi.fn()`-heavy mocks broke persistence (see deviation 1).
- **Fix:** Class-based MockDirHandle/MockFileHandle with methods on the prototype + separate plain-data `permissionState`/`children`/`lastModified`/`content` fields; async-generator `values()` matching production `for await` usage.
- **Files modified:** tests/core/notes/NoteFileSync.test.ts
- **Verification:** all 35 tests pass
- **Committed in:** dd826a5

**5. [Rule 3 - Blocking] Collision resolution never triggered**
- **Found during:** Task 1 (collision test)
- **Issue:** Plan's `getFileHandleWithCollision` used `getFileHandle(name, { create: true })`, which never throws NotFoundError — the collision loop always returned the first candidate.
- **Fix:** Explicit canonical-file check + `collideFileName()` scanning for the first free suffix; external-change guard falls through to a collided write instead of skipping.
- **Files modified:** src/core/notes/NoteFileSync.ts
- **Verification:** 'collision: duplicate title resolves to numeric suffix' passes
- **Committed in:** dd826a5

---

**Total deviations:** 5 auto-fixed (4 Rule 1, 1 Rule 3)
**Impact on plan:** All fixes were correctness requirements — the plan's test list was unachievable without them. No scope creep; no architectural changes.

## Issues Encountered

- **Pre-existing Phase 3 AI test failures (out of scope):** `tests/core/ai/StreamAdapter.test.ts` (2) and `tests/core/ai/providers/ProviderAdapter.test.ts` (4) fail on HEAD *without* any 05a-03 changes (verified by running them in isolation) — `Symbol.asyncIterator`/`createLanguageModel` issues in the AI layer. Unrelated to NoteFileSync; logged to deferred-items.md.
- npm `yaml` install initially failed with a pre-existing zod peer conflict (zod 4 vs ollama-ai-provider's zod 3 peer) — resolved with `--legacy-peer-deps`; package.json/lockfile already declared yaml.

## User Setup Required

None - no external service configuration required. The backup folder is selected at runtime via `showDirectoryPicker()` (user gesture) in the Phase 7 UI.

## Next Phase Readiness

- NOTE-03 complete — one-way filesystem sync + restore fully implemented and tested
- Phase 5a (5 services) now complete: LlmService, NoteTagger, NoteQA, NoteChatConverter, NoteFileSync, NoteMaintenance; NOTE-02 + NOTE-03 both implemented
- Phase 7 UI wiring: backup status display (getSyncStatus), folder selection (setBackupFolder), restore flow (restoreFromFolder), overwrite-confirmation prompt on sync:external-change
- Deferred: Phase 3 AI test failures (6) predate this plan and should be triaged separately

## Self-Check: PASSED

- `src/core/notes/NoteFileSync.ts` — exists ✓
- `tests/core/notes/NoteFileSync.test.ts` — exists ✓ (35 tests pass)
- `05a-03-SUMMARY.md` — exists ✓
- Commit `dd826a5` (feat(05a-03)) — verified in git log ✓
- `npx vitest run tests/core/notes/NoteFileSync.test.ts --no-coverage` — 35/35 pass ✓
- `npx tsc --noEmit` — clean ✓
- Plan verification items: `vitest run tests/core/notes/NoteFileSync.test.ts` ✓, `tsc --noEmit` ✓

---
*Phase: 05a-llm-wiki-filesystem-sync*
*Completed: 2026-08-02*
