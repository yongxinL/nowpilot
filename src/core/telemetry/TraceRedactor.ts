// =========================================================================
// TraceRedactor — Eager pattern-based redaction middleware
//
// Applies mandatory regex patterns from product spec §4.4 before any data
// is persisted to IndexedDB, written to debugLog, rendered in UI, or exported.
//
// Typed placeholders (D-11) preserve field visibility while removing secrets.
// =========================================================================

// Module-level patterns constant for testability (not instance property)
const PATTERNS: Array<{ regex: RegExp; placeholder: string }> = [
  { regex: /sk-[A-Za-z0-9_-]+/g, placeholder: '[REDACTED:API_KEY]' },
  { regex: /key-[A-Za-z0-9_-]+/g, placeholder: '[REDACTED:API_KEY]' },
  { regex: /Bearer\s+[A-Za-z0-9._-]+/gi, placeholder: '[REDACTED:BEARER_TOKEN]' },
  { regex: /JSESSIONID=[^;\s]+/gi, placeholder: '[REDACTED:JSESSIONID]' },
  { regex: /sysparm_ck[=:]\s*[^&\s]+/gi, placeholder: '[REDACTED:sysparmCK]' },
  { regex: /g_ck[=:]\s*[^&\s]+/gi, placeholder: '[REDACTED:g_ck]' },
  { regex: /X-MCP-Auth-[A-Za-z0-9._-]+/gi, placeholder: '[REDACTED:MCP_AUTH]' },
];

export class TraceRedactor {
  /**
   * Apply all redaction patterns to a string value.
   * Patterns are applied sequentially; each matches globally within the string.
   */
  redact(value: string): string {
    let result = value;
    for (const { regex, placeholder } of PATTERNS) {
      result = result.replace(regex, placeholder);
    }
    return result;
  }

  /**
   * Create a shallow copy of an object with all values passed through
   * redactValue() for recursive redaction. String values are redacted
   * via redact(); nested objects and arrays are traversed recursively.
   */
  redactObject<T extends Record<string, unknown>>(obj: T): T {
    const redacted: Record<string, unknown> = {};
    if (obj instanceof Error) {
      redacted.name = obj.name;
      redacted.message = obj.message;
      redacted.stack = obj.stack;
      redacted.cause = obj.cause;
    } else {
      Object.assign(redacted, obj);
    }
    for (const [key, value] of Object.entries(redacted)) {
      redacted[key] = this.redactValue(value);
    }
    return redacted as T;
  }

  /**
   * Polymorphic entry point for redaction dispatch.
   * - string → redact()
   * - object (non-null) → redactObject()
   * - array → map over elements recursively
   * - primitives → pass through unchanged
   */
  redactValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.redact(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item));
    }
    if (value !== null && typeof value === 'object') {
      return this.redactObject(value as Record<string, unknown>);
    }
    return value;
  }
}

// Singleton export for app-wide use
export const traceRedactor = new TraceRedactor();
