# Phase 3: Cost-Effective AI Runtime (+ Persona seed) - Research

**Researched:** 2026-08-09
**Domain:** Vercel AI SDK (ai ^4 + v1-line provider adapters) — four-provider chat runtime, Planner→Executor→Renderer loop, streaming, cost guardrails, persona pipeline
**Confidence:** HIGH (stack/architecture verified against installed `.d.ts`, runtime exports, and a live mock-fetch spike) / MEDIUM (provider cache minimums cited from docs) / LOW (Gemini caching constants assumed)

## Summary

Phase 3 builds the NowPilot AI runtime core on the Vercel AI SDK: four provider adapters (`openai` | `anthropic` | `gemini` | `ollama` plus an OpenAI-compatible custom-baseURL factory) behind the §10.1 `ILLMProvider` contract, a Planner→Executor→Renderer loop (`runAgentTurn`, Appendix I verbatim) with Zod-validated decisions and tier caps, SSE streaming via `streamText` → `StreamAdapter` → `ChunkBuffer` → Ant Design X `Bubble`/`Sender`, cost-effective routing with fallback + circuit breaker (ProviderRouter §1.5), and the persona pipeline (`PersonaProfile` + `PersonaInjector` + byte-stable `np_persona`-sourced persona block prepended into the cached `[SYSTEM]` section). The AI SDK is **not yet installed** (package.json has no `ai`/`@ai-sdk/*`); the plan must add the exact locked versions: `ai@4.3.19` + `@ai-sdk/openai@1.3.24` + `@ai-sdk/anthropic@1.2.12` + `@ai-sdk/google@1.2.22` + `zod-to-json-schema` (^3). **`@ai-sdk/ollama` does not exist on npm (404 verified)** — Ollama uses `createOpenAI` with `baseURL: http://localhost:11434/v1` + `apiKey: 'ollama'` exactly as §10.2 specifies; AGENTS.md §7's `@ai-sdk/ollama ^1` line is stale and needs amendment (planner task).

The critical findings the planner must encode: **(1) `maxRetries` silently defaults to 2 inside ai@4.3.19** (verified in dist) — a hidden 4th retry layer stacked on the ProviderRouter's retry (R-2 violation and real cost multiplier); **every SDK call the Router constructs must pass `maxRetries: 0`**. **(2) `streamText` never throws mid-stream** — its `text`/`usage`/`finishReason` members are Promises to await individually (the ai@4 result is NOT thenable); a UI that consumes `textStream` and never awaits a terminal promise renders silently-truncated text as complete (the #1 streaming mistake). **(3) Provider tests are deterministic via injected `fetch`** — `createOpenAI({ fetch })` is verified working end-to-end (live spike: a mock fetch drove the real adapter to `POST https://mock.local/v1/chat/completions` and produced text); msw ^2.15.0 (already in devDependencies) is the HTTP-level fallback; `vi.mock` of the ai packages is discouraged (loses fidelity — the real SDK running against a fake transport catches maxRetries defaults and wire-shape regressions the mocks would hide). **(4) Provider prompt caches do NOT engage at Phase-3 prompt sizes** — Anthropic's minimum cacheable prompt for Claude Haiku 4.5 is 4,096 tokens (docs cited); Phase-3 planner/renderer prompts are ~300–500 tokens, and Gemini's `cachedContent` needs ≥32,768 (spec constant). The byte-stability discipline and cache-hint *emission* are the testable invariants; live cache hits are a Phase-4+ payoff. The Anthropic cache hint reaches the wire via `providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }` on a `CoreSystemMessage` (verified in the adapter source — `system: string` cannot carry it).

**Primary recommendation:** Install the locked v1-line SDK versions, build `getAISDKModel` as the single factory switch (Seam 1), have ProviderRouter construct `callProviderJsonMode` (Seam 2, D-18) and thread `onStreamDelta` through `runAgentTurn` so RendererService's `streamText` deltas reach ChunkBuffer live (Seam 3, AI-03), and test everything with injected-fetch adapters + the deterministic `tests/fixtures/optimizedContext.ts` builder (D-08).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 [minimal functional chat]:** Phase 3 upgrades the Phase-1 ChatPage skeleton to a real send+stream surface using **Ant Design X `Bubble` + `Sender`** (approved presentation components, §7.2). Streamed text renders via ChunkBuffer (Appendix J.1) + a **co-located hook on the `useStreamingLLM` path** (Phase 7 promotes it to `src/hooks/useStreamingLLM.ts` — documented 3-state lifecycle: skeleton → minimal → full). `AgentModeToggle`/Agent mode stays Phase 7.
- **D-02 [Golden Rule 3 in the UI path]:** The hook sends through `runAgentTurn` with a **hand-built `OptimizedContext` from a core helper** — NOT React-side prompt assembly, NOT a proto-optimizer. A core helper builds the §2.3-shaped context from Phase-3-available inputs (operationId, model, userInput, persona prefs, tool schema refs); Phase 4's ContextOptimizer replaces it. The helper + this addendum are recorded as a **Phase-4 deletion target**.
- **D-03 [fenced out of Phase 3]:** Welcome cards, Prompts, clarification/follow-up chips, persona header, stage indicators, chat-history persistence in the message list, Agent toggle, action panels — all Phase 7.3+. No message-store persistence this phase (ChatHistoryDB consumers land with Phase 7).
- **D-04 [toolSchemas.ts = contract + one tool]:** Phase 3 ships the **`ToolSchemaRef` contract + closed z.enum builder + exactly one safe built-in** — `get-provider-info` (`dangerous: no`, depends only on the Phase-3 ProviderRegistry). This proves the closed-enum + `run_tool` + Executor accept/reject paths end-to-end.
- **D-05 [empty registry rule]:** When zero tools are registered, the PlannerDecisionSchema builder **omits the `run_tool` branch entirely** (avoids `z.enum([])`, which Zod rejects); any stray `run_tool` decision is rejected with **`TOOL_REJECTED`**.
- **D-06 [MCP deferred to Phase 8]:** `MCPClient` (StreamableHTTP), `MCPRegistry`, and `NowPilotMainServer` (12 tools) are **NOT Phase 3** — they are dependency-blocked (PageContentService → 4a, NotesDB → 5, ClipboardHelper → 8) and must ship WITH `ToolCapabilityManifest`/verifiers (Phase 8a, TOL-01…05), never governance-less. **AI-07 is re-mapped to Phase 8** (§18 is authoritative over the REQUIREMENTS.md row; REQUIREMENTS gets a note).
- **D-07 [type seeding — OptimizedContext]:** The `OptimizedContext` interface (matching §2.3 verbatim) and `PromptSection` (Appendix C) are **seeded early in `src/core/ai/types.ts`** (a Phase-3 create-list file) so the runtime signatures compile against the real types. Phase 4's `src/core/context/ContextOptimizer.ts` **imports the types from the AI home** — no second declaration (R-1). `PromptSection` lives in `src/core/ai/types.ts` for the same reason (PromptCacheAdapter is a Phase-3 consumer).
- **D-08 [fixture builder]:** Tests drive Planner/Renderer/Orchestrator from a **`tests/fixtures/optimizedContext.ts`** deterministic, typed builder (D-20/D-21 philosophy: seeded randomness, fixed IDs, edge-parameterized on tier/model/budgets) matching the §2.3 shape. This is a test fixture, NOT a runtime module.
- **D-09 [np_persona accessor]:** Phase 3 ships a **small Setting.ts-backed reader** for the canonical **`np_persona`** key — `PersonaProfileSchema`-validated (Appendix N.1), per-key permissioned via the Phase-2 Setting registry — **injected into PersonaInjector as a config provider (not imported)**. `resolvePersona()` reads `prefs.personaOverrides`; empty/invalid key → **`PERSONA_LOAD_FAILED`** → `DEFAULT_PERSONA` fallback. Satisfies both DONE-when clauses ("personaOverrides apply without a code change") and R-7/R-2 (config in `np_persona`, never the fact store).
- **D-10 [zero-change handoff]:** Read-only this phase. Persona editor (RICH-R-04) = Phase 7; the store *writer* = Phase 5 (`PreferenceMemoryStore`). Phase 5 reads/writes the **same `np_persona` key**, so PersonaInjector is untouched — only the injected provider swaps.
- **D-11 [MemoryExtractor stage]:** `PersonaInjector.inject()` accepts the `memoryExtractor` stage (already in `PipelineStage`, Appendix N.2) and is proven with a **unit test on the injector**; the actual MemoryExtractor call site lands Phase 5.
- **D-12 [OpenAICompatProvider]:** `OpenAICompatProvider.ts` is a **factory/config variant of OpenAIProvider — NOT a 5th `ProviderId`**. It exports a factory (e.g. `createOpenAICompatProvider({ baseURL })`) returning an OpenAI-config provider with `id: 'openai'` + custom `baseURL`. Violating the four-ID rule (§0.2) or the `ProviderConfigSchema` enum is forbidden; Appendix D already maps `deepseek-chat` → `providerId: 'openai'`.
- **D-13 [privacyMode mapping]:** Pure helper **`privacyModeFromPrefs(prefs)` in `TierResolver.ts`**; no new preferences field (no second source of truth). `allowCloudFallbackFromLocal: false → 'prefer-local'`; `true → 'cloud-ok'`; default (no prefs) → `'prefer-local'`. **`'local-only'` is RESERVED** for a future explicit privacy toggle. The §1.5 boolean governs **fallback direction**, not global cloud-disable. The "no silent local→cloud switch" guarantee is enforced in **ProviderRouter** when traversing the fallback chain (never a `resolveTier` filter).
- **D-14 [circuit-breaker state scope]:** `RouterAttemptState.circuitBreakerOpen` + `hasStreamedFirstToken` are **in-memory per-surface** for v0.1 (dies on panel close; no cross-surface race on the single-writer bus). Persistence/sharing revisited in a later phase. One-line ADR decision, not a new mechanism.
- **D-15 [tier caps + routing now, monthly budget → Phase 6]:** Phase 3 enforces the cost governors the spec actually defines: **§1.4 tier caps at AgentOrchestrator** (plannerCap/toolCap/mcpChaining per context tier), **cheapest-capable routing + fallback + circuit breaker** (ProviderRouter §1.5 / TierResolver Appendix D), and the **three non-multiplying retry bounds** (§1.6.1 / R-2). These bound per-turn cost deterministically.
- **D-16 [monthly aggregate deferred]:** The **monthly aggregate budget (AI-04) is deferred to Phase 6** — it is un-enforceable before AITransactionLog/TokenLedger exist and currently un-specified (no rate table, reset semantics, or ledger schema). **Reserve:** an optional **no-op `budgetGuard` hook on ProviderRouter** so Phase 6 wires the ledger pre-flight without a rebuild. **Doc:** Phase 6 ADR to define AI-04; mark AI-04 under-specified in REQUIREMENTS.md.
- **D-17 [retry layering]:** ProviderRouter retry/circuit breaker (§1.5: retryable TIMEOUT/PROVIDER_5XX/NETWORK/RATE_LIMITED; non-retryable AUTH/MODEL_UNKNOWN/SCHEMA_INVALID/HOST_NOT_PERMITTED; breaker = 3 failures in 60s → open 5min) is the FIRST retry layer; never nested (exactly the three §1.6.1 layers). **Code-name reconciliation (Golden Rule 9):** the §1.6.1 shorthand 'AUTH'/'MODEL_UNKNOWN' maps to the canonical C.2 codes `PROVIDER_AUTH` / `PROVIDER_MODEL_UNKNOWN` (see the Phase-3 error-code block below at line ~626) — never invent a third spelling.
- **D-18 [callProviderJsonMode ownership]:** **ProviderRouter constructs `callProviderJsonMode`.** The Router owns provider selection/fallback and holds the ILLMProvider adapter that knows the native JSON flag, so it resolves a per-provider `jsonMode: 'native' | 'prompt'` capability and builds the `StructuredOutputContext` closure over the resolved (providerId, model). **Ollama → `'prompt'`** (model-dependent, §10.2) unless the model advertises native JSON; OpenAI/Anthropic/Gemini → `'native'`.
- **D-19 [prompt-mode fallback]:** `'prompt'` path = prompt-only JSON coercion → **one Appendix L repair** → `STRUCTURED_OUTPUT_FAILED`. Never nested (§1.6.1 / R-2). Consumers stay pure: PlannerService + RendererService just call `requestJson(schema, prompt, ctx)`. Boundary: Router = *how to invoke* JSON mode; StructuredOutput = validate + single repair.
- **D-20 [pre-evidence AgentOrchestrator]:** Phase 3 builds **Appendix I verbatim** — `runAgentTurn` returns the simple `AgentTurnOutput { operationId, streamedText, toolResults, reasonCode }`, no trajectory states, no `CompletionEvidence`, no OutcomeVerifier. **Phase 3a rewires it** with AGT-02 checkpointing / outcome verification. Do NOT build reliability into the Phase-3 orchestrator.
- **D-21 [error-emission half only]:** Phase 3 owns the **error-emission half** of the `PROVIDER_KEY_UNREADABLE` gate: the registry surfaces the typed error on construction/validation (decrypt failure, installSecret cleared, tampered ciphertext — all one state) and **marks the provider disabled** (`enabled: false`, treated as unconfigured). The UI gate wiring (onboarding "configure later", Options re-entry) is Phase 7. **No auto-wipe, no auto-regenerate** (02-CONTEXT D-04 preserved).

### the agent's Discretion

- PromptCacheManager / PromptCacheAdapter (Appendix K) internals: cache-hint transformation per provider, stable-section hashing, when hits/misses surface as debugLog vs silent. Follow Appendix K verbatim where it gives code; leave tuning to research/planning.
- Provider adapter internals (ILLMProvider.chat/getModels/validateConfig/getAISDKModel per §10.1 + Appendix C types) — the ai-sdk wire-up details (e.g. exact `LanguageModel` construction per @ai-sdk package) are the researcher's job.
- StreamAdapter (StreamAdapter.ts) internals: how provider stream chunks normalize to `LLMStreamChunk` before ChunkBuffer.
- Co-located streaming hook placement/naming until Phase 7 promotes it (keep it thin; the fixture-helper path is D-02).
- ChunkBuffer byte-rate throttle constants (Appendix J.1 default 8_000 bytes/s) — keep the reference default unless tests dictate otherwise.

### Deferred Ideas (OUT OF SCOPE)

- **MCP client (StreamableHTTP) + MCPRegistry + NowPilotMainServer (12 tools)** — Phase 8 (D-06); re-maps AI-07. Must ship WITH ToolCapabilityManifest/verifiers (Phase 8a TOL-01…05).
- **Monthly aggregate budget (AI-04 second half)** — Phase 6 with AITransactionLog/TokenLedger; Phase 6 ADR to define rate table, reset semantics, ledger schema, pre-flight block, settings action (D-16). Reserve: no-op `budgetGuard` hook on ProviderRouter.
- **ContextOptimizer / ContextCompressor / ModelContextTier** — Phase 4; Phase 3 seeds the OptimizedContext type + fixture helper, which Phase 4 replaces (D-07/D-08/D-02).
- **Trajectory states / OutcomeVerifier / CompletionEvidence / AGT-04 replan** — Phase 3a; Phase 3 builds Appendix I verbatim (D-20).
- **RICH chat polish** (Welcome, Prompts, clarification/follow-up chips, persona header, stage indicators, chat-history list, Agent toggle, action panels) — Phase 7.3+ (D-03).
- **Persona editor (RICH-R-04) + provider Options dialog + budget cap UI** — Phase 7 Options (D-10).
- **PreferenceMemoryStore / UserMemoryStore / MemoryEngine** — Phase 5; np_persona writer lands there, PersonaInjector untouched (D-10).
- **Circuit-breaker persistence / cross-surface sharing** — future phase; in-memory per-surface for v0.1 (D-14).
- **`privacyMode: 'local-only'` explicit privacy toggle** — future; enum value reserved now (D-13).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | ProviderRegistry, ProviderRouter, TierResolver support 'openai' \| 'anthropic' \| 'gemini' \| 'ollama' with custom baseURL (OpenAI-compatible local) | `getAISDKModel` single factory switch (verified createOpenAI/createAnthropic/createGoogleGenerativeAI signatures); `createOpenAI({ baseURL, compatibility: 'compatible' })` verified for OpenAI-compatible + Ollama-local; Appendix D `resolveTier` verbatim; ProviderConfigSchema §10.3; D-12 OpenAICompat is a factory not a 5th ID; ProviderRegistry extended in place with PROVIDER_KEY_UNREADABLE emission (D-21) |
| AI-02 | Planner→Executor→Renderer loop with Zod-validated PlannerDecision; Planner requests, Executor validates+runs tools | Appendix I `runAgentTurn` verbatim (D-20); `PlannerDecisionSchema` discriminated union + closed z.enum via toolSchemas.ts (D-04/D-05); `generateObject` mode:'auto' native path (D-18) + requestJson one-repair (Appendix L); Executor deterministic — no SDK tool machinery (Pitfall 6, R-4) |
| AI-03 | Streaming works end-to-end (SSE + text via ChunkBuffer + React UI) | `streamText` textStream AsyncIterableStream\<string\> + Promise members (Pitfall 5); StreamAdapter → LLMStreamChunk; ChunkBuffer Appendix J.1 verbatim (8_000 B/s); AntD X Bubble streaming prop + Sender (verified installed 2.9.0 types); requires `onStreamDelta` seam through runAgentTurn (documented deviation — see Architecture Patterns) |
| AI-04 | Tier caps and monthly budget enforce cost guardrails (cheapest-capable routing) | §1.4 caps enforced ONLY by AgentOrchestrator; ProviderRouter fallback+breaker (D-17); `maxRetries: 0` everywhere (verified default 2); **monthly aggregate deferred to Phase 6** (D-16) — Phase 3 ships the no-op `budgetGuard` hook seam |
| AI-05 | PersonaInjector and prompt pipeline ensure all AI calls consume an OptimizedContext | PersonaProfile/PersonaInjector Appendix N verbatim; byte-stable `buildPersonaBlock`; `np_persona` accessor via Setting.ts (key already registered, area 'local'); providerOptions anthropic cacheControl verified as the cache-hint wire path; OptimizedContext + PromptSection seeded in ai/types.ts (D-07); D-02 context helper builds §2.3 shape |
| AI-06 | RICH chat surfaces (Bubble, Sender, Prompts, Welcome, etc.) render streamed AI output | Phase-3 subset ONLY (D-01/D-03): BubbleList + Sender + ChunkBuffer streaming surface; UI-SPEC approved (Bubble streaming caret, error/retry states, offline notice, no-provider gate); Prompts/Welcome/clarification chips fenced to Phase 7 |
| AI-07 | MCP client (StreamableHTTP) + NowPilotMainServer (12 tools) + MCPRegistry work | **Re-mapped to Phase 8** (D-06 — §18 is authoritative); REQUIREMENTS.md gets a note; NOT a Phase-3 deliverable |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider selection / fallback / circuit breaker | API / Backend (core ai layer) | — | ProviderRouter owns routing, retries (`maxRetries: 0`), breaker state, and the D-13 no-silent-local→cloud guarantee; never in UI |
| Structured output (Zod + one repair) | API / Backend (core ai layer) | — | `requestJson` (Appendix L) is a pure core function; the Router owns the per-provider jsonMode capability (D-18) |
| Streaming text delivery | API / Backend (core ai layer) → renderer surface | Browser / Client (ChunkBuffer + hook) | `streamText` lives in RendererService/StreamAdapter (core); ChunkBuffer throttling + Bubble rendering are client-side only |
| Persona pipeline | API / Backend (core ai layer) | — | PersonaProfile/Injector are pure core modules; the `np_persona` accessor reads storage in the wiring layer, injected as a config provider (D-09); zero UI presence (UI-SPEC) |
| Tier/cap enforcement | API / Backend (AgentOrchestrator only) | — | §1.4: "AgentOrchestrator is the only module allowed to enforce tier caps"; no component/hook calls PlannerService directly |
| Chat send/stream UX | Browser / Client | — | Co-located hook + ChatPage (BubbleList/Sender); sends through `runAgentTurn` with a D-02-built OptimizedContext — never React-side prompt assembly |
| Provider config + vault reads | API / Backend wiring layer (surface mount) | Storage (KeyVault/Setting) | R-3: AI + IndexedDB live in Side Panel/Standalone only; registry stays dependency-free; vault decrypt → PROVIDER_KEY_UNREADABLE crosses the boundary as a typed error (D-21) |
| Prompt caching hints | API / Backend (PromptCacheAdapter) | Provider (server-side caches) | Appendix K algorithm verbatim; adapter emits cache hints (anthropic providerOptions cacheControl); hits/misses logged via debugLog, never blocking |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | 4.3.19 (latest v4 — verified on registry) | Core SDK: `streamText`, `generateObject`, `generateText`, `zodSchema`, `NoObjectGeneratedError`, `type LanguageModel` | Approved stack §7; thin per-provider adapter layer the ILLMProvider contract needs; v4 is the ai@4-era line — v5+/v7 docs do NOT apply (Pitfall 3) |
| `@ai-sdk/openai` | 1.3.24 (latest v1 — verified) | `createOpenAI({ apiKey, baseURL, compatibility, fetch })` — OpenAI + OpenAI-compatible (DeepSeek) + Ollama-local (§10.2, D-12) | The only adapter needed for 3 of the 4 providers; `fetch` injection verified for deterministic tests |
| `@ai-sdk/anthropic` | 1.2.12 (latest v1 — verified) | `createAnthropic({ apiKey, baseURL, fetch })` — claude-haiku planner/renderer | Cache-hint path verified: reads `providerOptions.anthropic.cacheControl` on system blocks |
| `@ai-sdk/google` | 1.2.22 (latest v1 — verified) | `createGoogleGenerativeAI({ apiKey, baseURL, fetch })` — gemini flash renderer | `cachedContent` reference supported for the future Gemini cachedContent strategy |
| `zod-to-json-schema` | ^3 (3.25.2 current) | `zodToJsonSchema` — prompt-mode `[SYSTEM]` schema text + Appendix L repair prompt only | Approved stack §7; native path passes the Zod schema directly — never serialize-then-rehydrate |
| `@ant-design/x` | ^2.9.0 (installed) | `Bubble`/`Bubble.List` + `Sender` — the Phase-3 streaming chat surface | Approved §7.2; UI-SPEC locked D-01; `streaming` prop semantics verified from installed types |
| `msw` | ^2.15.0 (installed, devDependency) | HTTP-level interception fallback for provider tests | Already in devDependencies (Phase 1); secondary to the injected-fetch pattern |

**Version verification (2026-08-09, registry):** `npm view ai@4 version` → 4.3.19 · `npm view @ai-sdk/openai@1 version` → 1.3.24 · `npm view @ai-sdk/anthropic@1 version` → 1.2.12 · `npm view @ai-sdk/google@1 version` → 1.2.22 · `npm view @ai-sdk/ollama version` → **E404 — NOT published** · `npm view zod-to-json-schema version` → 3.25.2.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^3.25.76 (installed) | All runtime schemas: PlannerDecisionSchema, PersonaProfileSchema, ProviderConfigSchema, ToolSchemaRef input/output | Every public boundary (§0.3) |
| `vitest` | ^4.1.10 (installed) | The 8 required §18 test files + eval suite (`tests/core/ai`) | Default; threads pool + jsdom-align env (existing config) |
| `fake-indexeddb` / `wxt/testing` | installed | fakeBrowser + IDB for wiring-layer tests (vault reads, np_persona accessor) | ProviderRegistry / persona accessor / wiring tests |
| `@ant-design/icons` | ^6.3.2 (installed) | `SendOutlined` (Sender send button) | UI-SPEC Copywriting Contract |

### Alternatives Considered

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| `ai` + v1 provider adapters | `ai@5+` / live ai-sdk.dev v7 docs | v7 API (`Output.object()`, `maxOutputTokens`, thenable results) breaks `LanguageModelV1` compatibility; the v1 provider lines pair ONLY with `ai@^4` (Pitfall 4) |
| Injected `fetch` in provider tests | `vi.mock('@ai-sdk/openai')` | Mocking the adapter loses the real SDK's behavior (maxRetries defaults, request wire shape, stream event semantics) — the injected-fetch spike proves the real adapter runs against a fake transport, catching exactly the regressions the tests must catch |
| `createOpenAI` for Ollama | `@ai-sdk/ollama` | The package does not exist on npm (404 verified) — installing it fails the build |
| SDK `tool()`/`tools`/`maxSteps` for the tool loop | ExecutorService (deterministic) | R-4: Planner requests, Executor validates+runs; ai@4 `generateObject` has no `tools` param anyway; SDK tool-calling would re-introduce LLM-controlled execution (Pitfall 6) |
| `experimental_repairText`/`experimental_repairToolCall` | Appendix L one-repair `requestJson` | SDK-internal repair would nest a second repair mechanism inside the app's single repair (Pitfall 7, R-2) |

**Installation (plan must include — via pnpm per D-01; the repo is pnpm-standardized with `pnpm-lock.yaml` as the only lockfile, package-lock.json removed in Phase 1 — never `npm install`):**
```bash
pnpm add ai@4.3.19 @ai-sdk/openai@1.3.24 @ai-sdk/anthropic@1.2.12 @ai-sdk/google@1.2.22 zod-to-json-schema@^3
# DO NOT install @ai-sdk/ollama (npm 404 — verified). Ollama = createOpenAI + localhost baseURL (§10.2).
# Planner task: amend AGENTS.md §7 stack line (remove stale '@ai-sdk/ollama ^1', add zod-to-json-schema ^3).
```
All four packages verified browser-safe: zero runtime `node:` imports in their dist bundles (the only `node:http` reference is a type-only `ServerResponse` import in `ai`'s `.d.ts`). Safe to bundle in the WXT Side Panel / Standalone (R-3).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| ai | npm | ~3 yrs (v4 line) | 20.4M/wk | github.com/vercel/ai | OK | Approved — flagged `SUS: too-new` by the seam (published 2026-08-07, Vercel's frequent release cadence); overridden: official vendor package, vercel/ai repo, 20M/wk, explicit approved-stack constraint |
| @ai-sdk/openai | npm | ~2 yrs | 10.2M/wk | github.com/vercel/ai | OK | Approved — same false-positive `too-new`; official adapter, approved stack |
| @ai-sdk/anthropic | npm | ~2 yrs | 10.0M/wk | github.com/vercel/ai | OK | Approved — same |
| @ai-sdk/google | npm | ~2 yrs | 6.7M/wk | github.com/vercel/ai | OK | Approved — same |
| zod-to-json-schema | npm | 4+ yrs | 58M/wk | github.com/StefanTerdell/zod-to-json-schema | OK | Approved |
| @ant-design/x | npm | ~2 yrs | 102K/wk | github.com/ant-design/x | OK | Approved — installed ^2.9.0, UI-SPEC verified; `SUS: too-new` false positive |
| msw | npm | 5+ yrs | 19.4M/wk | github.com/mswjs/msw | OK | Approved — seam flagged `SLOP: suspicious-postinstall`; the postinstall (`import('./config/scripts/postinstall.js')`) is the official benign msw setup-notice script; already a project devDependency used by Phase 1/2 |
| @ai-sdk/ollama | npm | — | — | — | SLOP | **REMOVED — does not exist on the registry (E404, verified twice)**; AGENTS.md §7 line is stale; Ollama uses createOpenAI |

**Packages removed due to [SLOP] verdict:** `@ai-sdk/ollama` (never published — the §10.2 createOpenAI path replaces it; AGENTS.md §7 amendment is a planner task).
**Packages flagged as suspicious [SUS]:** none after review — all four seam flags are `too-new` false positives on official Vercel packages with 6–20M weekly downloads, and msw's `suspicious-postinstall` is its official benign script. No `checkpoint:human-verify` gates required for these installs.
## Architecture Patterns

### System Architecture Diagram

```
User input (Side Panel / Standalone ChatPage — Bubble/Sender)
        │  onSubmit
        ▼
Co-located hook (useStreamingLLM path, D-01 — src/components/pages/useStreamingLLM.ts)
        │  send(userInput) — builds OptimizedContext via D-02 core helper (NOT React-side assembly)
        ▼
runAgentTurn(input) — AgentOrchestrator (Appendix I verbatim, D-20)
  │  tier caps (plannerCap/toolCap) — ONLY module allowed to enforce §1.4
  ▼
┌─ PlannerService ── requestJson(PlannerDecisionSchema, plannerPrompt, ctx) ──────────────┐
│      │  ctx.callProviderJsonMode ── ProviderRouter CONSTRUCTS the callback (D-18)         │
│      ▼                                                                                    │
│  ProviderRouter — resolves (providerId, model, jsonMode: native|prompt)                   │
│      │  getAISDKModel (Seam 1: single factory switch — the ONLY place provider            │
│      │  packages are imported) → LanguageModel → generateObject (native, maxRetries:0)    │
│      │  or generateText (prompt mode — Ollama default)                                    │
│      │  ← fallback chain + circuit breaker (3 fails/60s → open 5 min) + privacyMode gate  │
│      └── retryable errors (TIMEOUT/5XX/NETWORK/RATE_LIMITED): ONE router retry (D-17)     │
│  ▼                                                                                        │
│  StructuredOutput.requestJson — safeParse → fail → ONE repair (PROMPTS.repairJson)        │
│      → fail → throw STRUCTURED_OUTPUT_FAILED (never double-repair, D-19)                  │
│  ▼                                                                                        │
│  PlannerDecision (Zod-validated discriminated union; run_tool branch omitted when         │
│  zero tools registered, D-05)                                                             │
├── action = run_tool → ExecutorService (deterministic — validates closed z.enum,           │
│      input schema, permission, capability, timeout, output → ToolExecutionResult;         │
│      unknown tool → TOOL_REJECTED)                                                        │
└── action = answer | ask_clarification → RendererService (flash tier)                      │
        │  streamText({ maxRetries: 0, abortSignal }) — Seam 3                              │
        ▼                                                                                   │
  StreamAdapter — textStream deltas → LLMStreamChunk {type:'text'} … await finishReason      │
        │  → 'done' | 'error' chunk (Pitfall 5: never render un-await-verified text)        │
        ▼                                                                                   │
  onStreamDelta seam → co-located hook → ChunkBuffer (J.1, 8_000 B/s rAF throttle)          │
        ▼                                                                                   │
  BubbleList (assistant bubble: streaming caret while streaming, error line + Retry on      │
  failure; Sender disabled during stream)                                                    │
        │                                                                                   │
        └── persona block: np_persona accessor (Setting.ts, PERSONA_LOAD_FAILED →           │
            DEFAULT_PERSONA) → PersonaInjector.inject(stage, system) — byte-stable block    │
            prepended INSIDE cached [SYSTEM]; PromptCacheAdapter emits cache hints          │
            (anthropic providerOptions.cacheControl) — byte-stability preserves caching      │
```

Trace the primary use case: user sends → hook builds context → `runAgentTurn` → Planner (one haiku call) → Renderer (one flash call) → deltas stream through StreamAdapter → ChunkBuffer → growing Bubble text → `done` → completed state. A healthy turn is exactly **2 model calls**. Every failure path terminates in a bounded terminal state (`reasonCode`), never a hang.

### Recommended Project Structure

§18 create-list (17 files) + documented extras (Phase-2 ImportExport "+1" precedent):

```
src/core/ai/
├── types.ts                        # Appendix C: ProviderId (canonical — workspace.ts swaps its local decl), LLMMessage, LLMOptions, LLMStreamChunk, ModelInfo, ProviderConfig, ToolExecutionResult + D-07 seeds: OptimizedContext (§2.3 verbatim), PromptSection, UserPreferences/RetrievedMemory minimal shapes (Phase-4/5 move targets)
├── ILLMProvider.ts                 # §10.1 contract; getAISDKModel(model): LanguageModel
├── ProviderRegistry.ts             # EXTENDED IN PLACE (01-CONTEXT B3, D-21): config presence + PROVIDER_KEY_UNREADABLE emission; stays dependency-free (no zustand/react)
├── providers/
│   ├── OpenAIProvider.ts           # createOpenAI({ apiKey, baseURL, compatibility: 'compatible' }) — F-1: 'compatible' everywhere (local/OpenAI-compatible only)
│   ├── AnthropicProvider.ts        # createAnthropic({ apiKey, baseURL })
│   ├── GeminiProvider.ts           # createGoogleGenerativeAI({ apiKey, baseURL })
│   ├── OllamaProvider.ts           # createOpenAI({ apiKey: 'ollama', baseURL: http://localhost:11434/v1, compatibility: 'compatible' }) — §10.2
│   └── OpenAICompatProvider.ts     # factory createOpenAICompatProvider({ baseURL }) → id stays 'openai' (D-12)
├── ProviderRouter.ts               # D-17 retry/breaker + D-18 callProviderJsonMode + D-13 privacy gate + D-16 no-op budgetGuard hook
├── TierResolver.ts                 # Appendix D verbatim + privacyModeFromPrefs (D-13)
├── PlannerService.ts               # PROMPTS.planner + requestJson → one Zod-validated decision
├── ExecutorService.ts              # deterministic; closed z.enum (D-05); get-provider-info (D-04)
├── RendererService.ts              # PROMPTS.renderer + streamText → StreamAdapter; onStreamDelta
├── AgentOrchestrator.ts            # Appendix I verbatim (D-20) + onStreamDelta seam
├── StructuredOutput.ts             # Appendix L requestJson (one repair, STRUCTURED_OUTPUT_FAILED)
├── toolSchemas.ts                  # ToolSchemaRef + get-provider-info + closed z.enum builder (D-04/D-05)
├── StreamAdapter.ts                # textStream deltas → LLMStreamChunk {type:'text'|'done'|'error'}
├── ChunkBuffer.ts                  # Appendix J.1 verbatim (8_000 B/s default)
├── PromptCacheManager.ts           # orchestrates adapter hints + debugLog of hits/misses
├── PromptCacheAdapter.ts           # Appendix K verbatim (hashStableSections FNV-1a; 4 breakpoints; 32_768 gemini min)
├── contextHelper.ts                # D-02 EXTRA (documented +1 to §18; Phase-4 deletion target): builds §2.3-shaped OptimizedContext from operationId/model/userInput/persona prefs/tool schema refs
└── persona/
    ├── PersonaProfile.ts           # Appendix N.1 (PersonaProfileSchema + DEFAULT_PERSONA)
    └── PersonaInjector.ts          # Appendix N.2 (resolvePersona/buildPersonaBlock/inject; 4 stages)

src/components/pages/
├── ChatPage.tsx                    # upgraded: BubbleList + Sender (D-01), stream state machine (UI-SPEC)
└── useStreamingLLM.ts              # D-01 EXTRA co-located hook (documented; Phase 7 promotes to src/hooks/useStreamingLLM.ts)

src/types/workspace.ts              # ProviderId import swap → src/core/ai/types.ts (NOTE already in file)

tests/core/ai/                      # 8 §18 required tests
├── {PlannerService,ExecutorService,RendererService,AgentOrchestrator,ProviderRouter,StructuredOutput}.test.ts
└── persona/{PersonaProfile,PersonaInjector}.test.ts
tests/fixtures/optimizedContext.ts  # D-08 EXTRA deterministic builder (Phase-3 create-list item per AI-SPEC §5)
```

### Pattern 1: The three ai-sdk seams (where the SDK touches the app)

**What:** Confine all ai-sdk usage to three seams — the rest of the runtime is SDK-free and deterministic. **Seam 1** `getAISDKModel(model, cfg)` is the single factory switch (only place provider packages are imported). **Seam 2** `buildCallProviderJsonMode` is constructed by ProviderRouter (D-18) — after a failover the (providerId, model, jsonMode) triple changes and only the Router knows the new provider's JSON capability; consumers stay pure. **Seam 3** `streamText` lives only in RendererService/StreamAdapter.

```typescript
// Source: AI-SPEC §3 (verified against installed @ai-sdk v1-line .d.ts + ai@4.3.19 runtime exports)
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { ProviderId } from './types';

/** §10.1 getAISDKModel — one factory switch, shared by all four adapters + OpenAICompat (D-12). */
export function getAISDKModel(
  providerId: ProviderId,
  model: string,
  cfg: { apiKey?: string; baseURL?: string; fetch?: typeof globalThis.fetch }, // fetch = test-only seam (verified option)
): LanguageModel {
  switch (providerId) {
    case 'openai':
      // OpenAI, OpenAI-compatible (DeepSeek…), and Ollama-local all use this factory;
      // baseURL + apiKey differentiate them. 'compatible' = 3rd-party safe (no newer fields sent).
      return createOpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, compatibility: 'compatible', fetch: cfg.fetch })(model);
    case 'anthropic':
      return createAnthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, fetch: cfg.fetch })(model);
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, fetch: cfg.fetch })(model);
    case 'ollama': // §10.2: no @ai-sdk/ollama package exists (npm 404) — OpenAI-compatible endpoint
      return createOpenAI({ apiKey: 'ollama', baseURL: cfg.baseURL ?? 'http://localhost:11434/v1', compatibility: 'compatible', fetch: cfg.fetch })(model);
  }
}
```

**When to use:** Every provider adapter + every Router-orchestrated call. Nothing outside this function imports a provider package.

### Pattern 2: Retry layering that cannot multiply (D-17, R-2)

**What:** Exactly three retry layers, never nested: (1) ProviderRouter pre-first-token retry + circuit breaker, (2) AGT-04 replan (Phase 3a), (3) one per-stage retry. The SDK's hidden `maxRetries: 2` default is the 4th layer that must be disabled.

```typescript
// Every SDK call the Router constructs carries these (verified: maxRetries defaults to 2 in ai@4.3.19 dist):
const CALL_SETTINGS = { maxRetries: 0, maxTokens: 256, temperature: 0 }; // planner/repair: 256; renderer: 512
// Router classifies errors to canonical codes: APICallError.statusCode 429 → RATE_LIMITED (retryable),
// 5xx → PROVIDER_5XX (retryable), 401/403 → PROVIDER_AUTH (non-retryable), 404 → PROVIDER_MODEL_UNKNOWN (non-retryable),
// fetch reject → NETWORK (retryable), NoObjectGeneratedError → SCHEMA_INVALID path (non-retryable).
// RouterAttemptState { operationId, attempts, hasStreamedFirstToken, circuitBreakerOpen } — in-memory per-surface (D-14).
// breaker: 3 failures within 60s for a provider → open 5 min. hasStreamedFirstToken → never switch mid-stream (§1.5).
```

### Pattern 3: The Anthropic cache-hint wire path (PromptCacheAdapter anthropic branch)

**What:** ai@4's `system: string` cannot carry a cache breakpoint. Verified in `@ai-sdk/anthropic` v1 source: the adapter reads `providerMetadata.anthropic.cacheControl ?? .cache_control` per system block / text part and emits `cache_control` on the wire. So stable sections travel as `messages` with `providerOptions`, not as a system string.

```typescript
// Source: @ai-sdk/anthropic@1.2.12 dist (verified) + ai@4.3.19 CoreSystemMessage type (verified)
import type { CoreMessage } from 'ai';
// up to ANTHROPIC_MAX_BREAKPOINTS = 4 stable sections, each its own system message with a cache hint:
const messages: CoreMessage[] = [
  { role: 'system', content: personaBlock + '\n\n' + PROMPTS.renderer.system,  // stable [SYSTEM]
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
  // … more stable sections (tool schemas) each with its own breakpoint, ≤ 4 …
  { role: 'user', content: taskSections },                                     // never cached
];
// Below the model's cache minimum (Haiku 4.5 = 4,096 tokens [CITED: docs.anthropic.com]) the marker is
// silently ignored by the provider — no error. Phase-3 prompts (~300–500 tok) will not hit the cache;
// byte-stability + marker emission are the testable invariants (PersonaInjector hash-equality tests).
```

### Pattern 4: Deterministic provider tests via injected fetch

**What:** Build the real adapter with a mock `fetch`; the whole SDK runs against a fake transport. Verified live: `createOpenAI({ fetch: mockFetch })` → `generateText` returned the mock's content and hit `POST https://mock.local/v1/chat/completions` (baseURL respected).

```typescript
// tests/core/ai/ProviderRouter.test.ts (pattern — adapters accept { fetch } in factory settings, verified)
import { createOpenAI } from '@ai-sdk/openai';
const calls: Array<{ url: string; method?: string }> = [];
const mockFetch = async (url: string | URL, init?: RequestInit) => {
  calls.push({ url: String(url), method: init?.method });
  return new Response(JSON.stringify({ /* minimal OpenAI chat.completions response */ }),
    { status: 200, headers: { 'content-type': 'application/json' } });
};
// route through getAISDKModel('openai', 'deepseek-chat', { apiKey: 'sk-test', baseURL: 'https://mock.local/v1', fetch: mockFetch })
// — then assert: response text, call count (healthy = 2), maxRetries: 0 on constructed settings, error classification on 5xx/429 responses.
```
msw ^2 (devDependency) intercepts globals for HTTP-level tests; `vi.mock` of `ai` packages is NOT recommended (loses fidelity). Note: `Response`/`Headers` globals come from Node (undici) in the jsdom-align env — construct them from the global, not `window`.

### Pattern 5: Streaming honesty — never render un-await-verified text

**What:** `streamText` never throws mid-stream. Deltas arrive via `textStream`; the terminal members (`text`, `usage`, `finishReason`) are Promises. A consumer that returns after the loop renders silently-truncated text on failure.

```typescript
// Source: AI-SPEC Seam 3 (verified: textStream: AsyncIterableStream<string>, finishReason: Promise<FinishReason>, result NOT thenable)
export async function* streamTextToLLMChunks(args: {
  model: LanguageModel; system: string; task: string; maxTokens: number; abortSignal: AbortSignal;
}): AsyncIterable<LLMStreamChunk> {
  const result = streamText({ model: args.model, system: args.system, prompt: args.task,
    maxTokens: args.maxTokens, maxRetries: 0, abortSignal: args.abortSignal }); // maxRetries: 0 — Router owns retries (D-17)
  try {
    for await (const delta of result.textStream) yield { type: 'text', content: delta };
    await result.finishReason;                    // surfaces stream errors — do NOT skip this
    yield { type: 'done', content: '' };
  } catch (e) {
    yield { type: 'error', content: e instanceof Error ? e.message : String(e) };
    // caller: debugLog(ERROR_CODES.STREAM_FAILED, …, Golden Rule 9) — UI shows error state, never "complete"
  }
}
```

### Pattern 6: Native vs prompt JSON mode (D-18/D-19)

**What:** The Router resolves `jsonMode` per provider and builds the callback. Native path = `generateObject({ schema: zodSchema(s), mode: 'auto', maxRetries: 0 })` (validates internally; throws `NoObjectGeneratedError` with `.text`/`.usage`). Prompt path (Ollama default) = `generateText` with the JSON schema in `[SYSTEM]`; raw text returns to `requestJson` for fence-strip + JSON.parse + zod, then exactly ONE repair (`PROMPTS.repairJson.system` + "Schema: <zodToJsonSchema>" + "Broken: <first>"), then `STRUCTURED_OUTPUT_FAILED`. Never `JSON.parse` model output anywhere else; never serialize-then-rehydrate the Zod schema on the native path (`zodToJsonSchema` is prompt-mode/repair only).

### Anti-Patterns to Avoid

- **Letting the SDK retry:** `maxRetries` defaults to 2 inside ai@4.3.19 (verified in dist) — on a flaky network one turn becomes 4–6 paid calls (SDK retries stacked on Router retry). Pass `maxRetries: 0` in every call the Router constructs.
- **`await result` destructuring:** ai@4 results are NOT thenable (that's v5+). `const { text } = await streamText(...)` silently yields `undefined`. Await each member individually.
- **Consuming `textStream` without a terminal await:** mid-stream errors are delivered as stream events, not thrown — a UI that returns after the delta loop renders truncated text as complete. Always `await result.finishReason` (or `.text`) and route failures through the error chunk.
- **Copying live ai-sdk.dev (v7) docs:** `maxOutputTokens`, `Output.object()`, thenable results are ai@5+/v7. The authoritative surface is `node_modules/ai/dist/index.d.ts` of the locked 4.3.19.
- **`generateObject` with `tools`/`maxSteps`:** ai@4's `generateObject` has no `tools` parameter; raising `maxSteps` would re-introduce LLM-controlled execution (R-4). Planner requests; ExecutorService validates + runs.
- **Wiring `experimental_repairText`/`experimental_repairToolCall`:** SDK-internal repair would nest a second repair mechanism inside the app's single Appendix L repair (R-2).
- **Injecting `maxRetries` > 0 "just for the provider's SDK"**: the Router IS the retry layer; anything else multiplies cost (R-2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Four-provider model invocation + streaming + native JSON flags | Raw fetch + SSE + per-provider wire formats | `ai` ^4 + `@ai-sdk/{openai,anthropic,google}` v1 | The adapters already encode each provider's streaming protocol, JSON mode, error surface, and browser-safe bundling; hand-rolling re-implements exactly what the approved stack removes (AI-SPEC §2) |
| JSON structured output with repair | Regex/string surgery on model output | `generateObject` (native) + `requestJson` (Appendix L, one repair) | Golden Rule 4; `NoObjectGeneratedError` carries `.text`/`.usage`; Zod validates at the boundary |
| HTTP mocking for provider tests | Hand-rolled fetch stubs per test | Injected `fetch` via adapter factory settings (verified) + msw ^2 fallback | Deterministic, no globals, real SDK fidelity |
| Tool execution loop | SDK `tool()`/`tools`/`maxSteps` | ExecutorService (deterministic, closed z.enum) | R-4: the LLM never executes tools directly; SDK machinery re-introduces LLM-controlled execution |
| Retry orchestration | Nested retry loops / SDK defaults | Three non-multiplying layers (§1.6.1), `maxRetries: 0` | R-2: nested retries multiply cost — the single most common cost blowup in production LLM apps |
| Provider JSON-mode capability detection | Reimplementing per-provider JSON probing | Router-owned `jsonMode: 'native' \| 'prompt'` + D-18 prompt path for Ollama | §10.2 model-dependent; prompt path + one repair is deterministic and provider-agnostic |
| Streaming display throttling | Per-chunk React state / typewriter effects | ChunkBuffer (Appendix J.1 verbatim) + Bubble `streaming` prop | J.1 is the locked contract (8_000 B/s, rAF flush ≤ 16 ms); spec §12.6 forbids motion-driven text reveals |

**Key insight:** The ai-sdk's value is the narrow, browser-safe adapter layer — not the orchestration. The entire cost story (tier caps, cheapest-capable routing, fallback, breaker, three non-multiplying retries, byte-stable prompt caching) is app-owned and deterministic; the SDK is only ever a thin invocation seam. Every piece of "smart" behavior (JSON repair, tool governance, retry policy, privacy gates) must live OUTSIDE the SDK so the cheap model can never inflate or loop the bill.

## Common Pitfalls

### Pitfall 1: The hidden 4th retry layer (`maxRetries: 2` default)
**What goes wrong:** On a flaky network one turn quietly becomes 4–6 paid model calls (SDK-internal retry stacked on the Router's retry layer) — a direct §1.6.1/R-2 violation and the AI-SPEC's #1 cost-blown mode.
**Why it happens:** ai@4.3.19's `CallSettings.maxRetries` silently defaults to `2` (verified in dist: `maxRetries = 2`); transport failures re-issue on their own.
**How to avoid:** Every SDK call the Router constructs passes `maxRetries: 0`. Assert it in tests by inspecting the constructed call settings on the mock-fetch path.
**Warning signs:** debugLog shows a single turn with > 3 provider attempts; retry-nesting fixture fails.

### Pitfall 2: Silent mid-stream truncation rendered as a complete answer
**What goes wrong:** A mid-stream failure (`finishReason !== 'stop'`, error event, abort) renders as a finished Bubble; the user copies a truncated draft believing it complete (AI-SPEC critical failure mode 2; "Entropy-class" silent failure).
**Why it happens:** `streamText` never throws mid-stream — errors are stream events; a consumer that only consumes `textStream` and returns looks successful.
**How to avoid:** Always await a terminal member (`finishReason`/`text`) after the delta loop; StreamAdapter yields an explicit `error` chunk; the co-located hook maps it to the UI-SPEC failed-bubble state (partial text retained + "Provider error." + Retry); abort cancels generation so no orphaned request bills tokens.
**Warning signs:** RendererService tests assert `finishReason: 'stop'` vs error paths; rendered-output sampling compares Bubble text to the chunk-log terminal state.

### Pitfall 3: Version drift — v1 provider lines vs ai@5+/v7 docs
**What goes wrong:** Copying today's ai-sdk.dev (v7) API (`Output.object()`, `maxOutputTokens`, thenable results, `@ai-sdk/*@2.x+`) into this codebase fails typecheck against the locked `ai@4.3.19` + v1 adapters.
**Why it happens:** The live docs serve v7; the project's locked line is ai@4-era.
**How to avoid:** Pin `ai@4.3.19` + `@ai-sdk/openai@1.3.24` + `@ai-sdk/anthropic@1.2.12` + `@ai-sdk/google@1.2.22` explicitly (never `"latest"`); when in doubt read `node_modules/ai/dist/index.d.ts`, not the live docs. Parameter name is `maxTokens`, not `maxOutputTokens`.
**Warning signs:** tsc errors on `Output.` / `maxOutputTokens`; package.json contains `@ai-sdk/*@^2`.

### Pitfall 4: Breaking the provider-config privacy boundary (silent local→cloud switch)
**What goes wrong:** A dead local (ollama) provider silently fails over to a cloud endpoint with the user's message in flight — violating the product's core value and D-13's "no silent local→cloud switch".
**Why it happens:** Fallback chains are designed for availability/cost; a naive chain traversal treats local and cloud as interchangeable.
**How to avoid:** Enforce the gate in **ProviderRouter** during fallback-chain traversal (never a `resolveTier` filter per D-13): under `privacyMode: 'prefer-local'` (default), a failing local provider terminates the turn in a visible provider-failure state with the hop refusal debugLogged (redacted). `resolveTier`'s `'local-only'` filter branch stays reserved/unused in Phase 3. Tests: dead-local + prefer-local → no cloud hop; dead-local + cloud-ok → legitimate logged hop.
**Warning signs:** ProviderRouter tests asserting a fallback hop under `prefer-local`; a debugLog line containing a raw prompt body or API key (TraceRedactor violation — zero tolerance, R-10).

### Pitfall 5: Persona drift / cache-breaking persona block
**What goes wrong:** The persona block changes byte-wise across turns for the same persona (killing provider prompt-cache hits and multiplying per-turn cost) or the persona silently stops applying mid-session.
**Why it happens:** Unstable serialization (object key order, timestamps, whitespace) in the persona block builder; persona overrides read non-deterministically.
**How to avoid:** `buildPersonaBlock` (Appendix N.2) uses a fixed template with ordered joins; the `np_persona` accessor produces stable, ordered serialization; `resolvePersona` merges overrides deterministically; hash-equality tests assert byte-stability across planner + renderer calls; invalid/empty persona → `PERSONA_LOAD_FAILED` → `DEFAULT_PERSONA` (never a crash, never a blocked Sender).
**Warning signs:** PersonaInjector hash-drift test fails; prompt-cache hit ratio drops > 20% vs session baseline (Phase-6 metric).

### Pitfall 6: Registry / dependency-boundary violations
**What goes wrong:** ProviderRegistry imports zustand/react or performs vault reads itself, breaking the dependency-free rule and R-3 (AI in Side Panel/Standalone only); or a provider call happens from the background SW.
**Why it happens:** Wiring convenience — reading the vault "where the config is".
**How to avoid:** ProviderRegistry stays dependency-free (imports only `core/error`); vault reads + persona accessor reads happen in the surface-mount wiring layer; the typed `PROVIDER_KEY_UNREADABLE` error crosses the boundary; provider adapters are only ever imported through `getAISDKModel` inside the surfaces. `verify:phase-3` isolation checks must extend the content-bundle grep to the ai packages.
**Warning signs:** A test importing ProviderRegistry pulls in react; content-bundle check flags `ai`/`@ai-sdk/*` in the content script bundle.

### Pitfall 7: Context assembly leaking into React (Golden Rule 3)
**What goes wrong:** The hook or ChatPage builds prompt text / an OptimizedContext inline, re-introducing React-side prompt assembly that the spec forbids.
**Why it happens:** It's convenient and the optimizer doesn't exist until Phase 4.
**How to avoid:** The D-02 core helper (`contextHelper.ts`) builds the §2.3-shaped context from Phase-3 inputs; the hook only calls `runAgentTurn` with the helper's output. Record the helper as a Phase-4 deletion target in the §18 addendum.
**Warning signs:** A `.tsx` file imports `PROMPTS` or constructs `PromptSection[]`; tests grep for prompt assembly outside `src/core/ai/**`.
## Code Examples

Verified patterns from the installed packages (`ai@4.3.19`, `@ai-sdk/openai@1.3.24`, `@ai-sdk/anthropic@1.2.12`, `@ai-sdk/google@1.2.22`) — every export, type, and signature below was confirmed against the installed `.d.ts`/dist:

### Constructing the four provider models (Seam 1)
```typescript
// VERIFIED against installed .d.ts: all three factories are callable model-builders
// (factory(opts) → (modelId: string) => LanguageModel) and all accept { apiKey, baseURL, fetch, headers }.
// createOpenAI additionally accepts compatibility: 'strict' | 'compatible' (DEFAULT is 'compatible' — verified).
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai'; // = LanguageModelV1 (type-only export — verified)

const openaiModel: LanguageModel = createOpenAI({ apiKey, baseURL, compatibility: 'compatible' })('gpt-4o-mini'); // F-1: 'compatible' for all openai-id endpoints (compat/local)
const anthropicModel: LanguageModel = createAnthropic({ apiKey })('claude-haiku-4-latest');
const geminiModel: LanguageModel = createGoogleGenerativeAI({ apiKey })('gemini-2.5-flash');
const ollamaModel: LanguageModel = createOpenAI({ apiKey: 'ollama', baseURL: 'http://localhost:11434/v1', compatibility: 'compatible' })('llama3.2:3b'); // §10.2
```

### Structured output — native path (Planner)
```typescript
// VERIFIED: generateObject({ schema: Schema<OBJECT>, mode?: 'auto'|'json'|'tool', maxRetries, maxTokens, abortSignal })
// zodSchema(z) is a runtime export (re-exported from @ai-sdk/ui-utils — verified).
// NoObjectGeneratedError is a runtime class with .text/.usage and static isInstance() (verified).
import { generateObject, zodSchema, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';

const PlannerDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
  z.object({ action: z.literal('run_tool'), toolName: z.string().max(64), input: z.unknown() }),
  z.object({ action: z.literal('ask_clarification'), question: z.string().max(200),
    options: z.array(z.string().max(60)).max(4).default([]) }),
]);

try {
  const { object } = await generateObject({
    model, schema: zodSchema(PlannerDecisionSchema), mode: 'auto',
    system: PROMPTS.planner.system, prompt: userInput,
    maxTokens: 256, temperature: 0, maxRetries: 0,   // maxRetries: 0 — Router owns retries (D-17)
    abortSignal,
  });
  return object; // typed: { action: 'answer'|'run_tool'|'ask_clarification', … }
} catch (err) {
  if (NoObjectGeneratedError.isInstance(err)) {
    debugLog(ERROR_CODES.SCHEMA_INVALID, 'planner structured output failed', { error: err, module: 'PlannerService' });
  }
  throw err; // Router classifies + decides fallback/breaker (D-17)
}
```

### Streaming renderer + error surface (Seam 3)
```typescript
// VERIFIED: streamText result exposes textStream: AsyncIterableStream<string> and
// text/usage/finishReason as Promises — the result is NOT thenable (v5+ pattern only).
// Mid-stream errors surface via the promises / stream events, never as thrown exceptions.
import { streamText } from 'ai';
const result = streamText({ model, system, prompt: task, maxTokens: 512, maxRetries: 0, abortSignal });
for await (const delta of result.textStream) onDelta(delta);   // → StreamAdapter → ChunkBuffer
const reason = await result.finishReason;                       // MUST await — surfaces stream errors (Pitfall 5)
if (reason !== 'stop') throw new Error(`STREAM_FAILED: ${reason}`); // debugLog with §C.2 code
```

### Anthropic cache hint via providerOptions (PromptCacheAdapter)
```typescript
// VERIFIED in @ai-sdk/anthropic@1.2.12 dist: system blocks and text parts read cache_control from
// providerMetadata.anthropic.cacheControl ?? .cache_control. CoreSystemMessage carries providerOptions.
// (settings.cacheControl on createAnthropic is deprecated — "enabled by default", verified.)
const messages: CoreMessage[] = [
  { role: 'system', content: `${personaBlock}\n\n${stageSystem}`,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
  { role: 'user', content: taskText },
];
```

### ChunkBuffer (Appendix J.1 — spec-verbatim, keep the 8_000 default)
```typescript
// 8_000 bytes/s default verified in spec §22.1 ("ChunkBuffer flush rate: max every 16 ms,
// upgrade to 33 ms if enqueue > 8 kB/s"). createChunkBuffer() as written in Appendix J.1.
const buffer = createChunkBuffer();
buffer.onFlush(setBubbleText);
for (const ch of streamChunks) buffer.enqueue(ch.content); // live during render (onStreamDelta path)
buffer.flushNow();                                          // on 'done'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled fetch + SSE per provider | Vercel AI SDK narrow adapters (`streamText`, `generateObject`) | ai@4 era (2024–2025) | Per-provider streaming/JSON-mode/tool wire formats are vendor-maintained; app owns selection/cost/governance |
| SDK-internal repair hooks | Single app-owned repair (Appendix L `requestJson`) | ai@4 (experimental_repair*) | One deterministic repair path; nested repairs are a cost/loop risk (R-2) |
| Explicit per-block cache breakpoints everywhere | Anthropic automatic caching (top-level `cache_control`); block-level ≤ 4 breakpoints | Anthropic docs 2025–2026 | Cache control simplified; the v1 adapter already reads per-block hints from providerOptions |
| `@ai-sdk/ollama` (never published) | `createOpenAI` + localhost baseURL (§10.2) | Always (package is 404) | Ollama rides the OpenAI-compatible path; no separate adapter exists |
| `ai@4` result objects | Thenable results (`Output.object()`, v5+) | ai@5 | This project stays on ai@4 — `await result` destructuring does NOT work; await members individually |

**Deprecated/outdated:**
- `experimental_providerMetadata` (per-part/message): deprecated in favor of `providerOptions` in ai@4.3.19 — use `providerOptions` (both still type-check).
- `AnthropicMessagesSettings.cacheControl`: deprecated — cache control is enabled by default; hints flow via `providerOptions`/message metadata (verified).
- Live ai-sdk.dev docs (v7): do not use as the API reference for this project — the locked surface is `node_modules/ai/dist/index.d.ts` of `ai@4.3.19` + v1 adapters.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gemini context caching minimum for `cachedContent` is 32,768 tokens (spec Appendix K constant) | Standard Stack / Patterns | ai.google.dev was unreachable during research; the constant is spec-verbatim so the code is correct either way — but if Google's current minimum is lower (Gemini 2.5 Flash implicit caching reportedly 1,024), the `gemini-cachedContent` branch engages earlier than expected. Zero Phase-3 impact: prompts are far below any minimum; the branch stays dormant. Planner should not "optimize" the constant away from the spec |
| A2 | `claude-haiku-4-latest` maps to Claude Haiku 4.5 (4,096-token cache minimum, $1/MTok input) | Pitfalls / Standard Stack | Haiku 4.5's published minimum is 4,096 (CITED); if `-latest` resolves to a different model, the minimum differs — Phase-3 behavior unchanged (prompts never reach the minimum) |
| A3 | OpenAI-compatible providers (DeepSeek, Ollama local) engage server-side automatic prefix caching at ≥1,024 tokens | Patterns | OpenAI announced automatic prefix caching (no client control needed); DeepSeek/Ollama caching behavior is not documented by this research. Irrelevant at Phase-3 prompt sizes; byte-stability remains the discipline |
| A4 | `model` field is passed through `getAISDKModel` to the provider factory's callable with the provider's own model-id naming (e.g. `deepseek-chat` via the openai factory) | Standard Stack | DeepSeek's OpenAI-compatible API accepts OpenAI-style model ids; if a provider rejects the Appendix D candidate id, `resolveTier`'s candidate table (spec) would need amendment — user-configurable `models[]` in ProviderConfig mitigates |
| A5 | Browser `Response`/`Headers`/`Request` globals in the jsdom-align vitest env come from Node (undici), so mock-fetch tests construct responses from the global | Patterns / Testing | jsdom 30 ships its own fetch — if it shadows the globals differently, mock responses must be built from the same constructor the adapter calls; the live spike ran under plain Node. Tests should confirm the constructor identity once (setup.ts) |
| A6 | The `fetch` test seam is added to `getAISDKModel`'s cfg (optional `fetch?: typeof globalThis.fetch`) | Standard Stack / Code Examples | The §10.1 `ILLMProvider.getAISDKModel(model)` signature has no cfg — the cfg param (with optional fetch) is the AI-SPEC's documented extension; if a stricter reading forbids it, tests construct adapters directly (still verified) or use msw |

## Open Questions (RESOLVED)

All five questions are resolved by the phase plans; each item carries its carrying-plan pointer and the locked resolution below. No open question remains for execution.

1. **runAgentTurn streaming seam (AI-03 vs D-20 verbatim).** Appendix I's `runAgentTurn` returns only the completed `streamedText`, but AI-03 requires live incremental rendering. The AI-SPEC Seam 3 + UI-SPEC stream state machine ("text grows via ChunkBuffer" during the stream) imply deltas must flow during generation.
   - What we know: `streamText` deltas are produced inside `RendererService`; the hook needs them live; `runAgentTurn` is the mandated entry (hooks may not call PlannerService directly).
   - What's unclear: whether to add an optional `onStreamDelta?: (delta: string) => void` parameter to `runAgentTurn` (minimal additive deviation from Appendix I, documented in the Phase-3 addendum like Phase-1/2 plan deviations) or have `RendererService.render` expose the chunk stream and `runAgentTurn` forward it.
   - Recommendation: add the optional `onStreamDelta` param to `runAgentTurn` (output struct stays verbatim — D-20 is about not leaking evidence machinery, not about forbidding a streaming callback). Planner should treat this as a documented deviation with a fixture test asserting deltas arrive before completion.
   - **RESOLVED — carried by 03-06 (Task 2):** optional `onStreamDelta?: (delta: string) => void` added to `AgentTurnInput`; `AgentTurnOutput` stays verbatim (D-20 intact); deltas-before-completion fixture asserted (03-06 Task 2 Test 6).

2. **`UserPreferences` home for Phase 3.** `resolvePersona` (Appendix N.2) and the D-02 context helper need a `UserPreferences`-shaped value, but `src/core/memory/types.ts` (its spec home) doesn't exist until Phase 5.
   - What we know: D-09 injects persona prefs as a config provider; only the `personaOverrides` slice is read in Phase 3.
   - What's unclear: declare a minimal `UserPreferences` (or `PersonaOverrides`-only) type in `src/core/ai/types.ts` as a Phase-5 move target, vs. a narrower `PersonaPrefsLike` param.
   - Recommendation: seed the full §3.5 `UserPreferences` interface (including `allowCloudFallbackFromLocal`, needed by D-13's `privacyModeFromPrefs`) in `src/core/ai/types.ts`, marked as the Phase-5 move target; `src/core/memory/types.ts` later re-exports it (R-1: single home at any time). Planner should pick the exact cut and record the deletion target.
   - **RESOLVED — carried by 03-01 (Task 2):** full §3.5 `UserPreferences` (incl. `personaOverrides` + `allowCloudFallbackFromLocal`) seeded in `src/core/ai/types.ts`, header-marked as the Phase-5 move target; `src/core/memory/types.ts` re-exports later (R-1). Consumer: 03-07 (contextHelper).

3. **RendererService `render` output shape.** Appendix I's `finish()` awaits `RendererService.render` and reads `rendered.text` — but streaming happens during render.
   - What we know: StreamAdapter produces `LLMStreamChunk`; ChunkBuffer is client-side.
   - What's unclear: whether `render` should (a) accept `onChunk`, (b) return `{ text, chunks }`, or (c) be driven by the orchestrator consuming an async generator.
   - Recommendation: `RendererService.render({ ..., onDelta })` mirrors the orchestrator's `onStreamDelta`; the returned `text` is the accumulated final string. Keep the adapter consumer inside RendererService only (AI-SPEC rule).
   - **RESOLVED — carried by 03-06 (Task 1):** option (a) — `render({ ..., onDelta })`, returned `text` = accumulated final string; `streamText` consumed ONLY inside RendererService/StreamAdapter (Seam 3).

4. **Gemini `cachedContent` reference usage.** `@ai-sdk/google` v1 exposes `cachedContent?: string` (a `cachedContents/{id}` reference), but creating the resource requires the CachedContent API which the adapter doesn't wrap.
   - What we know: Appendix K's gemini branch never engages below 32,768 tokens (dormant at Phase-3 sizes).
   - What's unclear: whether to implement the branch as spec-verbatim (returns `cachedContent: stable` sections shape that no Phase-3 caller consumes) or reduce to `prefix-only` with the enum value reserved.
   - Recommendation: implement Appendix K verbatim (the hash + strategy enum are what the tests assert); the `gemini-cachedContent` branch's resource creation is documented as a future phase. Planner: keep the constant + branch, don't build the CachedContent API client.
   - **RESOLVED — carried by 03-03 (Task 2):** Appendix K VERBATIM (`applyCacheHints`, `hashStableSections` FNV-1a, `GEMINI_MIN_CACHED_TOKENS = 32_768`); `gemini-cachedContent` branch is hash/strategy only — no CachedContent API client (documented future phase, "Research RQ4" note in the file header).

5. **Ollama `response_format` vs prompt mode.** Ollama's OpenAI-compat endpoint advertises `response_format` + JSON mode support (docs verified), but D-18 locks Ollama → `'prompt'` because support is model-dependent and `ProviderConfig` has no JSON-capability field.
   - What we know: `compatibility: 'compatible'` strips "newer fields" but `response_format` is standard OpenAI API; whether Ollama honors it depends on the model.
   - What's unclear: whether `generateObject({ mode: 'json' })` would work against Ollama for models that support `format: json` (llama3.2/qwen2.5 generally do).
   - Recommendation: keep the D-18 locked behavior ('prompt' + one repair) — deterministic and provider-agnostic; the native-JSON probe for Ollama is a future refinement. Planner should not add a JSON-capability field to ProviderConfig this phase.
   - **RESOLVED — carried by 03-05 (Task 1):** D-18 locked — `callProviderJsonMode` resolves Ollama → `'prompt'`, openai/anthropic/gemini → `'native'`; native-JSON probe for Ollama deferred (no JSON-capability field added to ProviderConfig).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest, wxt build, tsc | ✓ | v24.18.1 | — |
| pnpm | install ai-sdk deps (D-01) | ✓ | 11.18.0 | — |
| vitest | 8 required test files + eval suite | ✓ | ^4.1.10 (installed) | — |
| msw | HTTP-level provider test fallback | ✓ | ^2.15.0 (devDependency) | injected `fetch` (primary) |
| @ant-design/x | Bubble/Sender chat surface | ✓ | ^2.9.0 (installed) | — |
| ai + @ai-sdk/* + zod-to-json-schema | THE Phase-3 runtime | ✗ | — | **Blocking: not installed — plan task `pnpm add` with the exact locked versions (D-01)** |
| ollama (local binary) | Manual UAT of the ollama provider (not unit tests) | ✗ | — | Mock-fetch tests cover the adapter; real local-provider UAT needs `ollama pull llama3.2:3b` + `qwen2.5:7b` — flag as a human-verify item; the OpenAI-compatible path is covered by tests + a configured remote OpenAI-compatible endpoint |
| Chrome (extension runtime) | Manual streaming UAT | ✗ (not probed) | — | `wxt build` + load-extension; e2e smoke script exists (`verify:e2e-phase-1`) |

**Missing dependencies with no fallback:**
- `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `zod-to-json-schema` — the phase cannot compile without them; install task is Wave-0/1 (pin exact versions, not `latest`).

**Missing dependencies with fallback:**
- ollama binary — only needed for live local-provider verification (UAT); all provider logic is covered by injected-fetch tests against the OpenAI-compatible wire.
- Note: `/tmp` (tmpfs) is full on this machine (quota exceeded during research) — tests/builds that write to /tmp must use the workspace or `$TMPDIR`-free paths; not a project blocker, but CI/local runs should be aware.

## Validation Architecture

> `workflow.nyquist_validation` is enabled (config has no explicit `false`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.10 (threads pool + custom `jsdom-align` env + `tests/setup.ts`) |
| Config file | `vitest.config.ts` (exists) — pool `threads`, env `./tests/environments/jsdom-align.ts`, setupFiles `./tests/setup.ts` |
| Quick run command | `npx vitest run tests/core/ai` (AI eval suite; AI-SPEC suggests adding `scripts.test:ai`) |
| Full suite command | `pnpm run verify:phase-3` (eslint + prettier + tsc --noEmit + wxt build + vitest run + isolation check — template from verify:phase-1/2) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-02 | Planner decision schema: valid/invalid/ask_clarification; zero-tools → run_tool branch omitted; stray run_tool → TOOL_REJECTED | unit (injected fetch) | `npx vitest run tests/core/ai/PlannerService.test.ts` | ❌ Wave 0 |
| AI-02 | Executor: closed z.enum, unknown tool rejected, get-provider-info runs, ToolExecutionResult | unit | `npx vitest run tests/core/ai/ExecutorService.test.ts` | ❌ Wave 0 |
| AI-03 | Renderer stream: deltas then done; finishReason!=='stop' → error chunk; accumulated text = exactly pre-failure text; abort cancels | unit (fake timers + injected fetch) | `npx vitest run tests/core/ai/RendererService.test.ts` | ❌ Wave 0 |
| AI-03 | ChunkBuffer order/throttle (≤8_000 B/s) | unit (fake timers) | `npx vitest run tests/core/ai/RendererService.test.ts` (or a ChunkBuffer test file) | ❌ Wave 0 |
| AI-01/AI-04 | Router: fallback chain, breaker (3/60s → open 5min), attempt budget (≤3 layers), maxRetries:0 asserted, privacyMode gate (dead local + prefer-local → NO cloud hop), budgetGuard no-op hook | unit (injected fetch) | `npx vitest run tests/core/ai/ProviderRouter.test.ts` | ❌ Wave 0 |
| AI-02/AI-04 | Orchestrator: exactly 2 calls healthy path; planner_cap_reached/tool_cap_reached/planner_failed terminals; abort → AbortError; streamedText always present | unit (spies on services) | `npx vitest run tests/core/ai/AgentOrchestrator.test.ts` | ❌ Wave 0 |
| AI-02 | StructuredOutput: first fail → ONE repair → success; second fail → STRUCTURED_OUTPUT_FAILED (never a third attempt) | unit | `npx vitest run tests/core/ai/StructuredOutput.test.ts` | ❌ Wave 0 |
| AI-05 | PersonaProfile: schema validation + DEFAULT_PERSONA fallback (invalid/empty → PERSONA_LOAD_FAILED) | unit | `npx vitest run tests/core/ai/persona/PersonaProfile.test.ts` | ❌ Wave 0 |
| AI-05 | PersonaInjector: byte-stability across planner/renderer/memoryExtractor; prepend into cached [SYSTEM]; overrides apply; hash-equality | unit | `npx vitest run tests/core/ai/persona/PersonaInjector.test.ts` | ❌ Wave 0 |
| AI-01 | ProviderRegistry extension: config presence, PROVIDER_KEY_UNREADABLE → enabled:false, dependency-free | unit (fakeBrowser) | `npx vitest run tests/core/ai/ProviderRegistry.test.ts` (extends existing) | ❌ Wave 0 |
| AI-05 | np_persona accessor: Setting-backed read, validation, fallback | unit (fakeBrowser) | persona accessor test (co-located with PersonaProfile/Injector tests) | ❌ Wave 0 |
| R-10 | TraceRedactor on every provider request/response debug-log path (adversarial secrets fixtures) | unit | part of ProviderRouter/StreamAdapter tests | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/ai` (focused AI suite)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** `pnpm run verify:phase-3` green — includes eslint/prettier/tsc/wxt-build/vitest/isolation

### Wave 0 Gaps
- [ ] `pnpm add ai@4.3.19 @ai-sdk/openai@1.3.24 @ai-sdk/anthropic@1.2.12 @ai-sdk/google@1.2.22 zod-to-json-schema@^3` — the SDK is not installed (D-01: pnpm only — no npm install, no package-lock.json)
- [ ] `tests/core/ai/` directory + the 8 §18 test files (all ❌ above)
- [ ] `tests/fixtures/optimizedContext.ts` — D-08 deterministic builder (Phase-3 create-list item)
- [ ] `src/core/ai/types.ts` seed (ProviderId canonical, OptimizedContext, PromptSection, UserPreferences seed) — every other file's compile dependency
- [ ] `scripts.test:ai` — `pnpm pkg set scripts.test:ai="vitest run tests/core/ai"` (AI-SPEC §5)
- [ ] Error-code additions to `src/core/error/errorCodes.ts` (Phase-3 block: TOOL_REJECTED, PERSONA_LOAD_FAILED, STRUCTURED_OUTPUT_FAILED, PLANNER_FAILED, STREAM_FAILED, NETWORK, TIMEOUT, RATE_LIMITED, PROVIDER_5XX, PROVIDER_AUTH, PROVIDER_MODEL_UNKNOWN, SCHEMA_INVALID, HOST_NOT_PERMITTED) + mirror into spec Appendix C.2 (Golden Rule 9; Phase-1/2 precedent)
- [ ] AGENTS.md §7 stack amendment (remove `@ai-sdk/ollama ^1`; add zod-to-json-schema ^3)

## Security Domain

> `security_enforcement` is enabled (config: true). ASVS L1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Provider API keys live in the Phase-2 AES-GCM vault; no user auth in this local-first extension |
| V3 Session Management | no | Per-surface in-memory stream state (D-14); chrome storage.session for `np_active_stream` (declared-only key, Phase 2) |
| V4 Access Control | yes | ExecutorService closed z.enum + permission policy (D-04/D-05); `get-provider-info` is `dangerous: no`; R-4 (LLM never executes tools) |
| V5 Input Validation | yes | Zod everywhere — PlannerDecisionSchema, PersonaProfileSchema, ProviderConfigSchema, tool input/output schemas; Appendix L safeParse (never regex/hand-parse) |
| V6 Cryptography | yes (key handling) | Phase-2 vault (AES-GCM + PBKDF2) is the only crypto; Phase 3 REUSES it (D-21 PROVIDER_KEY_UNREADABLE single state) — never adds new crypto; provider transport is TLS via the user's configured endpoint |

### Known Threat Patterns for the ai-sdk stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secrets in provider requests / debug logs (vault-decrypted API keys, prompt bodies, tool output) | Information Disclosure | TraceRedactor wraps every provider request/response before logging (R-10); debugLog never receives raw bodies; adversarial fixtures assert redaction on every adapter path |
| Persona/prompt injection via `[USER INPUT]` steering cached `[SYSTEM]` | Tampering | User input is never interpolated into `[SYSTEM]`; canonical section separation (§1.3); persona block is byte-stable and cache-eligible — an injection attempt changes only `[USER INPUT]`, never the cached prefix |
| Unintended local→cloud data transmission (silent failover) | Information Disclosure | ProviderRouter privacy gate (D-13): `prefer-local` (default) blocks cloud hops from a failing local provider; hop refusals debugLogged; privacy-reviewer sign-off on the fixtures |
| Arbitrary endpoint via custom baseURL (OpenAI-compatible config) | Spoofing / SSRF (user-scoped) | The custom baseURL is user-configured and deliberate (D-12); no PROXY_FETCH involved (direct surface→endpoint); host permissioning applies to the background proxy path only (HOST_NOT_PERMITTED), not user-configured provider endpoints — documented behavior, not a bypass |
| Unbounded spend / retry multiplication | (cost, not STRIDE) | `maxRetries: 0` everywhere, three non-multiplying retry layers (D-17), §1.4 caps at AgentOrchestrator, explicit maxTokens on every call, no-op `budgetGuard` seam for Phase 6 |
| Malformed/malicious model output executed | Tampering / Elevation | Golden Rule 4: one Zod-validated decision, one repair, STRUCTURED_OUTPUT_FAILED; Executor validates before ANY tool runs; `TOOL_REJECTED` on stray toolName |
| XSS via streamed AI output in the UI | (web) | Phase 3 renders plain text via Bubble; DOMPurify/PortableMarkdown pipeline is Phase 7 (rich markdown) — the minimal surface renders text only (UI-SPEC), and the renderer prompt forbids inventing content |

## Sources

### Primary (HIGH confidence — verified against installed packages & live spike)
- Installed `ai@4.3.19` (`node_modules/ai/dist/index.d.ts` + `dist/index.js`): `streamText`/`generateObject`/`generateText`/`zodSchema`/`NoObjectGeneratedError` exports, `maxRetries = 2` default, `textStream: AsyncIterableStream<string>`, Promise members, `CoreSystemMessage.providerOptions`, NOT-thenable results, zero runtime `node:` imports
- Installed `@ai-sdk/openai@1.3.24`, `@ai-sdk/anthropic@1.2.12`, `@ai-sdk/google@1.2.22` `.d.ts`: factory signatures (`createOpenAI`/`createAnthropic`/`createGoogleGenerativeAI`), settings (`apiKey`, `baseURL`, `fetch`, `headers`, `compatibility` default 'compatible'), callable model-builders; anthropic adapter dist: `cache_control` read from `providerMetadata.anthropic.cacheControl|cache_control`; google `cachedContent?: string` reference
- Live spike (2026-08-09): `createOpenAI({ fetch: mockFetch })` → `generateText` round-trip produced mock content via `POST https://mock.local/v1/chat/completions` — injected-fetch mechanism proven
- npm registry (2026-08-09): `ai@4.3.19`, `@ai-sdk/openai@1.3.24`, `@ai-sdk/anthropic@1.2.12`, `@ai-sdk/google@1.2.22`, `zod-to-json-schema@3.25.2`; **`@ai-sdk/ollama` E404** (verified twice)
- Project artifacts (authoritative): `.planning/PRODUCT_SPEC_v0_1.md` §1/§2.3/§8.5/§10.1–10.3/§18 + Appendices C/D/I/J/K/L/N; 03-CONTEXT.md D-01…D-21; 03-AI-SPEC.md; 03-UI-SPEC.md; `package.json`, `src/core/ai/ProviderRegistry.ts`, `src/core/storage/Setting.ts` (`np_persona` registered, area 'local'), `src/core/security/KeyVault.ts`, `src/core/error/errorCodes.ts`, `src/core/prompts/index.ts`, `src/components/pages/ChatPage.tsx`, `tests/setup.ts`, `vitest.config.ts`, `tests/fixtures/index.ts`

### Secondary (MEDIUM confidence — cited from official docs)
- [CITED: docs.anthropic.com/en/docs/build-with-claude/prompt-caching] — 4 breakpoints, ephemeral-only cache type, 5-min default TTL (1h at 2x), prefix order tools→system→messages, per-model minimums (Claude Haiku 4.5 = 4,096 tokens; below-minimum markers silently ignored), exact-prefix-match rule
- [CITED: docs.ollama.com/openai] — `/v1/chat/completions` supports JSON mode + `response_format` + streaming + tools; `tool_choice` NOT supported; `api_key: 'ollama'` required-but-ignored; num_ctx not settable via the OpenAI API
- [CITED: x.ant.design/components/bubble] + installed `@ant-design/x@2.9.0` types — Bubble/Bubble.List `streaming` prop semantics, SenderProps (value/onChange/onSubmit/disabled/loading), MessageStatus union

### Tertiary (LOW confidence — training knowledge, marked for validation)
- Gemini context-caching minimum (ai.google.dev unreachable; Appendix K's 32,768 is the project's canonical constant) — see Assumption A1
- OpenAI automatic prefix caching ≥1,024 tokens (server-side, no client control) — see Assumption A3

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package/version/API surface verified against installed `.d.ts`, runtime exports, npm registry, and a live mock-fetch spike; `@ai-sdk/ollama` 404 double-verified
- Architecture: HIGH — the three-seam design, retry layering, streaming honesty, cache-hint wire path, and test-mocking mechanism are all verified against actual SDK behavior; provider cache *minimums* are CITED (MEDIUM) but their only Phase-3 effect is "cache dormant — expected"
- Pitfalls: HIGH — Pitfalls 1–2 (maxRetries default, streamText non-throwing) verified in the actual dist; privacy/registry/context pitfalls derive from locked decisions + project history

**Research date:** 2026-08-09
**Valid until:** 2026-08-16 (fast-moving: the ai-sdk v4 line and Anthropic caching docs both drift; the locked 4.3.19/v1 versions remain valid on npm today, but the plan MUST pin them explicitly — `latest` would pull ai@7/v2-line adapters that break the typecheck)
