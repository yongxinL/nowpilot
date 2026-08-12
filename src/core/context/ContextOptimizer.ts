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
import { computeBudgets, computeSectionCaps } from './TokenBudget';
import { packSections } from './ContextPack';
import type { ContextPackInput } from './ContextPack';
import {
  LADDER_STEPS,
  compressPageContext,
  dropDebugOnly,
  dropSecondaryNotes,
  enterMinimalMode,
  reduceMemoryTopK,
  summariseOlderHistory,
  trimToolSchemas,
} from './ContextCompressor';
import type { CompressionKind, CompressionResult } from './ContextCompressor';
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

  // WR-02 (04): the §2.2 per-kind column caps ALSO drive the ladder — a single
  // kind blowing its cap (e.g. user_input at 3000 vs the medium cap of 2457 —
  // the OVER_BUDGET_SECTIONS fixture) fires degradation even when the aggregate
  // stays under budget. computeSectionCaps was dead in the runtime path before
  // this wave; now it is the per-kind trigger the module contract promised
  // (TokenBudget L23-24 "caps DRIVE the §2.4 degradation ladder").
  const caps = computeSectionCaps(tier, inputBudget);
  const kindTotals = (): Map<string, number> => {
    const totals = new Map<string, number>();
    for (const s of sections) totals.set(s.kind, (totals.get(s.kind) ?? 0) + s.tokens);
    return totals;
  };
  const anyKindOverCap = (): boolean => {
    const totals = kindTotals();
    return Object.entries(caps).some(([kind, cap]) => (totals.get(kind) ?? 0) > cap);
  };

  // WR-03 (04): the in-scope predicate is DERIVED from the caller's selected
  // schemas (D-04-12/T-04-08) — never the hardcoded `() => true` that made
  // trim-tools structurally unable to fire. The P4 pack only emits selected
  // schemas, so the step stays inert today, but a future caller injecting an
  // out-of-scope tool section will be trimmed (whole-section drop, T-04-08).
  const inScope = (s: PromptSection): boolean =>
    s.kind !== 'tool_schemas' ||
    input.selectedToolSchemas.some((t) => s.text.includes(t.name));

  // Per-kind compression markers for the manifest (WR-03 "honor their
  // markers"): a REAL step that drops/compresses records its compression kind
  // against the sections it produced; no-ops never drop in P4, so nothing is
  // stamped (honest provenance — the field stays undefined until a step acts).
  const compressionByKind = new Map<PromptSection['kind'], CompressionKind>();

  // §2.4 ladder — iterate the D-04-12 registry in order; stop as soon as BOTH
  // the aggregate budget AND every per-kind cap are met; real steps act, no-op
  // steps still run their module functions (the registry is genuinely
  // iterated — WR-03), and 'too-large' is the honest terminal (never a silent
  // slice — P4-10).
  if (totalTokens > inputBudget || anyKindOverCap()) {
    for (const step of LADDER_STEPS) {
      if (totalTokens <= inputBudget && !anyKindOverCap()) break;
      switch (step) {
        case 'drop-debug': {
          // REAL step (D-04-12): drop whole debug-metadata sections. Packed
          // sections never carry a 'debug' sourceId, so in P4 this fires only
          // when a caller-injected debug section is present.
          const r = dropDebugOnly(sections);
          if (r.dropped.length > 0) {
            // Record the dropped kind BEFORE the section list is filtered —
            // the marker applies to the surviving sections of that kind.
            const droppedKinds = new Set(
              r.dropped
                .map((id) => sections.find((s) => s.sourceId === id)?.kind)
                .filter((k): k is PromptSection['kind'] => k !== undefined),
            );
            sections = r.sections;
            stepsFired.push('drop-debug');
            if (r.compressionApplied) {
              for (const kind of droppedKinds) compressionByKind.set(kind, r.compressionApplied);
            }
          }
          break;
        }
        // Structural no-ops in P4 (D-04-12, WR-03): the four inputs arrive in
        // Phase 4a/5/7, but the optimizer CALLS the module functions so the
        // registry is genuinely iterated (their compressionApplied markers
        // exist in the runtime path, not only in unit tests). They never drop
        // in P4, so behavior is unchanged and nothing is stamped.
        case 'drop-secondary': {
          const r = dropSecondaryNotes(sections);
          if (r.dropped.length > 0) {
            sections = r.sections;
            stepsFired.push('drop-secondary');
          }
          break;
        }
        case 'summarise-history': {
          const r = summariseOlderHistory(sections);
          if (r.dropped.length > 0) {
            sections = r.sections;
            stepsFired.push('summarise-history');
          }
          break;
        }
        case 'compress-page': {
          const r = compressPageContext(sections);
          if (r.dropped.length > 0) {
            sections = r.sections;
            stepsFired.push('compress-page');
          }
          break;
        }
        case 'trim-tools': {
          // REAL step (D-04-12/T-04-08): drop WHOLE tool_schemas sections out
          // of the caller's in-scope set — the predicate is derived from
          // input.selectedToolSchemas (WR-03).
          const r = trimToolSchemas(sections, inScope);
          if (r.dropped.length > 0) {
            sections = r.sections;
            stepsFired.push('trim-tools');
            if (r.compressionApplied) compressionByKind.set('tool_schemas', r.compressionApplied);
          }
          break;
        }
        case 'reduce-topk': {
          const r = reduceMemoryTopK(sections);
          if (r.dropped.length > 0) {
            sections = r.sections;
            stepsFired.push('reduce-topk');
          }
          break;
        }
        case 'minimal-mode': {
          // D-04-14 ladder escalation: re-pack with the compact per-role
          // constant + ≤1 safe tool schema (§2.5 section reduction). Skipped
          // when already minimal (tiny mandate applied at pack time). WR-03:
          // the compressor's enterMinimalMode marker primitive is called (its
          // returned minimalMode flag is the §2.5 marker); the optimizer then
          // performs the actual section reduction below.
          if (!minimalMode) {
            minimalMode = enterMinimalMode(sections).minimalMode;
            sections = packSections(buildPackInput(input, true));
            stepsFired.push('minimal-mode');
          }
          break;
        }
        case 'too-large': {
          // D-04-15 honest terminal: minimal mode already ran; the turn cannot
          // fit — throw the typed error, never truncate user input. WR-02:
          // ONLY aggregate window overflow throws — a kind over its column cap
          // with aggregate headroom degrades as far as P4 allows and then stops
          // (never a false window overflow for a distribution violation).
          if (totalTokens > inputBudget) throw contextTooLargeError(totalTokens, inputBudget);
          break;
        }
      }
      totalTokens = sumTokens(sections);
    }
  }

  // D-04-17 stamping: per-section provenance (never truncated — degradation is
  // whole-section drops, D-04-13), the §2.2 total, the mode flag, the stage's
  // model/window/tier, the heuristic counter method (D-04-10 — the
  // provider-native counter does not exist in ai@4.3.19), and the fired steps.
  // WR-03: sections whose kind was actually degraded carry the compression
  // marker (honoring the compressor steps' markers in the runtime path).
  const provenance: ContextProvenanceManifest = {
    sections: sections.map((s) => {
      const compressionApplied = compressionByKind.get(s.kind);
      return {
        kind: s.kind,
        sourceId: s.sourceId,
        tokens: s.tokens,
        truncated: false,
        ...(compressionApplied ? { compressionApplied } : {}),
      };
    }),
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
