// MemoryExtractor — D-113 extraction schema + parse seam ONLY
// (PRODUCT_SPEC_v0_1.md spec 4764-4773, ConfidentFact mirror).
//
// Ships the memory-fact extraction schema + a tolerant parse seam. The
// actual LLM extraction call + NMEM-02 upsert wiring is Phase 9 (spec 3876).
// NO LLM import/call in this module (D-113 scope fence — grep-asserted).
import { z } from 'zod';
import { debugLog } from '../log/debugLog';

/**
 * memoryFacts schema — mirrors ConfidentFact (spec 4764-4773).
 * Each fact has content, a type, a confidence in [0,1], and optional tags.
 */
export const memoryFactsSchema = z.object({
  content: z.string(),
  type: z.enum(['fact', 'preference', 'pattern']),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()).default([]),
});

export type MemoryFact = z.infer<typeof memoryFactsSchema>;

/**
 * Tolerant JSON-array extraction from an LLM output string. Strips code
 * fences, finds the first `[...]` block, safeParses each entry, drops
 * invalid entries with a debugLog. Returns ok:false only when NO valid
 * fact parses.
 *
 * @param output — raw LLM output (may contain markdown fences, prose).
 * @returns typed { ok: true; facts } or { ok: false; code; message }.
 */
export function parseMemoryFacts(
  output: string,
): { ok: true; facts: MemoryFact[] } | { ok: false; code: 'MEMORY_FACT_PARSE_FAILED'; message: string } {
  // Strip code fences.
  let text = output.replace(/```(?:json)?\s*/g, '').trim();

  // Find the first [...] block.
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, code: 'MEMORY_FACT_PARSE_FAILED', message: 'No JSON array found in output' };
  }

  const arrayText = text.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(arrayText);
  } catch (e) {
    return {
      ok: false,
      code: 'MEMORY_FACT_PARSE_FAILED',
      message: e instanceof Error ? e.message : 'JSON parse error',
    };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, code: 'MEMORY_FACT_PARSE_FAILED', message: 'Parsed value is not an array' };
  }

  const facts: MemoryFact[] = [];
  for (const entry of parsed) {
    const result = memoryFactsSchema.safeParse(entry);
    if (result.success) {
      facts.push(result.data);
    } else {
      debugLog('MEMORY_FACT_DROPPED', 'invalid fact entry dropped', {
        error: result.error.message,
      });
    }
  }

  if (facts.length === 0) {
    return { ok: false, code: 'MEMORY_FACT_PARSE_FAILED', message: 'No valid facts parsed' };
  }

  return { ok: true, facts };
}
