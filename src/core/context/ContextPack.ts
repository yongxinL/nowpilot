// ContextPack — D-76 deterministic §1.3 canonical-order assembly.
//
// §1.3 canonical section order (PRODUCT_SPEC_v0_1.md:331-339), verbatim. The
// ordering IS the prompt-cache contract: PromptCacheAdapter.hashStableSections
// (FNV-1a) hashes stable sections byte-identically, so ContextPack emits in the
// hard-coded §1.3 order — NEVER an alphabetical sort (Pitfall 4; the stableFirst
// sort in PromptCacheAdapter is cache adaptation, NOT canonical order).
//
// Phase-7 consumers call pack(context.sections) at the caching boundary
// (PromptCacheManager/PromptCacheAdapter stable-first, Appendix K). This module
// is the materialization seam: ContextOptimizer decides, ContextPack packs (D-76).
import type { PromptSection } from '../ai/types';

/** §1.3 canonical section order, verbatim (spec 331-339). */
export const CANONICAL_SECTION_ORDER: readonly string[] = [
  'SYSTEM',
  'TOOL SCHEMAS',
  'USER PREFERENCES',
  'MEMORY',
  'CONTEXT',
  'TASK',
  'USER INPUT',
];

/** kind → index lookup for the canonical order (never derived from sorting). */
const CANONICAL_INDEX: ReadonlyMap<string, number> = new Map(
  CANONICAL_SECTION_ORDER.map((kind, index) => [kind, index]),
);

/**
 * Deterministic assembly: reorders sections by kind→index from
 * CANONICAL_SECTION_ORDER, joins section texts with '\n\n', and tallies
 * totalTokens = Σ section.tokens. Throws on a section kind outside the §1.3
 * table (closed-union discipline, mirrors trajectory.ts illegal-transition throw).
 */
export function pack(sections: PromptSection[]): { prompt: string; totalTokens: number } {
  // Validate every kind upfront — a single-element array would otherwise skip
  // the sort comparator (sort never compares 1 element) and never throw.
  for (const section of sections) {
    if (!CANONICAL_INDEX.has(section.kind)) {
      throw new Error(`pack: section kind '${section.kind}' is not in the §1.3 canonical order`);
    }
  }
  const ordered = [...sections].sort((a, b) => {
    const indexA = CANONICAL_INDEX.get(a.kind) as number;
    const indexB = CANONICAL_INDEX.get(b.kind) as number;
    return indexA - indexB;
  });
  const prompt = ordered.map((section) => section.text).join('\n\n');
  const totalTokens = ordered.reduce((sum, section) => sum + section.tokens, 0);
  return { prompt, totalTokens };
}