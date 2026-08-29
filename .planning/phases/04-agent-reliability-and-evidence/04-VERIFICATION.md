---
phase: 04-agent-reliability-and-evidence
verified: 2026-08-29T00:47:26Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 4: Agent Reliability and Evidence — Verification Report

**Phase Goal:** The agent emits an explicit `AgentTurnOutcome` for every turn, with trajectory states, CompletionEvidence for non-trivial side effects, and a deterministic replan/terminal policy that never silently claims success.
**Verified:** 2026-08-29T00:47:26Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | AGT-01: Agent trajectory transitions are asserted against the closed state machine; illegal transitions throw at runtime | ✓ VERIFIED | `src/core/ai/trajectory.ts` — closed `TRAJECTORY_TRANSITIONS` table (all 10 C.1 phases as keys) + `TrajectoryTracker.enter()` throws `illegal trajectory transition: X -> Y` on illegal edges; wired into `AgentOrchestrator.ts` (`trajectory.enter(...)` at planning/executing/replanning/verifying/rendering/terminal/aborted, lines 281-292, 345, 390, 429, 470, 475, 509, 559, 593). Behavioral proof: `tests/core/ai/trajectory/TrajectoryTracker.test.ts` (6 tests: legal chain passes, `assembling-context → completed` throws, snapshot counters, operationId correlation, 10-key completeness, history) — PASSED in `pnpm run verify:phase-4` (183 tests). |
| 2   | AGT-02: Side-effecting tools without `CompletionEvidence` cannot render a "Done" — outcome forced away from `completed` | ✓ VERIFIED | `guardMissingEvidence()` in `src/core/ai/OutcomeVerifier.ts` (ok + verifier-registered + evidence-absent → true); wired **unconditionally** in `finish()` (`AgentOrchestrator.ts:324-339`) — forces `status: 'partial'` + `reasonCode: 'missing_evidence'`, overriding `buildOutcome`'s status (D-65 ordering, `effectiveStatus` at :380-386). `ToolExecutionResult.evidence` seam typed against canonical `import('@/types/harness').CompletionEvidence` (`src/core/ai/types.ts:138`). Behavioral proof: `tests/core/ai/OutcomeVerifier.test.ts` guard cases + `AgentOrchestrator.test.ts` case (j) — injected ok-without-evidence → `'partial'`/`'missing_evidence'` never `'completed'`; with-evidence control → `'completed'` — PASSED in gate. |
| 3   | AGT-03: Cap exhaustion produces `AgentTurnOutcome: partial`, never a successful state | ✓ VERIFIED | `buildOutcome` O.2 verbatim rule `caps.capHit ? 'partial' : ...` (`OutcomeVerifier.ts:51-56`); `finish()` computes `capHit` from loop literals and unifies to reasonCode `'cap_exhausted'` (`AgentOrchestrator.ts:306, 386`); capHit is the ONLY path to `partial` (`:380-384`). Behavioral proof: `OutcomeVerifier.test.ts` capHit→partial case + `AgentOrchestrator.test.ts` case (b) re-scripted with distinct tool names — status `'partial'`, reasonCode `'cap_exhausted'`, toolResults length == plannerCap — PASSED in gate. |
| 4   | AGT-04: Repeated identical failure → terminal `failed`; abort produces `aborted` — never a silent retry loop | ✓ VERIFIED | Replan policy in loop after `toolResults.push(result)` (`AgentOrchestrator.ts:522-568`): `failureIdentities` Map (toolName → stable identity `result.code ?? (result.error ?? 'ERROR')`, Pitfall 7) + `replannedTools` Set (≤1 replan per tool); repeated-identity → `finish('repeated_failure')`, budget-consumed → `finish('replan_exhausted')`, both forced `'failed'`; first failure enters trajectory `'replanning'`. Abort: boundary try/catch converts ONLY `DOMException('aborted','AbortError')` into returned outcome `status: 'aborted'`, `streamedText: ''`, `persistTurn` never invoked (D-45), trajectory terminal `'aborted'` (`:576-612`); non-abort errors rethrow (T-4-11). Behavioral proof: cases (k) repeated-identity→`failed`/`repeated_failure`, (l) one-replan-then-`completed`, (m) budget-consumed→`failed`/`replan_exhausted`, (e) both abort tests resolve `'aborted'` + persistTurn not called, chat-integration (c) journalSpy never fires — all PASSED in gate. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/types/harness.ts` | Canonical C.1 types (D-60) | ✓ VERIFIED | `AgentTrajectoryPhase` (10-value closed union), `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` (closed 4-value status union) — verbatim Appendix C.1; no parallel copy in `src/core/ai` (grep: only the additive `extends` at AgentOrchestrator.ts:109) |
| `src/core/ai/trajectory.ts` | TrajectoryTracker + closed transition table (D-62/63) | ✓ VERIFIED | Closed `TRAJECTORY_TRANSITIONS` (10 keys), runtime throw on illegal transitions, `snapshot(plannerCalls, toolCalls)` + `history()`; amended `assembling-context → [planning, aborted]` row for pre-aborted boundary |
| `src/core/ai/OutcomeVerifier.ts` | Verifier + buildOutcome + VerifierRegistry + guardMissingEvidence (O.2, D-64/65) | ✓ VERIFIED | O.2 verbatim status rule; registry starts EMPTY (0 `VerifierRegistry.register` calls in `src/`); guard condition tested both directions |
| `src/core/ai/types.ts` | `ToolExecutionResult.evidence` seam (spec 4339) | ✓ VERIFIED | `evidence?: import('@/types/harness').CompletionEvidence` at :138 — additive, `data`/`error`/`code` untouched |
| `src/core/ai/AgentOrchestrator.ts` | runAgentTurn → AgentTurnOutcome + guard + AGT-04 policy + abort conversion | ✓ VERIFIED | 613 lines, substantive; all four mechanisms wired end-to-end; `debugLog` (SCREAMING_SNAKE) used, zero `console.log` |
| `src/components/chat/useChatStreaming.ts` | `output.status === 'aborted'` branch | ✓ VERIFIED | Branch at :230 BEFORE `configuration_required` (:235); clears generating state, no error toast; defensive AbortError catch retained at :273 |
| `tests/core/ai/trajectory/TrajectoryTracker.test.ts` | AGT-01 closed-machine tests (§18) | ✓ VERIFIED | 6 tests covering legal/illegal transitions, snapshot, operationId, closed-machine completeness |
| `tests/core/ai/OutcomeVerifier.test.ts` | AGT-02/03 buildOutcome + guard tests (§18) | ✓ VERIFIED | 8 tests: capHit→partial, side-effect-fail→failed, zero-verifier vacuity, evidence shape, guard true/false |
| `tests/core/ai/AgentOrchestrator.test.ts` | Outcome contract + guard + replan/terminal + abort cases | ✓ VERIFIED | Cases (a)-(m) incl. re-scripted (b), (e) abort resolves, (j) guard, (k)/(l)/(m) AGT-04 |
| `package.json` | verify:phase-4 re-pointed (D-68) | ✓ VERIFIED | `tsc --noEmit && vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai` — no longer references `tests/core/context` |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/core/ai/types.ts` | `src/types/harness.ts` | `import('@/types/harness').CompletionEvidence` | ✓ WIRED | Seam resolves (tsc strict-clean passed in gate); alias fixed in tsconfig/vitest/vite (04-01 deviation 1) |
| `AgentOrchestrator.ts` | `trajectory.ts` | `TrajectoryTracker` + `trajectory.snapshot(...)` on outcome | ✓ WIRED | Tracker instantiated per turn (:148); snapshot attached to every outcome incl. aborted (:404, 439, 608); `enter('replanning')` (:559), `enter('aborted')` (:593) validated against closed table |
| `AgentOrchestrator.ts` | `OutcomeVerifier.ts` | `buildOutcome` + `guardMissingEvidence` in finish() | ✓ WIRED | buildOutcome at :308; guard at :324 evaluated AFTER buildOutcome, override unconditional (D-65 ordering); effective verifier set = `{...VerifierRegistry.getAll(), ...input.verifiers}` (:151-154) |
| `AgentOrchestrator.ts` | `useChatStreaming.ts` | runAgentTurn now RESOLVES on abort — hook branches `status === 'aborted'` | ✓ WIRED | Branch at useChatStreaming.ts:230 before configuration_required; defensive catch :273 retained |
| `AgentOrchestrator.ts` | `types.ts` | Guard reads `ToolExecutionResult.evidence` | ✓ WIRED | `guardMissingEvidence` reads `r.evidence` on each ok result |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `finish()` outcome status | `effectiveStatus` | `buildOutcome` (capHit/policy/verifier) + guard override | ✓ — computed from real loop counters + tool results, never a static literal | ✓ FLOWING |
| Outcome evidence | `built.evidence` | `buildOutcome` over `toolResults` + effective verifiers | ✓ — produced per registered verifier; `[]` only when zero verifiers (D-64 vacuity) | ✓ FLOWING |
| Trajectory on outcome | `output.trajectory` | `TrajectoryTracker.snapshot(plannerCalls, toolCalls)` | ✓ — real per-turn state machine with live counters | ✓ FLOWING |
| Consumer branch | `output.status` | Returned `AgentTurnOutcome` from orchestrator | ✓ — branch fires on real `'aborted'` status; journalSpy-never-fires proven by chat-integration (c) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase-4 gate (roadmap §24 verification gate) | `pnpm run verify:phase-4` | 19 test files / 183 tests PASSED + `tsc --noEmit` clean | ✓ PASS |
| Abort drops the partial (D-45) | `npx vitest run tests/core/ai/chat-integration.test.ts -t "abort mid-stream drops the partial"` | 1 passed — journalSpy never fires | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probes declared in any 04-xx PLAN/SUMMARY; phase is not a migration/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| AGT-01 | 04-01 | Explicit trajectory states; transitions asserted against closed state machine | ✓ SATISFIED | `trajectory.ts` closed table + throw; TrajectoryTracker.test.ts (6 tests) + orchestrator hooks |
| AGT-02 | 04-01, 04-02 | Side-effecting success requires CompletionEvidence | ✓ SATISFIED | `evidence` seam + `guardMissingEvidence` wired unconditionally in finish(); case (j) false-completion proof |
| AGT-03 | 04-01, 04-03, 04-04 | Every turn produces structured AgentTurnOutcome; cap exhaustion is partial | ✓ SATISFIED | C.1 `AgentTurnOutcome` on every path (completed/partial/failed/aborted/config-required); case (b) + OutcomeVerifier capHit test |
| AGT-04 | 04-03, 04-04 | Deterministic replan/terminal policy; abort → aborted | ✓ SATISFIED | failureIdentities/replannedTools policy; cases (k)/(l)/(m); boundary abort conversion; case (e) |

No orphaned requirements — all AGT-01…04 claimed by plans and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX markers in any phase-modified source file | — | None |
| — | — | No TODO/HACK/PLACEHOLDER, no empty implementations, no `console.log` in modified source | — | None |
| — | — | Zero `@ts-expect-error NP-STRICT` markers; zero `ToolRegistry.register` calls in tests (D-67); zero `VerifierRegistry.register` in production (D-64) | — | None |

### Human Verification Required

None. All four §28.2 success criteria are behavior-dependent and each is exercised by tests that passed in the gate run I executed (`pnpm run verify:phase-4` — 19 files / 183 tests). The single UI-touching change (useChatStreaming `aborted` branch) is contract-asserted by chat-integration case (c) which passed. Per the plan's own deferred table (04-VALIDATION.md), live-provider replan and trajectory UI surfacing are explicitly out of Phase-4 scope.

### Gaps Summary

No gaps found. Phase goal achieved:

1. **AGT-01** — closed trajectory state machine with runtime throw on illegal transitions, asserted by dedicated tests and wired through every orchestrator path.
2. **AGT-02** — completion guard forces `partial`/`missing_evidence` for evidence-less side effects, unconditionally overriding buildOutcome (D-65 ordering); proven by the false-completion test (case (j)).
3. **AGT-03** — cap exhaustion produces `partial`/`cap_exhausted`, never `completed`; every turn path resolves a structured `AgentTurnOutcome` with operationId correlation, evidence, and counters.
4. **AGT-04** — deterministic replan/terminal policy (≤1 replan per failed tool, repeated-identity and budget-consumed terminals → `failed`), abort converts to a returned `'aborted'` outcome with `persistTurn` never invoked (D-45).

The verification gate (`pnpm run verify:phase-4`) is GREEN — re-pointed to the §18-required test dirs (D-68) — and the git history is coherent (04-04's history-repair commit `bdb64bb` restores a passing HEAD; all 10 phase commits verified present: d564213, ee5aef0, 3eacc9e, d0b1242, 6d09d98, fd37e0e, bdb64bb, 3aa2132, 77dc30b, plus docs commits).

---

_Verified: 2026-08-29T00:47:26Z_
_Verifier: the agent (gsd-verifier)_