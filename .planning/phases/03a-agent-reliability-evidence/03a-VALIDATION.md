---
phase: 03a
slug: agent-reliability-evidence
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-01
---

# Phase 03a - Validation Strategy

This validation contract is aligned with the five replacement PLAN.md files. There is no unowned Wave 0 gap: each behavioral test is created or updated by the plan that owns the production contract it verifies, and the final gate runs every named file explicitly.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | vitest ^3.0.0 |
| Config | `vitest.config.ts` |
| Package manager | pnpm |
| Type check | `pnpm lint` |
| Phase gate | `pnpm run verify:phase-3a` |

## Sampling Rate

- After Plan 01 Task 1: `pnpm vitest run tests/core/ai/types.test.ts`
- After Plan 01 Task 2: `pnpm vitest run tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts tests/core/ai/ExecutorService.test.ts`
- After Plan 02 Task 1: `pnpm vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts`
- After Plan 02 Task 2: `pnpm vitest run tests/core/ai/ReplanPolicy.test.ts`
- After Plan 03 Task 1: `pnpm vitest run tests/core/ai/tracer.test.ts`
- After Plan 03 Task 2: `pnpm vitest run tests/core/ai/AgentOrchestrator.test.ts && pnpm lint`
- After Plan 03 Task 3: `pnpm vitest run tests/core/ai/integration.test.ts tests/core/ai/tracer.test.ts tests/core/context/ContextOptimizer.test.ts`
- After Plan 04 Task 1: `pnpm vitest run tests/core/context/ContextCompressor.test.ts tests/core/context/ContextOptimizer.test.ts`
- After Plan 05 Task 1: `pnpm vitest run tests/security/agent-harness.test.ts`
- Phase gate: `pnpm run verify:phase-3a`

Every behavioral command names an existing or current-task-created file and must execute at least one test. Type-check-only commands are limited to production-signature tasks and are followed by behavioral verification in the owning test task. No test-name filter is used as the only proof.

## Plan-Owned Validation Map

| Plan/task | Requirement | Observable behavior | Automated command |
|---|---|---|---|
| 03a-01/T1 | AGT-01, AGT-03 | Contracts, schemas, all canonical reason codes, valid/invalid transition data | `pnpm vitest run tests/core/ai/types.test.ts` |
| 03a-01/T2 | AGT-01, TOL-03 | Full FSM, terminal protection, callback isolation, idempotency completed/failed-before-effect/unknown states | `pnpm vitest run tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts tests/core/ai/ExecutorService.test.ts` |
| 03a-02/T1 | AGT-02, TOL-03 | Exact evidence mapping, safe checks, missing verifier, failure, timeout, and abort | `pnpm vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts` |
| 03a-02/T2 | AGT-04 | Four dispositions, permission/abort priority, one-replan cap, irreversible/unknown suppression, purity | `pnpm vitest run tests/core/ai/ReplanPolicy.test.ts` |
| 03a-03/T1 | AGT-02 | Policy wording, exact tool-call matching, renderer contradiction fallback contract | `pnpm vitest run tests/core/ai/tracer.test.ts` |
| 03a-03/T2 | AGT-01/02/03/04, TOL-03 | Orchestrator exit paths, signal propagation, permission, evidence, replan, caps, and safe diagnostics | `pnpm vitest run tests/core/ai/AgentOrchestrator.test.ts && pnpm lint` |
| 03a-03/T3 | AGT-03 | Legacy caller migration and structured outcome assertions | `pnpm vitest run tests/core/ai/integration.test.ts tests/core/ai/tracer.test.ts tests/core/context/ContextOptimizer.test.ts` |
| 03a-04/T1 | AGT-03 | Nested compressor abort propagation and non-abort regression | `pnpm vitest run tests/core/context/ContextCompressor.test.ts tests/core/context/ContextOptimizer.test.ts` |
| 03a-05/T1 | AGT-01/02/03/04, TOL-03 | STRIDE controls, no disclosure, no bypass, bounded execution, no Phase 8a claims | `pnpm vitest run tests/security/agent-harness.test.ts` |
| 03a-05/T2 | AGT-01/02/03/04, TOL-03 | Explicit phase-wide suite and type-check gate | `pnpm run verify:phase-3a` |

## Required Coverage

- All ten trajectory states, all valid transitions, invalid transitions, terminal protection, concurrent isolation, and callback failure isolation.
- All AgentTurnOutcome exit paths, cap flags, immutable snapshots, abort at every stage, caller/user distinction, and timeout distinction.
- Exact CompletionEvidence operation/tool-call mapping, safe checks, verifier routing, unavailable/failed/timeout/abort variants, and renderer contradiction fallback.
- Pure ReplanPolicy dispositions, one recovery planner call, no ContextOptimizer rerun, no counter reset, permission grant/deny/cancel, and irreversible/unknown replay suppression.
- Explicit sideEffect/idempotency/evidence metadata for every current selected-tool adapter fixture; no Phase 8a fields.
- Spoofing, tampering, repudiation, information disclosure, denial of service, and elevation of privilege controls.

## Phase Gate File List

The Plan 05 script must explicitly list these eleven test files:

```text
tests/core/ai/types.test.ts
tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts
tests/core/ai/ExecutorService.test.ts
tests/core/ai/verifier/OutcomeVerifier.test.ts
tests/core/ai/ReplanPolicy.test.ts
tests/core/ai/tracer.test.ts
tests/core/ai/AgentOrchestrator.test.ts
tests/core/ai/integration.test.ts
tests/core/context/ContextOptimizer.test.ts
tests/core/context/ContextCompressor.test.ts
tests/security/agent-harness.test.ts
```

## Validation Sign-Off

- [x] Every behavioral task has an automated command.
- [x] No vacuous test-name-only gate is required.
- [x] Every test file has one owning plan/task.
- [x] Same-wave file conflicts are absent because all five plans are serial.
- [x] Security includes Repudiation and Elevation of Privilege.
- [x] Phase 8a durability, full manifests, active discovery, and long-running operations are explicitly excluded.
