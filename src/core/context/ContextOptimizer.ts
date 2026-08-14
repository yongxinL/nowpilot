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
// WR-02 (05-10): the degradation ladder shares ONE reduced-memory source. The
// reduce-topk step applies a real top-3 whole-item reduction (dropped.length >
// 0); the minimal-mode re-pack MUST consume the SAME reduced set (via
// reducedMemoryHints) or the top-3 reduction is silently undone by a re-pack
// over the full top-5 — a turn where compact system + top-3 memory fits would
// spuriously throw CONTEXT_TOO_LARGE. When no reduction occurred (empty hints
// or no memory section) reducedMemoryHints stays input.memoryHints and the
// minimal-mode re-pack is byte-identical to the pre-WR-02 behavior.
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
import { buildMemorySectionText, buildPreferencesSectionText, packSections } from './ContextPack';
import type { ContextPackInput } from './ContextPack';
// 04b-04 (D-4b-04/08/09): the trust stage's building blocks — the ONLY place
// trust logic runs (P4b-1 ownership). All four are pure/deterministic; the
// optimizer stays zero-model/zero-async/zero-chrome (module contract L31-32,
// Pitfall 5 — the hook resolves page + trustPrefs and passes them in).
import { applySourceGates, pageToContextItems } from './trust/contextFeed';
import { classifyInjection } from './trust/injectionScreener';
import { applyTrustPolicy } from './trust/TrustPolicy';
import { buildReceipt } from './contextReceipt';
import type { TrustedFeedResult } from './contextReceipt';
import type { ContextItem, ContextReceiptEntry, TrustOmitReason } from '@/types/harness';
import { DEFAULT_TRUST_PREFS } from '@/core/preferences/trustConfig';
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
import type { CompressionKind } from './ContextCompressor';
import { ContextProvenanceManifestSchema } from './ContextProvenanceManifest';
import type { ContextProvenanceManifest, LadderStepName } from './ContextProvenanceManifest';
import { PROMPTS } from '@/core/prompts';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { debugLog } from '@/core/error/debugLog';
import type { ContextOptimizerInput, OptimizedContext, PromptSection } from '@/core/ai/types';
import type { ToolSchemaRef } from '@/core/ai/toolSchemas';
import type { RetrievedMemory } from '@/core/memory/types';

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
 * contextText (04b-04 trust-stage output) threads into ContextPackInput's
 * optional slot — emitted only when non-empty, so the no-page path stays
 * byte-identical to pre-4b (D-4a-06).
 */
function buildPackInput(
  input: ContextOptimizerInput,
  minimalMode: boolean,
  contextText?: string,
): ContextPackInput {
  const personaBlock = minimalMode
    ? `${compactSystemFor(input.stage)}\n\n${input.personaBlock}`
    : input.personaBlock;
  // Phase 5 (05-06, D-05-07/08/09): the previously-DROPPED preferences/memory
  // inputs become REAL — the shared ContextPack formatters build the section
  // text (compact-JSON preferences incl. persona overrides; working memory
  // FIRST then '- [score] content' fact lines). Spread only when non-empty so
  // the no-memory path (empty memoryHints + no workingMemoryBlock — the
  // trustPrefs.memory === false gate) stays byte-identical to pre-5.
  const preferencesText = input.preferences
    ? buildPreferencesSectionText(input.preferences)
    : undefined;
  const memoryText = buildMemorySectionText({
    memoryHints: input.memoryHints,
    workingMemoryBlock: input.workingMemoryBlock,
  });
  return {
    personaBlock,
    userInput: input.userInput,
    toolSchemaRefs: minimalMode
      ? atMostOneSafeTool(input.selectedToolSchemas)
      : input.selectedToolSchemas,
    ...(contextText && contextText.length > 0 ? { contextText } : {}),
    ...(preferencesText ? { preferencesText } : {}),
    ...(memoryText ? { memoryText } : {}),
  };
}

/** CTX-06 zeroed counters — the honest no-page-feed stamp (GR-4 schema shape). */
const ZEROED_COUNTERS: ContextProvenanceManifest['counters'] = {
  screened: 0,
  quarantined: 0,
  byTrust: { system: 0, user: 0, tool: 0, retrieved: 0, untrusted: 0 },
  totalIncludedTokens: 0,
};

/**
 * D-4b-04/08/09 (04b-04): the trust stage — the D-4b-02/04/09 boundary
 * (ContextItem[] → classifier → quarantine → policy → gates → contextText +
 * receipt + CTX-06 counters). Pure, synchronous, zero-model, zero-async,
 * zero-chrome (Pitfall 5 — the hook resolves page + trustPrefs and passes them
 * in). Section-granular only: the §22.2 cap lives in contextFeed, never here
 * (D-04-13).
 *
 * Returns null when there is nothing to pack — no page feed (D-4a-06 unplugged
 * path stays byte-identical to pre-4b) or the page source disabled via np_trust
 * (D-4b-08: the feed then produces no items, so no section is emitted and the
 * receipt is honestly empty — no fabricated rows). The manifest then carries
 * `receipt: []` + ZEROED_COUNTERS (the schema requires the fields, GR-4).
 */
function buildTrustedContext(input: ContextOptimizerInput): {
  contextText: string;
  receipt: ContextReceiptEntry[];
  counters: TrustedFeedResult['counters'];
} | null {
  // D-4a-06: no page feed → no context section (pre-4b byte-identity).
  if (!input.pageContext) return null;
  // D-4b-08: page source disabled → the gate would exclude the only item, so
  // the honest result is no section + an empty receipt.
  if (input.trustPrefs?.page === false) return null;

  const items = pageToContextItems(input.pageContext);
  if (items.length === 0) return null;

  // ONE structured decisions map accumulates BOTH producers (D-4b-06/08) —
  // buildReceipt consumes this exact `{ reason: TrustOmitReason }` shape with
  // no conversion (04b-03 contract).
  const excluded = new Map<string, { reason: TrustOmitReason }>();

  // D-4b-05/06: screen every item; a hit is quarantined-not-dropped — the item
  // stays a ContextItem (receipt row included:false, omitReason
  // 'prompt_injection', D-4b-06), never becomes a PromptSection.
  let quarantined = 0;
  for (const item of items) {
    if (classifyInjection(item.text) === 'quarantine') {
      excluded.set(item.id, { reason: 'prompt_injection' });
      quarantined += 1;
    }
  }

  // O.3 authority strip + wrap (T-4b-01) — the REAL boundary: even a classifier
  // miss is inert after this. The 04b-03 feed stamps instructionAuthority:false,
  // so the authority-strip wrap never fires in the page-only pipeline (no
  // double-wrap — 04b-03 decision).
  const policyItems = applyTrustPolicy(items);

  // D-4b-08 source gates: a disabled source kind is excluded with
  // 'trust_disabled'; the gate's entries MERGE into the same stage map
  // (identical shape — plain spread).
  const gates = applySourceGates(policyItems, input.trustPrefs ?? DEFAULT_TRUST_PREFS);
  for (const [id, decision] of gates.excluded) excluded.set(id, decision);

  // F-5: cacheEligibility mirrors ProviderRouter's CACHED_KINDS (the single
  // mapping site — do NOT re-list the kinds here). The page feed emits only
  // 'context'-kind items whose section is stable:false, so page items are
  // never cache-eligible; future feed kinds (memory, Phase 5) extend this
  // predicate in lockstep with CACHED_KINDS. The optimizer stays
  // dependency-light (no ProviderRouter import).
  const kindStable = (kind: ContextItem['kind']): boolean => kind === 'memory';

  const feed = buildReceipt(policyItems, { excluded }, kindStable, items.length, quarantined);
  return {
    contextText: feed.contextText,
    receipt: feed.receipt,
    counters: feed.counters,
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

  // 04b-04 (D-4b-04/08/09): the trust stage runs BEFORE packing — page feed →
  // classifier → quarantine → applyTrustPolicy → source gates → contextText +
  // receipt/counters. Null when there is no feed to pack (D-4a-06 no-page path
  // stays byte-identical to pre-4b) or the page source is disabled (D-4b-08).
  const trusted = buildTrustedContext(input);

  let sections = packSections(buildPackInput(input, minimalMode, trusted?.contextText));
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
    s.kind !== 'tool_schemas' || input.selectedToolSchemas.some((t) => s.text.includes(t.name));

  // Per-kind compression markers for the manifest (WR-03 "honor their
  // markers"): a REAL step that drops/compresses records its compression kind
  // against the sections it produced; no-ops never drop in P4, so nothing is
  // stamped (honest provenance — the field stays undefined until a step acts).
  const compressionByKind = new Map<PromptSection['kind'], CompressionKind>();

  // WR-02 (05-10): the SHARED reduced-memory source between the reduce-topk and
  // minimal-mode ladder steps. reduce-topk applies a real top-3 whole-item
  // reduction by REPLACING the memory section text; if the later minimal-mode
  // re-pack rebuilt from the FULL input.memoryHints (top-5) the reduction would
  // be silently undone and a turn that fits with compact system + top-3 memory
  // would still throw CONTEXT_TOO_LARGE. Both steps consume this one source.
  let reducedMemoryHints: RetrievedMemory[] = input.memoryHints;

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
          // 05-06 (Pitfall 5): REAL fallback — the ladder passes the memory
          // source so reduceMemoryTopK re-builds the memory section from the
          // top-3 hints (whole-item drops, D-04-13) via the shared formatter
          // when the per-tier budget was exceeded. Empty hints → no memory
          // section → passthrough (dropped []), so the memory-disabled path
          // never fires this step.
          const r = reduceMemoryTopK(sections, {
            memoryHints: input.memoryHints,
            workingMemoryBlock: input.workingMemoryBlock,
          });
          if (r.dropped.length > 0) {
            sections = r.sections;
            // WR-02 (05-10): a REAL reduction fired — record the same top-3
            // whole-item slice reduceMemoryTopK applies internally so the
            // minimal-mode re-pack below consumes the SAME reduced set.
            reducedMemoryHints = input.memoryHints.slice(0, 3);
            stepsFired.push('reduce-topk');
            if (r.compressionApplied) compressionByKind.set('memory', r.compressionApplied);
          }
          break;
        }
        case 'minimal-mode': {
          // D-04-14 ladder escalation: re-pack with the compact per-role
          // constant + ≤1 safe tool schema (§2.5 section reduction). Skipped
          // when already minimal (tiny mandate applied at pack time). WR-03:
          // the compressor's enterMinimalMode marker primitive is called (its
          // returned minimalMode flag is the §2.5 marker); the optimizer then
          // performs the actual section reduction below. WR-02 (05-10): the
          // re-pack consumes reducedMemoryHints — when reduce-topk reduced the
          // memory set, the minimal pack keeps the top-3 (never re-expands to
          // the full top-5); when no reduction occurred the source is
          // input.memoryHints, byte-identical to pre-WR-02.
          if (!minimalMode) {
            minimalMode = enterMinimalMode(sections).minimalMode;
            sections = packSections(
              buildPackInput(
                { ...input, memoryHints: reducedMemoryHints },
                true,
                trusted?.contextText,
              ),
            );
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
    // 04b-04 (D-4b-10/11, GR-4): the REAL trust-stage receipt + CTX-06 counters
    // ride the manifest on every successful return; when the trust stage saw no
    // page feed (or the page source is disabled), the honest empty receipt +
    // zeroed counters are emitted — the schema requires the fields at every
    // boundary (T-4b-10).
    receipt: trusted?.receipt ?? [],
    counters: trusted?.counters ?? ZEROED_COUNTERS,
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
