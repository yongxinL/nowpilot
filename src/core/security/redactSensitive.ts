/**
 * redactSensitive — the single redaction choke point (§16.5, D2-21).
 *
 * Every persistence and log boundary routes a context object through
 * `redactSensitive` **before** it is written: the journal, `ErrorStore`,
 * `debugLog`, diagnostics and export paths all import this module rather than
 * each growing a private list. The boundary is by field **name**:
 *
 *   - a value stored under a recognised sensitive key is replaced by
 *     `REDACTED_PLACEHOLDER` at any depth;
 *   - nothing derived from a redacted value is ever produced, attached or
 *     returned — no length, prefix, suffix, mask, fingerprint or digest — so
 *     the output cannot disclose whether a value existed or what it was
 *     (§16.5, D2-06 "no field derived from a secret");
 *   - free text is never guessed at. This is not a content scanner; a secret
 *     pasted into an unrecognised field is a caller defect, not a redaction
 *     failure this walk can detect. (The §4.4 value-shape patterns belong to
 *     `TraceRedactor`, which is Phase 11's module — deliberately not restated
 *     here. `LEGACY_SECRET_FIELDS` in `legacyCredentialCleanup.ts` stays the
 *     Phase-1 *deletion* surface and is also not restated here.)
 *
 * The walk is **total and throw-free**: `null`, `undefined`, primitives, a
 * function, a symbol, a `Date`, a `Map` and a cyclic or repeated structure all
 * resolve to a deterministic, serialisable value, and no input makes it throw.
 */

/** The one placeholder a redacted value is replaced by. */
export const REDACTED_PLACEHOLDER = '[REDACTED]';

/** A repeated object reference (a cycle) resolves to this instead of a loop. */
export const CIRCULAR_PLACEHOLDER = '[Circular]';

/** A non-serialisable primitive (a function or a symbol) resolves to this. */
export const UNSERIALISABLE_PLACEHOLDER = '[Unserialisable]';

/**
 * The recognised sensitive **field-name patterns**, matched against a
 * normalised key (lower-cased, non-alphanumerics stripped) by substring. One
 * frozen list, exported for reuse — a call site never grows its own copy, and
 * a key this list misses is a deliberate gap the reviewer can see.
 *
 * The list is credential-shaped names only: over-redaction is the safe
 * direction, under-redaction is the failure this module exists to prevent.
 */
export const SENSITIVE_FIELD_NAMES: readonly string[] = Object.freeze([
  'apikey',
  'token',
  'secret',
  'password',
  'passwd',
  'credential',
  'authorization',
  'bearer',
  'privatekey',
  'accesskey',
  'signingkey',
  'encryptionkey',
  'keymaterial',
  'jsessionid',
  'sysparmck',
]);

/** A known-shape error name (`OperationError`, `TypeError`, …). */
const ERROR_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Normalise a key for matching: lower-case, alphanumerics only. */
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Is this field name recognised as sensitive? Case-, `_`- and `-`-insensitive,
 * so `apiKey`, `api_key`, `API-KEY` and `X-Api-Key` all match `apikey`.
 */
export function isSensitiveFieldName(key: string): boolean {
  const normalised = normaliseKey(key);
  return SENSITIVE_FIELD_NAMES.some((pattern) => normalised.includes(pattern));
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
    seen.add(value);
    return value.map((entry) => walk(entry, seen));
  }

  if (value === null) return null;

  if (typeof value !== 'object') {
    // A function or a symbol cannot be serialised; a stable placeholder keeps
    // the whole result stringifiable. Every other primitive passes through.
    if (typeof value === 'function' || typeof value === 'symbol') {
      return UNSERIALISABLE_PLACEHOLDER;
    }
    return value;
  }

  // A non-plain object (Date, RegExp, Map, …) has no own key/value pairs this
  // walk is contracted to redact; it passes through unchanged.
  if (!isPlainObject(value)) return value;

  if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
  seen.add(value);

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    clone[key] = isSensitiveFieldName(key) ? REDACTED_PLACEHOLDER : walk(value[key], seen);
  }
  return clone;
}

/**
 * Replace every value under a recognised sensitive key with
 * `REDACTED_PLACEHOLDER`, at any depth, including inside arrays.
 *
 * Deterministic: the same input produces a deep-equal output on every call.
 * Total: never throws, and a cyclic or repeated object reference terminates
 * with `CIRCULAR_PLACEHOLDER` rather than looping or re-linking the cycle.
 */
export function redactSensitive(value: unknown): unknown {
  return walk(value, new WeakSet<object>());
}

/**
 * The redacted context for a caught value: an error **name** (or a `typeof`)
 * and nothing else — never a message string, never a stack, never a value.
 *
 * The name is read structurally because a thrown `DOMException` is not
 * `instanceof Error` in every environment, and it must match the identifier
 * shape `ERROR_NAME_PATTERN` — so an arbitrary tagged object cannot smuggle a
 * secret through the `name` field.
 */
export function redactErrorContext(error: unknown): { reason: string } {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && ERROR_NAME_PATTERN.test(name)) return { reason: name };
  }
  return { reason: typeof error };
}
