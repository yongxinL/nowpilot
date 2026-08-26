# Phase 3: Cost-Effective AI Runtime (+ Persona seed) - Research

**Researched:** 2026-08-26
**Domain:** Multi-provider AI streaming runtime (OpenAI / Anthropic / Gemini / Ollama / OpenAICompat), prompt caching, tiered routing, structured output, persona injection — Chrome MV3 extension UI contexts.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Chat adoption timing — pipeline-first in Phase 3
- **D-44 (Chat switches to the pipeline now):** `useChatStreaming.ts` routes through `AgentOrchestrator` in Phase 3; the legacy `streamChatResponse` path in `src/services/aiProvider.ts` is retired for production chat (kept only behind the DEMO_MODE+DEV gate, D-12). The pipeline gets real production exercise in this phase — Planner/Executor/Renderer all fire on ordinary chat turns. — **Reversibility:** `costly` — rationale: replaces the chat streaming contract; both surfaces' chat hooks re-point at AgentOrchestrator, and streamChatResponse's retirement removes the fallback path.
- **D-45 (Turn-end persist; abort drops):** The pipeline persists each completed user/assistant message pair to ChatHistoryDB (IndexedDB) at turn end via the WriteJournal. Mid-stream chunks live only in memory + ChunkBuffer — no per-chunk chrome.storage writes (kills the P2 write-rate risk). Abort mid-stream → the partial assistant message is dropped (nothing persisted). — **Reversibility:** `reversible` — rationale: persistence timing change is local to the pipeline's completion handler.
- **D-45a (Chat persistence ownership boundary):** Phase 3 consumes the existing ChatHistoryDB and WriteJournal infrastructure delivered by earlier phases. Planning MUST verify the existing schema before implementation. If additional persistence fields are required outside the Phase-3 file inventory, implementation stops and ownership is reassigned to the phase that owns the affected storage module. Phase 3 MUST NOT invent a new transcript store. — **Reversibility:** reversible — rationale: ownership and phase-boundary clarification.
- **D-46 (Zero registered tools in Phase 3):** toolSchemas.ts declares the ToolDefinition shape, ToolCapabilityManifest, and the closed-enum generation contract, but Phase 3 registers ZERO tools. The production PlannerDecision path therefore produces only answer and ask_clarification outcomes. Executor MUST reject any direct or test-injected run_tool request whose toolName is absent from the registry and return TOOL_REJECTED. Real tools arrive with their owning phases (Research/PageContext/etc.). No fake tools, no governance surface to revoke. — **Reversibility:** reversible — rationale: additive tool registry; later phases register against the same contract.
- **D-47 (Canonical stream event union):** `StreamAdapter` normalizes every provider's wire format (OpenAI `[DONE]`, Anthropic `event:` types, Gemini inlineData, Ollama NDJSON) into a single canonical event union: `STREAM_START` / `STREAM_DELTA` / `STREAM_COMPLETE` / `STREAM_ERROR` / `STREAM_ABORTED`, mapped onto the locked §20.6 `ActiveStreamState` machine. `useStreamingLLM` + `ChunkBuffer` consume the canonical events; the old `onChunk`/`onDone` callback surface is retired. Gives diagnostics + recovery a single typed stream shape (future-proof for AITransactionLog). — **Reversibility:** `costly` — rationale: changes the streaming contract every consumer sees; reintroducing the callback surface later is a re-wiring.
- **D-48 (Golden test matrix — fixtures-driven):** Build a fixtures library covering: normal conversation, provider failure, provider fallback, invalid JSON, repair success, repair failure, unknown tool, persona override, stream abort, cancellation during streaming. Every Phase-3 component (Planner, Executor, Renderer, AgentOrchestrator, ProviderRouter, StructuredOutput, persona) is implementable and testable against these fixtures (user's 10-point contract item 10). — **Reversibility:** `reversible` — rationale: test-only assets.

#### Provider config shape (D-30a hand-off) + endpoints
- **D-49 (Normalize in-memory; disk stays Phase-2 object):** `ProviderRegistry` reads the existing object shape (`{ providers: Record<CustomProviderId, CustomProviderDetail>, openAiKey, geminiKey }`) at hydrate and exposes a normalized in-memory registry internally. Persisted `np_providers` key keeps the Phase-2 object shape. Spec §15.1's `ProviderConfig[]` array form is achieved at the API boundary, not on disk — no user-visible config loss, no migration risk. This supersedes D-30a's "Phase 3 ProviderRegistry owns the migration": the migration is now normalization, not a disk rewrite. — **Reversibility:** `reversible` — rationale: an in-memory adapter; the disk shape is untouched and a later disk migration stays possible.
- **D-50 (np_endpoint_overrides implemented now):** Per-provider endpoint overrides in `chrome.storage.local` (`np_endpoint_overrides`), merged at load over the §10.6 ENDPOINTS defaults (openai `https://api.openai.com/v1`, anthropic `https://api.anthropic.com`, gemini `https://generativelanguage.googleapis.com`, ollama `http://localhost:11434/v1`). Keeps the D-12 rule that `localhost:12380` is never a canonical default. Options > General proxy fields write to this key. — **Reversibility:** `reversible` — rationale: additive storage key; §10.6 contract.
- **D-51 (Sync read API + boot hydration):** `ProviderRegistry` exposes synchronous reads (`getEnabled()`, `getById(id)`, `getAll()`); providers register declaratively at module load (OpenAI, Anthropic, Gemini, Ollama, OpenAICompat). Hydration happens once at boot before UI renders; no async in the read surface. — **Reversibility:** `reversible` — rationale: module API; swap to async is a bounded refactor.
- **D-52 (Live model discovery + session cache):** Keep the existing live discovery (`fetchProviderModels` semantics) for Options/Onboarding "refresh models" + connection test; `ProviderRegistry` caches the fetched list per provider in memory for the session. `TierResolver` matches against the cached list. No static model catalog to maintain. — **Reversibility:** `reversible` — rationale: cache is in-memory only.

#### Tier defaults — capability tiers, no hard-coded slugs (overrides Appendix D placeholders)
- **D-53 (Ship capability tiers only):** Do NOT ship concrete model slugs in `TIER_TO_MODEL_CANDIDATES`. The table defines `fast` / `balanced` as capability tiers only (operator-selected low-cost vs higher-capability, per provider). Concrete slugs are resolved from live provider discovery + operator configuration, never hard-coded into the shipped spec. Rationale (user): no stale model names, no provider-release churn, no broken defaults when vendors rename models, works with OpenAI-compatible providers and custom Ollama installs. — **Reversibility:** `costly` — rationale: changes the meaning of the canonical Appendix D table; downstream tier consumers assume capability semantics.
- **D-54 (Manual assignment; pre-fill suggestion on first setup):** Tier assignment is manual in Options, write-through to `UserPreferences.fastModel` / `UserPreferences.balancedModel`. On FIRST provider setup, Options pre-fills the fast/balanced fields with the first-discovered model of each class (a suggestion the user accepts or changes before it persists). `TierResolver` returns null until persisted; the caller falls back or errors by design (Appendix D). — **Reversibility:** `reversible` — rationale: persisted preference keys, user-editable.
- **D-54a (TierResolver failure contract):** Until both UserPreferences.fastModel and UserPreferences.balancedModel are explicitly persisted, TierResolver returns null for the unresolved tier. ProviderRouter MUST NOT infer, auto-assign, substitute, or guess a model. AgentOrchestrator surfaces a configuration-required state to the caller and no provider request is started. Suggestions shown during provider setup are UI-only and MUST NOT affect runtime routing until confirmed and persisted by the operator. — **Reversibility:** reversible — rationale: failure-path clarification only.
- **D-55 (Per-stage explicit tier):** Each pipeline stage picks its tier explicitly via a `useTierForStage()`-style mapping: Planner uses `fast` where available (spec §1.2), Renderer uses `fast` for the final answer stream, Executor tool calls default to the turn's tier with per-tool override later. No single user-facing tier selector in Phase 3. — **Reversibility:** `reversible` — rationale: internal mapping; a user-facing selector can layer on later.
- **D-56 (OpenAICompat registered, tier-mapped only when assigned):** `OpenAICompatProvider` is registered with ProviderRegistry but has NO default entry in `TIER_TO_MODEL_CANDIDATES`; operators using self-hosted OpenAI-compatible endpoints (LM Studio, vLLM, proxies) assign its fast/balanced models explicitly in Options. — **Reversibility:** `reversible` — rationale: declarative registration + preference keys.

#### Persona seed + injection
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

### Deferred Ideas (OUT OF SCOPE)
- **Persona persistence (`np_persona` in PreferenceMemoryStore)** — RICH-R-05 → Phase 8. Phase 3 seeds the profile in code; it does not persist across sessions (reconciliation R2: user config, not a fact).
- **Persona editor (Options → Persona)** — RICH-R-04 → Phase 15.
- **"Meet NowPilot" character card** — RICH-R-03 → Phase 15.3.
- **AITransactionLog + TraceRedactor (full)** — Phase 11; Phase 3 records attempts via debugLog/ErrorStore only.
- **Real tools (Research, PageContext, etc.)** — owning phases; Phase 3 ships framework + zero tools (D-46).
- **Multi-role collaboration (CollaborationCoordinator)** — Phase 14; §1.6 notes single-agent is the degenerate one-role case of the same runtime.
- **Diagnostics panel surfacing stream events** — Phase 11; the canonical stream event union (D-47) is the future substrate.
- **Implementation prohibition:** None of the deferred items listed below may be implemented, scaffolded, partially activated, feature-flagged, or exposed through UI in Phase 3 unless explicitly re-scoped by a later authoritative decision.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RICH-R-01 | Persona profile in `src/core/ai/persona/PersonaProfile.ts`: Identity (name, tagline, domain); Personality core (privacy-first, helpful, precise, humble); behavioral drivers (prefers clarifying questions over guessing, cites sources); Language style (professional-warm, technical-accessible, concise-by-default); Emotional repertoire (empathy, encouragement, curiosity). | Appendix N.1 verbatim (`PersonaProfileSchema` + `DEFAULT_PERSONA`, spec 6064-6099) — canonical, "Do not paraphrase". D-57 locks spec-verbatim seed. §21.6 `PersonaProfile` interface (spec 3412-3419) matches. |
| RICH-R-02 | `PersonaInjector` injects persona into system prompts across all AI calls. Depends on R-01. | Appendix N.2 verbatim (`resolvePersona` data-merge, `buildPersonaBlock` byte-stable, `PersonaInjector.inject` persona-first prepend, spec 6105-6141). D-58/D-59 lock merge semantics + single choke-point at PromptCacheManager's system-prompt builder. |
| RICH-R-09 | Chat and Agent share the same persona. Depends on R-02. | D-44 re-points `useChatStreaming` at `AgentOrchestrator` — chat runs the same pipeline, so D-59's single injector choke-point gives chat and agent the identical persona automatically. |
| RICH-R-10 | Persona-consistent system prompt per pipeline stage (Planner/Executor/Renderer). Depends on R-02. | D-59: persona prepended FIRST inside the cached `[SYSTEM]` section by the one system-prompt builder; Appendix A stage constants stay persona-free and byte-stable (spec 4153 note). Stage `tier` fields (planner `fast`, renderer `balanced` per Appendix A) feed D-55 stage-tier mapping. |

**Research support caveats:** `PersonaInjector` imports `UserPreferences` from `@/core/memory/types` in the Appendix N.2 reference — that module does not exist; Phase 3 must supply the minimal `UserPreferences` shape (see Assumptions/Open Questions). The D-57 CONTEXT summary phrases tagline/behavioralDrivers slightly differently from Appendix N.1's verbatim constants — **the spec Appendix N.1 block is authoritative** (it carries "Do not paraphrase").
</phase_requirements>

## Summary

Phase 3 replaces the scaffold's proxy-coupled chat path with a production **Planner → Executor → Renderer** pipeline. The current SSE parser in `src/services/aiProvider.ts:424-444` only reads the private-proxy `data.textChunk`/`data.thoughtChunk` fields and ignores real provider wire formats — a confirmed production bug (CONCERNS.md, REQ-R09, D-47). The rebuild is `StreamAdapter`, which normalizes each provider's SSE wire format (OpenAI `choices[].delta.content` + `[DONE]`; Anthropic `event:` types with `text_delta`; Gemini `candidates[].content.parts[].text`; Ollama via the `…/v1` OpenAI-compatible endpoint) into a canonical event union `STREAM_START / STREAM_DELTA / STREAM_COMPLETE / STREAM_ERROR / STREAM_ABORTED` mapped onto the §20.6 `ActiveStreamState` machine.

Three **gaps between CONTEXT.md's code-context claims and the actual codebase** were found and drive out-of-inventory modifications the planner MUST include: (1) `ActiveStreamState` (§20.6) does **not** exist anywhere in `src/` — grep returns zero hits — Phase 3 must add it to `src/core/runtime/workerState.ts`; (2) `src/core/prompts/index.ts` is a 4-line stub (only `titleGen` + a non-canonical `repairJson`) — the Appendix A canonical prompts (planner/renderer/memoryExtractor/conversationSummarizer/repairJson) must be added verbatim, and `repairJson.system` **differs** from the Appendix A canonical text today; (3) `UserPreferences` (with `personaOverrides`/`fastModel`/`balancedModel`) does not exist — `src/core/memory/` is absent — Phase 3 must ship a minimal `UserPreferences` shape + `np_preferences` persistence (later memory phases supersede it). `zod-to-json-schema@3.25.2` is a new dependency, verified Zod-4-compatible (`peerDependencies: zod '^3.25.28 || ^4'`), verdict OK.

Everything else is locked by D-44…D-59 and the spec appendices, which are reference implementations to adapt verbatim (Appendix A/D/I/J/K/L/N). The `verify:phase-3` gate is `tsc --noEmit && vitest run tests/core/ai tests/core/ai/persona` (package.json:20) — 8 test files, none of which exist yet.

**Primary recommendation:** Build the 19-file inventory in dependency order — types/ILLMProvider → providers + StreamAdapter + ChunkBuffer → ProviderRegistry + TierResolver + ProviderRouter → PromptCacheManager/PromptCacheAdapter + persona → StructuredOutput + toolSchemas → Planner/Executor/Renderer → AgentOrchestrator → chat/persist wiring — plus the three out-of-inventory modifications (workerState `ActiveStreamState`, prompts/index.ts Appendix A, minimal UserPreferences + np_preferences) and the Options/chat UI modifications required by D-44/D-50/D-54. Gate: `pnpm install` first — `node_modules` is currently absent.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SSE streaming + AI provider fetch | API / Backend (in-repo: UI-context service layer) | — | Runs in side panel / standalone surfaces ONLY (§0.2, §5.2 — never background SW). `Requester` (Phase 2) is the fetch wrapper; providers + StreamAdapter are UI-context modules. |
| Planner → Executor → Renderer pipeline | API / Backend (in-repo: `src/core/ai`) | Frontend Server (hooks) | `AgentOrchestrator.runAgentTurn` owns sequencing + §1.4 tier caps (Appendix I); hooks (`useChatStreaming`/`useStreamingLLM`) only call the orchestrator — "No component or hook may call PlannerService directly" (Appendix I rules). |
| Provider routing / fallback / circuit breaker | API / Backend (`ProviderRouter`) | — | §1.5 + §20.10 policy is a pure decision module; `hasStreamedFirstToken` never-switch + circuit-breaker votes are router-owned. |
| Tier resolution (fast/balanced) | API / Backend (`TierResolver`) | — | Appendix D mechanism verbatim (privacyMode + priority sort); candidates fed by `UserPreferences.fastModel`/`balancedModel` + live-discovered models (D-53/D-54/D-52). |
| Prompt assembly + caching | API / Backend (`PromptCacheManager` + `PromptCacheAdapter`) | — | §1.3 canonical section order; persona choke-point (D-59); per-provider cache hints (Appendix K). |
| Persona injection | API / Backend (`PersonaInjector`) | — | Pure function called at the single system-prompt builder; byte-stable block per persona (D-59, §1.3). |
| Chat UI streaming | Browser / Client (React hooks) | API / Backend (orchestrator) | `useChatStreaming` re-points at `AgentOrchestrator` (D-44); `ChunkBuffer` (rAF batching, Appendix J) buffers deltas for React rendering. |
| Turn-end persistence | Database / Storage (IndexedDB via WriteJournal) | — | D-45: completed user/assistant pairs → ChatHistoryDB via WriteJournal at turn end; no per-chunk writes; abort drops partial. |
| Structured output + one-shot repair | API / Backend (`StructuredOutput`) | — | Appendix L verbatim: zod-to-json-schema + exactly one repair + terminal STRUCTURED_OUTPUT_FAILED. |
| Tool registry + rejection | API / Backend (`toolSchemas` + `ExecutorService`) | — | D-46: zero tools registered; Executor narrows toolName to closed z.enum and rejects unknown with TOOL_REJECTED (§1.2, §21.6). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.4.3 (installed, locked) | Runtime validation of PlannerDecision, canonical stream events, PersonaProfile, cross-boundary envelopes | Spec §7.4 pins `zod ^4`; all cross-boundary data uses Zod (CLAUDE.md). RECONCILIATION A-3: follow spec. |
| zod-to-json-schema | 3.25.2 (NEW — must install) | Appendix L structured-output JSON Schema generation | Appendix L pins it verbatim; "do NOT substitute Zod 4's native z.toJSONSchema()" (deferred v0.2). peerDeps `zod '^3.25.28 || ^4'` → compatible with zod 4.4.3. [VERIFIED: npm registry] |
| zustand + immer | ^5.0.0 / ^11.1.18 (installed) | Store pattern (if a UserPreferences store is needed) | Existing store convention (CLAUDE.md); chromeStorageAdapter persist. |
| vitest | ^3.0.0 (installed) | Test runner for the 8 Phase-3 test files | Existing test infra; `verify:phase-3` = `tsc --noEmit && vitest run tests/core/ai tests/core/ai/persona` (package.json:20). |
| typescript | ~5.8.2 (installed) | Strict mode ON; NP-STRICT ceiling = 0 (package.json `NP_STRICT_CEILING: 0`) | STATE.md decision 17/18: new Phase-3 code strict-clean, no new `@ts-expect-error NP-STRICT` markers. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| idb | ^8.0.3 (installed) | ChatHistoryDB access (turn-end persist, D-45) | `openChatHistoryDB()` from Phase 2 — consume, don't re-create. |
| @types/chrome | ^0.2.2 (installed) | chrome.storage / runtime typings | storage session/local access, BroadcastChannel mocks in tests. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod-to-json-schema 3.25.2 | Zod 4 native `z.toJSONSchema()` | **Rejected — Appendix L implementer note explicit: deferred v0.2 cleanup. Phase 3 MUST use zod-to-json-schema.** |
| Direct fetch per provider | OpenAI/Anthropic/Gemini SDKs | Rejected — INTEGRATIONS.md: "client-side fetch, no SDKs"; MV3 bundle size; SDKs don't run in extension UI contexts cleanly. |
| Static model catalog (AVAILABLE_MODELS) | Live model discovery + session cache (D-52) | D-52/D-53 locked: no static catalog; `AVAILABLE_MODELS` in aiProvider.ts is NOT reused. |
| Concrete model slugs in TIER_TO_MODEL_CANDIDATES | Capability tiers only + operator assignment (D-53/D-54) | Locked user decision: no vendor slugs ship; placeholders resolve null → caller falls back/errors by design. |

**Installation:**
```bash
pnpm install                 # node_modules is currently ABSENT — required before verify:phase-3
pnpm add zod-to-json-schema  # adds 3.25.2 (zod ^4 compatible)
```

**Version verification:**
```bash
npm view zod-to-json-schema version peerDependencies   # 3.25.2, peerDeps zod '^3.25.28 || ^4'  [VERIFIED: npm registry]
npm view zod version                                    # ^4.4.3 locked in pnpm-lock.yaml (verified in-repo)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| zod-to-json-schema | npm | 6+ yrs (modified 2026-03-27) | 57.7M/wk | github.com/StefanTerdell/zod-to-json-schema | OK (no postinstall, not deprecated) | Approved — new install in Phase 3 |
| zod | npm | mature | (already installed ^4.4.3) | github.com/colinhacks/zod | OK | Already in package.json — no action |
| idb | npm | mature | (already installed ^8.0.3) | github.com/jakearchibald/idb | OK | Already in package.json — no action |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No other new external packages are required by the Phase-3 inventory — the runtime is built on `fetch` + existing deps. `zod-to-json-schema` is the only addition; it is registry-verified OK and Zod-4-compatible.*
## Architecture Patterns

### System Architecture Diagram

```
                        ┌────────────────── SIDE PANEL / STANDALONE SURFACE (UI contexts only — §0.2, §5.2) ──────────────────┐
                        │                                                                                                    │
 User input ──► useChatStreaming (D-44 re-point) ──► AgentOrchestrator.runAgentTurn (Appendix I)                             │
                        │                                        │                                                           │
                        │                          ┌─────────────┴─────────────┐                                             │
                        │                          │ tier caps (§1.4) enforced  │  Planner ──fast tier (D-55)                │
                        │                          │ plannerCap/toolCap/mcp      │    │                                        │
                        │                          └─────────────┬─────────────┘  PlannerDecision (zod discriminated union)   │
                        │                                        │               answer│ask_clarification ──► Renderer ──fast  │
                        │                                        │               run_tool ──► Executor ──► TOOL_REJECTED (D-46)│
                        │                                        ▼                                                                 │
                        │                            useTierForStage() (D-55) → TierResolver (Appendix D mech, D-53/54)         │
                        │                                        │  returns null until UserPreferences.fastModel/balancedModel  │
                        │                                        ▼  persisted (D-54a) → configuration-required state, no call    │
                        │                                  ProviderRouter (§1.5/§20.10)                                         │
                        │    circuit breaker 3 votes/60s → open 5min │ retry pre-first-token │ hasStreamedFirstToken never-switch│
                        │                                        ▼                                                               │
                        │    ProviderRegistry (D-49 normalize np_providers object + np_endpoint_overrides D-50, live models D-52)│
                        │        │  sync reads: getEnabled/getById/getAll (D-51)                                                 │
                        │        ▼                                                                                               │
                        │  ILLMProvider: OpenAI │ Anthropic │ Gemini │ Ollama │ OpenAICompat  (fetch via Requester, D-35)         │
                        │        │  each sets its JSON-mode flag natively (Appendix L rule)                                      │
                        │        ▼                                                                                               │
                        │  StreamAdapter (D-47): per-provider SSE → STREAM_START/DELTA/COMPLETE/ERROR/ABORTED                     │
                        │        │  OpenAI [DONE] · Anthropic event: types · Gemini candidates[].content · Ollama NDJSON         │
                        │        ▼                                                                                               │
                        │  ChunkBuffer (Appendix J, rAF + 8kB/s→33ms) ──► React UI (Bubble)                                       │
                        │        │                                                                                               │
                        │  Turn end: WriteJournal → ChatHistoryDB (D-45); abort → drop partial                                   │
                        └────────────────────────────────────────────────────────────────────────────────────────────────────┘
                        ▲
   PromptCacheManager.buildSystemPrompt (D-59 single choke-point)
      [SYSTEM: cached, canonical]  ← PersonaInjector.inject prepends persona block FIRST, byte-stable per persona
      [TOOL SCHEMAS] [USER PREFERENCES: compact] [TASK] [USER INPUT]   (§1.3 canonical order)
        └─► PromptCacheAdapter.applyCacheHints (Appendix K: anthropic ≤4 breakpoints, gemini ≥32768 cached tokens, prefix-only)
```

### Recommended Project Structure
```
src/core/ai/
├── types.ts                     # ProviderId, ModelTier re-export, canonical stream event union (D-47), RouterAttemptState,
│                                #   ToolExecutionResult, minimal UserPreferences (fastModel/balancedModel/personaOverrides) — see Open Q
├── ILLMProvider.ts              # interface: stream(request, signal) → canonical events; requestJson for structured output (discretion)
├── ProviderRegistry.ts          # D-49/51/52: hydrate np_providers object + np_endpoint_overrides; declarative registration; sync reads; live-model cache
├── providers/                   # OpenAIProvider, AnthropicProvider, GeminiProvider, OllamaProvider, OpenAICompatProvider
│   └── ...Provider.ts           #   per-provider request build + wire-format SSE parse (consumed by StreamAdapter)
├── ProviderRouter.ts            # §1.5/§20.10 retry + fallback + circuit breaker; RouterAttemptState per operation
├── TierResolver.ts              # Appendix D mechanism verbatim; D-53 capability-tiers-only candidates; D-54/D-54a null contract
├── PromptCacheManager.ts        # §1.3 section order; stable/unstable tagging; 5-miss → 60s disable (discretion); calls PersonaInjector (D-59)
├── PromptCacheAdapter.ts        # Appendix K verbatim: applyCacheHints + hashStableSections
├── PlannerService.ts            # §1.2: returns PlannerDecision (answer|run_tool|ask_clarification); fast tier; 3s timeout; Appendix L repair
├── ExecutorService.ts           # §1.2: closed z.enum from registered tools; validate input; TOOL_REJECTED (D-46, §21.6)
├── RendererService.ts           # §1.2/§1.3: balanced tier; 512-token cap default; no invented facts
├── AgentOrchestrator.ts         # Appendix I verbatim: runAgentTurn; ONLY module enforcing §1.4 caps
├── StructuredOutput.ts          # Appendix L verbatim: requestJson — zodToJsonSchema + 1 repair + STRUCTURED_OUTPUT_FAILED
├── toolSchemas.ts               # D-46: ToolDefinition, ToolCapabilityManifest, closed-enum contract; ZERO tools registered
├── StreamAdapter.ts             # D-47: canonical event union; per-provider wire adapters
├── ChunkBuffer.ts               # Appendix J verbatim: createChunkBuffer
└── persona/
    ├── PersonaProfile.ts        # Appendix N.1 verbatim: PersonaProfileSchema + DEFAULT_PERSONA
    └── PersonaInjector.ts       # Appendix N.2 verbatim: resolvePersona, buildPersonaBlock, PersonaInjector.inject

tests/core/ai/
├── PlannerService.test.ts  ExecutorService.test.ts  RendererService.test.ts  AgentOrchestrator.test.ts
├── ProviderRouter.test.ts  StructuredOutput.test.ts
└── persona/PersonaProfile.test.ts  persona/PersonaInjector.test.ts

Out-of-inventory modifications (locked decisions require them):
├── src/core/runtime/workerState.ts     # ADD §20.6 ActiveStreamState (verbatim) — does not exist today
├── src/core/prompts/index.ts           # ADD Appendix A planner/renderer/memoryExtractor/conversationSummarizer/repairJson verbatim
├── src/components/chat/useChatStreaming.ts  # D-44: re-point at AgentOrchestrator
├── src/components/options/OptionsPage.tsx   # D-50 endpoint-override fields; D-54 tier assignment + first-setup prefill (UI-only until persisted)
└── src/types/storage.ts (+ WriteJournal boot wiring)  # D-45: add chat turn-end persist op + registered JournalStep (see Open Q)
```

### Pattern 1: Canonical Stream Event Union (D-47)
**What:** Every provider adapter emits one typed union; consumers (hooks, ChunkBuffer, future AITransactionLog) never see provider-specific SSE.
**When to use:** All streaming paths in Phase 3; the old `onChunk`/`onDone` callback surface is retired.
**Example:**
```typescript
// Source: spec §20.6 ActiveStreamState (PRODUCT_SPEC_v0_1.md:3170-3179) — verbatim; add to src/core/runtime/workerState.ts
export type ActiveStreamState =
  | { state: 'idle' }
  | { state: 'preparing'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'streaming'; sessionId: string; operationId: string; startedAt: number; surface: ActiveSurface }
  | { state: 'waiting-for-permission'; sessionId: string; operationId: string; toolName: string; surface: ActiveSurface }
  | { state: 'aborting'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'completed'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'failed'; sessionId: string; operationId: string; code: string; message: string; surface: ActiveSurface };
```
Canonical events map: STREAM_START → `preparing`/`streaming`, STREAM_DELTA → accumulated text (via ChunkBuffer), STREAM_COMPLETE → `completed`, STREAM_ERROR → `failed` with canonical code, STREAM_ABORTED → `aborting`. Stream correlation reuses Phase-1 `OperationId` (Flag C — `createEnvelope` already generates `crypto.randomUUID()` at RuntimeEnvelope.ts:63).

### Pattern 2: Persona-first cached [SYSTEM] via single choke-point (D-59)
**What:** `PromptCacheManager`'s system-prompt builder is the ONLY place `PersonaInjector.inject` is called; the persona block is prepended FIRST inside the cached `[SYSTEM]` section, byte-stable per persona.
**When to use:** Every stage system prompt (Planner, Executor, Renderer — and future MemoryExtractor) goes through this one builder.
**Example:**
```typescript
// Source: Appendix N.2 (PRODUCT_SPEC_v0_1.md:6105-6141) — verbatim semantics; the UserPreferences import target changes
import type { PersonaProfile } from './PersonaProfile';
import { DEFAULT_PERSONA } from './PersonaProfile';
export type PipelineStage = 'planner' | 'executor' | 'renderer' | 'memoryExtractor';
export function resolvePersona(base: PersonaProfile, prefs?: UserPreferences): PersonaProfile {
  if (!prefs?.personaOverrides) return base;
  const o = prefs.personaOverrides;
  return {
    ...base,
    identity: { ...base.identity, name: o.name ?? base.identity.name },
    languageStyle: {
      ...base.languageStyle,
      tone: o.tone ?? base.languageStyle.tone,
      brevity: o.brevity ?? base.languageStyle.brevity,
    },
  };
}
export const PersonaInjector = {
  inject(stage: PipelineStage, baseSystem: string, opts?: { persona?: PersonaProfile; prefs?: UserPreferences }): string {
    const persona = resolvePersona(opts?.persona ?? DEFAULT_PERSONA, opts?.prefs);
    const block = buildPersonaBlock(persona);       // byte-stable per persona (§1.3)
    return `${block}\n\n${baseSystem}`;             // persona first (cacheable), then canonical stage string (Appendix A)
  },
};
```

### Pattern 3: Structured Output One-Shot Repair (Appendix L)
**What:** `requestJson(schema, prompt, ctx)` converts the Zod schema to JSON Schema, calls the provider in JSON mode, and repairs malformed JSON **exactly once**; a second failure throws terminal `STRUCTURED_OUTPUT_FAILED`.
**When to use:** Planner decisions, clarification, any JSON-only stage output.
**Example:**
```typescript
// Source: Appendix L (PRODUCT_SPEC_v0_1.md:5848-5896) — implement verbatim; do NOT substitute Zod 4 z.toJSONSchema()
const jsonSchema = zodToJsonSchema(schema);
const first = await attempt(prompt);
const parsedFirst = safeParse(schema, first);
if (parsedFirst.ok) return parsedFirst.data;
const repairPrompt = `${PROMPTS.repairJson.system}\nSchema: ${JSON.stringify(jsonSchema)}\nBroken: ${first}`;
const second = await attempt(repairPrompt);
// ...second failure → throw err with code 'STRUCTURED_OUTPUT_FAILED', retryable: false
```
Per-provider JSON mode (discretion): OpenAI `response_format: {type:'json_object'}`; Anthropic supports structured outputs via tool-use or `output_format` (verify at implementation against the provider's current API surface); Gemini `responseMimeType: 'application/json'`; Ollama `format: 'json'`. Conformance fixtures must exercise the repair loop with both repair-success and repair-failure inputs (D-48).

### Pattern 4: ProviderRouter retry/fallback + circuit breaker (§1.5/§20.10)
**What:** Per-operation attempt state; retry only pre-first-token retryable codes; 3 circuit-breaker votes within 60 s → open 5 min.
**Example (locked table, verbatim — PRODUCT_SPEC_v0_1.md:3215-3229):**
```text
TIMEOUT:        Retryable pre-first-token YES · CB vote 1
PROVIDER_5XX:   Retryable YES · CB vote 1
NETWORK:        Retryable YES · CB vote 1
RATE_LIMITED:   Retryable YES (with jitter) · CB vote 0
AUTH:           Retryable NO · CB vote 3 (open immediately)
MODEL_UNKNOWN:  Retryable NO · CB vote 0
SCHEMA_INVALID: Retryable NO · CB vote 0
HOST_NOT_PERMITTED: Retryable NO · CB vote 0
After 3 votes within 60 s, provider marked open for 5 minutes.
```
Rules locked in §1.5 (spec 367-389): one provider → retry once only for retryable pre-first-token failures; never silently switch local→cloud when `allowCloudFallbackFromLocal=false`; **never switch after `hasStreamedFirstToken === true`**; record every attempt (AITransactionLog is Phase 11 — Phase 3 records via debugLog only).

### Anti-Patterns to Avoid
- **Reusing the proxy-coupled SSE parser:** the current `streamChatResponse` loop (aiProvider.ts:424-444) reads only `data.textChunk`/`data.thoughtChunk` — real providers return empty text. Do NOT extend it; rebuild per-provider parsing in StreamAdapter and retire the callback surface (D-47).
- **Hard-coding model slugs anywhere:** `TIER_TO_MODEL_CANDIDATES` ships capability-tier placeholders only (D-53); `AVAILABLE_MODELS` in aiProvider.ts is dead once live discovery (D-52) lands. The resolver "never invents a model name" (Appendix D rule).
- **Per-chunk persistence:** mid-stream chunks live in memory + ChunkBuffer only; any chrome.storage write per chunk re-opens the P2 write-rate risk (D-45).
- **Calling PlannerService outside the orchestrator:** Appendix I rule — "No component or hook may call PlannerService directly." The orchestrator is the only tier-cap enforcement point.
- **`@ts-expect-error NP-STRICT` markers in new code:** ceiling is 0 (package.json `NP_STRICT_CEILING: 0`); new Phase-3 code must be strict-clean.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod → JSON Schema for structured output | Custom schema serializer | `zod-to-json-schema` (3.25.2) | Appendix L pins it; JSON Schema edge cases (refs, $defs, discriminated unions) are exactly the failure mode the one-shot repair handles. |
| SSE line-buffer parsing | Ad-hoc string splitting per provider | Incremental `TextDecoder({stream:true})` line buffer + per-provider adapters in StreamAdapter | REQ-R09 mandates `TextDecoder({stream:true})`; CRLF + multi-byte boundary handling is subtle (throttle-proxy test with 1-byte chunks + CRLF per SUMMARY.md). |
| Streaming text batching for React | Manual setState per delta | `ChunkBuffer` (Appendix J verbatim) | rAF batching + 8 kB/s → 33 ms upgrade rule (§22.1) already handles render churn; re-implementing it invites jank + re-render storms. |
| Prompt cache keying | Ad-hoc cache hashing per provider | `PromptCacheAdapter.applyCacheHints` + `hashStableSections` (Appendix K verbatim) | Per-provider rules differ (anthropic ≤4 breakpoints, gemini ≥32,768 tokens); the FNV hash + stable-section filter is locked. |
| HTTP fetch + timeout + rate-limit | Raw fetch in providers | `Requester.request` from `src/core/http/Requester.ts` (Phase 2) | Canonical error codes `RATE_LIMITED|TIMEOUT|NETWORK` map directly onto §20.10 retryability; AbortController threading already handles the caller signal + timeout. |
| Crash-safe persistence | Direct IDB put without journal | WriteJournal (`runJournaled` + registered JournalStep) | D-45 mandates journaled turn-end persist; WriteJournalDB replay is Phase-2 infrastructure to consume, not rebuild. |

**Key insight:** This phase's "hard" problems (SSE conformance, JSON repair, prompt-cache breakpoints, circuit-breaking) are all already solved in the spec appendices + Phase-2 infrastructure. The risk is *drift* — re-deriving shapes instead of copying Appendix A/D/I/J/K/L/N verbatim. The DONE-when and tests exist precisely to catch that drift.
## Common Pitfalls

### Pitfall 1: SSE breaks only in production (Pitfall 5)
**What goes wrong:** The parser works against the dev proxy but returns empty text on real providers; the failure only surfaces outside the dev environment.
**Why it happens:** Wire-format coupling — the current parser reads `data.textChunk` (custom proxy field) and never parses `choices[].delta.content` (OpenAI), `candidates[].content` (Gemini), or Anthropic `event:` lines.
**How to avoid:** Per-provider conformance fixtures (D-48) with the exact wire bytes — OpenAI `data: {"choices":[{"delta":{"content":"..."}}]}` + `data: [DONE]`; Anthropic `event: content_block_delta` / `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}`; Gemini `data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}`. **Missing terminator = error** (REQ-R09).
**Warning signs:** `onDone` fires with empty accumulated text; `[DONE]`-only terminator recognition.

### Pitfall 2: chrome.storage write-rate (P2)
**What goes wrong:** Writing every streamed chunk to chrome.storage.local saturates the quota and janks the UI (the scaffold's full-store re-serialization per chunk).
**Why it happens:** `updateLastAssistantMessage` → zustand persist serializes the whole store on every chunk.
**How to avoid:** D-45 is locked — mid-stream chunks live in memory + ChunkBuffer only; ChatHistoryDB persist happens once at turn end via WriteJournal; abort drops the partial message.
**Warning signs:** Any `setItem`/persist call inside the delta loop or ChunkBuffer flush handler.

### Pitfall 3: Prompt-cache invalidation from an unstable persona block
**What goes wrong:** The cached `[SYSTEM]` section changes between calls, so prompt-cache hits never occur (paying full input price every call).
**Why it happens:** Persona text interpolated with volatile values (timestamps, per-call overrides that mutate) breaks byte-stability; or persona overrides change mid-session without re-deriving the cache key.
**How to avoid:** `buildPersonaBlock` output must be byte-identical per persona (Appendix N.2 + §1.3); when `UserPreferences.personaOverrides` change, invalidate/re-derive via a profile-version-keyed cache hash (CONTEXT discretion item). Verified official behavior: Anthropic cache requires exact prefix match; changing the system block invalidates system + message caches [CITED: platform.claude.com prompt-caching].
**Warning signs:** `cache_read_input_tokens` stays 0 (Anthropic usage field) across repeated calls; cacheKeyHash changes for unchanged persona.

### Pitfall 4: Gemini 32,768-token cache minimum
**What goes wrong:** Marking a Gemini prompt for caching below the minimum silently falls back to uncached — no error, just no savings.
**Why it happens:** `GEMINI_MIN_CACHED_TOKENS = 32_768` (Appendix K); below it the adapter must use `prefix-only`.
**How to avoid:** Implement `applyCacheHints` verbatim — only switch to `gemini-cachedContent` when `stableTokens >= 32768`; otherwise `inline` + `prefix-only` (Appendix K spec 5777-5795).
**Warning signs:** CachedContent strategy selected with < 32,768 stable tokens in fixtures.

### Pitfall 5: Anthropic 4-breakpoint cap
**What goes wrong:** Marking a 5th block with `cache_control` returns HTTP 400.
**Why it happens:** `ANTHROPIC_MAX_BREAKPOINTS = 4`; official docs confirm up to 4 explicit breakpoints, and a 5th → 400 [CITED: platform.claude.com prompt-caching "If 4 explicit block-level breakpoints already exist, the API returns a 400 error"].
**How to avoid:** `applyCacheHints` stops marking after 4 (Appendix K verbatim); a single persona-first breakpoint on [SYSTEM] is the primary one (D-59).
**Warning signs:** 400 errors only on Anthropic streaming requests with many stable sections.

### Pitfall 6: TierResolver null → silent request to a wrong model
**What goes wrong:** `resolveTier` returns null (no persisted fastModel/balancedModel) and a caller guesses/substitutes a model, violating D-54a.
**Why it happens:** Appendix D's null contract is "caller falls back or errors by design" — guessing defeats it.
**How to avoid:** AgentOrchestrator surfaces a configuration-required state to the caller and starts NO provider request until both preferences are persisted (D-54a). Options pre-fill suggestions are UI-only, never auto-persisted (D-54).
**Warning signs:** Any code path that calls a provider without a TierResolver result.

### Pitfall 7: `np_active_stream` recovery with a stale operationId
**What goes wrong:** A previous interrupted stream is treated as current; the UI shows a ghost streaming state or drops a live one.
**Why it happens:** session-scoped `np_active_stream` survives surface reload within 5 min; correlation must reuse the Phase-1 `OperationId` (Flag C).
**How to avoid:** Appendix J.2's boot-recovery check: if `np_active_stream.conversationId === conversationId`, surface `failed`/`STREAM_INTERRUPTED` and remove the key. Use `createEnvelope`'s `crypto.randomUUID()` operationId.
**Warning signs:** `np_active_stream` never removed in `finally`; multiple live streams on the same conversationId.

## Code Examples

### Canonical stream events + PlannerDecision (locked shapes, verbatim)
```typescript
// Source: §1.2 (PRODUCT_SPEC_v0_1.md:272-286) — PlannerDecisionSchema, verbatim
export const PlannerDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
  z.object({
    action: z.literal('run_tool'),
    toolName: z.string().max(64),   // ExecutorService supplies a closed z.enum at request time
    input: z.unknown(),
  }),
  z.object({
    action: z.literal('ask_clarification'),
    question: z.string().max(200),
    options: z.array(z.string().max(60)).max(4).default([]),   // RICH-C-04 option chips
  }),
]);
```

### Router attempt state (§1.5 verbatim)
```typescript
// Source: PRODUCT_SPEC_v0_1.md:377-383
interface RouterAttemptState {
  operationId: string;
  attempts: ProviderAttempt[];
  hasStreamedFirstToken: boolean;
  circuitBreakerOpen: Record<ProviderId, number>; // reopen after cool-down ms
}
```

### AgentOrchestrator loop (Appendix I — the only tier-cap enforcement point)
```typescript
// Source: PRODUCT_SPEC_v0_1.md:5567-5615 (abridged); implement verbatim
export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
  const toolResults: ToolExecutionResult<unknown>[] = [];
  let plannerCalls = 0;
  let toolCalls = 0;
  while (true) {
    if (input.abortSignal.aborted) throw new DOMException('aborted', 'AbortError');
    if (plannerCalls >= input.tier.plannerCap) return await finish('planner_cap_reached');
    plannerCalls++;
    const decision = await PlannerService.plan({ ... });
    if (decision.action === 'answer' || decision.action === 'ask_clarification') {
      return await finish(decision.action === 'answer' ? decision.reasonCode : 'ask_clarification');
    }
    if (toolCalls >= input.tier.toolCap) return await finish('tool_cap_reached');
    toolCalls++;
    const result = await ExecutorService.execute({ ... });
    toolResults.push(result);
  }
  async function finish(reasonCode: string): Promise<AgentTurnOutput> { /* RendererService.render → { streamedText, toolResults, reasonCode } */ }
}
```

### ChunkBuffer (Appendix J.1 verbatim)
```typescript
// Source: PRODUCT_SPEC_v0_1.md:5630-5678 — createChunkBuffer: enqueue/onFlush/flushNow/reset;
// rAF batching with 8_000 bytes/s → setTimeout 33ms upgrade rule.
```

### PromptCacheAdapter per-provider hints (Appendix K verbatim)
```typescript
// Source: PRODUCT_SPEC_v0_1.md:5753-5821 — applyCacheHints(providerId, sections):
//   anthropic → cache_control {type:'ephemeral'} on ≤4 stable sections (ANTHROPIC_MAX_BREAKPOINTS)
//   gemini    → cachedContent split only when stableTokens >= GEMINI_MIN_CACHED_TOKENS (32_768), else prefix-only
//   openai/ollama/default → stableFirst sort, prefix-only
// cacheKeyHash = FNV-1a 32-bit over joined stable texts (verbatim hashStableSections).
```

### Anthropic SSE text delta (official wire bytes for conformance fixtures)
```sse
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ello frien"}}
```
```sse
event: message_stop
data: {"type":"message_stop"}
```
Stream flow: `message_start` → `content_block_start` → `content_block_delta`* → `content_block_stop` → `message_delta`* → `message_stop`; `ping` dispersed; `error` events possible. [VERIFIED: platform.claude.com/docs/en/build-with-claude/streaming]

### OpenAI SSE chunk (wire bytes for conformance fixtures)
```sse
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":...,"model":"...","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}
data: [DONE]
```
Field path confirmed in-repo (CONCERNS.md:76-77: "Real OpenAI SSE emits `choices[].delta.content`"). Full chunk envelope shape [ASSUMED].

### Persona default (Appendix N.1 verbatim — canonical, do not paraphrase)
```typescript
// Source: PRODUCT_SPEC_v0_1.md:6084-6099
export const DEFAULT_PERSONA: PersonaProfile = {
  id: 'nowpilot-default',
  identity: {
    name: 'NowPilot',
    tagline: 'Your ServiceNow support co-pilot',
    domain: 'ServiceNow support engineering, technical troubleshooting, and knowledge management',
  },
  personalityCore: ['privacy-first', 'helpful', 'precise', 'humble'],
  behavioralDrivers: ['prefers asking clarifying questions over guessing', 'cites sources when available'],
  languageStyle: {
    tone: 'professional-warm',
    vocabulary: 'technical but accessible to support engineers',
    brevity: 'brief',
  },
  emotionalRepertoire: ['empathy', 'encouragement', 'curiosity'],
};
```
> Note: D-57's CONTEXT summary paraphrases tagline as "privacy-first ServiceNow copilot" and behavioralDrivers as `['asks clarifying questions','cites sources']`. The spec Appendix N.1 block above is authoritative ("Do not paraphrase"). Tone/brevity enums match §21.6 exactly.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Private-proxy SSE format (`textChunk`/`thoughtChunk`) | Standard per-provider wire formats normalized by StreamAdapter | Phase 3 (REQ-R09/D-47) | Real providers work; the dev proxy becomes an extension, not the only path |
| Default-on simulated AI + `localhost:12380` default | DEMO_MODE+DEV-gated simulator; §10.6 canonical endpoints + np_endpoint_overrides | Phase 3 (REQ-R20/D-50) | No fake "AI" responses in production; no misleading canned content |
| Static model catalog (`AVAILABLE_MODELS`) | Live model discovery + session cache (D-52) | Phase 3 | No stale model names; works with OpenAI-compat + custom Ollama |
| Concrete model slugs in tier table | Capability tiers only; operator-assigned fastModel/balancedModel (D-53/D-54) | Phase 3 (user decision) | No vendor churn; resolver returns null until configured (D-54a) |
| Per-chunk full-store persistence | Turn-end journaled persist to ChatHistoryDB (D-45) | Phase 3 | Kills the P2 write-rate risk |

**Deprecated/outdated:**
- `streamChatResponse` in `src/services/aiProvider.ts`: retired for production chat (D-44), kept only behind DEMO_MODE+DEV (D-12).
- `AVAILABLE_MODELS` static list: NOT reused (D-52).
- Zod 4 native `z.toJSONSchema()`: deferred v0.2 (Appendix L implementer note).
- The old `onChunk`/`onDone` callback streaming surface: retired (D-47).
## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `UserPreferences` minimal shape (fastModel/balancedModel/personaOverrides) must be created by Phase 3 and persisted under a new `np_preferences` chrome.storage.local key; `src/core/memory/types.ts` (Appendix N import target) does not exist and memory phases supersede it later | Phase Requirements / Structure | If a preferences store already exists elsewhere (none found), type collision or double persistence; if `np_preferences` is deemed out-of-scope, DONE-when "personaOverrides apply without a code change" is unachievable — the planner MUST include this |
| A2 | Gemini SSE chunk shape `data: {"candidates":[{"content":{"parts":[{"text":"…"}]}}]}` and `responseMimeType:'application/json'` JSON mode | Code Examples / Pitfalls | Corroborated in-repo (INTEGRATIONS.md:15-17, CONCERNS.md:76) but ai.google.dev was unreachable this session; conformance fixture could drift from the real API — verify against live Gemini at implementation |
| A3 | OpenAI SSE chunk envelope (id/object/created/model/choices/delta/finish_reason) as shown | Code Examples | Field path `choices[].delta.content` confirmed in-repo (CONCERNS.md:76-77); envelope details are training knowledge — the fixture should tolerate extra/missing envelope fields and key on `choices[0].delta.content` + `[DONE]` |
| A4 | OllamaProvider targets the OpenAI-compatible `{base}/chat/completions` (endpoint default `http://localhost:11434/v1` per §10.6/D-50); native `/api/chat` NDJSON is a documented alternative wire shape that conformance fixtures may also cover (REQ-R09 mentions "Ollama NDJSON") | Architecture Patterns | If the fixture set assumes native NDJSON only, the OpenAI-compat path is untested — the primary production path per §10.6 is the /v1 OpenAI-compatible one |
| A5 | D-45 "via the WriteJournal" requires an additive extension of the §20.3 `WriteJournalOperation` union (e.g. `'append-chat-turn'`) + registered JournalStep; the 11-member union today has no chat op (src/types/storage.ts:46-57, spec §20.3:3117-3130) | Open Questions / Don't Hand-Roll | If the intended reading was a direct (un-journaled) ChatHistoryDB put, adding a journal op is over-engineering; if the union must stay closed, journaled turn-end persist is impossible — see Open Question 1 |
| A6 | Anthropic JSON-mode for structured output uses tool-use-with-forced-choice or a current output-format parameter — exact shape to confirm against the live API at implementation | Standard Stack / Pitfall 5 | Anthropic's API evolves; Appendix L only mandates "the provider adapter must set the provider's JSON mode flag natively" — the mechanism is discretion, the fixture must match the implemented shape |
| A7 | `ActiveSurface` type (referenced by §20.6) exists somewhere importable — grep found `ActiveSurface` in RuntimeEnvelope.ts:50-75 context but the definition was not opened this session | Code Examples | If `ActiveSurface` is not exported, workerState.ts addition must define/import it — verify at implementation |
| A8 | Prompt cache section order uses `PromptSection` with `kind`/`text`/`stable`/`tokens` fields as Appendix K imports from `../context/ContextOptimizer` — that module is Phase 5 and does NOT exist; Phase 3 must declare its own minimal PromptSection shape in `src/core/ai/types.ts` | Standard Stack / Pattern 2 | If the prompt-section type is invented with different field names, Appendix K verbatim code breaks; keep the exact `{kind, text, stable, tokens}` field contract so Phase 5's ContextOptimizer can adopt it |

## Open Questions

1. **D-45 "via the WriteJournal" — which operation?**
   - What we know: `WriteJournalOperation` (src/types/storage.ts:46-57) is the closed §20.3 11-member union; there is **no** chat/transcript append op. `ChatHistoryDB` v1 schema (src/core/storage/ChatHistoryDB.ts:24-53) already fits the turn-end pair write (role `'user'|'assistant'|'system'`, metadata `Record<string, unknown>` — no schema change needed, so D-45a's stop-condition does NOT trigger).
   - What's unclear: whether "via the WriteJournal" means (a) an additive union extension (`'append-chat-turn'`) + registered JournalStep so the turn-end persist is journaled/replayable, or (b) a direct single-transaction IDB put (atomic by IndexedDB semantics) loosely described as "the journaled persist path".
   - Recommendation: **Option (a)** — additively extend the union with `'append-chat-turn'` and register the step list at boot (mirroring the Phase-2 `update-workspace` wiring, WriteJournal.ts:212-263). It honors D-45's letter, is backward-compatible (literal-union extension), and keeps abort-drops semantics in the pipeline's completion handler. If the planner prefers zero storage-module touch, document the deviation from D-45's letter explicitly.

2. **Where does the minimal `UserPreferences` shape live?**
   - What we know: Appendix N.2 imports `UserPreferences` from `@/core/memory/types` (does not exist); D-54/D-58 name `fastModel`/`balancedModel`/`personaOverrides`; `np_preferences` key appears nowhere yet.
   - Recommendation: Declare the Phase-3 minimal `UserPreferences` zod schema + type in `src/core/ai/types.ts` (or a small `src/core/ai/UserPreferences.ts`), persisted under `np_preferences` (chrome.storage.local) via the existing chromeStorageAdapter pattern. Add a code comment marking it as the Phase-8/10 supersession point. This is required to satisfy DONE-when item 5 (overrides apply without a code change) and D-54's write-through contract.

3. **Which hook consumes the pipeline?**
   - What we know: D-44 re-points `useChatStreaming.ts` at AgentOrchestrator; Appendix J.2 defines a new `useStreamingLLM` hook (src/hooks/useStreamingLLM.ts) that writes `np_active_stream` to chrome.storage.session and consumes ChunkBuffer.
   - Recommendation: Adapt the existing `useChatStreaming.ts` (modify in place per D-44) using the Appendix J.2 pattern (ChunkBuffer + `np_active_stream` session lifecycle + ActiveStreamState) rather than creating a second hook, so both chat surfaces keep one wiring path. The planner decides whether a separate `useStreamingLLM` module is warranted.

4. **Renderer 512-token cap declaration mechanism**
   - What we know: "Max normal output: 512 tokens unless the feature overrides" (§1.3) — planner's discretion on the mechanism.
   - Recommendation: A per-stage `maxOutputTokens` in the prompt-config entry (Appendix A stage constants carry `tier`; add a parallel `maxOutputTokens: 512` default), with an override parameter on `RendererService.render`. Keep it data, not hard-coded in the loop.

5. **Prompt-cache invalidation on persona override change**
   - What we know: byte-stability of `[SYSTEM]` must be re-derived when overrides change (CONTEXT discretion); Appendix K already hashes stable sections.
   - Recommendation: key the PromptCacheManager's cached system prompt on a profile-version hash = `hashStableSections([personaBlock])` — when `resolvePersona` output changes, the hash changes and the next build emits a new byte-stable block. No explicit invalidation API needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test toolchain | ✓ | v24.19.0 | — |
| pnpm | install/scripts | ✓ | 11.22.0 | npm 12 (package-lock.json present) |
| node_modules | `verify:phase-3` (vitest/tsc) | ✗ **ABSENT — `pnpm install` required before any test/gate run** | — | `pnpm install` (lockfile present, pnpm-lock.yaml) |
| zod-to-json-schema | StructuredOutput (Appendix L) | ✗ not installed | 3.25.2 (registry OK) | `pnpm add zod-to-json-schema` |
| Chrome (extension runtime) | manual UAT of streaming | ✓ (dev environment is macOS + Chrome per stack) | — | jsdom tests cover unit behavior |
| Live AI providers (OpenAI/Anthropic/Gemini/Ollama keys) | end-to-end streaming verification | ✗ — user-configured at runtime; NO keys in repo | — | conformance fixtures (D-48) + `fetchProviderModels` connection test; live smoke test deferred to UAT |
| ai.google.dev | Gemini wire-format verification this session | ✗ (unreachable from WebFetch) | — | in-repo INTEGRATIONS.md/CONCERNS.md + implementation-time live check |

**Missing dependencies with no fallback:**
- none that block planning — but **`pnpm install` is a hard prerequisite for the verify gate** and must be the first implementation task.

**Missing dependencies with fallback:**
- node_modules → `pnpm install` (lockfile committed).
- zod-to-json-schema → install task (registry-verified).
- Live provider keys → conformance fixtures are the Phase-3 test path; live smoke test belongs to UAT.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 (globals enabled, jsdom) |
| Config file | vitest.config.ts (jsdom, setup tests/setup.ts with chrome storage/session mocks, BroadcastChannel, ResizeObserver, matchMedia) |
| Quick run command | `pnpm run verify:phase-3` |
| Full suite command | `pnpm run verify:all` (tsc --noEmit && vitest run && pnpm run lint) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RICH-R-01 | PersonaProfile schema + DEFAULT_PERSONA verbatim fields | unit | `vitest run tests/core/ai/persona/PersonaProfile.test.ts` | ❌ Wave 0 |
| RICH-R-02 | PersonaInjector: data-merge overrides + persona-first prepend + byte-stability | unit | `vitest run tests/core/ai/persona/PersonaInjector.test.ts` | ❌ Wave 0 |
| RICH-R-09 | Chat + agent share persona (single choke-point) | unit (orchestrator-level) | `vitest run tests/core/ai/AgentOrchestrator.test.ts` | ❌ Wave 0 |
| RICH-R-10 | Persona-consistent system prompt per stage | unit | `vitest run tests/core/ai/persona/PersonaInjector.test.ts` | ❌ Wave 0 |
| (DONE-when) | Planner closed toolName enum; Executor TOOL_REJECTED | unit | `PlannerService.test.ts` / `ExecutorService.test.ts` | ❌ Wave 0 |
| (DONE-when) | Renderer 512-cap | unit | `RendererService.test.ts` | ❌ Wave 0 |
| (DONE-when) | Provider fallback + circuit breaker | unit | `ProviderRouter.test.ts` | ❌ Wave 0 |
| (DONE-when) | Structured-output one-shot repair | unit | `StructuredOutput.test.ts` | ❌ Wave 0 |
| (REQ-R09) | Per-provider SSE conformance (OpenAI [DONE] / Anthropic events / Gemini inline / Ollama) | unit (fixtures) | covered under StreamAdapter tests (D-48 fixtures library) | ❌ Wave 0 |

**Verify gate (package.json:20, verbatim):** `"verify:phase-3": "tsc --noEmit && vitest run tests/core/ai tests/core/ai/persona"` — the 8 spec-required test files (spec §18 Phase 3 block, lines 2547-2558) must exist; none exist today (tests/core/ai is absent).

### Sampling Rate
- **Per task commit:** `pnpm run verify:phase-3` (tsc + scoped vitest)
- **Per wave merge:** `pnpm run verify:phase-3`
- **Phase gate:** Full gate green before `/gsd-verify-work`

### Wave 0 Gaps
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
- [ ] Note: tests/setup.ts (256 lines) already provides chrome storage/session mocks — verify it exposes `__chromeStorageMap` (CLAUDE.md testing section) for `np_preferences`/`np_endpoint_overrides` tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | API keys never leave the machine except to the user-configured provider; keys encrypted at rest in np_providers (Phase 2 EncryptedStorage, §15.2); `Requester` never interpolates keys into error strings (aiProvider.ts T-01-10 contract) |
| V3 Session Management | partial | `np_active_stream` is session-scoped (chrome.storage.session) and cleared on stream end/abort (Appendix J.2); no auth tokens in this phase |
| V4 Access Control | no | No user-role model in v0.1; tool governance surface is Phase 18 (zero tools in Phase 3, D-46) |
| V5 Input Validation | yes | zod on every cross-boundary shape: PlannerDecisionSchema, canonical stream events, PersonaProfileSchema, storage reads; closed error-code set (§21.6 — no invented codes, D-38) |
| V6 Cryptography | yes | No new crypto in Phase 3 — consumes Phase-2 EncryptedStorage for np_providers read; never hand-roll |

### Known Threat Patterns for the AI-runtime stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leakage via URL query strings | Information Disclosure | Gemini auth currently uses `key=` query param (INTEGRATIONS.md:16) — CONCERNS.md flags this ("keys leak into proxies/logs"); prefer header auth where the provider allows; never log URLs with keys (TraceRedactor is Phase 11 — use debugLog redaction discipline now) |
| Prompt injection via persona/override fields | Tampering | personaOverrides come from the operator's own UserPreferences (not host pages); content-script extraction is Phase 6; the system prompt is built from trusted constants (Appendix A) + operator config only |
| Malformed provider output (JSON repair loop) | DoS | Appendix L: exactly one repair, terminal STRUCTURED_OUTPUT_FAILED — no unbounded retry; per-stage timeouts (Planner 3 s, Renderer 5 s §1.2) + Requester 25 s default |
| Streaming resource exhaustion | DoS | ChunkBuffer flush caps (§22.1: 16 ms / 33 ms at >8 kB/s); abort signal threaded through every stage (Appendix I); `hasStreamedFirstToken` never-switch prevents mid-stream provider churn |
| Secrets in error surfaces | Information Disclosure | `testProviderConnection`/`fetchModelsOrError` build errors from status + server body only, never apiKey (aiProvider.ts:96-115); Requester codes are canonical (RATE_LIMITED/TIMEOUT/NETWORK, Requester.ts:31-38) |

## Sources

### Primary (HIGH confidence)
- `.planning/PRODUCT_SPEC_v0_1.md` — §1.1-§1.6, §10.6, §15.1/15.2, §17.7, §18 Phase 3 block (2522-2568), §20.3, §20.6, §20.10, §21.6, §22.1, Appendix A/D/I/J/K/L/N (read this session; verbatim quotes cited by line)
- [VERIFIED: npm registry] `npm view zod-to-json-schema` — version 3.25.2, peerDependencies `zod '^3.25.28 || ^4'`, published 2026-03-27; package-legitimacy verdict OK (57.7M/wk, StefanTerdell repo, no postinstall)
- [VERIFIED: platform.claude.com/docs/en/build-with-claude/streaming] — Anthropic SSE event flow, text_delta shape, error events
- [VERIFIED: platform.claude.com/docs/en/build-with-claude/prompt-caching] — 4-breakpoint cap (5th → 400), tools→system→messages cache hierarchy, exact prefix matching, ephemeral 5-min TTL, minimum cacheable token lengths
- In-repo source files (opened this session, verbatim quotes by path:line): `src/services/aiProvider.ts:424-444` (SSE bug), `src/types/index.ts:94,114-137` (CustomProviderId + ProviderConfig object shape), `src/core/storage/ChatHistoryDB.ts:24-53` (v1 schema), `src/types/storage.ts:46-57` (§20.3 op union), `src/core/http/Requester.ts:31-38` (canonical codes), `src/core/prompts/index.ts:1-4` (stub), `src/store/useExtensionStore.ts:674,749-755` (np_providers write), `src/components/chat/useChatStreaming.ts:75` (streamChatResponse call site), package.json:20 (verify:phase-3)

### Secondary (MEDIUM confidence)
- `.planning/codebase/INTEGRATIONS.md` — per-provider endpoints/auth (OpenAI Bearer, Anthropic x-api-key, Gemini key param, Ollama /api/tags), SSE fields
- `.planning/codebase/CONCERNS.md:76-78,205-208` — confirmed SSE parser bug + fix approach
- `.planning/RESEARCH-RECONCILIATION.md` §D/§F — REQ-R09 (SSE rebuild), REQ-R20 (remove simulated AI), A-3 (zod ^4)
- `.planning/research/SUMMARY.md`, `.planning/research/PITFALLS.md` — P1 (SW suspension → streams in surfaces), P2 (write-rate), P5 (SSE prod-only), Flag C (OperationId reuse)

### Tertiary (LOW confidence)
- Gemini wire-format detail (ai.google.dev unreachable this session) — corroborated by in-repo INTEGRATIONS/CONCERNS + training knowledge → tagged [ASSUMED] (A2)
- OpenAI SSE chunk envelope detail — field path in-repo verified, envelope [ASSUMED] (A3)
- OpenAI JSON-mode request shape `response_format: {type:'json_object'}` and Gemini `responseMimeType:'application/json'` [ASSUMED] (verify against live APIs at implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zod-to-json-schema verified against npm registry + Appendix L pin; all other deps already locked
- Architecture: HIGH — Appendix A/D/I/J/K/L/N are verbatim reference implementations; in-repo gaps (ActiveStreamState, prompts stub, UserPreferences) confirmed by direct file reads
- Pitfalls: HIGH — SSE wire formats verified from official Anthropic docs + in-repo corroboration; caching limits verified from official docs; Gemini/OpenAI envelope details MEDIUM [ASSUMED]

**Research date:** 2026-08-26
**Valid until:** 2026-09-02 (7 days — provider API surfaces move fast; zod-to-json-schema 3.25.2 verified 2026-03-27 publish)
