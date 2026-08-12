# Phase 4: Context-Adaptive Execution - Research

**Researched:** 2026-08-12
**Domain:** Context-window tiering, token budgeting, prompt degradation, provenance manifests (TypeScript / ai SDK v4 / WXT extension core)
**Confidence:** HIGH (SDK surface + codebase verified from installed packages and source); MEDIUM (model-window table values, budget-column mapping)

## Summary

Phase 4 replaces the Phase-3 `contextHelper` (deletion target, D-02/D-04-08) with the spec §2.1–§2.6 stack: `TokenBudget` (formula + per-section caps + the token counter), `ContextOptimizer` (tier classification, packing, stepwise degradation, minimal mode, CONTEXT_TOO_LARGE terminal), `ContextCompressor` (structural compression primitives), `ContextPack` (section packing), and the extended `ContextProvenanceManifest`. The behavioral change is confined to the hook (`useStreamingLLM.ts`) plus an **input-only per-stage context seam** on `runAgentTurn` — Planner/Renderer are import-swaps (D-04-07).

**Two decisive verified facts shape the plan:** (1) The `ai@4.3.19` SDK exposes **no token counter and no context window** on `LanguageModel` (verified in the installed `@ai-sdk/provider@1.1.3` `LanguageModelV1` type — the only fields are provider/modelId/doGenerate etc.); `ILLMProvider.getModels()` is an `@implementation-tier` stub that throws; and `ProviderConfig.contextWindow` (per-provider, not per-model) is dropped at both `configuredFromRegistry()` and the `TierResolveInput` boundary. **Therefore the resolved window MUST come from a canonical static model→window map** (the agent's-discretion item), extended IN PLACE into `src/core/context/ModelContextTier.ts`, stamped onto `StageInvocation.modelContextWindow` by `ProviderRouter.buildInvocation`. (2) The **heuristic counter IS the counter** for Phase 4 — `ceil(chars/4)` English vs `ceil(chars/3)` CJK per-section (D-04-10) — and `estimateTokens` must move into `TokenBudget`, migrating its **one other consumer** (`AgentOrchestrator.ts` L33/L278 replan-feedback section) so the `contextHelper` deletion compiles.

**Primary recommendation:** Extend the seeded homes IN PLACE (`ModelContextTier` gains `MODEL_CONTEXT_WINDOWS` + `resolveModelContextWindow`; `ContextProvenanceManifest` gains the D-04-17 fields + a co-located Zod schema); make `StageInvocation` carry a **required** `modelContextWindow: number` (mechanical test-fixture updates in `AgentOrchestrator.test.ts`/`.budget.test.ts`/`useStreamingLLM.test.tsx`); add the optional `contextForStage` input-only seam to `AgentTurnInput` mirroring `invocation` (defaults to `() => input.context` — all existing tests stay green); throw a typed `ContextTooLargeError` (code `CONTEXT_TOO_LARGE`, already canonical in spec C.2 L3512/L5040) from the optimizer when even minimal mode exceeds the window, and map it in the hook to a failed state with a new STR "message too long" copy (D-04-15).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **G0 — Requirement Reconciliation (CTX-02/CTX-03):** Phase 4 implements spec §2.1–§2.6 + the §18 Phase-4 create-list only. Neither CTX-02 nor CTX-03 is enumerated in spec §18 (AI-07 precedent). REQUIREMENTS.md gets an AI-07-style re-map note, also disambiguating the Phase-4 CTX ids from the spec §28.3 trust-aware CTX-01..06 namespace (Phase 4b).
- **D-04-02 [CTX-02 = typed input-only event seam]:** "ContextUpdate events" = a typed input-only seam on the optimizer/runAgentTurn path (`onStreamDelta` precedent): an optional input signaling that context inputs changed → the optimizer re-selects/repacks. **No consumer in Phase 4**. StageEvent stays a TYPE, never an event bus (L1).
- **D-04-03 [CTX-03 = minimal-mode compact-prompt selection]:** "Phase-aware prompting" = the optimizer selects canonical compact prompt constants (§2.5 "compact system prompt") when minimalMode is active. NOT a new prompting subsystem.
- **D-04-04 [classify-from-resolved-window]:** Tier + budgets derive from the resolved model's context window via `classifyModelContext` (§2.1). The hook resolves planner and renderer stages upfront (`createStageInvocation`), reads the resolved window from each `StageInvocation`, and runs the optimizer per stage. The per-surface default (`medium`) is a **pre-resolution fallback only** — never the primary source.
- **D-04-05 [per-stage optimization]:** Each stage budgets against its own resolved model — planner and renderer may resolve different models → different tiers. Loop caps (`plannerCap`/`toolCap`/`mcpChaining`, §1.4) derive from the **planner-stage tier**; the renderer stage carries its own budget/maxTokens.
- **D-04-06 [unknown window → conservative]:** A custom OpenAI-compat/Ollama model with an unknown window falls back to the smallest safe tier, flagged in the manifest; never assume `large`.
- **D-04-07 [drop-in, output identical]:** The output `OptimizedContext` shape stays §2.3-identical (same `sections[]` semantics). Only the INPUT changes (resolved model window). Planner/Renderer are import-swaps; the behavioral change is confined to the hook + an input-only per-stage context seam on `runAgentTurn`. Not a 3-file breaking swap.
- **D-04-08 [contextHelper deletion]:** `src/core/ai/contextHelper.ts` is deleted; its call sites migrate to `ContextOptimizer`. `estimateTokens` moves into `TokenBudget`. Golden Rule 3 preserved — the hook still imports a core builder, never assembles prompts.
- **D-04-09 [counting read-only]:** Token counting is READ-ONLY over section text — it never rewrites the byte-stable `[SYSTEM]` persona block (§1.3/F-5); counting must not silently kill Phase-3 prompt-cache wins.
- **D-04-10 [counter strategy]:** provider-native counter when the SDK exposes it; else script-aware fallback: `ceil(chars/4)` English vs `ceil(chars/3)` CJK, detected per-section by Unicode-range ratio; mixed script uses the higher-cost divisor. No custom tokenizer. §2.2 formula: `inputBudget = 0.70×window`, `outputBudget = 0.20`, `safetyMargin = 0.10`; the per-section distribution table feeds **per-section caps that DRIVE degradation** — never hard truncation.
- **D-04-11 [compact constants]:** New canonical per-role compact system prompt constants (planner/renderer; §2.5 "compact system prompt") added to Appendix A PROMPTS + `src/core/prompts/index.ts`, selected by `ContextOptimizer` when minimalMode. STR copy contract (Appendix B) governs any new UI copy.
- **D-04-12 [full §2.4 ladder]:** The complete degradation pipeline ships in §2.4 order: drop debug-only → drop secondary notes/optional metadata → summarise older history → compress page/case context → trim tool schemas to in-scope → reduce memory top-k → minimal mode → CONTEXT_TOO_LARGE. Only steps whose data exists in Phase 4 do REAL work (drop debug, trim tool schemas, minimal mode); notes/memory/pageContext/history steps are structurally-present no-ops until Phase 4a/5/7.
- **D-04-13 [no mid-structure truncation]:** Degradation operates at SECTION granularity — a section is dropped/compressed whole; never truncated mid-structure (CTX-04). Per-section caps feed degradation, not hard truncation.
- **D-04-14 [minimal mode]:** Entered when `tier == tiny` (mandatory, §2.5) OR escalated to by the degradation ladder. Concrete Phase-4 effects: compact system prompt, ≤1 safe tool schema, reduced non-system sections. MCP chaining block reuses the existing `TIER_CAPS.mcpChaining: false` (tiny/small already false); LLM-Wiki RAG synthesis block is a Phase-5a consumer concern — the optimizer only marks `minimalMode`, the 5a consumer enforces the RAG fallback (§2.5).
- **D-04-15 [CONTEXT_TOO_LARGE honest terminal]:** If even minimal mode exceeds the window, return a typed `CONTEXT_TOO_LARGE` terminal (canonical §C.2 code — new code canonicalized into spec Appendix C.2 before shipping, W-1 gate). The hook maps it to a failed state with a "message too long" surface (new STR copy). NEVER silently truncates user input.
- **D-04-16 [history slice reserved]:** The History budget slice (§2.2 table) is reserved-but-unfilled in P4 (ChatHistoryDB = Phase 7) — a structurally-present empty section, not dead code.
- **D-04-17 [manifest contract]:** `ContextProvenanceManifest` (seeded, extend IN PLACE) enumerates: tier, model, window, per-section token counts, which §2.4 steps fired, counter-method-used (native vs heuristic), `truncated`/`compressionApplied` per section. Zod-validated at the public boundary (GR-4 fixture tests).
- **D-04-18 [kind lockstep]:** `manifest.sections[].kind` MUST mirror `PromptSection['kind']` — a lockstep guard (test preferred, codebase-idiomatic) prevents drift (03a-01 precedent).
- **D-04-19 [lifetime/redaction]:** Manifest is in-memory per-turn, redacted via TraceRedactor if ever logged (R-10), NOT persisted (durable trace = Phase 6 AITransactionLog).

### the agent's Discretion

- Exact model-window lookup source (`ModelInfo.contextWindow` vs canonical map) — **resolved below: canonical map** (getModels is a throwing stub; SDK exposes nothing).
- `CONTEXT_TOO_LARGE` throw-vs-return shape at the optimizer boundary — **resolved below: throw a typed error** (drop-in signature + StructuredOutputFailedError precedent).
- Lockstep-guard mechanism (test preferred) — **resolved below: runtime union-member parity test**.
- Exact per-section distribution enforcement mechanics (`TokenBudget` caps → which §2.4 steps fire in which order).
- Compact prompt constant text — follow Appendix A verbatim style; researcher/planner drafts.

### Deferred Ideas (OUT OF SCOPE)

- ContextUpdate consumers (page/state-change re-pack triggers) — Phase 4a PageContextBridge / Phase 7; P4 ships only the typed input-only seam (D-04-02).
- Real degradation work for notes/memory/pageContext/history steps — Phase 4a/5/7; structural no-ops in P4 (D-04-12).
- LLM-Wiki RAG synthesis fallback enforcement — Phase 5a consumer ("Ask notes" plain MiniSearch in tiny mode); P4 only marks `minimalMode` (D-04-14).
- Durable context trace / receipt UI (Prompt Inspector) — Phase 4b (context receipt) / Phase 6 (AITransactionLog); manifest in-memory + redacted in P4 (D-04-19).
- History budget slice filling — Phase 7 (ChatHistoryDB consumers); reserved-empty in P4 (D-04-16).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-01 | Context windows (small/medium/large) selectable with budget enforcement | §2.1 `classifyModelContext` (already seeded) + §2.2 formula; **window source = canonical `MODEL_CONTEXT_WINDOWS` map + `StageInvocation.modelContextWindow`** (Finding W-1); budgets via `TokenBudget`; per-section caps drive degradation |
| CTX-02 | ContextUpdate events trigger context-aware selection on rapid page/state change | D-04-02: typed input-only re-pack seam on the optimizer/runAgentTurn path; **no consumer in P4** — seam + fixture only (matches the AI-07 re-map precedent) |
| CTX-03 | Phase-aware prompting applies per-context-role guidance | D-04-03: minimal-mode compact prompt constants (Appendix A addendum + `src/core/prompts/index.ts`) selected by the optimizer; **not a new prompting subsystem** |
| CTX-04 | OptimizedContext degrades gracefully per §2.4 without mid-structure truncation | §2.4 ladder in D-04-12 order; section-granularity drops (D-04-13); honest `CONTEXT_TOO_LARGE` terminal (D-04-15) never truncates user input |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Model-window resolution | API/Backend (core context layer) | Router (ProviderRouter) | The canonical map lives in `src/core/context/ModelContextTier.ts` (extend IN PLACE); `ProviderRouter.buildInvocation` stamps `StageInvocation.modelContextWindow` so the hook/orchestrator read it — no model call, deterministic |
| Token counting | API/Backend (core context layer) | — | `TokenBudget` owns the counter (heuristic: chars/4 English, chars/3 CJK); read-only over section text (P4-8) |
| Budget computation | API/Backend (core context layer) | — | `TokenBudget`: 70/20/10 formula + per-section caps table (§2.2) — pure, deterministic |
| Section packing | API/Backend (core context layer) | — | `ContextPack` (seeded from contextHelper's packing shape); §1.3 canonical order; byte-stable cached kinds (F-5) |
| Degradation / minimal mode | API/Backend (core context layer) | Orchestrator caps | `ContextOptimizer` runs the §2.4 ladder at section granularity; minimal mode reuses `TIER_CAPS` (orchestrator) for MCP-chaining block |
| Per-stage context selection | Frontend Server / hook (orchestration glue) | Orchestrator input seam | The hook resolves both stages upfront (D-04-04), runs the optimizer per stage, threads per-stage contexts via the input-only `contextForStage` seam; loop caps from the planner-stage tier (D-04-05) |
| Provenance manifest | API/Backend (core context layer) | — | `ContextProvenanceManifest` (extend IN PLACE) stamped on every OptimizedContext; Zod-validated at the public boundary |
| Terminal error surfacing | Hook (UI state machine) | — | The hook maps `CONTEXT_TOO_LARGE` → failed state + STR copy; the optimizer never talks to the UI |
| RAG / MCP-chaining enforcement | Consumer (Phase 5a / caps) | — | P4 only marks `minimalMode`; enforcement is a 5a consumer concern + `TIER_CAPS.mcpChaining` (D-04-14) |

## Standard Stack

### Core

No new runtime packages. Phase 4 uses only the already-approved, already-installed stack:

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | 3.25.76 | Manifest + optimizer-boundary validation (GR-4) | Approved stack §7; co-located schema precedent (`ProviderConfigSchema`, harness.ts D-3a-20) |
| `ai` + `@ai-sdk/*` | 4.3.19 / 1.x | `LanguageModel` type in `StageInvocation` (imported, window read from the map not the SDK) | Already the Phase-3 runtime seam |
| TypeScript strict | 5.9.3 | Type-level contracts (no new types invented; R-1) | Project-wide |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `vitest` | 4.1.10 | Unit tests `tests/core/context/**` + lockstep guard + hook regression | All P4 tests (existing infra) |
| `tests/fixtures/optimizedContext.ts` | — | D-08 fixture — EXTEND with window set / over-budget / CJK samples (P4-15, WR-13) | Every optimizer/TokenBudget test |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canonical `MODEL_CONTEXT_WINDOWS` map (extend `ModelContextTier.ts` IN PLACE) | `ModelInfo.contextWindow` from `ILLMProvider.getModels()` | **`getModels()` is a throwing `@implementation-tier` stub** in all four providers [VERIFIED: src/core/ai/providers/*.ts L36-40] and would be a network `/models` call — violates "zero model calls in optimization" and adds latency. Rejected. |
| Canonical map | `RegistryProviderInfo.contextWindow` (user-declared per-provider value) | Exists but is **per-provider, not per-model**, and is dropped at two boundaries (`configuredFromRegistry()` in the hook, `TierResolveInput.configuredProviders` in main.tsx). A provider-level window can be wrong for a specific model. Open question: consult it as a fallback for unknown custom models (see Open Questions). |
| `countTokens` from `ai` | — | **Does not exist in ai@4.3.19** [VERIFIED: full export list of node_modules/ai/dist/index.d.ts]. The heuristic fallback IS the counter (D-04-10). |

**Version verification:** No new packages are installed by this phase — the stack above is verified against `package.json` (ai 4.3.19, @ai-sdk/openai 1.3.24, anthropic 1.2.12, google 1.2.22, zod 3.25.76, vitest 4.1.10). No `npm install` required.

## Package Legitimacy Audit

> No external packages are installed by Phase 4 — all dependencies are already in `package.json` (approved stack §7, R-9). The Package Legitimacy Gate is therefore trivially satisfied: nothing new enters the dependency tree. The only "new" constants are canonical code (error codes, prompt constants, model-window table) — no registry packages.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                        ┌────────────────────────────────────────────────┐
                        │  useStreamingLLM.ts (hook — the ONE behavior   │
                        │  change surface, D-04-07)                      │
                        │  pre-resolution fallback: medium/16K (never    │
                        │  primary — D-04-04)                            │
                        └───────────────┬────────────────────────────────┘
                                        │ send(userInput)
                                        v
                 ┌──────────────────────────────────────────────┐
                 │ ProviderRouter.createStageInvocation (03-05) │  zero model calls
                 │  → StageInvocation gains modelContextWindow  │  (sync resolution)
                 └───────────────┬──────────────────────────────┘
                                 │ per stage: planner (haiku) + renderer (flash)
                                 v
            ┌──────────────────────────────────────────────────────┐
            │ ModelContextTier.resolveModelContextWindow(prov,model)│ ← canonical map
            │        → classifyModelContext(window) → tier          │    (extend IN PLACE)
            └───────────────────────┬──────────────────────────────┘
                                    v
             ┌────────────────────────────────────────────────────────┐
             │ TokenBudget (estimateTokens + 70/20/10 + per-section    │
             │  caps from §2.2 distribution table)                     │
             └───────────────────────┬────────────────────────────────┘
                                     v
      ┌──────────────────────────────────────────────────────────────────┐
      │ ContextOptimizer.optimize(ContextOptimizerInput)                 │
      │  → ContextPack packs §1.3-order PromptSection[] (persona block,  │
      │    tool schemas, preferences, memory, context, task, user input) │
      │  → per-section caps exceeded? → ContextCompressor ladder §2.4    │
      │     (drop debug → drop secondary → summarise → compress →        │
      │      trim tools → reduce top-k → minimal mode → CONTEXT_TOO_LARGE)│
      │  → stamps ContextProvenanceManifest (Zod-validated)             │
      │  → returns OptimizedContext (drop-in, cache-stable) OR throws   │
      │    typed ContextTooLargeError (CONTEXT_TOO_LARGE)               │
      └───────┬───────────────────────────────┬────────────────────────┘
              │ planner-stage context         │ renderer-stage context
              v                               v
      runAgentTurn (AgentOrchestrator)   ── contextForStage('planner'|'renderer')
        loop caps = capsForTier(plannerContext.tier)  ← D-04-05
        PlannerService.plan ← planner context        (import-swap only)
        RendererService.render ← renderer context    (import-swap only)
              │
              v
        hook maps CONTEXT_TOO_LARGE → failed + STR "message too long" (D-04-15)
```

**Reading the diagram:** user input enters via the hook; the hook resolves both stages through the Router (which now carries the model window), classifies tiers, budgets via TokenBudget, and runs the optimizer once per stage — all before any provider call. The orchestrator consumes the planner context in the loop and the renderer context at finish through the input-only seam. Every OptimizedContext exits with a stamped manifest. Nothing here touches the background SW (R-3).

### Recommended Project Structure

```
src/core/context/                       # §18 Phase-4 create-list
├── ModelContextTier.ts                 # EXTEND IN PLACE (P-3b): + MODEL_CONTEXT_WINDOWS
│                                       #   + resolveModelContextWindow(providerId, model)
├── TokenBudget.ts                      # NEW: estimateTokens (moved from contextHelper),
│                                       #   computeBudgets(window), per-section caps, CJK ratio
├── ContextOptimizer.ts                 # NEW: optimize(ContextOptimizerInput) → OptimizedContext
│                                       #   (ladder, minimal mode, manifest stamping)
├── ContextCompressor.ts                # NEW: §2.4 section-level primitives (drop/trim/summarise
│                                       #   markers; notes/memory/page/history = structural no-ops)
├── ContextPack.ts                      # NEW: §1.3 section packing (seeded from contextHelper)
└── ContextProvenanceManifest.ts        # EXTEND IN PLACE: D-04-17 fields + co-located Zod schema
src/core/ai/
├── contextHelper.ts                    # DELETED (D-04-08) — estimateTokens + packing migrate
├── AgentOrchestrator.ts                # + contextForStage input seam; estimateTokens import → TokenBudget
├── ProviderRouter.ts                   # StageInvocation + modelContextWindow (required field)
└── types.ts                            # unchanged homes (PromptSection/OptimizedContext import only)
src/components/pages/useStreamingLLM.ts # rewire: per-stage resolver → window → optimizer; maps CONTEXT_TOO_LARGE
src/core/prompts/index.ts               # + compact planner/renderer constants (D-04-11)
src/core/error/errorCodes.ts            # + CONTEXT_TOO_LARGE (IN PLACE; mirrors spec C.2)
tests/core/context/                     # NEW: ContextOptimizer / ContextCompressor / TokenBudget tests
tests/fixtures/optimizedContext.ts      # EXTEND: window set / over-budget / CJK+mixed samples (P4-15)
```

### Pattern 1: The input-only per-stage context seam (mirrors `invocation`)

**What:** An optional `contextForStage?: (stage: 'planner' | 'renderer') => OptimizedContext` on `AgentTurnInput`, defaulting to `() => input.context`. The orchestrator resolves the planner context at `planOnce` (loop iterations incl. replan) and the renderer context at `finish` (`RendererService.render`). This is a direct-call input seam — never an event bus (L1), matching the `onStreamDelta`/`invocation`/`onTransition` precedent.

**When to use:** Per-stage optimization (D-04-05) where planner and renderer may resolve different models → different tiers/budgets.

**Example (orchestrator shape, current code to modify):**

```typescript
// src/core/ai/AgentOrchestrator.ts — additive, non-breaking
export interface AgentTurnInput {
  // ... existing fields ...
  /** D-04-05 input-only seam: per-stage OptimizedContext (planner loop / renderer finish). */
  contextForStage?: (stage: 'planner' | 'renderer') => OptimizedContext;
}

// Default keeps every existing call site + test green (drop-in, D-04-07):
// planOnce:   const ctx = input.contextForStage ? input.contextForStage('planner') : input.context;
// finish:     const renderCtx = input.contextForStage ? input.contextForStage('renderer') : input.context;
// Loop caps stay hook-side:  tier: capsForTier(plannerContext.tier)   // D-04-05
```

### Pattern 2: Typed terminal error (StructuredOutputFailedError precedent)

**What:** The optimizer throws a typed carrier when even minimal mode exceeds the window — never returns a degraded-but-truncated context, never truncates user input mid-structure.

```typescript
// Source: mirror of StructuredOutput.ts L150-154 / ProviderRouter.ts unavailable() pattern
export interface ContextTooLargeError extends Error {
  code: 'CONTEXT_TOO_LARGE';           // canonical §C.2 — already in spec L3512/L5040
  reason: 'minimal_mode_exceeded';
  totalTokens: number;
  inputBudget: number;
}
```

**When to use:** The terminal step of the §2.4 ladder (D-04-15). Throw keeps the optimizer's return type `OptimizedContext` — a true drop-in for `contextHelper.buildOptimizedContext` (D-04-07).

### Anti-Patterns to Avoid

- **Per-provider `contextWindow` as the window source:** it is per-provider, user-declared, and dropped at the TierResolve boundary — using it for a specific model can silently over- or under-classify. Map first, conservative tiny fallback (D-04-06).
- **Counting that mutates the [SYSTEM] section:** counting is read-only (D-04-09); rewriting the persona block kills anthropic prompt caching (P4-8).
- **Hard truncation instead of section drops:** per-section caps DRIVE degradation; a cap is not a license to slice a section's text (D-04-13, CTX-04).
- **A `history` kind invented for PromptSection:** the reserved history slice (D-04-16) is a budget-column reservation, not a new section kind (R-1/R-2 — no invented identifiers).
- **Async window lookup:** `getModels()` is a throwing stub and would break the "2 calls / healthy turn" through-line. The map is synchronous.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model context window per model | A network `/models` call or an SDK field crawl | Canonical static `MODEL_CONTEXT_WINDOWS` map (6 known Appendix-D models) + conservative tiny fallback | SDK exposes nothing (verified); network calls violate zero-model-calls; the map is deterministic and cache-stable |
| Token counting | A custom tokenizer / BPE | `ceil(chars/4)` English vs `ceil(chars/3)` CJK per-section, mixed → higher divisor (D-04-10, P4-13) | No native counter in ai@4.3.19 (verified); a tokenizer is out of approved stack and overkill for budget gating |
| MCP-chaining blocking in minimal mode | A new runtime gate | `TIER_CAPS.mcpChaining` (tiny/small already false) + `capsForTier(plannerContext.tier)` | The §1.4 caps table already encodes it; the hook already threads it (D-04-14) |
| Error codes | New free-form strings | `CONTEXT_TOO_LARGE` from `errorCodes.ts` (mirror of spec C.2 L3512/L5040) | Golden Rule 9; the code is already canonical in the spec — no W-1 churn beyond mirroring |

**Key insight:** Phase 4's hard problems (token counting, model windows) are solved by *not* reaching for the SDK or the network — the SDK doesn't expose them, and the spec's deterministic model (map + heuristic + conservative fallback) is cheaper, testable, and honors the through-line.

## Runtime State Inventory

> Phase 4 deletes `contextHelper.ts` and rewires its call sites — a refactor-with-deletion. Stored data / live services / OS registrations are not affected (pure source refactor).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore key references `contextHelper` or `OptimizedContext` | none |
| Live service config | None — no external service config references the module names | none |
| OS-registered state | None — no task/daemon registrations | none |
| Secrets/env vars | None — no env keys reference these modules | none |
| Build artifacts | **Source call sites of `contextHelper`:** `useStreamingLLM.ts` (L28 `buildOptimizedContext`), `AgentOrchestrator.ts` (L33/L278 `estimateTokens` — used for the replan-feedback `tool_result` section). `StructuredOutput.ts` L137 has an **inline** `Math.ceil(repairText.length / 4)` (not an import — deliberately left or migrated per planner). | **Code edit (required):** move `estimateTokens` into `TokenBudget` and re-point the orchestrator import BEFORE deleting `contextHelper.ts` — otherwise `tsc` breaks at the deletion commit. Hook migrates to `ContextOptimizer` (D-04-08). The `tests/components/pages/useStreamingLLM.test.tsx` and `tests/core/ai/AgentOrchestrator*.test.ts` mock/import surfaces must be updated in the same commit. |

## Common Pitfalls

### Pitfall 1: Deleting `contextHelper` before migrating `estimateTokens`
**What goes wrong:** `tsc --noEmit` fails at the deletion commit (AgentOrchestrator L33 imports it).
**Why it happens:** D-04-08 moves the function into `TokenBudget` but the deletion target has a **second consumer** beyond the hook (the replan-feedback section, D-3a-11).
**How to avoid:** Migration commit = `TokenBudget.estimateTokens` export + orchestrator import swap + hook swap + deletion in ONE plan wave. Grep-gate: zero `contextHelper` imports remain.
**Warning signs:** `pnpm typecheck` fails with `Cannot find module '@/core/ai/contextHelper'`.

### Pitfall 2: Adding `modelContextWindow` as optional instead of required
**What goes wrong:** An optional window silently degrades to the fallback tier forever — D-04-04's "never the primary source" inverted.
**Why it happens:** Optionality is tempting to avoid touching test fixtures.
**How to avoid:** Make it **required** on `StageInvocation`; mechanically update the three fixture builders (`AgentOrchestrator.test.ts` `stageInvocation()` L55-63, `AgentOrchestrator.budget.test.ts`, `useStreamingLLM.test.tsx` hoisted mock) with deterministic windows.
**Warning signs:** `tsc` errors listing the fixture sites — that's the compiler doing the inventory for you.

### Pitfall 3: Budget-column → section-kind mis-mapping
**What goes wrong:** The §2.2 distribution table has 6 columns (System/Tools/Memory/Context/History/User) but `PromptSection` has 8 kinds (system/tool_schemas/preferences/memory/context/task/user_input/tool_result). A naive 1:1 mapping invents a `history` kind or double-counts.
**Why it happens:** The spec table is a budget taxonomy, not a section-kind enum.
**How to avoid:** Define the canonical mapping in `TokenBudget` and test it: `System → system+preferences`, `Tools → tool_schemas`, `Memory → memory`, `Context → context`, `History → reserved (0 filled in P4)`, `User → user_input+task`. `tool_result` (replan feedback) rides under the User or is uncapped-but-counted in `totalTokens` — pick one and test it.
**Warning signs:** Section kinds appearing in the manifest that aren't in the distribution table.

### Pitfall 4: Truncating mid-section to "fit" a cap
**What goes wrong:** A cap-driven `text.slice(...)` corrupts the byte-stable [SYSTEM] (kills prompt caching, P4-8) or silently drops user content (data-loss lie, P4-10).
**Why it happens:** Caps feel like budgets; developers reach for slice as the easy enforcement.
**How to avoid:** Section-granularity only (D-04-13); the user_input section is never truncated — over-cap user input walks the ladder to CONTEXT_TOO_LARGE (D-04-15).
**Warning signs:** Any `.slice(`/`.substring(` on `PromptSection.text` in the context layer — grep-gate it.

### Pitfall 5: Treating the ladder's no-op steps as real work
**What goes wrong:** Building summarisation/compression for notes/memory/pageContext/history that don't exist yet — scope creep past §18's create-list (G0).
**Why it happens:** §2.4 reads like a full pipeline.
**How to avoid:** Only drop-debug, trim-tool-schemas, and minimal mode do REAL work in P4 (D-04-12); the rest are structurally-present steps with no-op inputs, asserted in the ContextOptimizer test.
**Warning signs:** New modules beyond the §18 create-list / new `ContextOptimizerInput` fields for non-existent data.

### Pitfall 6: Manifest drift from PromptSection kinds
**What goes wrong:** `manifest.sections[].kind` and `PromptSection['kind']` diverge (the 03a-01 'tool_result' lesson) — the manifest stops being a faithful provenance record.
**Why it happens:** Two independent union declarations.
**How to avoid:** The D-04-18 lockstep guard — a test asserting union-member parity (see Code Examples); the manifest's Zod schema validates at the boundary.
**Warning signs:** A new `PromptSection` kind lands with no manifest-schema update.

### Pitfall 7: The hook leaking its own prompt assembly
**What goes wrong:** The rewire drifts into the hook composing compact prompts or budgets itself.
**Why it happens:** The rewire is the biggest diff of the phase.
**How to avoid:** Golden Rule 3 stays: the hook imports `ContextOptimizer` + `TokenBudget` (core builders), never assembles a prompt; compact prompt text lives only in `src/core/prompts/index.ts` (D-04-11).
**Warning signs:** Prompt strings or budget math appearing in `useStreamingLLM.ts`.

## Code Examples

Verified patterns from the codebase (source: local files read this session):

### Estimate tokens — script-aware heuristic (D-04-10)
```typescript
// Source: seeds from contextHelper.estimateTokens (src/core/ai/contextHelper.ts L28-30)
// + D-04-10 (ceil(chars/4) English vs ceil(chars/3) CJK, per-section Unicode-range ratio).
// CJK ranges: CJK Unified Ideographs U+4E00–U+9FFF, Hiragana/Katakana U+3040–U+30FF,
// Hangul U+AC00–U+D7AF, CJK Punctuation/Fullwidth U+3000–U+303F, U+FF00–U+FFEF.
const CJK_RE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  let cjk = 0;
  for (let i = 0; i < text.length; i++) {
    if (CJK_RE.test(text[i])) cjk++;
  }
  // mixed script → the higher-cost divisor (D-04-10 / P4-13)
  const divisor = cjk / text.length >= 0.3 ? 3 : 4;
  return Math.ceil(text.length / divisor);
}
```

### Tier classification + conservative window resolution (D-04-04/D-04-06)
```typescript
// Source: PRODUCT_SPEC §2.1 (lines 415-433, seeded at
// src/core/context/ModelContextTier.ts) — extend IN PLACE, never re-declare (R-1).
import { classifyModelContext } from '@/core/context/ModelContextTier';

// Canonical model→window table for the six Appendix-D candidates [ASSUMED values —
// planner MUST confirm with the user before locking (Assumptions A2..A7)].
export const MODEL_CONTEXT_WINDOWS: Readonly<Record<string, number>> = {
  'claude-haiku-4-latest': 200_000,  // large
  'deepseek-chat':          65_536,  // medium
  'gemini-2.5-flash':    1_048_576,  // large
  'llama3.2:3b':              4_096, // tiny (Ollama default num_ctx)
  'qwen2.5:7b':               4_096, // tiny (Ollama default num_ctx)
};

/** D-04-06: unknown model → smallest safe tier + windowKnown flag (never large). */
export function resolveModelContextWindow(modelId: string): {
  contextWindow: number;
  windowKnown: boolean;
} {
  const known = MODEL_CONTEXT_WINDOWS[modelId];
  return known !== undefined
    ? { contextWindow: known, windowKnown: true }
    : { contextWindow: 4096, windowKnown: false }; // conservative tiny
}
```

### Manifest kind-lockstep guard (D-04-18, test-preferred)
```typescript
// tests/core/context/ContextProvenanceManifest.test.ts (new) — 03a-01 precedent.
// Both unions must track each other: manifest.sections[].kind mirrors
// PromptSection['kind'] (incl. the 03a-01 'tool_result' member).
import { ContextProvenanceManifestSchema } from '@/core/context/ContextProvenanceManifest';
import type { PromptSection } from '@/core/ai/types';

it('manifest kind union mirrors PromptSection kind union (lockstep, D-04-18)', () => {
  const manifestKinds = new Set(
    ContextProvenanceManifestSchema.shape.sections.element.shape.kind.options,
  );
  const sectionKinds = new Set<PromptSection['kind']>([
    'system', 'tool_schemas', 'preferences', 'memory', 'context', 'task', 'user_input', 'tool_result',
  ]);
  expect(manifestKinds).toEqual(sectionKinds);
});
```

### Per-section budgets (§2.2 formula + distribution table → caps)
```typescript
// Source: PRODUCT_SPEC §2.2 (lines 435-451). 70/20/10 formula + tier distribution.
export function computeBudgets(contextWindow: number) {
  return {
    inputBudget: Math.floor(contextWindow * 0.70),
    outputBudget: Math.floor(contextWindow * 0.20),
    safetyMargin: Math.floor(contextWindow * 0.10),
  };
}

// Per-section caps = distribution% × inputBudget (Distribution row from §2.2 L444-449).
// Canonical column→kind mapping (Pitfall 3): System→system+preferences,
// Tools→tool_schemas, Memory→memory, Context→context, History→reserved-unfilled (D-04-16),
// User→user_input+task. Caps DRIVE degradation — never hard truncation (D-04-13).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase-3 `contextHelper`: fixed `medium` tier, 16K/1K hardcoded budgets, `ceil(chars/4)` only, no degradation, no manifest fields | `ContextOptimizer`: per-stage tier from resolved window, TokenBudget 70/20/10 + per-section caps, CJK-aware counting, §2.4 ladder, manifest stamped | Phase 4 | The hook stops hardcoding; a tiny local model is actually budgeted as tiny |
| `StageInvocation` without a window (03-05) | `StageInvocation` carries `modelContextWindow` | Phase 4 | The optimizer can classify per stage without network calls |
| Persona block alone in [SYSTEM] (no stage system prompt in the runtime path) | Minimal mode selects canonical compact planner/renderer prompts into [SYSTEM] (D-04-11) | Phase 4 | First runtime consumer of Appendix A planner/renderer constants |

**Deprecated/outdated:**
- `src/core/ai/contextHelper.ts`: Phase-4 deletion target (D-02/D-04-08) — superseded by `ContextOptimizer`/`TokenBudget`/`ContextPack`.
- `countTokens` from `ai`: never existed in 4.3.19 — do not copy ai@5/v7-era docs referencing it (Phase-3 Pitfall precedent: read `node_modules/ai/dist/index.d.ts`, not live docs).

## Assumptions Log

> Claims tagged `[ASSUMED]` — the planner MUST gate these behind user confirmation before locking decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The canonical map extends `ModelContextTier.ts` IN PLACE rather than a new file | Standard Stack / Patterns | Minor — a +1 documented file is the fallback; the map must be single-declared (R-1) either way |
| A2 | `claude-haiku-4-latest` context window = 200K | Model-window map | Over-classifies to `large` if actually smaller → oversized prompts (mitigated by the 70% budget + ladder, but tier/caps change) |
| A3 | `deepseek-chat` context window = 64K | Model-window map | DeepSeek-V3 is 64K per training knowledge; if 32K, tier flips to small → caps 2/1 |
| A4 | `gemini-2.5-flash` context window = 1M | Model-window map | Still `large` at any ≥200K — low risk; only the budget scales |
| A5 | Ollama `llama3.2:3b` default window = 4K (num_ctx default) | Model-window map | Conservative by design (D-04-06); if the user's Ollama raises num_ctx, they must update the map or accept tiny behavior |
| A6 | Ollama `qwen2.5:7b` default window = 4K (num_ctx default) | Model-window map | Same as A5 |
| A7 | Unknown custom models → `tiny` (4096) + `windowKnown: false` | Model-window map | Conservative per D-04-06 — a user with a 32K custom model gets minimal-mode behavior until the map/user-config is updated |
| A8 | CJK ratio threshold 0.3 selects the higher-cost divisor | TokenBudget | A lower threshold would over-count English with a few CJK chars; behavior is testable and adjustable |
| A9 | Distribution-column mapping (System→system+preferences etc., Pitfall 3) | TokenBudget | The spec table's columns are not 1:1 with section kinds; this mapping is a planner/implementer resolution, not spec text |
| A10 | Budget percentages apply to `inputBudget` (0.70×window), not the raw window | TokenBudget | §2.2 defines budgets from the window; column percentages × inputBudget is the reasonable reading — confirm |
| A11 | `conversationId` for `ContextOptimizerInput` uses a constant (e.g. `'default'`) in P4 — no conversation store exists | Hook rewire | Harmless now; Phase 7 must thread the real id (spec §2.3 requires the field) |
| A12 | `StructuredOutput.ts` L137's inline `Math.ceil(chars/4)` stays as-is (English-only repair text) | Pitfall 1 | Cosmetically inconsistent with TokenBudget; correct behavior — do not churn |

## Open Questions

1. **Unknown-model window: consult `RegistryProviderInfo.contextWindow` (user-declared per-provider) before the tiny fallback?**
   - What we know: D-04-06 says unknown → smallest safe tier; the registry holds a per-provider `contextWindow` that is user-asserted but currently unused in resolution.
   - What's unclear: whether "user-asserted provider window" is more accurate than the conservative fallback for a custom Ollama model (e.g., a user who set 32K for their setup).
   - Recommendation: keep D-04-06 verbatim (map → tiny + flag) for P4; revisit when the Settings UI owns per-model windows. Planner may add a `providerDeclaredWindow` read as a stretch if the user confirms.

2. **Should the non-minimal path start consuming `PROMPTS.planner.system`/`PROMPTS.renderer.system` (currently unused in the runtime)?**
   - What we know: only `PROMPTS.repairJson.system` is consumed today; the [SYSTEM] section carries the persona block only.
   - What's unclear: appending the canonical stage prompt to the default path changes the cache bytes of every normal turn (D-04-07's drop-in/cache-stability constraint).
   - Recommendation: P4 leaves the default path byte-identical; only minimal mode selects the compact constants. Flag for the discuss-phase if the user wants the canonical prompts wired into the default path (a Phase-4.1-style decision, not required by §18).

3. **Budget-column mapping for `preferences`/`task`/`tool_result` (A9)**
   - What we know: 6 budget columns vs 8 section kinds.
   - What's unclear: exact allocation of preferences/task into System/User columns and where replan `tool_result` tokens count.
   - Recommendation: adopt the Pitfall-3 mapping; encode it as a tested constant in `TokenBudget`.

4. **`ContextPack` exact contract**
   - What we know: §18 create-list names it; the spec describes no shape; CONTEXT.md says the section-packing shape is the seed.
   - What's unclear: whether it is the packing module (sections→PromptSection[] with §1.3 order + stability flags) or a wrapper around the manifest.
   - Recommendation: ContextPack = pure section-packing (order, stability flags, sourceIds, text joins) that ContextOptimizer consumes — the natural home for contextHelper's migrated packing logic.

5. **CONTEXT_TOO_LARGE hook surfacing copy**
   - What we know: D-04-15 requires a "message too long" surface; STR is canonical (Appendix B / Copywriting Contract).
   - What's unclear: the exact verbatim copy.
   - Recommendation: add `chat.messageTooLong` to `STR.chat` + spec Appendix B (planner drafts copy; do not paraphrase).

## Environment Availability

> Phase 4 has no new external dependencies — all runtimes/tooling are already present and used by Phases 3/3a.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / pnpm | verify:phase-4 chain | ✓ | — | — |
| TypeScript 5.9.3 | tsc --noEmit gate | ✓ | 5.9.3 | — |
| vitest 4.1.10 | tests/core/context/** | ✓ | 4.1.10 | — |
| wxt 0.19.29 | build gate (R-3 isolation check) | ✓ | 0.19.29 | — |
| eslint 10 / prettier 3.9 | verify chain | ✓ | — | — |
| Provider MCP / network | — | not required | — | zero model calls in optimization (through-line) |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

> `workflow.nyquist_validation` is enabled (config.json absent key check: `true`). Required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.10 (installed) |
| Config file | `vitest.config.ts` (jsdom-align default env; core tests may use `@vitest-environment node` overrides per precedent) |
| Quick run command | `pnpm vitest run tests/core/context -x` |
| Full suite command | `vitest run` (then the full verify chain) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01 | Tier classification boundaries (tiny/small/medium/large) | unit | `pnpm vitest run tests/core/context/ContextOptimizer.test.ts -x` | ❌ Wave 0 |
| CTX-01 | Budget formula 70/20/10 + per-section caps | unit | `pnpm vitest run tests/core/context/TokenBudget.test.ts -x` | ❌ Wave 0 |
| CTX-01 | estimateTokens CJK/mixed heuristic | unit | `pnpm vitest run tests/core/context/TokenBudget.test.ts -x` | ❌ Wave 0 |
| CTX-02 | ContextUpdate seam = typed input, no consumer | unit | `pnpm vitest run tests/core/context/ContextOptimizer.test.ts -x` | ❌ Wave 0 |
| CTX-03 | minimalMode selects compact prompt constants | unit | `pnpm vitest run tests/core/context/ContextOptimizer.test.ts -x` | ❌ Wave 0 |
| CTX-04 | Ladder order + section-granularity + CONTEXT_TOO_LARGE terminal | unit | `pnpm vitest run tests/core/context/ContextCompressor.test.ts -x` | ❌ Wave 0 |
| CTX-04 | Drop-in identity + cache-stability (default path byte-identical) | unit | `pnpm vitest run tests/core/context/ContextOptimizer.test.ts -x` | ❌ Wave 0 |
| CTX-01/04 | Hook per-stage rewire + CONTEXT_TOO_LARGE → failed mapping | component | `pnpm vitest run tests/components/pages/useStreamingLLM.test.tsx -x` | ✅ exists — extend |
| — | Manifest kind lockstep (D-04-18) | unit | `pnpm vitest run tests/core/context/ContextProvenanceManifest.test.ts -x` | ❌ Wave 0 |
| — | contextHelper deletion compiles; zero imports remain | build gate | `pnpm typecheck` + grep gate | — |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/core/context -x` + `pnpm typecheck`
- **Per wave merge:** `vitest run`
- **Phase gate:** Full `verify:phase-4` chain green before `/gsd-verify-work` (P-5: §24 chain, NO exact test-count assertions)

### Wave 0 Gaps
- [ ] `tests/core/context/TokenBudget.test.ts` — formula, per-section caps, CJK heuristic, conservative-unknown-window
- [ ] `tests/core/context/ContextOptimizer.test.ts` — tier/budgets from window, ladder order, minimal mode, drop-in identity, CONTEXT_TOO_LARGE terminal
- [ ] `tests/core/context/ContextCompressor.test.ts` — structural no-op steps + real trim/drop steps + compressionApplied markers
- [ ] `tests/core/context/ContextProvenanceManifest.test.ts` — Zod schema + kind lockstep guard
- [ ] `tests/fixtures/optimizedContext.ts` — extend (not duplicate) with window set / over-budget sections / CJK+mixed sample (P4-15, WR-13)
- [ ] `package.json` — add `verify:phase-4` script (copy of `verify:phase-3a` chain)

## Security Domain

> `security_enforcement: true` (config). ASVS level 1. Phase 4 is a pure in-memory core module; no new attack surface is introduced (no network, no storage writes, no UI changes beyond an error string).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth surface; provider keys already vault-guarded in Phase 2/3) |
| V3 Session Management | no | — (no sessions in the context layer) |
| V4 Access Control | partial | Minimal mode's "≤1 safe tool schema" + `TIER_CAPS.mcpChaining: false` (D-04-14) restrict the agent's capability surface on tiny models |
| V5 Input Validation | yes | `ContextProvenanceManifestSchema` (Zod) at the public boundary (GR-4); optimizer input is typed `ContextOptimizerInput` (pageContext etc. are `undefined` in P4) |
| V6 Cryptography | no | — (nothing encrypted here; vault untouched) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Raw prompt/section bodies leaking into logs | Information Disclosure | R-10: the manifest is redacted via `TraceRedactor` before any logging (D-04-19); never debugLog section text or user input |
| Oversized prompt to a small model (cost/DoS-ish) | DoS | Per-section caps + §2.4 ladder + honest CONTEXT_TOO_LARGE terminal (never sends an oversized prompt — success criterion 2) |
| Model hallucinating tool use beyond capability | Elevation of Privilege | `capsForTier` plannerCap/toolCap limits + ≤1 tool schema in minimal mode (D-04-14); R-4 unchanged (Executor validates) |
| Prompt-injection via retrieved content | — | **Out of scope for P4** — trust/instructionAuthority is Phase 4b (§28.3, TRUST-01..03); P4 must not invent a partial mitigation (G0) |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: node_modules] `node_modules/ai/dist/index.d.ts` (4.3.19) — full export list read; **no `countTokens`/token counter**; `LanguageModel` = `LanguageModelV1`
- [VERIFIED: node_modules] `node_modules/.pnpm/@ai-sdk+provider@1.1.3/node_modules/@ai-sdk/provider/dist/index.d.ts` L951-1130 — `LanguageModelV1` fields (provider, modelId, doGenerate, usage reporting only; **no contextWindow**)
- [VERIFIED: node_modules] `@ai-sdk/openai@1.3.24`/`@ai-sdk/anthropic@1.2.12`/`@ai-sdk/google@1.2.22`/`@ai-sdk/provider-utils@2.2.8` — no token-counting exports
- [VERIFIED: codebase] `src/core/ai/contextHelper.ts`, `ProviderRouter.ts`, `AgentOrchestrator.ts`, `TierResolver.ts`, `ILLMProvider.ts`, `providers/*.ts` (getModels throws), `ProviderRegistry.ts`, `useStreamingLLM.ts`, `ai/types.ts`, `memory/types.ts`, `context/*.ts` seeds, `tests/fixtures/optimizedContext.ts`, `tests/core/ai/AgentOrchestrator*.test.ts`, `tests/components/pages/useStreamingLLM.test.tsx`
- [CITED: PRODUCT_SPEC_v0_1.md] §2.1–§2.6 (L413–534), §1.2–§1.4 (L227–351), §18 Phase 4 (L2676–2703), §18 Phase-3 addendum (L2653–2664), Appendix A (L4072–4137), Appendix B (L4139+), Appendix C.2 (L3512/L5040 CONTEXT_TOO_LARGE), Appendix O phase map (L6226–6246)

### Secondary (MEDIUM confidence)
- [VERIFIED: node_modules] ai@4.3.19 CHANGELOG-era knowledge: `countTokens` existed in earlier v3-era utils but is absent from the 4.3.19 export surface (Phase-3 research precedent: read node_modules, not live docs)

### Tertiary (LOW confidence)
- [ASSUMED] Model context-window values (A2–A6) — training knowledge, not verified against provider docs this session (all web providers disabled in config)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; SDK surface verified from installed node_modules; spec sections read in full
- Architecture: HIGH — codebase seam shapes verified directly (input-only seam precedent, error-carrier precedent, seeded homes)
- Pitfalls: HIGH — each pitfall grounded in a verified codebase fact (import sites, boundary drops, union declarations)
- Model-window table values: LOW→MEDIUM — [ASSUMED] values gated behind user confirmation (A2–A6)

**Research date:** 2026-08-12
**Valid until:** 2026-09-11 (spec + locked dependency versions are stable; model-window values should be re-confirmed if provider docs change)
