# Phase 4: Context-Adaptive Execution - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase replaces the Phase-3 `contextHelper` (documented deletion target, D-02) with the spec §2.3 `ContextOptimizer`: it computes the model tier (tiny/small/medium/large) from the resolved model's context window (§2.1 `classifyModelContext`), applies the §2.2 token budget formula + per-section distribution, packs `PromptSection[]`, degrades stepwise per §2.4 when over budget (never mid-structure), enforces minimal mode (§2.5), and stamps every `OptimizedContext` with a Zod-validated `ContextProvenanceManifest` (§2.6). It also rewires the chat hook off the hardcoded `medium`/16K defaults onto real **per-stage** budget enforcement, and adds the canonical compact-prompt constants minimal mode selects.

**Scope authority (G0):** Spec-authoritative. Phase 4 = the §18 create-list files (`ModelContextTier` + `ContextProvenanceManifest` already seeded — extend IN PLACE, P-3b) plus `TokenBudget`, `ContextOptimizer`, `ContextCompressor`, `ContextPack`. CTX-02/CTX-03 are reconciled per D-04-01..03 below (REQUIREMENTS gets an AI-07-style re-map note).

**Boundary notes:**
- **Zero model calls in optimization** → the "2 calls / healthy turn" cost truth survives (through-line).
- **Notes/memory/pageContext inputs do not exist until Phase 4a/5** — degradation steps for them are structural no-ops (present in the ladder, no real work).
- **ContextUpdate events (CTX-02)** = typed input-only re-pack event seam with **no consumer in P4**.
- **R-3:** AI runtime lives in Side Panel/Standalone only; nothing here touches the background SW.

</domain>

<decisions>
## Implementation Decisions

### G0 — Requirement Reconciliation (CTX-02 / CTX-03)
- **D-04-01 [§18-authoritative]:** Phase 4 implements spec §2.1–§2.6 + the §18 Phase-4 create-list only. Neither CTX-02 nor CTX-03 is enumerated in spec §18 (AI-07 precedent). REQUIREMENTS.md gets an AI-07-style re-map note, and the note must also disambiguate the Phase-4 CTX ids from the spec §28.3 trust-aware CTX-01..06 namespace (Phase 4b).
- **D-04-02 [CTX-02 = typed input-only event seam]:** "ContextUpdate events" = a typed input-only seam on the optimizer/runAgentTurn path (`onStreamDelta` precedent): an optional input signaling that context inputs changed → the optimizer re-selects/repacks. **No consumer in Phase 4** (page/state-change triggers arrive with Phase 4a PageContextBridge / Phase 7). Seam + fixture only. StageEvent stays a TYPE, never an event bus (L1).
- **D-04-03 [CTX-03 = minimal-mode compact-prompt selection]:** "Phase-aware prompting" = the optimizer selects canonical compact prompt constants (§2.5 "compact system prompt") when minimalMode is active. NOT a new prompting subsystem. Compact constants ship as a canonical Appendix A addendum (D-04-11).

### Tier & Model-Window Source
- **D-04-04 [classify-from-resolved-window]:** Tier + budgets derive from the resolved model's context window via `classifyModelContext` (§2.1). The hook resolves the planner and renderer stages upfront (`createStageInvocation`), reads the resolved window from each `StageInvocation`, and runs the optimizer per stage. The per-surface default (`medium`) is a **pre-resolution fallback only** — never the primary source.
- **D-04-05 [per-stage optimization]:** Each stage budgets against its own resolved model — planner and renderer may resolve different models → different tiers. Loop caps (`plannerCap`/`toolCap`/`mcpChaining`, §1.4) derive from the **planner-stage tier**; the renderer stage carries its own budget/maxTokens. (P4-6)
- **D-04-06 [unknown window → conservative]:** A custom OpenAI-compat/Ollama model with an unknown window falls back to the smallest safe tier (P4-12), flagged in the manifest; never assume `large`.

### Cutover Signature (P4-5)
- **D-04-07 [drop-in, output identical]:** The output `OptimizedContext` shape stays §2.3-identical (same `sections[]` semantics). Only the INPUT changes (resolved model window). Planner/Renderer are import-swaps; the behavioral change is confined to the hook + an input-only per-stage context seam on `runAgentTurn`. Not a 3-file breaking swap.
- **D-04-08 [contextHelper deletion]:** `src/core/ai/contextHelper.ts` is deleted; its call sites migrate to `ContextOptimizer`. `estimateTokens` moves into `TokenBudget`. Golden Rule 3 preserved — the hook still imports a core builder, never assembles prompts.

### Token Counting & Budget Math
- **D-04-09 [counting read-only]:** Token counting is READ-ONLY over section text — it never rewrites the byte-stable `[SYSTEM]` persona block (§1.3/F-5); counting must not silently kill Phase-3 prompt-cache wins (P4-8).
- **D-04-10 [counter strategy]:** provider-native counter when the SDK exposes it; else script-aware fallback: `ceil(chars/4)` English vs `ceil(chars/3)` CJK, detected per-section by Unicode-range ratio; mixed script uses the higher-cost divisor. No custom tokenizer (P4-13). §2.2 formula: `inputBudget = 0.70×window`, `outputBudget = 0.20`, `safetyMargin = 0.10`; the per-section distribution table feeds **per-section caps that DRIVE degradation** — never hard truncation.
- **D-04-11 [compact constants]:** New canonical per-role compact system prompt constants (planner/renderer; §2.5 "compact system prompt") added to Appendix A PROMPTS + `src/core/prompts/index.ts`, selected by `ContextOptimizer` when minimalMode. STR copy contract (Appendix B) governs any new UI copy.

### Degradation & Minimal Mode
- **D-04-12 [full §2.4 ladder]:** The complete degradation pipeline ships in §2.4 order: drop debug-only → drop secondary notes/optional metadata → summarise older history → compress page/case context → trim tool schemas to in-scope → reduce memory top-k → minimal mode → CONTEXT_TOO_LARGE. Only steps whose data exists in Phase 4 do REAL work (drop debug, trim tool schemas, minimal mode); notes/memory/pageContext/history steps are structurally-present no-ops until Phase 4a/5/7.
- **D-04-13 [no mid-structure truncation]:** Degradation operates at SECTION granularity — a section is dropped/compressed whole; never truncated mid-structure (CTX-04). Per-section caps feed degradation, not hard truncation.
- **D-04-14 [minimal mode]:** Entered when `tier == tiny` (mandatory, §2.5) OR escalated to by the degradation ladder. Concrete Phase-4 effects: compact system prompt (D-04-11), ≤1 safe tool schema, reduced non-system sections. MCP chaining block reuses the existing `TIER_CAPS.mcpChaining: false` (tiny/small already false); LLM-Wiki RAG synthesis block is a Phase-5a consumer concern — the optimizer only marks `minimalMode`, the 5a consumer enforces the RAG fallback (§2.5).
- **D-04-15 [CONTEXT_TOO_LARGE honest terminal]:** If even minimal mode exceeds the window, return a typed `CONTEXT_TOO_LARGE` terminal (canonical §C.2 code — new code canonicalized into spec Appendix C.2 before shipping, W-1 gate). The hook maps it to a failed state with a "message too long" surface (new STR copy). NEVER silently truncates user input (data-loss lie, P4-10).
- **D-04-16 [history slice reserved]:** The History budget slice (§2.2 table) is reserved-but-unfilled in P4 (ChatHistoryDB = Phase 7) — a structurally-present empty section, not dead code (P4-14).

### Manifest & Provenance (P4-7)
- **D-04-17 [manifest contract]:** `ContextProvenanceManifest` (seeded, extend IN PLACE) enumerates: tier, model, window, per-section token counts, which §2.4 steps fired, counter-method-used (native vs heuristic), `truncated`/`compressionApplied` per section. Zod-validated at the public boundary (GR-4 fixture tests).
- **D-04-18 [kind lockstep]:** `manifest.sections[].kind` MUST mirror `PromptSection['kind']` — a lockstep guard (test preferred, codebase-idiomatic) prevents drift (03a-01 precedent).
- **D-04-19 [lifetime/redaction]:** Manifest is in-memory per-turn, redacted via TraceRedactor if ever logged (R-10), NOT persisted (durable trace = Phase 6 AITransactionLog) (P4-11).

### the agent's Discretion
- Exact model-window lookup source (`ModelInfo.contextWindow` vs canonical map) — researcher verifies what the SDK/registry exposes.
- `CONTEXT_TOO_LARGE` throw-vs-return shape at the optimizer boundary.
- Lockstep-guard mechanism (test preferred).
- Exact per-section distribution enforcement mechanics (`TokenBudget` caps → which §2.4 steps fire in which order).
- Compact prompt constant text — follow Appendix A verbatim style; researcher/planner drafts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec (authoritative)
- `.planning/PRODUCT_SPEC_v0_1.md` §18 "Master Implementation Phases" Phase 4 block (lines ~2676–2703) — create list (ModelContextTier, TokenBudget, ContextOptimizer, ContextCompressor, ContextPack, ContextProvenanceManifest), required tests (ContextOptimizer/ContextCompressor/TokenBudget), DONE-when (tier tests; overflow degrades instead of failing; minimal mode blocks MCP chaining + LLM-Wiki RAG; manifest on every context).
- `.planning/PRODUCT_SPEC_v0_1.md` §18 Phase-3 addendum (lines ~2655–2664) — (a) contextHelper deletion target (line 2657); (b) +1 documented files; (c) P-3 PromptSection home move; (f) P-3b seeded type homes (line ~2662). **The authoritative record the Phase-4 planner reads for R-1.**
- `.planning/PRODUCT_SPEC_v0_1.md` §2.1–§2.6 "Context-Adaptive Execution" (lines ~412–534) — §2.1 tiers + `classifyModelContext`; §2.2 budget formula (70/20/10) + per-section distribution table + counting rule (`chars/4` English, `chars/3` CJK); §2.3 `ContextOptimizerInput`/`OptimizedContext` contract; §2.4 degradation ladder order; §2.5 minimal mode allowed/blocked lists; §2.6 `ContextProvenanceManifest`.
- `.planning/PRODUCT_SPEC_v0_1.md` §1.2–§1.4 (lines ~227–411) — Planner/Executor/Renderer rules; §1.3 prompt shape + caching (F-5 byte-stable [SYSTEM]); §1.4 tier caps table (tiny 1/1, small 2/1, medium 3/2, large 5/3) reused by minimal mode.
- `.planning/PRODUCT_SPEC_v0_1.md` §1.6.1 (lines ~398–409) — L1 StageEvent is a TYPE (never an event bus); L2 within-turn `input-required`.
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix A (line ~4072) — canonical PROMPTS; compact-prompt constants (D-04-11) added here verbatim-style.
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.2 — error-code registry; new Phase-4 codes (CONTEXT_TOO_LARGE) canonicalized IN PLACE (GR-9).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix O intro phase→example map (line ~6234) — Phase 4 → worked example §2.4.
- `.planning/PRODUCT_SPEC_v0_1.md` §0.5 Golden Rules + §0.2 (lines ~65–226) — GR-3 (all AI calls consume an OptimizedContext), GR-4 (Zod + one repair), GR-9 (canonical codes), R-2 (no nested retries), R-10 (redaction).

### Project planning artifacts
- `.planning/ROADMAP.md` Phase 4 (lines ~211–223) — goal, requirements CTX-01..04, success criteria.
- `.planning/REQUIREMENTS.md` Phase 4 CTX-01..04 (lines ~60–65) — **Phase 4 updates this row per D-04-01 (CTX-02/CTX-03 re-map note; CTX id namespace disambiguation vs §28.3).**
- `.planning/PROJECT.md` — core value, constraints, key decisions (Planner→Executor→Renderer, human-verified evolution, no banned packages).
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-CONTEXT.md` — D-02 (contextHelper deletion target), D-07 (OptimizedContext home), D-08 (fixture), D-20 (Appendix I), D-10 (np_persona). The Phase-3 addendum (spec ~2655) is the source the Phase-4 planner reads.
- `.planning/phases/03a-agent-reliability-and-evidence/03a-CONTEXT.md` — 03a-01 (manifest kind lockstep), D-3a-19 (honest status mapping the CONTEXT_TOO_LARGE hook mapping extends).
- `AGENTS.md` — 10 golden rules, risk register (R-1..R-10), approved stack, architecture rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/context/ModelContextTier.ts` — seeded (P-3b): `ModelContextTier` + `classifyModelContext` verbatim §2.1. Extend IN PLACE, never re-declare (R-1).
- `src/core/context/ContextProvenanceManifest.ts` — seeded (P-3b): §2.6 shape verbatim (incl. `tool_result` kind from 03a-01). Extend IN PLACE with the D-04-17 fields.
- `src/core/ai/types.ts` — `OptimizedContext`, `ContextOptimizerInput`, `PromptSection` canonical homes (D-07). ContextOptimizer imports, never re-declares.
- `src/core/ai/contextHelper.ts` — the DELETION TARGET (D-04-08). `estimateTokens` (chars/4) moves into `TokenBudget`; the section-packing shape is the seed for `ContextPack`.
- `src/core/ai/AgentOrchestrator.ts` — `TIER_CAPS` + `capsForTier` (§1.4) reused by minimal mode; `StageResolver`/`AgentTurnInput.context` — the input-only per-stage context seam (D-04-05/07) extends here.
- `src/core/ai/ProviderRouter.ts` — `createStageInvocation` (03-05) returns `StageInvocation` (providerId/model/jsonMode/callProviderJsonMode) — **MUST gain the model context window** for per-stage optimization (D-04-04).
- `src/components/pages/useStreamingLLM.ts` — the only behavioral-change surface (D-04-07): replaces hardcoded `DEFAULT_CONTEXT_TIER`/16K·1K budgets + `buildOptimizedContext` with per-stage optimizer calls; maps CONTEXT_TOO_LARGE → failed.
- `src/core/prompts/index.ts` — Appendix A PROMPTS; compact constants (D-04-11) added here.
- `tests/fixtures/optimizedContext.ts` — D-08 fixture; EXTEND (not duplicate) with window set / over-budget sections / CJK+mixed sample (P4-15, WR-13).
- `src/core/error/errorCodes.ts` — extend IN PLACE with CONTEXT_TOO_LARGE + mirror spec Appendix C.2 (GR-9).

### Established Patterns
- **Spec-verbatim paths (§8.5/§18) + Appendix C types (R-1)** — no invented identifiers; seeded homes imported, never re-created (P-3b).
- **Golden Rule 3** — only a core builder assembles prompts; the hook imports it, never assembles.
- **Input-only seams** — `onStreamDelta`/`invocation`/`onTransition` precedent for the CTX-02 re-pack event seam and the per-stage context seam.
- **Determinism / no event bus** — StageEvent is a TYPE only (§1.6.1); the CTX-02 seam is an input, not a runtime event system (L1).
- **F-4 sections-in / F-5 cache** — PromptSection[] end-to-end; counting is read-only so the byte-stable [SYSTEM] cache hits survive (P4-8).
- **GR-4 / Zod fixtures** — every public boundary has a Zod fixture test; manifest Zod-validated (D-04-17).
- **Golden Rule 9** — every catch debugLogs a canonical §C.2 code; new codes canonicalized before shipping.
- **verify:phase-N gate** — §24 chain (eslint + prettier + tsc + wxt build + vitest run + isolation check); verify:phase-4 follows the Phase-3/3a script template.

### Integration Points
- `useStreamingLLM.ts` — the rewire surface: per-stage resolver → window → optimizer → per-stage packs → runAgentTurn input seam.
- `AgentOrchestrator.ts` — input-only per-stage context seam; loop caps from planner-stage tier (D-04-05).
- `ProviderRouter.createStageInvocation` — `StageInvocation` gains the model context window (D-04-04).
- `PlannerService`/`RendererService` — import-swaps only (D-04-07); they consume an `OptimizedContext` unchanged.
- Tests: `tests/core/context/` (ContextOptimizer/ContextCompressor/TokenBudget) per §18; hook/drop-in regression tests in `tests/components/**` (cache-stability + drop-in identity).
- R-3: optimizer runs in Side Panel/Standalone only; nothing here touches the background SW.

</code_context>

<specifics>
## Specific Ideas

- **Through-line (user):** ContextOptimizer must be a deterministic drop-in — output `OptimizedContext` identical (cache-stable), only the input changes, manifest stamped. No model calls in optimization → "2 calls / healthy turn" survives.
- **P4-5:** confirm cutover is a 1-file behavioral change (hook); Planner/Renderer import-swaps — not a 3-file breaking swap.
- **P4-6:** per-stage optimization — planner and renderer may resolve different models → different tiers; loop caps from the planner tier.
- **P4-7:** manifest = tier, model, window, per-section tokens, §2.4 steps fired, counter-method; Zod; kind lockstep.
- **P4-8:** counting never mutates the cached [SYSTEM] persona block.
- **P4-10:** CONTEXT_TOO_LARGE honest terminal; never silently truncate user input.
- **P4-12:** unknown window → conservative tier + manifest flag; never large.
- **P4-13:** CJK ratio per section; mixed → higher divisor; no tokenizer.
- **P4-15:** extend D-08 fixture with window set / over-budget / CJK samples.

</specifics>

<deferred>
## Deferred Ideas

- **ContextUpdate consumers** (page/state-change re-pack triggers) — Phase 4a PageContextBridge / Phase 7; P4 ships only the typed input-only seam (D-04-02).
- **Real degradation work for notes/memory/pageContext/history steps** — Phase 4a/5/7; structural no-ops in P4 (D-04-12).
- **LLM-Wiki RAG synthesis fallback enforcement** — Phase 5a consumer ("Ask notes" plain MiniSearch in tiny mode); P4 only marks `minimalMode` (D-04-14).
- **Durable context trace / receipt UI (Prompt Inspector)** — Phase 4b (context receipt) / Phase 6 (AITransactionLog); manifest in-memory + redacted in P4 (D-04-19).
- **History budget slice filling** — Phase 7 (ChatHistoryDB consumers); reserved-empty in P4 (D-04-16).

None — discussion stayed within phase scope; deferred items tracked above.

</deferred>

---

*Phase: 4-Context-Adaptive Execution*
*Context gathered: 2026-08-12*
