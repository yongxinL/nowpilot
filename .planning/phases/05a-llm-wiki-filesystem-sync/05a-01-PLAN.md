---
phase: 05a-llm-wiki-filesystem-sync
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/notes/NoteSchema.ts
  - src/core/notes/NotesDB.ts
  - src/core/notes/NoteFileSync.ts
  - tests/core/notes/NoteFileSync.test.ts
  - tests/core/notes/NotesDB.test.ts
autonomous: true
gap_closure: true
requirements: [NOTE-03]

must_haves:
  truths:
    - "A native-shaped FileSystemDirectoryHandle persists through IndexedDB and a simulated extension restart resumes syncing without re-selection — writes reach the filesystem, not a phantom in-memory tree (CR-01, D-09)"
    - "A class-based test-double handle still persists via the plain-data snapshot path and rehydrates functionally (existing behavior preserved)"
    - "Two notes with the same sanitized title never cross-write: the second note's re-saves reuse its own suffixed file and the first note's canonical .md keeps its content and frontmatter id (CR-02, WR-04)"
    - "A note whose owned .md file was externally modified writes to a fresh numeric suffix instead of overwriting (D-11 preserved; WR-04 — no unbounded suffix accumulation across re-saves)"
    - "Rapid note:saved events for DIFFERENT notes within the debounce window all reach the filesystem (per-note debounce, WR-01); repeated saves of the SAME note still coalesce"
    - "NotesDB.save() preserves lastSyncedFileName across re-saves exactly like lastSyncedAt (D-11/D-18 preservation extended)"
    - "getSyncStatus() exposes enabled/handleExists/permissionState/lastSyncAt/error so the Phase 7 Backup Tag renders the four states On/Off/Error/Paused (UI-SPEC covered lift, SYNC-08)"
    - "sync:external-change carries noteId/title/localModified/fileModified; the write never touches a newer external file — it falls through to a suffixed write (UI-SPEC covered lift, D-11)"
  artifacts:
    - src/core/notes/NoteFileSync.ts
    - src/core/notes/NoteSchema.ts
    - src/core/notes/NotesDB.ts
    - tests/core/notes/NoteFileSync.test.ts
    - tests/core/notes/NotesDB.test.ts
  key_links:
    - "persistHandle → backup_config store (structured clone of the native handle; snapshot fallback for test doubles)"
    - "syncNote → existing-file frontmatter id (ownership decision) → collideFileName (owner-skip scan)"
    - "syncNote → NotesDB.updateSyncState (lastSyncedAt + lastSyncedFileName written together)"
    - "NotesDB.save() → lastSyncedFileName preservation (mirrors lastSyncedAt preservation L79-84)"
  prohibitions:
    - statement: "MUST NOT persist a plain-data snapshot of a native FileSystemDirectoryHandle — native handles structured-clone directly (CR-01)"
      status: flagged-unverified
      verification: "asserted by 05a-01 task 1 tests (persist→restart→sync round-trip)"
    - statement: "MUST NOT overwrite an existing .md whose frontmatter id belongs to a different note — always collide (CR-02)"
      status: flagged-unverified
      verification: "asserted by 05a-01 task 2 ownership tests"
    - statement: "MUST NOT decide overwrite-vs-collide from timestamps alone when the existing file carries a different owner id (CR-02)"
      status: flagged-unverified
      verification: "asserted by 05a-01 task 2 cross-note tests"
  assumptions:
    - "NOTE-03 edge coverage was unclassified at gap-closure time (no SPEC.md) — service-layer edges beyond CR-01/CR-02/WR-04/WR-01 assumed covered by the existing 35-test NoteFileSync suite; real-browser FSA behavior is deferred to Phase 7 (recorded in 05a-03)"
---

<objective>
Close the NoteFileSync write-path blockers from VERIFICATION.md: CR-01 (handle persistence destroys native-handle fidelity — backup silently dies after any restart), CR-02 (collision guard ignores file ownership — one note can overwrite another's canonical .md), WR-04 (collided file ownership never recorded — unbounded suffix accumulation), and WR-01 (single debounce timer drops earlier notes in a burst). These are the root-cause fixes that make SC4 ("durable one-way .md backup that cannot corrupt another note's file") hold at the service layer.

Purpose: Restore the D-09 cross-session persistence guarantee and the D-12 collision guarantee in production (not just against test mocks). The class-based mocks carry own-properties that masked both defects; the tests added here must exercise the native-handle branch and the ownership decision directly.
Output: NoteFileSync write path that (a) persists native handles natively, (b) decides overwrite-vs-collide by frontmatter ownership, (c) reuses the note's own last-written file, (d) debounces per note. NOTE-03 gap items CR-01 + CR-02 + SC4 closed.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Current implementation (source of truth for the defects)
@src/core/notes/NoteFileSync.ts
@src/core/notes/NotesDB.ts
@src/core/notes/NoteSchema.ts
@tests/core/notes/NoteFileSync.test.ts

# Gap definitions and review fix directives
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-VERIFICATION.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-REVIEW.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-03-SUMMARY.md
</context>

<tasks>

<task type="tracer">
  <name>Task 1: End-to-end handle persistence round-trip — native handles persist natively (CR-01)</name>
  <files>src/core/notes/NoteFileSync.ts, tests/core/notes/NoteFileSync.test.ts</files>
  <read_first>
    - src/core/notes/NoteFileSync.ts — persistHandle (L206-216), loadPersistedHandle (L222-232), toPlainHandle (L700-721), rehydrateHandle/rehydrateFile (L724-800), restoreSession (L249-270)
    - src/core/notes/NotesDB.ts — openNotesDb/openDB pattern (L14-20) used by openDb
    - tests/core/notes/NoteFileSync.test.ts — MockDirHandle/MockFileHandle classes (own enumerable props, prototype methods), makeBackupFs/pickerStub helpers, existing 'loadPersistedHandle rehydrates a functional handle' test (L422)
    - node_modules/@types/wicg-file-system-access/index.d.ts — native FileSystemDirectoryHandle members (kind/name/queryPermission/requestPermission/getDirectoryHandle/getFileHandle/removeEntry/resolve/values/entries/keys/Symbol.asyncIterator/isSameEntry)
  </read_first>
  <action>
    Per 05a-REVIEW.md CR-01: persist the native FileSystemDirectoryHandle directly — Chrome structured-clones platform objects into IndexedDB. Keep toPlainHandle()/rehydrateHandle() ONLY for non-native/test-double handles.

    1. In persistHandle(): stop unconditionally calling toPlainHandle(). Add an isNativeHandle-style branch:
       - A NATIVE FileSystemDirectoryHandle (from showDirectoryPicker) is duck-typed by markers the class-based MockDirHandle lacks — Symbol.asyncIterator and/or isSameEntry as a function. When the duck-type matches: `db.put('backup_config', { id: BACKUP_CONFIG_KEY, handle })` — the handle itself.
       - Otherwise (test doubles, cross-runtime fallbacks): keep the current `await toPlainHandle(handle)` snapshot.
       - Update the stale comment at L200-205 and L678-683 to document the branch instead of the unconditional snapshot.
    2. In loadPersistedHandle(): handle BOTH stored shapes. If the stored value is a plain snapshot (has a `children` array — PlainDirHandle shape) → rehydrateHandle(raw) as today. If it is a live handle-like object (has values/getDirectoryHandle/getFileHandle functions) → return it as-is — never rehydrate a real handle.
    3. Do NOT modify rehydrateHandle/rehydrateFile semantics for the snapshot path — existing test-double tests must stay green.
    4. Confirm restoreSession() (L249-270) works unchanged against both shapes: a real handle returns a real queryPermission result; a rehydrated double returns its stored permissionState.
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteFileSync.test.ts --no-coverage && npx tsc --noEmit</automated>
  </verify>
  <done>
    - A native-shaped handle (duck-typed with Symbol.asyncIterator/isSameEntry) round-trips: persistHandle → resetNoteFileSync() + fresh getNoteFileSync() (simulated restart) → initNoteFileSync()/restoreSession() → syncNote() — and the .md write reaches the underlying filesystem-backed mock (writeCount/content on the real mock, not a phantom tree).
    - The persisted record for a native-shaped handle is NOT wrapped in snapshot shape (no `children` property on the stored record.handle).
    - Class-based MockDirHandle still takes the snapshot path and rehydrates functionally ('loadPersistedHandle rehydrates a functional handle' test remains green).
    - All 35 pre-existing NoteFileSync tests + new tests pass; tsc clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ownership-aware collision resolution + owned-file reuse (CR-02, WR-04)</name>
  <files>src/core/notes/NoteSchema.ts, src/core/notes/NotesDB.ts, src/core/notes/NoteFileSync.ts, tests/core/notes/NoteFileSync.test.ts, tests/core/notes/NotesDB.test.ts</files>
  <read_first>
    - src/core/notes/NoteFileSync.ts — syncNote (L287-349), tryGetExistingFile (L352-361), collideFileName (L381-398), dead getFileHandleWithCollision (L434-451, delete), removeFileAndEmptyParents (L477-510, dead `current` var L489)
    - src/core/notes/NoteSchema.ts — NoteSchema fields (L22-42); add lastSyncedFileName near lastSyncedAt
    - src/core/notes/NotesDB.ts — save() (L54-147, lastSyncedAt preservation L79-84), updateLastSyncedAt (L193-199), getByLastSyncedAt (L184-190)
    - tests/core/notes/NoteFileSync.test.ts — collision/external-change tests (makeNote with lastSyncedAt, addFile helper, fm() frontmatter builder)
    - 05a-REVIEW.md CR-02 fix snippet and WR-04 fix snippet (exact target behavior)
  </read_first>
  <behavior>
    - Test 1 (cross-note ownership): notes A and B with the same sanitized title. A syncs → React.md written. B syncs → React 1.md written (suffix), React.md untouched. B re-saves/re-syncs → still writes React 1.md (owned file reused), React.md content AND frontmatter id unchanged (A's file intact).
    - Test 2 (externally modified owned file): B's React 1.md externally modified (lastModified > B.lastSyncedAt + 2000) → next B sync writes React 2.md; React 1.md content untouched.
    - Test 3 (same-note overwrite preserved, D-18): A re-syncs → overwrites its own React.md (no suffix, content updated, frontmatter id = A).
    - Test 4 (third-note occupancy): 'React 1.md' frontmatter id belongs to note C → B's collision scan skips it and picks React 2.md.
    - Test 5 (updateSyncState): NotesDB.updateSyncState(id, { lastSyncedAt, lastSyncedFileName }) persists both fields; a later save() with an omitted payload preserves both (lastSyncedFileName preservation mirrors lastSyncedAt L79-84).
  </behavior>
  <action>
    Per 05a-REVIEW.md CR-02 + WR-04 — the write path must be ownership-aware, not timestamp-only:

    1. NoteSchema.ts: add `lastSyncedFileName: z.string().optional()` next to lastSyncedAt (L34). Optional field — no v5→v6 migration needed; existing records parse fine.
    2. NotesDB.ts: add `updateSyncState(id: string, state: { lastSyncedAt?: number; lastSyncedFileName?: string }): Promise<void>` — raw put merging state into the persisted note (mirror updateLastSyncedAt L193-199). Keep updateLastSyncedAt(id, ts) intact (existing callers/tests in NoteTagger.test.ts L408-411 depend on it) — have it delegate to updateSyncState or remain separate.
    3. NotesDB.ts save(): extend the existing preservation block (L79-84) so lastSyncedFileName is also preserved from the persisted note when the incoming payload omits it (same pattern as lastSyncedAt) — otherwise the next save strips the tracked file name.
    4. NoteFileSync.ts syncNote(): replace the timestamp-only decision (L310-328) with ownership-aware selection:
       - Determine the candidate file: if note.lastSyncedFileName is set → that owned file first; else the canonical `{sanitizeFilename(note.title)}.md`.
       - For the candidate: read existing.lastModified and the existing file's text → parseNoteFile(text).frontmatter.id (L108-113 is exported and reusable):
         - ownerId present and ownerId !== note.id → DIFFERENT note's file → always collide (never overwrite), regardless of timestamps (CR-02). No sync:external-change modal event for this case — it is a pure D-12 collision.
         - ownerId === note.id OR frontmatter unparseable → timestamp check as today: existing.lastModified > (note.lastSyncedAt ?? 0) + EXTERNAL_CHANGE_TOLERANCE_MS → emit sync:external-change (L316-321 payload unchanged) and collide; else overwrite the candidate.
       - Owned-file reuse (WR-04): when note.lastSyncedFileName is set AND that file exists AND is not externally modified → overwrite it directly (reuse — no canonical ping-pong, no new suffix). When the owned file is missing or externally modified → fall through to canonical ownership check + fresh collide scan.
    5. collideFileName(): extend the suffix scan (L381-398) to SKIP existing candidates whose frontmatter id belongs to a different note (parse each existing candidate's frontmatter; continue the scan when ownerId is set and !== note.id). A candidate that is absent, unparseable, or owned by this note is usable.
    6. After every successful write, record the actual fileName written: call `getNotesDb().updateSyncState(noteId, { lastSyncedAt: now, lastSyncedFileName: fileName })` replacing the current updateLastSyncedAt call (L334).
    7. Delete dead getFileHandleWithCollision (L434-451, IN-01 — zero callers, re-encodes the original NotFoundError bug) and the dead `current` variable in removeFileAndEmptyParents (L489, IN-06).
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteFileSync.test.ts tests/core/notes/NotesDB.test.ts --no-coverage && npx tsc --noEmit</automated>
  </verify>
  <done>
    - Cross-note overwrite is impossible: any write to an existing file whose frontmatter id differs from the note's id lands in a suffixed file (CR-02 scenario from VERIFICATION.md reproduced and fixed — B's re-save no longer clobbers A's React.md).
    - A collided note reuses its own last-written file on re-sync; suffixes stop accumulating (WR-04 — 'React 1.md, React 2.md, …' unbounded growth test now shows reuse instead).
    - getFileHandleWithCollision and the dead `current` variable are gone (grep returns zero matches).
    - updateSyncState + save() preservation covered by tests; all pre-existing NoteFileSync/NotesDB tests still green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Per-note debounce — burst saves never drop notes (WR-01)</name>
  <files>src/core/notes/NoteFileSync.ts, tests/core/notes/NoteFileSync.test.ts</files>
  <read_first>
    - src/core/notes/NoteFileSync.ts — _debounceTimer field (L147), scheduleSync (L273-281), resetRuntimeState (L657-666), initNoteFileSync (L240-246)
    - tests/core/notes/NoteFileSync.test.ts — existing 'multiple rapid saves debounce to a single write' test (same-note coalesce must stay green), fake-timer pattern (vi.useFakeTimers after async setup)
    - 05a-REVIEW.md WR-01 fix snippet (per-note debounce map)
  </read_first>
  <action>
    Per 05a-REVIEW.md WR-01: the single `_debounceTimer` clears and re-arms for the LATEST noteId — any two note:saved events within 50ms for different notes lose the earlier note's sync entirely (restoreFromFolder with an active backup backs up only the last note).

    1. Replace the single `_debounceTimer` field (L147) with `private _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()`.
    2. Rewrite scheduleSync(noteId): clear only that note's pending timer (map.get + clearTimeout), set a new timer stored under noteId; on fire, delete the map entry then `void this.syncNote(noteId)`. Same-note coalescing semantics preserved (repeated saves of ONE note still collapse to one write).
    3. resetRuntimeState(): clear ALL timers in the map and reset it (not just one).
    4. Add tests: (a) two DIFFERENT notes saved within 50ms both sync — both .md files exist on the mock FS (this is the restore-burst regression: N restored notes with active backup all get written); (b) repeated saves of the same note still coalesce to a single write (existing test stays green).
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteFileSync.test.ts --no-coverage</automated>
  </verify>
  <done>
    - Two different notes emitted within DEBOUNCE_MS both produce .md files (burst no longer drops notes).
    - Same-note rapid saves still collapse to one write (existing debounce test green).
    - resetRuntimeState clears all pending timers (no leaked timers across tests).
  </done>
</task>

</tasks>

## Artifacts this phase produces

- `NoteSchema.lastSyncedFileName?: string` — optional field tracking the exact file name this note last wrote (WR-04).
- `NotesDB.updateSyncState(id, { lastSyncedAt?, lastSyncedFileName? })` — new method persisting both sync-state fields atomically.
- `NoteFileSync._debounceTimers: Map<string, Timer>` — per-note debounce map (WR-01); `scheduleSync` per-note semantics.
- `NoteFileSync` native-handle duck-typing predicate (Symbol.asyncIterator/isSameEntry) + branched persistHandle/loadPersistedHandle (CR-01).
- `NoteFileSync` ownership-aware target selection (canonical vs owned file) + owner-skip collideFileName scan (CR-02/WR-04).
- Deleted: `NoteFileSync.getFileHandleWithCollision` (IN-01), dead `current` var in removeFileAndEmptyParents (IN-06).

## Deferred to Phase 7

- Real-browser File System Access verification of CR-01 (native handle structured-clone + restart-resume) — vitest/jsdom cannot exercise real platform handles; the duck-typed native-branch tests are the service-layer proxy. Recorded in deferred-items.md by 05a-03 task 2.

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app → backup filesystem | untrusted external files (user-edited .md, files created by other tools) live on the same disk the app writes; lastModified/frontmatter can be tampered or stale |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05a-01 | Tampering | NoteFileSync.syncNote collision guard (CR-02) | high | mitigate | frontmatter-id ownership check: never overwrite a file whose frontmatter id differs from the note being synced (task 2); cross-note backup corruption becomes impossible |
| T-05a-02 | Tampering | NoteFileSync.persistHandle/loadPersistedHandle (CR-01) | high | mitigate | persist native handles via structured clone; snapshot branch only for test doubles; load returns native handles as-is so writes reach the real filesystem (task 1) |
| T-05a-03 | Tampering | syncNote external-change guard (D-11) | medium | mitigate | 2s tolerance + ownership check preserved; a newer external file is never overwritten — write falls through to a suffixed file (task 2) |
| T-05a-04 | Spoofing | NoteFileSync owned-file tracking (WR-04) | low | mitigate | lastSyncedFileName written via updateSyncState alongside lastSyncedAt; reused only when the owned file is not externally modified (task 2) |
| T-05a-05 | DoS | scheduleSync debounce (WR-01) | low | mitigate | per-note timer map prevents burst saves from silently dropping backups (task 3) |
| T-05a-SC | Tampering | npm/pip/cargo installs | low | accept | no new package installs in this plan — all changes are edits to existing source/test files |

</threat_model>

<verification>
- `npx vitest run tests/core/notes/NoteFileSync.test.ts tests/core/notes/NotesDB.test.ts --no-coverage` — all pre-existing + new tests green
- `npx tsc --noEmit` — clean
- grep checks: `getFileHandleWithCollision` and the dead `current` variable return zero matches in src/
- Full-suite regression is the explicit 05a-03 task (runs after 05a-02)
</verification>

<success_criteria>
- CR-01 closed: native handle survives persist → simulated restart → load → sync; writes reach the filesystem (D-09 holds)
- CR-02 closed: same-title notes never cross-write; collision decided by frontmatter ownership, not timestamps alone
- WR-04 closed: collided notes reuse their owned file; no unbounded suffix accumulation
- WR-01 closed: burst saves of different notes all sync
- SC4 service-layer foundation restored: one-way .md backup is durable across sessions and cannot corrupt another note's file
</success_criteria>

<output>
Create `.planning/phases/05a-llm-wiki-filesystem-sync/05a-01-SUMMARY.md` when done
</output>
