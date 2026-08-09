---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 04
subsystem: storage
tags: [write-journal, writejournaldb, indexeddb, idb, crash-recovery, workspace-persistence, runjournaled, recoverjournal, d-06, d-07, o-11]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: 02-01 WriteJournalEntry/WriteJournalOperation types + WRITE_JOURNAL_FAILED/WRITE_JOURNAL_ROLLBACK_FAILED codes + journal-recovery fixture builder; 02-02 redactSensitive field-level redaction; 02-03 vault (unchanged); 01-06 WorkspaceStore contract (sanitizeStored, ACTIVE_FIELDS, version-LWW onChanged)
provides:
  - WriteJournal framework (src/core/storage/WriteJournal.ts): JournalStep interface, runJournaled (O.11 verbatim: applying → per-step → completed, reverse-rollback with WRITE_JOURNAL_ROLLBACK_FAILED per-step wrap), recoverJournal (pending/applying replay only), WriteJournalDB (idb 'WriteJournalDB' v1, entries store keyPath 'id', §15.1), persistJournalEntry (redactSensitive BEFORE put — D-16/T-2-04-04), loadPendingEntries
  - WorkspaceStore D-06 rewire: np_workspace writes flow EXCLUSIVELY through journaledUpdateWorkspace (update-workspace op, §20.2 idempotency key = workspaceId + version, §20.3 step order write-np-workspace → emit-workspace-updated), plus recoverWorkspaceJournal (D-07: M.3 workspaceId scope gate + unknown-op skip-and-log, replay-once completion) invoked at the end of init()
  - 12 tests: 8 WriteJournal unit (happy/rollback/rollback-failure/replay-once/unknown-op/workspace-scope/persist-redaction) + 4 WorkspacePersistence integration (reload hydration, through-the-journal write, crash-mid-write recovery, cross-surface handoff) — all importing the SAME buildJournalRecoveryFixture builder (D-21)
affects: [02-06 ErrorStore IDB sinks, 02-11 verification, Phase 3/5 additional WriteJournal consumers (D-05 — vocabulary declared, more ops wired later), verify-work STORAGE-04 UAT]

# Tech tracking
tech-stack:
  added: [] # no new deps — idb 8.0.3 + fake-indexeddb 6.2.5 already installed in 02-01
  patterns:
    - "Appendix O.11 verbatim adaptation: runJournaled/recoverJournal keep the reference signatures; the D-05/D-07 consumer gates (scope + known-op) live in the WorkspaceStore replay, NOT in the framework loop"
    - "Persist-at-every-boundary: runJournaled persists the entry at 'applying', after each step, and at 'completed'/'rolled-back' — a crash mid-write always leaves a recoverable 'applying' entry, never a half-applied write (T-2-04-03)"
    - "D-16 redaction at the journal write boundary: persistJournalEntry routes the whole entry (step error/message strings) through redactSensitive before put — the same hook ErrorStore/export consume"

key-files:
  created:
    - src/core/storage/WriteJournal.ts
    - tests/core/storage/WriteJournal.test.ts
    - tests/core/workspace/WorkspacePersistence.test.ts
  modified:
    - src/core/workspace/WorkspaceStore.ts

key-decisions:
  - "start() AWAITS journaledUpdateWorkspace (not fire-and-forget void): start() must complete only after the np_workspace write lands — the 01-06 contract test asserts the storage read immediately after `await start()`; journaledUpdateWorkspace never throws so the await is safe (Rule 1 behavior preservation)"
  - "Replay re-applies the idempotent versioned upsert (write-np-workspace) and marks the entry completed via persistJournalEntry — replay-once means the next recovery pass skips it (completed status), and a replayed write is a no-op-by-key when storage already carries >= the entry version"
  - "recoverWorkspaceJournal runs AFTER the onChanged listener is wired in init() so a replayed write propagates through the normal same-workspace LWW path; foreign-workspace replay is skipped with STORE_SYNC (same gate as the onChanged handler and WorkspaceSync.handleRemoteUpdate — WR-10 agreement)"
  - "Unknown-op replay = skip + debugLog (WRITE_JOURNAL_FAILED), never throw — the fixture's 'future-sync-op' entry proves a forward-compat entry cannot brick startup (T-2-04-02)"

patterns-established:
  - "Pattern 1: framework-vs-consumer gate split — the O.11 loop stays verbatim; D-07 scope/op gates are the consumer replay's contract (tested at both unit level with gated replays and integration level with the real store)"
  - "Pattern 2: per-test IDB isolation — `indexedDB = new IDBFactory()` in beforeEach (RESEARCH Pattern 8) so WriteJournalDB starts empty per test"
  - "Pattern 3: integration test polls WriteJournalDB with vi.waitFor for the fire-and-forget update() journal write to land (completed entry visible) before asserting"

requirements-completed: [STORAGE-04]

coverage:
  - id: D1
    description: "WriteJournal framework — JournalStep, runJournaled (O.11: applying → per-step → completed, reverse-rollback, WRITE_JOURNAL_FAILED/WRITE_JOURNAL_ROLLBACK_FAILED logging, rethrow), recoverJournal (pending/applying only), WriteJournalDB entries store (idb v1 keyPath id), persistJournalEntry with redactSensitive-before-put, loadPendingEntries"
    requirement: STORAGE-04
    verification:
      - kind: unit
        ref: "tests/core/storage/WriteJournal.test.ts#runJournaled happy path, rollback, rollback-failure non-masking — 3 tests"
        status: pass
      - kind: unit
        ref: "tests/core/storage/WriteJournal.test.ts#persistJournalEntry redacts step error sk-… to [REDACTED] before put (D-16/T-2-04-04)"
        status: pass
      - kind: other
        ref: "grep runJournaled/recoverJournal/WriteJournalDB/JournalStep/redactSensitive in src/core/storage/WriteJournal.ts — all >= 1 (Task 1 acceptance)"
        status: pass
    human_judgment: false
  - id: D2
    description: "WorkspaceStore D-06 rewire — every np_workspace write routes through journaledUpdateWorkspace (update-workspace op, workspaceId+version targetIds, §20.3 step order write → emit WORKSPACE_UPDATED); sanitizeStored/ACTIVE_FIELDS/version-LWW machinery preserved"
    requirement: STORAGE-04
    verification:
      - kind: integration
        ref: "tests/core/workspace/WorkspacePersistence.test.ts#update() writes THROUGH the journal — completed entry with targetIds {workspaceId, version:'1'} + np_workspace version 1"
        status: pass
      - kind: integration
        ref: "tests/core/workspace/WorkspacePersistence.test.ts#hydrates np_workspace seeded through the store's own journaled path (reload)"
        status: pass
      - kind: other
        ref: "pnpm vitest run tests/core/workspace — 30/30 green (existing WorkspaceStore/WorkspaceSync suites still pass after the rewire)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Crash recovery + workspace-scoped replay (D-07) — recoverWorkspaceJournal replays pending/applying entries on init with the M.3 workspaceId scope gate and unknown-op skip-and-log; crash-mid-write converges np_workspace to the entry version; cross-surface handoff persists across reload"
    requirement: STORAGE-04
    verification:
      - kind: integration
        ref: "tests/core/workspace/WorkspacePersistence.test.ts#recovers a crash-mid-write — np_workspace converges to version 5; foreign-workspace + unknown-op entries skip (D-07 matrix)"
        status: pass
      - kind: integration
        ref: "tests/core/workspace/WorkspacePersistence.test.ts#persists across cross-surface handoff — start(sidepanel)→start(standalone), fresh init hydrates standalone v2"
        status: pass
      - kind: unit
        ref: "tests/core/storage/WriteJournal.test.ts#recoverJournal replay-once + unknown-op skip + workspace-scoped skip — 3 tests with gated replays"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 4: WriteJournal Framework + Journaled WorkspaceStore Summary

**Crash-safe WriteJournal shipped (STORAGE-04): the Appendix O.11 runJournaled/recoverJournal framework with the WriteJournalDB IndexedDB entries store (persistJournalEntry redacting through the 02-02 redactSensitive hook before every put), and the WorkspaceStore D-06 rewire that routes every np_workspace write through a journaled update-workspace op (workspaceId+version idempotency key, §20.3 order) with D-07 workspace-scoped replay — proven by 12 tests sharing one deterministic journal-recovery fixture (D-21), including an end-to-end crash-mid-write recovery that converges np_workspace to the entry's version**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-09T05:32:13Z
- **Completed:** 2026-08-09T05:49:17Z
- **Tasks:** 3 (2 tdd, 1 auto)
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments

- **WriteJournal framework (`src/core/storage/WriteJournal.ts`):** `JournalStep` interface, `runJournaled(entry, steps, persist)` and `recoverJournal(load, replay)` adapted verbatim from Appendix O.11 (lines 6598-6643) — persisting the entry at every boundary ('applying' → per-step → 'completed', or reverse-rollback with per-step `WRITE_JOURNAL_ROLLBACK_FAILED` wrap + 'rolled-back' + rethrow), with the framework's error paths using the canonical 02-01 codes (Golden Rule 9).
- **WriteJournalDB (§15.1):** idb `openDB('WriteJournalDB', 1)` with a single `entries` store (keyPath 'id'); `persistJournalEntry` routes the whole entry through `redactSensitive` BEFORE put (D-16 — proven by a test asserting `sk-…` step errors land as `[REDACTED]`, T-2-04-04); `loadPendingEntries` = getAll. IndexedDB-only (R-3 panels).
- **WorkspaceStore D-06 rewire:** the direct `writeStorage` adapter is gone — `journaledUpdateWorkspace` builds an `update-workspace` entry (idempotency key = `workspaceId + version`, §20.2) and runs it through `runJournaled` with the §20.3 step order: `write-np-workspace` (idempotent versioned upsert of `pickActive(ws)`) then `emit-workspace-updated` (BroadcastBus WORKSPACE_UPDATED with `{ state, from }`). `update()`/`start()` keep their synchronous state bump and route the write through the journal. The `sanitizeStored`/ACTIVE_FIELDS/version-LWW onChanged machinery is untouched (01-06 contract preserved).
- **D-07 recovery:** `recoverWorkspaceJournal()` invoked at the end of `init()` replays pending/applying entries through the M.3 workspaceId scope gate (foreign-workspace skip with STORE_SYNC — the same gate the onChanged handler and WorkspaceSync use, WR-10) and the unknown-op skip-and-log (forward compat, never throws). Matching entries re-apply the idempotent versioned upsert (converging np_workspace to the entry's version) and are marked completed via persistJournalEntry (replay-once).
- **Tests (12):** 8 WriteJournal unit tests + 4 WorkspacePersistence integration tests, ALL importing the same `buildJournalRecoveryFixture` builder from `tests/fixtures/` (D-21 — one deterministic scenario proven at both levels). Integration proves reload hydration through the store's own journaled path, through-the-journal writes, crash-mid-write recovery (np_workspace converges 4→5), and cross-surface handoff persistence (sidepanel→standalone v2 hydrates on fresh init).
- **Full suite green:** 236/236 (was 194 baseline; +12 this plan plus other wave-3 plans' tests); typecheck, eslint, and prettier clean on all touched files.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: WriteJournal.test.ts failing tests** - `56b7a4a` (test)
2. **Task 1 GREEN: WriteJournal framework + WriteJournalDB** - `ec765ea` (feat)
3. **Task 2: WorkspaceStore D-06/D-07 journal rewire** - `89eecaa` (feat)
4. **Task 3: WorkspacePersistence integration tests** - `5a17c59` (test)

**Plan metadata:** `pending` (SUMMARY commit follows this file)

## Files Created/Modified

- `src/core/storage/WriteJournal.ts` - Created. `JournalStep`, `runJournaled`, `recoverJournal` (Appendix O.11 verbatim), `WriteJournalDBSchema`/`openWriteJournalDB` (idb v1 entries store), `persistJournalEntry` (redactSensitive-before-put, D-16), `loadPendingEntries`; every catch → debugLog with canonical WRITE_JOURNAL codes
- `src/core/workspace/WorkspaceStore.ts` - Modified. `writeStorage` deleted; `journaledUpdateWorkspace` (module-private) is the ONLY np_workspace write path; `update()`/`start()` route through it; `recoverWorkspaceJournal()` added to the shape + invoked at end of `init()`; D-06 header note
- `tests/core/storage/WriteJournal.test.ts` - Created. 8 unit tests via `buildJournalRecoveryFixture`: happy path, rollback, rollback-failure non-masking, replay-once, unknown-op skip, workspace-scoped skip, persist+load, persist redaction
- `tests/core/workspace/WorkspacePersistence.test.ts` - Created. 4 integration tests importing the SAME fixture builder (D-21): reload hydration, through-the-journal write, crash-mid-write recovery, cross-surface handoff

## Decisions Made

- **start() awaits the journal write** (not fire-and-forget): the 01-06 contract test reads storage immediately after `await start()`; preserving the await keeps that contract while `journaledUpdateWorkspace` never throws (it catches runJournaled's rethrow). `update()` remains fire-and-forget void as before.
- **Replay = idempotent upsert + complete-marker:** a replayed entry re-runs the versioned np_workspace upsert (no-op-by-key when storage already carries >= the entry version) and is then persisted as 'completed' so the next recovery pass skips it — replay-once without a separate dedupe table.
- **Scope gate in the consumer, not the framework:** recoverJournal stays the O.11 verbatim loop; the M.3 workspaceId gate and unknown-op skip are the WorkspaceStore replay's contract (unit tests prove the gate logic with gated replays, integration proves it against the real store).
- **No new ops wired (D-05):** only 'update-workspace' gained a live consumer; the other 10 WriteJournalOperation values remain declared-but-unwired (verified by grep — no other `operation:` literal in the wired paths).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Behavior preservation] start() awaits journaledUpdateWorkspace instead of fire-and-forget void**
- **Found during:** Task 2 (WorkspaceStore rewire)
- **Issue:** The plan's "call `void journaledUpdateWorkspace(bumped)` in place of `void writeStorage(bumped)`" shorthand would make `start()` resolve before the np_workspace write lands — the existing 01-06 contract test (`start(surface) sets activeSurface and writes np_workspace`) reads storage immediately after `await start()` and would race/fail
- **Fix:** Kept the existing `await` on the journaled write in `start()` (the original code awaited `writeStorage` too); `update()` stays `void`. `journaledUpdateWorkspace` never throws (catches runJournaled's rethrow → debugLog), so the await is safe
- **Files modified:** src/core/workspace/WorkspaceStore.ts
- **Verification:** `pnpm vitest run tests/core/workspace` — 30/30 green (existing WorkspaceStore contract tests pass unmodified)
- **Committed in:** `89eecaa` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 behavior preservation)
**Impact on plan:** No scope creep; the fix kept the 01-06 start() contract intact while delivering the D-06 journal routing exactly as specified.

## Issues Encountered

- **Stale LSP diagnostics** after the WriteJournal module landed: the language server reported "Cannot find module '@/core/storage/WriteJournal'" in the test file even after the module existed — a fresh `pnpm typecheck` (exit 0) and test runs proved resolution. No code impact.
- **Prettier/ESLint cleanup on Task 3 file:** the integration test needed `prettier --write` (chain reflow) and one unused-parameter fix (`waitForCompletedJournalEntry(workspaceId)` → no-arg; the entry's workspaceId is asserted via `targetIds` instead). Pure hygiene, no behavior change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **STORAGE-04 satisfied:** the journal framework (runJournaled/recoverJournal), the WriteJournalDB entries store, and the live WorkspaceStore consumer deliver crash-safe, conflict-safe np_workspace writes — the §18 "WriteJournal recovery test passes" DONE-when is met by the integration crash-mid-write case, and the "Workspace persists across reload and cross-surface handoff" DONE-when by the reload/handoff cases.
- **D-05 held:** the 11-op vocabulary is untouched; Phase 3/5 wire more consumers by adding replays, never by editing `WriteJournalOperation`.
- **Ready for 02-05+:** later plans consume `runJournaled`/`persistJournalEntry` patterns (02-09 journaled restore-batch, 02-06 ErrorStore redaction precedent), and 02-11 verify:phase-2 runs the full chain (eslint + prettier + tsc + wxt build + vitest + isolation).
- **No blockers.** Full suite 236/236 green; typecheck/eslint/prettier clean.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created/modified files verified on disk: `src/core/storage/WriteJournal.ts`, `src/core/workspace/WorkspaceStore.ts`, `tests/core/storage/WriteJournal.test.ts`, `tests/core/workspace/WorkspacePersistence.test.ts`, `02-04-SUMMARY.md`
- Commits verified in git log: `56b7a4a` (Task 1 RED), `ec765ea` (Task 1 GREEN), `89eecaa` (Task 2), `5a17c59` (Task 3)
- Plan verification: `pnpm vitest run tests/core/storage/WriteJournal.test.ts tests/core/workspace/WorkspacePersistence.test.ts` 12/12 green; `pnpm vitest run tests/core/workspace` 30/30 green; `pnpm vitest run` full suite 236/236 green; `pnpm typecheck` clean (exit 0); eslint + prettier clean on all touched files
- D-05 held: no other WriteJournal op wired (grep verified); D-07 gates proven at unit (gated replays) and integration (real store) levels

