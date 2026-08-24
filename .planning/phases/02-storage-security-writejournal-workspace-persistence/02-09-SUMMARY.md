---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 09
subsystem: workspace
tags: [workspace-election, heartbeat, broadcastchannel, cr-02, sidepanel, standalone]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: WorkspaceElection state machine (D-24..D-27), WorkspaceSync notifyWorkspaceHeartbeat, BroadcastBus self-suppression, chrome.storage.session mock
provides:
  - runHeartbeatTick now publishes WORKSPACE_HEARTBEAT for primary/solo surfaces via notifyWorkspaceHeartbeat (CR-02 fix)
  - startElection(surface, opts?: { getWorkspaceId }) optional getter threaded into the heartbeat tick
  - Production-tick two-surface regression test proving Sidepanel primary → Standalone wins → Sidepanel demotes to secondary via the real heartbeat
affects: [02-10-workspace-persistence, sidepanel-chat-demotion, phase-2-verification]

# Actuals (#2632) — pairs with the plan's `estimate` (44000). Same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 1520
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-surface MV3 multi-context modeling via separate module instances (vi.resetModules() + dynamic imports), each with its own activeInstance and BroadcastBus instanceId"
    - "Distinct-identity BroadcastBus observer to prove a self-suppressed publish reached another context"

key-files:
  created: []
  modified:
    - src/core/workspace/WorkspaceElection.ts
    - tests/core/workspace/WorkspaceElection.test.ts

key-decisions:
  - "Heartbeat publish is additive to the tick: for primary/solo states only, after the session record is refreshed; election-in-progress emits no heartbeat (D-26 intent preserved)"
  - "Distinct surface contexts are modeled by separate module copies (each with its own instanceId), matching real MV3 delivery — BroadcastBus.ts is NOT modified"

patterns-established:
  - "Cross-surface heartbeat delivery proven through the real production tick (notifyWorkspaceHeartbeat), never a hand-rolled publish with a forged _sender"
  - "TDD proving test for a shipped fix: the two-surface demotion test asserts the CR-02-dependent behavior end-to-end through the production tick"

requirements-completed: [REQ-R03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "runHeartbeatTick publishes WORKSPACE_HEARTBEAT for primary/solo surfaces via notifyWorkspaceHeartbeat (CR-02) with optional getWorkspaceId threaded through startElection"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceElection.test.ts#Test 2 (heartbeat)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two-surface demotion — Sidepanel primary, Standalone starts later, Standalone wins, Sidepanel demotes to secondary — driven by the real production heartbeat tick with two coexisting module instances and zero manual _sender injection"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceElection.test.ts#Test 5 (two-surface demotion)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-24
status: complete
---

# Phase [2] Plan [9]: Publish Election Heartbeat + Prove Two-Surface Handoff Summary

**runHeartbeatTick now broadcasts WORKSPACE_HEARTBEAT (CR-02) for primary/solo surfaces via notifyWorkspaceHeartbeat, with a startElection getWorkspaceId getter, proven end-to-end by a production-tick two-surface test (Sidepanel primary → Standalone wins → Sidepanel demotes) using two coexisting module instances.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-24T12:06:20Z
- **Completed:** 2026-08-24T12:07:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `runHeartbeatTick` publishes a `WORKSPACE_HEARTBEAT` carrying `surface` + `workspaceId` for primary/solo surfaces (previously zero call sites — the CR-02 BLOCKER). The election-demotion rule and lone-surface 'solo' detection are now live in production.
- `startElection(surface, opts?: { getWorkspaceId })` accepts an optional workspaceId getter threaded into the tick (default `() => ''`); the opts param is additive, so `startElection('sidepanel')` unchanged.
- Strengthened Test 2 proves the publish through a distinct-identity BroadcastBus observer module copy (asserts the WORKSPACE_HEARTBEAT payload), not just the `electedAt` record advance.
- Replaced the manual-injection Test 5 with a production-tick two-surface regression test: two separate WorkspaceElection module instances (`vi.resetModules()` + dynamic imports) model real MV3 multi-context delivery — sidepanel starts primary, standalone starts within the 3 s CAS window and wins the tie-break, then sidepanel demotes to secondary via the real production heartbeat.

## Task Commits

Each task was committed atomically:

1. **Task 1: Publish WORKSPACE_HEARTBEAT from runHeartbeatTick + strengthen Test 2** - `c9d352f` (feat)
2. **Task 2: Two-surface demotion via production heartbeat tick** - `428849a` (test)

**Plan metadata:** (committed by orchestrator)

_Note: Task 2 is a TDD task whose GREEN implementation (the tick publish) shipped in Task 1; the written test proves the production path end-to-end and passes because of Task 1's fix._

## Files Created/Modified
- `src/core/workspace/WorkspaceElection.ts` - Imports `notifyWorkspaceHeartbeat`; `startElection` gains optional `opts.getWorkspaceId`; `runHeartbeatTick` takes `getWorkspaceId` and publishes the heartbeat for primary/solo states after the record refresh.
- `tests/core/workspace/WorkspaceElection.test.ts` - Test 2 asserts the publish via a distinct-identity BroadcastBus observer; Test 5 replaced with the production-tick two-module-instance demotion test.

## Decisions Made
- Heartbeat publish is additive to the tick and fires for `primary`/`solo` only (after the session record write); `election-in-progress` still refreshes the record but emits no heartbeat, matching the documented D-26 intent.
- Distinct surface contexts are modeled by separate module instances (each with its own `activeInstance` and BroadcastBus `instanceId`), matching real MV3 multi-context delivery — no change to `src/core/runtime/BroadcastBus.ts`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. The LSP "Cannot find module" diagnostics on the test file are spurious in-editor artifacts of `vi.resetModules()` + dynamic imports; real `tsc --noEmit` (via `pnpm lint` and `verify:phase-2`) is green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CR-02 (election heartbeat never published) is resolved and proven through the production tick; the election-demotion mirror path in SidepanelChat and the standalone-wins tie-break are now live in production.
- Ready for dependent plan 02-08 (entrypoints thread the real workspaceId getter into `startElection`), and for phase-2 verification.

## Self-Check: PASSED
- `[ -f .planning/phases/02-storage-security-writejournal-workspace-persistence/02-09-SUMMARY.md ]` → FOUND
- Commit `c9d352f` (Task 1) present; Commit `428849a` (Task 2) present
- `pnpm run verify:phase-2` → 14 test files, 109 tests passed, tsc green
- Grep gates: `foreign-instance-id` count = 0; `notifyWorkspaceHeartbeat` guarded call present at WorkspaceElection.ts:284

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-24*
