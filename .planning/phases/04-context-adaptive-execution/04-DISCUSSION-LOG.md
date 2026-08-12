# Phase 4: Context-Adaptive Execution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 4-Context-Adaptive Execution
**Areas discussed:** Tier & model-window source, Token counting & budget math, Degradation & minimal mode scope, CTX-02/CTX-03 intent

---

## Initial gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Tier & model-window source | Where tier + budgets come from at runtime — classify from resolved window vs preference vs default | ✓ |
| Token counting & budget math | §2.2 formula + per-section distribution; counter choice; per-section caps | ✓ |
| Degradation & minimal mode scope | Which §2.4 steps are real in P4; ContextCompressor's job; CONTEXT_TOO_LARGE | ✓ |
| CTX-02/CTX-03 intent | Meaning of "ContextUpdate events" and "phase-aware prompting" in P4 | ✓ |

**User's choice:** All four areas + a freeform decision framework.
**Notes:** The user supplied a structured response (through-line + gates P4-5/6/7 + decision-log P4-8..11 + one-liners P4-12..15) that pre-decided most of the discussion. Key through-line: ContextOptimizer must be a **deterministic drop-in** — output `OptimizedContext` identical (cache-stable), only the input (resolved-model window) changes, manifest stamped, zero model calls ("2 calls/healthy turn" survives).

---

## G0 — CTX-02 / CTX-03 reconciliation (authority)

| Option | Description | Selected |
|--------|-------------|----------|
| §18-authoritative | CTX-02 = typed input-only event seam (no consumer in P4); CTX-03 = minimal-mode compact-prompt selection; REQUIREMENTS re-map note | ✓ |
| ROADMAP-authoritative | Define CTX-02/CTX-03 as full new capabilities via new ADRs | |

**User's choice:** Yes, lock §18-authoritative.
**Notes:** User leaned §18-authoritative from the start (AI-07 precedent); confirmed at lock. Phase-4 CTX ids also collide with spec §28.3 trust-aware CTX-01..06 (Phase 4b) — the re-map note must disambiguate the namespace.

---

## Tier & model-window source

| Option | Description | Selected |
|--------|-------------|----------|
| Classify from resolved window | Tier + budgets derive from each stage's resolved model window via `classifyModelContext`; per-surface default is pre-resolution fallback only | ✓ (user pre-answer) |
| User preference | Tier selected by the user, not derived from the model | |
| Per-surface default | Keep a fixed default tier per surface | |

**User's choice:** Classify-from-resolved-window (named #1 in triage).
**Notes:** Per-stage optimization (P4-6): planner and renderer may resolve different models → different tiers. Loop caps derive from the planner-stage tier. Unknown window (custom OpenAI-compat/Ollama) → conservative smallest-safe tier + manifest flag, never assume large (P4-12).

## Per-stage pack transport (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Hook pre-builds both stage packs | Hook resolves planner+renderer stages upfront, runs optimizer per stage, threads packs as input-only seam on runAgentTurn; Planner/Renderer stay import-swaps | ✓ |
| Orchestrator repacks internally | Optimizer runs inside runAgentTurn after createStageInvocation, before each stage call; larger blast radius | |
| You decide | Let research/planning pick the transport | |

**User's choice:** Hook pre-builds both stage packs.
**Notes:** `StageInvocation` (createStageInvocation, 03-05) currently lacks the model context window — it must gain it (providerId/model/jsonMode/callProviderJsonMode today).

---

## Token counting & budget math

| Option | Description | Selected |
|--------|-------------|----------|
| Native-first + script-aware fallback | Provider-native counter when exposed; else `chars/4` English vs `chars/3` CJK by per-section Unicode ratio; mixed → higher divisor; no tokenizer | ✓ (user pre-answer, #2) |
| Fixed chars/4 only | Phase-3 seed heuristic, no script awareness | |
| Custom tokenizer | Build a tokenizer for accuracy | |

**User's choice:** Native-first counter + script-aware fallback.
**Notes:** Per-section caps feed degradation (never hard truncation). Counting is read-only — never rewrites the byte-stable [SYSTEM] persona block (P4-8, cache wins preserved). §2.2 formula: 70/20/10 split; per-section distribution table drives which §2.4 steps fire.

---

## Degradation & minimal mode scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full §2.4 ladder, P4-present steps real | All 8 steps ship; notes/memory/pageContext/history steps are structural no-ops until 4a/5; minimal mode caps tool schemas at 1; CONTEXT_TOO_LARGE honest terminal | ✓ (user pre-answer, #3) |
| Only currently-possible steps | Ship only the steps that have data in P4 | |

**User's choice:** Full §2.4 ladder ships; only Phase-4-present-data steps do real work.
**Notes:** CONTEXT_TOO_LARGE = honest pre-flight terminal (canonical §C.2 code, W-1 gate); hook maps to failed state with "message too long" (new STR); never silently truncates user input (P4-10). Minimal mode entered when tier==tiny (mandatory) or via degradation escalation; MCP chaining block reuses `TIER_CAPS.mcpChaining: false`; LLM-Wiki RAG block = Phase-5a consumer concern. History budget slice reserved-but-empty (ChatHistoryDB = Phase 7).

## Compact system prompt (CTX-03 follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| New canonical compact constants | Appendix A addendum: per-role compact planner/renderer prompts, selected in minimal mode | ✓ |
| Reuse existing prompts | No new constants; minimal mode only shrinks non-system sections | |
| You decide | Researcher verifies Appendix A support | |

**User's choice:** New canonical compact constants.
**Notes:** Added to `src/core/prompts/index.ts` + Appendix A verbatim-style; STR copy contract (Appendix B) governs new UI copy.

---

## the agent's Discretion

- Exact model-window lookup source (`ModelInfo.contextWindow` vs canonical map) — researcher verifies.
- `CONTEXT_TOO_LARGE` throw-vs-return shape at the optimizer boundary.
- Lockstep-guard mechanism for `manifest.sections[].kind` ↔ `PromptSection['kind']` (test preferred).
- Exact per-section distribution enforcement mechanics.
- Compact prompt constant text.

## Deferred Ideas

- ContextUpdate consumers (page/state-change re-pack triggers) — Phase 4a/7.
- Real degradation work for notes/memory/pageContext/history steps — Phase 4a/5/7.
- LLM-Wiki RAG synthesis fallback enforcement — Phase 5a.
- Durable context trace / Prompt Inspector receipt UI — Phase 4b/6.
- History budget slice filling — Phase 7.
