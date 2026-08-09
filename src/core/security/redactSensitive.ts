// src/core/security/redactSensitive.ts — D-16 field-level redaction for
// storage-bound values (R-10 / §16.5). Every storage-bound object
// (ErrorStore.write, journal persist, export serialization) routes through
// this hook before it touches a sink. Design notes:
//   - A-05: password-like fields are DROPPED (key absent), never masked — the
//     spec's [REDACTED] token is for inline strings only.
//   - RESEARCH Pattern 6: the vault ciphertext envelope must NOT be re-redacted
//     (already encrypted) — isVaultEnvelope() returns it structurally unchanged.
// redactSensitive operates on plaintext-before-encryption and non-secret
// metadata; it never runs on the already-encrypted vault envelope.
import { redact } from '@/core/security/TraceRedactor';

/**
 * Normalized keys whose storage-bound values are DROPPED wholesale — the key is
 * absent from the result, never present as a masked value (A-05 / D-16). Key
 * normalization: lowercase + strip non-alphanumerics (e.g. 'API_KEY' → 'apikey').
 * Note: 'apikey' is intentionally NOT here — apiKey values are redacted inline
 * (value scrubbed to [REDACTED]), not dropped.
 *
 * WR-04: the DROP decision is made by isSensitiveFieldKey (suffix matching),
 * not by exact membership in this set — exact names would miss composite keys
 * like access_token / client_secret / secret_key (normalizeKey('access_token')
 * → 'accesstoken', which is NOT a member).
 */
export const SENSITIVE_FIELD_KEYS: ReadonlySet<string> = new Set([
  'password',
  'secret',
  'token',
  'authorization',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * WR-04: true when a key's normalized form IS a sensitive field name or ENDS
 * with a sensitive suffix — catching composite keys (access_token, auth_token,
 * refresh_token, client_secret, secret_key, bearer_authorization, …) whose
 * exact normalized names are not members of SENSITIVE_FIELD_KEYS. Values under
 * these keys are DROPPED, never masked (A-05).
 *
 * Note 'secret_key' → normalizeKey → 'secretkey': it does NOT end with
 * 'secret', so a compound rule (secret-root + 'key' suffix) catches it without
 * broadening the drop to benign 'key'-suffixed names ('apikey' stays inline-
 * redacted, not dropped).
 */
export function isSensitiveFieldKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_FIELD_KEYS.has(normalized) ||
    normalized.endsWith('token') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('password') ||
    normalized.endsWith('authorization') ||
    (normalized.endsWith('key') &&
      (normalized.includes('secret') || normalized.includes('password')))
  );
}

function isByteArrayLike(value: unknown): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

/**
 * True when `value` carries the vault envelope marker shape { salt, iv,
 * ciphertext } with byte-array-like fields. Such values are already-encrypted
 * and must pass through redactSensitive structurally unchanged (RESEARCH
 * Pattern 6 design note; T-2-02-03).
 */
export function isVaultEnvelope(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    isByteArrayLike(record.salt) && isByteArrayLike(record.iv) && isByteArrayLike(record.ciphertext)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively redacts a storage-bound value:
 *   - string        → TraceRedactor.redact (O.13 patterns → [REDACTED])
 *   - plain object  → recurse into enumerable own string properties; DROP any
 *                     property whose normalized key is in SENSITIVE_FIELD_KEYS
 *   - array         → recurse per element
 *   - vault envelope → returned structurally unchanged (isVaultEnvelope guard)
 *   - other primitives / non-plain objects → passed through unchanged
 */
export function redactSensitive(value: unknown): unknown {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map((element) => redactSensitive(element));
  if (isVaultEnvelope(value)) return value;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isSensitiveFieldKey(key)) continue; // DROP, never mask (WR-04: suffix match)
      out[key] = redactSensitive(nested);
    }
    return out;
  }
  return value;
}
