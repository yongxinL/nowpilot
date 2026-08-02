---
phase: 05a-llm-wiki-filesystem-sync
plan: 01
subsystem: storage
tags: [indexeddb, file-system-access, structured-clone, yaml-frontmatter, debounce, vitest, ownership]

requires:
  - phase: 05
    provides: NoteFileSync/NotesDB/NoteSchema with D-09..D-12 sync behaviors (35-test suite)
provides:
  - Native FileSystemDirectoryHandle persistence via structured clone (CR-01) — D-09 cross-session guarantee restored at the service layer
  - Ownership-aware collision resolution (CR-02) — frontmatter-id check makes cross-note overwrite impossible
  - Owned-file reuse via lastSyncedFileName (WR-04) — no unbounded suffix accumulation
  - Per-note debounce map (WR-01) — burst saves of different notes all sync
  - NotesDB.updateSyncState + save() preservation of lastSyncedFileName
  - restoreSession re-enables sync on a granted permission check (restart-resume fix)
affects: [05a-02, 05a-03, phase 7 (Backup UI), phase 7 (real-browser FSA verification)]

tech-stack:
  added: []
  patterns:
    - "Native-handle duck-typing: isSameEntry + Symbol.asyncIterator identify platform handles for direct structured-clone persistence; test doubles take the plain-data snapshot fallback"
    - "Ownership-aware write path: candidate selection (owned file → canonical) with frontmatter-id ownership checks and an owner-skip collision scan"
    - "Per-note debounce: Map<noteId, timer> replaces the single-timer coalescing"

key-files:
  created: []
  modified:
    - src/core/notes/NoteFileSync.ts
    - src/core/notes/NoteSchema.ts
    - src/core/notes/NotesDB.ts
    - tests/core/notes/NoteFileSync.test.ts
    - tests/core/notes/NotesDB.test.ts

key-decisions:
  - "Native FileSystemDirectoryHandles are persisted directly (browser structured-clones them to a live handle); toPlainHandle/rehydrateHandle remain ONLY for non-native/test-double handles (CR-01)"
  - "Overwrite-vs-collide is decided by frontmatter ownership first, timestamps second; a file with a different note's id is never overwritten regardless of lastModified (CR-02)"
  - "lastSyncedFileName tracks the exact file a note last wrote; updateSyncState persists it with lastSyncedAt atomically; save() preserves both on re-save (WR-04)"
  - "Collision scan skips foreign-owned AND externally-modified candidates; an unparseable-but-external file is never overwritten (D-11)"
  - "restoreSession sets _syncEnabled=true when the restored handle passes the readwrite permission check — a fresh singleton previously stayed disabled forever after restart"

patterns-established:
  - "Duck-typed native-branch tests emulate the browser's identity-preserving handle clone via a scoped structuredClone stub — fake-indexeddb cannot clone platform objects"

requirements-completed: [NOTE-03]

coverage:
  - id: D1
    description: "Native-shaped FileSystemDirectoryHandle persists through IndexedDB; a simulated extension restart resumes syncing without re-selection; writes reach the filesystem-backed mock, not a phantom tree (CR-01, D-09)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#native-shaped handle persists natively and sync resumes after a simulated restart (CR-01)"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#restoreSession resumes sync with a rehydrated snapshot double (D-10 preserved)"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#loadPersistedHandle rehydrates a functional handle"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two notes with the same sanitized title never cross-write: the second note's re-saves reuse its own suffixed file and the first note's canonical .md keeps content + frontmatter id; collision scan skips foreign-owned files (CR-02, D-12)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#CR-02: a different note never overwrites the canonical file; re-saves reuse its own suffixed file"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#CR-02: the collision scan skips a suffixed file owned by a third note"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#collision: duplicate title resolves to numeric suffix"
        status: pass
    human_judgment: false
  - id: D3
    description: "A note whose owned .md file was externally modified writes to a fresh numeric suffix instead of overwriting; re-saves reuse the owned file so suffixes do not accumulate (WR-04, D-11, D-18)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#WR-04: an externally modified owned file gets a fresh suffix; its content is untouched"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#D-18: the same note re-sync overwrites its own canonical file without a suffix"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NotesDB.test.ts#updateSyncState persists lastSyncedAt + lastSyncedFileName; save() preserves both when omitted (WR-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rapid note:saved events for DIFFERENT notes within the debounce window all reach the filesystem (per-note debounce); repeated saves of the SAME note still coalesce (WR-01)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#per-note debounce: a burst of DIFFERENT notes all reach the filesystem (WR-01)"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#multiple rapid saves debounce to a single write"
        status: pass
    human_judgment: false
  - id: D5
    description: "sync:external-change carries noteId/title/localModified/fileModified and the write never touches a newer external file; every sync re-checks permission on the live handle (D-10/D-11 preserved through persistence and rehydration)"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#syncNote detects external change and skips write"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#handle expiry emits sync:error and disables sync"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#syncNote succeeds when permission is granted"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-08-02
status: complete
---

# Phase 05a Plan 01: NoteFileSync Write-Path Fixes Summary

**Ownership-aware, native-handle-preserving .md backup write path: native FileSystemDirectoryHandles persist via structured clone (CR-01), collisions are decided by frontmatter ownership so cross-note overwrite is impossible (CR-02), notes reuse their own last-written file (WR-04), and per-note debounce timers stop burst saves from dropping notes (WR-01)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-02T06:17:30Z
- **Completed:** 2026-08-02T06:27:26Z
- **Tasks:** 3 (tracer + 1 TDD + 1 auto)
- **Files modified:** 5

## Accomplishments

- CR-01 closed: `persistHandle` stores a duck-typed native handle directly (browser structured clone → live handle on load); `toPlainHandle`/`rehydrateHandle` stay only for non-native/test-double handles. `loadPersistedHandle` returns live handle-like objects as-is, rehydrates only the snapshot shape. A simulated restart resumes syncing and writes reach the filesystem-backed mock.
- CR-02 closed: `syncNote` target selection checks the existing file's frontmatter id before deciding overwrite-vs-collide — a file owned by a different note is never overwritten, regardless of timestamps; no `sync:external-change` modal for pure D-12 collisions.
- WR-04 closed: `lastSyncedFileName` (new optional NoteSchema field) records the exact file written; `NotesDB.updateSyncState` persists it with `lastSyncedAt` atomically; `save()` preserves both on re-save; re-syncs reuse the owned file when fresh, so suffixes stop accumulating.
- WR-01 closed: single `_debounceTimer` replaced with a per-note `Map<noteId, timer>`; burst saves of different notes all reach the filesystem; same-note coalescing preserved.
- `restoreSession` now re-enables sync when the restored handle passes the readwrite permission check — previously a fresh singleton stayed `_syncEnabled=false` forever after restart, silently killing backup even with a valid handle (Rule 1 fix).
- Dead code removed: `getFileHandleWithCollision` (IN-01) and the dead `current` var in `removeFileAndEmptyParents` (IN-06).
- 55 tests green across NoteFileSync + NotesDB suites (42 in NoteFileSync including 7 new), full notes/migrations regression (128 tests) green, `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): CR-01 handle persistence round-trip** - `82004b2` (feat)
2. **Task 2 RED: ownership/collision failing tests** - `4d04001` (test)
3. **Task 2 GREEN: ownership-aware collision + owned-file reuse** - `14696dd` (feat)
4. **Task 3: per-note debounce map** - `15852c9` (feat)

**Plan metadata:** pending (docs commit after state updates)

## Files Created/Modified

- `src/core/notes/NoteFileSync.ts` - native-handle duck-typing + branched persistHandle/loadPersistedHandle (CR-01); ownership-aware selectTargetFile + owner-skip collideFileName (CR-02/WR-04); per-note `_debounceTimers` map (WR-01); restoreSession re-enable on granted; deleted dead getFileHandleWithCollision + dead `current` var
- `src/core/notes/NoteSchema.ts` - `lastSyncedFileName: z.string().optional()` next to lastSyncedAt
- `src/core/notes/NotesDB.ts` - `updateSyncState(id, {lastSyncedAt?, lastSyncedFileName?})`; `updateLastSyncedAt` delegates to it; `save()` preserves lastSyncedFileName like lastSyncedAt
- `tests/core/notes/NoteFileSync.test.ts` - NativeMockDirHandle + identity-clone structuredClone stub; CR-01 round-trip + rehydrated-double restart tests; CR-02/WR-04/D-18/third-note tests; WR-01 burst test
- `tests/core/notes/NotesDB.test.ts` - updateSyncState + save() preservation test

## Decisions Made

- Native handles are persisted directly and returned as-is on load — never snapshotted, never rehydrated (the snapshot exists solely for test doubles/cross-runtime fallbacks).
- The write path is ownership-first: frontmatter id decides overwrite-vs-collide before timestamps; only same-owner/unparseable files fall back to the D-11 2s-tolerance check.
- The collision scan skips foreign-owned AND externally-modified candidates; "unparseable" alone no longer makes a candidate usable when the file is newer than the note's last sync (D-11 never-overwrite-newer-external).
- Re-save simulations in tests use `save()` (the app path with sync-state preservation), not `restore()` (raw put that strips the fields).
- Tracer feedback gate executed as the autonomous branch (plan frontmatter `autonomous: true`, full-plan sequential dispatch): Task 1's `<verify>` (vitest + tsc) re-ran green before expansion began.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] restoreSession never re-enabled sync after a successful permission check**
- **Found during:** Task 1 (CR-01 round-trip tests)
- **Issue:** `restoreSession()` only ever set `_syncEnabled = false` (on failure); on success it left the fresh singleton's default `false` untouched. Even with a valid persisted handle, sync silently never resumed after an extension restart — the "resumes syncing" half of D-09 was broken independently of the snapshot defect.
- **Fix:** On a granted `checkPermission()`, set `_syncEnabled = true` and clear `_error`.
- **Files modified:** src/core/notes/NoteFileSync.ts
- **Verification:** CR-01 round-trip + rehydrated-double restart tests assert `getSyncStatus().enabled === true` after `initNoteFileSync()` on a fresh singleton; full suite green.
- **Committed in:** 82004b2 (Task 1 commit)

**2. [Rule 1 - Bug] Collision scan reused an externally-modified owned file whose frontmatter the user's edit wiped**
- **Found during:** Task 2 (WR-04 test)
- **Issue:** The scan's "unparseable → usable" rule returned the note's own externally-modified file (user replaced content, removing frontmatter) instead of advancing to a fresh suffix — violating D-11 (never overwrite a newer external file) and the WR-04 fresh-suffix contract.
- **Fix:** The scan now skips any candidate that is externally modified (own file or unparseable), matching D-11; only absent/not-external candidates are usable.
- **Files modified:** src/core/notes/NoteFileSync.ts
- **Verification:** WR-04 test asserts React 2.md is created and React 1.md content untouched; all 55 tests green.
- **Committed in:** 14696dd (Task 2 GREEN commit)

**3. [Rule 1 - Bug] RED tests simulated re-saves via `restore()` (raw put), stripping sync state**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** `getNotesDb().restore(updatedB)` replaces the whole record, dropping `lastSyncedAt`/`lastSyncedFileName` — so the ownership reuse path was never exercised and the canonical-owner file looked externally modified. The app re-saves via `save()`, which preserves both fields (the existing D-18 test documents this).
- **Fix:** Re-save simulations switched to `save()`; the third-note test now seeds a foreign-owned canonical React.md (note A) so B's collision scan is actually reached (writing canonical when absent is correct behavior, not a bug).
- **Files modified:** tests/core/notes/NoteFileSync.test.ts
- **Verification:** CR-02/WR-04/D-18/third-note tests pass; all 55 tests green.
- **Committed in:** 14696dd (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 - Bug)
**Impact on plan:** All three were correctness fixes required by the plan's own must_haves; no scope creep, no new packages.

## Issues Encountered

- fake-indexeddb's structured clone cannot reproduce the browser's identity-preserving clone of platform FileSystemHandles (class instances lose prototype methods and function-own-properties throw DataError). Resolved with a scoped `structuredClone` stub that identity-clones only duck-typed native handles during the CR-01 round-trip test — documented as the service-layer proxy for real-browser FSA behavior (deferred to Phase 7 per the plan's Deferred section).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-01, CR-02, WR-04, WR-01 closed at the service layer; SC4 ("durable one-way .md backup that cannot corrupt another note's file") foundation restored.
- Ready for 05a-02 (NoteTagger/maintenance gaps per phase replan).
- Deferred to Phase 7: real-browser File System Access verification of CR-01 (native handle structured-clone + restart-resume) — vitest/jsdom cannot exercise real platform handles; recorded in deferred-items.md by 05a-03 task 2.
- Full-suite regression is the explicit 05a-03 task (runs after 05a-02), per plan verification note.

---
*Phase: 05a-llm-wiki-filesystem-sync*
*Completed: 2026-08-02*

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/05a-llm-wiki-filesystem-sync/05a-01-SUMMARY.md`
- Commits verified in git log: `82004b2` (Task 1), `4d04001` (Task 2 RED), `14696dd` (Task 2 GREEN), `15852c9` (Task 3)
- Key files exist: `src/core/notes/NoteFileSync.ts`, `tests/core/notes/NoteFileSync.test.ts`
- Plan-level verification: `npx vitest run tests/core/notes/NoteFileSync.test.ts tests/core/notes/NotesDB.test.ts --no-coverage` → 55/55 pass; `npx tsc --noEmit` → clean; dead-code greps → zero matches
