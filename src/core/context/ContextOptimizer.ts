// src/core/context/ContextOptimizer.ts — Wave-3 (04-04) §2.3 drop-in
// orchestrator (D-04-08 replacement for contextHelper.buildOptimizedContext —
// src/core/ai/contextHelper.ts is DELETED in 04-06; the hook swaps imports, the
// §2.3 output shape is untouched, Planner/Renderer stay import-swap-only
// consumers, D-04-07). Source: PRODUCT_SPEC §2.3 "ContextOptimizer Contract"
// (L453-477) + §2.4 degradation pipeline (L481-492) + §2.5 minimal mode
// (L494-514) + §2.6 provenance manifest (L516-534).
//
// Pipeline (per stage — the 04-05 window stamp feeds modelContextWindow):
//   classifyModelContext(window) → tier (D-04-04)
//   → TokenBudget.computeBudgets(window) → input/output budgets (§2.2)
//   → ContextPack.packSections → PromptSection[] (§1.3)
//   → totalTokens > inputBudget → §2.4 ladder in D-04-12 order
//   → ContextProvenanceManifest stamped + Zod-validated (D-04-17, GR-4)
//   → OptimizedContext (drop-in) OR typed CONTEXT_TOO_LARGE terminal (D-04-15).
//
// D-04-12 real-vs-noop split in P4: drop-debug (dropDebugOnly) and trim-tools
// (trimToolSchemas) are REAL section-granular steps; drop-secondary /
// summarise-history / compress-page / reduce-topk are structural no-ops (the
// notes/memory/page/history inputs arrive in Phase 4a/5/7) that pass through;
// minimal-mode is the optimizer's own §2.5 assembly (compact constant
// selection + ≤1 safe tool schema + reduced non-system sections); 'too-large'
// is the honest terminal thrown here, never a silent truncation of user input
// (P4-10). The optimizer only MARKS minimalMode — MCP-chaining/RAG enforcement
// is capsForTier in the hook (04-06) + a Phase-5a consumer concern (D-04-14).
//
// D-04-13: degradation is SECTION-granular — no text.slice/substring anywhere
// in this module; user_input is never modified. GR-3/Pitfall 7: the optimizer
// SELECTS prompt constants (D-04-11, PROMPTS.compact.*) — it never authors
// prompt text; compact constants live only in src/core/prompts/index.ts.
// Zero model calls, zero async, zero network, no provider/SDK imports, no
// React — pure deterministic core (determinism rule: no Date.now/crypto).
import { classifyModelContext } from './ModelContextTier';
import type { ModelContextTier } from './ModelContextTier';
import { computeBudgets } from './TokenBudget';
import { packSections } from './ContextPack';
import type { ContextPackInput } from './ContextPack';
import { LADDER_STEPS, dropDebugOnly, trimToolSchemas } from './ContextCompressor';
import { ContextProvenanceManifestSchema } from './ContextProvenanceManifest';
import type { ContextProvenanceManifest, LadderStepName } from './ContextProvenanceManifest';
import { PROMPTS } from '@/core/prompts';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { debugLog } from '@/core/error/debugLog';
import type { ContextOptimizerInput, OptimizedContext, PromptSection } from '@/core/ai/types';
import type { ToolSchemaRef } from '@/core/ai/toolSchemas';

/**
 * The typed CONTEXT_TOO_LARGE terminal carrier (D-04-15) — the StructuredOutput
 * typed-error precedent (src/core/ai/StructuredOutput.ts L72-83). Thrown only
 * when even minimal mode exceeds the input budget; carries the honest numbers
 * so the hook can map it to a "message too long" failed state (04-06). The
 * code is the canonical §C.2 mirror in errorCodes.ts (W-1 gate re-verifies).
 */
export interface ContextTooLargeError extends Error {
  code: 'CONTEXT_TOO_LARGE';
  reason: 'minimal_mode_exceeded';
  totalTokens: number;
  inputBudget: number;
}

/** Guard: distinguishes the typed terminal from other errors (04-06 hook consumer). */
export function isContextTooLargeError(err: unknown): err is ContextTooLargeError {
  return err instanceof Error && (err as ContextTooLargeError).code === 'CONTEXT_TOO_LARGE';
}

/** Sum a section list's token counts — the manifest totalTokens source. */
function sumTokens(sections: readonly PromptSection[]): number {
  return sections.reduce((n, s) => n + s.tokens, 0);
}

/**
 * D-04-11: the per-role compact system constant selected in minimal mode
 * (GR-3 — the optimizer SELECTS, never authors; text lives in PROMPTS).
 */
function compactSystemFor(stage: ContextOptimizerInput['stage']): string {
  return stage === 'planner' ? PROMPTS.planner.compact.system : PROMPTS.renderer.compact.system;
}

/**
 * §2.5 "at most one safe tool schema": keep the FIRST non-dangerous schema, or
 * none when the caller selected only dangerous tools. No array slicing of any
 * kind — the D-04-13 no-slice grep gate is absolute in this module.
 */
function atMostOneSafeTool(refs: readonly ToolSchemaRef[]): readonly ToolSchemaRef[] {
  const safe = refs.find((t) => !t.dangerous);
  return safe ? [safe] : [];
}

/**
 * Build the §1.3 pack input. DEFAULT path: [SYSTEM] = personaBlock verbatim —
 * byte-identical to the Phase-3 contextHelper output (D-04-07/P4-8 cache
 * stability, re-pinned by the drop-in regression test). MINIMAL path (D-04-14):
 * [SYSTEM] = compact per-role constant + persona block appended (persona-aware
 * from day one, Phase-3 precedent) and tool refs capped to ≤1 safe schema.
 */
function buildPackInput(input: ContextOptimizerInput, minimalMode: boolean): ContextPackInput {
  const personaBlock = minimalMode
    ? `${compactSystemFor(input.stage)}\n\n${input.personaBlock}`
    : input.personaBlock;
  return {
    personaBlock,
    userInput: input.userInput,
    toolSchemaRefs: minimalMode
      ? atMostOneSafeTool(input.selectedToolSchemas)
      : input.selectedToolSchemas,
  };
}

/** Build the typed D-04-15 terminal carrier (StructuredOutput throw-site precedent). */
function contextTooLargeError(totalTokens: number, inputBudget: number): ContextTooLargeError {
  const err = new Error('CONTEXT_TOO_LARGE') as ContextTooLargeError;
  err.code = 'CONTEXT_TOO_LARGE';
  err.reason = 'minimal_mode_exceeded';
  err.totalTokens = totalTokens;
  err.inputBudget = inputBudget;
  return err;
}

/**
 * Optimize a stage's context: tier + budgets from the resolved window, §1.3
 * packing, the §2.4 degradation ladder in D-04-12 order, minimal mode (§2.5),
 * and a Zod-validated ContextProvenanceManifest on EVERY successful return
 * (D-04-17/GR-4). Deterministic drop-in: identical input → identical output.
 */
export function optimize(input: ContextOptimizerInput): OptimizedContext {
  const tier: ModelContextTier = classifyModelContext(input.modelContextWindow);
  const { inputBudget, outputBudget } = computeBudgets(input.modelContextWindow);
  const stepsFired: LadderStepName[] = [];
  // D-04-14: minimal mode is mandatory at tier tiny (§2.5) or escalated to by
  // the ladder below. The optimizer only marks it — capsForTier enforcement
  // (mcpChaining tiny/small false) lands in the hook (04-06).
  let minimalMode = tier === 'tiny';

  let sections = packSections(buildPackInput(input, minimalMode));
  let totalTokens = sumTokens(sections);

  // §2.4 ladder — iterate the D-04-12 registry in order; stop as soon as the
  // budget is met; real steps act, no-ops pass through, 'too-large' is the
  // honest terminal (never a silent slice — P4-10).
  if (totalTokens > inputBudget) {
    for (const step of LADDER_STEPS) {
      if (totalTokens <= inputBudget) break;
      switch (step) {
        case 'drop-debug': {
          // REAL step (D-04-12): drop whole debug-metadata sections. Packed
          // sections never carry a 'debug' sourceId, so in P4 this fires only
          // when a caller-injected debug section is present.
          const r = dropDebugOnly(sections);
          if (r.dropped.length > 0) {
            sections = r.sections;
            stepsFired.push('drop-debug');
          }
          break;
        }
        // Structural no-ops in P4 (D-04-12): notes / older history / page
        // context / memory top-k inputs arrive in Phase 4a/5/7 — the registry
        // slots exist and pass through unchanged (Pitfall 5 — not dead code).
        case 'drop-secondary':
        case 'summarise-history':
        case 'compress-page':
        case 'reduce-topk':
          break;
        case 'trim-tools': {
          // REAL step (D-04-12/T-04-08): drop WHOLE tool_schemas sections out
          // of the caller's in-scope set. P4 pack derives sections from the
          // caller-selected schemas, so every packed section IS in scope — the
          // step is structurally present and fires when a future caller passes
          // a narrower scope (minimal mode's ≤1-safe cap already applies at
          // pack time, atMostOneSafeTool).
          const r = trimToolSchemas(sections, () => true);
          if (r.dropped.length > 0) {
            sections = r.sections;
            stepsFired.push('trim-tools');
          }
          break;
        }
        case 'minimal-mode': {
          // D-04-14 ladder escalation: re-pack with the compact per-role
          // constant + ≤1 safe tool schema (§2.5 section reduction). Skipped
          // when already minimal (tiny mandate applied at pack time).
          if (!minimalMode) {
            minimalMode = true;
            sections = packSections(buildPackInput(input, true));
            stepsFired.push('minimal-mode');
          }
          break;
        }
        case 'too-large': {
          // D-04-15 honest terminal: minimal mode already ran; the turn cannot
          // fit — throw the typed error, never truncate user input.
          throw contextTooLargeError(totalTokens, inputBudget);
        }
      }
      totalTokens = sumTokens(sections);
    }
  }

  // D-04-17 stamping: per-section provenance (never truncated — degradation is
  // whole-section drops, D-04-13), the §2.2 total, the mode flag, the stage's
  // model/window/tier, the heuristic counter method (D-04-10 — the
  // provider-native counter does not exist in ai@4.3.19), and the fired steps.
  const provenance: ContextProvenanceManifest = {
    sections: sections.map((s) => ({
      kind: s.kind,
      sourceId: s.sourceId,
      tokens: s.tokens,
      truncated: false,
    })),
    totalTokens,
    minimalMode,
    workspaceId: input.workspaceId,
    activeSurface: input.activeSurface,
    tier,
    model: input.model,
    window: input.modelContextWindow,
    counterMethod: 'heuristic',
    stepsFired,
  };

  // GR-4/GR-9 (T-04-19): a manifest that fails its own boundary schema must
  // never leave the context layer — SCHEMA_INVALID is the canonical code;
  // the throw mirrors the StructuredOutput typed-error-carrier precedent.
  const parsed = ContextProvenanceManifestSchema.safeParse(provenance);
  if (!parsed.success) {
    debugLog(ERROR_CODES.SCHEMA_INVALID, 'context provenance manifest failed Zod validation', {
      module: 'ContextOptimizer',
      extra: { operationId: input.operationId },
    });
    throw new Error('SCHEMA_INVALID');
  }

  return {
    tier,
    inputBudget,
    outputBudget,
    sections,
    provenance,
    minimalMode,
  };
}
