# Phase 4: Context-Adaptive Execution — Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 24 (5 core-context create/extend + 1 deletion + 4 core-ai modify + 2 surface/config modify + 4 test-create + 3 test-modify + 1 fixture-extend + 4 doc/config)
**Analogs found:** 21 / 24 — every MODIFY target IS its own analog (current implementation is the pattern to preserve/rewire); `TokenBudget`/`ContextPack`/`ContextOptimizer` migrate from the `contextHelper` deletion target; `ContextCompressor` and the four new test suites are spec-verbatim + style analogs.

**Core principle:** this phase is a **drop-in replacement** (D-04-07): output `OptimizedContext` shape stays §2.3-identical, only the INPUT changes (resolved model window). Every MODIFY must preserve the existing contract (typed error carriers, `debugLog` Golden Rule 9, F-4 sections-in, F-5 byte-stable `[SYSTEM]`, `maxRetries: 0` untouched) and only rewire the mechanism. Every NEW module either **migrates code from `contextHelper.ts`** (the deletion target, D-04-08) or is **spec-verbatim** (§2.1–§2.6, lines 412–534 of PRODUCT_SPEC_v0_1.md) — copy, do not re-derive. R-1: seeded homes (`ModelContextTier.ts`, `ContextProvenanceManifest.ts`, `src/core/ai/types.ts`) are extended IN PLACE, never re-declared.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/context/ModelContextTier.ts` (EXTEND) | types + utility (canonical map) | transform (sync lookup) | itself (14-line seed) + `TierResolver.ts` `TIER_TO_MODEL_CANDIDATES` canonical map (L19-31) | exact (self) |
| `src/core/context/ContextProvenanceManifest.ts` (EXTEND) | types (R-1 home) | n/a (declarations) | itself (30-line seed) + `src/core/ai/types.ts` `ProviderConfigSchema` co-location (L89-103) | exact (self) |
| `src/core/context/TokenBudget.ts` (NEW) | utility (budget math + counter) | transform (pure, deterministic) | `contextHelper.ts` `estimateTokens` (L28-30) + spec §2.2 (L435-451) | exact (migration seed) |
| `src/core/context/ContextPack.ts` (NEW) | utility (section packing) | transform | `contextHelper.ts` `buildOptimizedContext` section assembly (L59-108) | exact (migration seed) |
| `src/core/context/ContextOptimizer.ts` (NEW) | service (orchestrator of context build) | transform + terminal throw | `contextHelper.ts` `buildOptimizedContext` (whole) + `StructuredOutput.ts` typed-error precedent (L72-83, L150-154) | exact (migration seed) |
| `src/core/context/ContextCompressor.ts` (NEW) | service (degradation primitives) | transform (section-granular) | spec §2.4 ladder (L453-460) verbatim; style analog `contextHelper.ts` (pure section ops, no model calls) | spec-authoritative |
| `src/core/ai/contextHelper.ts` (DELETE) | utility | — | itself is the deletion target (D-02/D-04-08) | exact (self) |
| `src/core/ai/AgentOrchestrator.ts` (MODIFY) | controller (bounded loop) | request-response + streaming | itself (`AgentTurnInput` seams L82-118, `estimateTokens` import L33 + usage L278, `TIER_CAPS` L50-55) | exact (self) |
| `src/core/ai/ProviderRouter.ts` (MODIFY) | service (router) | request-response | itself (`StageInvocation` L119-124, `buildInvocation` L582-599, `createStageInvocation` L413-497) | exact (self) |
| `src/components/pages/useStreamingLLM.ts` (MODIFY) | hook (D-01 co-located) | streaming | itself (`buildOptimizedContext` call L131-141, `StageResolver` closure L144-151, error mapping L186-207) | exact (self) |
| `src/core/prompts/index.ts` (MODIFY) | config (Appendix A constants) | n/a (constants) | itself (`PROMPTS` shape L5-73 — planner.system/renderer.system L6-17) | exact (self) |
| `src/core/error/errorCodes.ts` (MODIFY) | config (canonical registry) | n/a | itself (Phase-3 block pattern L63-80; harness block L73-86) | exact (self) |
| `src/core/i18n/strings.ts` (MODIFY) | config (STR copy) | n/a | itself (`chat.*` block L7-24 — `contextReduced` L12 precedent) | exact (self) |
| `tests/core/context/TokenBudget.test.ts` (NEW) | test | — | `tests/core/ai/AgentOrchestrator.budget.test.ts` (pure-math assertions) + `tests/fixtures/optimizedContext.ts` determinism | partial (compose) |
| `tests/core/context/ContextOptimizer.test.ts` (NEW) | test | — | `tests/core/ai/AgentOrchestrator.test.ts` (vi.mock + baseInput builder L92-102) | partial (compose) |
| `tests/core/context/ContextCompressor.test.ts` (NEW) | test | — | same test-style analog as ContextOptimizer.test.ts | partial (compose) |
| `tests/core/context/ContextProvenanceManifest.test.ts` (NEW) | test | — | RESEARCH D-04-18 lockstep-guard snippet; style analog `src/core/ai/types.ts` Zod schema tests | partial (compose) |
| `tests/fixtures/optimizedContext.ts` (EXTEND) | test fixture | — | itself (builder L74-165, `TIER_BUDGETS` L62-67, determinism header L1-12) | exact (self) |
| `tests/core/ai/AgentOrchestrator.test.ts` (MODIFY) | test | — | itself (`stageInvocation()` fixture L55-63 — gains `modelContextWindow`) | exact (self) |
| `tests/core/ai/AgentOrchestrator.budget.test.ts` (MODIFY) | test | — | itself (same fixture shape) | exact (self) |
| `tests/components/pages/useStreamingLLM.test.tsx` (MODIFY) | test | — | itself (hoisted `createStageInvocation` mock L19-39 — gains window) | exact (self) |
| `package.json` (MODIFY) | config (verify script) | — | `verify:phase-3a` script (L22) — same §24 chain + isolation check | exact (self) |
| `.planning/REQUIREMENTS.md` (UPDATE) | doc | — | AI-07 re-map note (L44) + AGT-02/05 notes (L56-58) — D-04-01 | exact (precedent) |
| `PRODUCT_SPEC_v0_1.md` (UPDATE) | doc (canonical spec) | — | spec Appendix A (L4072) addendum + C.2 (L3512/L5040) + B (L4139) — W-1 gate | exact (precedent) |

---

## Pattern Assignments

### `src/core/context/ModelContextTier.ts` (types + utility, EXTEND IN PLACE) — MODEL_CONTEXT_WINDOWS + resolveModelContextWindow

**Analog:** itself (the P-3b seed) + `TierResolver.ts` `TIER_TO_MODEL_CANDIDATES` (the canonical static map precedent).

**Current seed (entirety, lines 1-14) — R-1 home; extend, never re-declare:**
```typescript
// src/core/context/ModelContextTier.ts — Source: PRODUCT_SPEC §2.1 ...
export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096) return 'tiny';
  if (contextWindow <= 16384) return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}
```

**Canonical static-map precedent (source for the `MODEL_CONTEXT_WINDOWS` style)** — `src/core/ai/TierResolver.ts` L19-31:
```typescript
export const TIER_TO_MODEL_CANDIDATES: Record<ModelTier, TierCandidate[]> = {
  haiku: [
    { providerId: 'anthropic', model: 'claude-haiku-4-latest' },
    { providerId: 'openai', model: 'deepseek-chat' },
    { providerId: 'ollama', model: 'llama3.2:3b' },
  ],
  flash: [ ... ],
} as const;
```

**Planner notes (RESEARCH A1, D-04-06):** add `MODEL_CONTEXT_WINDOWS: Readonly<Record<string, number>>` keyed by modelId (the six Appendix-D candidates; values [ASSUMED] A2–A6 — gate behind user confirmation) + `resolveModelContextWindow(modelId)` returning `{ contextWindow, windowKnown }`, unknown → `{ 4096, false }` (conservative tiny, never large). Values from RESEARCH L341-358 (verifiable snippet). Deterministic, synchronous — zero model calls (through-line).

---

### `src/core/context/ContextProvenanceManifest.ts` (types, EXTEND IN PLACE) — D-04-17 fields + co-located Zod schema

**Analog:** itself (the P-3b seed) + `ProviderConfigSchema` co-location precedent in `src/core/ai/types.ts` L89-103.

**Current seed (lines 7-30) — add the D-04-17 fields (tier, model, window, counterMethod, stepsFired) + `ContextProvenanceManifestSchema` co-located below the interface (GR-4):**
```typescript
export interface ContextProvenanceManifest {
  sections: Array<{
    kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input' | 'tool_result';
    sourceId: string;
    tokens: number;
    truncated: boolean;
    compressionApplied?: 'summarise' | 'structural' | 'topk';
  }>;
  totalTokens: number;
  minimalMode: boolean;
  workspaceId: string; // NEW in v0.1
  activeSurface: 'sidepanel' | 'standalone'; // NEW in v0.1
}
```

**Co-located Zod boundary-schema precedent (the exact pattern to mirror)** — `src/core/ai/types.ts` L89-103:
```typescript
export const ProviderConfigSchema = z.object({
  id: z.enum(['openai', 'anthropic', 'gemini', 'ollama']),
  label: z.string().min(1),
  ...
});
export type ProviderConfigInput = z.infer<typeof ProviderConfigSchema>;
```

**Planner notes:** `manifest.sections[].kind` MUST mirror `PromptSection['kind']` (D-04-18 — 03a-01 precedent, includes `'tool_result'`); the lockstep guard is a runtime union-member parity test (RESEARCH L361-378) — do NOT derive the manifest kind union from a second declaration.

---

### `src/core/context/TokenBudget.ts` (utility, NEW) — estimateTokens + computeBudgets + per-section caps

**Analog:** `contextHelper.ts` L28-30 (`estimateTokens` — THE migration source) + spec §2.2 (L435-451) + RESEARCH L313-331/380-395 (verified snippets).

**Migration seed (contextHelper.ts L27-30 — move, don't rewrite; extend per D-04-10 CJK rule):**
```typescript
/** Phase-3 seed token estimate: ~4 chars per token (English), pure + deterministic. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

**D-04-10 script-aware extension (RESEARCH L319-330, verified snippet — the CJK ratio heuristic):**
```typescript
const CJK_RE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  let cjk = 0;
  for (let i = 0; i < text.length; i++) {
    if (CJK_RE.test(text[i])) cjk++;
  }
  const divisor = cjk / text.length >= 0.3 ? 3 : 4; // mixed → higher-cost divisor
  return Math.ceil(text.length / divisor);
}
```

**§2.2 formula (spec L435-439 verbatim; RESEARCH L383-389):**
```typescript
export function computeBudgets(contextWindow: number) {
  return {
    inputBudget: Math.floor(contextWindow * 0.70),
    outputBudget: Math.floor(contextWindow * 0.20),
    safetyMargin: Math.floor(contextWindow * 0.10),
  };
}
```

**Planner notes (Pitfall 3, RESEARCH A9/A10):** per-section caps = distribution% × inputBudget from the §2.2 table (spec L444-449); canonical column→kind mapping (System→system+preferences, Tools→tool_schemas, Memory→memory, Context→context, History→reserved-unfilled D-04-16, User→user_input+task) encoded as a TESTED constant. Caps DRIVE degradation — never hard truncation (D-04-13). No custom tokenizer (P4-13).

---

### `src/core/context/ContextPack.ts` (utility, NEW) — §1.3 section packing

**Analog:** `contextHelper.ts` `buildOptimizedContext` section assembly (L59-108) — THE migration source.

**Migration seed (contextHelper.ts L48-51 + L59-88 — the packing shape: §1.3 canonical order, stability flags, sourceIds, token counts):**
```typescript
/** Deterministic §1.3 tool-schemas text (fixed field order — Pitfall 5). */
function buildToolSchemasText(refs: readonly ToolSchemaRef[]): string {
  return refs.map((t) => `${t.name}: ${t.description}`).join('\n');
}

export function buildOptimizedContext(input: ContextHelperInput): OptimizedContext {
  const sections: PromptSection[] = [
    { kind: 'system', text: input.personaBlock, tokens: estimateTokens(input.personaBlock), stable: true, sourceId: 'system' },
  ];
  if (input.toolSchemaRefs.length > 0) {
    const schemasText = buildToolSchemasText(input.toolSchemaRefs);
    sections.push({ kind: 'tool_schemas', text: schemasText, tokens: estimateTokens(schemasText), stable: true, sourceId: 'tool-schemas' });
  }
  sections.push({ kind: 'user_input', text: input.userInput, tokens: estimateTokens(input.userInput), stable: false, sourceId: 'user-input' });
  ...
}
```

**Critical invariants to carry over (from the contextHelper header, L14-22):**
- §1.3 canonical order: `[SYSTEM cached] [TOOL SCHEMAS cached] [PREFERENCES] [MEMORY] [CONTEXT] [TASK] [USER INPUT current]` (fixture L89-141 shows the full 7-kind order).
- `stable: true` = cache-eligible kinds (`system`, `tool_schemas`, `preferences`, `memory` — `CACHED_KINDS` in ProviderRouter.ts L65-70); `stable: false` = `context`/`task`/`user_input`/`tool_result` (`TASK_KINDS` L77-82).
- **Counting is READ-ONLY** (D-04-09): never rewrite the byte-stable persona block text — F-5 cache hits depend on byte-stability (P4-8).

**Planner notes (RESEARCH Open Q4):** ContextPack = pure section-packing (order, stability flags, sourceIds, text joins) that ContextOptimizer consumes — the natural home for the migrated packing logic. Returns `PromptSection[]`, never a joined string (F-4).

---

### `src/core/context/ContextOptimizer.ts` (service, NEW) — optimize() + ladder + minimal mode + manifest stamping + typed terminal

**Analog:** `contextHelper.ts` `buildOptimizedContext` (whole-file migration source) + `StructuredOutput.ts` typed-error-carrier precedent (L72-83, L150-154).

**The drop-in signature (spec §2.3 L449-465 — `ContextOptimizerInput`/`OptimizedContext` already live in `src/core/ai/types.ts` L150-171; import, never re-declare, R-1):**
```typescript
// src/core/ai/types.ts L150-171 — the canonical contract ContextOptimizer implements:
export interface ContextOptimizerInput {
  operationId: string;
  model: string;
  modelContextWindow: number;   // ← the ONLY input change (D-04-07)
  userInput: string;
  conversationId: string;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'standalone';
  pageContext?: PageContext;
  selectedToolSchemas: ToolSchemaRef[];
  memoryHints: RetrievedMemory[];
  preferences: UserPreferences;
}
export interface OptimizedContext { tier; inputBudget; outputBudget; sections; provenance; minimalMode; }
```

**Typed terminal-error precedent (StructuredOutput.ts L72-83 — the exact carrier pattern for `ContextTooLargeError`, RESEARCH L222-230):**
```typescript
export interface StructuredOutputFailedError extends Error {
  code: 'STRUCTURED_OUTPUT_FAILED';
  retryable: false;
  raw: { first: string; second: string };
}
export function isStructuredOutputFailed(err: unknown): err is StructuredOutputFailedError {
  return (
    err instanceof Error && (err as StructuredOutputFailedError).code === 'STRUCTURED_OUTPUT_FAILED'
  );
}
// throw site (L150-154): const err = new Error('STRUCTURED_OUTPUT_FAILED') as StructuredOutputFailedError;
// err.code = 'STRUCTURED_OUTPUT_FAILED'; ... throw err;
```

**Manifest stamping seed (contextHelper.ts L95-106 — the provenance build ContextOptimizer extends with D-04-17 fields):**
```typescript
provenance: {
  sections: sections.map((s) => ({
    kind: s.kind, sourceId: s.sourceId, tokens: s.tokens,
    truncated: false, // Phase-3 seed: small by construction; degradation is Phase 4
  })),
  totalTokens,
  minimalMode,
  workspaceId: input.workspaceId,
  activeSurface: input.activeSurface,
},
```

**Planner notes:**
- Pipeline: `classifyModelContext(window)` (ModelContextTier) → `TokenBudget.computeBudgets(window)` → `ContextPack` packs sections → per-section caps exceeded? → `ContextCompressor` ladder §2.4 order (D-04-12: drop debug → drop secondary → summarise → compress → trim tools → reduce top-k → minimal mode → CONTEXT_TOO_LARGE) → stamp `ContextProvenanceManifest` (Zod-validated, GR-4) → return `OptimizedContext` (drop-in) OR throw typed `ContextTooLargeError` (code `CONTEXT_TOO_LARGE`, canonicalized into spec C.2 first — W-1 gate).
- Only drop-debug, trim-tool-schemas, and minimal mode do REAL work in P4 (D-04-12); notes/memory/pageContext/history steps are structurally-present no-ops.
- Minimal mode (D-04-14): entered when tier==tiny (mandatory §2.5) OR ladder-escalated; selects the compact prompts (from `src/core/prompts/index.ts`), ≤1 safe tool schema, reduced non-system sections.
- Section-granularity only — never `.slice()`/`.substring()` on `PromptSection.text` (D-04-13; grep-gate Pitfall 4).
- Every catch calls `debugLog(code, …)` with a canonical C.2 code (GR-9).

---

### `src/core/context/ContextCompressor.ts` (service, NEW) — §2.4 section-level primitives

**Analog:** spec §2.4 ladder (L453-460) verbatim order; style analog `contextHelper.ts` (pure section operations, no model calls, no network).

**Spec §2.4 (L453-460) — the ladder order ContextCompressor implements as section-level primitives:**
```
- Drop debug-only context.
- Drop secondary notes and optional metadata.
- Summarise older history.
- Compress page/case context into structured fields.
- Trim tool schemas to the tools currently in scope.
- Reduce memory injection top-k.
- Enter minimal mode.
- If still too large, return a typed CONTEXT_TOO_LARGE error with a user-facing explanation.
```

**Planner notes (D-04-12/13/16):** each step is a **pure function over `PromptSection[]`** returning `{ sections, compressionApplied?, dropped }` — a section is dropped/compressed WHOLE, never truncated mid-structure. Steps whose inputs don't exist in P4 (notes/memory/pageContext/history) are structurally-present no-ops with `compressionApplied` markers, asserted in the ContextCompressor test (Pitfall 5). `History` slice is a budget-column reservation, NOT a new section kind (R-1/R-2, Pitfall 3). No model calls (through-line — summarisation steps are no-ops until Phase 7).

---

### `src/core/ai/ProviderRouter.ts` (MODIFY) — `StageInvocation` gains required `modelContextWindow`

**Analog:** itself.

**The seam (L119-124) — add `modelContextWindow: number` as a REQUIRED field (Pitfall 2 — optional silently degrades forever):**
```typescript
export interface StageInvocation {
  providerId: ProviderId;
  model: LanguageModel;
  jsonMode: JsonMode;
  callProviderJsonMode: CallProviderJsonMode;
  // D-04-04: REQUIRED — the resolved model's window from the canonical map
  // (ModelContextTier.resolveModelContextWindow), stamped in buildInvocation.
  modelContextWindow: number;
}
```

**The stamp site (buildInvocation, L582-599 — resolve via the canonical map, never the SDK/network):**
```typescript
private buildInvocation(
  input: CreateStageInvocationInput,
  cand: { providerId: ProviderId; model: string },
): StageInvocation {
  const providerId = cand.providerId;
  const jsonMode = jsonModeForProvider(providerId);
  const model = (input.getModel ?? getAISDKModel)(providerId, cand.model, ...);
  return {
    providerId,
    model,
    jsonMode,
    modelContextWindow: resolveModelContextWindow(cand.model).contextWindow, // D-04-04/06
    callProviderJsonMode: this.buildCallProviderJsonMode(input, cand, model, jsonMode),
  };
}
```

**Planner notes:** import `resolveModelContextWindow` from `@/core/context/ModelContextTier` (R-1 home). `createStageInvocation` (L413-497) itself is untouched except the fixture updates below. The `unavailable()` typed-error helper (L327-340) and `ProviderUnavailableError` (L309-325) are the pattern for `ContextTooLargeError` shape consistency (see Shared Patterns).

---

### `src/core/ai/AgentOrchestrator.ts` (MODIFY) — `contextForStage` input seam + estimateTokens import swap

**Analog:** itself.

**Input-only seam precedent (the exact pattern `contextForStage` mirrors — AgentTurnInput L82-118):**
```typescript
export interface AgentTurnInput {
  operationId: string;
  userInput: string;
  context: OptimizedContext;
  abortSignal: AbortSignal;
  tier: TurnCaps;
  onStreamDelta?: (delta: string) => void;      // input-only streaming seam
  invocation?: StageResolver;                   // input-only stage resolver seam
  onTransition?: (state: AgentTrajectoryState) => void; // input-only trajectory seam
  onInputRequired?: (q: {...}) => void;         // input-only pause seam
  verifiers?: Record<string, Verifier>;
}
```

**D-04-05 additive seam (RESEARCH Pattern 1, L205-216 — defaults keep every existing call site green):**
```typescript
// ADD to AgentTurnInput (after `invocation`, L92):
/** D-04-05 input-only seam: per-stage OptimizedContext (planner loop / renderer finish). */
contextForStage?: (stage: 'planner' | 'renderer') => OptimizedContext;
// planOnce (L388-393):  const ctx = input.contextForStage ? input.contextForStage('planner') : input.context;
// finish → RendererService.render (L337-348): the renderer context resolves the same way.
```

**Import swap (L33 — the ONLY other `estimateTokens` consumer; do this BEFORE the deletion commit, Pitfall 1):**
```typescript
// OLD: import { estimateTokens } from '@/core/ai/contextHelper';  (L33)
// NEW: import { estimateTokens } from '@/core/context/TokenBudget';
// Usage site L274-281 (replan-feedback tool_result section) stays untouched:
replanSections.push({
  kind: 'tool_result',
  text: feedbackText,
  tokens: estimateTokens(feedbackText),   // ← re-pointed import
  stable: false,
  sourceId: 'replan-feedback',
});
```

**Planner notes:** `TIER_CAPS` (L50-55) + `capsForTier` (L58-60) stay untouched — the hook computes loop caps from the planner-stage tier (D-04-05) by passing `capsForTier(plannerContext.tier)`. Minimal mode reuses `TIER_CAPS.mcpChaining: false` (tiny/small already false, D-04-14) — no new runtime gate.

---

### `src/components/pages/useStreamingLLM.ts` (MODIFY) — the ONE behavioral-change surface (D-04-07)

**Analog:** itself.

**The rewire (replace L131-141 — hardcoded medium/16K/1K defaults → per-stage optimizer calls):**
```typescript
// OLD (L131-141): the Phase-3 hardcoded budget path — DELETE with contextHelper:
const context = buildOptimizedContext({
  operationId, tier: DEFAULT_CONTEXT_TIER, inputBudget: DEFAULT_INPUT_BUDGET,
  outputBudget: DEFAULT_OUTPUT_BUDGET, userInput: trimmed, personaBlock,
  toolSchemaRefs: [], workspaceId, activeSurface,
});
// NEW (D-04-04): resolve both stages upfront → read the window from each
// StageInvocation → run the optimizer per stage. DEFAULT_CONTEXT_TIER becomes a
// PRE-RESOLUTION FALLBACK ONLY (never the primary source — D-04-04).
```

**The StageResolver closure (L144-151) — the window now rides `createStageInvocation`'s return (keep this shape, add per-stage optimizer calls):**
```typescript
const invocation: StageResolver = (stage) =>
  getProviderRouter().createStageInvocation({
    operationId,
    tier: (stage === 'planner' ? 'haiku' : 'flash') as ModelTier,
    privacyMode: privacyModeFromPrefs(prefs),
    maxTokens: stage === 'planner' ? PLANNER_MAX_TOKENS : RENDERER_MAX_TOKENS,
    configuredProviders: configuredFromRegistry(),
  });
```

**CONTEXT_TOO_LARGE mapping (D-04-15 — extend the existing error mapping L186-207; the STR copy precedent is `chat.contextReduced` at strings.ts L12):**
```typescript
// in the catch (after classifyProviderError, ~L195):
if (isContextTooLargeError(e)) {
  // D-04-15 honest terminal: NEVER silently truncate user input (P4-10).
  setState({ state: 'failed', operationId });   // + new STR.chat.messageTooLong surface
  return;
}
```

**Planner notes (Golden Rule 3 / Pitfall 7):** the hook imports `ContextOptimizer` + `TokenBudget` + `PROMPTS` never — it NEVER assembles a prompt or computes budget math; compact prompt text lives only in `src/core/prompts/index.ts` (D-04-11). `conversationId` uses a constant (`'default'`) in P4 (RESEARCH A11). The `DEFAULT_CONTEXT_TIER`/`DEFAULT_INPUT_BUDGET`/`DEFAULT_OUTPUT_BUDGET` constants (L45-48) become the pre-resolution fallback.

---

### `src/core/prompts/index.ts` (MODIFY) — compact prompt constants (D-04-11)

**Analog:** itself (the `PROMPTS` structure).

**Current constant pattern (L6-17) — add `planner.compact`/`renderer.compact` siblings in the same shape (verbatim Appendix A style; cacheable: true; tier: 'haiku'/'flash'):**
```typescript
export const PROMPTS = {
  planner: {
    system:
      'Select exactly one action: answer, run_tool, or ask_clarification. Return JSON only. Do not explain.',
    cacheable: true,
    tier: 'haiku',
  },
  renderer: {
    system:
      'Answer using only the provided context and tool result. Be concise. If data is missing, say what is missing. Do not invent facts.',
    cacheable: true,
    tier: 'flash',
  },
  ...
} as const;
```

**Planner notes:** D-04-11 — canonical per-role COMPACT system prompt constants (planner/renderer), selected by `ContextOptimizer` when minimalMode; text follows Appendix A verbatim style (researcher/planner drafts per the agent's-discretion). Default path stays byte-identical (Open Q2 — do NOT wire the canonical prompts into the default path in P4; that kills the drop-in/cache-stability constraint).

---

### `src/core/error/errorCodes.ts` (MODIFY) — CONTEXT_TOO_LARGE (IN PLACE)

**Analog:** itself (the canonical registry, Golden Rule 9).

**Extend IN PLACE (mirror the Phase-3 block pattern L63-80 — new Phase-4 block):**
```typescript
// --- Context optimization (Phase 4, canonical additions — spec Appendix C.2
// L3512/L5040 CONTEXT_TOO_LARGE; W-1 gate: canonicalized into the spec BEFORE shipping).
CONTEXT_TOO_LARGE: 'CONTEXT_TOO_LARGE',
```

**Planner notes:** mirror spec C.2 verbatim; the W-1 gate (scoped-regex verify) asserts the `/^CONTEXT_TOO_LARGE$/m` line inside the spec C.2 slice (03-01 precedent). Never free-form strings.

---

### `src/core/i18n/strings.ts` (MODIFY) — chat.messageTooLong STR copy (D-04-15)

**Analog:** itself (the `chat.*` block, Appendix B verbatim).

**Copy contract precedent (L7-24) — add `messageTooLong` beside `contextReduced` (L12), VERBATIM (Copywriting Contract — planner drafts, never paraphrase):**
```typescript
export const STR = {
  chat: {
    loading: 'Connecting to provider...',
    empty: 'Start a conversation',
    errorRetry: 'Provider error. [Retry] [Switch Provider]',
    offline: 'No network. Retrying when back online.',
    contextReduced: 'Some context was compressed to fit the selected model.',
    // Phase-4 canonical addition (D-04-15 honest CONTEXT_TOO_LARGE surface):
    messageTooLong: 'This message is too long for the selected model.', // ← verbatim draft
    ...
  },
  ...
} as const;
```

**Planner notes:** the exact string must also be added to spec Appendix B (W-1 mirror), same as prior STR additions.

---

### `tests/core/context/*.test.ts` (4 NEW) — TokenBudget / ContextOptimizer / ContextCompressor / ContextProvenanceManifest

**Analog:** `tests/core/ai/AgentOrchestrator.test.ts` (vi.mock + fixture-builder style) + `tests/fixtures/optimizedContext.ts` (determinism).

**Test-file skeleton precedent (AgentOrchestrator.test.ts L20-43 — header-doc contract + vi.mock + builder helpers):**
```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';
// header: a comment block declaring the contract under test (see L1-19 precedent)
```

**The lockstep guard (RESEARCH L361-378, D-04-18 — manifest kind union mirrors PromptSection kind union):**
```typescript
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

**Planner notes (Validation Architecture):** run `pnpm vitest run tests/core/context -x`. Deterministic — no `Date.now`/`crypto` (fixtures/index.ts determinism rule). Required per §18: ContextOptimizer / ContextCompressor / TokenBudget tests (DONE-when). Every optimizer test drives the extended D-08 fixture (P4-15).

---

### `tests/fixtures/optimizedContext.ts` (EXTEND) — window set / over-budget / CJK+mixed samples (P4-15, WR-13)

**Analog:** itself.

**The builder + TIER_BUDGETS (L62-67, L74-165) — extend, never duplicate:**
```typescript
/** Default budgets per tier (edge-parameterized on tier). */
const TIER_BUDGETS: Record<ModelContextTier, { input: number; output: number }> = {
  tiny: { input: 1024, output: 256 },
  small: { input: 4096, output: 512 },
  medium: { input: 16384, output: 1024 },
  large: { input: 65536, output: 2048 },
};
```

**Planner notes (P4-15):** add to this fixture (not a new file): (a) a `FIXED_MODEL_CONTEXT_WINDOWS` set keyed by the six Appendix-D models; (b) over-budget section samples (token counts that exceed per-section caps — ladder trigger material); (c) CJK + mixed-script samples for the `estimateTokens` heuristic. Determinism header (L1-12) stays. The fixture's `TIER_BUDGETS` will likely be superseded by `TokenBudget.computeBudgets` in tests — keep the fixture's budgets for the drop-in-identity regression (D-04-07).

---

### `tests/core/ai/AgentOrchestrator.test.ts` / `.budget.test.ts` / `tests/components/pages/useStreamingLLM.test.tsx` (MODIFY) — mechanical `modelContextWindow` fixture updates

**Analog:** each file itself.

**The fixture builder to update (AgentOrchestrator.test.ts L55-63 — REQUIRED field, Pitfall 2 — the compiler does the inventory for you):**
```typescript
function stageInvocation(overrides: Partial<StageInvocation> = {}): StageInvocation {
  return {
    providerId: 'openai',
    model: fakeModel,
    jsonMode: 'native',
    callProviderJsonMode: vi.fn(async () => '{}'),
    modelContextWindow: 200_000,   // ← D-04-04: required; deterministic window
    ...overrides,
  };
}
```

**The hoisted mock to update (useStreamingLLM.test.tsx L19-26 — gains the window on the mock return):**
```typescript
const createStageInvocation = vi.fn((input: { tier?: string; maxTokens?: number }) => ({
  providerId: 'anthropic',
  model: { modelId: 'claude-3-5-haiku-latest' },
  jsonMode: 'native',
  callProviderJsonMode: vi.fn(async () => '{}'),
  modelContextWindow: 200_000,     // ← D-04-04 fixture window
  ...input,
}));
```

**Planner notes:** the `AgentOrchestrator.budget.test.ts` fixture mirrors AgentOrchestrator.test.ts L55-63. Existing tests stay green because `contextForStage` DEFAULTS to `() => input.context` (RESEARCH Pattern 1) — only the `StageInvocation` shape change is breaking, and it's mechanical.

---

### `package.json` (MODIFY) — verify:phase-4 script

**Analog:** `verify:phase-3a` (L22) — copy verbatim, rename:

```json
"verify:phase-4": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs",
```

---

### `.planning/REQUIREMENTS.md` (UPDATE) — D-04-01 AI-07-style re-map note

**Analog:** the AI-07 re-map note (L44) + the AGT-02/05 notes (L56-58) — same block-quote style, §18 stays authoritative:

```markdown
> **CTX-02 → typed input-only seam (D-04-02, 04):** "ContextUpdate events" = a typed
> input-only re-pack seam on the optimizer/runAgentTurn path (onStreamDelta precedent);
> NO consumer in P4 (page/state-change triggers land with Phase 4a/7). CTX-03 →
> minimal-mode compact-prompt selection (D-04-03): NOT a new prompting subsystem.
> §18 is authoritative over these rows — the Phase-4 CTX ids are DISAMBIGUATED from
> the spec §28.3 trust-aware CTX-01..06 namespace (Phase 4b).
```

---

### `PRODUCT_SPEC_v0_1.md` (UPDATE) — W-1 gate canonicalizations

**Analog:** spec Appendix A (L4072+), Appendix B (L4139+), Appendix C.2 (L3512/L5040). Three in-place additions: compact prompt constants (D-04-11, Appendix A), `CONTEXT_TOO_LARGE` (C.2 — already present at L3512/L5040, verified), `chat.messageTooLong` STR copy (D-04-15, Appendix B). All three are scoped-regex verified (W-1 gate, 03-01 precedent) — no new codes/strings outside the spec.

---

## Shared Patterns

### Typed Error Carrier (context-layer terminal + hook mapping)
**Sources:** `src/core/ai/StructuredOutput.ts` L72-83 + L150-154; `src/core/ai/ProviderRouter.ts` L309-325 + L327-340.
**Apply to:** `ContextOptimizer.ts` (throw `ContextTooLargeError`), `useStreamingLLM.ts` (catch + map).
```typescript
// Pattern: interface extends Error with literal `code` + guard fn + factory/throw-site.
export interface ProviderUnavailableError extends Error {
  code: 'PROVIDER_UNAVAILABLE';
  reason: ProviderUnavailableReason;
  providerId?: ProviderId;
  detail?: string;
}
export function isProviderUnconfiguredError(err: unknown): err is ProviderUnavailableError & {...} {
  return (err instanceof Error && (err as ProviderUnavailableError).code === 'PROVIDER_UNAVAILABLE' && ...);
}
// factory: const err = new Error(`CODE: ${reason}`) as T; err.code = 'CODE'; ... throw err;
```

### debugLog + canonical codes (Golden Rule 9)
**Source:** `src/core/error/debugLog.ts` L26-45; `src/core/error/errorCodes.ts` (extended with CONTEXT_TOO_LARGE).
**Apply to:** every catch in ContextOptimizer/ContextCompressor/TokenBudget/hook. Never log section text or user input (R-10); `extra` values route through `redactSensitive` (debugLog L34-38).

### Byte-stable [SYSTEM] cache invariant (P4-8, F-5)
**Source:** `contextHelper.ts` L14-22 (header contract) + `ProviderRouter.ts` `CACHED_KINDS` L65-70 + `applyCacheHints` (PromptCacheAdapter).
**Apply to:** `TokenBudget` counting (READ-ONLY over section text), `ContextPack` (stability flags), `ContextCompressor` (never rewrite `stable:true` section text). A byte change to the persona block kills anthropic prompt caching — the drop-in-identity regression test (D-04-07) pins this.

### Zod boundary validation (GR-4)
**Source:** `src/core/ai/types.ts` L89-103 (`ProviderConfigSchema` co-located with its interface).
**Apply to:** `ContextProvenanceManifest.ts` (co-located `ContextProvenanceManifestSchema`); `ContextOptimizer.ts` (validate the stamped manifest at the public boundary).

### Deterministic pure modules (no model calls, no network)
**Source:** `contextHelper.ts` (pure), `ModelContextTier.ts` (pure), `TierResolver.ts` (pure).
**Apply to:** ALL of `src/core/context/*` — the "2 calls / healthy turn" through-line depends on zero model calls in optimization. The canonical window map is synchronous — never `getModels()` (throwing stub, RESEARCH W-1).

## No Analog Found

Files with no close in-repo analog (planner should use RESEARCH.md + spec §2.1–§2.6 as the source):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/context/ContextCompressor.ts` | service | transform | No degradation machinery exists yet (Phase-3 `contextHelper` has a `minimalMode` flag but no ladder) — spec §2.4 verbatim + ContextOptimizer's no-op-step pattern |
| `tests/core/context/*.test.ts` (4) | test | — | `tests/core/context/` directory doesn't exist yet — compose from AgentOrchestrator.test.ts (vi.mock + builders) + fixtures determinism |
| `src/core/context/ContextOptimizer.ts` | service | transform | No orchestrator-level context builder exists (contextHelper is the seed — migration analog above) |

## Metadata

**Analog search scope:** `src/core/context/`, `src/core/ai/` (contextHelper, AgentOrchestrator, ProviderRouter, StructuredOutput, TierResolver, types), `src/components/pages/useStreamingLLM.ts`, `src/core/prompts/`, `src/core/error/`, `src/core/i18n/`, `src/core/memory/types.ts`, `tests/core/ai/`, `tests/components/pages/`, `tests/fixtures/`, `.planning/REQUIREMENTS.md`, `package.json`, spec §2.1–§2.6 (L412-534)
**Files scanned:** ~25 source/test/doc files
**Pattern extraction date:** 2026-08-12
