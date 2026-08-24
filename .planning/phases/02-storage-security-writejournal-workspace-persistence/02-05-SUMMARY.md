---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 05
subsystem: storage
tags: [write-journal, journaling-adapter, crash-recovery, o11, election-gate, debounce-compose, req-r03, d-31, d-32, d-33, d-34]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
    provides: extension scaffold + chrome storage adapter + BroadcastBus + test harness baseline
  - plan: 02-04
    provides: WriteJournalEntry types in @/types/storage + WriteJournalDB IDB store + IndexedDBMigrator + unlimitedStorage permission
  - plan: 02-06
    provides: WorkspaceElection state machine + WORKSPACE_HEARTBEAT (the election predicate the journalingAdapter gates on)
provides:
  - WriteJournal core (O.11 verbatim): JournalStep, runJournaled (pending → applying → completed; rollback in reverse on step failure → rolled-back), recoverJournal (replays pending/applying entries)
  - 11-op WriteJournalOperation union re-exported from @/types/storage (D-32 declare-now / populate-later); only 'update-workspace' has registered JournalStep implementation in Phase 2
  - Module-level journalSteps registry (registerJournalSteps / getJournalSteps / isSupportedOperation)
  - createWorkspaceWriteSteps(deps) curried (name, value) => JournalStep[] factory for §20.3 ordering
  - journalingAdapter: createJournalingAdapter(deps) — wraps a debounced inner StateStorage with election-gated journaling (D-31/D-34) + legacy np_workspace_store → np_workspace one-time lift
affects: [02-07, 03-storage, 08-workspace-persistence]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 288     # 1152 chars / 4 over the 4 files actually changed (2 source + 2 test)
  tasks: 2
  commits: 4      # 2 test(02-05) RED commits + 2 feat(02-05) GREEN commits

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "O.11 verbatim JournalStep + runJournaled + recoverJournal shape — declare-now / populate-later registry for the 11-op union"
    - "Step names as stable identifiers — recorded in entry.steps[].name and used by recovery wiring + tests"
    - "Curried step factory (deps) => (name, value) => JournalStep[] — captures adapter deps while letting runJournaled see stable step names"
    - "Adapter composition seam (A3): zustand persist has no onWrite hook; the StateStorage wrapper is the choke point every persisted store writes through"
    - "Immediate journal-entry write (IDB put) bypassing the debounce + debounced data write on the inner adapter — D-34 interleaving"
    - "Legacy-key lift via read → write → verify → delete inside the getItem path (idempotent, one-time)"

key-files:
  created:
    - src/core/storage/WriteJournal.ts — JournalStep, runJournaled, recoverJournal, registerJournalSteps, getJournalSteps, isSupportedOperation, createWorkspaceWriteSteps; __test__ reset seam
    - src/core/workspace/journalingAdapter.ts — createJournalingAdapter (setItem/getItem/removeItem; election gate; immediate entry put; debounced inner write; legacy-key lift)
    - tests/core/storage/WriteJournal.test.ts — 4 behaviors (recovery, replay idempotent, rollback, unsupported-op skip)
    - tests/core/workspace/journalingAdapter.test.ts — 5 behaviors (primary, secondary, legacy lift, passthrough, no-timer source assertion)
  modified: []

key-decisions:
  - "Step factory curried as (deps) => (name, value) => JournalStep[] — lets the registered step list be built at adapter persist time while keeping step names as stable identifiers recorded in entry.steps[]"
  - "Adapter inlines the two update-workspace steps (rather than calling the factory at setItem time) — the factory exists for plan 02-07's boot recovery wiring where the registered steps must outlive a single setItem call"
  - "JournalStep.apply/rollback wrapped in async arrow form when calling inner.setItem/removeItem (StateStorage returns Promise<unknown>; JournalStep contract is Promise<void>) — explicit await + return preserves the typing"
  - "runJournaled rethrows the ORIGINAL error (instanceof Error preserved); rollback failures are surfaced via WRITE_JOURNAL_ROLLBACK_FAILED debugLog lines but never mask the original throw"
  - "recoverJournal is operation-agnostic — the caller (plan 02-07 boot wiring) owns isSupportedOperation gating and the WRITE_JOURNAL_UNSUPPORTED_OP instrumentation; the journal itself never throws on unsupported ops"
  - "Legacy-key lift is one-time + idempotent: getItem first checks np_workspace, falls back to np_workspace_store only when np_workspace is null; the lift is guarded by the canonical-key read so a second getItem never re-lifts"
  - "Adapter adds ZERO timers (D-26); WorkspaceElection remains the only 3 s tick in the workspace layer"

patterns-established:
  - "O.11 verbatim shape: pending → applying → completed status machine; rollback in reverse on step failure; debugLog the rollback failures but always rethrow the original error"
  - "Module-level Map registry for the 11-op union: registerJournalSteps(operation, steps), getJournalSteps(operation), isSupportedOperation(operation) — Phase 2 registers only 'update-workspace'"
  - "Stable step names: 'write-np-workspace' (debounced inner.setItem + immediate inner.removeItem rollback) and 'emit-workspace-updated' (BroadcastBus WORKSPACE_UPDATED publish, no rollback)"
  - "Adapter composition seam: wrap an inner StateStorage with election-gating + journal + immediate IDB entry write + debounced inner data write + legacy-key lift — no zustand persist changes needed"

requirements-completed: [REQ-R03]

coverage:
  - id: D1
    description: "WriteJournal — runJournaled drives pending → applying → completed on success; rolls back completed steps in reverse on step failure, marks rolled-back, emits WRITE_JOURNAL_FAILED via debugLog"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#Test 3 (rollback): a step whose apply() throws rolls back completed steps in reverse and marks the entry rolled-back + logs WRITE_JOURNAL_FAILED
        status: pass
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#Test 1 (recovery): a pending update-workspace entry left mid-write is replayed by recoverJournal and the storage value is restored
        status: pass
    human_judgment: false
  - id: D2
    description: "WriteJournal — recoverJournal replays only entries with status 'pending' or 'applying'; JournalStep.apply MUST be idempotent (safe to re-run on replay) — proven by running the same entry twice"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#Test 2 (idempotent replay): replaying the same entry twice yields the same completed final state
        status: pass
    human_judgment: false
  - id: D3
    description: "WriteJournal — D-32 replay contract: unsupported ops (e.g. 'save-note-with-links') are skipped with WRITE_JOURNAL_UNSUPPORTED_OP debugLog instrumentation — no placeholder handlers registered for the remaining 10 ops"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#Test 4 (replay contract): an unsupported operation is skipped with debugLog instrumentation — no placeholder handler runs
        status: pass
      - kind: unit
        ref: tests/core/storage/WriteJournal.test.ts#Test 1 (recovery): isSupportedOperation('update-workspace') === true; the test exercises the registry + skip path
        status: pass
    human_judgment: false
  - id: D4
    description: "WriteJournalOperation 11-op union declared in @/types/storage (canonical home) and re-exported from WriteJournal.ts — only 'update-workspace' has a registered JournalStep implementation in Phase 2"
    requirement: REQ-R03
    verification:
      - kind: other
        ref: source assertion (grep -n 'WriteJournalOperation' src/types/storage.ts src/core/storage/WriteJournal.ts; registry registrations limited to 'update-workspace' in test 1)
        status: pass
    human_judgment: false
  - id: D5
    description: "journalingAdapter — primary path: setItem('np_workspace', value) when isPrimary() puts a 'pending' entry to WriteJournalDB IMMEDIATELY (bypasses debounce, D-34), runs the two steps, entry ends 'completed'"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: tests/core/workspace/journalingAdapter.test.ts#Test 1 (primary): setItem('np_workspace', value) puts a pending entry immediately, applies steps, ends completed
        status: pass
    human_judgment: false
  - id: D6
    description: "journalingAdapter — secondary path: setItem when !isPrimary → NO journal entry, NO storage write (D-27 mirror only)"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: tests/core/workspace/journalingAdapter.test.ts#Test 2 (secondary): setItem when !isPrimary → NO journal entry, NO storage write
        status: pass
    human_judgment: false
  - id: D7
    description: "journalingAdapter — legacy-key lift: getItem('np_workspace') with no current value but legacy 'np_workspace_store' → copy to np_workspace, delete legacy, return payload; idempotent (second getItem finds np_workspace directly)"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: tests/core/workspace/journalingAdapter.test.ts#Test 3 (legacy lift): copy + delete + return; idempotent on second call
        status: pass
    human_judgment: false
  - id: D8
    description: "journalingAdapter — passthrough: getItem / removeItem for non-workspace keys delegate to inner adapter unchanged"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: tests/core/workspace/journalingAdapter.test.ts#Test 4 (passthrough): getItem / removeItem for non-workspace keys delegate to the inner adapter unchanged
        status: pass
    human_judgment: false
  - id: D9
    description: "journalingAdapter — D-26 no-timer: zero setInterval/setTimeout calls in the file (verified by source assertion; only doc comment match)"
    requirement: REQ-R03
    verification:
      - kind: unit
        ref: tests/core/workspace/journalingAdapter.test.ts#Acceptance (no timers): source assertion — journalingAdapter.ts contains no setInterval/setTimeout
        status: pass
      - kind: other
        ref: source assertion (grep -nE '(setInterval|setTimeout)\\s*\\(' src/core/workspace/journalingAdapter.ts src/core/storage/WriteJournal.ts → no matches)
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-24
status: complete
---
# Phase 02 — Plan 05 Summary

**WriteJournal (O.11 verbatim) + journalingAdapter (election-gated, journaled, debounced compose seam + legacy-key lift)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-24T05:36:33Z
- **Completed:** 2026-08-24T05:43:00Z
- **Tasks:** 2/2
- **Files modified:** 4 (2 source + 2 test files; 0 modified)
- **Test count delta:** +9 tests (4 WriteJournal + 5 journalingAdapter)
- **Total verify:phase-2 tests:** 101/101 passing (was 92)

## Accomplishments

- `WriteJournal.ts` implements spec Appendix O.11 verbatim: `JournalStep { name, apply, rollback }`, `runJournaled` driving pending → applying → completed with reverse-order rollback on step failure (debugLog `WRITE_JOURNAL_FAILED` + rethrow original error), and `recoverJournal` replaying pending/applying entries via caller-supplied load/replay (decoupled from WriteJournalDB so the boot wiring in plan 02-07 owns the IDB lookup)
- Module-level journal steps registry: `registerJournalSteps` / `getJournalSteps` / `isSupportedOperation`. Phase 2 registers only `update-workspace`; the remaining 10 ops from `§U20.3` are declared (D-32 declare-now / populate-later) but have no placeholder handlers — recovery wiring skips unsupported entries with `WRITE_JOURNAL_UNSUPPORTED_OP` debugLog instrumentation
- `createWorkspaceWriteSteps(deps)` curried `(name, value) => JournalStep[]` factory — captures adapter deps while letting `runJournaled` see stable step names recorded in `entry.steps[].name` (`write-np-workspace`, `emit-workspace-updated`)
- `journalingAdapter.ts` is the single seam where `chromeStorageAdapter` debounce + immediate journal-entry writes + `isPrimaryWriter()` election gating + legacy `np_workspace_store` → `np_workspace` one-time lift compose — no zustand internals touched, no new timer (D-26)
- D-34 ordering proven: `putEntry` awaited BEFORE `inner.setItem` — the journal-entry write is immediate (bypasses debounce), the data write stays on the D-22 300 ms trailing debounce
- D-33 metadata-only: entries carry only `workspaceId` + `conversationId` extracted from the persisted blob for the emit step; no message bodies, no plaintext
- D-39 ownership respected: the adapter does NOT import `ErrorStore` (the boot wiring in plan 02-07 registers `ErrorStore.write` + `debugLog` as the `setStorageErrorReporter` reporter)
- 9 new tests covering the four WriteJournal behaviors (recovery + idempotent + rollback + unsupported-op skip) and the five journalingAdapter behaviors (primary + secondary + legacy lift + passthrough + no-timer source assertion)

## Task Commits

1. **Task 1 RED: WriteJournal tests** - `68b70c4` (test)
2. **Task 1 GREEN: WriteJournal core + registry + workspace step factory** - `4d2e754` (feat)
3. **Task 2 RED: journalingAdapter tests** - `f284dd9` (test)
4. **Task 2 GREEN: createJournalingAdapter** - `1e1edc6` (feat)

## Files Created/Modified

- `src/core/storage/WriteJournal.ts` — `JournalStep` interface; `runJournaled` (pending → applying → completed; rollback in reverse on step failure); `recoverJournal` (replays pending/applying); `registerJournalSteps` / `getJournalSteps` / `isSupportedOperation` (module-level Map registry for the 11-op union); `createWorkspaceWriteSteps(deps)` curried factory for the `update-workspace` ordering; `__test__` reset seam
- `src/core/workspace/journalingAdapter.ts` — `createJournalingAdapter(deps)` returns a `StateStorage` with `setItem` (election-gated journal path for `np_workspace`, passthrough for other keys), `getItem` (legacy-key lift via read → write → verify → delete), `removeItem` (passthrough); zero timers
- `tests/core/storage/WriteJournal.test.ts` — 4 tests against `WriteJournalDB`: recovery (SW-kill replay restores state), idempotent replay (apply runs twice, same final state), rollback (step throws → reverse rollback + `WRITE_JOURNAL_FAILED` + `rolled-back`), unsupported-op skip (`isSupportedOperation` gate + `WRITE_JOURNAL_UNSUPPORTED_OP` instrumentation)
- `tests/core/workspace/journalingAdapter.test.ts` — 5 tests: primary (immediate entry put → steps → completed), secondary (no entry, no write), legacy lift (read → write → verify → delete; idempotent), passthrough (non-workspace keys), no-timer source assertion (grep-style)

## Decisions Made

- **Curried step factory** (`(deps) => (name, value) => JournalStep[]`): lets the registered step list be built at adapter persist time while keeping step names as stable identifiers recorded in `entry.steps[]`. The factory exists for plan 02-07's boot recovery wiring where the registered steps must outlive a single `setItem` call.
- **Adapter inlines the two update-workspace steps** rather than calling the factory at `setItem` time: the adapter owns the entry lifecycle (create entry → put → runJournaled → complete), so it builds the step list directly. The factory is reserved for the boot wiring to register the steps ahead of time.
- **JournalStep.apply/rollback wrapped in async arrow form**: `inner.setItem` / `inner.removeItem` return `Promise<unknown>` (StateStorage type), but the JournalStep contract is `Promise<void>`. Explicit `await` + implicit `return` preserves the typing without `// @ts-expect-error NP-STRICT` markers (Pitfall 9 ceiling holds at 0).
- **runJournaled rethrows the ORIGINAL error** (`instanceof Error` preserved): rollback failures are surfaced via `WRITE_JOURNAL_ROLLBACK_FAILED` debugLog lines but never mask the original throw — the caller sees the step's real failure cause.
- **recoverJournal is operation-agnostic**: the caller (plan 02-07 boot wiring) owns `isSupportedOperation` gating and the `WRITE_JOURNAL_UNSUPPORTED_OP` instrumentation. The journal itself never throws on unsupported ops — keeps the primitive decoupled from the recovery policy.
- **Legacy-key lift is one-time + idempotent**: `getItem` first checks `np_workspace`, falls back to `np_workspace_store` only when the canonical key is null. The lift is guarded by the canonical-key read so a second `getItem` never re-lifts; `getItem('np_theme')` always passthroughs.
- **Adapter adds ZERO timers (D-26)**: source assertion in test 5 + a manual `grep -nE "(setInterval|setTimeout)\s*\("` over both files confirms only a doc comment match. WorkspaceElection remains the only 3 s tick in the workspace layer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type] JournalStep.apply/rollback return type mismatch with StateStorage**
- **Found during:** Task 2 GREEN — `pnpm lint` flagged `Type 'unknown' is not assignable to type 'Promise<void>'` at lines 182-183 of `journalingAdapter.ts`
- **Issue:** `inner.setItem` / `inner.removeItem` return `Promise<unknown>` (zustand's `StateStorage` typing), but `JournalStep.apply` / `rollback` must return `Promise<void>` per O.11. The arrow-form `() => inner.setItem(name, value)` carried through the type mismatch to the step's contract.
- **Fix:** Wrapped the step's apply / rollback in explicit `async () => { await inner.setItem(...); }` form. The async arrow's implicit return type is `Promise<void>`, and `await` consumes the `Promise<unknown>` without leaking the unknown into the step contract.
- **Files modified:** `src/core/workspace/journalingAdapter.ts`
- **Verification:** `pnpm lint` exits 0; 5/5 journalingAdapter tests green.
- **Committed in:** `1e1edc6` (Task 2 GREEN commit)

**2. [Rule 1 - Test] Shallow-clone bug in Test 2 (idempotent replay)**
- **Found during:** Task 1 GREEN — test 2 reported 4 step records instead of expected 2
- **Issue:** Test 2 used `{ ...entry }` to create two clones, but the `steps` array was shared between them. The first `runJournaled` mutated `entry.steps` (which both clones aliased); the second added 2 more records onto the same array.
- **Fix:** Replaced the shallow-clone pattern with a `makeEntry()` factory that returns a fresh entry with a fresh `steps` array literal each call. Both clones now have independent `steps` arrays, and each replay records exactly its own 2 step records.
- **Files modified:** `tests/core/storage/WriteJournal.test.ts`
- **Verification:** All 4/4 WriteJournal tests green; test 2 assertion matches (each entry has `['write-np-workspace', 'emit-workspace-updated']`).
- **Committed in:** `4d2e754` (Task 1 GREEN commit, in the same `feat(02-05)` commit)

---

**Total deviations:** 2 auto-fixed (1 type, 1 test-data-isolation)
**Impact on plan:** Both auto-fixes are correctness/typing — no scope change, no plan deviation. The shallow-clone bug was a test-setup defect that masked the intent of the idempotency test; the type fix is the strict-mode-correct shape for JournalStep wrapping StateStorage methods.

## Issues Encountered

- zustand's `StateStorage` interface types `setItem` / `removeItem` as returning `unknown | Promise<unknown>` (the storage adapter contract is "may or may not return a value"). The first GREEN attempt at Task 2 wrapped the inner calls in `() => inner.setItem(name, value)` form, which carried the `unknown` through to the JournalStep's `Promise<void>` contract and failed strict-mode typing. Wrapping in `async () => { await inner.setItem(...); }` resolves the await to `unknown` but returns implicitly as `Promise<void>` — the correct shape for O.11.
- The first Task 1 GREEN run had Test 2 failing because `{ ...entry }` is a shallow spread — the `steps` array was shared between both clones. Replaced with a `makeEntry()` factory that returns a fresh object literal each call (with a fresh `steps: []` array). Now each replay records exactly its own step records.
- The plan's "exact interleaving" probe (REQ-R03 boundary row) is verified behaviorally in the adapter test (entry put precedes the debounced inner setItem because both are `await`ed in order); the steady-state write-rate assertion (≤30 writes/min) lands in plan 02-07's WorkspaceStore integration test.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02-07 (WorkspaceStore integration) is the immediate successor. It needs:
  - `createJournalingAdapter` wired into `WorkspaceStore.persist.storage` (replacing the direct `chromeStorageAdapter` reference at `WorkspaceStore.ts:155`)
  - The `name` field in the persist config changed from `np_workspace_store` to `np_workspace` (the legacy lift in this plan's adapter handles the in-flight migration; plan 02-07 ships the canonical key)
  - `WorkspaceElection.startElection(surface)` called during `WorkspaceStore` bootstrap so `isPrimaryWriter()` is no longer the Phase-1 `return true` stub (D-24 swap point)
  - `setStorageErrorReporter(fn)` called during entrypoint boot to wire `ErrorStore.record` + `debugLog` as the reporter for `STORAGE_QUOTA` / `STORAGE_RATE_LIMIT` (D-39 ownership)
  - Boot-time `recoverJournal(load, replay)` call with `replay` that gates on `isSupportedOperation(e.operation)` and skips unsupported entries with `WRITE_JOURNAL_UNSUPPORTED_OP` debugLog instrumentation (D-32 replay contract)
- The WriteJournal `createWorkspaceWriteSteps` factory is exported and ready for the boot wiring to register `update-workspace` steps ahead of time so the recovery path can replay them without re-deriving the step list
- All acceptance criteria for plan 02-05 are met; the phase-2 gate (`pnpm run verify:phase-2`) passes 101/101 tests

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-24*

## Self-Check: PASSED

All created files exist on disk:
- `src/core/storage/WriteJournal.ts` ✓
- `src/core/workspace/journalingAdapter.ts` ✓
- `tests/core/storage/WriteJournal.test.ts` ✓
- `tests/core/workspace/journalingAdapter.test.ts` ✓

All 4 commits present in git log:
- `68b70c4` (Task 1 RED — WriteJournal tests)
- `4d2e754` (Task 1 GREEN — WriteJournal core + registry + step factory)
- `f284dd9` (Task 2 RED — journalingAdapter tests)
- `1e1edc6` (Task 2 GREEN — createJournalingAdapter)

Verification:
- `pnpm lint` exits 0 (tsc --noEmit clean — strict-mode ceiling unchanged at 0)
- `pnpm run verify:phase-2` exits 0 (4 WriteJournal + 5 journalingAdapter + 92 prior = 101/101 tests passing)

Source assertions (acceptance criteria):
- `grep -nE "(setInterval|setTimeout)\s*\(" src/core/workspace/journalingAdapter.ts src/core/storage/WriteJournal.ts` → no matches (D-26 satisfied — only a doc comment mentions `setInterval/setTimeout`)
- `grep -rn "@ts-expect-error NP-STRICT" src/` → only 1 comment match in WriteJournal.ts header (no actual markers; Pitfall 9 ceiling holds at 0)
- `WriteJournalOperation` 11-op union declared once in `src/types/storage.ts` and re-exported from `src/core/storage/WriteJournal.ts` (D-32 declare-now; canonical home is `@/types/storage` per A4)