import { debugLog } from '../log/debugLog';

/**
 * Legacy plaintext credential cleanup (D-07) — one idempotent, redacted,
 * throw-free migration that destroys the prototype's plaintext provider
 * credentials **in place**.
 *
 * The prototype wrote provider keys into `chrome.storage.local` from five write
 * sites, and any extension context holding the `storage` permission could read
 * them. D-07 requires that they be removed now, that only recognised secret
 * fields be removed, that authorised non-secret metadata survive, that the
 * operation be idempotent and redacted, and that the value be destroyed rather
 * than relocated — Phase 2 owns secure credential storage (KeyVault) and Phase 1
 * must not create a holding place for the plaintext value.
 *
 * Four rules this module exists to keep:
 *   1. **Only recognised fields.** `LEGACY_SECRET_FIELDS` is the complete set of
 *      names this migration may delete; an unrecognised field is never touched,
 *      so authorised non-secret metadata survives.
 *   2. **Field names only.** The report and every log line carry names. A
 *      removed value is never returned, logged, displayed, exported,
 *      transmitted or retained in any form, and no derived value of any kind —
 *      no digest, no shortened fragment, no transformed copy, no length, no
 *      prefix and no suffix — is produced, so nothing here can disclose whether
 *      a value was found or what it was.
 *   3. **Destroy in place.** The sanitised record is written back over the same
 *      key. Nothing is encrypted, re-keyed or stashed anywhere else.
 *   4. **Total and throw-free.** `null`, an empty object, an array, a string, a
 *      number and a cyclic value each return a safe result with an empty
 *      removal list, and the runner never throws into its caller — the
 *      repository's "migrations are throw-free and total" convention
 *      (`WorkspaceState` / `onboardingStateStore` / `chromeStorageAdapter`).
 *
 * **Operator authorisation (one-way).** The in-place deletion was authorised
 * before the first write by the operator decision recorded as `D-01-10-1` in
 * `01-MIGRATION-INVENTORY.md` § Change control: the removal is irreversible from
 * the plugin's side (there is no server-side or repository copy of a legacy
 * key), so affected users must re-enter their credentials once Phase 2 ships
 * secure credential storage.
 */

/**
 * The recognised legacy plaintext credential field names (D-07).
 *
 * `apiKey` is the prototype's per-provider field; `token`, `accessToken` and
 * `secret` are the equivalent spellings D-07 names; `openAiKey` and `geminiKey`
 * are the two top-level legacy key fields the prototype stored beside the
 * provider collection. **This list is the whole deletion surface** — a name that
 * is not here is never removed.
 */
export const LEGACY_SECRET_FIELDS = [
  'apiKey',
  'token',
  'accessToken',
  'secret',
  'openAiKey',
  'geminiKey',
] as const;

/**
 * The plaintext-cleanup schema version. A sanitised record carries it under
 * `plaintextCleanupSchemaVersion`, so a later run recognises completed work and
 * skips the walk instead of re-walking the tree.
 */
export const CLEANUP_SCHEMA_VERSION = 1;

/** Where the cleanup schema version is stamped on a sanitised record. */
const CLEANUP_VERSION_FIELD = 'plaintextCleanupSchemaVersion';

/** The prototype's persisted provider configuration key (zustand `persist`). */
const PROVIDER_CONFIG_STORAGE_KEY = 'np_store';

/** The typed failure code every non-recoverable path reports. */
const CLEANUP_FAILED_CODE = 'LEGACY_CREDENTIAL_CLEANUP_FAILED';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLegacySecretField(key: string): boolean {
  return (LEGACY_SECRET_FIELDS as readonly string[]).includes(key);
}

/**
 * Rebuild one node, dropping every recognised credential field on the way.
 *
 * The clone is built rather than mutated: a matched key's **value is never
 * read**, so it cannot leak into the returned record, the report or a log. A
 * node already visited returns `undefined` instead of being re-linked, so a
 * cyclic input yields an acyclic, serialisable result rather than throwing in
 * `JSON.stringify` in the caller.
 */
function sanitizeNode(node: unknown, removed: Set<string>, seen: Set<object>): unknown {
  if (Array.isArray(node)) {
    if (seen.has(node)) return undefined;
    seen.add(node);
    return node.map((entry) => sanitizeNode(entry, removed, seen));
  }

  if (!isPlainObject(node)) return node;
  if (seen.has(node)) return undefined;
  seen.add(node);

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(node)) {
    if (isLegacySecretField(key)) {
      // Record the NAME only — the value is deliberately never read.
      removed.add(key);
      continue;
    }
    clone[key] = sanitizeNode(node[key], removed, seen);
  }
  return clone;
}

/**
 * Remove the recognised legacy plaintext credential fields from a provider
 * configuration, destroying them in place and stamping the cleanup version.
 *
 * Total and throw-free: an input that is not a provider record (`null`,
 * `undefined`, an array, a string, a number) is returned untouched with an empty
 * report, and a record that already carries the current cleanup version is
 * returned unchanged — which is what makes a second run report zero removals and
 * return deep-equal output.
 *
 * The returned report is redacted by construction: `removedFields` carries the
 * recognised field **names** (deduplicated and sorted), and nothing else in the
 * report can carry a value, a length, a prefix, a suffix or a derived fragment.
 */
export function sanitizeLegacyProviderConfig(raw: unknown): {
  value: unknown;
  found: boolean;
  removedFields: string[];
} {
  if (!isPlainObject(raw)) {
    return { value: raw, found: false, removedFields: [] };
  }

  // Already cleaned: skip the walk entirely. This is the short-circuit that
  // keeps a service-worker wake cheap and side-effect-free (T-1-53).
  if (raw[CLEANUP_VERSION_FIELD] === CLEANUP_SCHEMA_VERSION) {
    return { value: raw, found: false, removedFields: [] };
  }

  const removed = new Set<string>();
  const value = sanitizeNode(raw, removed, new Set<object>()) as Record<string, unknown>;
  value[CLEANUP_VERSION_FIELD] = CLEANUP_SCHEMA_VERSION;

  return {
    value,
    found: removed.size > 0,
    removedFields: [...removed].sort(),
  };
}

/**
 * Run the cleanup against the stored provider configuration.
 *
 * Idempotent and safe on every wake: it reads the stored record, sanitises it,
 * and writes the sanitised record back **only when a recognised credential field
 * was actually removed**. It never throws into its caller and never reports the
 * earlier value's presence beyond the result union — the UI layer receives no
 * found/not-found distinction at all, so the notice's appearance discloses
 * nothing about whether a value existed.
 *
 * Failure paths are typed and logged with a `SCREAMING_SNAKE` code carrying
 * field names only, never the value it could not delete.
 */
export async function runLegacyCredentialCleanup(): Promise<
  { ok: true } | { ok: false; code: string }
> {
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
    // No extension storage in this context (a plain page, or a test without the
    // mock): a soft success — there is nothing to clean and nothing to report.
    return { ok: true };
  }

  try {
    const stored = (await chrome.storage.local.get(PROVIDER_CONFIG_STORAGE_KEY)) as
      | Record<string, unknown>
      | undefined;
    const raw = stored?.[PROVIDER_CONFIG_STORAGE_KEY];
    if (raw === undefined || raw === null) return { ok: true };

    const wasSerialised = typeof raw === 'string';
    let parsed: unknown = raw;
    if (wasSerialised) {
      try {
        parsed = JSON.parse(raw as string);
      } catch {
        // Not a record this migration can recognise. It is left exactly as it
        // is: a value the migration cannot parse is never partially rewritten.
        return { ok: true };
      }
    }

    const { value, found, removedFields } = sanitizeLegacyProviderConfig(parsed);
    if (!found) return { ok: true };

    await chrome.storage.local.set({
      [PROVIDER_CONFIG_STORAGE_KEY]: wasSerialised ? JSON.stringify(value) : value,
    });

    // Field NAMES only — this is the boundary where a careless context object
    // would leak the value it just destroyed.
    debugLog('LEGACY_CREDENTIALS_REMOVED', 'Legacy plaintext credential fields removed', {
      removedFields,
      schemaVersion: CLEANUP_SCHEMA_VERSION,
    });

    return { ok: true };
  } catch (error) {
    debugLog(CLEANUP_FAILED_CODE, 'Legacy plaintext credential cleanup failed', {
      reason: error instanceof Error ? error.name : typeof error,
    });
    return { ok: false, code: CLEANUP_FAILED_CODE };
  }
}
