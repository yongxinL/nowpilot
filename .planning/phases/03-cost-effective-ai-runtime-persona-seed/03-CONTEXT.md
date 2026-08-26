# Phase 3: Cost-Effective AI Runtime (+ Persona seed) - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the bounded **Planner → Executor → Renderer** pipeline streaming from user-configured OpenAI / Anthropic / Gemini / Ollama (+ OpenAICompat) providers, **tier-resolved routing (fast / balanced)**, and the **persona runtime wired into every AI call from day one**. Chat UI switches to the pipeline this phase.

**Scope is per spec §18 Phase 3.** Create list (19 files): `src/core/ai/types.ts`, `ILLMProvider.ts`, `ProviderRegistry.ts`, `providers/{OpenAI,Anthropic,Gemini,Ollama,OpenAICompat}Provider.ts`, `ProviderRouter.ts`, `TierResolver.ts` (#Appendix D), `PromptCacheManager.ts`, `PromptCacheAdapter.ts` (#Appendix K), `PlannerService.ts`, `ExecutorService.ts`, `RendererService.ts`, `AgentOrchestrator.ts` (#Appendix I), `StructuredOutput.ts` (#Appendix L), `toolSchemas.ts`, `StreamAdapter.ts`, `ChunkBuffer.ts` (#Appendix J), `persona/PersonaProfile.ts`, `persona/PersonaInjector.ts`. Required tests: 8 files under `tests/core/ai/`.

**DONE-when (verbatim):** Planner returns valid JSON decisions with closed `toolName` enum; Executor rejects unknown tools with `TOOL_REJECTED`; Renderer respects output caps; Provider fallback + circuit breaker tests pass (one provider down → next enabled provider); structured-output one-shot repair works (#Appendix L); PersonaInjector prepends the persona block to Planner/Executor/Renderer/MemoryExtractor system prompts, in the cached `[SYSTEM]` section so prompt caching is preserved; UserPreferences.personaOverrides (name/tone/brevity) apply without a code change.

**Out of scope (verified in spec §18 / PROJECT.md / REQUIREMENTS.md):** Agent reliability/evidence (Phase 4), ContextOptimizer/TokenBudget (Phase 5), page extraction (Phase 6), trust-aware context + receipts (Phase 7), persona PERSISTENCE to `np_persona` (RICH-R-05 → Phase 8, PreferenceMemoryStore), RICH persona UI / persona editor / "Meet NowPilot" card (Phase 15 sub-waves), AITransactionLog/TraceRedactor (Phase 11), diagnostics (Phase 11), tools beyond the framework (owning phases), multi-role collaboration (Phase 14).

**Research-driven requirements landing here (from `.planning/RESEARCH-RECONCILIATION.md` §D + SUMMARY.md):** REQ-R-? (phase-3 row: rebuild SSE against real provider wire formats — the current parser is coupled to a private proxy and returns empty on real providers, a confirmed production bug), Pitfall 5 per-provider conformance fixtures. Flag C: stream correlation reuses Phase-1 `OperationId` (no new id scheme).

</domain>

<decisions>
## Implementation Decisions

### Chat adoption timing — pipeline-first in Phase 3
- **D-44 (Chat switches to the pipeline now):** `useChatStreaming.ts` routes through `AgentOrchestrator` in Phase 3; the legacy `streamChatResponse` path in `src/services/aiProvider.ts` is retired for production chat (kept only behind the DEMO_MODE+DEV gate, D-12). The pipeline gets real production exercise in this phase — Planner/Executor/Renderer all fire on ordinary chat turns. — **Reversibility:** `costly` — rationale: replaces the chat streaming contract; both surfaces' chat hooks re-point at AgentOrchestrator, and streamChatResponse's retirement removes the fallback path.
- **D-45 (Turn-end persist; abort drops):** The pipeline persists each completed user/assistant message pair to ChatHistoryDB (IndexedDB) at turn end via the WriteJournal. Mid-stream chunks live only in memory + ChunkBuffer — no per-chunk chrome.storage writes (kills the P2 write-rate risk). Abort mid-stream → the partial assistant message is dropped (nothing persisted). — **Reversibility:** `reversible` — rationale: persistence timing change is local to the pipeline's completion handler.
- **D-45a (Chat persistence ownership boundary):** Phase 3 consumes the existing ChatHistoryDB and WriteJournal infrastructure delivered by earlier phases. Planning MUST verify the existing schema before implementation. If additional persistence fields are required outside the Phase-3 file inventory, implementation stops and ownership is reassigned to the phase that owns the affected storage module. Phase 3 MUST NOT invent a new transcript store. — **Reversibility:** reversible — rationale: ownership and phase-boundary clarification.
- **D-46 (Zero registered tools in Phase 3):** toolSchemas.ts declares the ToolDefinition shape, ToolCapabilityManifest, and the closed-enum generation contract, but Phase 3 registers ZERO tools. The production PlannerDecision path therefore produces only answer and ask_clarification outcomes. Executor MUST reject any direct or test-injected run_tool request whose toolName is absent from the registry and return TOOL_REJECTED. Real tools arrive with their owning phases (Research/PageContext/etc.). No fake tools, no governance surface to revoke. — **Reversibility:** reversible — rationale: additive tool registry; later phases register against the same contract.
- **D-47 (Canonical stream event union):** `StreamAdapter` normalizes every provider's wire format (OpenAI `[DONE]`, Anthropic `event:` types, Gemini inlineData, Ollama NDJSON) into a single canonical event union: `STREAM_START` / `STREAM_DELTA` / `STREAM_COMPLETE` / `STREAM_ERROR` / `STREAM_ABORTED`, mapped onto the locked §20.6 `ActiveStreamState` machine. `useStreamingLLM` + `ChunkBuffer` consume the canonical events; the old `onChunk`/`onDone` callback surface is retired. Gives diagnostics + recovery a single typed stream shape (future-proof for AITransactionLog). — **Reversibility:** `costly` — rationale: changes the streaming contract every consumer sees; reintroducing the callback surface later is a re-wiring.
- **D-48 (Golden test matrix — fixtures-driven):** Build a fixtures library covering: normal conversation, provider failure, provider fallback, invalid JSON, repair success, repair failure, unknown tool, persona override, stream abort, cancellation during streaming. Every Phase-3 component (Planner, Executor, Renderer, AgentOrchestrator, ProviderRouter, StructuredOutput, persona) is implementable and testable against these fixtures (user's 10-point contract item 10). — **Reversibility:** `reversible` — rationale: test-only assets.

### Provider config shape (D-30a hand-off) + endpoints
- **D-49 (Normalize in-memory; disk stays Phase-2 object):** `ProviderRegistry` reads the existing object shape (`{ providers: Record<CustomProviderId, CustomProviderDetail>, openAiKey, geminiKey }`) at hydrate and exposes a normalized in-memory registry internally. Persisted `np_providers` key keeps the Phase-2 object shape. Spec §15.1's `ProviderConfig[]` array form is achieved at the API boundary, not on disk — no user-visible config loss, no migration risk. This supersedes D-30a's "Phase 3 ProviderRegistry owns the migration": the migration is now normalization, not a disk rewrite. — **Reversibility:** `reversible` — rationale: an in-memory adapter; the disk shape is untouched and a later disk migration stays possible.
- **D-50 (np_endpoint_overrides implemented now):** Per-provider endpoint overrides in `chrome.storage.local` (`np_endpoint_overrides`), merged at load over the §10.6 ENDPOINTS defaults (openai `https://api.openai.com/v1`, anthropic `https://api.anthropic.com`, gemini `https://generativelanguage.googleapis.com`, ollama `http://localhost:11434/v1`). Keeps the D-12 rule that `localhost:12380` is never a canonical default. Options > General proxy fields write to this key. — **Reversibility:** `reversible` — rationale: additive storage key; §10.6 contract.
- **D-51 (Sync read API + boot hydration):** `ProviderRegistry` exposes synchronous reads (`getEnabled()`, `getById(id)`, `getAll()`); providers register declaratively at module load (OpenAI, Anthropic, Gemini, Ollama, OpenAICompat). Hydration happens once at boot before UI renders; no async in the read surface. — **Reversibility:** `reversible` — rationale: module API; swap to async is a bounded refactor.
- **D-52 (Live model discovery + session cache):** Keep the existing live discovery (`fetchProviderModels` semantics) for Options/Onboarding "refresh models" + connection test; `ProviderRegistry` caches the fetched list per provider in memory for the session. `TierResolver` matches against the cached list. No static model catalog to maintain. — **Reversibility:** `reversible` — rationale: cache is in-memory only.

### Tier defaults — capability tiers, no hard-coded slugs (overrides Appendix D placeholders)
- **D-53 (Ship capability tiers only):** Do NOT ship concrete model slugs in `TIER_TO_MODEL_CANDIDATES`. The table defines `fast` / `balanced` as capability tiers only (operator-selected low-cost vs higher-capability, per provider). Concrete slugs are resolved from live provider discovery + operator configuration, never hard-coded into the shipped spec. Rationale (user): no stale model names, no provider-release churn, no broken defaults when vendors rename models, works with OpenAI-compatible providers and custom Ollama installs. — **Reversibility:** `costly` — rationale: changes the meaning of the canonical Appendix D table; downstream tier consumers assume capability semantics.
- **D-54 (Manual assignment; pre-fill suggestion on first setup):** Tier assignment is manual in Options, write-through to `UserPreferences.fastModel` / `UserPreferences.balancedModel`. On FIRST provider setup, Options pre-fills the fast/balanced fields with the first-discovered model of each class (a suggestion the user accepts or changes before it persists). `TierResolver` returns null until persisted; the caller falls back or errors by design (Appendix D). — **Reversibility:** `reversible` — rationale: persisted preference keys, user-editable.
- **D-54a (TierResolver failure contract):** Until both UserPreferences.fastModel and UserPreferences.balancedModel are explicitly persisted, TierResolver returns null for the unresolved tier. ProviderRouter MUST NOT infer, auto-assign, substitute, or guess a model. AgentOrchestrator surfaces a configuration-required state to the caller and no provider request is started. Suggestions shown during provider setup are UI-only and MUST NOT affect runtime routing until confirmed and persisted by the operator. — **Reversibility:** reversible — rationale: failure-path clarification only.
- **D-55 (Per-stage explicit tier):** Each pipeline stage picks its tier explicitly via a `useTierForStage()`-style mapping: Planner uses `fast` where available (spec §1.2), Renderer uses `fast` for the final answer stream, Executor tool calls default to the turn's tier with per-tool override later. No single user-facing tier selector in Phase 3. — **Reversibility:** `reversible` — rationale: internal mapping; a user-facing selector can layer on later.
- **D-56 (OpenAICompat registered, tier-mapped only when assigned):** `OpenAICompatProvider` is registered with ProviderRegistry but has NO default entry in `TIER_TO_MODEL_CANDIDATES`; operators using self-hosted OpenAI-compatible endpoints (LM Studio, vLLM, proxies) assign its fast/balanced models explicitly in Options. — **Reversibility:** `reversible` — rationale: declarative registration + preference keys.

### Persona seed + injection
- **D-57 (Spec-verbatim default persona):** The shipped default `PersonaProfile` matches RICH-R-01's fields exactly: identity `name: 'NowPilot'`, tagline (privacy-first ServiceNow copilot), domain 'ServiceNow support engineering'; personalityCore `['privacy-first','helpful','precise','humble']`; behavioralDrivers `['asks clarifying questions','cites sources']`; languageStyle `tone: 'professional-warm'`, vocabulary 'technical-accessible', `brevity: 'brief'`; emotionalRepertoire `['empathy','encouragement','curiosity']`. No invented character. — **Reversibility:** `reversible` — rationale: seeded constant, replaceable by Phase 15 editor.
- **D-58 (Data-merge overrides in PersonaInjector):** `PersonaInjector.inject(profile, overrides)` merges at render time: `override.name` → `identity.name`; `override.tone` → `languageStyle.tone` (locked enum `'professional-warm'|'concise'|'friendly'`); `override.brevity` → `languageStyle.brevity` (`'brief'|'balanced'|'detailed'`). Partial overrides leave unset fields from the seeded profile. Pure data merge — adding a future override is a `UserPreferences` field, no code change. (Confirmed against spec lines 656-660 / §21.6 / §17.7.5.) — **Reversibility:** `reversible` — rationale: pure function; profile object untouched.
- **D-59 (Single choke-point injection):** `PersonaInjector` is called by the one assembly function that builds every system prompt (PromptCacheManager's system-prompt builder), so Planner, Executor, and Renderer in Phase 3 all get the persona automatically. The shared prompt-builder contract must remain reusable by the future MemoryExtractor owner, but Phase 3 does not create or integrate MemoryExtractor. The persona block is prepended FIRST inside the cached `[SYSTEM]` section, byte-stable per persona, preserving prompt caching (§1.3). No caller can forget the persona because there's one choke point. — **Reversibility:** `reversible` — rationale: one call site; moving it later is a single edit.

### the agent's Discretion
- **ILLMProvider interface shape:** exact method surface (stream vs requestJson, timeout threading) — follow §1.5 / §20.10 error-code mapping; the interface must let StreamAdapter normalize per-provider wire formats. Planner confirms field-level fidelity, no invention.
- **PromptCacheManager vs PromptCacheAdapter split:** §1.3 canonical section order + Appendix K per-provider hints are locked; how PromptCacheManager segments sections (`stable`/`unstable` tagging) and drives the 5-consecutive-miss → 60 s disable rule (§30, line 3060) is the planner's call.
- **RendererService output caps:** "Max normal output: 512 tokens unless the feature overrides" (§1.3 note) is the cap; how caps are declared/overridden per feature is the planner's call.
- **StructuredOutput provider JSON-mode flag:** Appendix L requires "the provider adapter must set the provider's JSON mode flag natively" — exact per-provider JSON-mode request shape is planner's call.
- **Prompt cache invalidation on persona override change:** when `UserPreferences` overrides change, the cached `[SYSTEM]` byte-stability must be re-derived — mechanism (profile-version-keyed cache hash) is planner's call.
- **ChatHistoryDB schema fit for pipeline turns:** whether the existing Phase-2 session/message store matches the turn-end pair write or needs a minor addition — planner verifies, no invention.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 3 block — Create list, Required tests, DONE-when checklist) — sole authority on the Phase-3 file inventory and gates.
- `.planning/PRODUCT_SPEC_v0_1.md` §1.1 / §1.2 — runtime design principle + Planner → Executor → Renderer flow, `PlannerDecisionSchema` (discriminated union), Planner/Executor/Renderer rules, §1.2 note on `ask_clarification` → RICH-C chips substrate.
- `.planning/PRODUCT_SPEC_v0_1.md` §1.3 — canonical section order + prompt caching (`[SYSTEM: cached, canonical]` ← persona prepended here, byte-stable); Renderer 512-token cap note.
- `.planning/PRODUCT_SPEC_v0_1.md` §1.4 — agent step limits / tier caps table (Planner/Executor call caps).
- `.planning/PRODUCT_SPEC_v0_1.md` §1.5 + §20.10 — ProviderRouter retry/fallback rules + circuit breaker (3 votes/60 s → open 5 min; per-code retryability table); `hasStreamedFirstToken` never-switch rule; AITransactionLog attempt recording.
- `.planning/PRODUCT_SPEC_v0_1.md` §10.6 — ENDPOINTS defaults + `np_endpoint_overrides` merge contract.
- `.planning/PRODUCT_SPEC_v0_1.md` §15.1 / §15.2 — np_providers (encrypted apiKey), PreferenceMemoryStore `np_persona` (Phase 8), storage partition rules.
- `.planning/PRODUCT_SPEC_v0_1.md` §20.6 — `ActiveStreamState` machine (locked; the canonical stream events map onto it).
- `.planning/PRODUCT_SPEC_v0_1.md` §21.6 — closed error code set (TOOL_REJECTED, STRUCTURED_OUTPUT_FAILED, SCHEMA_INVALID, PLANNER_FAILED, PROVIDER_* — no invented codes, D-38).
- `.planning/PRODUCT_SPEC_v0_1.md` §17.7 RICH-R-01/02/09/10 — persona profile fields, injection, chat/agent share persona, per-stage prompts; R-05 → Phase 8, R-04 → Phase 15.
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix A — persona block in system prompt + PROMPTS.repairJson.system canonical.
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix D — TierResolver reference implementation + TIER_TO_MODEL_CANDIDATES (D-53 overrides the placeholder approach to capability-tiers-only; the resolver mechanism, privacyMode handling, and priority sort remain verbatim).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix I — AgentOrchestrator reference implementation (the only module enforcing tier caps; no component may call PlannerService directly).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix J — ChunkBuffer reference implementation (rAF batching, 8 kB/s → 33 ms upgrade rule).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix K — PromptCacheAdapter per-provider cache hints (anthropic-ephemeral ≤4 breakpoints, gemini ≥32,768 cached tokens).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix L — StructuredOutput one-shot repair (zod-to-json-schema verbatim; exactly one repair; terminal STRUCTURED_OUTPUT_FAILED). Implementer note: do NOT substitute Zod 4 `z.toJSONSchema()` — that swap is deferred v0.2 cleanup.
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §5.2 — MV3 boundaries: AI/streaming runs in UI contexts only (side panel / standalone), never background SW.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 3: Cost-Effective AI Runtime (+ Persona seed)" — goal + success criteria + verification gate.
- `.planning/REQUIREMENTS.md` RICH-R-01/02/09/10 rows + phase-count table (Phase 3 = 4 v1 requirements).
- `.planning/RESEARCH-RECONCILIATION.md` §D — Phase-3 research row (SSE rebuild against real provider wire formats — current parser is a private-proxy-coupled confirmed bug) + §F decisions.
- `.planning/research/SUMMARY.md` — Phase 3 notes: SSE conformance fixtures, remove default-on simulated AI, OperationId reuse (Flag C), cost-effective model routing.
- `.planning/research/PITFALLS.md` P2 (chrome.storage write-rate — drives D-45 no-per-chunk-persist), P5 (SSE breaks only in production — per-provider conformance fixtures), P1 (SW suspension kills streams — streams live in surfaces).
- `.planning/STATE.md` — decision 12 (D-12 endpoint defaults / DEMO_MODE), 17 (D-21 strict ceiling → reduce to 0 in Phase 2-3: new Phase-3 code strict-clean, no new NP-STRICT markers).
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-CONTEXT.md` — D-30/D-30a (np_providers shape hand-off), D-35/D-37 (Requester + optional RateLimiter consumer), D-31/D-34 (journaled np_workspace persist).
- `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace-handoff/01-CONTEXT.md` — D-12 (DEMO_MODE gating, §10.6 authoritative endpoints).

### Codebase maps (refreshed 2026-08-18)
- `.planning/codebase/INTEGRATIONS.md` — per-provider wire formats + auth (OpenAI Bearer, Anthropic x-api-key, Gemini key param, Ollama /api/tags) — the SSE rebuild targets.
- `.planning/codebase/ARCHITECTURE.md` — per-surface module singletons; BroadcastBus/WorkspaceSync patterns.
- `.planning/codebase/STACK.md` — exact version table; zod ^4 shipped (but Appendix L pins zod-to-json-schema for structured output).
- `.planning/codebase/CONCERNS.md` — SSE parser private-proxy coupling (the Phase-3 fix), simulated-AI default path.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/aiProvider.ts` (465 lines) — per-provider fetch/auth/mode-listing + SSE parsing. The SSE parser is the confirmed bug (private-proxy envelope); Phase 3 rebuilds it into StreamAdapter per-provider adapters. `fetchProviderModels` / `testProviderConnection` semantics (D-12, T-01-10 error surfacing) are reused for live discovery (D-52). `AVAILABLE_MODELS` static list is NOT reused (D-52/D-53 — live discovery, no static catalog).
- `src/core/http/Requester.ts` (Phase 2) — UI-side fetch wrapper with AbortController threading, 25 s default timeout, optional RateLimiter injection (D-35/D-37). Phase-3 providers/StreamAdapter consume it.
- `src/core/http/` RateLimiter (Phase 2) — token bucket per-instance; optional injectable into the provider fetch path.
- `src/core/workspace/WorkspaceStore.ts` + `WriteJournal` (Phase 2) — the journaled persist path D-45's turn-end persistence writes through.
- `src/core/runtime/workerState.ts` — `ActiveStreamState` (locked §20.6) — the canonical stream state machine D-47 maps events onto.
- `src/core/runtime/RuntimeEnvelope.ts` — `OperationId` (Flag C: stream correlation reuses it).
- `src/components/chat/useChatStreaming.ts` — the chat streaming hook D-44 re-points at AgentOrchestrator; currently calls `streamChatResponse` directly (line 75).
- `src/core/log/debugLog.ts` — debug instrumentation the pipeline stages use (AITransactionLog is Phase 11).
- `src/types/index.ts` — `ProviderConfig` object shape (providers Record + openAiKey/geminiKey) D-49 keeps on disk; `CustomProviderId`, `CustomModelItem`.

### Established Patterns
- **Zustand persist stores + chromeStorageAdapter** — provider/endpoint/UserPreferences read paths (np_providers, np_endpoint_overrides, np_preferences).
- **Declare-now/populate-later** — used for WriteJournal ops (D-32) and now for tool registry (D-46): toolSchemas declares ToolDefinition + manifest contract; zero tools registered.
- **Typed discriminated unions** — PlannerDecisionSchema (§1.2), StageEvent (Appendix C.1), canonical stream events (D-47) all follow the same Zod-discriminated-union pattern.
- **Per-surface module singleton** — ProviderRegistry/AgentOrchestrator instantiate per surface (side panel / standalone), consistent with ARCHITECTURE constraints.

### Integration Points
- `useChatStreaming` → `AgentOrchestrator.runAgentTurn` (D-44) → Planner/Executor/Renderer → StreamAdapter → ChunkBuffer → React UI.
- `AgentOrchestrator` → `PromptCacheManager.buildSystemPrompt` → `PersonaInjector.inject` (D-59) → cached [SYSTEM] → ProviderRouter → provider adapters → StreamAdapter.
- `ProviderRegistry` → reads `np_providers` (Phase-2 object) + `np_endpoint_overrides` (D-50) + live model discovery cache (D-52) → TierResolver (D-53/D-54) → ProviderRouter (per-stage tier D-55).
- Pipeline turn-end → ChatHistoryDB via WriteJournal (D-45); aborted streams persist nothing.
- `UserPreferences.personaOverrides` → PersonaInjector data-merge (D-58) → byte-stable cached [SYSTEM].

</code_context>

<specifics>
## Specific Ideas

- **"No hard-coded model slugs in the shipped table"** — the user's explicit override of Appendix D: `TIER_TO_MODEL_CANDIDATES` ships `fast`/`balanced` as capability tiers only; slugs come from live discovery + operator assignment persisted in `UserPreferences.fastModel`/`balancedModel` (D-53/D-54). Selection rule the user specified: discover → validate availability → assign FAST candidate → assign BALANCED candidate → persist operator choice.
- **"Pre-fill suggestion, manual confirm" on first setup** — guided default (first-discovered per class) that is never auto-persisted unconfirmed (D-54).
- **Default provider mapping intent (first-setup guidance, not hard-coded):** OpenAI fast→first mini/cheap, balanced→first reasoning/general; Anthropic fast→Haiku-class, balanced→Sonnet-class; Gemini fast→Flash-class, balanced→Pro-class; Ollama fast→lightweight local, balanced→larger local. This is guidance for the Options pre-fill heuristic, NOT shipped slugs.
- **SSE rebuild is mandatory** — per-provider wire-format conformance fixtures (OpenAI [DONE], Anthropic event types, Gemini inline data, Ollama NDJSON); missing terminator = error (Pitfall 5).
- **zod-to-json-schema pinned** — Appendix L implementer note is explicit: do not substitute Zod 4 native `z.toJSONSchema()` in v0.1 (deferred v0.2 cleanup).
- **NP-STRICT ceiling → 0** — new Phase-3 code must be strict-clean from the start (STATE.md decision 17: reduce to 0 in Phase 2-3; no new `@ts-expect-error NP-STRICT` markers).

</specifics>

<deferred>
## Deferred Ideas

- **Persona persistence (`np_persona` in PreferenceMemoryStore)** — RICH-R-05 → Phase 8. Phase 3 seeds the profile in code; it does not persist across sessions (reconciliation R2: user config, not a fact).
- **Persona editor (Options → Persona)** — RICH-R-04 → Phase 15.
- **"Meet NowPilot" character card** — RICH-R-03 → Phase 15.3.
- **AITransactionLog + TraceRedactor (full)** — Phase 11; Phase 3 records attempts via debugLog/ErrorStore only.
- **Real tools (Research, PageContext, etc.)** — owning phases; Phase 3 ships framework + zero tools (D-46).
- **Multi-role collaboration (CollaborationCoordinator)** — Phase 14; §1.6 notes single-agent is the degenerate one-role case of the same runtime.
- **Diagnostics panel surfacing stream events** — Phase 11; the canonical stream event union (D-47) is the future substrate.
- **Implementation prohibition:** None of the deferred items listed below may be implemented, scaffolded, partially activated, feature-flagged, or exposed through UI in Phase 3 unless explicitly re-scoped by a later authoritative decision.

None of these belong in Phase 3 — discussion stayed within phase scope.

</deferred>

---
*Phase: 3-Cost-Effective AI Runtime (+ Persona seed)*
*Context gathered: 2026-08-26*