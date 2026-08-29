# Phase 5: Context-Adaptive Execution - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the **context layer** that assembles a tier-appropriate `OptimizedContext` per turn: `ModelContextTier` classification (§2.1), `TokenBudget` (input/output/safety split + per-section dynamic distribution, §2.2), `ContextOptimizer` (the §2.3 contract + §2.4 stepwise degradation), `ContextCompressor` (structural / top-k / summarise compression), `ContextPack` (final ordered section assembly), and `ContextProvenanceManifest` (§2.6) on every `OptimizedContext`. This is an **infrastructure phase — no spec-native v1 requirement IDs land here** (CTX-01…06 are Phase 7, trust-aware context).

**Scope is per spec §18 Phase 5.** Create exactly (verbatim §18):

```
src/core/context/ModelContextTier.ts
src/core/context/TokenBudget.ts
src/core/context/ContextOptimizer.ts
src/core/context/ContextCompressor.ts
src/core/context/ContextPack.ts
src/core/context/ContextProvenanceManifest.ts
```

Required tests (verbatim §18):

```
tests/core/context/ContextOptimizer.test.ts
tests/core/context/ContextCompressor.test.ts
tests/core/context/TokenBudget.test.ts
```

**DONE-when (verbatim §18 + ROADMAP):** tiny/small/medium/large tier tests pass; context overflow degrades stepwise (never sends an oversized prompt; records `PromptTrace.truncatedSources`); minimal mode blocks MCP chaining and LLM-Wiki RAG synthesis (§19.2); `ContextProvenanceManifest` attached to every `OptimizedContext`. Gate: `pnpm run verify:phase-5`.

**Out of scope (verified in spec §18 / PROJECT.md / REQUIREMENTS.md):** trust metadata / context receipts / CTX-01…06 (Phase 7 — the manifest becomes a "context receipt" there), page/case source extraction feeding `ContextOptimizerInput.pageContext` (Phase 6), memory retrieval feeding `memoryHints` (Phase 8), agent-mode blocking policy beyond the minimal-mode flag (Phase 14), PromptTrace / AITransactionLog persistence (Phase 11 — Phase 5 only exposes the truncation surface to be lifted), prompt-cache byte-stability (Phase 3, owned by PromptCacheManager/PromptCacheAdapter), agent step caps enforcement (Phase 3 Appendix I, AgentOrchestrator).

**Research-driven notes:** Phase 3 declared the A8 `PromptSection` contract in `src/core/ai/types.ts` specifically so "Phase 5's ContextOptimizer can adopt it" — the spec (§1.3/Appendix) imports `PromptSection` from `../context/ContextOptimizer`, so Phase 5 is the import-target resolution point. The `verify:phase-5` gate currently mis-points at `tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` (Phase 8/9 territory) and must be re-pointed to `tests/core/context` — the exact Phase-4 D-68 precedent.

</domain>

<decisions>
## Implementation Decisions

### Standalone context layer — no live pipeline wiring
- **D-69 (Create-only scope — standalone layer with a pure `assemble()`):** §18 lists 6 context files and no AgentOrchestrator/PlannerService modification. Phase 5 ships `ContextOptimizer.assemble(ContextOptimizerInput) → OptimizedContext` as a pure function proven by the required tests; it is NOT wired into the running chat/agent pipeline this phase. Live adoption lands in Phase 7 (trust-aware context), where `pageContext`/`memoryHints` sources actually exist. No component or hook change to AgentOrchestrator/useChatStreaming in Phase 5. — **Reversibility:** `reversible` — rationale: additive modules; wiring later is a caller edit. This keeps §18's create-only inventory and the Phase-4 anti-scope precedent (do NOT "just also re-point the chat hook").
- **D-70 (Tier axes are separate — no conflation):** `ModelContextTier` ('tiny'|'small'|'medium'|'large') is the **context-window classification** (§2.1) that drives budgets, minimal mode, and the §1.4 caps table. It is DISTINCT from the Phase-3 runtime tier `ModelTier` ('fast'|'balanced', Appendix D, D-53) carried by `AgentTier.modelTier`. Phase 5 does NOT change AgentOrchestrator's `AgentTier` or bridge context-tier → caps into the loop (Appendix I owns cap enforcement; the caller supplies caps). ModelContextTier.ts may export a `§1.4`-shaped caps helper for future callers, but it is not wired. — **Reversibility:** `reversible` — rationale: standalone classifier + optional helper; no consumer changes.

### Token counting + PromptSection home
- **D-71 (Pluggable `TokenCounter` with heuristic default):** §2.2's "provider-native counter when the SDK exposes it" cannot be met in Phase 3's SDK-less fetch design. Ship a `TokenCounter` interface with the default heuristic implementation — `Math.ceil(text.length / 4)` for English, `Math.ceil(text.length / 3)` for CJK — plus a CJK-detection helper for mixed text (per-section, since sections are the accounting unit). The provider-native counter is an injectable seam (declare-now/populate-later, mirroring D-46/D-64); a caller may supply one, else the heuristic applies. No static tokenizer dependency. — **Reversibility:** `reversible` — rationale: injectable function; swapping impl later is a caller edit.
- **D-72 (A8 `PromptSection` source of truth stays in `src/core/ai/types`; ContextOptimizer re-exports):** Phase 3 owns the A8 definition (`kind`/`text`/`stable`/`tokens`, types.ts:95-101) and PromptCacheManager/Adapter consume it. The spec's canonical import target is `../context/ContextOptimizer` (PromptCacheAdapter.ts:6-7 notes the Phase-5 import-target change). Decision: `ContextOptimizer` **re-exports** `PromptSection` from `src/core/ai/types` — single source of truth preserved, spec-shaped imports resolve, and no Phase-3 file is edited beyond adding a re-export import in the new module. — **Reversibility:** `reversible` — rationale: re-export only; moving the definition later is an import edit.

### Degradation + minimal mode
- **D-73 (Stepwise degradation via section-level token accounting):** `ContextOptimizer.assemble` estimates each section's tokens (A8 `tokens` field) and walks the §2.4 degradation order against `TokenBudget.inputBudget`: drop debug-only → drop secondary notes/optional metadata → summarise older history (via ContextCompressor) → structural-compress page/case context → trim tool schemas to in-scope tools → reduce memory top-k → enter minimal mode → if still over budget, return the **typed `CONTEXT_TOO_LARGE` result** (§2.4) with a user-facing explanation. Never sends an oversized prompt (roadmap SC#2). Every degraded/truncated section is recorded for the manifest. — **Reversibility:** `reversible` — rationale: internal pipeline ordering; reordering later is a local change.
- **D-74 (Minimal-mode gate = typed predicate over the §2.5 blocked set):** MCP chaining and LLM-Wiki RAG don't exist in Phase 5, so "minimal mode blocks them" is satisfied by exporting `isFeatureAllowedInMinimalMode(feature)` — a typed predicate over the §2.5 blocked set (`mcp-chaining`, `multi-step-agent`, `code-search-skill`, `full-note-graph-injection`, `large-research-synthesis`, `llm-wiki-bulk`, `llm-wiki-rag`), asserted by tests against the §2.5 allowed/blocked lists verbatim. `OptimizedContext.minimalMode` is the flag consumers check; the MCP/LLM-Wiki enforcement call sites apply it when those phases ship. Minimal mode is mandatory for tiny tiers (§2.5/§19.2) and entered as the penultimate degradation step. — **Reversibility:** `reversible` — rationale: exported predicate + flag; consumer enforcement arrives with owning phases.

### Compression, packing, provenance, trace
- **D-75 (ContextCompressor = pure strategies; summariser is an injectable seam):** `ContextCompressor` implements the compression that can run without live LLM/page sources: **structural** compression (page/case context → structured fields, operates on the A8 sections it receives), **top-k** reduction (memory injection top-k, §2.4), and **tool-schema trimming** (filter `selectedToolSchemas` to in-scope tools). **Summarise** (older-history summarisation) is declared as an injectable summarizer seam — Phase 5 does NOT call the LLM; if no summarizer is supplied, history truncation falls back to dropping older turns (recorded as truncation, not silence). Compression type is recorded per section in the manifest (`'summarise' | 'structural' | 'topk'`, §2.6). — **Reversibility:** `reversible` — rationale: pure functions + seam; a real summarizer plugs in later.
- **D-76 (ContextPack = final ordered section assembly):** `ContextPack` owns the deterministic assembly of `OptimizedContext.sections` into the final prompt string and the running `totalTokens` tally (sum of per-section tokens). It preserves §1.3 canonical section ordering and the stable-first ordering that PromptCacheAdapter expects (stable sections byte-identical; current user input / in-flight output never cached). It consumes the budgeted, compressed section list from ContextOptimizer — ContextOptimizer decides, ContextPack packs. — **Reversibility:** `reversible` — rationale: new module boundary; re-splitting later is a rename.
- **D-77 (Provenance manifest verbatim + manifest-derived truncation trace):** `ContextProvenanceManifest` implements §2.6 verbatim (`sections[]` with kind/sourceId/tokens/truncated/compressionApplied, `totalTokens`, `minimalMode`, `workspaceId`, `activeSurface` — the two v0.1 NEW fields included). Every `OptimizedContext` carries one (DONE-when 4). To satisfy §19.3/roadmap SC#2 ("records `PromptTrace.truncatedSources`") without creating Phase-11's PromptTrace: `OptimizedContext` additionally exposes a lightweight trace surface — `{ contextTier, truncated, truncatedSources, minimalMode }` — where `truncatedSources` is **derived from the manifest's truncated sections**. Phase 11 lifts this into `PromptTrace`. — **Reversibility:** `reversible` — rationale: derived field on the output; Phase 11 lifts it additively.

### Verification gate
- **D-78 (Re-point `verify:phase-5` to `tests/core/context` — D-68 analog):** The package.json `verify:phase-5` script currently targets `tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` (Phase 8/9 territory). Phase 5 re-points it to the §18 required dirs — `tests/core/context` (all three required test files). Exactly the Phase-4 D-68 precedent (04-CONTEXT.md). — **Reversibility:** `reversible` — rationale: package.json script edit.

### the agent's Discretion
- Exact `ContextCompressor` strategy signatures and where the summarizer seam's interface lands (in `ContextCompressor.ts` vs a sibling `types.ts` in `src/core/context/`).
- CJK-detection implementation for the §2.2 heuristic counter (Unicode-range scan vs a small blocklist — either satisfies "ceil(len/3) for CJK").
- Whether the §1.4 caps helper ships in `ModelContextTier.ts` (optional export, unwired) or is omitted.
- Exact shape of the typed `CONTEXT_TOO_LARGE` result (spec says "typed error with a user-facing explanation" — map onto a discriminated result union vs throwing; §21.6 code-set audit is a grep, do not invent registry codes).
- Whether `src/core/context/` keeps one file per §18 name or uses a barrel `index.ts` — mirror the existing `src/core/ai/` layout convention.
- The `workspaceId`/`activeSurface` v0.1 fields' default when the caller doesn't supply them (empty-string vs required — §2.3 marks them NEW in v0.1).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 5 block, lines 2580-2607 — Create list, Required tests, DONE-when) — sole authority on the Phase-5 file inventory and gates. Note: no Requirements line — Phase 5 is infra (no v1 requirement IDs).
- `.planning/PRODUCT_SPEC_v0_1.md` §2.1 (lines 425-443) — `ModelContextTier` + `classifyModelContext` verbatim + tier table.
- `.planning/PRODUCT_SPEC_v0_1.md` §2.2 (lines 444-461) — Token budget formula (input 70% / output 20% / safety 10%), dynamic distribution table, token-counting rule (provider-native else heuristic).
- `.planning/PRODUCT_SPEC_v0_1.md` §2.3 (lines 463-489) — `ContextOptimizerInput` + `OptimizedContext` verbatim; "all AI calls must consume an OptimizedContext".
- `.planning/PRODUCT_SPEC_v0_1.md` §2.4 (lines 491-502) — stepwise degradation pipeline order + typed `CONTEXT_TOO_LARGE` terminal.
- `.planning/PRODUCT_SPEC_v0_1.md` §2.5 (lines 504-524) — minimal mode allowed/blocked lists verbatim (drives D-74).
- `.planning/PRODUCT_SPEC_v0_1.md` §2.6 (lines 526-544) — `ContextProvenanceManifest` verbatim (drives D-77).
- `.planning/PRODUCT_SPEC_v0_1.md` §1.3 (lines 331-350) — canonical section order + prompt-cache byte-stability rules ContextPack preserves.
- `.planning/PRODUCT_SPEC_v0_1.md` §1.4 (lines 352-361) — agent step caps table keyed by Context tier (tiny 1/1 · small 2/1 · medium 3/2 · large 5/3); Appendix I owns enforcement.
- `.planning/PRODUCT_SPEC_v0_1.md` §19.2 (lines 2991-2997) — local model small context: tiny/small → minimal mode auto, disable MCP chaining.
- `.planning/PRODUCT_SPEC_v0_1.md` §19.3 (lines 2999-3004) — context overflow: degrade stepwise, never oversized prompt, record `PromptTrace.truncatedSources`, non-blocking `message.warning` (the warning UI is consumer-side).
- `.planning/PRODUCT_SPEC_v0_1.md` PromptTrace (lines 732-756) — the Phase-11 type whose `truncatedSources`/`contextTier`/`minimalMode` fields Phase 5's trace surface pre-shapes.
- `.planning/PRODUCT_SPEC_v0_1.md` §3.4 (line 689) — memory budget ≤1000 tokens; top-3 memories in tiny mode (§2.5) — the memory-section cap ContextOptimizer respects.
- `.planning/PRODUCT_SPEC_v0_1.md` §28.3 (lines 3947-3954) — CTX-01…06 (Phase 7): manifest becomes a context receipt; stable-prefix snapshot tests are CTX-04 (Phase 5's stable-order/stable-first work is its prerequisite substrate, but the CTX snapshot-test requirement lands in Phase 7).
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §5.2 — MV3 boundaries: the context layer runs in UI contexts (side panel / standalone) only, never the background SW.
- `.planning/PRODUCT_SPEC_v0_1.md` §21.6 — closed error-code set; the `CONTEXT_TOO_LARGE` terminal must not mint registry codes (grep-audit; D-38).

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 5: Context-Adaptive Execution" (lines 168-180) — goal, depends-on (Phase 3), success criteria, verification gate.
- `.planning/REQUIREMENTS.md` §28.3 rows (lines 214-223, 471-476) — CTX-01…06 assigned to Phase 7; confirms zero requirements land in Phase 5.
- `.planning/phases/04-agent-reliability-and-evidence/04-CONTEXT.md` — D-60…68: canonical-type home (`@/types/harness`), the D-68 gate re-pointing precedent D-78 follows verbatim, declare-now/populate-later precedent (D-64 zero verifiers → D-71 seam, D-75 summariser seam).
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-CONTEXT.md` — D-44…59: pipeline stages, D-53/D-54a (fast/balanced tiers, no model guessing — D-70's tier-axes separation), D-46 zero tools, D-59 single prompt-build choke point.
- `.planning/STATE.md` — decision 17 (strict ceiling → new code strict-clean, zero NP-STRICT markers), decisions 18-21 (Phase 2-4 validated).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix A / Appendix K — prompt-cache section conventions ContextPack's stable-first ordering feeds.

### Codebase maps (refreshed 2026-08-18)
- `.planning/codebase/STACK.md` — exact version table (zod ^3.24, TS 5.8.3); no tokenizer/SDK dependency exists — supports the heuristic-counter decision (D-71).
- `.planning/codebase/ARCHITECTURE.md` — per-surface module singletons; `src/core/` is UI-framework-agnostic (the context layer follows this); core imports no React.

### Source (integration targets — the Phase-5 consumer contracts)
- `src/core/ai/types.ts` (lines 89-101) — the A8 `PromptSection` contract (D-72 re-export target).
- `src/core/ai/PromptCacheAdapter.ts` (lines 1-11) — the spec import-target note ("spec imports PromptSection from `../context/ContextOptimizer` (Phase 5)"); D-72 resolves it.
- `src/core/ai/PromptCacheManager.ts` (lines 27-114) — `buildSystemPrompt` section assembly + `PromptSection[]` consumer; ContextOptimizer/ContextPack sections must slot into it (ordering contract).
- `src/core/ai/AgentOrchestrator.ts` (lines 48-55) — `AgentTier` (`plannerCap`/`toolCap`/`modelTier: ModelTier`) — the fast/balanced axis D-70 keeps separate from ModelContextTier.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/ai/types.ts` — A8 `PromptSection` schema (`kind`/`text`/`stable`/`tokens`); ContextOptimizer re-exports it (D-72). `ModelTierSchema` proves the discriminated-union/Zod pattern for the new ModelContextTier schema.
- `src/core/ai/PromptCacheAdapter.ts` + `PromptCacheManager.ts` — the stable-first section ordering + `[SYSTEM]` caching contract ContextPack preserves; both already consume A8 sections.
- `src/core/ai/AgentOrchestrator.ts` — `AgentTier` + §1.4 caps as caller-supplied numbers; Phase 5 does not touch it (D-69/D-70) but it's the future OptimizedContext consumer.
- `src/core/runtime/RuntimeEnvelope.ts` — `OperationId` for `ContextOptimizerInput.operationId` (Flag C correlation).
- `src/core/ai/UserPreferences.ts` — `UserPreferences` is a `ContextOptimizerInput` field; TierResolver/persona already read it.

### Established Patterns
- **Typed discriminated unions / Zod** — PlannerDecisionSchema, StreamEvent, A8 PromptSection; ModelContextTier and the assemble result union follow the same pattern.
- **Declare-now/populate-later** — D-32 (journal ops), D-46 (zero tools), D-64 (zero verifiers): D-71's TokenCounter seam and D-75's summarizer seam follow it — framework + contract ship, real impls arrive with owning phases.
- **Pure, UI-agnostic core modules** — `src/core/` imports no React (ARCHITECTURE.md:70); ContextOptimizer/Compressor/Pack are pure and testable without Chrome/DOM.
- **Fixture-driven tests** — `tests/core/ai/fixtures/` (Phase 3); `tests/core/context/` extends the same style for budget/degradation/manifest fixtures.

### Integration Points
- `ContextOptimizer.assemble(ContextOptimizerInput)` → `OptimizedContext` → (Phase 7+) AgentOrchestrator/useChatStreaming turn path; Phase 5 proves via tests, not live wiring (D-69).
- `ContextOptimizer` → re-export A8 `PromptSection` → resolves PromptCacheAdapter's spec import target (D-72).
- `ContextPack` output sections → PromptCacheManager/PromptCacheAdapter ordering + cache contracts (§1.3).
- Manifest + trace surface → Phase 7 context receipts (CTX-03) and Phase 11 `PromptTrace` (D-77).
- `verify:phase-5` script in package.json → re-point to `tests/core/context` (D-78).

</code_context>

<specifics>
## Specific Ideas

- **"Never sends an oversized prompt"** is the phase's spine (roadmap SC#2 + §19.3) — the degradation pipeline's terminal guarantee; `CONTEXT_TOO_LARGE` is the typed escape hatch, never a silent oversized send.
- **Stepwise, not fail-fast** — §2.4 is an ordered ladder (drop debug → … → minimal mode → typed error); each rung is observable in the manifest (truncated flags) and in the derived `truncatedSources` trace.
- **Tier axes must not blur** — `ModelContextTier` (context window) and `ModelTier` fast/balanced (runtime routing) are different axes; Phase 3's `AgentTier.modelTier` is untouched (D-70).
- **§18 create-only discipline** — six files + three test files; the gate re-point (D-78) is the only package.json edit. No pipeline wiring, no new storage keys, no UI, no error-code additions (D-38 closed-set rule).
- **NP-STRICT ceiling → 0** — new Phase-5 code must be strict-clean; zero new `@ts-expect-error NP-STRICT` markers (STATE.md decision 17).
- **No invented requirement IDs** — Phase 5 is infra; do not mint pseudo-requirement IDs to force requirement-table rows.

</specifics>

<deferred>
## Deferred Ideas

- **Context receipts + trust metadata (CTX-01…06)** — Phase 7: the manifest becomes the context receipt; stable-prefix snapshot tests (CTX-04) and trust/authority metadata land there. Phase 5 only ships the manifest + stable ordering substrate.
- **Live pipeline adoption of `OptimizedContext`** — Phase 7 (trust-aware context), where `pageContext`/`memoryHints` sources exist; Phase 5 proves `assemble` via tests (D-69).
- **`PromptTrace` + AITransactionLog persistence** — Phase 11; Phase 5 exposes only the derived trace surface (D-77).
- **Page/case content as `ContextOptimizerInput.pageContext`** — Phase 6 (PageContentService) produces it.
- **Memory retrieval as `memoryHints`** — Phase 8 (knowledge base / MiniSearch).
- **Real summariser (LLM-backed history compression)** — a consumer-owned capability; Phase 5 declares the seam only (D-75).
- **`message.warning` on quality-affected degradation (§19.3)** — consumer-side UI; not a context-layer concern in Phase 5.
- **MCP chaining / LLM-Wiki RAG enforcement call sites** — owning phases consume `isFeatureAllowedInMinimalMode` when those features ship (D-74).

None of these belong in Phase 5 — discussion stayed within phase scope.

</deferred>

---
*Phase: 5-Context-Adaptive Execution*
*Context gathered: 2026-08-29*