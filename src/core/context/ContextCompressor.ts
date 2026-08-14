// src/core/context/ContextCompressor.ts — Wave-2 (04-02) §2.4 degradation
// ladder as PURE section-level primitives. Source: PRODUCT_SPEC §2.4 (verbatim
// ladder order, L453-460) + D-04-12 (real-vs-noop split) + D-04-13
// (section-granularity only) + D-04-14 (minimal-mode marker) + D-04-16
// (history budget reservation).
//
// D-04-12 ladder order (verbatim — LADDER_STEPS is the tested registry,
// ContextOptimizer 04-04 iterates it):
//   drop debug → drop secondary → summarise history → compress page →
//   trim tools → reduce top-k → minimal mode → CONTEXT_TOO_LARGE
// drop-debug, trim-tool-schemas, reduce-top-k, and minimal-mode do REAL work
// in P4/P5; notes/memory/pageContext/history inputs arrive across Phase 4a/5/7,
// so the remaining steps are STRUCTURAL NO-OPS — they return the input sections
// unchanged plus a compressionApplied marker ('summarise' | 'structural' |
// 'topk'). They are not dead code and not stubbed-with-throw (Pitfall 5).
// CONTEXT_TOO_LARGE is the honest terminal thrown by the OPTIMIZER (04-04),
// not here; 'too-large' is the last registry entry the optimizer recognizes.
//
// D-04-13: degradation is SECTION-granular — a step drops or keeps a WHOLE
// section, never a text slice; user_input is never truncated by caps. Zero
// model calls / no async / no network (through-line). This module never
// rewrites section text (no slice/substring/replace) and never touches a
// stable:true section's text (P4-8). D-04-16: no 'history' PromptSection kind
// is invented — the History slice is a budget-column reservation (R-1/R-2).
import type { PromptSection } from '@/core/ai/types';
import type { RetrievedMemory } from '@/core/memory/types';
import { estimateTokens } from './TokenBudget';
import { buildMemorySectionText } from './ContextPack';

/** Which compression kind a step applied ('summarise' | 'structural' | 'topk'). */
export type CompressionKind = 'summarise' | 'structural' | 'topk';

/**
 * Uniform step result: the (possibly filtered) sections, an optional
 * compression marker, and the sourceIds of every section dropped whole.
 * `compressionApplied` is set only when the step actually applied compression
 * (real steps: a drop occurred; no-ops: always set — they ARE the marker).
 */
export interface CompressionResult {
  sections: PromptSection[];
  compressionApplied?: CompressionKind;
  dropped: string[];
}

/** enterMinimalMode's result — the §2.5 marker the optimizer consumes (D-04-14). */
export interface MinimalModeResult extends CompressionResult {
  minimalMode: true;
}

/** Caller-supplied in-scope predicate for trimToolSchemas (T-04-08 — the optimizer passes the in-scope set). */
export type InScopePredicate = (section: PromptSection) => boolean;

/** D-04-16: debug-metadata sourceId — the drop-debug step's only match target. */
const DEBUG_SOURCE_ID = 'debug';

/**
 * REAL step (D-04-12): drop debug-only sections. Matches ONLY sections whose
 * sourceId signals debug metadata; a canonical system/user_input section
 * carries 'system'/'user-input' so it can never match (never touches them).
 */
export function dropDebugOnly(sections: PromptSection[]): CompressionResult {
  const dropped: string[] = [];
  const remaining = sections.filter((s) => {
    if (s.sourceId === DEBUG_SOURCE_ID) {
      dropped.push(s.sourceId);
      return false;
    }
    return true;
  });
  return {
    sections: remaining,
    compressionApplied: dropped.length > 0 ? 'structural' : undefined,
    dropped,
  };
}

/**
 * NO-OP in P4 (D-04-12): secondary notes arrive in Phase 5. Structurally
 * present with a marker — never drops a section in P4.
 */
export function dropSecondaryNotes(sections: PromptSection[]): CompressionResult {
  return { sections: [...sections], compressionApplied: 'structural', dropped: [] };
}

/**
 * NO-OP in P4 (D-04-12): ChatHistoryDB (and thus older-history summarisation)
 * arrives in Phase 7. Structurally present with a marker.
 */
export function summariseOlderHistory(sections: PromptSection[]): CompressionResult {
  return { sections: [...sections], compressionApplied: 'summarise', dropped: [] };
}

/**
 * NO-OP in P4 (D-04-12): page/case context arrives in Phase 4a. Structurally
 * present with a marker.
 */
export function compressPageContext(sections: PromptSection[]): CompressionResult {
  return { sections: [...sections], compressionApplied: 'structural', dropped: [] };
}

/**
 * REAL step (D-04-12, T-04-08): trim tool schemas to the in-scope set. The
 * predicate is caller-supplied (the optimizer passes the in-scope schemas);
 * a non-matching tool_schemas section is dropped WHOLE — no partial schema
 * text is ever emitted (T-04-08 mitigation). Non-tool sections pass through.
 */
export function trimToolSchemas(
  sections: PromptSection[],
  inScope: InScopePredicate,
): CompressionResult {
  const dropped: string[] = [];
  const remaining = sections.filter((s) => {
    if (s.kind !== 'tool_schemas') return true;
    if (inScope(s)) return true;
    dropped.push(s.sourceId);
    return false;
  });
  return {
    sections: remaining,
    compressionApplied: dropped.length > 0 ? 'structural' : undefined,
    dropped,
  };
}

/**
 * REAL step (05-06, Pitfall 5): top-k memory reduction — the fallback safety
 * net behind MemoryEngine's per-tier budget (05-04, D-05-02). When the ladder
 * fires 'reduce-topk' WITH a memorySource, the memory section is RE-BUILT from
 * the top-3 hints via buildMemorySectionText — the SHARED pack-time formatter,
 * so the fallback text can never diverge from the pack format. Drops are
 * WHOLE ITEMS only (memorySource.memoryHints.slice(0, 3) is item-level, never
 * a substring of a fact's content — D-04-13 no-slice gate); the rebuilt
 * section keeps the original kind/sourceId/stable:true and recomputes tokens
 * via estimateTokens (the ONLY token counter, Pitfall 1).
 *
 * Without a memorySource (standalone callers — backward compat) the step keeps
 * its pre-5 passthrough semantics: sections unchanged, 'topk' marker, dropped
 * [].
 */
export function reduceMemoryTopK(
  sections: readonly PromptSection[],
  memorySource?: {
    memoryHints: readonly RetrievedMemory[];
    workingMemoryBlock?: string;
  },
): CompressionResult {
  if (memorySource === undefined) {
    return { sections: [...sections], compressionApplied: 'topk', dropped: [] };
  }
  const idx = sections.findIndex((s) => s.kind === 'memory');
  if (idx === -1) {
    return { sections: [...sections], compressionApplied: 'topk', dropped: [] };
  }
  // Top-3 whole-item fallback (D-04-13 no-slice gate) via the shared formatter.
  const rebuilt = buildMemorySectionText({
    memoryHints: memorySource.memoryHints.slice(0, 3),
    workingMemoryBlock: memorySource.workingMemoryBlock,
  });
  const current = sections[idx];
  if (rebuilt === undefined || rebuilt === current.text) {
    return { sections: [...sections], compressionApplied: 'topk', dropped: [] };
  }
  const next = [...sections];
  next[idx] = {
    kind: 'memory',
    text: rebuilt,
    tokens: estimateTokens(rebuilt),
    stable: current.stable,
    sourceId: current.sourceId,
  };
  return { sections: next, compressionApplied: 'topk', dropped: ['memory'] };
}

/**
 * REAL marker (D-04-14): enter §2.5 minimal mode. Returns the minimalMode flag
 * the optimizer consumes; the actual §2.5 section reduction (compact system
 * prompt, ≤1 safe tool schema, reduced non-system sections) is the
 * OPTIMIZER's final assembly — this primitive only marks the pipeline.
 */
export function enterMinimalMode(sections: PromptSection[]): MinimalModeResult {
  return {
    sections: [...sections],
    compressionApplied: 'structural',
    dropped: [],
    minimalMode: true,
  };
}

/**
 * The D-04-12 ordered step registry — the 8 ladder steps ContextOptimizer
 * (04-04) iterates. 'too-large' is the honest CONTEXT_TOO_LARGE terminal
 * (thrown by the optimizer). The order is pinned by tests, never free-form.
 */
export const LADDER_STEPS = [
  'drop-debug',
  'drop-secondary',
  'summarise-history',
  'compress-page',
  'trim-tools',
  'reduce-topk',
  'minimal-mode',
  'too-large',
] as const;

export type LadderStep = (typeof LADDER_STEPS)[number];
