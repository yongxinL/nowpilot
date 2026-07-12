---
phase: 04
slug: context-adaptive-execution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/core/context/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (borderline — full suite is ~30s; per-task `npx vitest run tests/core/context/ModelContextTier.test.ts` is <5s and preferred for task-level feedback) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/context/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CTXT-01 | — | N/A | unit | `npx vitest run` | — | ⬜ pending |
| TBD | TBD | TBD | CTXT-02 | — | N/A | unit | `npx vitest run` | — | ⬜ pending |
| TBD | TBD | TBD | CTXT-03 | — | N/A | unit | `npx vitest run` | — | ⬜ pending |
| TBD | TBD | TBD | CTXT-04 | — | N/A | unit | `npx vitest run` | — | ⬜ pending |
| TBD | TBD | TBD | CTXT-05 | — | N/A | unit | `npx vitest run` | — | ⬜ pending |
| TBD | TBD | TBD | CTXT-06 | — | N/A | unit | `npx vitest run` | — | ⬜ pending |
| TBD | TBD | TBD | CTXT-07 | — | N/A | unit | `npx vitest run` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/context/ContextOptimizer.test.ts` — stubs for optimization pipeline
- [ ] `tests/core/context/ContextCompressor.test.ts` — stubs for compression strategies
- [ ] `tests/core/context/TokenEstimator.test.ts` — stubs for token counting

*Existing infrastructure covers unit-test framework; Wave 0 creates stub test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TokenEstimation accuracy vs provider-native counts | CTXT-01 | Requires live API calls to compare estimates | Run integration test with multiple model sizes, verify char-based estimate is within 10% safety margin of provider-native counts |
| Degradation pipeline progression | CTXT-03 | Requires large context inputs spanning all degradation steps | Manually construct oversized ContextOptimizerInput, verify each step reduces tokens, verify Step 8 throws ContextTooLargeError |
| Minimal mode tool schema restriction | CTXT-04 | Requires testing with real MCP chaining scenarios | Verify minimal mode caps memory at top-3, restricts to one tool schema, blocks multi-step agent calls |
| Tier classification across all 4 tiers | CTXT-02 | Requires testing with models at tier boundaries | Verify classifyModelContext returns correct tier for boundary values (4096, 16384, 131072) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
