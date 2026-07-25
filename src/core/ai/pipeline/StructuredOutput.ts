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

interface ExtractedToolCall {
  toolName: string;
  toolInput: Record<string, unknown>;
}

/** `arguments`/`args` come as either an object or (OpenAI-native) a JSON-encoded string. */
function parseToolArgs(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // not JSON — treat as no args
    }
  }
  return {};
}

/**
 * Models frequently default to native function-call JSON shapes even when
 * the prompt asks for a plain {action, toolName, toolInput} object. Try the
 * common conventions in order: OpenAI-style plural array
 * ({"tool_calls":[{"function":{"name","arguments"}}]}), singular wrapper
 * ({"tool_call"/"function_call": {"name","args"}}), and the bare
 * single-key shape ({"toolName": {args}}).
 */
function extractToolCall(parsed: unknown): ExtractedToolCall | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;

  const fromCallObject = (call: unknown): ExtractedToolCall | null => {
    if (!call || typeof call !== 'object') return null;
    const callObj = call as Record<string, unknown>;
    const fn = (callObj.function ?? callObj) as Record<string, unknown>;
    const toolName = fn.name ?? fn.toolName;
    if (typeof toolName !== 'string') return null;
    return { toolName, toolInput: parseToolArgs(fn.args ?? fn.arguments ?? fn.toolInput) };
  };

  // Plural array shape: {"tool_calls": [...]} / {"toolCalls": [...]}
  const arrayKey = ['tool_calls', 'toolCalls'].find((k) => Array.isArray(obj[k]));
  if (arrayKey) {
    const found = fromCallObject((obj[arrayKey] as unknown[])[0]);
    if (found) return found;
  }

  // Singular wrapper shape: {"tool_call"/"function_call"/"toolCall"/"functionCall": {...}}
  const wrapperKey = ['tool_call', 'function_call', 'toolCall', 'functionCall'].find(
    (k) => k in obj,
  );
  if (wrapperKey) {
    const found = fromCallObject(obj[wrapperKey]);
    if (found) return found;
  }

  // Bare shape: {"toolName": {args}} — single key whose value is the args object
  const keys = Object.keys(obj);
  if (keys.length === 1 && typeof obj[keys[0]] === 'object' && obj[keys[0]] !== null && !Array.isArray(obj[keys[0]])) {
    return { toolName: keys[0], toolInput: obj[keys[0]] as Record<string, unknown> };
  }

  return null;
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(repaired);
    // Strip null values — models often emit null for optional fields (e.g.
    // "toolName": null) which Zod's .optional() rejects because it only
    // accepts string | undefined, not null.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of Object.keys(parsed as Record<string, unknown>)) {
        if ((parsed as Record<string, unknown>)[key] === null) {
          delete (parsed as Record<string, unknown>)[key];
        }
      }
    }
    const result = schema.safeParse(parsed);
    if (result.success) return { result: result.data };
    debugLog(
      'warn',
      `[StructuredOutput] Schema validation failed for: ${repaired.slice(0, 500)}`,
      { issues: result.error.issues },
    );
  } catch (err) {
    debugLog(
      'warn',
      `[StructuredOutput] JSON parse failed for: ${repaired.slice(0, 500)}`,
      { error: err },
    );
  }

  // 3. Try to interpret parsed JSON as a tool call (native function-call
  // shapes models commonly default to despite the plain-JSON prompt).
  if (parsed !== undefined) {
    const call = extractToolCall(parsed);
    if (call) {
      const decision = {
        action: 'run_tool' as const,
        toolName: call.toolName.replace(/_/g, '-'),
        toolInput: call.toolInput,
        reasoning: 'Called via native tool call format',
      };
      const result = schema.safeParse(decision);
      if (result.success) {
        debugLog('info', '[StructuredOutput] Parsed native tool call shape', {
          toolName: call.toolName,
        });
        return { result: result.data };
      }
    }
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
