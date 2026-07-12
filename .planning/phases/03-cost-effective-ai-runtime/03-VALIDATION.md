---
phase: 3
slug: cost-effective-ai-runtime
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom |
| **Config file** | `vitest.config.ts` (existing from Phase 2) |
| **Quick run command** | `npx vitest run tests/core/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | PROV-01 | — | ProviderRegistry persists to chrome.storage.local and loads into in-memory cache at startup | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | PROV-02 | — | Capability-based model discovery for all providers (Ollama /api/tags, OpenAI-compatible /v1/models) | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | PROV-03 | — | API keys encrypted via EncryptedStorage; provider config changes write through WriteJournal | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | PROV-04 | — | User can add, edit, and remove provider configurations | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | PROV-05 | — | ProviderRouter selects highest-priority model matching requested tier, follows fallback chain on failure | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | PROV-06 | — | Circuit breaker opens after 3 consecutive failures in 60s; 5-min cooldown before half-open probe | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | PROV-07 | — | Retry only pre-first-token for retryable errors; after first token streamed, errors surfaced to UI | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AIRN-01 | — | PlannerService returns valid JSON decisions with closed toolName enum within 3s timeout | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AIRN-02 | — | ExecutorService rejects unknown tool names and validates inputs/outputs against Zod schemas | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AIRN-03 | — | AgentOrchestrator enforces tier caps (planner: 1–5, tools: 1–3) | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AIRN-04 | — | StructuredOutput one-shot JSON repair handles truncated/malformed planner output | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AIRN-05 | — | ChunkBuffer delivers rAF-batched streaming text; tool/planner events passthrough immediately | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AIRN-06 | — | AbortSignal propagates through full Planner→Executor→Renderer chain via parent+child signal model | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AIRN-07 | — | Prompt caching configured per provider via AI SDK providerOptions (Anthropic, OpenAI, Gemini) | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AIRN-08 | — | PermissionService interface with default-deny; ExecutorService calls before tool execution | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | AIRN-09 | — | TimeoutConfig with staged recovery: Planner 3s (one-shot repair), Executor 10s, Renderer 5s (partial text) | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | CROSS | — | AI SDK v4 API calls use `tool({ parameters })` not `inputSchema`; no `generateObject` usage in Planner | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/providerRegistry.test.ts` — PROV-01 registry persistence and cache
- [ ] `tests/core/modelDiscovery.test.ts` — PROV-02 capability-based discovery
- [ ] `tests/core/providerStore.test.ts` — PROV-03, PROV-04 config management + encryption
- [ ] `tests/core/providerRouter.test.ts` — PROV-05, PROV-06, PROV-07 routing, circuit breaker, retry
- [ ] `tests/core/plannerService.test.ts` — AIRN-01 planner JSON decisions + timeout
- [ ] `tests/core/executorService.test.ts` — AIRN-02 tool validation + rejection
- [ ] `tests/core/agentOrchestrator.test.ts` — AIRN-03 tier caps, AIRN-06 abort propagation
- [ ] `tests/core/structuredOutput.test.ts` — AIRN-04 JSON repair
- [ ] `tests/core/chunkBuffer.test.ts` — AIRN-05 streaming batching
- [ ] `tests/core/promptCache.test.ts` — AIRN-07 per-provider cache hints
- [ ] `tests/core/permissionService.test.ts` — AIRN-08 default-deny permission checks
- [ ] `tests/core/timeoutConfig.test.ts` — AIRN-09 staged recovery
- [ ] `tests/core/aiSdkV4Compat.test.ts` — CROSS AI SDK v4 API compatibility

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provider connection validation with real endpoints | PROV-03 | Requires live API credentials | Enter valid/invalid API keys, verify connection status |
| Streaming visual rendering with rAF batching | AIRN-05 | Requires browser rendering verification | Observe text rendering smoothness in sidepanel |
| Circuit breaker visual indicator in provider settings UI | PROV-06 | Requires UI state verification | Force 3+ failures, verify breaker indicator shows "Open" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
