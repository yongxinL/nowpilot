import { jsonrepair, JSONRepairError } from 'jsonrepair';
import { z } from 'zod';
import { debugLog } from '../../utils/debugLog';

export function repairAndValidate<T>(
  text: string,
  schema: z.ZodType<T>,
  fallback: T,
): { result: T } | { fallback: T } {
  // 1. One-shot JSON repair
  let repaired: string;
  try {
    repaired = jsonrepair(text);
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
  } catch (err) {
    debugLog('warn', '[StructuredOutput] JSON parse failed', { error: err });
  }

  // 3. Schema validation failed → fallback
  debugLog('warn', '[StructuredOutput] Schema validation failed — returning fallback');
  return { fallback };
}
