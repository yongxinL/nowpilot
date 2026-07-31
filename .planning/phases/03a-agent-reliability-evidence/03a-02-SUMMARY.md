---
phase: 03a-agent-reliability-evidence
plan: 02
subsystem: ai
tags: [verifier, evidence, replan-policy, zod, redaction, typescript, abort]

# Dependency graph
requires:
  - phase: 03a-agent-reliability-evidence
    provides: Plan 01 contracts — CompletionEvidence union, ToolEvidencePolicy/ToolEvidenceVerifier, ReplanContext, PipelineErrorProjection, strict evidence schemas, ExecutorService attachEvidence seam
provides:
  - OutcomeVerifier service (src/core/ai/verifier/) returning typed CompletionEvidence for every tool result, with 5000 ms verifier bound, shared AbortSignal normalization, redaction-safe check validation, and no implicit verification for side-effecting tools
  - VerifierTypes contract file: closed CompletionVerifierType, VerifierCheck callback on the validated ToolExecutionResult, VerifierRegistry descriptor, strict CompletionEvidenceCheckSchema, and concrete SCHEMA_VERIFIER default
  - Pure evaluateReplan(ReplanContext) with the closed four-item ReplanDisposition union, deterministic priority, one-replan cap, and irreversible/unknown-state replay protection
  - Additive ReplanContext extension (sideEffect, effectKnownNotStarted, aborted, caps) — optional fields, no consumer breakage
affects: [03a-03 (orchestrator integration), 03a-05 (phase gate), 06-telemetry, 07-rich-ux]

# Tech tracking
tech-stack:
  added: [] # no new dependencies — zod already present
  patterns:
    - "Verifier directory as contract owner: descriptor types, safe-check schema, and concrete default verifier live in VerifierTypes.ts; the registered descriptor is the extension point"
    - "Bounded verifier run: Promise.race over the callback, 5000 ms timer, and the shared AbortSignal with listener cleanup; AbortError and signal state normalize to failureReason aborted with no retry permission"
    - "Conservative redaction: strict safe-check schema rejects unrestricted fields AND a sensitive-pattern scan discards key-like strings into verification_error — the whole check set is dropped, never stored"
    - "Pure disposition function: evaluateReplan imports only types, evaluates a documented 9-step priority, and never mutates the context (deep-freeze tested)"

key-files:
  created:
    - src/core/ai/verifier/VerifierTypes.ts
    - src/core/ai/verifier/OutcomeVerifier.ts
    - src/core/ai/ReplanPolicy.ts
    - tests/core/ai/verifier/OutcomeVerifier.test.ts
    - tests/core/ai/ReplanPolicy.test.ts
  modified:
    - src/core/ai/types.ts (additive ReplanContext extension only)

key-decisions:
  - "ReplanDisposition and the policy's effect-status signals were missing from Plan 01's contracts; defined the closed union in ReplanPolicy.ts (exported for Plan 03) and extended ReplanContext additively with optional sideEffect/effectKnownNotStarted/aborted/caps — the plan's must-haves required behavior the stated input could not support"
  - "CompletionEvidenceCheckSchema is not exported from AgentTurnOutcome.ts, and the plan names VerifierTypes as the safe-check contract owner — the strict schema lives in VerifierTypes.ts, structurally identical to the outcome schema's internal check shape"
  - "verification_timeout evidence is retryable: true (one bounded recovery pass per must-have truth 4); postcondition_failed, evidence_unavailable, verification_error, and aborted are retryable: false"
  - "Planner/tool cap exhaustion renders before verified-success continuation (per the plan's canonical evaluation order); verified success after one recovery pass still continues-planning because the second-recovery rule applies to failure paths only"
  - "SCHEMA_VERIFIER is a registrable concrete default (bounded structural check for defined object-like results) rather than a built-in fallback — a required policy with no declared verifier yields explicit evidence_unavailable"

patterns-established:
  - "Verified evidence carries a synthetic bounded resultRef {type: verifierType, ref: toolCallId} — a reference to the call, never the artifact payload"
  - "ReplanPolicy failurePath = cause present OR last evidence unverified; irreversible + failurePath terminates before success/cap/replan evaluation"

requirements-completed: [AGT-02, AGT-04, TOL-03]

coverage:
  - id: D1
    description: "OutcomeVerifier — verify() resolves to typed CompletionEvidence for every tool result: verified with exact operationId/toolCallId/toolName and safe checks, plus unverified evidence_unavailable / postcondition_failed / verification_error / verification_timeout (retryable once) / aborted variants; never throws; side-effecting tools never receive implicit verification; COMPLETION_EVIDENCE_MISSING diagnostic hook exported"
    requirement: TOL-03
    verification:
      - kind: unit
        ref: "tests/core/ai/verifier/OutcomeVerifier.test.ts#17 tests (exact ID association, every variant, type routing, safe output rejection, key-like string redaction, timeout via fake timers, abort variants, no raw output)"
        status: pass
    human_judgment: false
  - id: D2
    description: "VerifierTypes contract — closed CompletionVerifierType union, VerifierCheck callback receiving the validated ToolExecutionResult + AbortSignal, VerifierRegistry descriptor, strict safe-check schema, concrete SCHEMA_VERIFIER default for defined object-like results"
    requirement: TOL-03
    verification:
      - kind: unit
        ref: "tests/core/ai/verifier/OutcomeVerifier.test.ts#verifier type routing + SCHEMA_VERIFIER default cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "ReplanPolicy — pure evaluateReplan with the closed ReplanDisposition union; abort/cancellation, permission/auth/schema/unknown-tool/invalid-input/idempotency terminate with priority; irreversible failure/unverified terminates; caps render; verified success continues; one-replan cap; retryable failed-before-effect and verification timeout replan exactly once; unknown effect state never replays; deep-freeze purity"
    requirement: AGT-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ReplanPolicy.test.ts#17 tests (all dispositions, terminal priority set, irreversible protection, one-replan cap, unknown-effect no-replay, caps, purity)"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-07-31
status: complete
---

# Phase 03a Plan 02: Verifier & Replan Policy Summary

**Standalone OutcomeVerifier with bounded, abort-aware, redaction-safe evidence and a pure deterministic ReplanPolicy — both fully unit-tested and ready for the Wave-3 orchestrator integration — with the explicit no-persistence boundary (all state in-memory/operation-scoped).**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-31T23:39:56Z
- **Completed:** 2026-07-31T23:49:57Z
- **Tasks:** 2 (both TDD: RED + GREEN each — no refactor needed)
- **Files modified:** 5 (3 source, 2 test; plus additive 4-field extension to `types.ts`)

## Accomplishments

- **OutcomeVerifier** (`src/core/ai/verifier/OutcomeVerifier.ts`): `verify(toolResult, tool, operationId, signal)` always resolves to a `CompletionEvidence` record — never throws for verifier failure, timeout, missing verifier, or abort. Required evidence runs the declared verifier under a 5000 ms bound and the shared AbortSignal; checks are validated against the strict safe-check schema and a conservative key-like-string scan before any verified evidence is built. Side-effecting tools can never receive implicit verification: a required policy without a declared verifier (or a missing toolCallId) yields `evidence_unavailable` with the exported `COMPLETION_EVIDENCE_MISSING` diagnostic hook. `verification_timeout` is the only retryable evidence failure (one recovery pass per must-have truth 4); abort normalization never grants retry.
- **VerifierTypes** (`src/core/ai/verifier/VerifierTypes.ts`): contract owner for verifier descriptors and safe checks — closed `CompletionVerifierType` union, `VerifierCheck` callback receiving the full validated `ToolExecutionResult` + AbortSignal, `VerifierRegistry` descriptor (the extension point — no placeholder SchemaVerifier/EnvironmentVerifier files), the strict `CompletionEvidenceCheckSchema`, and the concrete `SCHEMA_VERIFIER` default (bounded structural checks for defined object-like results).
- **ReplanPolicy** (`src/core/ai/ReplanPolicy.ts`): pure `evaluateReplan(context: ReplanContext): ReplanDisposition` with type-only imports, no mutation, no timers, no hidden counters. Deterministic priority: abort/cancellation → permission/auth/schema/unknown-tool/invalid-input/idempotency terminate → irreversible failure/unverified terminate → cap exhaustion renders → verified success/ordinary continuation continues → second recovery request renders → retryable failed-before-effect (proven `effectKnownNotStarted`) and retryable verification timeout replan exactly once → otherwise render partial. PipelineError taxonomy and permission state untouched.
- **ReplanContext additive extension** (`types.ts`): optional `sideEffect`, `effectKnownNotStarted`, `aborted`, `caps` — the signals the policy's must-haves require. All optional; no Plan 01 consumer affected (72 regression tests across Plan 01/03 suites still pass).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Implement OutcomeVerifier with safe evidence and bounded cancellation** — `6377d2a` (test), `bb6823a` (feat)
2. **Task 2: Implement pure ReplanPolicy and exhaustive disposition tests** — `2096954` (test), `efa09b3` (feat)

**Plan metadata:** pending (docs commit follows this summary)

**TDD gate compliance:** RED and GREEN commits exist for both tasks in the correct order; REFACTOR steps were not needed (implementations were already minimal).

## Self-Check: PASSED

- All 5 files exist on disk (verified with `[ -f ]`).
- All 4 task commits present in git log (6377d2a, bb6823a, 2096954, efa09b3).
- Plan `<verification>` re-run: `pnpm vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts tests/core/ai/ReplanPolicy.test.ts` → 34 tests, all pass, exit 0.
- Regression: `pnpm vitest run tests/core/ai/types.test.ts tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts tests/core/ai/ExecutorService.test.ts tests/core/ai/AgentOrchestrator.test.ts` → 72 tests, all pass, exit 0 (proves the additive `types.ts` change broke nothing).
- `pnpm lint` → only the 9 pre-existing `src/core/storage/` errors (identical to the HEAD baseline captured at plan start); zero errors in files created/modified by this plan.

## Files Created/Modified

- `src/core/ai/verifier/VerifierTypes.ts` (new) - closed verifier type union, `VerifierCheck` callback contract, `VerifierRegistry`, strict safe-check schema, `SCHEMA_VERIFIER` concrete default
- `src/core/ai/verifier/OutcomeVerifier.ts` (new) - bounded/abort-aware verification with evidence construction, redaction, timeout, and the `COMPLETION_EVIDENCE_MISSING` diagnostic hook; exports `OutcomeVerifier` + `outcomeVerifier`
- `src/core/ai/ReplanPolicy.ts` (new) - `ReplanDisposition` closed union + pure `evaluateReplan`
- `src/core/ai/types.ts` (modified) - additive optional `sideEffect`/`effectKnownNotStarted`/`aborted`/`caps` on `ReplanContext` (documented as Plan 02 additive policy inputs)
- `tests/core/ai/verifier/OutcomeVerifier.test.ts` (new) - 17 tests
- `tests/core/ai/ReplanPolicy.test.ts` (new) - 17 tests

## Decisions Made

- **ReplanDisposition home:** Plan 01 shipped `ReplanContext` without `ReplanDisposition` (it exists nowhere in the repo) and without the effect-status/caps/abort signals this plan's must-haves require. `ReplanDisposition` is defined in and exported from `ReplanPolicy.ts` (Plan 03 consumes it), and `ReplanContext` is extended additively — keeping `evaluateReplan(context: ReplanContext)` exactly as specified. No consumer breakage; documented as a Rule 3 deviation.
- **Safe-check schema owner:** `CompletionEvidenceCheckSchema` is module-private in `AgentTurnOutcome.ts`; per the plan's read_first ("VerifierTypes.ts … contract owner for verifier descriptors and safe checks"), the strict schema lives in `VerifierTypes.ts`, structurally identical to the outcome schema's internal check shape.
- **Retryability semantics:** only `verification_timeout` evidence is retryable (must-have truth 4: verification timeout may replan once); `postcondition_failed`, `evidence_unavailable`, `verification_error`, `aborted` are not.
- **Cap vs success priority:** planner/tool cap exhaustion renders before verified-success continuation (the plan's canonical evaluation order); verified success after one recovery pass still `continue-planning` because the second-recovery rule applies to failure paths only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 01 contracts lacked `ReplanDisposition` and the policy's required signals**
- **Found during:** Task 2 (ReplanPolicy implementation)
- **Issue:** The plan's read_first expects `types.ts` to provide "ReplanContext, ReplanDisposition, effect status" from Plan 01, but `ReplanDisposition` exists nowhere and `ReplanContext` carries no sideEffect/caps/abort/effect-started fields. The must-haves (irreversible replay protection, cap handling, abort priority, failed-before-effect gating) cannot be satisfied by the stated input.
- **Fix:** Defined the closed `ReplanDisposition` union in `ReplanPolicy.ts` (exported for the Wave-3 orchestrator) and extended `ReplanContext` in `types.ts` with four optional additive fields (`sideEffect`, `effectKnownNotStarted`, `aborted`, `caps`), documented as Plan 02 policy inputs. This is a small additive contract change — `types.ts` was not in the plan's declared `files_modified`, so it is recorded as a deviation; 72 Plan 01/03 regression tests confirm zero consumer impact.
- **Files modified:** `src/core/ai/ReplanPolicy.ts`, `src/core/ai/types.ts`
- **Verification:** ReplanPolicy 17-test suite passes incl. deep-freeze purity; all Plan 01 suites pass
- **Committed in:** efa09b3 (Task 2 GREEN)

**2. [Rule 3 - Blocking] `CompletionEvidenceCheckSchema` is not exported from `AgentTurnOutcome.ts`**
- **Found during:** Task 1 GREEN (first test run)
- **Issue:** `import { CompletionEvidenceCheckSchema } from '../AgentTurnOutcome'` resolved to `undefined` — the schema is module-private in the Plan 01 file (confirmed via export-binding inspection).
- **Fix:** Defined the strict safe-check schema in `VerifierTypes.ts`, which the plan designates as the contract owner for safe checks; `OutcomeVerifier` imports it from there. No Plan 01 file modified.
- **Files modified:** `src/core/ai/verifier/VerifierTypes.ts`, `src/core/ai/verifier/OutcomeVerifier.ts`
- **Verification:** 17-test OutcomeVerifier suite passes; `pnpm lint` clean for both files
- **Committed in:** bb6823a (Task 1 GREEN)

**3. [Test-authoring bugs fixed inline during GREEN]**
- **Found during:** Task 1/2 GREEN
- **Issue:** Import-depth errors (tests in `tests/core/ai/verifier/` need 4 `../`; ReplanPolicy test needed 3), TS narrowing on the discriminated evidence union, and fixture type variance (`VerifierCheck` vs `ToolEvidenceVerifier['check']`).
- **Fix:** Assertion helpers (`expectVerified`/`expectUnverified`) and fixture-level type adaptation in the test files; corrected import paths.
- **Files modified:** both test files
- **Verification:** both suites pass; `pnpm lint` clean for test files
- **Committed in:** bb6823a / efa09b3 (test-file portions)

---

**Total deviations:** 3 auto-fixed (2 blocking-contract gaps, 1 test-authoring)
**Impact on plan:** Both contract fixes were required for the must-haves to be implementable and are additive/minimal; no scope creep, no Plan 01 behavioral change, no new dependencies.

## Issues Encountered

- **Pre-existing `pnpm lint` failures (out of scope, unchanged):** the same 9 `tsc` errors in `src/core/storage/` documented by Plan 01 (newer `@types/node` generics). Verified identical at the plan-start baseline; all files created/modified by this plan compile cleanly. The plan's `pnpm lint` verification therefore remains at the pre-existing baseline until the storage migration plan lands.
- The plan's action text places "second replan" before "planner/tool cap" before "verified success" in its evaluation-order enumeration; the enforceable contracts (behavior block + must-haves) were applied where the enumeration was ambiguous — cap renders before verified success, while verified success after one recovery continues (documented under Decisions).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 03 (orchestrator integration) consumes these exports read-only:** `OutcomeVerifier`/`outcomeVerifier`/`OUTCOME_VERIFIER_TIMEOUT_MS`/`OUTCOME_VERIFIER_EVIDENCE_MISSING_DIAGNOSTIC`, `VerifierTypes` descriptor + `SCHEMA_VERIFIER`, `evaluateReplan`/`ReplanDisposition`, and the extended `ReplanContext` fields (`sideEffect`, `effectKnownNotStarted`, `aborted`, `caps`).
- The `attachEvidence` seam from Plan 01 is the wiring point for verifier output in the orchestrator.
- The no-persistence boundary holds: verifier and policy are pure/in-memory; durable cross-turn guarantees remain Phase 8a.

---
*Phase: 03a-agent-reliability-evidence*
*Completed: 2026-07-31*
