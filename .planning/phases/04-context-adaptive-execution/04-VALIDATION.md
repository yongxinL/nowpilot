---
phase: 4
slug: context-adaptive-execution
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom-align env + threads pool) |
| **Config file** | vitest.config.ts (Phase-1/2/3 established) |
| **Quick run command** | `pnpm vitest run tests/core/context tests/core/ai/AgentOrchestrator.test.ts` |
| **Full suite command** | `pnpm run verify:phase-4` (§24 chain: eslint + prettier + tsc + wxt build + vitest run + isolation check) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/core/context`
- **After every plan wave:** Run the full suite (eslint + prettier + tsc --noEmit + wxt build + vitest run)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {4}-01-01 | 01 | 1 | CTX-01 | — | Budget math is pure/deterministic | unit | `pnpm vitest run tests/core/context/TokenBudget.test.ts` | ❌ W0 | ⬜ pending |
| {4}-01-02 | 01 | 1 | CTX-04 | — | Sections never truncated mid-structure | unit | `pnpm vitest run tests/core/context/ContextOptimizer.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/context/TokenBudget.test.ts` — §2.2 budget math + CJK counting fixtures
- [ ] `tests/core/context/ContextOptimizer.test.ts` — drop-in identity, tier derivation, degradation
- [ ] `tests/core/context/ContextCompressor.test.ts` — §2.4 compression steps

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Message too long" surface copy | CTX-04 | STR copy contract (Appendix B) — copy review | Trigger CONTEXT_TOO_LARGE, verify failed bubble copy matches STR string |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved 2026-08-12}
