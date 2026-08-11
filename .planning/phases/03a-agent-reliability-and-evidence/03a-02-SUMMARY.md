---
phase: 03a-agent-reliability-and-evidence
plan: 02
subsystem: ai
tags: [agent-reliability, outcome-verifier, completion-evidence, checkpoint, rollback, deterministic]

# Dependency graph
requires:
  - phase: 03a-agent-reliability-and-evidence (03a-01)
    provides: C.1 harness types (CompletionEvidence, AgentTurnOutcome), tests/fixtures/trajectory.ts (MOCK_DANGEROUS_TOOL/VERIFIER), ToolExecutionResult in src/core/ai/types.ts
provides:
  - src/core/ai/OutcomeVerifier.ts — O.2 VERBATIM Verifier interface + buildOutcome (L6362-6393) + injectable clock: the deterministic evidence machinery where tool results become CompletionEvidence and a terminal AgentTurnOutcome status
  - src/core/ai/CheckpointRecorder.ts — D-3a-08/09 opId-keyed pre-tool loop-state store (LoopState {toolResults, plannerCalls, toolCalls, phase}), structuredClone on capture and restore
  - tests/core/ai/OutcomeVerifier.test.ts — 12 tests proving evidence-gated completion, fail-closed verdicts, cap=partial (never completed), read-only skip, clock determinism
  - tests/core/ai/trajectory/CheckpointRecorder.test.ts — 9 tests proving round-trip, deep-copy isolation, opId key isolation, uncaptured-opId undefined
affects: [03a-03 AgentOrchestrator rewire (sole buildOutcome caller + checkpoint capture/restore seam), 03a-04 hook mapping, 03a-05, Phase 8 TOL-05 idempotency]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies — pure in-repo TypeScript on the approved stack
  patterns:
    - "O.2-verbatim deterministic evidence production: buildOutcome copied, not re-derived (D-3a-03); only deviation = injectable now clock (Pitfall 6), default Date.now preserves production behavior"
    - "structuredClone for checkpoint snapshots (capture AND restore) — callers can never mutate stored loop-state (T-03a-02-03)"
    - "Evidence-gating: read-only tools with no verifier registered are skipped (if (!v) continue) — pure-answer turns are completed with evidence: [] (D-3a-04)"

key-files:
  created:
    - src/core/ai/OutcomeVerifier.ts
    - src/core/ai/CheckpointRecorder.ts
    - tests/core/ai/OutcomeVerifier.test.ts
    - tests/core/ai/trajectory/CheckpointRecorder.test.ts
  modified: []

key-decisions:
  - "buildOutcome is Appendix O.2 VERBATIM (L6362-6393) with ONE documented deviation: `now: () => number = Date.now` injectable clock for verifiedAt (Pitfall 6 determinism; production default unchanged) — flagged_assumptions 03a-02"
  - "Cap exhaustion => status 'partial' + reasonCode 'cap_exhausted' regardless of side-effect failure — capHit wins the ternary (O.2 L6387-6391, D-3a-07, AGT-03)"
  - "Absent/!ok evidence for a side-effecting tool => 'failed' + 'postcondition_failed' (fail-closed, D-3a-06) — the O.2 reasonCode string is kept verbatim (Open Q1 resolution)"
  - "CheckpointRecorder uses structuredClone on BOTH capture and restore — 'no shared references' (truth 4) plus the deep-copied-restore contract (task 2 literal); in-memory per-turn only (C4, §17.7.7)"
  - "LoopState.phase is typed `string` per the plan literal — the orchestrator (03a-03) feeds the C.1 AgentTrajectoryPhase value; CheckpointRecorder stays agnostic (one file per responsibility, D-3a-08)"

patterns-established:
  - "Deterministic evidence tests: every buildOutcome call injects fixedNow() = FIXED_VERIFIED_AT (1000) — the Date.now default path is exercised ONCE via a range assertion, never as an equality"
  - "Verifier fixture reuse: MOCK_DANGEROUS_VERIFIER (03a-01) keys buildOutcome's verifiers Record by MOCK_DANGEROUS_TOOL.name — the fixture the ExecutorService toolName boundary feeds (O.2 L6380)"

requirements-completed: [AGT-02, AGT-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "src/core/ai/OutcomeVerifier.ts — O.2 verbatim Verifier + buildOutcome with injectable clock; deterministic (zero LLM calls, no verifier PipelineStage, no tier cap, no persona injection)"
    requirement: AGT-02
    verification:
      - kind: unit
        ref: "tests/core/ai/OutcomeVerifier.test.ts (12 tests: pure-answer, verified success, fail-closed, cap=partial, read-only skip, clock injection)"
        status: pass
      - kind: other
        ref: "grep: 'buildOutcome' present; 0 matches of streamText|generateText|model in src/core/ai/OutcomeVerifier.ts (determinism gate, D-3a-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/core/ai/CheckpointRecorder.ts — opId-keyed pre-tool LoopState capture/restore, structuredClone snapshots, in-memory per-turn (no durable persistence, no side-effect compensation)"
    requirement: AGT-02
    verification:
      - kind: unit
        ref: "tests/core/ai/trajectory/CheckpointRecorder.test.ts (9 tests: round-trip, deep-copy isolation, opId key isolation, uncaptured undefined)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AGT-03 honest cap semantics proven at the module boundary: caps.capHit => status 'partial' + reasonCode 'cap_exhausted', never 'completed' — including when a side effect also failed"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/OutcomeVerifier.test.ts#buildOutcome — cap exhaustion (D-3a-07, AGT-03) (2 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-11
status: complete
---

# Phase 03a Plan 02: Deterministic OutcomeVerifier + CheckpointRecorder Summary

**O.2-verbatim buildOutcome with an injectable clock (evidence-gated completion, fail-closed verdicts, cap exhaustion = partial never completed) plus the opId-keyed CheckpointRecorder loop-state rollback — both proven by 21 deterministic unit tests.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-11T21:42:45Z
- **Completed:** 2026-08-11T21:50:53Z
- **Tasks:** 5
- **Files modified:** 4 (all created; OutcomeVerifier.ts reworded in Task 5's grep gate — comment-only)

## Accomplishments

- `src/core/ai/OutcomeVerifier.ts` (new): the O.2 `Verifier` interface + `buildOutcome(operationId, results, verifiers, caps, now = Date.now)` copied verbatim from Appendix O.2 L6362-6393 (D-3a-03 — never re-derived). Deterministic: zero LLM calls, no verifier PipelineStage, no extra tier cap, no persona injection — the healthy-turn 2-call cost truth holds. Read-only tools with no registered verifier are skipped (`if (!v) continue`), so a pure-answer turn is `completed` with `evidence: []` (D-3a-04). Cap exhaustion maps to `status 'partial'` + `reasonCode 'cap_exhausted'` (D-3a-07, AGT-03) — `capHit` wins even when a side effect also failed. Any `!ok` evidence forces `status 'failed'` + `reasonCode 'postcondition_failed'` (fail-closed, D-3a-06, R-8). The ONLY deviation from O.2's verbatim body is the injectable `now` clock for `verifiedAt` (Pitfall 6, flagged_assumptions); the production default is `Date.now`. Imports `CompletionEvidence`/`AgentTurnOutcome` from `@/types/harness` (R-1 — never re-declares) and `ToolExecutionResult` from `./types`.
- `src/core/ai/CheckpointRecorder.ts` (new): D-3a-08/09 — an opId-keyed pre-tool loop-state store. `LoopState = { toolResults, plannerCalls, toolCalls, phase }`. `capture(operationId, state)` / `restore(operationId)` over a Map; **both** paths structuredClone (truth 4 "no shared references" + the deep-copied-restore contract), so callers can never mutate stored snapshots (T-03a-02-03). `restore` of a never-captured opId returns `undefined`. In-memory per-turn only (C4, §17.7.7) — no durable persistence; rollback is loop-state rewind only, no side-effect compensation (Phase 8 TOL-05, explicitly out of scope).
- `tests/core/ai/OutcomeVerifier.test.ts` (new, 12 tests): (a) pure-answer turn → `completed` + `evidence: []` + `reasonCode 'ok'`; (b) side-effecting tool with `ok:true` verifier → `completed` with the full evidence entry (postconditionId `mock-dangerous.verified`, `ok:true`, `verifiedAt` from injected clock); (c) `!ok` verdict → `failed` + `postcondition_failed` (single failure fails the turn even with a sibling ok); (d) `caps.capHit:true` → `partial` + `cap_exhausted` with zero side effects AND with a failing side effect (never `completed`/`failed`); (e) read-only tool with no verifier keyed → skipped, no evidence (alone and mixed with a side-effecting tool); (f) fixed injected clock → `verifiedAt` equals `FIXED_VERIFIED_AT` (1000), plus one range-assertion exercise of the production `Date.now` default.
- `tests/core/ai/trajectory/CheckpointRecorder.test.ts` (new, 9 tests): capture/restore round-trip preserves all four LoopState fields; capture stores a copy (post-capture mutation of the caller object is isolated); restore returns a deep copy — mutating restored top-level fields, pushing to restored `toolResults`, AND mutating a nested `toolResult` (ok/output/error) never leaks into stored state; fresh object per call (no aliasing); uncaptured opId → `undefined`; op-A capture never affects op-B; re-capture overwrites.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/core/ai/OutcomeVerifier.ts** - `86ba720` (feat)
2. **Task 2: Create src/core/ai/CheckpointRecorder.ts** - `a2731be` (feat)
3. **Task 3: Create tests/core/ai/OutcomeVerifier.test.ts** - `198c87d` (test)
4. **Task 4: Create tests/core/ai/trajectory/CheckpointRecorder.test.ts** - `216cd24` (test)
5. **Task 5: Verify green** — `f85f7f8` (docs — OutcomeVerifier header reworded to satisfy the determinism grep gate); grep asserts + tsc + full regression verified within the task commits

**Plan metadata:** pending (docs: complete plan — final commit)

## Files Created/Modified

- `src/core/ai/OutcomeVerifier.ts` (new) - O.2 verbatim Verifier + buildOutcome with injectable `now` clock; deterministic (zero model-call tokens)
- `src/core/ai/CheckpointRecorder.ts` (new) - LoopState + CheckpointRecorder (opId Map, structuredClone capture/restore, in-memory per-turn)
- `tests/core/ai/OutcomeVerifier.test.ts` (new) - 12 tests: evidence gate / fail-closed / cap=partial / read-only skip / clock determinism
- `tests/core/ai/trajectory/CheckpointRecorder.test.ts` (new) - 9 tests: round-trip / deep-copy / key isolation / uncaptured undefined

## Decisions Made

- **O.2 verbatim, one documented deviation:** buildOutcome is copied from Appendix O.2 L6362-6393 with `now: () => number = Date.now` as the only change (Pitfall 6 determinism; production behavior preserved). The plan's flagged_assumptions calls this out explicitly.
- **`capHit` wins the status ternary:** cap exhaustion is `partial`/`cap_exhausted` even when a side-effecting tool's evidence is also `!ok` — the O.2 ternary order (`caps.capHit ? 'partial' : sideEffectFailed ? 'failed' : 'completed'`) is preserved verbatim (AGT-03).
- **`postcondition_failed` kept as the reasonCode string:** Open Q1 resolution — the D-3a-06 prose vocabulary names it `verification_failed`, but the OUTCOME reasonCode is the O.2 value `postcondition_failed` (kept verbatim; the orchestrator 03a-03 owns the `verification_failed → status 'failed'` mapping).
- **structuredClone on capture AND restore:** the plan's truth 4 ("no shared references") plus task 2's deep-copied-restore literal are both satisfied by cloning at both boundaries — stronger than the research sketch's shallow `{ ...state }` copies.
- **`LoopState.phase: string`:** typed per the plan literal (not `AgentTrajectoryPhase`) — the recorder is a dumb opId store; the orchestrator supplies the C.1 value and owns transition validation via `transitionPhase` (03a-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Determinism grep gate tripped on the module's own header comment**
- **Found during:** Task 5 (Verify green — grep-assert `OutcomeVerifier.ts` contains `buildOutcome` and no `streamText`/`generateText`/`model` tokens)
- **Issue:** The header comment documenting D-3a-03 self-referenced the forbidden tokens ("zero model calls", "no streamText/generateText") — the plan's own grep gate regex matched the comment text, failing the determinism assertion.
- **Fix:** Reworded the D-3a-03 header comment to describe the invariant without the forbidden tokens ("ZERO LLM calls — no SDK call-construction tokens..."). Comment-only change; zero behavior delta.
- **Files modified:** src/core/ai/OutcomeVerifier.ts
- **Verification:** grep `streamText|generateText|model` = 0 matches; `buildOutcome` = 3 matches; tsc green; 21 new tests + 212-test regression re-run green
- **Committed in:** f85f7f8 (Task 5 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking — the plan's own verification gate)
**Impact on plan:** Minimal — a comment-only reword required to satisfy the plan's literal grep assertion; no code behavior changed. No scope creep.

## Issues Encountered

- None. The single grep-gate trip above is a verification-gate compliance issue, not a runtime or design problem; all 21 new tests passed first run and tsc was green throughout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 03a-03 (AgentOrchestrator rewire):** `buildOutcome` is the single, spec-verbatim place the orchestrator's `finish()` calls to produce the terminal `AgentTurnOutcome`; `CheckpointRecorder` is the one-step rollback seam (`capture` before `ExecutorService.execute`, `restore` on retryable tool failure) the rewire rewires around (D-3a-09/11). The `LoopState.phase` field accepts the C.1 `AgentTrajectoryPhase` the orchestrator's transitions emit.
- **Coverage handoff:** the AGT-02/AGT-03 boundary behaviors are proven here at the module level; the 03a-01 flagged assumptions (evidence gate applies to tool-turns; `verification_failed` maps to `status:'failed'`) are re-asserted and completed at the orchestrator in 03a-03.
- **Fixture contract stable:** `tests/fixtures/trajectory.ts` (03a-01) remains the single source of the mock dangerous tool + verifier + synthetic evidence for all downstream 3a tests.

---
*Phase: 03a-agent-reliability-and-evidence*
*Completed: 2026-08-11*

## Self-Check: PASSED

- Created files verified on disk: src/core/ai/OutcomeVerifier.ts, src/core/ai/CheckpointRecorder.ts, tests/core/ai/OutcomeVerifier.test.ts, tests/core/ai/trajectory/CheckpointRecorder.test.ts, 03a-02-SUMMARY.md
- Commits verified in git log: 86ba720, a2731be, 198c87d, 216cd24, f85f7f8
- tsc --noEmit green; OutcomeVerifier.test.ts 12/12 + CheckpointRecorder.test.ts 9/9 pass; full tests/core/ai + fixtures regression 19 files / 212 tests pass
- Grep gates: `buildOutcome` present (3 matches); `streamText|generateText|model` = 0 matches in OutcomeVerifier.ts; `capture(`/`restore(` present in CheckpointRecorder.ts; no durable-persistence tokens (indexedDB/localStorage/chrome.storage/idb = 0)
