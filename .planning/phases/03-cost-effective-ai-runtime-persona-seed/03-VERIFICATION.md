---
phase: 03-cost-effective-ai-runtime-persona-seed
verified: 2026-08-10T23:16:40Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC3 — usage bounded by tier caps with cheapest-capable routing, provider fallback + circuit breaker; plan truth: cap exhaustion terminates with planner_cap_reached / tool_cap_reached"
    status: failed
    reason: "CR-01 (empirically reproduced): ROUTER_MAX_ATTEMPTS=3 counts EVERY SDK attempt (including legitimate sequential planner stage calls and the final renderer resolution), so a medium-tier turn (default caps 3/2) using the ALLOWED 2 tool calls consumes 3 attempts on the planner loop and the renderer stage resolution throws no_candidate — the renderer never runs and the turn surfaces as a provider-failure state even though every provider call succeeded. A 1-tool turn with a structured-output repair or a router retry also breaks (2 planner attempts + 1 replan = 3, renderer blocked). toolCap beyond 1 is unreachable; the documented *_cap_reached terminals are violated in the integrated path."
    artifacts:
      - path: "src/core/ai/ProviderRouter.ts"
        issue: "createStageInvocation lines 392-394 enforce the R-2 budget as a total per-operation attempt counter; buildCallProviderJsonMode recordAttempt counts every json-mode call (planner, repair, retry) as a budget consumer"
      - path: "src/core/ai/AgentOrchestrator.ts"
        issue: "runTurn finish() → resolveStage('renderer') → createStageInvocation hits the exhausted budget after a legitimate tool loop; the loop's documented terminal contract (planner_cap_reached / tool_cap_reached / answer) is never reached"
    missing:
      - "Scope the R-2 budget to router-owned retries only (e.g. a retryCount separate from the per-stage call ledger), per 03-REVIEW.md CR-01 fix sketch"
  - truth: "Circuit breaker + stream-freeze guard protect the streaming path (§1.5 / D-14: never switch provider after the first token; mid-stream failures vote the breaker)"
    status: failed
    reason: "WR-02: recordFailure() and markStreamedFirstToken() have ZERO production callers — RendererService.render throws STREAM_FAILED without voting the breaker, and hasStreamedFirstToken stays false forever, so the stream_frozen guard can never fire. A provider failing mid-stream accrues no breaker votes and is retried every turn. The 03-05 plan truth 'D-14 confirmed: hasStreamedFirstToken freezes the provider mid-stream … enforced inside the renderer-stage invocation path' is dead code on the only production path that needs it."
    artifacts:
      - path: "src/core/ai/RendererService.ts"
        issue: "catch / non-stop finish branches never call getProviderRouter().recordFailure() or markStreamedFirstToken()"
    missing:
      - "Wire recordFailure() into the STREAM_FAILED catch and markStreamedFirstToken() after the first streamed delta (03-REVIEW.md WR-02 fix sketch)"
  - truth: "ProviderRouter is the first retry layer (D-17): retryable pre-first-token codes (TIMEOUT, PROVIDER_5XX, NETWORK, RATE_LIMITED) get exactly ONE router retry per provider step"
    status: failed
    reason: "WR-03: the per-attempt timeout in StructuredOutput.ts aborts the SAME controller the outer abortSignal propagates into — when the timeout fires, the SDK rejects with AbortError, which classifyProviderError maps to { code: 'UNKNOWN', retryable: false }. TIMEOUT (listed in RETRYABLE_CODES) can never be produced, so the D-17 retry never fires on timeouts; the hook maps the resulting AbortError to a silent 'idle' state — a planner timeout is swallowed with no error surface and no retry, indistinguishable from a user cancel."
    artifacts:
      - path: "src/core/ai/StructuredOutput.ts"
        issue: "setTimeout(() => ac.abort(), ctx.timeoutMs) on the shared per-attempt controller (lines 80-91)"
      - path: "src/core/ai/ProviderRouter.ts"
        issue: "classifyProviderError maps AbortError → UNKNOWN (lines 493-496); timeout-origin aborts are indistinguishable from user aborts"
    missing:
      - "Separate the timeout abort from the user abort signal and surface a timeout-origin error the classifier maps to TIMEOUT (03-REVIEW.md WR-03 fix sketch)"
  - truth: "The D-07/D-21 provider gate is 'any usable provider configured' — both shells gate ChatPage behind hasActiveProvider()"
    status: partial
    reason: "WR-01: hasActiveProvider() checks ONLY the last-registered provider (activeProviderId, last registration wins) instead of any usable provider as its docstring claims. Currently latent in the shipped wiring (no production caller writes an enabled:false envelope and registerActiveProvider has no production callers), but the contract mismatch is real: a stored envelope with enabled:false for the last provider in the fixed openai→anthropic→gemini→ollama registration order would close the entire chat surface despite usable providers. Tests only exercise single/legacy paths."
    artifacts:
      - path: "src/core/ai/ProviderRegistry.ts"
        issue: "hasActiveProvider() lines 184-189 + registerProvider() line 118 (activeProviderId = last registration)"
    missing:
      - "Iterate all provider entries for any enabled + !keyUnreadable provider (03-REVIEW.md WR-01 fix sketch)"
  - truth: "Retry re-sends the last user input through the same runAgentTurn path with a NEW operationId (failed bubble's partial text replaced)"
    status: partial
    reason: "WR-04: ChatPage.handleRetry always operates on prev[prev.length - 1] and re-sends the newest input. After a failure the Sender re-enables; sending a new message then clicking Retry on an OLDER failed bubble (the footer renders on every failed/offline bubble) wipes the NEWEST assistant message and re-runs the newest input — the wrong turn is retried and the current answer is destroyed."
    artifacts:
      - path: "src/components/pages/ChatPage.tsx"
        issue: "handleRetry lines 77-85 targets the last message regardless of which bubble's Retry was clicked"
    missing:
      - "Scope Retry to the latest assistant bubble or track the per-bubble retry target (03-REVIEW.md WR-04 fix sketch)"
human_verification:
  - test: "In a real browser (Chrome), configure a provider in Settings, open the Side Panel chat, send a message, and watch the assistant bubble stream in with the caret."
    expected: "The bubble text grows incrementally (ChunkBuffer rAF pacing), the caret disappears on completion, and the final text renders as plain text. Visual colors match UI-SPEC (user bubble colorPrimaryBg, assistant colorBgContainer + 1px border, name 'NowPilot')."
    why_human: "Real-time streaming feel, visual appearance, and scroll behavior cannot be verified by jsdom tests."
  - test: "With real API keys, exercise a tool-loop turn (or induce a provider failure) on the DEFAULT medium tier and observe the terminal state."
    expected: "Legitimate turns within the tier caps complete with an answer. Per CR-01 the renderer stage currently fails with no_candidate after 2 tool calls — human confirmation of the reported failure is requested before/after the fix."
    why_human: "The R-2 budget defect is empirically reproduced with unit-level seams; a live conversation confirms the user-visible impact."
  - test: "Trigger a planner timeout (slow provider) and observe the UI."
    expected: "Per WR-03 the turn currently returns to a silent idle state (no error, no retry) — confirm whether that matches the intended failed/offline surface."
    why_human: "Timeout behavior depends on a real slow provider; the AbortError → idle mapping is visible only live."
  - test: "Configure multiple providers and mark the last-registered one disabled/unreadable (or trigger a decrypt failure on ollama while openai is configured)."
    expected: "The chat surface should remain usable via the healthy provider (WR-01)."
    why_human: "The gate bug is latent in unit tests; only a real multi-provider configuration exercises it."
---

# Phase 3: Cost-Effective AI Runtime (+ Persona seed) Verification Report

**Phase Goal:** Users can chat with any of four providers through Planner→Executor→Renderer orchestration with streaming, cost guardrails, and persona-aware prompting from day one.
**Verified:** 2026-08-10T23:16:40Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (roadmap Success Criteria — the contract)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | SC1 — User configures any provider (`openai` \| `anthropic` \| `gemini` \| `ollama`, incl. custom OpenAI-compatible baseURL) and converses with it | ✓ VERIFIED | Four adapters + OpenAICompat factory (D-12, id stays `openai`), ollama via OpenAI-compatible endpoint (no @ai-sdk/ollama), ProviderConfigSchema Zod gate, vault→registry wiring (`runAIRuntimeInit` both surfaces), `hasActiveProvider` gate in SidePanelShell + StandaloneShell, ChatPage→hook→runAgentTurn. Tests: ProviderRegistry.test.ts, ProviderRouter.test.ts, shell-gate suites. (WR-01 latent gate mismatch — see gaps) |
| 2   | SC2 — User sees responses stream incrementally in the chat UI (SSE + text via ChunkBuffer) | ✓ VERIFIED | RendererService.streamText → onDelta → hook → ChunkBuffer (rAF flush, 8 kB/s → 33 ms rule) → growing Bubble text (caret, no spinner). Tests exercise deltas BEFORE completion (AgentOrchestrator), ChunkBuffer throttling, hook delta→text flow, ChatPage streaming caret |
| 3   | SC3 — Usage bounded by tier caps + monthly budget; cheapest capable model routed automatically with fallback + circuit breaker | ✗ FAILED | Tier caps (capsForTier 1/1…5/3), cheapest-capable resolveTier, fallback chain, circuit breaker (3 votes/60 s → open 5 min) all implemented and unit-tested — BUT **CR-01 (empirically reproduced)**: the R-2 attempt budget starves the renderer stage on allowed tool-loop turns (no_candidate instead of answer); **WR-02**: breaker/stream-freeze are dead code on the streaming path; **WR-03**: TIMEOUT never classified (silent idle). Monthly aggregate deferred to Phase 6 (documented D-16) — budgetGuard no-op hook present per plan |
| 4   | SC4 — Planner returns validated decisions with a closed toolName enum; Executor rejects unknown tools; Renderer respects output caps; structured output self-repairs once | ✓ VERIFIED | PlannerDecisionSchema closed discriminatedUnion over buildToolNameEnum (run_tool omitted when no tools); ExecutorService TOOL_REJECTED closed-enum gate + dangerous-flag + input-schema gates; RendererService maxTokens 512 (planner/repair 256); StructuredOutput.requestJson exactly ONE repair then STRUCTURED_OUTPUT_FAILED (never a third call, never hand-parsed). Tests: PlannerService/ExecutorService/StructuredOutput/RendererService suites |
| 5   | SC5 — User's persona overrides (name/tone/brevity) apply without a code change | ✓ VERIFIED | np_persona accessor (PersonaProfileSchema-validated, DEFAULT_PERSONA fallback) → resolvePersona merges name/tone/brevity → byte-stable buildPersonaBlock (fixed N.2 template) → contextHelper [SYSTEM] stable section. Test: 'personaOverrides apply WITHOUT a code change'; byte-identical-across-turns hash tests |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/ai/types.ts` | Canonical home: ProviderId/OptimizedContext/PromptSection (R-1) | ✓ VERIFIED | Four-ID enum, §2.3 shapes, ProviderConfigSchema; imports (never re-declares) ModelContextTier/ContextProvenanceManifest/UserPreferences/RetrievedMemory; `src/types/workspace.ts` re-exports ProviderId |
| `src/core/ai/ILLMProvider.ts` | Seam 1: single getAISDKModel factory, only @ai-sdk import site | ✓ VERIFIED | 85 lines, switch over four ids, `compatibility: 'compatible'`, fetch test seam; grep: no other @ai-sdk import in src (all other hits are comments) |
| `src/core/ai/providers/{OpenAI,Anthropic,Gemini,Ollama,OpenAICompat}Provider.ts` | 5 adapters (OpenAICompat = factory, not 5th id) | ✓ VERIFIED | All present; OpenAICompat returns id 'openai' with custom baseURL |
| `src/core/ai/TierResolver.ts` | Cheapest-capable, never invents models, privacyModeFromPrefs (D-13) | ✓ VERIFIED | Appendix D table, resolveTier returns null when no candidate, 'local-only' reserved |
| `src/core/ai/ProviderRegistry.ts` | registerProvider/markProviderKeyUnreadable/hasActiveProvider, dependency-free | ✓ VERIFIED | Present; D-21 unreadable → enabled:false; ⚠️ WR-01 gate checks last-registered only (partial) |
| `src/core/ai/ProviderRouter.ts` | First retry layer, breaker, D-13 gate, F-4/F-5, budgetGuard hook | ✓ VERIFIED (with gaps) | 746 lines, full implementation; ❌ CR-01 budget conflation; ❌ WR-02 breaker dead on streaming path; ❌ WR-03 timeout classification |
| `src/core/ai/{ChunkBuffer,StreamAdapter,PromptCacheAdapter,PromptCacheManager,toolSchemas}.ts` | Deterministic streaming/cache/tool utilities | ✓ VERIFIED | J.1 verbatim ChunkBuffer; StreamAdapter maxRetries:0 + awaits finishReason; FNV-1a hashStableSections; buildToolNameEnum returns null for empty |
| `src/core/ai/{StructuredOutput,PlannerService,ExecutorService}.ts` | L repair-once, closed-schema planner, deterministic executor | ✓ VERIFIED | requestJson 2 attempts max; PlannerService pure (no Router import); ExecutorService closed enum |
| `src/core/ai/{RendererService,AgentOrchestrator}.ts` | Seam-3 streaming renderer, Appendix-I verbatim loop | ✓ VERIFIED (with gaps) | maxRetries 0, finishReason awaited, STREAM_FAILED typed; runAgentTurn D-20 output verbatim, caps enforced; ❌ renderer stage starved by CR-01 |
| `src/core/ai/persona/{PersonaProfile,personaConfig,PersonaInjector}.ts` + `contextHelper.ts` | N.1/N.2 persona pipeline, D-02 context builder | ✓ VERIFIED | Schema + DEFAULT_PERSONA; np_persona accessor (read-only D-10); inject all 4 stages; byte-stable block; OptimizedContext builder (Phase-4 deletion target documented) |
| `src/components/pages/useStreamingLLM.ts` | D-01 co-located hook, contextHelper-only prompt path | ✓ VERIFIED | send/retry/abort, 5-state machine, ChunkBuffer wiring, no np_active_stream writes, abort cancels generation |
| `src/components/pages/ChatPage.tsx` | Bubble/Bubble.List + Sender, 5-state stream machine | ✓ VERIFIED (with gaps) | All states implemented, plain text only, no RICH tokens; ⚠️ WR-04 retry targets newest message |
| `src/components/{sidepanel/SidePanelShell,standalone/StandaloneShell}.tsx` | D-21 gate + single composer both surfaces | ✓ VERIFIED | hasProvider gate + STR.chat.noProvider Alert; Sender inside ChatPage only |
| `src/entrypoints/{sidepanel,standalone}/main.tsx` | runAIRuntimeInit at mount (vault→registry→persona→router), R-3 | ✓ VERIFIED | Both surfaces; decrypt failure → markProviderKeyUnreadable; Router.configure before send |
| `tests/core/ai/**` + `tests/components/pages/**` + `tests/fixtures/optimizedContext.ts` | Full suite (8 §18 = subset marker, P-5) | ✓ VERIFIED | 13 test files + fixture; all pass in gate run |
| `tests/isolation/check-content-bundle.mjs` | R-3 isolation machine-check (content + background SW) | ✓ VERIFIED | Extended token set incl. ai-sdk symbols; clean on built output |
| `package.json` | verify:phase-3 gate + pinned ai-sdk versions | ✓ VERIFIED | Gate = eslint + prettier + tsc + wxt build + vitest run + isolation check (NO count-of-8 assertion); ai@4.3.19, @ai-sdk/openai@1.3.24, @ai-sdk/anthropic@1.2.12, @ai-sdk/google@1.2.22; package-lock.json absent, pnpm-lock pins; no @ai-sdk/ollama |
| `.planning/PRODUCT_SPEC_v0_1.md` | §18 Phase-3 addendum (deviations/extras/corrections) | ✓ VERIFIED | Items (a)-(f) present: onStreamDelta+invocation input-only deviations, D-02 deletion target, +1 files/fixture, P-3 home move, F-4/F-5, P-5 count semantics, P-3b type homes |
| `src/core/error/errorCodes.ts` + Appendix C.2 | Canonical Phase-3 codes both homes | ✓ VERIFIED | TOOL_REJECTED/PERSONA_LOAD_FAILED/STRUCTURED_OUTPUT_FAILED/PLANNER_FAILED/STREAM_FAILED/PROVIDER_AUTH/PROVIDER_MODEL_UNKNOWN/… present in errorCodes.ts AND the C.2 slice |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | -- | ------ | ------- |
| ChatPage.onSubmit | useStreamingLLM.send | handleSend | ✓ WIRED | trimmed + isStreaming guard + bubble append + send(trimmed) |
| useStreamingLLM.send | contextHelper.buildOptimizedContext | import + call | ✓ WIRED | Golden Rule 3: only contextHelper assembles prompts (grep: no PROMPTS import in hook) |
| useStreamingLLM | ProviderRouter.createStageInvocation | StageResolver closure | ✓ WIRED | planner haiku 256 / renderer flash 512, privacyModeFromPrefs, configuredFromRegistry |
| createStageInvocation | getAISDKModel + resolveTier | Seam 1 + Seam 2 | ✓ WIRED | buildInvocation resolves model + closure |
| runAgentTurn | PlannerService/ExecutorService/RendererService | Appendix-I loop | ✓ WIRED | planOnce → execute → finish; onStreamDelta → RendererService.onDelta |
| RendererService.render | streamText (messages[]+providerOptions) | F-5 buildStageMessages | ✓ WIRED | NEVER system:string (grep-verified), maxRetries 0, maxTokens 512 |
| onStreamDelta | ChunkBuffer | hook enqueue | ✓ WIRED | deltas → buffer → setText flush |
| np_persona (Setting) | PersonaInjector | personaConfig accessor (injected provider) | ✓ WIRED | readPersonaPrefs → resolvePersona → buildPersonaBlock |
| personaBlock | contextHelper [SYSTEM] section | buildOptimizedContext | ✓ WIRED | stable:true system-kind section (cache-eligible) |
| [SYSTEM] section | F-5 providerOptions.anthropic.cacheControl | applyCacheHints + buildStageMessages | ✓ WIRED | Router owns application; tests assert messages[] shape with cacheControl |
| vault np_providers.<id> | ProviderRegistry | runAIRuntimeInit decrypt + ProviderConfigSchema | ✓ WIRED | decrypt fail → markProviderKeyUnreadable (D-21, no auto-wipe); registry apiKey-stripped |
| Router.configure | hook send path | getProviderRouter() singleton baseline | ✓ WIRED | configuredProviders + privacyMode before any send |
| PlannerDecisionSchema run_tool | ExecutorService closed enum | buildToolNameEnum | ✓ WIRED | get-provider-info only; TOOL_REJECTED on unknown |
| requestJson | callProviderJsonMode (F-4 sections-in) | Router-constructed closure | ✓ WIRED | sections threaded, one repair, never prompt.split |
| verify:phase-3 | full suite + isolation | package.json script | ✓ WIRED | eslint + prettier + tsc + wxt build + vitest run + check-content-bundle.mjs — ALL PASSED in this verification run |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| ChatPage Bubble text | `text` (hook state) | ChunkBuffer ← onStreamDelta ← streamText | Yes (real SDK stream) | ✓ FLOWING |
| hook persona block | `personaBlock` | readPersonaPrefs ← chrome.storage.local np_persona | Yes (real storage read, schema-validated, DEFAULT_PERSONA fallback) | ✓ FLOWING |
| hook context sections | `sections` | contextHelper (personaBlock + userInput + toolSchemaRefs:[]) | Yes (deterministic builder over real inputs) | ✓ FLOWING |
| registry provider snapshot | `getProviderInfos()` | runAIRuntimeInit vault decrypt | Yes (vault envelopes, apiKey stripped) | ✓ FLOWING |
| ChatPage user bubble content | `messages[].content` | hook send path userInput | Yes (real input) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| verify:phase-3 full gate (eslint + prettier + tsc --noEmit + wxt build + vitest run + isolation) | `pnpm run verify:phase-3` | exit 0 — build 22.9 s; vitest **56 files / 446 tests passed**; `check-content-bundle: 1 content bundle(s) + 1 background SW bundle(s) clean` | ✓ PASS |
| CR-01 reproduction: 3 successful planner calls then renderer resolution (medium-tier allowed 2-tool turn) | temp vitest file (real Router + real budget, generateObject mocked) | **FAILED as expected by review**: renderer resolution threw `PROVIDER_UNAVAILABLE: no_candidate (router attempt budget exhausted)` | ✗ CONFIRMED (temp test removed after run) |
| Seam 1: only ILLMProvider imports @ai-sdk | grep | 0 non-comment matches outside ILLMProvider.ts | ✓ PASS |
| `system: string` never on constructed calls | grep (code inspection) | RendererService/StreamAdapter/ProviderRouter all use messages[]; no `system:` key | ✓ PASS |
| No count-of-8 assertion in gate | grep package.json | verify script has no test-count assertion (P-5) | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (no phase-declared probe scripts) | — | verify:phase-3 gate IS the phase's acceptance mechanism | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| AI-01 | 03-01/03-02/03-09 | ProviderRegistry/Router/TierResolver support four ids + custom baseURL | ✓ SATISFIED | Adapters, D-12 factory, wiring; tests pass (WR-01 latent gate caveat) |
| AI-02 | 03-04/03-06/03-08 | Planner→Executor→Renderer loop with Zod-validated decision | ✓ SATISFIED (partial) | Loop implemented + tested; ❌ CR-01 breaks allowed tool-loop turns at the renderer stage (documented completion precedent: full loop shipped) |
| AI-03 | 03-03/03-06/03-08 | Streaming end-to-end (SSE + text via ChunkBuffer + React UI) | ✓ SATISFIED | RendererService + ChunkBuffer + ChatPage; tests pass |
| AI-04 | 03-05/03-06 | Tier caps + monthly budget (cheapest-capable routing) | ✓ SATISFIED (per recorded scope) | Tier caps + no-op budgetGuard hook ship; monthly aggregate deferred to Phase 6 (D-16 documented in REQUIREMENTS.md); ❌ CR-01/WR-02/WR-03 undermine the cost-governor integration |
| AI-05 | 03-07 | PersonaInjector + prompt pipeline — all AI calls consume an OptimizedContext | ✓ SATISFIED | Persona pipeline + contextHelper; Planner/Renderer take OptimizedContext; no React-side prompt assembly |
| AI-06 | 03-08 | RICH chat surfaces render streamed AI output | ✓ SATISFIED (Phase-3 scope) | Bubble/Sender streaming surface; RICH extras (Prompts/Welcome/…) fenced to Phase 7 per D-03 (documented); visual review → human_verification |
| AI-07 | 03-01 (re-mapped) | MCP client + NowPilotMainServer + MCPRegistry | ✓ ACCOUNTED (deferred) | Re-mapped to Phase 8 (D-06) in REQUIREMENTS.md/ROADMAP.md/§18 addendum — NOT a Phase-3 deliverable |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/core/ai/ProviderRouter.ts | 392-394 | R-2 budget counts legitimate stage calls (CR-01) | 🛑 Blocker | Allowed capped turns fail with no_candidate; toolCap unreachable; documented terminals violated |
| src/core/ai/RendererService.ts | 95-116 | Breaker/stream-freeze wiring missing (WR-02) | ⚠️ Warning | Circuit breaker does not protect the streaming path; §1.5 freeze guard dead code |
| src/core/ai/StructuredOutput.ts | 84 | Timeout aborts shared controller (WR-03) | ⚠️ Warning | TIMEOUT never classified/retried; silent idle on planner timeout |
| src/core/ai/ProviderRegistry.ts | 184-189 | Gate checks last-registered not any-usable (WR-01) | ⚠️ Warning | Latent: multi-provider config could close the whole surface |
| src/components/pages/ChatPage.tsx | 77-85 | Retry rewrites newest message (WR-04) | ⚠️ Warning | Wrong turn retried, current answer wiped |
| — | — | TBD/FIXME/XXX/placeholder markers in phase files | ℹ️ None | 0 matches in all phase-modified source files |

### Human Verification Required

1. **Live streaming chat with a real provider** — configure a provider in Settings, open the Side Panel chat, send a message. Expected: incremental caret stream, correct bubble styling, plain-text completion. Why human: real-time streaming feel, visual appearance, and scroll behavior are not observable in jsdom.
2. **Tool-loop turn on the default medium tier** — confirm the CR-01 failure surface (no_candidate provider-failure bubble after an allowed tool-loop turn) before/after the fix. Why human: the defect is unit-reproduced; live confirmation of the user-visible impact is needed.
3. **Planner timeout behavior** — with a slow provider, confirm whether the turn silently returns to idle (WR-03). Why human: requires a real slow provider; the AbortError→idle mapping is visible only live.
4. **Multi-provider gate** — configure openai (healthy) + ollama (disabled/unreadable envelope) and verify the chat remains usable (WR-01). Why human: latent in tests; only a real multi-provider config exercises it.

### Gaps Summary

The phase delivered nearly all artifacts with high quality — the four-provider runtime, streaming chat surface, persona pipeline, and verify:phase-3 gate all exist, are substantive, are wired, and the full gate passes (56 files / 446 tests). **However, the phase goal is NOT fully achieved**: the phase's own post-summary code review (03-REVIEW.md, untracked, `status: issues_found`) plus this verifier's independent empirical reproduction confirm **CR-01** — a BLOCKER in the flagship deliverable. The R-2 non-multiplying attempt budget (`ROUTER_MAX_ATTEMPTS = 3`) counts every SDK attempt as a budget consumer, so a legitimate medium-tier turn using the allowed toolCap=2 fails at the renderer stage resolution with `no_candidate` (verified: `PROVIDER_UNAVAILABLE: no_candidate (router attempt budget exhausted)`), violating the documented `*_cap_reached` terminal contract and making toolCap>1 unreachable. Three additional wiring defects (WR-02 breaker dead code on the streaming path, WR-03 TIMEOUT never classified, WR-04 retry targeting) and one latent gate mismatch (WR-01) degrade the SC3 cost-governor and chat-surface reliability claims. No fix commits exist after the review; the issues are NOT deferred to any later phase (Phase 3a's scope is trajectory/evidence machinery, not the router budget interplay).

The verify:phase-3 gate passing does NOT contradict these findings — the unit tests mock the StageResolver/seams and never exercise the real Router budget interaction across stages (the AgentOrchestrator suite's `makeResolver` bypasses `createStageInvocation` entirely), which is exactly where CR-01 lives.

---

_Verified: 2026-08-10T23:16:40Z_
_Verifier: the agent (gsd-verifier)_
