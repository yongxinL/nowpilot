# Phase 3: Cost-Effective AI Runtime (+ Persona seed) - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the four-provider AI runtime: provider adapters (`openai` | `anthropic` | `gemini` | `ollama`, plus an OpenAI-compatible custom-baseURL variant) built on the Vercel AI SDK; the Planner→Executor→Renderer loop with Zod-validated `PlannerDecision` and §1.4 tier caps; streaming (SSE + text via ChunkBuffer); cost-effective routing with fallback + circuit breaker (ProviderRouter §1.5 / TierResolver Appendix D); the persona pipeline (PersonaProfile + PersonaInjector, persona block in the cached [SYSTEM] section); and a minimal functional streaming chat surface. All file paths and types are locked by spec §18 / §8.5 / Appendix C/D/I/J/K/L/N. AI + IndexedDB live in Side Panel/Standalone only (R-3); the background SW never touches providers or the vault.

**Boundary note:** Phase 3 ships the AI **runtime core + persona seed**; reliability/evidence (trajectory states, OutcomeVerifier, CompletionEvidence) is Phase 3a; ContextOptimizer (token budgets, compression, degradation) is Phase 4; MCP client + built-in tool suite is Phase 8; RICH chat polish + persona editor + options UI is Phase 7.
</domain>

<decisions>
## Implementation Decisions

### Streaming Chat UI Scope (AI-03 / AI-06)
- **D-01 [minimal functional chat]:** Phase 3 upgrades the Phase-1 ChatPage skeleton to a real send+stream surface using **Ant Design X `Bubble` + `Sender`** (approved presentation components, §7.2). Streamed text renders via ChunkBuffer (Appendix J.1) + a **co-located hook on the `useStreamingLLM` path** (Phase 7 promotes it to `src/hooks/useStreamingLLM.ts` — documented 3-state lifecycle: skeleton → minimal → full). `AgentModeToggle`/Agent mode stays Phase 7.
- **D-02 [Golden Rule 3 in the UI path]:** The hook sends through `runAgentTurn` with a **hand-built `OptimizedContext` from a core helper** — NOT React-side prompt assembly, NOT a proto-optimizer. A core helper builds the §2.3-shaped context from Phase-3-available inputs (operationId, model, userInput, persona prefs, tool schema refs); Phase 4's ContextOptimizer replaces it. The helper + this addendum are recorded as a **Phase-4 deletion target**.
- **D-03 [fenced out of Phase 3]:** Welcome cards, Prompts, clarification/follow-up chips, persona header, stage indicators, chat-history persistence in the message list, Agent toggle, action panels — all Phase 7.3+. No message-store persistence this phase (ChatHistoryDB consumers land with Phase 7).

### Tools & MCP Scope (AI-02 / AI-07)
- **D-04 [toolSchemas.ts = contract + one tool]:** Phase 3 ships the **`ToolSchemaRef` contract + closed z.enum builder + exactly one safe built-in** — `get-provider-info` (`dangerous: no`, depends only on the Phase-3 ProviderRegistry). This proves the closed-enum + `run_tool` + Executor accept/reject paths end-to-end.
- **D-05 [empty registry rule]:** When zero tools are registered, the PlannerDecisionSchema builder **omits the `run_tool` branch entirely** (avoids `z.enum([])`, which Zod rejects); any stray `run_tool` decision is rejected with **`TOOL_REJECTED`**.
- **D-06 [MCP deferred to Phase 8]:** `MCPClient` (StreamableHTTP), `MCPRegistry`, and `NowPilotMainServer` (12 tools) are **NOT Phase 3** — they are dependency-blocked (PageContentService → 4a, NotesDB → 5, ClipboardHelper → 8) and must ship WITH `ToolCapabilityManifest`/verifiers (Phase 8a, TOL-01…05), never governance-less. **AI-07 is re-mapped to Phase 8** (§18 is authoritative over the REQUIREMENTS.md row; REQUIREMENTS gets a note).

### Persona Pipeline (AI-05 / R-7 / R-2)
- **D-07 [type seeding — OptimizedContext]:** The `OptimizedContext` interface (matching §2.3 verbatim) and `PromptSection` (Appendix C) are **seeded early in `src/core/ai/types.ts`** (a Phase-3 create-list file) so the runtime signatures compile against the real types. Phase 4's `src/core/context/ContextOptimizer.ts` **imports the types from the AI home** — no second declaration (R-1). `PromptSection` lives in `src/core/ai/types.ts` for the same reason (PromptCacheAdapter is a Phase-3 consumer).
- **D-08 [fixture builder]:** Tests drive Planner/Renderer/Orchestrator from a **`tests/fixtures/optimizedContext.ts`** deterministic, typed builder (D-20/D-21 philosophy: seeded randomness, fixed IDs, edge-parameterized on tier/model/budgets) matching the §2.3 shape. This is a test fixture, NOT a runtime module.
- **D-09 [np_persona accessor]:** Phase 3 ships a **small Setting.ts-backed reader** for the canonical **`np_persona`** key — `PersonaProfileSchema`-validated (Appendix N.1), per-key permissioned via the Phase-2 Setting registry — **injected into PersonaInjector as a config provider (not imported)**. `resolvePersona()` reads `prefs.personaOverrides`; empty/invalid key → **`PERSONA_LOAD_FAILED`** → `DEFAULT_PERSONA` fallback. Satisfies both DONE-when clauses ("personaOverrides apply without a code change") and R-7/R-2 (config in `np_persona`, never the fact store).
- **D-10 [zero-change handoff]:** Read-only this phase. Persona editor (RICH-R-04) = Phase 7; the store *writer* = Phase 5 (`PreferenceMemoryStore`). Phase 5 reads/writes the **same `np_persona` key**, so PersonaInjector is untouched — only the injected provider swaps.
- **D-11 [MemoryExtractor stage]:** `PersonaInjector.inject()` accepts the `memoryExtractor` stage (already in `PipelineStage`, Appendix N.2) and is proven with a **unit test on the injector**; the actual MemoryExtractor call site lands Phase 5.

### Provider Layer (AI-01 / §10 / Appendix D)
- **D-12 [OpenAICompatProvider]:** `OpenAICompatProvider.ts` is a **factory/config variant of OpenAIProvider — NOT a 5th `ProviderId`**. It exports a factory (e.g. `createOpenAICompatProvider({ baseURL })`) returning an OpenAI-config provider with `id: 'openai'` + custom `baseURL`. Violating the four-ID rule (§0.2) or the `ProviderConfigSchema` enum is forbidden; Appendix D already maps `deepseek-chat` → `providerId: 'openai'`.
- **D-13 [privacyMode mapping]:** Pure helper **`privacyModeFromPrefs(prefs)` in `TierResolver.ts`**; no new preferences field (no second source of truth). `allowCloudFallbackFromLocal: false → 'prefer-local'`; `true → 'cloud-ok'`; default (no prefs) → `'prefer-local'`. **`'local-only'` is RESERVED** for a future explicit privacy toggle. Rationale (hardened): `false → 'local-only'` is a correctness landmine — `resolveTier` would filter to ollama-only and return `null` for any cloud-only/cloud-primary config, leaving the user unable to run AI. The §1.5 boolean governs **fallback direction**, not global cloud-disable. The "no silent local→cloud switch" guarantee is enforced in **ProviderRouter** when traversing the fallback chain (never a `resolveTier` filter).
- **D-14 [circuit-breaker state scope]:** `RouterAttemptState.circuitBreakerOpen` + `hasStreamedFirstToken` are **in-memory per-surface** for v0.1 (dies on panel close; no cross-surface race on the single-writer bus). Persistence/sharing revisited in a later phase. One-line ADR decision, not a new mechanism.

### Cost Guardrails (AI-04 / §1.4 / §1.5 / §1.6.1)
- **D-15 [tier caps + routing now, monthly budget → Phase 6]:** Phase 3 enforces the cost governors the spec actually defines: **§1.4 tier caps at AgentOrchestrator** (plannerCap/toolCap/mcpChaining per context tier), **cheapest-capable routing + fallback + circuit breaker** (ProviderRouter §1.5 / TierResolver Appendix D), and the **three non-multiplying retry bounds** (§1.6.1 / R-2). These bound per-turn cost deterministically.
- **D-16 [monthly aggregate deferred]:** The **monthly aggregate budget (AI-04) is deferred to Phase 6** — it is un-enforceable before AITransactionLog/TokenLedger exist and currently un-specified (no rate table, reset semantics, or ledger schema); building it now would invent a mechanism + throwaway storage key (§0.2/§0.5.1). **Reserve:** an optional **no-op `budgetGuard` hook on ProviderRouter** so Phase 6 wires the ledger pre-flight without a rebuild. **Doc:** Phase 6 ADR to define AI-04 (rolling token/cost accumulator + month reset + per-model rate + pre-flight block error + settings action); mark AI-04 under-specified in REQUIREMENTS.md.
- **D-17 [retry layering]:** ProviderRouter retry/circuit breaker (§1.5: retryable TIMEOUT/PROVIDER_5XX/NETWORK/RATE_LIMITED; non-retryable AUTH/MODEL_UNKNOWN/SCHEMA_INVALID/HOST_NOT_PERMITTED; breaker = 3 failures in 60s → open 5min) is the FIRST retry layer; never nested (exactly the three §1.6.1 layers).

### Structured Output (Golden Rule 4 / Appendix L)
- **D-18 [callProviderJsonMode ownership]:** **ProviderRouter constructs `callProviderJsonMode`.** The Router owns provider selection/fallback and holds the ILLMProvider adapter that knows the native JSON flag, so it resolves a per-provider `jsonMode: 'native' | 'prompt'` capability and builds the `StructuredOutputContext` closure over the resolved (providerId, model). **Ollama → `'prompt'`** (model-dependent, §10.2) unless the model advertises native JSON; OpenAI/Anthropic/Gemini → `'native'`.
- **D-19 [prompt-mode fallback]:** `'prompt'` path = prompt-only JSON coercion → **one Appendix L repair** → `STRUCTURED_OUTPUT_FAILED`. Never nested (§1.6.1 / R-2). Consumers stay pure: PlannerService + RendererService just call `requestJson(schema, prompt, ctx)`. Fallback correctness: because JSON-mode capability changes with the provider, **only the Router** can hand out the matching callback after a failover. Boundary: Router = *how to invoke* JSON mode; StructuredOutput = validate + single repair.

### Orchestrator (Appendix I)
- **D-20 [pre-evidence AgentOrchestrator]:** Phase 3 builds **Appendix I verbatim** — `runAgentTurn` returns the simple `AgentTurnOutput { operationId, streamedText, toolResults, reasonCode }`, no trajectory states, no `CompletionEvidence`, no OutcomeVerifier. **Phase 3a rewires it** with AGT-02 checkpointing / outcome verification. Do NOT build reliability into the Phase-3 orchestrator (never jump ahead; a model that has read §28.2 must not leak evidence machinery in).

### ProviderRegistry ↔ KeyVault (R-3 / 02-CONTEXT D-04)
- **D-21 [error-emission half only]:** Phase 3 owns the **error-emission half** of the `PROVIDER_KEY_UNREADABLE` gate: the registry surfaces the typed error on construction/validation (decrypt failure, installSecret cleared, tampered ciphertext — all one state) and **marks the provider disabled** (`enabled: false`, treated as unconfigured). The UI gate wiring (onboarding "configure later", Options re-entry) is Phase 7. **No auto-wipe, no auto-regenerate** (02-CONTEXT D-04 preserved).

### the agent's Discretion
- PromptCacheManager / PromptCacheAdapter (Appendix K) internals: cache-hint transformation per provider, stable-section hashing, when hits/misses surface as debugLog vs silent. Follow Appendix K verbatim where it gives code; leave tuning to research/planning.
- Provider adapter internals (ILLMProvider.chat/getModels/validateConfig/getAISDKModel per §10.1 + Appendix C types) — the ai-sdk wire-up details (e.g. exact `LanguageModel` construction per @ai-sdk package) are the researcher's job.
- StreamAdapter (StreamAdapter.ts) internals: how provider stream chunks normalize to `LLMStreamChunk` before ChunkBuffer.
- Co-located streaming hook placement/naming until Phase 7 promotes it (keep it thin; the fixture-helper path is D-02).
- ChunkBuffer byte-rate throttle constants (Appendix J.1 default 8_000 bytes/s) — keep the reference default unless tests dictate otherwise.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec (authoritative)
- `.planning/PRODUCT_SPEC_v0_1.md` §18 "Master Implementation Phases" (Phase 3 at lines ~2605–2652) — authoritative create-list (17 src/core/ai files), required tests (8 files), DONE-when criteria. **Phase 3 addendum**: ChatPage 3-state lifecycle (skeleton→minimal→full) + the fixture-helper deletion target (D-01/D-02) + toolSchemas.ts = contract + one tool (D-04).
- `.planning/PRODUCT_SPEC_v0_1.md` §1 "Cost-Effective Runtime AI Architecture" (lines ~227–411) — §1.2 Planner/Executor/Renderer rules, §1.3 prompt shape + caching, §1.4 tier caps table, §1.5 routing/fallback/breaker, §1.6.1 retry bounds.
- `.planning/PRODUCT_SPEC_v0_1.md` §2.3 "ContextOptimizer Contract" (lines ~453–479) — the OptimizedContext shape D-07 seeds; §2.4 degradation, §2.5 minimal mode (Phase 4, context only).
- `.planning/PRODUCT_SPEC_v0_1.md` §10.1–10.3 "Provider Interface / Implementations / Config Schema" (lines ~1528–1574) — ILLMProvider contract, four-provider table, ProviderConfigSchema, Ollama 2048-token warning (Flow 5).
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §0.5.1 (lines ~65–226) — DO NOT rules (four-ID enum, no invented storage), 10 golden rules (4 = Zod + one repair; 5 = no multiplying retries).
- `.planning/PRODUCT_SPEC_v0_1.md` §8.5 "File Structure" (lines ~1310–1394) — canonical src/core/ai tree (incl. mcp/ path for Phase 8).

### Appendices (all in `.planning/PRODUCT_SPEC_v0_1.md`)
- **Appendix C** (line ~4137) — canonical types: `LLMMessage`, `LLMOptions`, `LLMStreamChunk`, `ModelInfo`, `ProviderConfig`, `PromptSection` (line ~4583), `ToolExecutionResult`, `ToolSchemaRef`; **Appendix C.2** (line ~4918) — error codes (must add: `TOOL_REJECTED`, `PERSONA_LOAD_FAILED`, `STRUCTURED_OUTPUT_FAILED` canonical before shipping; reuse `PROVIDER_KEY_UNREADABLE`).
- **Appendix D** (line ~5110) — TierResolver + TIER_TO_MODEL_CANDIDATES + `resolveTier` (haiku/flash tiers; privacyMode semantics; D-13 helper lives here).
- **Appendix I** (line ~5500) — AgentOrchestrator reference (D-20 verbatim); `runAgentTurn` signature.
- **Appendix J** (line ~5596) — ChunkBuffer (J.1) + useStreamingLLM (J.2, reference for the co-located hook).
- **Appendix K** (line ~5700) — PromptCacheAdapter over PromptSection[] (D-07 type home dependency).
- **Appendix L** (line ~5795) — StructuredOutput.requestJson + `callProviderJsonMode` (D-18/D-19).
- **Appendix N** (line ~6031) — PersonaProfile schema + DEFAULT_PERSONA (N.1) + PersonaInjector/PipelineStage/resolvePersona/buildPersonaBlock (N.2) (D-09…D-11).

### Persona / RICH (in `.planning/PRODUCT_SPEC_v0_1.md`)
- **§17.7 RICH** (RICH-R-01/02/05 at lines ~2325–2329; R2 reconciliation at line ~2452) — persona profile identity/personality/language; persona is user config in `np_persona` (PreferenceMemoryStore), never the fact store.
- **§3.5 Preference Memory** (line ~629) — `np_persona` key semantics + UserPreferences.personaOverrides.

### Project planning artifacts
- `.planning/ROADMAP.md` — Phase 3 goal + success criteria (lines ~120–134); UI hint: yes.
- `.planning/REQUIREMENTS.md` — AI-01…07 (lines ~36–42). **AI-07 re-mapped to Phase 8** (D-06); AI-04 noted under-specified (D-16).
- `.planning/PROJECT.md` — core value, constraints, key decisions (Planner→Executor→Renderer, cost-effective by design, no banned packages).
- `AGENTS.md` — 10 golden rules, risk register (R-1..R-10), approved stack (@ai-sdk/*, ai ^4, zod, @ant-design/x), banned list.
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-CONTEXT.md` — D-01..D-21: vault at-rest obfuscation, PROVIDER_KEY_UNREADABLE single state, np_providers per-provider encrypted envelopes, Setting.ts per-key permissioned wrapper, TraceRedactor.
- `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-CONTEXT.md` — B3/R-1 (ProviderRegistry canonical AI home), D-07 onboarding gate, D-09 Options deep-link.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/ai/ProviderRegistry.ts` — Phase-1 gate primitive (registerActiveProvider/hasActiveProvider/subscribe/clear, lazy singleton). Phase 3 extends THIS file (01-CONTEXT B3): add provider config presence, the `PROVIDER_KEY_UNREADABLE` error-emission path (D-21), and feed `get-provider-info` (D-04).
- `src/core/security/KeyVault.ts` + `src/core/storage/EncryptedStorage.ts` — AES-GCM vault + per-provider envelope decrypt (`np_providers.<id>`). Phase 3 wires provider config reads through the vault; decrypt failure → PROVIDER_KEY_UNREADABLE.
- `src/core/storage/Setting.ts` — per-key permissioned typed wrapper over chrome.storage.local/sync (02-CONTEXT D-09). The `np_persona` accessor (D-09) registers a new key here; provider config keys extend the permission table.
- `src/core/prompts/index.ts` — Appendix A verbatim PROMPTS: `planner`, `renderer`, `memoryExtractor`, `repairJson` (cacheable, tier-tagged). Byte-stable, persona NOT hard-coded — PersonaInjector prepends at request time. No `executor` prompt (executor is deterministic).
- `src/core/error/errorCodes.ts` + `debugLog.ts` — canonical code registry; Phase 3 extends ERROR_CODES IN PLACE with TOOL_REJECTED / PERSONA_LOAD_FAILED / STRUCTURED_OUTPUT_FAILED and mirrors into spec Appendix C.2 (Golden Rule 9).
- `src/components/pages/ChatPage.tsx` — empty-state shell (Card/Empty/ChatPageSkeleton). Phase 3 upgrades to Bubble+Sender send/stream (D-01); shared by Side Panel + Standalone shells.
- `src/core/content/PageContext.ts` / `src/types/workspace.ts` — ProviderId declared locally in workspace.ts (line 8) with a NOTE: swap import to `src/core/ai/types.ts` when Phase 3 lands (D-07 canonicalizes the ProviderId home). **Planning must include this swap.**
- `src/core/utils/RateLimiter.ts`, `src/core/http/Requester.ts` — Phase-2 primitives; provider adapters may reuse Requester patterns but NOT for direct provider calls from background (R-3: AI lives in Side Panel/Standalone).

### Established Patterns
- **Spec-verbatim file paths (§8.5/§18) + Appendix C types (R-1)** — no invented identifiers; ai/types.ts is the seeded type home (D-07); OpenAICompat is a factory, not an id (D-12).
- **chrome.storage + Setting.ts + sanitizeStored (T-1-13)** — the per-key permissioned pattern the np_persona accessor extends.
- **Golden Rule 9** — every catch calls debugLog with a canonical §C.2 code; new Phase-3 codes must be canonicalized into spec Appendix C.2 before shipping.
- **Golden Rule 4** — requestJson + one repair then STRUCTURED_OUTPUT_FAILED; never hand-parse JSON.
- **verify:phase-N gate** — eslint + prettier + tsc --noEmit + wxt build + vitest run + isolation check (Phase 1/2 scripts are the template for verify:phase-3).
- **R-3** — provider adapters + AI runtime live in Side Panel/Standalone only.
- **Three retry layers, non-multiplying** (§1.6.1 / R-2) — ProviderRouter + AGT-04 replan (3a) + one per-stage retry.

### Integration Points
- `src/entrypoints/sidepanel/main.tsx` / `src/entrypoints/standalone/main.tsx` — where the AI runtime init (ProviderRegistry wiring, provider config load from vault, persona accessor load) fires on surface mount (precedent: WorkspaceStore.init()).
- `src/core/ai/types.ts` — new Phase-3 home for ProviderId (canonical), OptimizedContext, PromptSection, LLM types; `src/types/workspace.ts` swaps its local ProviderId import here.
- `src/core/ai/ProviderRegistry.ts` — extended in place; ExecutorService's `get-provider-info` reads it.
- `src/components/pages/ChatPage.tsx` — upgraded minimal chat consumer; the co-located streaming hook lives beside it until Phase 7 promotes it.
- Tests: the 8 required §18 test files live under `tests/core/ai/**` + `tests/core/ai/persona/**`, driven by `tests/fixtures/optimizedContext.ts` (D-08). Existing env: vitest + jsdom-align + threads pool; provider tests need ai-sdk/msw-style mocking of the @ai-sdk providers — researcher should verify the exact mechanism (Phase 1/2 didn't exercise provider network calls).
- `src/core/security/TraceRedactor.ts` — request/response bodies flowing through provider calls route through redaction before any log (R-10); verify StreamAdapter/ProviderRouter log paths.

</code_context>

<specifics>
## Specific Ideas

- The **persona block must be byte-stable for a given persona** so prompt caching is preserved (§1.3, Appendix A note) — the np_persona accessor must produce a stable, ordered serialization.
- The three retry layers are **the** cost-control story; document the layer boundaries (ProviderRouter vs AGT-04 vs per-stage) in the code so a cheap model doesn't nest them (R-2).
- `PROVIDER_KEY_UNREADABLE` is **one shared state + one code** (restore-on-new-install / installSecret-cleared / tampered ciphertext) — Phase 3 emits it; Phase 7 wires the recovery UX.
- ProviderRegistry must stay **dependency-free** (Pitfall 4): it may not import zustand/react; vault reads happen in the wiring layer, and the typed error is surfaced across that boundary.

</specifics>

<deferred>
## Deferred Ideas

- **MCP client (StreamableHTTP) + MCPRegistry + NowPilotMainServer (12 tools)** — Phase 8 (D-06); re-maps AI-07. Must ship WITH ToolCapabilityManifest/verifiers (Phase 8a TOL-01…05).
- **Monthly aggregate budget (AI-04 second half)** — Phase 6 with AITransactionLog/TokenLedger; Phase 6 ADR to define rate table, reset semantics, ledger schema, pre-flight block, settings action (D-16). Reserve: no-op `budgetGuard` hook on ProviderRouter.
- **ContextOptimizer / ContextCompressor / ModelContextTier** — Phase 4; Phase 3 seeds the OptimizedContext type + fixture helper, which Phase 4 replaces (D-07/D-08/D-02).
- **Trajectory states / OutcomeVerifier / CompletionEvidence / AGT-04 replan** — Phase 3a; Phase 3 builds Appendix I verbatim (D-20).
- **RICH chat polish** (Welcome, Prompts, clarification/follow-up chips, persona header, stage indicators, chat-history list, Agent toggle, action panels) — Phase 7.3+ (D-03).
- **Persona editor (RICH-R-04) + provider Options dialog + budget cap UI** — Phase 7 Options (D-10).
- **PreferenceMemoryStore / UserMemoryStore / MemoryEngine** — Phase 5; np_persona writer lands there, PersonaInjector untouched (D-10).
- **Circuit-breaker persistence / cross-surface sharing** — future phase; in-memory per-surface for v0.1 (D-14).
- **`privacyMode: 'local-only'` explicit privacy toggle** — future; enum value reserved now (D-13).

None — discussion stayed within phase scope; all deferred items tracked above.

</deferred>

---

*Phase: 3-Cost-Effective AI Runtime (+ Persona seed)*
*Context gathered: 2026-08-09*
