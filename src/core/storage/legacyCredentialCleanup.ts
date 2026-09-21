/**
 * Legacy plaintext credential cleanup (D-07) — **declaration-only skeleton**.
 *
 * The behaviour is specified by `tests/core/storage/legacyCredentialCleanup.test.ts`
 * (plan `01-10`, Task 2, RED). The sanitiser's walk, the schema stamp and the
 * storage write-back land in the GREEN commit; this file exists so the suite
 * collects and each case fails on its own assertion.
 */

/** The recognised legacy plaintext credential field names (D-07). */
export const LEGACY_SECRET_FIELDS = [
  'apiKey',
  'token',
  'accessToken',
  'secret',
  'openAiKey',
  'geminiKey',
] as const;

/** The plaintext-cleanup schema version stamped onto a sanitised record. */
export const CLEANUP_SCHEMA_VERSION = 1;

/**
 * Declared shape of the redacted report: field **names** only — never a value,
 * a length, a prefix or a suffix of a removed value.
 */
export function sanitizeLegacyProviderConfig(raw: unknown): {
  value: unknown;
  found: boolean;
  removedFields: string[];
} {
  return { value: raw, found: false, removedFields: [] };
}

/** Declared shape of the repo's result union. */
export async function runLegacyCredentialCleanup(): Promise<
  { ok: true } | { ok: false; code: string }
> {
  return { ok: true };
}
