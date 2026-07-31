---
phase: 03a
slug: agent-reliability-evidence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 03a — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.2.7 |
| **Config file** | `./vitest.config.ts` (jsdom environment, globals enabled) |
| **Quick run command** | `npx vitest run tests/core/ai/trajectory tests/core/ai/verifier tests/core/ai/replan` |
| **Full suite command** | `pnpm test -- tests/core/ai` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/ai/trajectory tests/core/ai/verifier tests/core/ai/replan`
- **After every plan wave:** Run `pnpm test -- tests/core/ai`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | 1 | AGT-01 | — | Invalid transitions throw AGENT_STATE_INVALID | unit | `npx vitest run tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts -t "transition"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-01 | — | All 10 states transition correctly end-to-end | integration | `npx vitest run tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts -t "full pipeline"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-02 | T-03a-02 | Verified tool returns VerifiedCompletionEvidence | unit | `npx vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts -t "verified"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-02 | T-03a-02 | Unverified tool returns UnverifiedCompletionEvidence | unit | `npx vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts -t "unverified"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-02 | T-03a-03 | Renderer does not claim writes without verified evidence | integration | `npx vitest run tests/core/ai/RenderingOutcomePolicy.test.ts -t "blocks write"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-03 | — | Cap exhaustion → partial, not completed | integration | `npx vitest run tests/core/ai/AgentOrchestrator.test.ts -t "cap exhaustion partial"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-03 | — | Abort yields aborted state, null answer | integration | `npx vitest run tests/core/ai/AgentOrchestrator.test.ts -t "abort"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-03 | — | Every exit path returns AgentTurnOutcome | integration | `npx vitest run tests/core/ai/AgentOrchestrator.test.ts -t "returns AgentTurnOutcome"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-04 | — | Success → continue-planning | unit | `npx vitest run tests/core/ai/ReplanPolicy.test.ts -t "success continues"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-04 | — | Retryable error → one replan | unit | `npx vitest run tests/core/ai/ReplanPolicy.test.ts -t "retryable one replan"` | ❌ W0 | ⬜ pending |
| — | — | 1 | AGT-04 | — | Irreversible tool → terminate | unit | `npx vitest run tests/core/ai/ReplanPolicy.test.ts -t "irreversible terminates"` | ❌ W0 | ⬜ pending |
| — | — | 1 | TOL-03 | T-03a-04 | Write side-effect tool triggers verifier | integration | `npx vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts -t "write side effect"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts` — covers AGT-01 (all transitions, invalid rejections, terminal lock, history immutability, callback fire-and-forget)
- [ ] `tests/core/ai/verifier/OutcomeVerifier.test.ts` — covers AGT-02, TOL-03 (verified/unverified evidence, verifier type routing, timeout handling, missing verifier)
- [ ] `tests/core/ai/ReplanPolicy.test.ts` — covers AGT-04 (all ReplanDisposition outcomes, irreversible guard, one-replan limit, abort priority, cap exhaustion)
- [ ] `tests/core/ai/RenderingOutcomePolicy.test.ts` — covers AGT-02 (policy derivation, mixed evidence handling, empty evidence)
- [ ] `tests/core/ai/AgentOrchestrator.test.ts` (extended) — covers AGT-03 (AgentTurnOutcome on every exit path, cap exhaustion, abort, runTurnText wrapper)
- [ ] `tests/core/ai/ExecutorService.test.ts` (extended) — covers idempotency ledger (duplicate detection, in-flight guard, key uniqueness)
- [ ] `tests/core/ai/types.test.ts` — Zod schema validation for AgentTurnOutcome, CompletionEvidence, ReplanDisposition
- [ ] `tests/core/ai/integration.test.ts` (extended) — full trajectory + evidence + replan integration flow

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `runTurnText()` compatibility wrapper preserves existing consumer behavior | AGT-03 | Depends on external consumers from Phase 3 and Phase 4 | Run existing Phase 3/4 tests after migration; verify all pass |
| `onTrajectoryTransition` callback does not throw or block turn | AGT-01 | Callback integration across surfaces | Register a throwing callback; confirm turn completes normally |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
