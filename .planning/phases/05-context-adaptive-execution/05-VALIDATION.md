---
phase: 5
slug: context-adaptive-execution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.7 (jsdom environment, globals, `tests/setup.ts`) + `tsc --noEmit` |
| **Config file** | `vitest.config.ts` (jsdom, globals, setupFiles `./tests/setup.ts`, `@` alias → `src`) |
| **Quick run command** | `npx vitest run tests/core/context` |
| **Full suite command** | `pnpm run verify:phase-5` (after D-78 re-point) / `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/context` (targeted file) + `pnpm run lint` (`tsc --noEmit` strict-clean)
- **After every plan wave:** Run `pnpm run verify:phase-5` (D-78 re-pointed) + `pnpm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

No requirement IDs (infra phase) — the map targets the §18 DONE-when criteria + the three required files:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | DONE-1 | — | Tier classification boundaries + budget math | unit | `npx vitest run tests/core/context/TokenBudget.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-01 | 01 | 1 | DONE-1 | — | Budget formula 70/20/10 + dynamic distribution sums to 100 | unit | `npx vitest run tests/core/context/TokenBudget.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | DONE-2 | T-05-01 / — | Overflow degrades stepwise in §2.4 order; never oversized; `truncatedSources` derived | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | DONE-2 | T-05-01 / — | CONTEXT_TOO_LARGE terminal returned (never thrown), message present | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | DONE-3 | T-05-02 / — | `isFeatureAllowedInMinimalMode` asserts §2.5 blocked/allowed lists verbatim | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | DONE-3 | — | tiny tier → minimalMode always true; minimal mode is penultimate degradation step | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | DONE-4 | T-05-03 / — | Every OptimizedContext carries a §2.6-verbatim manifest; compressionApplied recorded | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` + `ContextCompressor.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | D-75 | — | structural / topk / tool-trim strategies pure; summarizer seam falls back to drop-not-silence | unit | `npx vitest run tests/core/context/ContextCompressor.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | D-76 | — | ContextPack preserves §1.3 order + totalTokens = Σ section tokens | unit | (via ContextOptimizer.test.ts — pack is exercised through assemble) | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | D-78 | — | `verify:phase-5` re-pointed and GREEN | gate | `pnpm run verify:phase-5` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/context/TokenBudget.test.ts` — DONE-1 (tier boundaries + budget math + distribution)
- [ ] `tests/core/context/ContextOptimizer.test.ts` — DONE-2/3/4 (degradation ladder, CONTEXT_TOO_LARGE terminal, minimal-mode predicate verbatim, manifest-on-every-context)
- [ ] `tests/core/context/ContextCompressor.test.ts` — D-75 (structural/topk/trim strategies + summarizer-seam fallback)
- [ ] `package.json` — re-point `verify:phase-5` to `tests/core/context` (D-78) — currently RED (`No test files found, exiting with code 1`, verified by research run)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live pipeline consumption of OptimizedContext | D-69 (deferred to Phase 7) | Out of phase scope — Phase 5 is standalone-layer only | None in Phase 5 |

All in-phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending