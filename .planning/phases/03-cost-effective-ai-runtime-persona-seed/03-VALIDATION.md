---
phase: 3
slug: cost-effective-ai-runtime-persona-seed
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `pnpm vitest run tests/core/ai --passWithNoTests` |
| **Full suite command** | `pnpm run verify:phase-3` (eslint + prettier + tsc --noEmit + wxt build + vitest run + isolation check) |
| **Estimated runtime** | ~60 seconds (build-dominated; vitest ~20 s) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/core/ai --passWithNoTests`
- **After every plan wave:** Run `pnpm run verify:phase-3`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-10-01 | 10 | 1 | AI-04 | T-03-10 / — | R-2 budget scoped to router-owned retries only; legitimate stage calls never consume retry budget | unit | `pnpm vitest run tests/core/ai --passWithNoTests` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/ai/ProviderRouter.test.ts` — extend with retry-scoped budget regression tests for CR-01/WR-02/WR-03
- [ ] `tests/components/pages/ChatPage.test.tsx` — extend with per-bubble retry targeting tests for WR-04

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live streaming chat with a real provider | AI-03 | Real-time streaming feel, visual appearance, and scroll behavior are not observable in jsdom | Configure a provider in Settings, open Side Panel chat, send a message, confirm incremental caret stream and plain-text completion |
| Tool-loop turn on the default medium tier (CR-01) | AI-04 | The R-2 budget defect is unit-reproduced; live conversation confirms the user-visible impact | Run a 2-tool turn on medium tier; expect an answer (post-fix), not a no_candidate provider-failure bubble |
| Planner timeout behavior (WR-03) | AI-04 | Requires a real slow provider; AbortError→idle mapping is visible only live | Trigger a planner timeout and confirm the intended failed/offline surface, not silent idle |
| Multi-provider gate (WR-01) | AI-01 | The gate bug is latent in unit tests; only a real multi-provider configuration exercises it | Configure openai (healthy) + ollama (disabled/unreadable) and confirm the chat remains usable |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
