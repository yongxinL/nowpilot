---
phase: 05a-llm-wiki-filesystem-sync
plan: 02
subsystem: storage
tags: [eventbus, filesystem-access, cleanup, staleness, citations, vitest, tdd]

requires:
  - phase: 05a-01
    provides: NoteFileSync write path with per-note debounce (WR-01), ownership-aware collisions (CR-02), owned-file reuse (WR-04), native-handle persistence (CR-01)
provides:
  - Event-driven D-12 cleanup (WR-02): NotesDB.remove() emits note:deleted, save() emits note:renamed on title/categoryPath diff; NoteFileSync subscribes both in initNoteFileSync and cancels pending debounce on delete
  - Staleness timestamp diff-writer (WR-03): NotesDB.save() stamps tagsGeneratedAt/summaryGeneratedAt only on applied tags/summary changes; create leaves them unset
  - Snippet-authoritative markerless fallback citations (WR-05): NoteQA.buildCitations rebuilds noteId/title/relevantSnippet from snippets[referenceNumber-1], ignoring LLM-supplied identity
affects: [05a-03, phase 7 (staleness hint UI, enrichment acceptance flow, clickable citations)]

tech-stack:
  added: []
  patterns:
    - "Event payload types exported from the emitter (NotesDB) with identity fields read before mutation — subscribers derive file paths from trusted DB fields (T-05a-06)"
    - "Combined-unsubscribe subscription in initNoteFileSync: one guard, full teardown of note:saved/note:deleted/note:renamed"
    - "Diff-writer in the single write path: timestamps stamp only APPLIED changes, preserved otherwise; create stays never-enriched"

key-files:
  created: []
  modified:
    - src/core/notes/NotesDB.ts
    - src/core/notes/NoteFileSync.ts
    - src/core/notes/NoteQA.ts
    - tests/core/notes/NoteFileSync.test.ts
    - tests/core/notes/NotesDB.test.ts
    - tests/core/notes/NoteMaintenance.test.ts
    - tests/core/notes/NoteQA.test.ts

key-decisions:
  - "WR-02 wired at the service layer via EventBus events (note:deleted/note:renamed) with NotesDB as the single emission point — cleanup fires in the running app, never dead code"
  - "WR-03 implemented NOW in NotesDB.save() (per the recorded plan decision): the Phase 7 enrichment-acceptance flow re-saves via save(), so the writer makes getStaleNotes() viable regardless of Phase 7; reanalyzeAll stays in-memory-only (D-05)"
  - "WR-05 rebuilds fallback citations from snippets by index — LLM-supplied noteId/title/relevantSnippet ignored entirely (T-05a-08); marker path, prompt assembly (D-14), two-mode dispatch (D-15), tiny tier (D-16) untouched"
  - "Real-timer sleeps replace fake timers in EventBus-chain tests: fake-indexeddb schedules IDB transactions via setImmediate, which fake timers also fake — awaited NotesDB saves would deadlock"

patterns-established:
  - "Lifecycle integration tests drive save→delete/rename→cleanup through EventBus + real NotesDB calls; the re-sync recreates a renamed note's category dir, so tests re-fetch the current directory instance from the root handle"

requirements-completed: [NOTE-02, NOTE-03]

coverage:
  - id: D1
    description: "Deleting a note removes its .md and empty parent category folders; renaming removes the orphaned .md at the old path — driven end-to-end through note:deleted/note:renamed events from NotesDB via EventBus subscriptions in initNoteFileSync, with pending-debounce cancellation so a queued sync cannot resurrect a deleted file (WR-02)"
    requirement: NOTE-03
    verification:
      - kind: integration
        ref: "tests/core/notes/NoteFileSync.test.ts#save→delete→cleanup chain through EventBus: .md + empty parent folders removed after NotesDB.remove()"
        status: pass
      - kind: integration
        ref: "tests/core/notes/NoteFileSync.test.ts#save→rename chain through EventBus: old .md removed, new .md written (note:renamed)"
        status: pass
      - kind: integration
        ref: "tests/core/notes/NoteFileSync.test.ts#a queued sync for a deleted note is cancelled — the .md is never written after remove()"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#NotesDB.remove() emits note:deleted when sync is disabled — handler no-ops without crash or spurious error"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#note:deleted/note:renamed payloads carry the identity fields needed to compute old paths"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteFileSync.test.ts#no note:renamed is emitted for a save that keeps title and categoryPath"
        status: pass
    human_judgment: false
  - id: D2
    description: "getStaleNotes() viability restored: NotesDB.save() stamps tagsGeneratedAt/summaryGeneratedAt when tags/summary change vs the persisted note and preserves them otherwise; create leaves both unset — 'enriched then edited' returns stale, untouched enriched does not, never-enriched follows the 60s grace (WR-03, LLM-WIKI-08)"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NotesDB.test.ts#save with changed tags stamps tagsGeneratedAt; unchanged tags preserve it"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NotesDB.test.ts#save with changed summary stamps summaryGeneratedAt; unchanged summary preserves it"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NotesDB.test.ts#create leaves both timestamps unset unless the payload explicitly carries them (never-enriched preserved)"
        status: pass
      - kind: integration
        ref: "tests/core/notes/NoteMaintenance.test.ts#via the save() diff-writer: enriched-then-edited is stale, untouched is not, never-enriched follows the grace rule (WR-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "NoteQA markerless fallback citations never reference non-existent notes: buildCitations rebuilds noteId/title/relevantSnippet from snippets[referenceNumber-1], dropping out-of-range references and deduping; LLM-fabricated identity never enters Citation[] (WR-05, D-13)"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#markerless fallback citations (WR-05) rebuilds citations from the snippet array — fabricated noteId/title never appear"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#markerless fallback citations (WR-05) drops out-of-range referenceNumbers (0 or beyond the snippet array)"
        status: pass
      - kind: unit
        ref: "tests/core/notes/NoteQA.test.ts#markerless fallback citations (WR-05) dedupes duplicate referenceNumbers"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-08-02
status: complete
---

# Phase 05a Plan 02: Event-Driven Cleanup, Staleness Timestamps & Snippet-Authoritative Citations Summary

**WR-02/WR-03/WR-05 closed at the service layer: D-12 rename/delete cleanup is now event-driven (note:deleted/note:renamed from NotesDB, subscribed in initNoteFileSync with debounce cancellation), NotesDB.save() stamps staleness timestamps on applied enrichment changes so getStaleNotes() distinguishes 'enriched then edited' from 'never enriched', and NoteQA's markerless fallback rebuilds citations from the snippet array so LLM-fabricated note identities can never enter Citation[]**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-02T06:33:51Z
- **Completed:** 2026-08-02T06:47:00Z
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 7

## Accomplishments

- **WR-02 closed:** `NotesDB.remove()` fetches the note before deleting and emits `note:deleted` `{noteId, title, categoryPath}`; `NotesDB.save()` emits `note:renamed` `{noteId, oldTitle, oldCategoryPath}` when title or categoryPath changed vs the persisted note (never on unchanged saves). `NoteFileSync.initNoteFileSync()` subscribes both events with a combined unsubscribe (idempotent init, full teardown), cancels the pending per-note debounce on delete (a queued sync can no longer resurrect a deleted file — T-05a-06), and no-ops safely when sync is disabled. The save→delete→cleanup and save→rename chains are integration-tested through EventBus + real NotesDB calls — no direct handler invocation.
- **WR-03 closed (implemented now per the recorded decision):** `NotesDB.save()` diff-writer stamps `tagsGeneratedAt`/`summaryGeneratedAt` only when the incoming tags/summary differ from the persisted note; otherwise the parsed/persisted timestamps are preserved; create leaves both unset (never-enriched). `getStaleNotes()` now distinguishes 'enriched then edited' from 'never enriched' — the LLM-WIKI-08 staleness feature is viable at the service layer, ready for the Phase 7 staleness-hint UI. NoteTagger's D-07 version discard and `updateLastSyncedAt` untouched; NoteMaintenance remains a passive query service (D-21).
- **WR-05 closed:** the markerless fallback in `NoteQA.buildCitations()` rebuilds each citation from `snippets[c.referenceNumber - 1]` — LLM-supplied noteId/title/relevantSnippet are ignored entirely; range check and dedupe preserved; the marker path (`parseCitations`), D-14 prompt assembly, D-15 two-mode dispatch, and D-16 tiny tier are untouched.
- 89 tests green across the four target suites (NoteFileSync 48, NotesDB 16, NoteQA 14, NoteMaintenance 12 — including 16 new), NotesStore suite green (12) as a sanity check on the `remove()` fetch-first change, `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: lifecycle integration tests for event-driven cleanup (WR-02)** - `0ecb8b6` (test)
2. **Task 1 GREEN: wire note:deleted/note:renamed events + subscriptions** - `11e8d46` (feat)
3. **Task 2 RED: staleness timestamp diff-writer tests (WR-03)** - `fb6b1ab` (test)
4. **Task 2 GREEN: staleness timestamp diff-writer in NotesDB.save()** - `e2dc080` (feat)
5. **Task 3 RED: snippet-authoritative fallback citation tests (WR-05)** - `75ea173` (test)
6. **Task 3 GREEN: rebuild markerless fallback citations from snippets** - `c63e0a0` (feat)

**Plan metadata:** pending (docs commit after state updates)

## Files Created/Modified

- `src/core/notes/NotesDB.ts` - exported `NoteDeletedEvent`/`NoteRenamedEvent` payload types; `remove()` fetch-first + `note:deleted` emission; `save()` `note:renamed` emission on title/categoryPath diff; staleness timestamp diff-writer (WR-03)
- `src/core/notes/NoteFileSync.ts` - `initNoteFileSync` subscriptions for `note:deleted`/`note:renamed` with combined unsub + `cancelPendingSync` (WR-02); no-op guard when `_handle` is null
- `src/core/notes/NoteQA.ts` - markerless fallback rebuilt from `snippets[referenceNumber-1]` (WR-05)
- `tests/core/notes/NoteFileSync.test.ts` - new `lifecycle integration (WR-02)` describe: 6 tests (chains, debounce-cancel, no-op, payload shapes, no-false-rename)
- `tests/core/notes/NotesDB.test.ts` - new `staleness timestamp diff-writer (WR-03)` describe: 3 tests
- `tests/core/notes/NoteMaintenance.test.ts` - getStaleNotes integration test via the save() writer (Date-only fake timers)
- `tests/core/notes/NoteQA.test.ts` - new `markerless fallback citations (WR-05)` describe: 3 tests

## Decisions Made

- WR-02 wired via EventBus events from NotesDB (single write path) rather than direct UI invocation — cleanup works for every deletion flow (UI, restore, future surfaces) without per-surface wiring.
- WR-03 writer implemented now in `NotesDB.save()` per the plan's recorded decision — the Phase 7 acceptance flow re-saves via save(), making getStaleNotes() viable regardless of Phase 7 behavior; `reanalyzeAll()` deliberately does NOT write timestamps (D-05: in-memory enrichment only).
- WR-05 rebuilds fallback citations from snippet data by index — the LLM is untrusted for note identity; only index-derived snippet data is authoritative (T-05a-08).
- EventBus-chain integration tests use real-timer sleeps instead of fake timers: fake-indexeddb schedules IDB transactions via `setImmediate` (which vitest fake timers also fake), so an awaited `NotesDB.save()` under fake timers deadlocks. The maintenance integration test fakes only `Date` for the same reason.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chain tests deadlocked under fake timers (fake-indexeddb setImmediate scheduling)**
- **Found during:** Task 1 GREEN verification (integration tests)
- **Issue:** `vi.useFakeTimers()` also fakes `setImmediate`; fake-indexeddb schedules every IDB transaction via setImmediate, so `await getNotesDb().save()` under fake timers never resolves → 5s test timeouts.
- **Fix:** Chain tests switched to real-timer sleeps (`DEBOUNCE_MS + 20`); the NoteMaintenance integration test fakes only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`) so time control works without the IDB deadlock.
- **Files modified:** tests/core/notes/NoteFileSync.test.ts, tests/core/notes/NoteMaintenance.test.ts
- **Verification:** all 89 target-suite tests green.
- **Committed in:** 11e8d46 / e2dc080 (GREEN commits; RED commits were amended before push by these fixes landing in GREEN).

**2. [Rule 1 - Bug] Rename-chain assertion inspected a detached directory instance**
- **Found during:** Task 1 GREEN verification (rename chain test)
- **Issue:** After the rename, the empty-parent cleanup removed the old `Inbox` MockDirHandle from root and the re-sync recreated a NEW instance — the test asserted against the original (now-detached) `fs.categoryDir`, so `Title B.md` appeared missing while the sync actually succeeded (`lastSyncedFileName: Title B.md`).
- **Fix:** Assertion re-fetches the CURRENT Inbox from `fs.root.children.get('Inbox')`.
- **Files modified:** tests/core/notes/NoteFileSync.test.ts
- **Verification:** rename chain test green; delete chain unaffected.
- **Committed in:** 11e8d46 (Task 1 GREEN commit)

**3. [Rule 1 - Bug] RED tests contradicted the create rule of the plan's own must_haves**
- **Found during:** Task 2 RED/GREEN cycle
- **Issue:** The first draft of the NotesDB diff-writer tests asserted the FIRST save (a create) stamps timestamps — but the plan's must_have explicitly says create leaves both unset (never-enriched). The seeded-flow maintenance test also failed to establish an 'enriched' state through the writer (first save = create → no stamps → never-enriched branch masked the discrimination).
- **Fix:** Tests restructured to seed (create) → change tags/summary (stamp) → same-again (preserve); the maintenance timeline uses an edit INSIDE the 60s grace so only the writer makes the note stale (discriminating RED assertion).
- **Files modified:** tests/core/notes/NotesDB.test.ts, tests/core/notes/NoteMaintenance.test.ts
- **Verification:** all 45 NotesDB/NoteMaintenance/NoteTagger tests green; RED phase genuinely failed before GREEN.
- **Committed in:** e2dc080 (Task 2 GREEN commit; RED commit fb6b1ab was reworked before GREEN landed)

**4. [Rule 1 - Bug] Fake-timer leak after NoteMaintenance test timeout corrupted subsequent tests**
- **Found during:** Task 2 RED run
- **Issue:** The deadlocked test (see #1) left fake timers installed when vitest aborted it (finally never ran), causing every following test's `beforeEach` to hang on `resetNotesDb()`.
- **Fix:** Same root cause as #1 — resolved by faking only `Date`; verified the full NoteMaintenance suite runs clean.
- **Files modified:** tests/core/notes/NoteMaintenance.test.ts
- **Verification:** 12/12 NoteMaintenance tests green.
- **Committed in:** e2dc080 (Task 2 GREEN commit)

---

**Total deviations:** 4 auto-fixed (4 Rule 1 - Bug, all test-authoring corrections; no production logic deviation from the plan)
**Impact on plan:** All fixes were required to make the TDD cycle sound and deterministic under fake-indexeddb's setImmediate scheduling. Production code matches the plan's action steps exactly. No scope creep, no new packages.

## Issues Encountered

- fake-indexeddb + vitest fake timers are incompatible for awaited DB operations (setImmediate-based transaction scheduling). Resolved with real-timer sleeps for EventBus chains and Date-only fake timers where time control is needed — documented as the standing pattern for future tests in this suite.
- The create-rule in the plan's must_haves ("create → neither timestamp set") initially looked inconsistent with the behavior block's "≥ prior value" wording; aligned the tests to the must_haves (create never stamps), which is also what makes the never-enriched branch of getStaleNotes() reachable.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-02, WR-03, WR-05 closed at the service layer; NOTE-03 (WR-02) and NOTE-02 (WR-03/WR-05) gap items resolved.
- 05a-03 runs the full-suite regression (explicit 05a-03 task per the plan's verification note) and the remaining gap-closure items.
- Phase 7 consumes: staleness hint UI rendering from getStaleNotes() (now viable), the enrichment-acceptance flow re-saving via save() (timestamps auto-maintained), and clickable citations (NoteQA citations now guaranteed to reference real notes).
- Deferred per plan: SC1/SC2/SC3 UI rendering, staleness-hint rendering, UI-SPEC backstop rows, re-analyze progress widget — all Phase 7 scope.

---
*Phase: 05a-llm-wiki-filesystem-sync*
*Completed: 2026-08-02*

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/05a-llm-wiki-filesystem-sync/05a-02-SUMMARY.md`
- Commits verified in git log: `0ecb8b6` (T1 RED), `11e8d46` (T1 GREEN), `fb6b1ab` (T2 RED), `e2dc080` (T2 GREEN), `75ea173` (T3 RED), `c63e0a0` (T3 GREEN), `2d7c4b1` (SUMMARY)
- All 7 modified files exist on disk
- Plan-level verification: `npx vitest run tests/core/notes/NoteFileSync.test.ts tests/core/notes/NotesDB.test.ts tests/core/notes/NoteQA.test.ts tests/core/notes/NoteMaintenance.test.ts --no-coverage` → 89/89 pass; `npx tsc --noEmit` → clean; grep checks for `note:deleted`/`note:renamed` in both NotesDB.ts and NoteFileSync.ts and `tagsGeneratedAt=`/`summaryGeneratedAt=` in NotesDB.ts → all match
