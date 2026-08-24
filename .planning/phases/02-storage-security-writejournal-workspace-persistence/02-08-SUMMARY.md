---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 08
subsystem: workspace
tags: [writejournal, crash-recovery, cr-01, recoverWorkspaceJournal, np_workspace, sidepanel, standalone]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: WriteJournal runJournaled/recoverJournal/createWorkspaceWriteSteps, WriteJournalDB, chromeStorageAdapter, WorkspaceElection startElection(opts.getWorkspaceId) from 02-09
provides:
  - recoverWorkspaceJournal(deps) — the real boot crash-recovery path that re-applies the CURRENT stored np_workspace value (CR-01 data-loss fix) instead of reconstructing an empty placeholder from metadata-only entry fields
  - Both entrypoints (sidepanel + standalone) boot through recoverWorkspaceJournal and pass the real workspaceId getter to startElection
  - update-workspace journal steps registered at boot (fixes the never-registered defect so recovery actually replays)
  - Corrected integration tests (WriteJournal Test 1 + WorkspacePersistence Test 5) proving a metadata-only pending entry retains the original np_workspace
affects: [02-10-workspace-persistence, phase-2-verification, sidepanel-chat-demotion]

# Actuals (#2632) — pairs with the plan's `estimate` (56000). Same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 6064
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Boot crash-recovery extracts a shared, testable recoverWorkspaceJournal helper that re-applies the current stored value rather than reconstructing from metadata-only journal fields"
    - "Journal steps registered at boot (idempotent registry set) so the D-32 replay gate passes in production"

key-files:
  created: []
  modified:
    - src/core/storage/WriteJournal.ts
    - entrypoints/sidepanel/main.tsx
    - entrypoints/standalone/main.tsx
    - tests/core/storage/WriteJournal.test.ts
    - tests/core/workspace/WorkspacePersistence.test.ts

key-decisions:
  - "Recovery re-applies the CURRENT np_workspace blob verbatim (idempotent no-op re-write) instead of reconstructing from entry.workspaceId/conversationId — those fields never exist on the metadata-only WriteJournalEntry (D-33), so the prior ?? '' / ?? null fallbacks always fired and caused CR-01 data loss"
  - "recoverWorkspaceJournal registers the update-workspace steps itself at boot, fixing the defect where nothing ever registered them in production so isSupportedOperation returned false and recovery silently skipped"
  - "The replay emit payload still broadcasts ''/null (pre-existing top-level-parse limitation on the zustand-wrapped blob) — out of scope for CR-01, which is about the WRITE step, not the fire-and-forget broadcast"

patterns-established:
  - "Entrypoint boot sequences delegate journal recovery to a shared helper instead of inlining a reconstructing replay per surface"

requirements-completed: [REQ-R03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "recoverWorkspaceJournal re-applies the CURRENT np_workspace value on boot recovery for a metadata-only pending update-workspace entry, retaining the original workspaceId/conversationId (CR-01 fix), and registers update-workspace so isSupportedOperation returns true"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: "tests/core/storage/WriteJournal.test.ts#Test 1 (recovery)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sidepanel and standalone boot sequences call recoverWorkspaceJournal (re-applying current value) and pass the real workspaceId getter to startElection"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: "pnpm run lint (tsc --noEmit) green; grep gates: recoverWorkspaceJournal in each entrypoint, getWorkspaceId getter in each"
        status: pass
    human_judgment: false
  - id: D3
    description: "Integration test proves the real boot-recovery path retains a real persisted np_workspace (persist-real-ws/persist-real-conv) after replaying a metadata-only entry"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspacePersistence.test.ts#Test 5"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-08-24
status: complete
---

# Phase [2] Plan [8]: Crash-Safe Boot Recovery — recoverWorkspaceJournal (CR-01) Summary

**Extracted a shared, testable `recoverWorkspaceJournal` boot-recovery helper that re-applies the CURRENT stored np_workspace value on crash recovery (fixing the CR-01 data-loss bug where a metadata-only journal entry overwrote np_workspace with `{"workspaceId":"","conversationId":null}`), registers the update-workspace journal steps at boot, and wires both the sidepanel and standalone boot sequences through it while passing the real workspaceId getter into startElection.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-24T22:11:00Z
- **Completed:** 2026-08-24T22:16:40Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `recoverWorkspaceJournal(deps)` in `src/core/storage/WriteJournal.ts` — the real production boot-recovery path. It first registers the `update-workspace` journal steps (idempotent, fixing the "never registered in production" defect that made `isSupportedOperation('update-workspace')` return false and silently skip recovery), then replays pending/applying entries by re-applying the CURRENT `np_workspace` blob verbatim via `readCurrentWorkspace` — never reconstructing from `entry.workspaceId`/`conversationId` (which don't exist on the metadata-only `WriteJournalEntry`, D-33).
- Both `bootSidepanel` (sidepanel/main.tsx) and `bootStandalone` (standalone/main.tsx) now call `recoverWorkspaceJournal` with deps bound to `chromeStorageAdapter` + `openWriteJournalDB`, eliminating the `?? ''` / `?? null` empty-reconstruction lines from production.
- Both entrypoints pass `{ getWorkspaceId: () => useWorkspaceStore.getState().workspaceId }` into `startElection`, consuming plan 02-09's `opts.getWorkspaceId` param so production heartbeats carry the true workspaceId.
- Corrected `WriteJournal.test.ts` Test 1 and `WorkspacePersistence.test.ts` Test 5 to drive the REAL boot path (metadata-only entry + real current value) instead of hardcoding a reconstructed value, proving np_workspace retains its original value after recovery.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add recoverWorkspaceJournal + correct WriteJournal Test 1** - `323d9dd` (test, RED) + `b7447c4` (feat, GREEN)
2. **Task 2: Wire both entrypoints to recoverWorkspaceJournal + real workspaceId getter** - `983bce5` (feat)
3. **Task 3: Correct WorkspacePersistence Test 5 to drive recoverWorkspaceJournal** - `6a8350c` (test)

**Plan metadata:** (committed by orchestrator)

_Note: Task 1 and Task 3 are TDD tasks. Task 1 shipped the RED test then the GREEN helper. Task 3's corrected integration test passes because the helper shipped in Task 1 — its GREEN implementation is the helper already in place; the test proves the production path end-to-end._

## Files Created/Modified
- `src/core/storage/WriteJournal.ts` - Added `RecoverWorkspaceDeps` interface and exported `recoverWorkspaceJournal(deps)` helper (registers update-workspace steps, replays pending/applying entries re-applying the current np_workspace value). No modification to `recoverJournal`/`runJournaled`/`createWorkspaceWriteSteps`/`registerJournalSteps`/`__test__`.
- `entrypoints/sidepanel/main.tsx` - `bootSidepanel` calls `recoverWorkspaceJournal`; `startElection('sidepanel', { getWorkspaceId })`. Removed unused journal imports.
- `entrypoints/standalone/main.tsx` - `bootStandalone` calls `recoverWorkspaceJournal`; `startElection('standalone', { getWorkspaceId })`. Removed unused journal imports.
- `tests/core/storage/WriteJournal.test.ts` - Test 1 corrected to drive `recoverWorkspaceJournal` with a metadata-only entry + real current value, asserting retention + registration.
- `tests/core/workspace/WorkspacePersistence.test.ts` - Test 5 corrected to drive `recoverWorkspaceJournal` (metadata-only entry + persist-real-ws/conv), asserting retention + completion + registration.

## Decisions Made
- **Recovery re-applies the current stored value** rather than reconstructing from metadata-only entry fields. The `WriteJournalEntry` (src/types/storage.ts:63-70) carries no `workspaceId`/`conversationId`, so the prior `?? ''` / `?? null` fallbacks always fired on boot with a pending/applying entry, overwriting np_workspace with an empty placeholder — the CR-01 data-loss bug. Re-applying the verbatim current blob is idempotent (a no-op re-write when unchanged) and eliminates the corruption vector.
- **The helper registers the update-workspace steps itself** at boot (idempotent registry `set`), fixing the compounding defect that nothing registered them in production, so `isSupportedOperation('update-workspace')` returned false and recovery silently skipped.
- **The replay emit payload still broadcasts ''/null** for the zustand-wrapped `{"state":{...},"version":1}` blob (top-level parse finds no `obj.workspaceId`) — identical to the pre-existing behavior. Out of scope for CR-01 (which is about the WRITE step / persistence path, not the fire-and-forget broadcast); the plan explicitly forbids unwrapping the zustand envelope here.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The in-editor LSP "Cannot find module" / implicit-`any` diagnostics on the test files during the RED phase are spurious artifacts of `vi.resetModules()` + dynamic imports and of the not-yet-created helper; real `tsc --noEmit` (via `pnpm lint` and `verify:phase-2`) is green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CR-01 (boot recovery data loss) is resolved and proven through the real production path: `recoverWorkspaceJournal` re-applies the current np_workspace, both entrypoints use it, and the `?? ''` empty reconstruction is gone from production.
- `update-workspace` journal steps are registered at boot, so recovery actually replays (`isSupportedOperation` returns true).
- Both entrypoints pass the real workspaceId getter to `startElection`, completing the 02-09 heartbeat wiring.
- `pnpm run verify:phase-2` passes (tsc + 109 phase-2 tests). Ready for dependent plan 02-10 and phase-2 verification.

## Self-Check: PASSED
- `[ -f .planning/phases/02-storage-security-writejournal-workspace-persistence/02-08-SUMMARY.md ]` → FOUND
- Commit `323d9dd` (Task 1 RED), `b7447c4` (Task 1 GREEN), `983bce5` (Task 2), `6a8350c` (Task 3) present
- `pnpm run verify:phase-2` → 14 test files, 109 tests passed, tsc green
- Grep gates: `workspaceId ?? ''` count = 0 (entrypoints + WriteJournal.ts + both test files); `recovered-ws` count = 0 (WorkspacePersistence.test.ts)

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-24*
