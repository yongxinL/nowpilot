import { jsonrepair, JSONRepairError } from 'jsonrepair';
import { z } from 'zod';
import { debugLog } from '../../utils/debugLog';

/**
 * Attempt to extract a JSON object/array from text that may contain
 * surrounding prose, reasoning blocks, or markdown formatting.
 */
function extractJson(text: string): string | null {
  // 1. Strip markdown code fences
  let cleaned = text.replace(/^```(?:json)?\s*\n?|\n?\s*```$/gi, '').trim();

  // 2. Find the first `{...}` or `[...]` block (handles explanatory text before/after JSON)
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  const bracketMatch = !braceMatch ? cleaned.match(/\[[\s\S]*\]/) : null;
  const extracted = braceMatch ? braceMatch[0] : bracketMatch ? bracketMatch[0] : cleaned;

  return extracted.trim();
}

export function repairAndValidate<T>(
  text: string,
  schema: z.ZodType<T>,
  fallback: T,
): { result: T } | { fallback: T } {
  // 0. Extract JSON-like content from surrounding text
  const extracted = extractJson(text);
  if (!extracted) {
    debugLog('warn', '[StructuredOutput] No JSON-like content found');
    return { fallback };
  }

  // 1. One-shot JSON repair
  let repaired: string;
  try {
    repaired = jsonrepair(extracted);
  } catch (err) {
    if (err instanceof JSONRepairError) {
      debugLog('warn', '[StructuredOutput] JSON repair failed', { position: err.position });
      return { fallback };
    }
    throw err;
  }

  // 2. Parse + validate
  try {
    const parsed = JSON.parse(repaired);
    const result = schema.safeParse(parsed);
    if (result.success) return { result: result.data };
    debugLog('warn', '[StructuredOutput] Schema validation failed', { issues: result.error.issues });
  } catch (err) {
    debugLog('warn', '[StructuredOutput] JSON parse failed', { error: err });
  }

  return { fallback };
}
