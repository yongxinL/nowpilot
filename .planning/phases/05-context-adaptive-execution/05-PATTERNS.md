# Phase 5: Context-Adaptive Execution - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 11 (6 §18 modules + 1 discretion types.ts + 3 §18 tests + package.json)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/context/ModelContextTier.ts` | model | transform | `src/core/ai/types.ts` (ModelTierSchema z.enum, lines 27-28) | role-match |
| `src/core/context/TokenBudget.ts` | service | transform | `src/core/ai/PromptCacheManager.ts` (estimateTokens, lines 34-36) | role-match |
| `src/core/context/ContextOptimizer.ts` | service | transform | `src/core/ai/PlannerService.ts` (pure service module shape) | role-match |
| `src/core/context/ContextCompressor.ts` | service | transform | `src/core/ai/trajectory.ts` (pure closed-state module) | role-match |
| `src/core/context/ContextPack.ts` | service | transform | `src/core/ai/PromptCacheManager.ts` (buildSystemPrompt, lines 93-133) | exact |
| `src/core/context/ContextProvenanceManifest.ts` | model | transform | `src/core/ai/types.ts` (PromptSectionSchema, lines 95-101) | role-match |
| `src/core/context/types.ts` (discretion) | types | N/A | `src/core/ai/UserPreferences.ts` (supersession point, lines 1-14) | exact |
| `tests/core/context/ContextOptimizer.test.ts` | test | N/A | `tests/core/ai/OutcomeVerifier.test.ts` + `tests/core/ai/PromptCacheManager.test.ts` | role-match |
| `tests/core/context/ContextCompressor.test.ts` | test | N/A | `tests/core/ai/trajectory/TrajectoryTracker.test.ts` | exact |
| `tests/core/context/TokenBudget.test.ts` | test | N/A | `tests/core/ai/PromptCacheManager.test.ts` | role-match |
| `package.json` (D-78 edit) | config | N/A | itself — `04-PATTERNS.md:358-360` (D-68 template) | exact precedent |

**Layout convention (discretion — mirror `src/core/ai/`):** NO barrel `index.ts` (verified: `src/core/ai/index.ts` does not exist). Each module is imported directly by path; §18 lists exact file names. The one sanctioned addition beyond §18's six files is `types.ts`, declared explicitly for reviewability (RESEARCH A6).

---

## Pattern Assignments

### `src/core/context/ModelContextTier.ts` (model, transform)

**Analog:** `src/core/ai/types.ts` (lines 27-28 — `ModelTierSchema` z.enum) + spec §2.1 verbatim (classifyModelContext)

**Role:** closed 4-value union (`'tiny'|'small'|'medium'|'large'`) + pure `classifyModelContext(contextWindow)` boundary function + optional unwired `contextTierCaps(tier)` §1.4 helper (discretion, RESEARCH Open Q5 — recommend SHIP, grep-assert zero production call sites).

**Enum schema pattern** (types.ts:27-28):
```typescript
/** Runtime model tiers — exactly 'fast' | 'balanced' (Appendix D, §0.5.1 rule 2). */
export const ModelTierSchema = z.enum(['fast', 'balanced']);
export type ModelTier = z.infer<typeof ModelTierSchema>;
```

**Classification function — implement §2.1 verbatim (spec 428-435, quoted in 05-RESEARCH.md Common Operation 1):**
```typescript
export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';
export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096)   return 'tiny';
  if (contextWindow <= 16384)  return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}
```

**D-70 constraint:** do NOT import from or modify `AgentOrchestrator.ts`/`TierResolver.ts` — `ModelTier` ('fast'|'balanced', types.ts:27-28) is a separate axis. The `contextTierCaps` helper must be exported-but-unwired.

---

### `src/core/context/TokenBudget.ts` (service, transform)

**Analog:** `src/core/ai/PromptCacheManager.ts` (lines 34-36 — `estimateTokens`)

**Role:** §2.2 formula (`inputBudget = floor(window*0.70)`, `outputBudget = floor(window*0.20)`, `safetyMargin = floor(window*0.10)`) + per-tier dynamic distribution (6 categories, each summing to 100) + `TokenCounter` interface with `heuristicTokenCounter` default (D-71).

**Token-counting pattern** (PromptCacheManager.ts:33-36 — Phase 3's English-only heuristic; Phase 5's CJK-aware counter must be NAMED DISTINCTLY, e.g. `countTokens`/`heuristicTokenCounter`, to avoid shadowing):
```typescript
/** Standard chars→tokens heuristic (roughly 4 chars/token) for section budget bookkeeping. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```
Phase 5 extends this: `Math.ceil(len/4)` English / `Math.ceil(len/3)` CJK with a CJK-density threshold (~0.30 of non-space chars, code-point-aware via `Array.from`/`/u` regex — Pitfalls 7/8). All `tokens` fields must be `z.number().int().nonnegative()` (A8 contract, types.ts:99 — Pitfall 5: budgets use `floor`, estimates use `ceil`, never fractions).

**Declare-now seam (D-71, research Pattern 2):**
```typescript
export interface TokenCounter {
  count(text: string): number;
}
export const heuristicTokenCounter: TokenCounter = { count: countTokensHeuristic };
// Provider-native counter is an injectable seam — caller supplies one, else heuristic applies.
```

**Budget mapping (Assumption A2 — lock in plan):** System→[SYSTEM]; Tools→[TOOL SCHEMAS]; Memory→[MEMORY]; Context→[CONTEXT]; History→older turns inside [CONTEXT] (manifest has no 'history' kind); User→[USER PREFERENCES]+[USER INPUT]. Each category budget = `floor(inputBudget * pct / 100)`.

---

### `src/core/context/ContextOptimizer.ts` (service, transform)

**Analog:** `src/core/ai/PlannerService.ts` (lines 34-55, 94-122 — pure service module shape) + `src/core/ai/PromptCacheManager.ts` (lines 93-133 — section assembly)

**Role:** `assemble(ContextOptimizerInput) → AssembleResult` discriminated union (D-69/D-73); §2.4 degradation ladder; re-exports A8 `PromptSection` (D-72). **The phase's spine module.**

**Pure service module shape** (PlannerService.ts:34-55 — input interface + typed service object export; the object export enables `vi.spyOn` mocking in tests):
```typescript
export interface PlannerInput {
  operationId: string;
  providerId: ProviderId;
  model: string;
  prompt: string;
  toolNames: readonly string[];
  callProviderJsonMode: (prompt: string, jsonSchema: unknown, signal: AbortSignal) => Promise<string>;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}

export type PlannerService = {
  plan(input: PlannerInput): Promise<PlannerDecision>;
};
```

**Re-export pattern (D-72)** — mirror PlannerService.ts:2 (`import type { ProviderId, PlannerDecision } from './types'`) and PromptCacheManager.ts:27 (`import type { PromptSection } from './types'`). ContextOptimizer adds `export type { PromptSection } from '../ai/types';` — single source of truth preserved; PromptCacheAdapter.ts:6-7's spec import-target note resolves.

**Returned discriminated union (NOT a throw — research Pattern 1; §2.4 "return a typed error"; `CONTEXT_TOO_LARGE` is a canonical §21.6 closed-set literal, spec 3435/5079, so D-38 compliance is automatic):**
```typescript
export type AssembleResult =
  | { ok: true; context: OptimizedContext }
  | {
      ok: false;
      code: 'CONTEXT_TOO_LARGE';   // closed-set literal — do NOT touch StreamErrorCodeSchema (types.ts:55-64)
      message: string;             // user-facing explanation, no raw context content (V6)
      totalTokens: number;
      inputBudget: number;
      minimalMode: boolean;
      truncatedSources: string[];  // manifest-derived (§19.3)
    };
```

**Degradation ladder (D-73, §2.4 order):** drop debug-only → drop secondary notes/optional metadata → summarise older history (via ContextCompressor seam; falls back to drop-not-silence) → structural-compress page/case → trim tool schemas to in-scope → reduce memory top-k → enter minimal mode → still over → return `CONTEXT_TOO_LARGE`. Every degraded/truncated section recorded for the manifest (D-73/D-77 — never silent truncation, Pitfall 9).

**Minimal-mode predicate (D-74, research Pattern 4)** — §2.5 blocked set verbatim (spec 519-524):
```typescript
export type BlockedFeature =
  | 'multi-step-agent' | 'mcp-chaining' | 'code-search-skill'
  | 'full-note-graph-injection' | 'large-research-synthesis'
  | 'llm-wiki-bulk' | 'llm-wiki-rag';
export const BLOCKED_IN_MINIMAL_MODE: readonly BlockedFeature[] = [ /* verbatim list */ ];
export function isFeatureAllowedInMinimalMode(feature: string): boolean {
  return !(BLOCKED_IN_MINIMAL_MODE as readonly string[]).includes(feature);
}
```

---

### `src/core/context/ContextCompressor.ts` (service, transform)

**Analog:** `src/core/ai/trajectory.ts` (lines 29-85 — pure closed-state module, no deps) + `src/core/ai/PlannerService.ts` (lines 47-48 — injectable function seam)

**Role:** pure strategies — **structural** (page/case → structured fields), **top-k** (memory injection), **tool-schema trim** (filter `selectedToolSchemas` to in-scope); **summarise** is an injectable seam (D-75 — Phase 5 never calls the LLM; no summarizer → drop older turns recorded as truncation, not silence).

**Injectable seam pattern** (PlannerService.ts:47 — a function injected by the caller; the D-75 `Summarizer` seam follows the same shape):
```typescript
/** JSON-mode provider call (Appendix L); each provider sets its flag natively. */
callProviderJsonMode: (prompt: string, jsonSchema: unknown, signal: AbortSignal) => Promise<string>;
```
```typescript
export interface Summarizer {
  summarize(sections: PromptSection[]): { text: string; tokens: number };
}
// No summarizer supplied → history truncation falls back to dropping older turns (D-75).
```

**Closed-union discipline** (trajectory.ts:29-40 style — closed table of literals; the compression-type union `'summarise' | 'structural' | 'topk'` is the manifest record, §2.6):
```typescript
export const TRAJECTORY_TRANSITIONS: Record<AgentTrajectoryPhase, readonly AgentTrajectoryPhase[]> = { ... };
```
Compression type is recorded per section in the manifest (`compressionApplied?: 'summarise' | 'structural' | 'topk'`, §2.6). The seam interface may land here or in `types.ts` (discretion — research recommends `types.ts` sibling for shared strategy shapes).

---

### `src/core/context/ContextPack.ts` (service, transform)

**Analog:** `src/core/ai/PromptCacheManager.ts` (lines 93-133 — `buildSystemPrompt` ordered section assembly) — **exact match** (same role: deterministic section assembly; same data flow)

**Role (D-76):** deterministic assembly of `OptimizedContext.sections` → final prompt string + `totalTokens` tally (Σ per-section tokens). Preserves §1.3 canonical order + stable-first byte-stability (stable sections byte-identical; current user input / in-flight output never cached). ContextOptimizer decides, ContextPack packs.

**Canonical order + stable/tokens tagging** (PromptCacheManager.ts:114-130 — the §1.3 pattern ContextPack extends with `[MEMORY]` + `[CONTEXT]` sections in the same uppercase-spaced kind convention):
```typescript
const sections: PromptSection[] = [
  { kind: 'SYSTEM', text: systemText, stable: true, tokens: estimateTokens(systemText) },
  {
    kind: 'TOOL SCHEMAS',
    text: toolSchemasText,
    stable: true,
    tokens: estimateTokens(toolSchemasText),
  },
  { kind: 'USER PREFERENCES', text: prefsText, stable: false, tokens: estimateTokens(prefsText) },
  { kind: 'TASK', text: opts?.task ?? '', stable: false, tokens: estimateTokens(opts?.task ?? '') },
  {
    kind: 'USER INPUT',
    text: opts?.userInput ?? '',
    stable: false,
    tokens: estimateTokens(opts?.userInput ?? ''),
  },
];
```

**Ordering contract (Pitfall 4):** ContextPack emits in HARD-CODED §1.3 order `[SYSTEM] [TOOL SCHEMAS] [USER PREFERENCES] [MEMORY] [CONTEXT] [TASK] [USER INPUT]` — a kind→index constant table drives it. NEVER derive order from sorting (`PromptCacheAdapter.stableFirst`, lines 77-80, is a cache-adaptation sort, NOT canonical order). Do NOT emit lowercase kinds (Pitfall 3 — the manifest owns the lowercase `'system'|'tool_schemas'|'preferences'|'memory'|'context'|'task'|'user_input'` union; mapping happens in ContextProvenanceManifest).

**Assumption A3 (lock in plan):** emit the sourced five kinds (TOOL SCHEMAS, USER PREFERENCES, MEMORY, CONTEXT, USER INPUT); record `[SYSTEM]`/`[TASK]` as omitted (`truncated: true`, 0 tokens) in the manifest.

---

### `src/core/context/ContextProvenanceManifest.ts` (model, transform)

**Analog:** `src/core/ai/types.ts` (lines 95-101 — `PromptSectionSchema` zod object pattern)

**Role (D-77):** §2.6 verbatim manifest + builder; explicit 7-entry kind mapping table (uppercase-spaced A8 kind → lowercase manifest kind, Pitfall 3). Every `OptimizedContext` carries one (DONE-when 4).

**Zod schema pattern** (types.ts:95-101 — the schema-first shape; manifest fields mirror this):
```typescript
export const PromptSectionSchema = z.object({
  kind: z.string(),
  text: z.string(),
  stable: z.boolean(),
  tokens: z.number().int().nonnegative(),
});
export type PromptSection = z.infer<typeof PromptSectionSchema>;
```

**Manifest shape — §2.6 verbatim (spec 530-544, quoted in 05-RESEARCH.md Common Operation 4):**
```typescript
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
  workspaceId: string;            // NEW in v0.1 — REQUIRED, no defaults (research Open Q6 / A5)
  activeSurface: 'sidepanel' | 'standalone'; // NEW in v0.1 — REQUIRED
}
```

**Derived trace surface (D-77):** `OptimizedContext` additionally exposes `{ contextTier, truncated, truncatedSources, minimalMode }` where `truncatedSources = manifest.sections.filter(s => s.truncated).map(s => s.sourceId)` — sourceIds only, never section text (V6/TraceRedactor discipline). Phase 11 lifts this into `PromptTrace`.

**Kind mapping table (Pitfall 3):** `'SYSTEM'→'system'`, `'TOOL SCHEMAS'→'tool_schemas'`, `'USER PREFERENCES'→'preferences'`, `'MEMORY'→'memory'`, `'CONTEXT'→'context'`, `'TASK'→'task'`, `'USER INPUT'→'user_input'`. Do NOT add `sourceId` to A8 PromptSection (would edit the Phase-3 file).

---

### `src/core/context/types.ts` (types, N/A — discretion-sanctioned)

**Analog:** `src/core/ai/UserPreferences.ts` (lines 1-14 — supersession-point minimal shapes) — **exact** (same pattern: minimal local shape with explicit supersession comment, replaced in place by the owning phase)

**Role:** minimal `PageContext` / `RetrievedMemory` / `ToolSchemaRef` shapes (none exist in `src/` — grep verified zero hits), `FeatureName` union, `CompressionType`, `TokenCounter`, `Summarizer` seam. Canonical homes: Phase 6 (`src/core/content/PageContext.ts`), Phase 8 (`src/core/memory/types.ts`), `src/core/ai/toolSchemas.ts` (does NOT declare `ToolSchemaRef` — verified).

**Supersession-point header pattern** (UserPreferences.ts:1-6 — copy this verbatim style):
```typescript
// Minimal UserPreferences shape + np_preferences persistence (plan 03-02, Task 2).
//
// Phase-3 supply point for PersonaInjector (Appendix N.2 imports UserPreferences
// from `@/core/memory/types`, which does not exist — RESEARCH Open Q2). The
// memory phases (8/10) own the FULL UserPreferences shape; this minimal shape
// is the supersession point those phases replace in place.
```

---

### `tests/core/context/ContextOptimizer.test.ts` (test, N/A)

**Analog:** `tests/core/ai/OutcomeVerifier.test.ts` (lines 22-43 — input-builder fixtures + injected seams) + `tests/core/ai/PromptCacheManager.test.ts` (lines 31-48 — canonical-order assertions)

**Test style:** pure unit tests, no chrome mocks, no providers ("ExecutorService.test.ts style" — OutcomeVerifier.test.ts:9-13). Build minimal `ContextOptimizerInput` fixtures inline; script degradation by sizing section text.

**Input-builder pattern** (OutcomeVerifier.test.ts:23-32 — an overrides-merge builder keeps fixtures minimal):
```typescript
/** Input-builder mirroring ExecutorService.test.ts (D-67 injected-result seam). */
function toolResult(overrides: Partial<ToolExecutionResult> = {}): ToolExecutionResult {
  return {
    toolName: 'fake_tool',
    ok: true,
    data: null,
    error: null,
    durationMs: 10,
    ...overrides,
  };
}
```

**Canonical-order assertion pattern** (PromptCacheManager.test.ts:36-47):
```typescript
expect(result.sections.map((s) => s.kind)).toEqual([
  'SYSTEM',
  'TOOL SCHEMAS',
  'USER PREFERENCES',
  'TASK',
  'USER INPUT',
]);
// Only [SYSTEM] + [TOOL SCHEMAS] are cache-eligible (§1.3).
expect(result.sections.filter((s) => s.stable).map((s) => s.kind)).toEqual([
  'SYSTEM',
  'TOOL SCHEMAS',
]);
```

**Required coverage (RESEARCH Validation map):** §2.4 degradation order observable step-by-step; overflow never returns an oversized context (totalTokens ≤ inputBudget); `CONTEXT_TOO_LARGE` terminal RETURNED never thrown, message present; `isFeatureAllowedInMinimalMode` asserts §2.5 blocked/allowed lists verbatim; tiny tier → minimalMode always true; minimal mode is penultimate degradation step; every OptimizedContext carries a §2.6-verbatim manifest; `truncatedSources` derived from manifest truncated sections; ContextPack §1.3 order + totalTokens = Σ section tokens (exercised through assemble).

---

### `tests/core/context/ContextCompressor.test.ts` (test, N/A)

**Analog:** `tests/core/ai/trajectory/TrajectoryTracker.test.ts` (lines 22-41 — pure closed-state module tests) — **exact**

**Test style:** dependency-free pure module tests; assert closed-union completeness and strategy behavior on crafted A8 section fixtures.

**Closed-union assertion pattern** (TrajectoryTracker.test.ts:64-81 — assert closed-set completeness verbatim):
```typescript
it("closed-machine completeness: all 10 C.1 phases exist as keys; ...", () => {
  expect(Object.keys(TRAJECTORY_TRANSITIONS)).toHaveLength(10);
  expect(TRAJECTORY_TRANSITIONS['waiting-for-permission']).toEqual([...]);
});
```

**Required coverage (D-75):** structural / top-k / tool-trim strategies pure and return expected section transforms; summarizer seam present — no summarizer supplied → older turns dropped and recorded as truncation (never silence); `compressionApplied` type recorded per section.

---

### `tests/core/context/TokenBudget.test.ts` (test, N/A)

**Analog:** `tests/core/ai/PromptCacheManager.test.ts` (lines 19-77 — deterministic math/state assertions)

**Test style:** pure math tests; no mocks needed (context modules are pure — `tests/setup.ts` mocks exist but are unused).

**Required coverage (DONE-1):** tier boundary fixtures verbatim — 4096→tiny, 4097→small, 16384→small, 16385→medium, 131072→medium, 131073→large, 200000→large; budget formula 70/20/10; each tier's dynamic distribution sums to 100; heuristic counter `ceil(len/4)` English / `ceil(len/3)` CJK with density threshold; supplementary-plane char counts as 1 (code-point-aware, Pitfall 7); English-heavy text with stray CJK token stays len/4 (Pitfall 8).

---

### `package.json` (config, N/A — D-78)

**Analog:** itself — `04-PATTERNS.md:358-360` (D-68 re-point template); `verify:phase-4` (line 21) is the working example.

**D-78 re-point (package.json line 23 — CURRENT VALUE, verified):**
```json
"verify:phase-5": "tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts",
```
becomes (spec §18 canonical, spec 3609):
```json
"verify:phase-5": "tsc --noEmit && vitest run tests/core/context",
```
The D-68 template (04-PATTERNS.md:358-361): `"verify:phase-4": "tsc --noEmit && vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai"`. Gate is currently RED (`No test files found, exiting with code 1`, verified by research run) — the re-point plus the three §18 test files make it GREEN.

---

## Shared Patterns

### Closed unions / Zod schemas for every cross-boundary shape
**Source:** `src/core/ai/types.ts:27-28` (`ModelTierSchema` z.enum), `:38-50` (`PlannerDecisionSchema` z.discriminatedUnion), `:95-101` (`PromptSectionSchema` z.object)
**Apply to:** `ModelContextTier.ts` (tier union), `ContextProvenanceManifest.ts` (manifest schema), `ContextOptimizer.ts` (AssembleResult union), `ContextCompressor.ts` (CompressionType union), `types.ts` (FeatureName union)
```typescript
export const ModelTierSchema = z.enum(['fast', 'balanced']);
export type ModelTier = z.infer<typeof ModelTierSchema>;
```
CLAUDE.md convention: "All cross-boundary data uses Zod validation". Do NOT mint new error codes — `CONTEXT_TOO_LARGE` already exists in the §21.6 closed set; `StreamErrorCodeSchema` (types.ts:55-64) stays untouched (D-38).

### Pure, UI-agnostic core modules
**Source:** `src/core/ai/*` (PlannerService.ts, trajectory.ts, PromptCacheManager.ts)
**Apply to:** all six `src/core/context/` modules + types.ts
- Zero React imports, zero chrome API imports, zero storage access (ARCHITECTURE.md:70 convention).
- New code strict-clean: zero `@ts-expect-error NP-STRICT` markers (STATE.md decision 17; Pitfall 10 — the D-78 gate runs `tsc --noEmit` first).

### Declare-now / populate-later seams
**Source:** `src/core/ai/PlannerService.ts:47` (injected `callProviderJsonMode`), `src/core/ai/UserPreferences.ts:1-6` (supersession point), Phase-3 `toolSchemas.ts` ToolRegistry (D-46)
**Apply to:** `TokenBudget.ts` (`TokenCounter` seam, D-71), `ContextCompressor.ts` (`Summarizer` seam, D-75), `types.ts` (minimal PageContext/RetrievedMemory/ToolSchemaRef with supersession comments)
- Interface + contract ship now; real implementation arrives with the owning phase. Each supersession point carries the explicit comment naming the owning phase.

### Section assembly + stable-first fidelity
**Source:** `src/core/ai/PromptCacheManager.ts:114-130` (canonical order + stable/tokens tags), `src/core/ai/PromptCacheAdapter.ts:77-80` (stableFirst sort — cache-adaptation, NOT canonical order)
**Apply to:** `ContextPack.ts` (hard-coded §1.3 order via kind→index table), `ContextOptimizer.ts` (uppercase-spaced section kinds only)
- Ordering IS the caching contract (`hashStableSections` FNV-1a over stable text, PromptCacheAdapter.ts:83-96); breaking §1.3 order breaks prompt-cache hits (Pitfall 4).

### Manifest-derived truncation trace
**Source:** D-77 (05-CONTEXT.md); §19.3 spec 2999-3004
**Apply to:** `ContextOptimizer.ts` (trace surface on OptimizedContext), `ContextProvenanceManifest.ts` (truncated flags)
- `truncatedSources` = manifest truncated section sourceIds — the single provenance record; never silent truncation (Pitfall 9). Phase 11 lifts into `PromptTrace`.

### Returned typed results, not throws
**Source:** codebase precedent (configuration-required/aborted outcomes), research Pattern 1; §2.4 "return a typed CONTEXT_TOO_LARGE error"
**Apply to:** `ContextOptimizer.assemble` (`AssembleResult` discriminated union)
- Callers compile-time-forced to handle the terminal; a throw would hide it from the type system and break the "never sends an oversized prompt" spine (roadmap SC#2).

## No Analog Found

None — all 11 files have at least a role-match analog. The phase's contract shapes (classifyModelContext, budget formula, §2.4 ladder, §2.5 lists, §2.6 manifest) are spec-verbatim and are sourced from `.planning/PRODUCT_SPEC_v0_1.md` §2.1-§2.6 (quoted in 05-RESEARCH.md Common Operations 1-6) rather than from codebase analogs.

## Metadata

**Analog search scope:** `src/core/ai/` (types.ts, PlannerService.ts, trajectory.ts, PromptCacheManager.ts, PromptCacheAdapter.ts, UserPreferences.ts), `tests/core/ai/` (OutcomeVerifier.test.ts, PromptCacheManager.test.ts, TierResolver.test.ts, trajectory/TrajectoryTracker.test.ts, fixtures/FixtureProvider.ts), `src/core/runtime/OperationId.ts`, `package.json`, `.planning/phases/04-agent-reliability-and-evidence/04-PATTERNS.md`
**Files scanned:** 15 (11 analogs + 4 context/spec sources)
**Pattern extraction date:** 2026-08-29