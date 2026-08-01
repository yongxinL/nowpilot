---
phase: 03a-agent-reliability-evidence
plan: 03
subsystem: ai
tags: [orchestrator, trajectory, permission, abort, evidence, replan, rendering-policy, typescript]

# Dependency graph
requires:
  - phase: 03a-agent-reliability-evidence
    provides: Plan 01 contracts (AgentTurnOutcome, AgentTrajectoryMachine, idempotency ledger, CompletionEvidence, RegisteredTool reliability metadata, PipelineError projection) and Plan 02 verifier/replan policy (OutcomeVerifier, VerifierTypes, evaluateReplan/ReplanDisposition, additive ReplanContext signals)
provides:
  - runTurn() refactored to a complete bounded reliability state machine returning immutable AgentTurnOutcome on every exit path (17 reason codes, 4 terminal states, finalized trajectory)
  - RenderingOutcomePolicy pure evidence-to-policy derivation + deterministic contradiction enforcement (buildRenderingOutcomePolicy / enforceRenderingOutcomePolicy)
  - RendererService policy+signal contract; ProviderRouter and ContextOptimizer shared-AbortSignal boundaries; ContextCompressor signal parameter (Plan 04 owns nested propagation)
  - Operation-scoped permission callback wiring (grant resumes the validated decision; denial terminates; cancellation becomes user/caller abort without replan bypass)
  - RecoveryObservation bounded redacted replan input to PlannerService.plan (signal + optional observation)
  - Deprecated runTurnText compatibility wrapper
affects: [03a-04, 03a-05, 06-telemetry, 07-rich-ux, 08a-tool-governance]

# Tech tracking
tech-stack:
  added: [] # no new dependencies — ai SDK v7 signal option, zod already present
  patterns:
    - "Strict trajectory loopback: no executing→planning edge exists in the D-04 allowlist — every return to the planner loop passes through replanning"
    - "Evidence-gated rendering: orchestrator derives the policy, renderer receives only a bounded evidence instruction, post-render enforcement replaces forbidden completion claims with a deterministic fallback"
    - "Permission as trajectory pause: waiting-for-permission → granted resumes the same decision, denied fails, cancelled aborts; tool call count increments only immediately before executor start"
    - "Single replan budget: replanCount increments once; recovery planner call receives only the redacted RecoveryObservation and reuses the optimized context"

key-files:
  created:
    - src/core/ai/RenderingOutcomePolicy.ts
  modified:
    - src/core/ai/AgentOrchestrator.ts
    - src/core/ai/PlannerService.ts
    - src/core/ai/RendererService.ts
    - src/core/ai/ProviderRouter.ts
    - src/core/context/ContextOptimizer.ts
    - src/core/context/ContextCompressor.ts
    - tests/core/ai/AgentOrchestrator.test.ts
    - tests/core/ai/integration.test.ts
    - tests/core/ai/tracer.test.ts
    - tests/core/context/ContextOptimizer.test.ts

key-decisions:
  - "Non-required evidence writes produce no evidence record and therefore no completion claim at render time — only evidence-backed writes are claimable (verified → wording, evidence_unavailable/timeout → submission caveat, failed → no claim)"
  - "Signal-only aborts default to caller_aborted; user/caller origin from a cancelled permission callback decides user_aborted vs caller_aborted"
  - "OutcomeVerifier runs only for evidence.required side effects; reads and non-required writes skip verification and continue-planning directly"
  - "RendererService policy/signal parameters remain optional (defensive) but every orchestrator call site supplies them — the renderer never derives or upgrades evidence"
  - "RecoveryObservation lives in PlannerService.ts (closed executionStatus union + safe error code + bounded evidence summary) to keep types.ts untouched"

patterns-established:
  - "Trajectory loopback via replanning: executing/verifying → replanning → planning is the only legal path back to the planner loop"
  - "Redacted recovery observation: tool name + closed status + PipelineError code + bounded evidence summary — never raw output, diagnostics, secrets, or idempotency keys"
  - "projectPipelineError before any PipelineError enters the outcome; diagnostics.errors carry only safe codes"

requirements-completed: [AGT-01, AGT-02, AGT-03, AGT-04, TOL-03] # phase-spanning — orchestrator marks complete after all 03a plans

coverage:
  - id: D1
    description: "runTurn() bounded reliability state machine — fresh AgentTrajectoryMachine per turn, one ContextOptimizer call, AgentTurnOutcome on answer/clarification/tool-success/tool-failure/permission-denial/cap-exhaustion/renderer-failure/state-failure/abort paths, runTurnText deprecated wrapper"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#19 tests (answer, clarification, tool loop, planner/renderer failure, caps, abort, permission, evidence, replan, irreversible, unknown-effect, runTurnText)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RenderingOutcomePolicy + enforcement — exact toolCallId/operationId evidence matching, verified/submission/failed/no-evidence conditions, deterministic fallback, RENDERER_EVIDENCE_CONTRADICTION signal, bounded evidence instruction only in renderer prompt"
    requirement: AGT-02
    verification:
      - kind: unit
        ref: "tests/core/ai/tracer.test.ts#RenderingOutcomePolicy (14 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shared AbortSignal boundaries — ProviderRouter.selectProvider(preferred, signal) and ContextOptimizer.optimize check the signal before/after awaited work; renderer receives the signal; abort finalization is idempotent with stage/origin/timestamp, never renders or replans"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#abort tests (pre-aborted, planning-boundary, renderer AbortError)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Permission sequencing — write/irreversible tools enter waiting-for-permission before executor start; grant resumes the same validated decision without a planner call, denial never invokes the executor, cancellation becomes user_aborted/caller_aborted without replan bypass; tool call count increments only immediately before executor start"
    requirement: AGT-01
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#permission tests (grant, deny, cancel user/caller)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Evidence wiring — OutcomeVerifier for required side effects, typed ExecutorService.attachEvidence seam, verified evidence continues, failed evidence renders partial with submission caveat, RENDERER_EVIDENCE_CONTRADICTION warning appended"
    requirement: TOL-03
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#verified seam + failing-write contradiction tests"
        status: pass
    human_judgment: false
  - id: D6
    description: "Deterministic replanning — one recovery PlannerService call with the bounded redacted RecoveryObservation, ContextOptimizer not re-run, counters/deadline unchanged, irreversible failures terminate, unknown effect state never replays"
    requirement: AGT-04
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#one-recovery-pass + irreversible + unknown-effect tests"
        status: pass
    human_judgment: false
  - id: D7
    description: "Caller migration — no repository caller treats runTurn as string-returning or destructures a string result; integration/tracer/ContextOptimizer suites assert outcome fields; explicit three-field reliability metadata at selected-tool boundaries"
    requirement: AGT-01
    verification:
      - kind: unit
        ref: "tests/core/ai/integration.test.ts + tests/core/context/ContextOptimizer.test.ts#Tracer end-to-end"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-08-01
status: complete
---

# Phase 03a Plan 03: Orchestrator Reliability Integration Summary

**runTurn() rebuilt as a complete bounded reliability state machine — outcome on every exit path, evidence-gated rendering policy with deterministic contradiction fallback, operation-scoped permission sequencing, and a one-replan recovery loop with redacted observations — with every existing caller migrated to the structured AgentTurnOutcome contract.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-07-31T23:55:00Z
- **Completed:** 2026-08-01T00:25:52Z
- **Tasks:** 3 (Tasks 1-2 TDD: RED + GREEN each; Task 3 migration)
- **Files modified:** 11 (5 source, 1 new, 5 test)

## Accomplishments

- **RenderingOutcomePolicy** (`src/core/ai/RenderingOutcomePolicy.ts`): pure evidence-to-policy derivation matching evidence by exact operationId + toolCallId. Verified write evidence permits completion wording only for the matching call; submitted-but-unverified (`evidence_unavailable`/`verification_timeout`) permits submission-only wording with a caveat; failed (`postcondition_failed`/`verification_error`/`aborted`) and absent evidence permit no completion claim. Every blocked condition carries a deterministic fallback answer and a bounded `evidenceSummary` instruction for the renderer prompt. `enforceRenderingOutcomePolicy` is a pure post-render check that detects only the documented completion-claim patterns and replaces forbidden text with the fallback, exposing `RENDERER_EVIDENCE_CONTRADICTION` for orchestrator diagnostics — it never repairs model text, mutates evidence, or upgrades outcome state.
- **AgentOrchestrator.runTurn()** (D-01..D-17): fresh `AgentTrajectoryMachine` + immutable per-turn accumulators; `ContextOptimizer.optimize` runs exactly once; provider selection, planner, permission callback, executor, verifier, and renderer awaits all check the shared AbortSignal before/after; abort finalization is idempotent, records stage/origin/timestamp, sets `renderedAnswer null`, and never renders/replans/retries. Trajectory transitions run strictly through the D-04 allowlist — including the required `executing/verifying → replanning → planning` loopback, since the allowlist has no direct executing→planning edge. Every exit path returns `AgentTurnOutcome` via `createAgentTurnOutcome` (schema-validated, aborted-answer invariant enforced).
- **Permission sequencing**: write/irreversible tools enter `waiting-for-permission` before executor start; grant resumes the exact validated tool decision (no extra planner call), denial returns `permission_denied` without invoking the executor, cancellation finalizes `user_aborted`/`caller_aborted` per callback origin — no replan bypass. Tool call count increments only immediately before actual executor start.
- **Evidence wiring**: `OutcomeVerifier.verify` runs for required side effects, evidence is attached through the typed `ExecutorService.attachEvidence` seam, `ReplanPolicy` is evaluated at execution-failure and verification-complete checkpoints. One replan = one additional `PlannerService.plan(adapter, tier, optimized, signal, recoveryObservation)` call with a bounded redacted observation (tool name, closed execution status, safe error code, bounded evidence summary) — never raw output, PipelineError diagnostics, secrets, or idempotency keys. PipelineErrors entering the outcome pass through `projectPipelineError`; diagnostics carry only safe codes.
- **Signal boundaries**: `ProviderRouter.selectProvider(preferred, signal?)` checks the signal before and after awaited API-key and adapter construction; `ContextOptimizer.optimize` checks before/after compression and passes the signal to `ContextCompressor.compress` (Plan 04 owns the nested propagation); `RendererService.synthesize/stream` accept the policy + signal and include only `policy.evidenceSummary` in the prompt.
- **Caller migration**: every runTurn consumer (tracer, integration, ContextOptimizer end-to-end) asserts `AgentTurnOutcome` fields; `integration.test.ts` and `ContextOptimizer.test.ts` declare the three Phase 3a reliability values explicitly at the selected-tool boundary; the deprecated `runTurnText` wrapper is the only text-returning API.

## Task Commits

Each task was committed atomically (TDD RED → GREEN for Tasks 1-2):

1. **Task 1: Rendering policy + renderer contract** — `5e5c8f1` (test), `d778906` (feat)
2. **Task 2: Orchestrator integration** — `9aa3f17` (test), `1ee1d03` (feat; tracer compile migration pulled into the lint gate)
3. **Task 3: Caller migration** — `36cee20` (refactor)

**Plan metadata:** pending (docs commit follows this summary)

**TDD gate compliance:** RED and GREEN commits exist for Tasks 1 and 2 in the correct order.

## Self-Check: PASSED

- All 11 files exist on disk (verified with `[ -f ]`).
- Task commits present in git log (5e5c8f1, d778906, 9aa3f17, 1ee1d03, 36cee20).
- Plan `<verification>` re-run: `pnpm vitest run tests/core/ai/AgentOrchestrator.test.ts tests/core/ai/integration.test.ts tests/core/ai/tracer.test.ts tests/core/context/ContextOptimizer.test.ts` → 65 tests, all pass, exit 0.
- Regression: Plan 01/02 suites (`types`, `AgentTrajectoryMachine`, `ExecutorService`, `OutcomeVerifier`, `ReplanPolicy`) → 101 tests, all pass, exit 0.
- `pnpm lint` → only the 9 pre-existing `src/core/storage/` errors (identical to the documented baseline); zero errors in files created/modified by this plan.

## Files Created/Modified

- `src/core/ai/RenderingOutcomePolicy.ts` (new) - `RenderingOutcomePolicy`, `buildRenderingOutcomePolicy`, `enforceRenderingOutcomePolicy`, deterministic fallback answers, bounded evidence instruction, `RENDERER_EVIDENCE_CONTRADICTION` re-export
- `src/core/ai/AgentOrchestrator.ts` - full bounded reliability state machine: trajectory, permission, abort, evidence, replan, rendering policy enforcement, `runTurnText` deprecated wrapper; `buildRegisteredTools` rejects missing reliability metadata with `SCHEMA_INVALID`
- `src/core/ai/PlannerService.ts` - `RecoveryObservation` contract + `plan(adapter, tier, optimized, signal?, recoveryObservation?)` with redacted prompt append
- `src/core/ai/RendererService.ts` - `synthesize`/`stream` accept `policy?` + `signal?`, append `policy.evidenceSummary`, forward signal
- `src/core/ai/ProviderRouter.ts` - `selectProvider(preferred, signal?)` with pre/post-await signal checks
- `src/core/context/ContextOptimizer.ts` - abortSignal checks at entry/before/after compression, signal passed to compressor
- `src/core/context/ContextCompressor.ts` - optional `signal` parameter (nested propagation owned by Plan 04)
- `tests/core/ai/AgentOrchestrator.test.ts` - 19 focused public-behavior tests (outcome contract, caps, abort at stage boundaries, permission grant/deny/cancel, verified/unverified evidence, one recovery pass, irreversible/unknown suppression, runTurnText)
- `tests/core/ai/tracer.test.ts` - 14 policy tests + 3 migrated runTurn outcome assertions
- `tests/core/ai/integration.test.ts` - migrated to outcome assertions with explicit reliability metadata
- `tests/core/context/ContextOptimizer.test.ts` - end-to-end consumer migrated to outcome assertions with explicit reliability metadata

## Decisions Made

- **Verification scope:** `OutcomeVerifier` runs only for `evidence.required === true` tools; reads and non-required writes continue-planning directly. A non-required write therefore produces no evidence record and its completion is never claimable at render time (policy condition `no-evidence`).
- **Signal-only abort default:** aborts from a plain AbortSignal default to `caller_aborted`; the cancelled-permission callback's origin decides `user_aborted` vs `caller_aborted`.
- **Defensive renderer signature:** `policy`/`signal` are optional parameters (kept for pre-integration runtime testability per the plan) but every orchestrator call site supplies both — the renderer never derives or upgrades evidence.
- **`RecoveryObservation` home:** defined in `PlannerService.ts` (the consuming contract owner) rather than `types.ts`, keeping Plan 02's additive-extension precedent and the redaction boundary in one place.

## Deviations from Plan

None - plan executed exactly as written. (Two execution findings were test-authoring/test-hygiene issues, fixed inline: mock state leaked across tests in the rewritten suite — `clearAllMocks` leaves once-queued/rejected implementations, so the suite uses `resetAllMocks` + per-test defaults; and the strict trajectory allowlist forced an explicit `executing → replanning → planning` loopback, which the task text did not call out but the D-04 map requires.)

## Issues Encountered

- **Trajectory self-transition bug:** the first implementation attempted `executing → executing` for consecutive tool calls — rejected by the strict allowlist with `AGENT_STATE_INVALID`. Fixed by routing every return to the planner loop through the `replanning` state per the D-04 map; now asserted in the trajectory tests.
- **Mock leakage in the new test file:** `vi.clearAllMocks()` does not remove once-queued or persistent rejected implementations, so earlier tests' `mockRejectedValue`/`mockResolvedValueOnce` leaked into later tests (observed as phantom `aborted` outcomes and skipped replans). Switched `beforeEach` to `vi.resetAllMocks()` with explicit per-test defaults for `selectProvider` and `synthesize`.
- **Pre-existing `pnpm lint` failures (out of scope, unchanged):** the same 9 `tsc` errors in `src/core/storage/` documented by Plans 01/02; verified identical at baseline; all files created/modified by this plan compile cleanly.
- **tracer compile gate:** the old tracer assertions (`response.length`, `rejects.toThrow(PipelineError)`) stopped compiling once `runTurn` returned `AgentTurnOutcome` — Task 3's tracer migration was pulled forward into Task 2's GREEN to satisfy the plan's `pnpm lint` acceptance gate.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 04 (abort propagation in ContextCompressor)** consumes `compress(sections, budget, tier, provider, signal?)` — the signal parameter is accepted but nested propagation is Plan 04's ownership, exactly as the plan stated.
- **Plan 05 (security regression + phase gate)** consumes the verified suites: the four named files plus Plan 01/02 unit suites, the nested compression suite, and the security suite.
- The `RENDERER_EVIDENCE_CONTRADICTION` bounded warning is the documented diagnostics signal for Phase 6 telemetry; trajectory history is ready for Phase 7 stage indicators.

---
*Phase: 03a-agent-reliability-evidence*
*Completed: 2026-08-01*
