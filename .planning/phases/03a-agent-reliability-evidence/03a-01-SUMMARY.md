---
phase: 03a-agent-reliability-evidence
plan: 01
subsystem: ai
tags: [trajectory-fsm, idempotency, zod, evidence, typescript, pipeline-error]

# Dependency graph
requires:
  - phase: 03-ai-core-pipeline
    provides: PipelineError taxonomy, ExecutorService execute/executeBatch, AgentTurnInput, TIER_CAPS
  - phase: 04-context-optimization-pipeline
    provides: ContextOptimizerInput contract and AgentTurnInput entry contract
provides:
  - AgentTurnOutcome immutable comprehensive contract (17 closed reason codes, 4 terminal states, Zod schema, factory)
  - AgentTrajectoryMachine strict D-04 state machine with immutable snapshots and isolated observer
  - ExecutorService operation-scoped in-memory idempotency ledger with completed/failed-before-effect/unknown states
  - CompletionEvidence discriminated union with strict safe-check schemas
  - RegisteredTool/ToolSchemaInfo Phase 3a reliability metadata (sideEffect/idempotency/evidence)
  - PipelineError canonical Rev. C terminal codes + safe diagnostic projection
affects: [03a-02, 03a-03, 03a-04, 03a-05, 06-telemetry, 07-rich-ux, 08a-tool-governance]

# Tech tracking
tech-stack:
  added: [] # zod already present — no new dependencies
  patterns:
    - "Strict allowlist FSM: explicit ALLOWED_TRANSITIONS map, terminal states empty, AGENT_STATE_INVALID for any rejected edge"
    - "Operation-scoped in-memory idempotency ledger with canonical recursively-sorted JSON key derivation (D-17)"
    - "Safe diagnostic projection: code-allowlisted bounded message, no raw input/output/secrets/logical keys"
    - "Compile-time Phase 8a exclusion gate: generic type guard fails tsc if manifest fields leak into RegisteredTool/ToolSchemaInfo"
    - "Strict Zod evidence schemas reject unrestricted fields (raw output/secrets) — T-03a-04 control"

key-files:
  created:
    - src/core/ai/AgentTurnOutcome.ts
    - src/core/ai/AgentTrajectoryMachine.ts
    - tests/core/ai/types.test.ts
    - tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts
  modified:
    - src/core/ai/types.ts
    - src/core/ai/PipelineError.ts
    - src/core/ai/ExecutorService.ts
    - tests/core/ai/ExecutorService.test.ts

key-decisions:
  - "ToolExecutionResult.toolCallId is required — ExecutorService supplies it for every call within this plan, so the outcome contract carries non-optional call identity"
  - "Ledger records every executed call (toolCallId index) so attachEvidence is a universal validated cache seam; dedup enforcement applies only to idempotency-required tools"
  - "Evidence schemas are strict — unrestricted fields (raw output, secrets) are rejected at parse time (T-03a-04), while the outcome schema stays non-strict so D-02 fields can grow"
  - "ReplanContext references PipelineErrorProjection (not AgentTurnReasonCode) to avoid a circular import between types.ts and AgentTurnOutcome.ts"

patterns-established:
  - "One fresh AgentTrajectoryMachine per turn — never shared across turns/surfaces (operation-scoped)"
  - "failed-before-effect is detected ONLY via diagnostic.effectStarted === false; everything else is unresolved and never re-executed"
  - "Logical idempotency keys use op:/tool:/input: prefix format and never appear in public diagnostics"

requirements-completed: [AGT-01, AGT-03, TOL-03] # phase-spanning — orchestrator marks complete after all 03a plans

coverage:
  - id: D1
    description: "Phase 3a public contracts — AgentTurnOutcome (17 reason codes, 4 terminal states, Zod schema, factory), D-04 ALLOWED_TRANSITIONS, CompletionEvidence union, permission decision/request, ReplanContext, RegisteredTool/ToolSchemaInfo reliability metadata, PipelineError terminal codes + safe projection"
    requirement: AGT-01
    verification:
      - kind: unit
        ref: "tests/core/ai/types.test.ts#30 tests (reason codes, terminal states, transitions, evidence variants, projection)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AgentTrajectoryMachine — strict D-04 allowlist enforcement, terminal protection, immutable history, observer failure isolation, concurrent instance isolation, finalize-once"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts#14 tests (exhaustive 100 state-pair allowlist)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ExecutorService operation-scoped idempotency ledger — completed-duplicate cache hits, bounded failed-before-effect recovery, unknown/in-flight suppression, distinct toolCallIds, canonical key ordering, operation isolation, attachEvidence validated seam with spoof rejection"
    requirement: TOL-03
    verification:
      - kind: unit
        ref: "tests/core/ai/ExecutorService.test.ts#23 tests (ledger + legacy behavior)"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-07-31
status: complete
---

# Phase 03a Plan 01: Contracts & Idempotency Primitive Summary

**Strict D-04 trajectory state machine, immutable AgentTurnOutcome contracts with 17 closed reason codes, and an operation-scoped ExecutorService idempotency ledger with a validated evidence attachment seam — no Phase 8a manifest fields or persistence.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-31T23:20:04Z
- **Completed:** 2026-07-31T23:31:13Z
- **Tasks:** 2 (both TDD: RED + GREEN each — no refactor needed)
- **Files modified:** 8 (4 source, 4 test)

## Accomplishments

- **AgentTurnOutcome** (D-02/D-05): immutable comprehensive contract with 4 terminal states (`completed|partial|failed|aborted`), 17 closed reason codes, abort origin, readonly arrays, Zod schema enforcing the closed unions, the aborted-answer invariant (`aborted` ⇒ `renderedAnswer === null`), and a validating factory. `OUTCOME_WARNING_RENDERER_EVIDENCE_CONTRADICTION` exported as the bounded outcome warning.
- **Trajectory contracts** (AGT-01/D-04): ten `AgentTrajectoryState` values and the exact `ALLOWED_TRANSITIONS` allowlist (terminal states empty), exhaustively tested across all 100 state pairs.
- **AgentTrajectoryMachine** (D-03/D-07): operation-scoped FSM starting at `assembling-context`, closes entries with `enteredAt/exitedAt/durationMs`, throws `AGENT_STATE_INVALID` for illegal/post-terminal/self transitions, returns immutable snapshots, isolates throwing observers, and `finalize()`s exactly once.
- **ExecutorService idempotency ledger** (D-17): distinct `toolCallId` per logical call; canonical recursively-sorted JSON logical key (`op:…;tool:…;input:…`); completed duplicates serve cached result + evidence under a new toolCallId without re-executing; `failed-before-effect` (only via `diagnostic.effectStarted === false`) permits exactly one recovery then becomes unresolved; `started`/`unknown` states throw `TOOL_IDEMPOTENCY_CONFLICT` and never re-execute; `attachEvidence(toolCallId, evidence)` is a typed validated seam that rejects spoofed operationId/toolName with `TOOL_POSTCONDITION_FAILED`; operationId propagated through `executeBatch`.
- **PipelineError** (D-12): four canonical Rev. C codes (`AGENT_STATE_INVALID`, `TOOL_POSTCONDITION_FAILED`, `COMPLETION_EVIDENCE_MISSING`, `TOOL_IDEMPOTENCY_CONFLICT`) mapped terminal; existing retryable codes unchanged; `projectPipelineError` safe diagnostic projection strips raw messages, diagnostics, secrets, and logical keys.
- **Compile-time Phase 8a exclusion gate**: a generic type guard in `types.test.ts` fails `tsc` if any manifest field (`category|risk|permissions|dataScopes|timeout|costClass|schemaHashes|discovery`) leaks into `RegisteredTool`/`ToolSchemaInfo`.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Define outcome, trajectory, evidence, permission, and idempotency contracts** — `6d19a94` (test), `43dcf2b` (feat)
2. **Task 2: Implement trajectory machine and operation-scoped idempotency ledger** — `40326bf` (test), `4479d9b` (feat)

**Plan metadata:** `dc2e94e` (docs: complete contracts and idempotency primitive plan)

**TDD gate compliance:** RED and GREEN commits exist for both tasks in the correct order; REFACTOR steps were not needed (implementations were already minimal).

## Self-Check: PASSED

- All 8 files exist on disk (verified with `[ -f ]`).
- All 4 task commits present in git log (6d19a94, 43dcf2b, 40326bf, 4479d9b).
- Plan `<verification>` re-run: `pnpm vitest run tests/core/ai/types.test.ts tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts tests/core/ai/ExecutorService.test.ts` → 67 tests, all pass, exit 0.
- `pnpm lint` → 9 tsc errors, all pre-existing in `src/core/storage/` (verified identical at HEAD baseline); zero errors in files touched by this plan.

## Files Created/Modified

- `src/core/ai/types.ts` - Phase 3a contracts: ten trajectory states, `ALLOWED_TRANSITIONS`, `TrajectoryStateEntry`, evidence union/check/ref/policy types, permission request/decision, `ReplanContext`, `RegisteredTool`+`ToolSchemaInfo` reliability metadata, `ToolExecutionResult.toolCallId`/`evidence`, 4 new `PipelineErrorCode`s, `AgentTurnInput.requestPermission`, `ContextOptimizerInput.abortSignal`
- `src/core/ai/PipelineError.ts` - 4 new terminal code mappings + `PipelineErrorProjection`/`projectPipelineError`
- `src/core/ai/AgentTurnOutcome.ts` (new) - `AgentTurnOutcome`, reason/terminal unions, Zod schemas (strict evidence, refined outcome), `createAgentTurnOutcome` factory
- `src/core/ai/AgentTrajectoryMachine.ts` (new) - operation-scoped strict FSM with immutable history and isolated observer
- `src/core/ai/ExecutorService.ts` - toolCallId identity, idempotency ledger, canonical key derivation, `attachEvidence`, operationId through `executeBatch`
- `tests/core/ai/types.test.ts` (new) - 30 contract tests (positive/negative schema cases, all reason codes, exhaustive transition map, projection safety, compile-time manifest gate)
- `tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts` (new) - 14 FSM tests (100 state pairs, terminal protection, immutability, observer isolation, concurrency, finalize)
- `tests/core/ai/ExecutorService.test.ts` - 23 tests (legacy behavior preserved + 14 new ledger/identity tests)

## Decisions Made

- **`toolCallId` required on `ToolExecutionResult`** — the plan said "preserving optionality until ExecutorService supplies it"; ExecutorService supplies it for every call within this same plan, so the end-state contract is non-optional.
- **Ledger records every call** (not only required-idempotency tools), indexed by toolCallId, so `attachEvidence` is a universal validated cache seam for the later OutcomeVerifier; dedup enforcement remains exclusive to `idempotency: 'required'` tools.
- **Strict evidence schemas** — `CompletionEvidenceCheckSchema`, `Verified`/`Unverified` schemas reject unrestricted fields outright (T-03a-04); the outcome schema itself stays non-strict to allow D-02 growth.
- **No circular imports** — `ReplanContext.cause` uses `PipelineErrorProjection`; `AgentTurnReasonCode` lives solely in `AgentTurnOutcome.ts`.

## Deviations from Plan

None - plan executed exactly as written. (Task-2 test-authoring bugs — wrong `machineAt` drive paths, off-by-one history index, missing `renderedAnswer: null` for the aborted terminal-state case — were corrected inline in the test files during GREEN; they were test bugs, not implementation deviations.)

## Issues Encountered

- **Pre-existing `pnpm lint` failures (out of scope):** `tsc --noEmit` reports 9 errors in `src/core/storage/` (`ApiKeyStore.ts`, `CryptoService.ts`, `MigrationRunner.ts`, `WriteJournal.ts`) caused by newer `@types/node` generics (`Uint8Array<ArrayBufferLike>`, `IDBPTransaction`). Verified identical at HEAD baseline (c15133d) via a pristine checkout — not introduced by this plan. All files created/modified by this plan compile cleanly. The plan-level `pnpm lint` verification therefore cannot fully pass until the storage layer is migrated; tracked in `deferred-items.md` and WINDOWS.md entries 1-3.
- **Pre-existing test failures (out of scope):** `StreamAdapter.test.ts` (2) and `ProviderAdapter.test.ts` (4) fail identically at HEAD baseline; unrelated to Phase 3a files.
- During Task 1 GREEN, the `verified: true + failureReason` fixture passed because zod strips unknown keys — resolved by making the evidence schemas strict (matches the T-03a-04 control).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later plans (03a-02 orchestrator integration, 03a-03 verifier, 03a-04 replan policy) consume these files **read-only** — the contracts, FSM, and ledger are complete and compiling.
- `attachEvidence` is the ready-made validated cache seam for the OutcomeVerifier plan.
- Pre-existing lint baseline (storage `@types/node` drift) should be addressed in a future plan before `/gsd-ship`.

---
*Phase: 03a-agent-reliability-evidence*
*Completed: 2026-07-31*
