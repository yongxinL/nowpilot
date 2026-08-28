---
phase: 4
slug: agent-reliability-and-evidence
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 (jsdom, globals; `tests/setup.ts` chrome/storage/BroadcastChannel mocks) |
| **Config file** | `vitest.config.ts` (alias `@` → project root) |
| **Quick run command** | `npx vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/AgentOrchestrator.test.ts` |
| **Full suite command** | `pnpm run verify:phase-4` (after D-68 re-point) / `pnpm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/AgentOrchestrator.test.ts`
- **After every plan wave:** Run `pnpm run verify:phase-4` (D-68 re-pointed) + `pnpm run lint` (tsc --noEmit, strict ceiling)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-xx | 01 | 1 | AGT-01 | T-4-xx | Trajectory transitions asserted against the closed machine; illegal transitions rejected | unit | `npx vitest run tests/core/ai/trajectory` | ❌ W0 | ⬜ pending |
| 04-01-xx | 01 | 1 | AGT-03 | T-4-xx | `AgentTurnOutcome` returns per turn; counters on the snapshot | unit | `npx vitest run tests/core/ai/trajectory` | ❌ W0 | ⬜ pending |
| 04-02-xx | 02 | 2 | AGT-02 | T-4-xx | buildOutcome evidence semantics (O.2); side-effect fail → `failed` | unit | `npx vitest run tests/core/ai/OutcomeVerifier.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-xx | 02 | 2 | AGT-02 | T-4-xx | Guard: ok side-effecting result w/o evidence → `partial`, never `completed` | unit | `npx vitest run tests/core/ai/OutcomeVerifier.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-xx | 03 | 3 | AGT-04 | T-4-xx | One replan per failed tool; repeated identical failure → terminal `failed` | unit | orchestrator replan cases | ✅ exists (extend) | ⬜ pending |
| 04-03-xx | 03 | 3 | AGT-03 | T-4-xx | Cap exhaustion → `partial`, never `completed`; abort → `aborted` | unit | orchestrator cases (b)/(e) updated | ✅ exists (extend) | ⬜ pending |
| 04-03-xx | 03 | 3 | — | T-4-xx | `verify:phase-4` re-pointed (D-68) — currently RED | gate | `pnpm run verify:phase-4` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/ai/trajectory/` — new dir; AGT-01 closed-machine tests (legal transitions pass, illegal throw, snapshot counters, per-turn record)
- [ ] `tests/core/ai/OutcomeVerifier.test.ts` — new file; O.2 buildOutcome (cap→partial/`cap_exhausted`, side-effect fail→failed/`postcondition_failed`, else completed/ok; zero-verifier vacuity) + guard (false-completion)
- [ ] `tests/core/ai/AgentOrchestrator.test.ts` — extend: status assertions on existing cases, re-script (b) with distinct tool names, abort→`aborted` outcome (Q1), replan/terminal via `ExecutorService.execute` mocks
- [ ] `package.json` — re-point `verify:phase-4` (D-68) — currently RED (verified: `No test files found, exiting with code 1`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live replan against a real provider | AGT-04 | Zero registered tools in Phase 4 (D-46/D-67); replan is injection-exercised only | Deferred to the owning phase that registers the first tool |
| Trajectory surfacing in UI | AGT-01 | Diagnostics surfacing is Phase 11; trajectory is in-memory per turn | None in Phase 4 — the outcome's counters are the test surface |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}