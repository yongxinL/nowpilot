---
phase: 04
slug: context-optimization-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.7 |
| **Config file** | vitest.config.ts (environment: jsdom, globals: true, setupFiles: [./tests/setup.ts]) |
| **Quick run command** | `npx vitest run tests/core/context` |
| **Full suite command** | `pnpm run verify:phase-4` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/context`
- **After every plan wave:** Run `pnpm run verify:phase-4`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CTX-01 | — | classifyModelContext returns correct tier for boundary values | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "tier classification"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CTX-01 | — | TokenBudget.allocateBudget returns correct per-section caps | unit | `vitest run tests/core/context/TokenBudget.test.ts -t "budget allocation"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | CTX-01 | — | Degradation pipeline reduces context below budget; provenance records each step | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "degradation pipeline"` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | CTX-01 | — | Minimal mode: only 1 tool schema, top-3 memories, conversation summary ≤200 tokens | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "minimal mode"` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | CTX-01 | — | CONTEXT_TOO_LARGE error thrown when all degradation steps fail | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "context too large"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | CTX-02 | — | Anthropic cache hints: max 4 breakpoints, only stable sections get ephemeral cache | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "anthropic cache hints"` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | CTX-02 | — | Gemini cachedContent when stable tokens ≥ 32,768, else prefix-only | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "gemini cache hints"` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | CTX-02 | — | OpenAI/Ollama: stable-first ordering | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "openai cache hints"` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 2 | CTX-02 | — | FNV-1a hash consistent for identical stable sections | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "cache key hash"` | ❌ W0 | ⬜ pending |
| 04-02-05 | 02 | 2 | CTX-02 | — | Cache auto-disables after 5 consecutive misses; re-enables after 60s cooldown | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "cache health"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/context/ContextOptimizer.test.ts` — tier classification, degradation pipeline, minimal mode, CONTEXT_TOO_LARGE, provenance tracking
- [ ] `tests/core/context/TokenBudget.test.ts` — estimateTokens (char heuristics + CJK detection), allocateBudget for all 4 tiers, optional countTokens()
- [ ] `tests/core/context/PromptCacheManager.test.ts` — applyCacheHints for all 4 providers, FNV-1a hash, cache health (miss streak, cooldown, auto-disable), recordResponse
- [ ] `tests/core/ai/integration.test.ts` — extend existing Phase 3 integration test for ContextOptimizer → PlannerService → RendererService pipeline

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Persona change invalidates cache (Pitfall 4) | CTX-02 | Requires persona settings change + full API call | Change persona settings mid-conversation; verify next turn generates new cache key (cache miss logged) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
