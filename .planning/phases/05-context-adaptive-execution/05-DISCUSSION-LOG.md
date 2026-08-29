# Phase 5: Context-Adaptive Execution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-29
**Phase:** 5-Context-Adaptive Execution
**Areas discussed:** Pipeline wiring scope, Token counting & PromptSection home, Degradation trigger & minimal-mode enforcement, Truncation trace & gate re-pointing

> Ran in `--auto` mode: all gray areas auto-selected and resolved to the recommended option. Logs below record each auto-selection for the audit trail.

---

## Pipeline wiring scope

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone layer, pure assemble() | §18 is create-only (6 context files, no AgentOrchestrator/Planner modify); ContextOptimizer exports a pure `assemble(ContextOptimizerInput) → OptimizedContext`; callers adopt it in Phase 7 when pageContext/memoryHints sources exist; Phase 5 proves behavior via the required tests | ✓ |
| Wire into AgentOrchestrator now | Passes OptimizedContext to the planner this phase; exceeds §18 create-only inventory (requires modifying AgentOrchestrator/PlannerService, not listed in §18) | |

**User's choice:** `[auto]` → "Standalone layer, pure assemble()" (recommended default)
**Notes:** D-69. Tier-axes separation folded in as D-70 (ModelContextTier ≠ fast/balanced ModelTier; AgentTier untouched).

---

## Token counting & PromptSection home

| Option | Description | Selected |
|--------|-------------|----------|
| Pluggable TokenCounter + heuristic default | Default `ceil(len/4)` EN / `ceil(len/3)` CJK with CJK detection; injectable provider-native counter seam (declare-now/populate-later); A8 PromptSection stays in src/core/ai/types, ContextOptimizer re-exports it so the spec's `import from '../context/ContextOptimizer'` resolves | ✓ |
| Heuristic-only, no seam | Simplest, but violates §2.2's "provider-native counter when SDK exposes it" when SDKs/adapters arrive | |

**User's choice:** `[auto]` → "Pluggable TokenCounter + heuristic default" (recommended default)
**Notes:** D-71, D-72.

---

## Degradation trigger & minimal-mode enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Section-level accounting + typed minimal-mode predicate | Track each section's A8 `tokens` and degrade against inputBudget in §2.4 order; terminal = typed CONTEXT_TOO_LARGE; export `isFeatureAllowedInMinimalMode(feature)` over the §2.5 blocked set; OptimizedContext carries minimalMode; consumers enforce when they ship | ✓ |
| Single total-budget check | Only fail when assembled total exceeds budget (no stepwise degradation); fails roadmap SC#2 "degrades stepwise" | |

**User's choice:** `[auto]` → "Section-level accounting + typed minimal-mode predicate" (recommended default)
**Notes:** D-73, D-74. ContextCompressor pure strategies + summariser seam folded in as D-75; ContextPack assembly boundary as D-76.

---

## Truncation trace & gate re-pointing

| Option | Description | Selected |
|--------|-------------|----------|
| Manifest-derived trace + re-point gate | Derive truncatedSources from ContextProvenanceManifest truncated sections; expose lightweight trace surface (contextTier, truncated, truncatedSources, minimalMode) for Phase-11 PromptTrace to lift; re-point verify:phase-5 → tests/core/context (D-68 analog; currently mis-points at Phase 8/9 dirs) | ✓ |
| Skip trace until Phase 11 | Fails roadmap SC#2 and leaves the §19.3 contract unprovable | |

**User's choice:** `[auto]` → "Manifest-derived trace + re-point gate" (recommended default)
**Notes:** D-77, D-78.

---

## the agent's Discretion

- Exact ContextCompressor strategy signatures; summarizer seam location.
- CJK-detection implementation for the §2.2 heuristic counter.
- Whether the §1.4 caps helper ships in ModelContextTier.ts (optional, unwired).
- Exact shape of the typed CONTEXT_TOO_LARGE result (union result vs throw; no new §21.6 codes).
- src/core/context layout (one file per §18 name vs barrel index).
- workspaceId/activeSurface default when the caller omits them.

## Deferred Ideas

- Context receipts + trust metadata (CTX-01…06) — Phase 7.
- Live pipeline adoption of OptimizedContext — Phase 7.
- PromptTrace + AITransactionLog persistence — Phase 11.
- Page/case content (pageContext) — Phase 6.
- Memory retrieval (memoryHints) — Phase 8.
- Real LLM summariser — consumer-owned; seam only in Phase 5.
- message.warning on degradation (§19.3) — consumer-side UI.
- MCP chaining / LLM-Wiki RAG enforcement call sites — owning phases.