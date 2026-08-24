/**
 * Storage-side redaction primitive for the Phase 2 boundary. The full
 * TraceRedactor (Phase 11) is a richer logger-side sibling; this
 * utility is the conservative primitive used by persist and boot-step
 * migration code paths.
 *
 * The contract (D-39 / §16.5):
 *   - Deep-clones the input (does NOT mutate the original)
 *   - Empties keys matching a deny-list (apiKey, openAiKey, geminiKey,
 *     plus anything matching /key|token|secret|authorization/i,
 *     case-insensitive)
 *   - Truncates message-body-shaped string values to a fixed preview
 *     length so logs / ErrorStore contexts cannot leak content
 *
 * Use it at every persist boundary and before any debugLog/ErrorStore
 * write that might carry user-provided content. NEVER pass it a secret
 * for redaction itself — it would empty the value but the function's
 * own trace output would still be exposed.
 */
const SECRET_KEY_DENYLIST = ['apikey', 'openikey', 'geminikey'];
const SECRET_KEY_REGEX = /key|token|secret|authorization/i;
const MESSAGE_BODY_PREVIEW_CHARS = 80;

function isSecretKey(key: string): boolean {
  return SECRET_KEY_DENYLIST.includes(key.toLowerCase()) || SECRET_KEY_REGEX.test(key);
}

function shouldTruncateValue(value: unknown): boolean {
  // Heuristic: long string values look like page content / message bodies.
  return typeof value === 'string' && value.length > MESSAGE_BODY_PREVIEW_CHARS;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') {
    if (shouldTruncateValue(value)) {
      return String(value).slice(0, MESSAGE_BODY_PREVIEW_CHARS) + '…';
    }
    return value;
  }

  // Cycle guard — do not recurse forever on circular references.
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(k)) {
      out[k] = '';
      continue;
    }
    out[k] = redactValue(v, seen);
  }
  return out;
}

export function redactSensitive(context?: Record<string, unknown>): Record<string, unknown> {
  const seen = new WeakSet<object>();
  const redacted = redactValue(context ?? {}, seen);
  return redacted as Record<string, unknown>;
}

/** Test-only seam — redaction of arbitrary unknown value for non-object contexts. */
export function redactSensitiveValue(value: unknown): unknown {
  const seen = new WeakSet<object>();
  return redactValue(value, seen);
}
