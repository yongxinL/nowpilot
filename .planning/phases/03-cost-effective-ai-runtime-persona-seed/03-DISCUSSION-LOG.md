# Phase 3: Cost-Effective AI Runtime (+ Persona seed) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-09
**Phase:** 3-Cost-Effective AI Runtime (+ Persona seed)
**Areas discussed:** Streaming chat UI scope, Tools & MCP scope, Persona config sourcing, Monthly budget (AI-04), + 10 user-raised technical items (OptimizedContext seeding, PromptSection home, OpenAICompatProvider, MemoryExtractor persona, JSON-mode capability, privacyMode mapping, pre-evidence AgentOrchestrator, circuit-breaker scope, empty tool registry, ProviderRegistry↔KeyVault)

---

## Streaming Chat UI Scope (AI-03 / AI-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal functional chat | ChatPage hosts a real send+stream flow using Ant X Bubble+Sender; streamed via ChunkBuffer + co-located hook; RICH polish stays Phase 7 | ✓ |
| Core-only + demo harness | No Phase 3 UI; streaming proven via core tests + demo surface | |

**User's choice:** Minimal functional chat, scoped.
**Notes:** Hook sends through runAgentTurn with a hand-built OptimizedContext fixture from a core helper (not React, not a proto-optimizer) to honor Golden Rule 3 until Phase 4's ContextOptimizer replaces it. Fenced out (Phase 7.3+): Welcome/Prompts/chips/persona header/stage indicators/chat history/Agent toggle/action panels. ChatPage 3-state lifecycle (skeleton→minimal→full) + fixture helper recorded as a Phase-4 deletion target in the §18 Phase 3 addendum.

---

## Tools & MCP Scope (AI-02 / AI-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal tools now, MCP in Phase 8 | toolSchemas.ts ships ToolSchemaRef contract + closed-enum builder + one safe built-in (get-provider-info); MCP deferred, dependency-blocked | ✓ |
| Build MCP substrate now | Phase 3 also builds MCPClient + MCPRegistry + built-in tools per AI-07 mapping | |

**User's choice:** Minimal tools now, MCP → Phase 8.
**Notes:** Exactly one safe built-in (get-provider-info, dangerous:no, depends only on Phase-3 ProviderRegistry) proving the closed z.enum + run_tool + Executor accept/reject (TOOL_REJECTED) paths. MCP deferred because dependency-blocked (PageContentService 4a, NotesDB 5, ClipboardHelper 8) and must ship with ToolCapabilityManifest/verifiers (Phase 8a TOL-01…05), never governance-less. Rule: empty registry → skip the enum, reject any run_tool with TOOL_REJECTED (avoid z.enum([])). AI-07 re-mapped to Phase 8 (§18 authoritative over REQUIREMENTS); addendum notes toolSchemas.ts = contract + one tool.

---

## Persona Config Sourcing (AI-05 / R-7)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal np_persona accessor | Setting.ts-backed reader for canonical np_persona key, PersonaProfileSchema-validated, injected as config provider | ✓ |
| DEFAULT_PERSONA only | Phase 3 uses default persona; overrides land with Phase 5 | |

**User's choice:** Minimal np_persona accessor.
**Notes:** Setting.ts-backed reader for the canonical `np_persona` key — PersonaProfileSchema-validated (Appendix N.1), per-key permissioned via the Phase-2 Setting registry — injected into PersonaInjector as a config provider (not imported). resolvePersona() reads prefs.personaOverrides; empty/invalid key → PERSONA_LOAD_FAILED → DEFAULT_PERSONA fallback. Satisfies both DONE-when clauses and R-7/R-2. Read-only this phase: persona editor (RICH-R-04) = Phase 7; the store writer = Phase 5. Zero-change handoff: Phase 5's PreferenceMemoryStore reads/writes the same key, so PersonaInjector is untouched — only the injected provider swaps.

---

## Monthly Budget (AI-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal spend ledger + hard cap | chrome.storage.local ledger + configurable monthly cap enforced at AgentOrchestrator | |
| Tier caps only | Phase 3 enforces §1.4 tier caps + routing only; monthly budget deferred to Phase 6 | ✓ |

**User's choice:** Tier caps + routing only; monthly budget → Phase 6.
**Notes:** Phase 3 enforces the cost governors the spec actually defines: §1.4 tier caps at AgentOrchestrator, cheapest-capable routing + fallback + circuit breaker (ProviderRouter §1.5 / TierResolver App. D), three non-multiplying retry bounds (§1.6.1). Monthly aggregate budget deferred to Phase 6 — un-enforceable before AITransactionLog/TokenLedger, un-specified (no rate table, reset semantics, ledger schema) — building it now would invent a mechanism + throwaway storage key (§0.2/§0.5.1). Reserve: optional no-op budgetGuard hook on ProviderRouter so Phase 6 wires the ledger pre-flight without a rebuild. Phase 6 ADR to define AI-04; mark AI-04 under-specified in REQUIREMENTS.

---

## OptimizedContext Seeding (user-raised #5)

| Option | Description | Selected |
|--------|-------------|----------|
| Type seeded early + fixture | Phase 3 tests drive from tests/fixtures/optimizedContext.ts stub matching §2.3 shape | ✓ |
| (alt) Hand-built fixture only, no early type | Type remains Phase 4 | |

**User's choice:** Type seeded early; tests drive from a hand-built fixture. The single biggest thing to settle — resolved: OptimizedContext declared in src/core/ai/types.ts; tests use tests/fixtures/optimizedContext.ts (deterministic typed builder); Phase 4 ContextOptimizer imports the type. Fixture helper is a Phase-4 deletion target.

---

## PromptSection Type Home (user-raised #6, R-1 risk)

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Lift into Phase-3 home | src/core/ai/types.ts (Phase-3 create-list); Phase 4 imports it | ✓ |
| (b) Declare in Phase 4 + local interface | Accept local interface in PromptCacheAdapter until Phase 4 | |

**User's choice:** (a) Lift into src/core/ai/types.ts. Prevents a cheap model inventing @/types/prompt or a second local definition (exactly the R-1 failure).

---

## OpenAICompatProvider (user-raised #7)

| Option | Description | Selected |
|--------|-------------|----------|
| Factory/config variant of OpenAIProvider | Same id: 'openai', custom baseURL; no 5th ProviderId | ✓ |
| (alt) Own class with own ID | Violates four-ID rule + ProviderConfigSchema enum | |

**User's choice:** Factory/config variant of OpenAIProvider (id: 'openai', custom baseURL). Appendix D already maps deepseek-chat → providerId: 'openai'. Confirmed must-be — otherwise violates §0.2 and the schema enum.

---

## MemoryExtractor Persona Wiring (user-raised #8)

| Option | Description | Selected |
|--------|-------------|----------|
| Injector accepts stage + unit test now | PipelineStage already includes 'memoryExtractor' (Appendix N.2); prove with injector unit test | ✓ |
| (alt) Wait for MemoryExtractor file | Call site deferred, but injector capability proven now | |

**User's choice:** PersonaInjector.inject() accepts the 'memoryExtractor' stage and is proven with a unit test on the injector; the actual MemoryExtractor call site defers to Phase 5.

---

## JSON-Mode Capability (user-raised #9)

| Option | Description | Selected |
|--------|-------------|----------|
| ProviderRouter constructs callProviderJsonMode | Router resolves per-provider jsonMode: 'native' \| 'prompt' and builds the closure over resolved (providerId, model) | ✓ |
| PlannerService constructs it | Planner resolves from the provider it was routed to | |

**User's choice:** ProviderRouter constructs callProviderJsonMode. Router owns selection/fallback + holds the ILLMProvider adapter that knows the native JSON flag. Ollama → 'prompt' (model-dependent, §10.2) unless the model advertises native JSON; OpenAI/Anthropic/Gemini → 'native'. 'prompt' fallback: prompt-only JSON coercion → one Appendix L repair → STRUCTURED_OUTPUT_FAILED (never nested). Consumers stay pure: PlannerService + RendererService just call requestJson(schema, prompt, ctx). Only the Router can hand out the matching callback after a failover. Boundary: Router = how to invoke JSON mode; StructuredOutput = validate + single repair.

---

## privacyMode Mapping (user-raised #10)

| Option | Description | Selected |
|--------|-------------|----------|
| false→local-only, true→cloud-ok | Rejected — correctness landmine: resolveTier filters to ollama-only, cloud-only config returns null, user can't run AI | |
| false→prefer-local, true→cloud-ok (hardened) | prefer-local keeps cloud candidates eligible; the 'no silent local→cloud switch' enforced in ProviderRouter §1.5 fallback-chain traversal; local-only reserved | ✓ |

**User's choice:** Hardened — false → prefer-local, true → cloud-ok; local-only reserved. Pure helper privacyModeFromPrefs(prefs) in TierResolver.ts; no new preferences field (no second source of truth). Rejecting false→local-only: §1.5 boolean governs fallback direction, not global cloud-disable. Recorded as a decision-log entry since privacyMode isn't a spec'd preferences field.

---

## Pre-Evidence AgentOrchestrator (user-raised #11)

| Option | Description | Selected |
|--------|-------------|----------|
| Appendix I verbatim | Simple AgentTurnOutput { reasonCode }; no trajectory/evidence | ✓ |
| (alt) Build reliability now | Leaks Phase 3a machinery in early | |

**User's choice:** Phase 3 builds Appendix I verbatim (no trajectory states, no CompletionEvidence, no OutcomeVerifier). Phase 3a rewires it with AGT-02/outcome verification. State explicitly so a model that has read §28.2 doesn't over-build (ties to one-phase-per-response).

---

## Circuit-Breaker State Scope (user-raised #12)

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory per-surface | Dies on panel close; no cross-surface race on single-writer bus | ✓ |
| (alt) Persisted/shared | Outlives turns but adds cross-surface sync complexity | |

**User's choice:** In-memory per-surface for v0.1, noted as a one-line ADR decision. The 5-min cool-down implies state that outlives one turn; spec is silent — simplest option chosen, persistence revisited later.

---

## Empty Tool Registry → z.enum (user-raised #13)

| Option | Description | Selected |
|--------|-------------|----------|
| Skip enum + reject run_tool | Schema builder omits run_tool when zero tools; any run_tool rejected with TOOL_REJECTED | ✓ |
| (alt) z.enum with placeholder | Invalid — z.enum requires a non-empty tuple | |

**User's choice:** When no tools registered, PlannerDecisionSchema is built without the run_tool branch; any stray run_tool decision rejected with TOOL_REJECTED. Avoids z.enum([]).

---

## ProviderRegistry ↔ KeyVault PROVIDER_KEY_UNREADABLE (user-raised #14)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 owns error-emission half | Registry surfaces typed error on construction/validation, marks provider disabled | ✓ |
| (alt) Full UI gate wiring now | UI wiring belongs to Phase 7/onboarding | |

**User's choice:** Phase 3 only owns the error-emission half: ProviderRegistry surfaces the typed PROVIDER_KEY_UNREADABLE error on construction/validation and marks the provider disabled; the UI gate wiring is later. No auto-wipe, no auto-regenerate (02-CONTEXT D-04 preserved).

---

## the agent's Discretion

- PromptCacheManager/PromptCacheAdapter (Appendix K) internals and cache-hint tuning.
- Provider adapter internals (ai-sdk wire-up, exact LanguageModel construction per @ai-sdk package).
- StreamAdapter internals (stream chunk → LLMStreamChunk normalization).
- Co-located streaming hook placement/naming until Phase 7 promotion.
- ChunkBuffer byte-rate throttle constants (keep Appendix J.1 default 8_000 bytes/s unless tests dictate).

## Deferred Ideas

- MCP client + MCPRegistry + NowPilotMainServer (12 tools) → Phase 8 (dependency-blocked, needs Phase 8a governance).
- Monthly aggregate budget → Phase 6 (AITransactionLog/TokenLedger; Phase 6 ADR to define AI-04; no-op budgetGuard reserve).
- ContextOptimizer/ContextCompressor/ModelContextTier → Phase 4 (replaces seeded type + fixture helper).
- Trajectory states/OutcomeVerifier/CompletionEvidence/AGT-04 replan → Phase 3a.
- RICH chat polish, persona editor, provider Options dialog, budget cap UI → Phase 7.
- PreferenceMemoryStore (np_persona writer) → Phase 5.
- Circuit-breaker persistence/cross-surface sharing → future phase.
- privacyMode 'local-only' explicit privacy toggle → future (enum reserved now).
