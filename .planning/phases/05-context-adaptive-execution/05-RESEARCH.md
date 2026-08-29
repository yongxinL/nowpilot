# Phase 5: Context-Adaptive Execution — Research

**Researched:** 2026-08-29
**Domain:** Pure-TypeScript context-assembly infrastructure (token budgeting, tier classification, stepwise degradation, provenance manifest)
**Confidence:** HIGH

## Summary

Phase 5 is a **create-only, dependency-light infrastructure phase**: six new modules under `src/core/context/` + three required test files under `tests/core/context/` (spec §18, lines 2580-2607) + one package.json gate re-point (D-78). No new npm packages, no external APIs, no UI, no pipeline wiring (D-69). The layer is proven by the required tests via a pure `ContextOptimizer.assemble(ContextOptimizerInput) → OptimizedContext` function; live adoption lands in Phase 7.

The spec's §2.1–§2.6 contracts are **verbatim and self-contained** — `classifyModelContext`, the 70/20/10 budget formula, the per-tier dynamic distribution table, the §2.4 degradation ladder, the §2.5 minimal-mode lists, and the `ContextProvenanceManifest` shape are all quoted below with line citations. The integration contracts that Phase 5 must respect are in-repo: the A8 `PromptSection` contract (`src/core/ai/types.ts:95-101`, D-72 re-export target), the §1.3 canonical section order + stable-first caching contract (`PromptCacheManager.ts:114-130`), and the `AgentTier` fast/balanced axis that **must not** be conflated with the new `ModelContextTier` context-window axis (D-70).

Three research focus areas were flagged as the agent's discretion and are resolved with recommendations below: (1) **token-counting heuristic** — a `TokenCounter` interface with a CJK-density-aware default (`ceil(len/4)` EN / `ceil(len/3)` CJK per D-71), using code-point-aware counting and a density threshold rather than mere character presence; (2) **CJK detection** — Unicode-range scan with a density threshold (~0.30–0.35 of non-space chars), the community-standard approach corroborated by web sources; (3) **`CONTEXT_TOO_LARGE` result shape** — a returned discriminated union (not a throw), whose `code: 'CONTEXT_TOO_LARGE'` literal is already a canonical §21.6 closed-set member (spec 3435, 5079), so D-38 compliance is automatic as long as no *new* code is minted.

**Primary recommendation:** Keep §18 create-only discipline exactly — six §18 modules + the discretion-sanctioned `src/core/context/types.ts` sibling (hosting the shared strategy/minimal-input shapes, mirroring the Phase-3 `UserPreferences` supersession-point precedent) + the three §18 test files + the D-78 `verify:phase-5` re-point to `tests/core/context`. Model the degradation pipeline as an ordered, observable ladder where every truncated/dropped section is recorded in the manifest so `truncatedSources` derives mechanically.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-69 (Create-only scope: standalone layer with a pure `assemble()`):** §18 lists 6 context files and no AgentOrchestrator/PlannerService modification. Phase 5 ships `ContextOptimizer.assemble(ContextOptimizerInput) → OptimizedContext` as a pure function proven by the required tests; it is NOT wired into the running chat/agent pipeline this phase. Live adoption lands in Phase 7 (trust-aware context), where `pageContext`/`memoryHints` sources actually exist. No component or hook change to AgentOrchestrator/useChatStreaming in Phase 5. — **Reversibility:** `reversible` — rationale: additive modules; wiring later is a caller edit. This keeps §18's create-only inventory and the Phase-4 anti-scope precedent (do NOT "just also re-point the chat hook").
- **D-70 (Tier axes are separate — no conflation):** `ModelContextTier` ('tiny'|'small'|'medium'|'large') is the **context-window classification** (§2.1) that drives budgets, minimal mode, and the §1.4 caps table. It is DISTINCT from the Phase-3 runtime tier `ModelTier` ('fast'|'balanced', Appendix D, D-53) carried by `AgentTier.modelTier`. Phase 5 does NOT change AgentOrchestrator's `AgentTier` or bridge context-tier → caps into the loop (Appendix I owns cap enforcement; the caller supplies caps). ModelContextTier.ts may export a `§1.4`-shaped caps helper for future callers, but it is not wired. — **Reversibility:** `reversible` — rationale: standalone classifier + optional helper; no consumer changes.
- **D-71 (Pluggable `TokenCounter` with heuristic default):** §2.2's "provider-native counter when the SDK exposes it" cannot be met in Phase 3's SDK-less fetch design. Ship a `TokenCounter` interface with the default heuristic implementation — `Math.ceil(text.length / 4)` for English, `Math.ceil(text.length / 3)` for CJK — plus a CJK-detection helper for mixed text (per-section, since sections are the accounting unit). The provider-native counter is an injectable seam (declare-now/populate-later, mirroring D-46/D-64); a caller may supply one, else the heuristic applies. No static tokenizer dependency. — **Reversibility:** `reversible` — rationale: injectable function; swapping impl later is a caller edit.
- **D-72 (A8 `PromptSection` source of truth stays in `src/core/ai/types`; ContextOptimizer re-exports):** Phase 3 owns the A8 definition (`kind`/`text`/`stable`/`tokens`, types.ts:95-101) and PromptCacheManager/Adapter consume it. The spec's canonical import target is `../context/ContextOptimizer` (PromptCacheAdapter.ts:6-7 notes the Phase-5 import-target change). Decision: `ContextOptimizer` **re-exports** `PromptSection` from `src/core/ai/types` — single source of truth preserved, spec-shaped imports resolve, and no Phase-3 file is edited beyond adding a re-export import in the new module. — **Reversibility:** `reversible` — rationale: re-export only; moving the definition later is an import edit.
- **D-73 (Stepwise degradation via section-level token accounting):** `ContextOptimizer.assemble` estimates each section's tokens (A8 `tokens` field) and walks the §2.4 degradation order against `TokenBudget.inputBudget`: drop debug-only → drop secondary notes/optional metadata → summarise older history (via ContextCompressor) → structural-compress page/case context → trim tool schemas to in-scope tools → reduce memory top-k → enter minimal mode → if still over budget, return the **typed `CONTEXT_TOO_LARGE` result** (§2.4) with a user-facing explanation. Never sends an oversized prompt (roadmap SC#2). Every degraded/truncated section is recorded for the manifest. — **Reversibility:** `reversible` — rationale: internal pipeline ordering; reordering later is a local change.
- **D-74 (Minimal-mode gate = typed predicate over the §2.5 blocked set):** MCP chaining and LLM-Wiki RAG don't exist in Phase 5, so "minimal mode blocks them" is satisfied by exporting `isFeatureAllowedInMinimalMode(feature)` — a typed predicate over the §2.5 blocked set (`mcp-chaining`, `multi-step-agent`, `code-search-skill`, `full-note-graph-injection`, `large-research-synthesis`, `llm-wiki-bulk`, `llm-wiki-rag`), asserted by tests against the §2.5 allowed/blocked lists verbatim. `OptimizedContext.minimalMode` is the flag consumers check; the MCP/LLM-Wiki enforcement call sites apply it when those phases ship. Minimal mode is mandatory for tiny tiers (§2.5/§19.2) and entered as the penultimate degradation step. — **Reversibility:** `reversible` — rationale: exported predicate + flag; consumer enforcement arrives with owning phases.
- **D-75 (ContextCompressor = pure strategies; summariser is an injectable seam):** `ContextCompressor` implements the compression that can run without live LLM/page sources: **structural** compression (page/case context → structured fields, operates on the A8 sections it receives), **top-k** reduction (memory injection top-k, §2.4), and **tool-schema trimming** (filter `selectedToolSchemas` to in-scope tools). **Summarise** (older-history summarisation) is declared as an injectable summarizer seam — Phase 5 does NOT call the LLM; if no summarizer is supplied, history truncation falls back to dropping older turns (recorded as truncation, not silence). Compression type is recorded per section in the manifest (`'summarise' | 'structural' | 'topk'`, §2.6). — **Reversibility:** `reversible` — rationale: pure functions + seam; a real summarizer plugs in later.
- **D-76 (ContextPack = final ordered section assembly):** `ContextPack` owns the deterministic assembly of `OptimizedContext.sections` into the final prompt string and the running `totalTokens` tally (sum of per-section tokens). It preserves §1.3 canonical section ordering and the stable-first ordering that PromptCacheAdapter expects (stable sections byte-identical; current user input / in-flight output never cached). It consumes the budgeted, compressed section list from ContextOptimizer — ContextOptimizer decides, ContextPack packs. — **Reversibility:** `reversible` — rationale: new module boundary; re-splitting later is a rename.
- **D-77 (Provenance manifest verbatim + manifest-derived truncation trace):** `ContextProvenanceManifest` implements §2.6 verbatim (`sections[]` with kind/sourceId/tokens/truncated/compressionApplied, `totalTokens`, `minimalMode`, `workspaceId`, `activeSurface` — the two v0.1 NEW fields included). Every `OptimizedContext` carries one (DONE-when 4). To satisfy §19.3/roadmap SC#2 ("records `PromptTrace.truncatedSources`") without creating Phase-11's PromptTrace: `OptimizedContext` additionally exposes a lightweight trace surface — `{ contextTier, truncated, truncatedSources, minimalMode }` — where `truncatedSources` is **derived from the manifest's truncated sections**. Phase 11 lifts this into `PromptTrace`. — **Reversibility:** `reversible` — rationale: derived field on the output; Phase 11 lifts it additively.
- **D-78 (Re-point `verify:phase-5` to `tests/core/context` — D-68 analog):** The package.json `verify:phase-5` script currently targets `tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` (Phase 8/9 territory). Phase 5 re-points it to the §18 required dirs — `tests/core/context` (all three required test files). Exactly the Phase-4 D-68 precedent (04-CONTEXT.md). — **Reversibility:** `reversible` — rationale: package.json script edit.

### the agent's Discretion

- Exact `ContextCompressor` strategy signatures and where the summarizer seam's interface lands (in `ContextCompressor.ts` vs a sibling `types.ts` in `src/core/context/`).
- CJK-detection implementation for the §2.2 heuristic counter (Unicode-range scan vs a small blocklist — either satisfies "ceil(len/3) for CJK").
- Whether the §1.4 caps helper ships in `ModelContextTier.ts` (optional export, unwired) or is omitted.
- Exact shape of the typed `CONTEXT_TOO_LARGE` result (spec says "typed error with a user-facing explanation" — map onto a discriminated result union vs throwing; §21.6 code-set audit is a grep, do not invent registry codes).
- Whether `src/core/context/` keeps one file per §18 name or uses a barrel `index.ts` — mirror the existing `src/core/ai/` layout convention.
- The `workspaceId`/`activeSurface` v0.1 fields' default when the caller doesn't supply them (empty-string vs required — §2.3 marks them NEW in v0.1).

### Deferred Ideas (OUT OF SCOPE)

- **Context receipts + trust metadata (CTX-01…06)** — Phase 7: the manifest becomes the context receipt; stable-prefix snapshot tests (CTX-04) and trust/authority metadata land there. Phase 5 only ships the manifest + stable ordering substrate.
- **Live pipeline adoption of `OptimizedContext`** — Phase 7 (trust-aware context), where `pageContext`/`memoryHints` sources exist; Phase 5 proves `assemble` via tests (D-69).
- **`PromptTrace` + AITransactionLog persistence** — Phase 11; Phase 5 exposes only the derived trace surface (D-77).
- **Page/case content as `ContextOptimizerInput.pageContext`** — Phase 6 (PageContentService) produces it.
- **Memory retrieval as `memoryHints`** — Phase 8 (knowledge base / MiniSearch).
- **Real summariser (LLM-backed history compression)** — a consumer-owned capability; Phase 5 declares the seam only (D-75).
- **`message.warning` on quality-affected degradation (§19.3)** — consumer-side UI; not a context-layer concern in Phase 5.
- **MCP chaining / LLM-Wiki RAG enforcement call sites** — owning phases consume `isFeatureAllowedInMinimalMode` when those features ship (D-74).

None of these belong in Phase 5 — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 5 is an infrastructure phase — **no spec-native v1 requirement IDs land here** (verified: REQUIREMENTS.md §28.3 assigns CTX-01…06 to Phase 7, lines 214-223 + 471-476; ROADMAP Phase 5 block, lines 168-180, states "no spec-native v1 IDs land in Phase 5 — infra phase"). Per the project rule "no invented requirement IDs" (05-CONTEXT.md specifics), the planner must NOT mint pseudo-IDs.

The acceptance contract is the §18 DONE-when list + ROADMAP success criteria instead:

| ID (DONE-when) | Acceptance (verbatim §18/ROADMAP) | Research Support |
|----------------|-----------------------------------|------------------|
| DONE-1 | Tiny/small/medium/large tier tests pass (ModelContextTier resolver + TokenBudget) | §2.1 `classifyModelContext` boundaries verbatim (spec 427-435); §2.2 budget formula + distribution table verbatim (spec 446-459). Boundary fixtures: 4096→tiny, 4097→small, 16384→small, 16385→medium, 131072→medium, 131073→large, 200000→large. |
| DONE-2 | Context overflow degrades stepwise (never sends an oversized prompt; records `PromptTrace.truncatedSources`) | §2.4 degradation ladder verbatim (spec 491-502); D-73 section-level accounting; D-77 manifest-derived `truncatedSources`; §19.3 verbatim (spec 2999-3004). |
| DONE-3 | Minimal mode blocks MCP chaining and LLM-Wiki RAG synthesis (§19.2) | §2.5 allowed/blocked lists verbatim (spec 504-524); D-74 `isFeatureAllowedInMinimalMode` predicate asserted against both lists; §19.2 verbatim (spec 2991-2997). |
| DONE-4 | `ContextProvenanceManifest` is attached to every `OptimizedContext` | §2.6 manifest verbatim (spec 530-544); D-77; manifest kind union + compression-type union drive the record shape. |
| Gate | `pnpm run verify:phase-5` GREEN | D-78 re-point to `tests/core/context` — currently RED (`No test files found, exiting with code 1`, verified by run). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Model-context-tier classification (§2.1) | API/Backend (pure core module) | — | `src/core/context/ModelContextTier.ts` is a pure classifier over a number; no I/O. |
| Token budgeting + counting (§2.2) | API/Backend (pure core module) | — | `TokenBudget.ts` owns the 70/20/10 split + per-category distribution + `TokenCounter` seam (D-71). Heuristic is per-section (sections are the accounting unit, D-71). |
| OptimizedContext assembly + degradation (§2.3/§2.4) | API/Backend (pure core module) | — | `ContextOptimizer.assemble` is the pure decision function (D-69); never wired into UI hooks this phase. |
| Compression strategies (§2.4/D-75) | API/Backend (pure core module) | — | `ContextCompressor` structural/topk/trim run without LLM; summariser is an injectable seam. |
| Final prompt-string assembly (§1.3/D-76) | API/Backend (pure core module) | — | `ContextPack` preserves §1.3 canonical order + stable-first byte-stability; consumed later by PromptCacheManager/PromptCacheAdapter. |
| Minimal-mode policy gate (§2.5/D-74) | API/Backend (pure predicate) | Browser/Client (future enforcement call sites) | `isFeatureAllowedInMinimalMode` is a typed predicate; MCP/LLM-Wiki enforcement lands with owning phases (consumer-side). |
| Provenance + truncation trace (§2.6/D-77) | API/Backend (derived on output) | — | Manifest rides every `OptimizedContext`; `truncatedSources` derives from manifest truncated sections; Phase 11 lifts to `PromptTrace`. |

**MV3 note:** the whole context layer is `src/core/` — UI-framework-agnostic, no React, no chrome API imports (mirrors `src/core/ai`). It runs in UI contexts (side panel/standalone) per §0.2/§5.2 and is trivially background-SW-safe because it is pure. No storage keys, no service workers.

## Standard Stack

This is a **dependency-light phase — no new npm packages are installed**. The entire layer is built on the already-locked toolchain:

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| TypeScript | ~5.8.2 (strict mode ON) | All six modules + tests | Project-wide strict TS (CLAUDE.md; STATE.md decision 17: new code strict-clean, zero NP-STRICT markers) |
| zod | ^4.4.3 | Cross-boundary shapes (OptimizedContext, manifest, schemas mirroring `PromptSectionSchema`) | Project convention: "all cross-boundary data uses Zod validation" (CLAUDE.md); `PromptSectionSchema`/`ModelTierSchema` are the precedent patterns |
| vitest | ^3.0.0 (3.2.7) | The three required test files | Existing test stack: jsdom environment, globals, `tests/setup.ts` mocks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | No additional packages are needed or sanctioned this phase (create-only boundary, D-69). The `TokenCounter` default is hand-rolled per D-71 — deliberately NO static tokenizer dependency (no `gpt-tokenizer`/`tiktoken`; §2.2's provider-native counter is a declared seam, populated later). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled heuristic `TokenCounter` (D-71) | `gpt-tokenizer` / `tiktoken` npm packages | Rejected: adds a BPE dependency for an estimate the spec explicitly defines as `ceil(len/4)`/`ceil(len/3)`; provider-native counters arrive with SDKs later; §2.2's rule is "provider-native **else** heuristic" — the heuristic is the locked default. `[ASSUMED]` |
| Discriminated-union result for `assemble()` | Throw a typed error | Rejected (recommendation): spec §2.4 says "**return** a typed CONTEXT_TOO_LARGE error"; codebase precedent (configuration-required outcome, aborted outcome) favors returned typed results; web sources corroborate result-pattern for expected domain failures (see State of the Art). |
| CJK-density-threshold detection | Presence-only check (`text.includes` any CJK char → len/3) | Presence-only over-counts English text with a stray Japanese term; density threshold (~0.30–0.35 of non-space chars) is the community-standard switch (websearch corroborated). Both are allowed by the D-71 discretion. |

**Installation:** none. `pnpm install` is NOT part of this phase's change set. If a fresh clone needs the toolchain, `pnpm install` restores the existing lockfile — no new entries.

**Version verification (run this session):**
```bash
node --version   # v24.19.0
pnpm --version   # 11.22.0
npx vitest --version   # vitest/3.2.7
# package.json: typescript ~5.8.2, zod ^4.4.3, vitest ^3.0.0
```

## Package Legitimacy Audit

> **Phase 5 installs NO external packages** — the six modules are pure TS over the existing toolchain (the Phase-4 precedent: 04-RESEARCH.md "No external packages are installed by this phase"). The Package Legitimacy Gate is therefore not applicable to a Phase-5 install decision; the table below records the status of the already-installed toolchain for completeness.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| zod | npm | 4+ yrs | ~275M/wk | github.com/colinhacks/zod | SUS (too-new — fresh publish 2026-08-29) | Approved — pre-existing pinned dep (^4.4.3), NOT a Phase-5 install; no checkpoint needed |
| vitest | npm | 4+ yrs | ~98M/wk | github.com/vitest-dev/vitest | SUS (too-new — publish 2026-08-18) | Approved — pre-existing pinned dep (^3.0.0), NOT a Phase-5 install; no checkpoint needed |
| typescript | npm | 9+ yrs | high | github.com/microsoft/TypeScript | OK | Approved — pre-existing pinned dep (~5.8.2) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** zod, vitest — verdicts stem from the seam's `too-new` signal (recent publish dates on long-lived packages), NOT slop. Both are already installed via earlier phases and are untouched by Phase 5's change set. **No `checkpoint:human-verify` is required** — no install happens this phase.

## Architecture Patterns

### System Architecture Diagram

```
ContextOptimizerInput (per turn: operationId, model, modelContextWindow,
  userInput, conversationId, workspaceId, activeSurface, pageContext?,
  selectedToolSchemas[], memoryHints[], preferences)
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ ContextOptimizer.assemble(input)  (pure, D-69)                  │
│                                                                 │
│  1. classifyModelContext(modelContextWindow)  ──► ModelContextTier │
│  2. TokenBudget.forTier(tier, window)          ──► input/output budgets │
│  3. TokenCounter (D-71 seam; heuristic default: CJK-aware)      │
│     → estimate per-section tokens (A8 `tokens` field)           │
│  4. Degradation ladder (§2.4, D-73) against inputBudget:        │
│     drop debug → drop secondary notes/metadata → summarise      │
│     history (ContextCompressor seam) → structural-compress      │
│     page/case (ContextCompressor) → trim tool schemas → reduce  │
│     memory top-k → enter minimal mode (D-74 predicate)          │
│     → still over? RETURN CONTEXT_TOO_LARGE (typed union result) │
│  5. ContextPack.pack(budgetedSections)                          │
│     → §1.3 canonical order + totalTokens tally (D-76)           │
│  6. ContextProvenanceManifest (D-77, §2.6 verbatim)             │
│     → truncated flags per section → derived truncatedSources    │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
OptimizedContext { tier, inputBudget, outputBudget, sections,
                   provenance, minimalMode, truncated, truncatedSources }
        │  (Phase 5: consumed by tests only — D-69)
        ▼  Phase 7+: AgentOrchestrator/useChatStreaming turn path;
           sections feed PromptCacheManager/PromptCacheAdapter
           (stable-first caching, §1.3 / Appendix K)
```

The primary use case to trace: a caller (Phase 7) supplies `ContextOptimizerInput` → the pipeline classifies the tier, budgets, estimates section tokens, degrades any overflow in the locked §2.4 order, packs the surviving sections in §1.3 order, attaches the manifest, and either returns a budget-safe `OptimizedContext` or the typed `CONTEXT_TOO_LARGE` terminal — **never** an oversized prompt.

### Recommended Project Structure

```
src/core/context/
├── ModelContextTier.ts            # §2.1 classifyModelContext + tier const; optional §1.4 caps helper (discretion)
├── TokenBudget.ts                 # §2.2 formula + dynamic distribution; TokenCounter interface + heuristic default (D-71)
├── ContextOptimizer.ts            # §2.3 contract; assemble() → discriminated result; §2.4 degradation ladder; re-exports A8 PromptSection (D-72)
├── ContextCompressor.ts           # D-75 pure strategies: structural / topk / tool-trim; summariser seam
├── ContextPack.ts                 # D-76 final ordered assembly + totalTokens tally
├── ContextProvenanceManifest.ts   # §2.6 verbatim manifest + builder; kind mapping table
└── types.ts                       # [discretion-sanctioned sibling] shared strategy/input types:
                                   #   minimal PageContext / RetrievedMemory / ToolSchemaRef shapes (supersession
                                   #   points — Phase 3 UserPreferences precedent), FeatureName union, CompressionType,
                                   #   TokenCounter, Summarizer seam interface
tests/core/context/
├── ContextOptimizer.test.ts       # §18 required
├── ContextCompressor.test.ts      # §18 required
└── TokenBudget.test.ts            # §18 required
```

Layout note (discretion): mirror `src/core/ai/` — **no barrel `index.ts`**; each module is imported directly by path (the existing `src/core/ai` directory has no index barrel, and §18 lists exact file names). The one sanctioned addition beyond §18's six files is `types.ts` (explicitly contemplated by the discretion for the summarizer seam; also the natural home for the minimal input-type shapes, mirroring how Phase 4's plan created `src/types/harness.ts` as the C.1 canonical home). The planner MUST declare this file explicitly in the plan so it is reviewable against the create-only boundary.

### Pattern 1: Pure `assemble()` + typed result union (D-69, D-73)
**What:** `ContextOptimizer.assemble` is a pure function returning a discriminated union — success carries `OptimizedContext`; failure carries the closed-set `CONTEXT_TOO_LARGE` terminal with a user-facing explanation.
**When to use:** For every module in this phase — pure functions proven by fixtures, no I/O, no chrome, no React (the `src/core/` convention, ARCHITECTURE.md:70).
**Example (recommended shape — discretion to lock exact fields):**
```typescript
// Recommended: returned discriminated union, not a throw. Spec §2.4 says "return a
// typed CONTEXT_TOO_LARGE error"; 'CONTEXT_TOO_LARGE' is a canonical §21.6
// closed-set member (spec 3435, 5079) — using the literal is D-38-compliant, no
// new code minted, StreamErrorCodeSchema untouched.
export type AssembleResult =
  | { ok: true; context: OptimizedContext }
  | {
      ok: false;
      code: 'CONTEXT_TOO_LARGE';          // closed-set literal, spec 3435
      message: string;                    // user-facing explanation (no raw content)
      totalTokens: number;
      inputBudget: number;
      minimalMode: boolean;
      truncatedSources: string[];         // manifest-derived, so callers can report (§19.3)
    };
```
[VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:502 (spec §2.4 verbatim), 3435 + 5079 (closed-set registry), D-73 locked decision; union shape itself is a recommendation]

### Pattern 2: Declare-now/populate-later seams (D-71 TokenCounter, D-75 summariser)
**What:** Framework + contract ship now; the real implementation arrives with the owning phase. Mirrors D-46 (zero tools), D-64 (zero verifiers), D-32 (journal ops).
**When to use:** Provider-native token counters (§2.2) and LLM-backed history summarisation (D-75) cannot exist in Phase 5's SDK-less, LLM-less context layer.
**Example (recommended shape):**
```typescript
// TokenBudget.ts (or context/types.ts) — D-71
export interface TokenCounter {
  count(text: string): number;
}
// Heuristic default: ceil(len/4) English, ceil(len/3) CJK (spec 461), per-section
// (sections are the accounting unit, D-71). CJK detection = Unicode-range scan with
// a density threshold (≈0.30 of non-space chars), code-point-aware (see Pitfall 7).
export const heuristicTokenCounter: TokenCounter = { count: countTokensHeuristic };

// ContextCompressor.ts — D-75
export interface Summarizer {
  summarize(sections: PromptSection[]): { text: string; tokens: number };
}
// If no summarizer is supplied, older-history truncation falls back to dropping
// older turns — recorded as truncation, never silence (D-75).
```

### Pattern 3: §1.3 canonical-order assembly with stable-first fidelity (D-76)
**What:** `ContextPack` emits sections in the canonical order `[SYSTEM] [TOOL SCHEMAS] [USER PREFERENCES] [MEMORY] [CONTEXT] [TASK] [USER INPUT]` (spec 331-339) and preserves the stable-first byte-stability contract `PromptCacheAdapter` expects (stable sections byte-identical; current user input / in-flight output never cached).
**When to use:** Every assembly path; the ordering is the caching contract (`hashStableSections` over stable text, FNV-1a).
**Example — the existing ordering contract ContextPack must slot into** [VERIFIED: src/core/ai/PromptCacheManager.ts:114-130]:
```typescript
const sections: PromptSection[] = [
  { kind: 'SYSTEM', text: systemText, stable: true, tokens: estimateTokens(systemText) },
  { kind: 'TOOL SCHEMAS', text: toolSchemasText, stable: true, tokens: estimateTokens(toolSchemasText) },
  { kind: 'USER PREFERENCES', text: prefsText, stable: false, tokens: estimateTokens(prefsText) },
  { kind: 'TASK', text: opts?.task ?? '', stable: false, tokens: estimateTokens(opts?.task ?? '') },
  { kind: 'USER INPUT', text: opts?.userInput ?? '', stable: false, tokens: estimateTokens(opts?.userInput ?? '') },
];
```
ContextOptimizer adds the two sections PromptCacheManager does not emit — `[MEMORY]` (from `memoryHints`) and `[CONTEXT]` (from `pageContext` + optimized history) — using the same uppercase kind convention (`'MEMORY'`, `'CONTEXT'`) so `PromptCacheAdapter.stableFirst`'s `kind.localeCompare` stays deterministic and consistent (see Pitfall 4 for the casing trap).

### Pattern 4: Typed closed-set predicate for policy (D-74)
**What:** Minimal-mode policy is a typed predicate over the §2.5 blocked set; tests assert both the blocked and allowed lists verbatim.
**Example (recommended — assert the §2.5 lists verbatim in tests):**
```typescript
// §2.5 blocked set verbatim (spec 519-524) → kebab-case literals (D-74)
export type BlockedFeature =
  | 'multi-step-agent' | 'mcp-chaining' | 'code-search-skill'
  | 'full-note-graph-injection' | 'large-research-synthesis'
  | 'llm-wiki-bulk' | 'llm-wiki-rag';
export const BLOCKED_IN_MINIMAL_MODE: readonly BlockedFeature[] = [
  'multi-step-agent', 'mcp-chaining', 'code-search-skill',
  'full-note-graph-injection', 'large-research-synthesis',
  'llm-wiki-bulk', 'llm-wiki-rag',
];
export function isFeatureAllowedInMinimalMode(feature: string): boolean {
  return !(BLOCKED_IN_MINIMAL_MODE as readonly string[]).includes(feature);
}
```
[VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:519-524 (§2.5 blocked list verbatim); D-74 literals]

### Anti-Patterns to Avoid
- **Wiring `assemble()` into the live pipeline:** §18 is create-only; the Phase-4 anti-scope precedent is explicit — do NOT "just also re-point the chat hook" (D-69).
- **Conflating `ModelContextTier` with `ModelTier`:** different axes; `AgentTier.modelTier` ('fast'|'balanced') is untouched (D-70); no bridging context-tier → §1.4 caps into the AgentOrchestrator loop (Appendix I owns enforcement).
- **Silent truncation:** every degraded/dropped section MUST be recorded (manifest `truncated: true`), otherwise `truncatedSources` derives empty and roadmap SC#2/§19.3 is unprovable (D-73/D-77).
- **Emitting lowercase section kinds:** the codebase convention is uppercase-spaced (`'SYSTEM'`, `'TOOL SCHEMAS'`); the manifest's lowercase kinds (`'system'`, `'tool_schemas'`) are a *separate* closed union for provenance records — map between them explicitly (Pitfall 4).
- **Minting error codes:** `CONTEXT_TOO_LARGE` already exists in the closed set; the §21.6 code-set audit is a grep — do not add anything to `StreamErrorCodeSchema` (Phase-3 file, stream-boundary contract) and do not invent a new code (D-38).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-boundary shapes (OptimizedContext, manifest, input schema) | Plain TS interfaces only | zod schemas (mirror `PromptSectionSchema`/`ModelTierSchema` in `src/core/ai/types.ts`) | Project convention: "All cross-boundary data uses Zod validation" (CLAUDE.md); the A8 schema proves the pattern. |
| Token counting | BPE tokenizer or npm tokenizer package | `TokenCounter` interface + spec-mandated heuristic (D-71) | §2.2 defines the heuristic verbatim; a static tokenizer dependency is explicitly rejected by D-71 ("No static tokenizer dependency"); provider-native counters are the declared seam. |
| Section ordering / cache-stability | Ad-hoc string building | `ContextPack` preserving §1.3 order + stable-first fidelity (D-76) | Ordering IS the caching contract — `PromptCacheAdapter` hashes stable sections byte-identically (FNV-1a); breaking order breaks prompt-cache hits. |
| Error terminals | Bare throws | Typed discriminated-union results (recommendation) | §2.4 "return a typed error"; codebase precedent (configuration-required outcome, aborted outcome); callers compile-time-forced to handle the terminal. |
| Compression records | Ad-hoc truncation flags | §2.6 manifest `compressionApplied: 'summarise'\|'structural'\|'topk'` (D-75) | The manifest is the single provenance record; Phase 7's CTX-03 receipt and Phase 11's PromptTrace both consume it. |

**Key insight:** this phase's "deceptively complex" problems are all **contract-fidelity problems, not algorithm problems** — the spec gives verbatim formulas, lists, and shapes; the engineering risk is mis-transcription, type drift from the A8 contract, and silent truncation, not missing libraries. Nothing here justifies a new dependency.

## Runtime State Inventory

> Greenfield infra phase — no rename/refactor/migration. Skipped per the trigger (Step 2.5: "Any phase involving rename, rebrand, refactor, string replacement, or migration"). Explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 5 creates no storage keys, no IndexedDB, no chrome.storage writes (D-69 create-only; modules are pure) | — |
| Live service config | None — no external services; the context layer is pure in-process code | — |
| OS-registered state | None | — |
| Secrets/env vars | None — no secrets touched; context layer never sees provider keys (contrast: Phase-3 `providerSecrets` lives at the orchestrator boundary, untouched) | — |
| Build artifacts | None — no binary/package artifacts; the only config change is the `verify:phase-5` script re-point in package.json (D-78, a source/config edit, not runtime state) | — |

**Canonical question answered:** after every Phase-5 file exists, no runtime system carries stale state — the phase adds new modules and edits one package.json script; nothing is renamed, moved, or migrated.

## Common Pitfalls

### Pitfall 1: `verify:phase-5` gate stays RED (D-78)
**What goes wrong:** `pnpm run verify:phase-5` exits 1 with `No test files found, exiting with code 1` — it points at `tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` (Phase 8/9 dirs that do not exist).
**Why it happens:** package.json:23 mis-points the gate; `tests/core/context` doesn't exist yet.
**How to avoid:** Re-point to `"tsc --noEmit && vitest run tests/core/context"` (D-78) exactly like Phase 4's D-68 (`04-PATTERNS.md:358-360` is the template). Verified RED this session; the re-point is a hard prerequisite, then the three §18 test files make it GREEN.
**Warning signs:** `pnpm run verify:phase-5` → `No test files found`.

### Pitfall 2: Tier-axes conflation
**What goes wrong:** A planner/implementer maps `ModelContextTier` onto `AgentTier.modelTier` or bridges context-tier caps into the AgentOrchestrator loop.
**Why it happens:** Both are called "tiers"; §1.4 caps table and §2.1 classification look related.
**How to avoid:** `ModelContextTier` ('tiny'|'small'|'medium'|'large') = context-window classification driving budgets/minimal mode; `ModelTier` ('fast'|'balanced', `src/core/ai/types.ts:27-28`) = runtime routing. D-70: no AgentTier change, no cap enforcement (Appendix I / AgentOrchestrator owns caps; the caller supplies them). An unwired §1.4 caps *helper* in ModelContextTier.ts is sanctioned, but it must not be consumed.
**Warning signs:** any import of `ModelContextTier` into `src/core/ai/AgentOrchestrator.ts` or `TierResolver.ts`.

### Pitfall 3: Section-kind casing mismatch (uppercase-spaced vs lowercase manifest kinds)
**What goes wrong:** ContextOptimizer emits `kind: 'system'` (or 'context') and breaks consistency with PromptCacheManager's `'SYSTEM'`/`'CONTEXT'` convention; the manifest's §2.6 kind union (`'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input'`, spec 533) is a DIFFERENT closed set from the A8 `kind` string.
**Why it happens:** The spec's Appendix C `PromptSection` (spec 4610-4618) shows lowercase kinds + `sourceId`, but D-72 locked the A8 definition (`kind: z.string()`, types.ts:95-101) as the source of truth — the spec's lowercase kinds/sourceId live on the **manifest entries**, not on PromptSection.
**How to avoid:** Emit sections with the existing uppercase convention; `ContextProvenanceManifest.ts` owns an explicit 7-entry kind mapping table (e.g. `'SYSTEM'→'system'`, `'TOOL SCHEMAS'→'tool_schemas'`, `'USER PREFERENCES'→'preferences'`, `'MEMORY'→'memory'`, `'CONTEXT'→'context'`, `'TASK'→'task'`, `'USER INPUT'→'user_input'`). Do NOT add `sourceId` to A8 (that would edit the Phase-3 file).
**Warning signs:** a test asserting section `kind` equals a lowercase literal, or an attempt to import `sourceId` from `PromptSection`.

### Pitfall 4: Ordering by sort instead of §1.3 canonical order
**What goes wrong:** ContextPack sorts sections (e.g., by kind) and the [MEMORY]/[CONTEXT] sections land out of the §1.3 order, breaking the stable-prefix caching contract.
**Why it happens:** `PromptCacheAdapter.stableFirst` (lines 77-80) sorts stable-first then by `kind.localeCompare` — but that is a *cache-adaptation* sort, not the canonical assembly order; alphabetical ≠ §1.3 order ('CONTEXT' < 'MEMORY' < 'SYSTEM'...).
**How to avoid:** ContextPack emits sections in the hard-coded §1.3 order (spec 331-339); a kind→index constant table drives it. Never derive order from sorting.
**Warning signs:** a ContextPack test asserting alphabetical order, or sections arriving at PromptCacheAdapter in non-canonical order.

### Pitfall 5: `tokens` must be an integer ≥ 0
**What goes wrong:** A `tokens` value computed with `Math.floor` or float arithmetic violates the A8 schema (`z.number().int().nonnegative()`, types.ts:99) and the manifest's per-section tokens.
**Why it happens:** The spec's formulas use `floor` for budgets but `Math.ceil` for the char heuristic (spec 447-449, 461); mixing them produces fractions.
**How to avoid:** Budgets: `floor(window * pct / 100)`. Token estimates: `ceil(...)` per D-71. All `tokens` fields are non-negative integers.
**Warning signs:** a schema-parse failure at the executor boundary, or `tokens: 12.5` in a fixture.

### Pitfall 6: Budget-category → section mapping is unspecified
**What goes wrong:** The §2.2 distribution table has six categories (System/Tools/Memory/Context/History/User) but §1.3 has seven sections and the manifest has seven kinds; an implementer invents a mapping ad hoc.
**Why it happens:** The spec never defines the join (verified — no mapping in §2.2).
**How to avoid:** Lock the mapping in the plan (recommendation): System→[SYSTEM]; Tools→[TOOL SCHEMAS]; Memory→[MEMORY]; Context→[CONTEXT] (page/case); History→older turns inside [CONTEXT] (the manifest has no 'history' kind — history lives in 'context'); User→[USER PREFERENCES]+[USER INPUT]. Percentages per tier sum to 100 (verified: tiny 100, small 100, medium 100, large 100), so each category budget = `floor(inputBudget * pct / 100)`.
**Warning signs:** a TokenBudget test asserting a distribution that doesn't sum to 100, or a manifest entry with kind `'history'` (not in the §2.6 union).

### Pitfall 7: UTF-16 `.length` over-counts surrogate pairs (CJK Ext B, emoji)
**What goes wrong:** `text.length` counts a single CJK Extension B character (U+20000+) or emoji as 2 — inflating the heuristic.
**Why it happens:** JS strings are UTF-16; supplementary-plane code points occupy two code units.
**How to avoid:** Code-point-aware counting — `Array.from(text)` or a `/u`-flagged regex — in the CJK helper (websearch corroborated: `countCodePoints` pattern, `NON_LATIN_RE` with `u` flag). Density approach: count CJK chars in the BMP ranges + handle Extension B surrogates.
**Warning signs:** a token-count test with a supplementary-plane char returning an even number for a 1-char string.

### Pitfall 8: Presence-only CJK detection flips English sections to len/3
**What goes wrong:** A mostly-English section containing one Japanese term is counted at `ceil(len/3)`, over-estimating and triggering spurious degradation.
**Why it happens:** D-71's discretion allows "Unicode-range scan vs a small blocklist"; the naive scan is presence-based.
**How to avoid:** Density threshold — switch to `len/3` only when CJK chars ≥ ~30% of non-space chars (community-standard 0.30–0.35, websearch corroborated). Document the chosen threshold as a named constant; fixture-test both pure-English and mixed text.
**Warning signs:** a degradation test firing on an English-heavy fixture with a stray CJK token.

### Pitfall 9: Silent truncation / missing trace derivation
**What goes wrong:** Dropped or compressed sections vanish from the manifest, so `truncatedSources` derives empty and §19.3's "record truncation" is unmet.
**Why it happens:** It's natural to just omit dropped sections from `sections[]`.
**How to avoid:** Every source that was dropped/compressed stays in the manifest with `truncated: true` (and `compressionApplied` where applicable); `truncatedSources = manifest.sections.filter(s => s.truncated).map(s => s.sourceId)`. The manifest is the single record; `OptimizedContext.sections` holds only what ships.
**Warning signs:** a manifest with zero `truncated: true` entries in an overflow fixture.

### Pitfall 10: Strict-clean violation (NP-STRICT ceiling)
**What goes wrong:** New Phase-5 code ships `@ts-expect-error NP-STRICT` markers and the gate's `tsc --noEmit` still passes, violating STATE.md decision 17.
**Why it happens:** Rushing; copying scaffold patterns that predate the strict sweep.
**How to avoid:** Zero NP-STRICT markers in all six modules + types.ts + tests (decision 17: "new code strict-clean, zero NP-STRICT markers"). The D-78 gate runs `tsc --noEmit` first.
**Warning signs:** `grep -rn "NP-STRICT" src/core/context/ tests/core/context/` returns hits.

## Code Examples

Verified patterns from official/in-repo sources:

### Common Operation 1: §2.1 tier classification (verbatim)
```typescript
// Source: PRODUCT_SPEC_v0_1.md §2.1 (428-435) — verbatim; ModelContextTier.ts implements this exactly
export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';
export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096)   return 'tiny';
  if (contextWindow <= 16384)  return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}
```
[VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:427-435]

### Common Operation 2: §2.2 budgets + distribution (verbatim)
```typescript
// Source: PRODUCT_SPEC_v0_1.md §2.2 (446-459) — verbatim semantics for TokenBudget.ts
// inputBudget  = floor(modelContextWindow * 0.70)
// outputBudget = floor(modelContextWindow * 0.20)
// safetyMargin = floor(modelContextWindow * 0.10)
//
// Dynamic distribution (percent of inputBudget; each tier sums to 100 — verified):
//   tiny:   System 15% · Tools 20% · Memory 10% · Context 20% · History 15% · User 20%
//   small:  System 10% · Tools 15% · Memory 10% · Context 25% · History 20% · User 20%
//   medium: System  8% · Tools 12% · Memory 10% · Context 30% · History 25% · User 15%
//   large:  System  5% · Tools 10% · Memory 10% · Context 35% · History 25% · User 15%
// Token counting rule (spec 461): provider-native counter when the SDK exposes it;
// else Math.ceil(text.length / 4) for English, Math.ceil(text.length / 3) for CJK.
```
[VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:444-461]

### Common Operation 3: §2.3 input/output contract (verbatim)
```typescript
// Source: PRODUCT_SPEC_v0_1.md §2.3 (465-487) — ContextOptimizer implements this contract
export interface ContextOptimizerInput {
  operationId: string;
  model: string;
  modelContextWindow: number;
  userInput: string;
  conversationId: string;
  workspaceId: string;                     // NEW in v0.1
  activeSurface: 'sidepanel' | 'standalone'; // NEW in v0.1
  pageContext?: PageContext;
  selectedToolSchemas: ToolSchemaRef[];
  memoryHints: RetrievedMemory[];
  preferences: UserPreferences;
}
export interface OptimizedContext {
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  sections: PromptSection[];
  provenance: ContextProvenanceManifest;
  minimalMode: boolean;
}
```
[VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:463-487] — note `pageContext?: PageContext` is optional (spec 474), `selectedToolSchemas`/`memoryHints`/`preferences` are required.

### Common Operation 4: §2.6 manifest (verbatim)
```typescript
// Source: PRODUCT_SPEC_v0_1.md §2.6 (530-544) — ContextProvenanceManifest.ts implements this exactly
export interface ContextProvenanceManifest {
  sections: Array<{
    kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input';
    sourceId: string;
    tokens: number;
    truncated: boolean;
    compressionApplied?: 'summarise' | 'structural' | 'topk';
  }>;
  totalTokens: number;
  minimalMode: boolean;
  workspaceId: string;         // NEW in v0.1
  activeSurface: 'sidepanel' | 'standalone'; // NEW in v0.1
}
```
[VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:526-544]

### Common Operation 5: A8 PromptSection (the re-export target, D-72)
```typescript
// Source: src/core/ai/types.ts:95-101 — Phase 3 A8 contract; ContextOptimizer re-exports it (D-72)
export const PromptSectionSchema = z.object({
  kind: z.string(),
  text: z.string(),
  stable: z.boolean(),
  tokens: z.number().int().nonnegative(),
});
export type PromptSection = z.infer<typeof PromptSectionSchema>;
```
[VERIFIED: src/core/ai/types.ts:95-101]

### Common Operation 6: §2.5 minimal-mode lists (verbatim — test fixtures for D-74)
```
// Source: PRODUCT_SPEC_v0_1.md §2.5 (504-524) — assert BOTH lists verbatim in tests
// Allowed:
//  - compact system prompt
//  - compact preference profile
//  - top 3 user memories
//  - conversation summary ≤ 200 tokens
//  - last 1–2 turns
//  - at most one safe tool schema
// Blocked:
//  - multi-step agent
//  - MCP chaining
//  - CodeSearchSkill
//  - full note-graph injection
//  - large research synthesis
//  - LLM-Wiki bulk operations and RAG synthesis (§27)
```
[VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:504-524]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chars/4` token estimate for all text | CJK-aware heuristic: `ceil(len/4)` EN / `ceil(len/3)` CJK with density-based detection (spec 461 + D-71) | v0.1 spec | Without it, CJK-heavy sections are under-counted ~1.3–4×, defeating the degradation pipeline's budget guarantee. Note the existing `PromptCacheManager.estimateTokens` (lines 34-36) is English-only `ceil(len/4)` and stays untouched for Phase-3 consumers — the context layer's richer counter is separate (name it distinctly, e.g. `countTokens`/`heuristicTokenCounter`, to avoid shadowing). |
| Throw for expected failures | Discriminated-union Result types (`ok: true/false` + code) for expected domain outcomes | 2023–2026 (industry shift; websearch corroborated) | Callers compile-time-forced to handle `CONTEXT_TOO_LARGE`; matches the codebase's typed-outcome precedent (configuration-required, aborted) and §2.4's "return". |
| Naive presence-based CJK detection | CJK-density threshold (≥~0.30 of non-space chars) + code-point-aware counting | community standard (multiple 2026 sources) | Prevents English-dominant sections from flipping to the len/3 formula on a stray CJK token. |
| Provider-native tokenizers hard-wired | Injectable `TokenCounter` seam with heuristic default (D-71) | v0.1 spec (SDK-less fetch design) | Provider SDKs arriving in later phases plug in natively without touching the pipeline. |

**Deprecated/outdated:**
- `Math.ceil(text.length / 4)` as a universal estimator: still valid for English-only, but the context layer MUST use the CJK-aware D-71 counter — the spec's §2.2 rule is explicit, and the phase's budget guarantees depend on it.
- Throwing for `CONTEXT_TOO_LARGE`: spec says *return*; a throw would hide the terminal from the type system and break the "never sends an oversized prompt" spine (roadmap SC#2).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CJK Unicode ranges (CJK Unified Ideographs U+4E00–U+9FFF, Extension A U+3400–U+4DBF, Hiragana U+3040–U+309F, Katakana U+30A0–U+30FF, Hangul U+AC00–U+D7AF, Compatibility U+F900–U+FAFF) and a density threshold (~0.30–0.35 of non-space chars) for CJK detection | Token counting (D-71 discretion) | `[ASSUMED]` — standard Unicode knowledge, corroborated by web sources (MEDIUM), not verified against an authoritative Unicode document this session. Risk: a boundary-range mis-transcription changes counting on mixed text. Mitigation: fixture tests pin the behavior; the threshold is a named constant. |
| A2 | The six-category (§2.2) → seven-section (§1.3) budget mapping (System→[SYSTEM], Tools→[TOOL SCHEMAS], Memory→[MEMORY], Context→[CONTEXT], History→inside [CONTEXT], User→[USER PREFERENCES]+[USER INPUT]) | TokenBudget / Pitfall 6 | `[ASSUMED]` — the spec does not define the join. Risk: a different mapping changes per-section budgets. Must be locked in the plan. |
| A3 | `OptimizedContext.sections` covers the five sourced kinds (TOOL SCHEMAS, USER PREFERENCES, MEMORY, CONTEXT, USER INPUT); `[SYSTEM]`/`[TASK]` have no input source (ContextOptimizerInput verbatim has no system/task fields) and are recorded as omitted (`truncated: true`, 0 tokens) in the manifest, merged by the Phase-7 caller with `PromptCacheManager.buildSystemPrompt` output | Architecture Patterns | `[ASSUMED]` design recommendation. Risk: if the planner instead synthesizes placeholder SYSTEM/TASK sections, the manifest's omission semantics differ. Flagged as Open Question 3. |
| A4 | §19.2's "tiny **or small** → enable minimal mode automatically" for local models is caller-side policy — Phase 5's input has no local/cloud signal, so Phase 5 enforces tiny-mandatory + degradation-entered minimal mode only | Minimal mode | `[ASSUMED]` — the spec's §2.5/§1.4 say minimal mode is mandatory for tiny; §19.2's small-tier auto-enable needs a local-model signal the input contract lacks. Risk: a Phase-7 caller expecting Phase 5 to auto-enable minimal mode for small local models finds no hook. |
| A5 | `workspaceId`/`activeSurface` should be required (spec-verbatim non-optional, spec 472-473/541-542), no silent defaults — make illegal states unrepresentable | Discretion | `[ASSUMED]` recommendation. Risk: empty-string defaults would poison the manifest's provenance records. Flagged as Open Question 6. |
| A6 | The discretion-sanctioned sibling `src/core/context/types.ts` is an acceptable addition beyond the §18 six-file inventory (mirrors Phase-4's `src/types/harness.ts` precedent) | Project Structure | `[ASSUMED]` — the discretion explicitly contemplates "a sibling types.ts in src/core/context/", but the planner must declare it in the plan for reviewability. Risk: a strict §18-literal reviewer flags the 7th file. |
| A7 | Minimal `PageContext`/`RetrievedMemory`/`ToolSchemaRef` shapes declared locally (supersession points) — their canonical homes are Phase 6 (`src/core/content/PageContext.ts`, spec 4345), Phase 8 (`src/core/memory/types.ts`, spec 4571 + the canonical-home note at 4833), and `src/core/ai/toolSchemas.ts` (spec 4600 — Phase 3's file does NOT declare `ToolSchemaRef`, verified) | Architecture Patterns / Open Question 1 | `[ASSUMED]` — the Phase-3 `UserPreferences` precedent (declared minimal at `src/core/ai/UserPreferences.ts` with a supersession comment). Risk: a later phase imports the canonical type and the two shapes drift; mitigation is the explicit supersession-point comment + Phase 6/8 replacing in place. |

## Open Questions

1. **Where do the minimal `PageContext` / `RetrievedMemory` / `ToolSchemaRef` input shapes live?**
   - What we know: `ContextOptimizerInput` (spec 474-476) references all three; none exists in `src/` (grep verified zero hits); canonical homes are Phase 6 / Phase 8 / `src/core/ai/toolSchemas.ts` (which does not declare `ToolSchemaRef`, verified); Phase 5 cannot edit those files (create-only).
   - What's unclear: whether to declare them in `ContextOptimizer.ts` (keeps §18 to six files) or the discretion-sanctioned `types.ts` sibling.
   - Recommendation: declare minimal shapes in `src/core/context/types.ts`, each with a supersession-point comment (Phase-3 `UserPreferences.ts:1-6` is the verbatim precedent); the plan must name the file explicitly.

2. **Exact six-category → seven-section budget mapping?**
   - What we know: §2.2 table has six categories summing to 100 per tier; §1.3 has seven sections; manifest has seven kinds (no 'history').
   - What's unclear: the spec never joins them (verified).
   - Recommendation: lock Assumption A2's mapping in the plan and fixture-test one tier's distribution end-to-end.

3. **Does `assemble()` emit `[SYSTEM]`/`[TASK]` sections or record them as omitted?**
   - What we know: `ContextOptimizerInput` verbatim has no system/task text source; the manifest's kind union includes 'system'/'task'; Phase 7 will merge with `buildSystemPrompt`.
   - What's unclear: whether OptimizedContext.sections should be a complete §1.3 set (requiring synthesized placeholders) or the sourced subset.
   - Recommendation: emit the sourced five kinds in §1.3 order; record system/task as omitted (`truncated: true`, 0 tokens) in the manifest so the receipt is complete (CTX-03's "inclusion/omission" semantics). Alternatively accept an optional `baseSections?: PromptSection[]` parameter — planner's call; pick one and lock it.

4. **Exact `CONTEXT_TOO_LARGE` result fields?**
   - What we know: §2.4 "typed error with a user-facing explanation"; `CONTEXT_TOO_LARGE` is a closed-set code (spec 3435/5079); codebase favors returned outcomes over throws.
   - What's unclear: how much diagnostic payload the failure variant carries.
   - Recommendation: the discriminated union in Pattern 1 (`code`, `message`, `totalTokens`, `inputBudget`, `minimalMode`, `truncatedSources`) — enough for §19.3's warning to be consumer-rendered without raw content. Do NOT add it to `StreamErrorCodeSchema`.

5. **Ship the §1.4 caps helper in `ModelContextTier.ts`?**
   - What we know: D-70 sanctions an unwired helper; §1.4 table is tiny 1/1 · small 2/1 · medium 3/2 · large 5/3 (spec 354-359); AgentOrchestrator already receives caps as caller-supplied `AgentTier`.
   - What's unclear: whether to ship or omit (discretion).
   - Recommendation: SHIP `contextTierCaps(tier): { plannerCap, toolCap }` as an unwired export — spec-verbatim, directly testable against the §1.4 table, and it gives Phase-7 callers the tiny/small caps without inventing anything. Grep-assert zero production call sites.

6. **`workspaceId`/`activeSurface` defaults when the caller omits them?**
   - What we know: spec marks them NEW in v0.1 and non-optional (spec 472-473, 541-542); they flow into the manifest verbatim.
   - What's unclear: empty-string default vs required (discretion).
   - Recommendation: REQUIRED, no defaults — empty strings would poison the provenance records; tests always supply concrete values. This matches the codebase's make-illegal-states-unrepresentable style.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | vitest / tsc | ✓ | v24.19.0 | — |
| pnpm | script execution (`verify:phase-5`, `pnpm test`) | ✓ | 11.22.0 | — |
| vitest | the three required test files | ✓ | 3.2.7 | — |
| typescript | `tsc --noEmit` (gate) | ✓ | ~5.8.2 (strict) | — |
| zod | runtime schemas | ✓ | ^4.4.3 (installed) | — |
| chrome API mocks | tests (jsdom `tests/setup.ts`) | ✓ | in-repo | context modules are pure — no mocks needed, but the setup is active |

**Missing dependencies with no fallback:** none — this phase has zero external dependencies beyond the existing toolchain.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.7 (jsdom environment, globals, `tests/setup.ts`) + `tsc --noEmit` |
| Config file | `vitest.config.ts` (jsdom, globals, setupFiles `./tests/setup.ts`, `@` alias → `src`) |
| Quick run command | `npx vitest run tests/core/context` |
| Full suite command | `pnpm run verify:phase-5` (after D-78 re-point) / `pnpm test` |

### Phase Requirements → Test Map
No requirement IDs (infra phase) — the map targets the §18 DONE-when criteria + the three required files:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DONE-1 | Tier classification boundaries + budget math | unit | `pnpm vitest run tests/core/context/TokenBudget.test.ts -t tier` | ❌ Wave 0 (§18 create) |
| DONE-1 | Budget formula 70/20/10 + dynamic distribution sums to 100 | unit | `npx vitest run tests/core/context/TokenBudget.test.ts` | ❌ Wave 0 |
| DONE-2 | Overflow degrades stepwise in §2.4 order; never oversized; `truncatedSources` derived | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` | ❌ Wave 0 |
| DONE-2 | CONTEXT_TOO_LARGE terminal returned (never thrown), message present | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` | ❌ Wave 0 |
| DONE-3 | `isFeatureAllowedInMinimalMode` asserts §2.5 blocked/allowed lists verbatim | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` | ❌ Wave 0 |
| DONE-3 | tiny tier → minimalMode always true; minimal mode is penultimate degradation step | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` | ❌ Wave 0 |
| DONE-4 | Every OptimizedContext carries a §2.6-verbatim manifest; compressionApplied recorded | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts` + `ContextCompressor.test.ts` | ❌ Wave 0 |
| D-75 | structural / topk / tool-trim strategies pure; summarizer seam falls back to drop-not-silence | unit | `npx vitest run tests/core/context/ContextCompressor.test.ts` | ❌ Wave 0 |
| D-76 | ContextPack preserves §1.3 order + totalTokens = Σ section tokens | unit | (via ContextOptimizer.test.ts — pack is exercised through assemble) | ❌ Wave 0 |
| D-78 | `verify:phase-5` re-pointed and GREEN | gate | `pnpm run verify:phase-5` | ❌ Wave 0 (package.json edit + dirs) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/context` (targeted file) + `pnpm run lint` (`tsc --noEmit` strict-clean)
- **Per wave merge:** `pnpm run verify:phase-5` (D-78 re-pointed) + `pnpm run lint`
- **Phase gate:** `pnpm run verify:phase-5` GREEN before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/context/TokenBudget.test.ts` — DONE-1 (tier boundaries + budget math + distribution)
- [ ] `tests/core/context/ContextOptimizer.test.ts` — DONE-2/3/4 (degradation ladder, CONTEXT_TOO_LARGE terminal, minimal-mode predicate verbatim, manifest-on-every-context)
- [ ] `tests/core/context/ContextCompressor.test.ts` — D-75 (structural/topk/trim strategies + summarizer-seam fallback)
- [ ] `package.json` — re-point `verify:phase-5` to `tests/core/context` (D-78) — currently RED (verified by run: `No test files found, exiting with code 1`)

## Security Domain

> `workflow.security_enforcement: true` in `.planning/config.json` (absent = enabled) — section required. ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 5 has no auth surface (provider keys live at the Phase-3 orchestrator boundary, untouched) |
| V3 Session Management | no | No sessions; `operationId` is a plain string correlation id |
| V4 Access Control | no | No permissions/roles in the context layer |
| V5 Input Validation | **yes** | zod schemas for every cross-boundary shape (OptimizedContext, manifest, input) mirroring `PromptSectionSchema`; closed unions for manifest kinds, tier, minimal-mode features |
| V6 Cryptography | no | No secrets, no crypto — the layer is pure; `CONTEXT_TOO_LARGE`'s user-facing message must never embed raw context text |

### Known Threat Patterns for the context layer

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via untrusted context content (page/memory/tool text) | Tampering | The layer synthesizes system/task sections itself; untrusted content (pageContext, memoryHints, tool descriptions) is confined to the 'context'/'memory'/'tool_schemas' kinds and can never redefine the system section. Full trust/authority metadata is Phase 7 (CTX-02: page/note/memory/tool output "cannot redefine system/tool/permission policy"). Phase 5's structural boundary — content slots are data, not policy — is the substrate. |
| Feature-existence spoofing in minimal mode | Spoofing | `isFeatureAllowedInMinimalMode` is a typed predicate over the closed §2.5 blocked set (kebab-case literals, D-74); tests assert the blocked list verbatim; unknown feature strings default to allowed (closed-set discipline) — the predicate is the single gate consumers call when the features ship. |
| Oversized-prompt exfiltration / cost abuse | DoS | The degradation pipeline's terminal guarantee: `assemble` NEVER returns an oversized `OptimizedContext` — it returns the typed `CONTEXT_TOO_LARGE` terminal (roadmap SC#2/§19.3). Budget math is `floor`-based so the sum can never exceed `inputBudget` by construction. |
| Sensitive data in traces/errors | Information Disclosure | `truncatedSources` carries sourceIds only, never section text; `CONTEXT_TOO_LARGE.message` is a user-facing explanation without raw context content (aligned with TraceRedactor discipline, §4.4); the manifest stores token counts + flags, not bodies (spec 528: "display provenance without the raw body"). |
| Error-code invention | — | `CONTEXT_TOO_LARGE` is a canonical closed-set code (spec 3435, 5079); the §21.6 audit is a grep — no additions to `StreamErrorCodeSchema`, no new codes (D-38). |

## Sources

### Primary (HIGH confidence)
- `.planning/PRODUCT_SPEC_v0_1.md` — §2.1-§2.6 (425-544), §1.3 (327-350), §1.4 (352-361), §19.2 (2991-2997), §19.3 (2999-3004), §18 Phase 5 block (2580-2607), PromptTrace (732-756), §3.4 memory budget (686-694), §21.6 closed codes (3402-3454), Appendix C.2 (5071-5087), Appendix C PageContext/RetrievedMemory/ToolSchemaRef (4345-4357, 4570-4608), §4.1 trace fields (702), §28.3 (214-223 via REQUIREMENTS) — all read this session; verbatim quotes cited by line.
- `src/core/ai/types.ts` (95-101 A8 PromptSection; 17-28 ProviderId/ModelTier), `src/core/ai/PromptCacheAdapter.ts` (1-11 import-target note; 19-23 cache constants; 77-96 stableFirst/hashStableSections), `src/core/ai/PromptCacheManager.ts` (34-36 estimateTokens; 88-133 buildSystemPrompt sections), `src/core/ai/AgentOrchestrator.ts` (48-55 AgentTier), `src/core/ai/UserPreferences.ts` (supersession-point precedent), `src/core/ai/toolSchemas.ts` (no ToolSchemaRef — verified), `src/core/runtime/RuntimeEnvelope.ts` (operationId) — all read this session.
- `package.json` (verify:phase-5 mis-point verified; toolchain versions), `vitest.config.ts`, `tests/setup.ts` (mocks), `04-CONTEXT.md` D-68 precedent, `03-CONTEXT.md` D-44…59 (declare-now pattern), `04-RESEARCH.md` (Phase-4 no-package precedent), `STATE.md` (decision 17 strict ceiling) — read this session.
- Bash probes (2026-08-29): node v24.19.0, pnpm 11.22.0, vitest 3.2.7; `verify:phase-5` vitest portion exits 1 `No test files found` (gate RED).

### Secondary (MEDIUM confidence)
- WebSearch (corroborated, multiple independent sources): CJK Unicode ranges + density-threshold detection + code-point-aware counting (github.com/DavesFromTheGrave/Local-Auto-Claw `cjk-chars.ts`, github.com/garrytan/gbrain `cjk.ts` — density threshold 0.30, dev.to character-counting analysis — threshold 0.35); discriminated-union Result vs throw for expected domain failures (rubel.dev, resumelens.org, echooff.dev, letsbuildsolutions.com).

### Tertiary (LOW confidence)
- `[ASSUMED]` items A1-A7 (Assumptions Log) — training knowledge / design recommendations, each flagged with its risk and mitigation; the planner and discuss-phase should confirm before locking.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — zero new packages; the entire toolchain is verified installed this session (node/pnpm/vitest/TS/zod); "dependency-light" claim verified against package.json + the create-only boundary.
- Architecture: **HIGH** — every contract (tiers, budgets, degradation, minimal mode, manifest, A8, §1.3 order) is spec-verbatim or in-repo source read this session with line citations; the open items are the discretion-shaped recommendations (result-union fields, budget mapping, minimal-shape home) explicitly flagged.
- Pitfalls: **HIGH** (gate RED verified by run; tier-axes, casing, order, schema-int, strict-ceiling all verified against in-repo sources) / **MEDIUM** for the CJK-density and surrogate-pair items (websearch-corroborated, not spec-authoritative).

**Research date:** 2026-08-29
**Valid until:** 2026-09-12 (7 days — fast-moving toolchain versions are the only drift risk; spec and codebase contracts are static)