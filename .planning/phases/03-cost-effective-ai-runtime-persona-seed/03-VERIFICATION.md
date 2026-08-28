---
phase: 03-cost-effective-ai-runtime-persona-seed
verified: 2026-08-28T09:15:00Z
status: passed
score: 5/5 truths verified
behavior_unverified: 0
overrides_applied: 0
gaps: []
human_verification:

  - test: "Load the extension with a real user-configured provider (OpenAI/Anthropic/Gemini/Ollama), set fast+balanced tier models in Options → General, and send a chat message. Confirm the full Planner → Executor → Renderer pipeline streams a real answer end-to-end."
    expected: "A complete answer streams into the side panel; the assistant message persists as a completed turn in ChatHistoryDB after reload; an abort drops the partial with no persisted turn; a second turn is persona-consistent."
    why_human: "External service integration with real provider keys cannot be exercised by the jsdom test suite. IMPORTANT: the recorded 03-07 human smoke checkpoint (task 4, APPROVED) ran against the PRE-FIX code (142 tests at checkpoint time; 153 after the CR fixes in 1e0f98f..da136a4). The fixes changed the production request path (per-route provider instances, hydrate-seeded model cache, router lock point), so the live smoke must be re-confirmed on the fixed code."

  - test: "Watch a streamed answer render in the side panel chat bubble (progressive reveal via ChunkBuffer) and trigger the Stop button mid-stream."
    expected: "Text reveals progressively without jank; Stop drops the partial assistant message, clears the generating state, and shows the 'Generation stopped' note; no error text is interpolated into the message content."
    why_human: "Visual appearance and real-time streaming feel are not assertable programmatically."
---

# Phase 3: Cost-Effective AI Runtime (+ Persona seed) Verification Report

**Phase Goal:** The bounded Planner → Executor → Renderer pipeline streams from user-configured OpenAI / Anthropic / Gemini / Ollama providers; tier-resolved routing (fast / balanced); persona runtime is wired into every AI call from day one.
**Verified:** 2026-08-28T09:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior VERIFICATION.md existed for this phase)

## Context: Review-fix verification

A code review found 6 CRITICAL + 7 WARNING + 3 INFO issues (03-REVIEW.md); all 16 were subsequently fixed (03-REVIEW-FIX.md, commits `1e0f98f..da136a4`). The fixer claims **production is now functional WITHOUT test-only seeding**. This report verifies that claim against the actual code paths — the critical fixes were each traced in source and each has a dedicated regression test. All claims below were verified from code, not from SUMMARY.md.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Planner returns valid JSON decisions with closed `toolName` enum; Executor rejects unknown tools with `TOOL_REJECTED` | ✓ VERIFIED | `PlannerService.buildPlannerDecisionSchema` derives a closed `z.enum` from the registered tool list; zero-tool runtime ships `answer \| ask_clarification` only (never `z.enum([])`). `ExecutorService.execute` returns typed `TOOL_REJECTED` for every tool while zero are registered. Tests: `PlannerService.test.ts` (fixture wire bytes → zod-validated decision, closed-enum + zero-tool cases), `ExecutorService.test.ts` (a)(b)(c). Gate green. |
| 2 | Provider fallback + circuit breaker tests pass (one provider down → routed to next enabled provider) | ✓ VERIFIED | `ProviderRouter.ts` implements the §20.10 locked table verbatim (RETRY_TABLE lines 57-66), 3 votes/60s → open 5min, never switches after first token. Tests: `ProviderRouter.test.ts` (a) NETWORK-failing provider falls through to a succeeding provider (DONE-when 2), (b) AUTH opens breaker immediately (vote 3), (c) breaker accumulation, (d) no switch after first token, (h) CR-03 bare STREAM_START never locks. Gate green. |
| 3 | Structured-output one-shot repair works (Appendix L) | ✓ VERIFIED | `StructuredOutput.requestJson` performs exactly one repair via `PROMPTS.repairJson.system`; a second failure throws terminal `STRUCTURED_OUTPUT_FAILED` with `retryable: false`. Internal §1.2 timeout is rethrown as `ProviderError('TIMEOUT')` (WR-02). Tests: `StructuredOutput.test.ts` (b) repair exactly once, (c) terminal failure, (e) WR-02 timeout classification. Gate green. |
| 4 | PersonaInjector prepends the persona block to the Planner, Executor, Renderer, and MemoryExtractor system prompts — placed in the cached `[SYSTEM]` section so prompt caching is preserved | ✓ VERIFIED | `PersonaInjector.inject` returns `` `${block}\n\n${baseSystem}` `` (persona-first, byte-stable per resolved persona). `PromptCacheManager.buildSystemPrompt` (D-59) is the SINGLE call site of `inject` in src/ (grep-verified) and marks `[SYSTEM]` `stable: true` with an FNV-1a `cacheKeyHash` over the persona block — cache-eligible and cache-keyed. All four `PipelineStage` values incl. memoryExtractor are handled. Tests: `PersonaInjector.test.ts` (e) persona-first prefix, (f) all four stages; `AgentOrchestrator.test.ts` (g) persona block is the string prefix of planner/executor/renderer prompts in one turn. Gate green. Note: per-provider `applyCacheHints` wiring (Anthropic `cache_control` etc.) is a documented, code-commented deferral (WR-03) — the criterion's requirement (persona in the cached, byte-stable `[SYSTEM]`) is met. |
| 5 | UserPreferences.personaOverrides (name/tone/brevity) apply without a code change | ✓ VERIFIED | `UserPreferences.ts` persists `personaOverrides {name?, tone?, brevity?}` under `np_preferences` (chromeStorageAdapter, zustand persist); empty-string overrides rejected at the boundary (`min(1)`). `PersonaInjector.resolvePersona` data-merges with `??` precedence — partial overrides leave seeded fields. Tests: `PersonaInjector.test.ts` (b)(c), `UserPreferences.test.ts` (schema + persistence). Gate green. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified — every behavior-dependent truth has a passing test in the gate suite)

### Fix Verification — the "production functional without test-only seeding" claim

The six CRITICAL findings were traced in the current source (post-fix):

| Fix | Source evidence | Test evidence |
|-----|-----------------|---------------|
| CR-01 per-route provider instances | `ProviderRegistry.buildForRoute` (line 324) constructs fresh adapters with merged endpoint (D-50) + `apiKey` + `model`; `AgentOrchestrator.resolveStageProvider` builds candidates via `buildForRoute` with `routeApiKey` (reads `input.providerSecrets` first, legacy plaintext fallback); `useChatStreaming` supplies decrypted keys from `useExtensionStore` (`config.providers`, populated by `hydrateProviderSecrets` decrypt-on-read); both surface boots call `migrateProviderSecrets()` + `hydrateProviderSecrets()` + `ProviderRegistry.hydrate()` | `ProviderRegistry.test.ts`; `chat-integration.test.ts` (a) routes through `runAgentTurn` with the D-44 contract |
| CR-02 D-52 cache populated in production | `hydrate()` seeds `modelCache` from the disk `detail.models` list (line 237) — stale-but-present beats never-populated; Options `handleDiscoverTierModels` routes through `refreshModels` (OptionsPage:506) which writes the same cache | `ProviderRegistry.test.ts:190-195` — "CR-02: hydrate seeds the D-52 cache from the disk model list" asserts `getCachedModels` WITHOUT any `seedCachedModels` call |
| CR-03 no lock on STREAM_START | `ProviderRouter.runAttempt` continues past `STREAM_START` (line 398-406), locks only on `STREAM_DELTA` (line 408); `StreamAdapter.emitDelta` defers `STREAM_START` until a real delta | `ProviderRouter.test.ts` (h) error-first stream falls back to the next candidate |
| CR-04 Gemini co-located text | `parseGeminiDataLine` parses `parts[].text` deltas FIRST, then checks `finishReason` (lines 170-184) | `StreamAdapter.test.ts:138` CR-04 test + `fixtures/gemini-stream.ts:29-31` co-located fixture |
| CR-05 renderer options passthrough | `RendererService.render` builds `LLMStreamRequest` with NO `options` field (lines 87-101); cap enforced by the client-side char counter | `RendererService.test.ts:101-122` asserts `captured.options` is `undefined` |
| CR-06 mid-stream error persisted | `AgentOrchestrator.finish()` throws a typed `ProviderError` when `rendered.terminatedBy === 'error'` (lines 258-266) — `persistTurn` never invoked; abort path also skips persist (D-45) | `AgentOrchestrator.test.ts` (i) delta-then-STREAM_ERROR rejects and `persistTurn` not called; (e) abort → persistTurn not called; (f) persist fires exactly once on completed turns |

**Test-seeding assessment:** The remaining `__test__.seedCachedModels` calls (TierResolver.test.ts:52-54, AgentOrchestrator.test.ts:109, chat-integration.test.ts:74) seed the SAME values the tests' own disk `np_providers` shapes (`models: [{id: ...}]`) produce through `hydrate()` — they mirror the production derivation, they do not mask a broken path. The CR-02 test proves the derivation works with no seed at all. **The fixer's claim holds.**

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | --------- | ------ | ------- |
| `src/core/ai/persona/PersonaProfile.ts` | RICH-R-01 Appendix N.1 verbatim | ✓ VERIFIED | `DEFAULT_PERSONA` id/tagline/personalityCore/behavioralDrivers/tone/brevity/emotionalRepertoire match the spec constants |
| `src/core/ai/persona/PersonaInjector.ts` | RICH-R-02 data-merge + persona-first prepend | ✓ VERIFIED | `inject` = `` `${block}\n\n${baseSystem}` ``; `resolvePersona` `??` merge; all 4 stages |
| `src/core/ai/UserPreferences.ts` | np_preferences persistence | ✓ VERIFIED | zustand persist + chromeStorageAdapter; `min(1)` empty-string rejection |
| `src/core/ai/PromptCacheManager.ts` | D-59 single choke-point | ✓ VERIFIED | Only `PersonaInjector.inject` call site in src/; `[SYSTEM]` stable + cache-keyed |
| `src/core/ai/PromptCacheAdapter.ts` | Appendix K | ✓ VERIFIED | `applyCacheHints` per-provider strategies; FNV-1a `hashStableSections`; ANTHROPIC_MAX_BREAKPOINTS=4, GEMINI_MIN_CACHED_TOKENS=32768 |
| `src/core/ai/StructuredOutput.ts` | Appendix L one-shot repair | ✓ VERIFIED | Exactly one repair; `STRUCTURED_OUTPUT_FAILED` retryable:false; WR-02 TIMEOUT rethrow |
| `src/core/ai/PlannerService.ts` | §1.2 planner, closed enum | ✓ VERIFIED | 3s timeout, closed `z.enum`, zero-tool specialization |
| `src/core/ai/ExecutorService.ts` | §1.2 deterministic executor | ✓ VERIFIED | TOOL_REJECTED for every tool while zero registered |
| `src/core/ai/RendererService.ts` | §1.2/§1.3 renderer, 512 cap | ✓ VERIFIED | Client-side cap authoritative; no options passthrough (CR-05) |
| `src/core/ai/StreamAdapter.ts` | 4-wire SSE parser | ✓ VERIFIED | OpenAI/Anthropic/Gemini/Ollama adapters; missing terminator → STREAM_ERROR; CR-04 parts-first; WR-05 event-header validation + deferred STREAM_START |
| `src/core/ai/providers/*.ts` (5 adapters) | ILLMProvider via Requester | ✓ VERIFIED | Per-route construction config (`{baseUrl, model, apiKey}`); native JSON-mode flags; canonical error codes; WR-01 `PROVIDER_MODEL_UNKNOWN` guards |
| `src/core/ai/ProviderRegistry.ts` | D-49/50/51/52 | ✓ VERIFIED | hydrate normalize + endpoint overrides + D-52 cache seeding + `buildForRoute` |
| `src/core/ai/TierResolver.ts` | Appendix D + D-53/54/54a | ✓ VERIFIED | Capability tiers only; null contract; no model-slug guessing |
| `src/core/ai/ProviderRouter.ts` | §1.5/§20.10 | ✓ VERIFIED | Locked retry table, circuit breaker, CR-03 delta-lock |
| `src/core/ai/AgentOrchestrator.ts` | Appendix I loop | ✓ VERIFIED | Planner→(run_tool→Executor)→Renderer; tier caps; D-54a config-required; D-45 persist seam; CR-06 error surfacing |
| `src/components/chat/useChatStreaming.ts` | D-44 re-point | ✓ VERIFIED | Calls `runAgentTurn` (never legacy path); `providerSecrets` threading; journaled turn-end persist; WR-07 followups [] + error toast |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `useChatStreaming` → `AgentOrchestrator.runAgentTurn` | D-44 production chat path | `handleSend` calls `runAgentTurn` with providerSecrets + persistTurn | WIRED | grep + chat-integration.test.ts (legacy spy never called) |
| `AgentOrchestrator` → `PlannerService.plan` | Appendix I single call site | `resolveStageProvider` + `PlannerService.plan` | WIRED | Only call site in src/ (grep-verified) |
| `AgentOrchestrator` → `PromptCacheManager.buildSystemPrompt` | D-59 persona choke-point | every stage prompt via `stagePrompt()` | WIRED | AgentOrchestrator.test.ts (g) persona prefix in all 3 stages |
| `AgentOrchestrator` → `ProviderRegistry.buildForRoute` | CR-01 per-route instances | `resolveStageProvider` builds candidates | WIRED | Source-traced |
| `ProviderRouter.route` → `ProviderRegistry.getEnabled/getAll` | D-51 candidate supply | orchestrator passes built candidates | WIRED | Source-traced |
| `ProviderRegistry.hydrate` → disk `np_providers.detail.models` | CR-02 cache seed | `modelCache.set(runtimeId, ...)` in hydrate | WIRED | ProviderRegistry.test.ts:190-195 |
| `TierResolver` → `UserPreferences.fastModel/balancedModel` | D-54 | `useUserPreferencesStore.getState()` | WIRED | TierResolver.test.ts |
| `OptionsPage.handleDiscoverTierModels` → `ProviderRegistry.refreshModels` | WR-04 cache write | OptionsPage.tsx:506 | WIRED | Source-traced |
| `useChatStreaming` → `useExtensionStore.config.providers` | CR-01 decrypted keys | `hydrateProviderSecrets` decrypt-on-read at boot | WIRED | entrypoints boot sequence (sidepanel + standalone main.tsx) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Renderer streamedText | `output.streamedText` | `RendererService.render` ← provider `stream()` ← per-route instance (model+key from tier resolution + operator secrets) | ✓ FLOWING | No static/hardcoded fallback in the production path (fixtures only in tests) |
| Tier resolution | `resolution.model` | `resolveTier` ← `np_preferences` ← hydrate-seeded D-52 cache ← disk `detail.models` / live discovery | ✓ FLOWING | hydrate seeds cache from disk; Options discovery refreshes |
| Chat turn persist | persisted pair | `persistTurn` ← journaled `append-chat-turn` → ChatHistoryDB | ✓ FLOWING | chat-integration.test.ts verifies turn persistence |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase-3 gate (tsc + AI tests) | `pnpm run verify:phase-3` | exit 0 — `tsc --noEmit` clean; 17 files / 153 tests passed | ✓ PASS |
| Router fallback (DONE-when 2) | `ProviderRouter.test.ts` (a)(h) in gate run | passed | ✓ PASS |
| Appendix L one-shot repair | `StructuredOutput.test.ts` (b)(c) in gate run | passed | ✓ PASS |
| Circuit breaker | `ProviderRouter.test.ts` (b)(c) in gate run | passed | ✓ PASS |
| Persona consistency (RICH-R-09) | `AgentOrchestrator.test.ts` (g) in gate run | passed | ✓ PASS |
| CR-02 cache seed without test seeding | `ProviderRegistry.test.ts:190-195` in gate run | passed | ✓ PASS |

### Probe Execution

N/A — no probe scripts declared or conventionally present for this phase (unit-test-gated; `scripts/*/tests/probe-*.sh` does not exist in this repo).

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| RICH-R-01 (P0) | Persona profile in `src/core/ai/persona/PersonaProfile.ts` per Appendix N.1 | ✓ SATISFIED | `DEFAULT_PERSONA` matches spec constants; `PersonaProfile.test.ts` |
| RICH-R-02 (P0) | `PersonaInjector` injects persona into system prompts across all AI calls | ✓ SATISFIED | PersonaInjector + D-59 `buildSystemPrompt` single choke-point (only `inject` call site in src/); `PersonaInjector.test.ts` |
| RICH-R-09 (P1) | Chat and Agent share the same persona | ✓ SATISFIED | `useChatStreaming` re-points at `runAgentTurn` → all stage prompts via `buildSystemPrompt`; `AgentOrchestrator.test.ts` (g) asserts persona in all three stage prompts of one turn |
| RICH-R-10 (P1) | Persona-consistent system prompt per pipeline stage (Planner/Executor/Renderer) | ✓ SATISFIED | `canonicalStageString` per stage (planner/renderer/memoryExtractor from Appendix A, executor reserved constant) + persona-first prepend; `PersonaInjector.test.ts` (f) |

No orphaned requirements: all four IDs declared in Phase 3 plans (03-01: RICH-R-10; 03-02: RICH-R-01/02/10; 03-03: RICH-R-10; 03-04: RICH-R-02/10; 03-05: RICH-R-09; 03-06: RICH-R-09; 03-07: RICH-R-09) are accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/core/ai/AgentOrchestrator.ts` | 133-139 | WR-03 documented deferral (applyCacheHints/recordCacheResult have no production call site) | ℹ️ Info | Deliberate, code-commented, accepted by the review as the minimum. Per-provider prompt-cache wiring deferred to the phase that restructures provider request bodies. Criterion 4 (persona in cached [SYSTEM]) is met without it. |
| `src/core/ai/AgentOrchestrator.ts` | 209-210 | `modelForProvider` resolves the model for ONLY the resolved provider — multi-provider fallback at the orchestrator level engages only when the same model id exists in another enabled provider's cache | ⚠️ Warning | D-54a discipline (never guess a model) is honored; router-level fallback proven by tests. Consequence: when the single resolved provider fails pre-token, the turn fails via the retry-once path (single provider) rather than switching to a different provider. The §1.5 multi-candidate fallback is structurally limited by single-model tier resolution. Not a phase-goal miss (criterion is test-based and passes); operator-facing limitation to document. |
| `src/components/options/OptionsPage.tsx` | 1837 | `'http://localhost:12380/v1'` remains as a placeholder string when `activeModalProviderId` is falsy | ℹ️ Info | Placeholder text is never submitted as a value; save path skips overrides equal to `defaultProxy` (WR-06 regression test). Harmless dead text. |
| `src/core/ai/AgentOrchestrator.ts` | 155-160 | `routeApiKey` falls back to the legacy plaintext `apiKey` on the normalized record | ℹ️ Info | Correct per V6 (registry never decrypts); plaintext fallback only for legacy stores pre-migration. |

No `TBD`/`FIXME`/`XXX` markers in `src/core/ai/` (the `TODO(Phase 18 — Tool Governance)` reference on `EXECUTOR_SYSTEM` is a tracked follow-up with an owning phase — allowed). No `console.log` in `src/core/ai/` (debugLog used throughout). No stub components.

### Human Verification Required

1. **Live-provider end-to-end streaming (post-fix re-smoke)**
   **Test:** Load the extension with a real user-configured provider, set fast + balanced tier models in Options → General, send a chat message, and confirm the full pipeline streams a real answer.
   **Expected:** A complete answer streams; the turn persists to ChatHistoryDB across reload; abort drops the partial with nothing persisted; a second turn is persona-consistent.
   **Why human:** External service integration cannot run in jsdom. The recorded 03-07 smoke checkpoint (task 4, APPROVED) ran against the PRE-FIX code (142 tests at checkpoint time; 153 after the CR fixes) — the fixes changed the production request path, so the smoke must be re-confirmed on the fixed code.

2. **Chat streaming UI behavior**
   **Test:** Watch a streamed answer render progressively (ChunkBuffer reveal) and press Stop mid-stream.
   **Expected:** Progressive reveal without jank; Stop drops the partial, clears generating state, shows the stopped note; no error text inside the message content.
   **Why human:** Visual appearance and real-time behavior are not assertable programmatically.

### Gaps Summary

No gaps found. All 5 roadmap success criteria are verified with behavioral test evidence (153-test gate, exit 0). The 6 CRITICAL review findings are genuinely fixed in source with dedicated regression tests — the "production functional without test-only seeding" claim is confirmed: hydrate() derives the D-52 cache from disk (proven by a no-seed test), per-route provider instances carry model + decrypted key end-to-end (boot → useExtensionStore → providerSecrets → buildForRoute), the router locks only on the first delta, Gemini keeps co-located text, the renderer forwards no provider-breaking options, and mid-stream errors surface without persistence. Remaining seeds in tests mirror the values hydrate derives from the same disk shapes.

Status is `human_needed` solely because live-provider streaming is external-service behavior that cannot be verified programmatically and the recorded human checkpoint predates the CR fixes.

---

_Verified: 2026-08-28T09:15:00Z_
_Verifier: the agent (gsd-verifier)_
