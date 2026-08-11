---
phase: 3a
slug: agent-reliability-and-evidence
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 3a — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (pool: threads, environment: jsdom-align wrapper, setupFiles: tests/setup.ts) |
| **Config file** | vitest.config.ts (existing, no changes needed) |
| **Quick run command** | `npx vitest run tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/trajectory` |
| **Full suite command** | `vitest run` (inside `pnpm run verify:phase-3a`) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/trajectory -x`
- **After every plan wave:** Run `vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03a-01-01 | 01 | 1 | AGT-01 | T-03a-01 / — | Legal trajectory transitions; illegal transition throws `AGENT_STATE_INVALID` | unit | `npx vitest run tests/core/ai/trajectory` | ❌ W0 | ⬜ pending |
| 03a-01-02 | 01 | 1 | AGT-02 | T-03a-01 | CheckpointRecorder captures/restores pre-tool loop state; rollback discards failed result | unit | `npx vitest run tests/core/ai/trajectory` | ❌ W0 | ⬜ pending |
| 03a-02-01 | 02 | 2 | AGT-02 | T-03a-01 | Side-effecting tool with matching evidence → completed; absent evidence → `verification_failed` | unit | `npx vitest run tests/core/ai/OutcomeVerifier.test.ts` | ❌ W0 | ⬜ pending |
| 03a-02-02 | 02 | 2 | AGT-03 | T-03a-01 | Cap exhaustion → `status:'partial'`, `reasonCode:'cap_exhausted'`, never `completed` | unit | `npx vitest run tests/core/ai/OutcomeVerifier.test.ts` | ❌ W0 | ⬜ pending |
| 03a-03-01 | 03 | 3 | AGT-04 | T-03a-01 | Replan fires once on retryable tool failure; repeated-identical failure terminal; never nested; plannerCalls under plannerCap | unit | `npx vitest run tests/core/ai/trajectory` | ❌ W0 | ⬜ pending |
| 03a-03-02 | 03 | 3 | AGT-04 | T-03a-01 | Abort mid-verify/mid-replan wins (AbortError propagates) | unit | `npx vitest run tests/core/ai/trajectory` | ❌ W0 | ⬜ pending |
| 03a-04-01 | 04 | 4 | AGT-05 | T-03a-01 | `waiting-for-permission` phase reachable via pause seam; abort cancels the wait | unit | `npx vitest run tests/core/ai/trajectory` | ❌ W0 | ⬜ pending |
| 03a-05-01 | 05 | 5 | AGT-03 | — | Hook maps partial/failed → failed ChatStreamState; aborted → idle (D-3a-19) | unit (component) | `npx vitest run tests/components` | ❌ W0 | ⬜ pending |
| 03a-06-01 | 06 | 6 | AGT-01..05 | — | verify:phase-3a gate: eslint + prettier + tsc + wxt build + vitest + isolation | suite | `pnpm run verify:phase-3a` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/ai/OutcomeVerifier.test.ts` — new §18-required file (AGT-02/03)
- [ ] `tests/core/ai/trajectory/` — new §18-required directory (AGT-01/02/04/05-seam)
- [ ] `tests/fixtures/` additions — mock dangerous tool + synthetic evidence + transition-assertion helper + Zod boundary-schema fixtures (O1, D-3a-20)
- [ ] `AgentOrchestrator.test.ts` migration — AgentTurnOutput→AgentTurnOutcome shape flip, D-20 fence inversion (O3)
- [ ] `AgentOrchestrator.budget.test.ts` migration — reasonCode/status semantic updates (O3)
- [ ] `verify:phase-3a` script in package.json (§24 pattern) — eslint + prettier --check + tsc --noEmit + wxt build + vitest run + isolation check
- [ ] Existing suite green after rewire — full `tests/core/ai/**` + `tests/components/**` must pass (regression gate)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved 2026-08-11}
