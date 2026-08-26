---
phase: 3
slug: cost-effective-ai-runtime-persona-seed
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.0 (globals enabled, jsdom) |
| **Config file** | vitest.config.ts (jsdom, setup tests/setup.ts with chrome storage/session mocks, BroadcastChannel, ResizeObserver, matchMedia) |
| **Quick run command** | `pnpm run verify:phase-3` |
| **Full suite command** | `pnpm run verify:all` (tsc --noEmit && vitest run && pnpm run lint) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run verify:phase-3` (tsc + scoped vitest)
- **After every plan wave:** Run `pnpm run verify:phase-3`
- **Before `/gsd-verify-work`:** Full suite must be green (`pnpm run verify:phase-3` + full gate)
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | RICH-R-01 | T-3-01 / — | PersonaProfile schema + DEFAULT_PERSONA verbatim fields | unit | `vitest run tests/core/ai/persona/PersonaProfile.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | RICH-R-02, RICH-R-10 | T-3-02 / — | PersonaInjector data-merge + persona-first prepend + byte-stability | unit | `vitest run tests/core/ai/persona/PersonaInjector.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | (DONE-when) | T-3-03 / — | Planner closed toolName enum | unit | `vitest run tests/core/ai/PlannerService.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | (DONE-when) | T-3-03 / — | Executor TOOL_REJECTED | unit | `vitest run tests/core/ai/ExecutorService.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | (DONE-when) | T-3-04 / — | Structured-output one-shot repair | unit | `vitest run tests/core/ai/StructuredOutput.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 2 | (DONE-when) | T-3-05 / — | Renderer 512-cap | unit | `vitest run tests/core/ai/RendererService.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | (DONE-when) | T-3-06 / — | Provider fallback + circuit breaker | unit | `vitest run tests/core/ai/ProviderRouter.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | REQ-R09 | T-3-07 / — | Per-provider SSE conformance (OpenAI [DONE] / Anthropic events / Gemini inline / Ollama) | unit (fixtures) | `vitest run tests/core/ai` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 4 | RICH-R-09 | T-3-08 / — | AgentOrchestrator tier caps + abort + ask_clarification; chat share persona | unit | `vitest run tests/core/ai/AgentOrchestrator.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 4 | (DONE-when) | T-3-08 / — | Chat switches to pipeline (D-44); turn-end persist (D-45) | unit | `vitest run tests/core/ai` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/ai/PlannerService.test.ts` — covers §1.2 PlannerDecision + repair path
- [ ] `tests/core/ai/ExecutorService.test.ts` — covers TOOL_REJECTED (D-46)
- [ ] `tests/core/ai/RendererService.test.ts` — covers 512-token cap
- [ ] `tests/core/ai/AgentOrchestrator.test.ts` — covers tier caps + abort + ask_clarification (Appendix I)
- [ ] `tests/core/ai/ProviderRouter.test.ts` — covers §20.10 retry/fallback/circuit-breaker
- [ ] `tests/core/ai/StructuredOutput.test.ts` — covers one-shot repair (Appendix L)
- [ ] `tests/core/ai/persona/PersonaProfile.test.ts` — RICH-R-01
- [ ] `tests/core/ai/persona/PersonaInjector.test.ts` — RICH-R-02/09/10
- [ ] `tests/core/ai/fixtures/` — D-48 golden matrix (normal, provider failure, fallback, invalid JSON, repair success/failure, unknown tool, persona override, abort, cancellation); SSE conformance fixtures per provider (REQ-R09)
- [ ] Framework install: `pnpm install` (node_modules absent) then `pnpm add zod-to-json-schema`
- [ ] Verify tests/setup.ts exposes `__chromeStorageMap` for `np_preferences`/`np_endpoint_overrides` tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live SSE streaming against a real provider (OpenAI/Anthropic/Gemini/Ollama) | REQ-R09, DONE-when | Provider wire formats are fixture-tested; live end-to-end requires operator API keys | Connect a real provider in Options, send a chat message, confirm streamed tokens render with no empty response |
| Prompt-cache header observation (anthropic-ephemeral ≤4 breakpoints) | DONE-when | Requires a billing-visible provider account | Send repeated turns with unchanged [SYSTEM]; confirm cache_read_tokens increments on the provider dashboard |
| Persona override via Options UI | DONE-when | Needs the Options surface (Phase 15 owns persona UI; overrides apply via UserPreferences without code change) | Set fast/balanced model assignment in Options; confirm TierResolver routing reflects it |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending