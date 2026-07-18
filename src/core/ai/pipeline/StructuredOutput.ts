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

  // 2. Normalize native tool call quote tokens before JSON extraction
  cleaned = cleaned.replace(/<\|"[^>]*\|>/g, '"');

  // 3. Find the first `{...}` or `[...]` block (handles explanatory text before/after JSON)
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

  // 3. Try to interpret parsed JSON as a tool call: {"toolName": args}
  try {
    const parsed = JSON.parse(repaired);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      if (keys.length === 1 && typeof parsed[keys[0]] === 'object' && parsed[keys[0]] !== null) {
        const toolName = keys[0].replace(/_/g, '-');
        const toolInput = parsed[keys[0]] as Record<string, unknown>;
        const decision = {
          action: 'run_tool' as const,
          toolName,
          toolInput,
          reasoning: 'Called via native tool call format',
        };
        const result = schema.safeParse(decision);
        if (result.success) {
          debugLog('info', '[StructuredOutput] Parsed tool call from JSON key', { toolName });
          return { result: result.data };
        }
      }
    }
  } catch {
    // ignore
  }

  // 4. Fallback: try native tool call format (<|tool_call|>call:funcName{...})
  if (typeof text === 'string') {
    const nativeMatch = text.match(/<\|tool_call\|>\s*call\s*:\s*(\S+?)\s*(\{[\s\S]*\})/);
    if (nativeMatch) {
      const toolName = nativeMatch[1].trim();
      const rawArgs = nativeMatch[2]
        .replace(/<\|"[^>]*\|>/g, '"')
        .replace(/<\\\|"[^>]*\\\|>/g, '"');
      let toolInput: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(rawArgs.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'));
        toolInput = typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
      } catch {
        toolInput = {};
      }
      const decision = {
        action: 'run_tool' as const,
        toolName,
        toolInput,
        reasoning: 'Called via native tool format',
      };
      const result = schema.safeParse(decision);
      if (result.success) {
        debugLog('info', '[StructuredOutput] Parsed native tool call format', { toolName });
        return { result: result.data };
      }
    }
  }

  return { fallback };
}
