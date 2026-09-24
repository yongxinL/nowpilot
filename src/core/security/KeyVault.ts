import type { ProviderId } from '../../types';
import { debugLog } from '../log/debugLog';
import {
  decryptCredential,
  encryptCredential,
  parseCredentialEnvelope,
  parseProviderId,
  type EncryptedStorageErrorCode,
} from './EncryptedStorage';
import { redactErrorContext, redactSensitive } from './redactSensitive';

/**
 * KeyVault — the versioned encrypted-credential store (D2-03, §15.2).
 *
 * ## The contract (frozen for Phase 3)
 *
 * `store` / `replace` / `retrieve` / `isConfigured` / `delete` /
 * `inspectEnvelopeVersion`, each returning a result union and never a
 * `DOMException`. What the contract deliberately does **not** expose: a
 * list-all, an export, a credential preview, a masked-value return or a
 * generic arbitrary-secret setter — a credential is reachable only through
 * `retrieve`, and only for the provider it was stored under.
 *
 * ## Chosen semantics (documented per the plan; asserted by the suite)
 *
 * - **`store` is create-only.** Storing over an existing value returns the
 *   typed conflict `KEY_VAULT_ALREADY_CONFIGURED` instead of silently
 *   rotating a working credential; `replace` is the explicit way to supersede
 *   one. A caller flows `isConfigured ? replace : store`. The guarantee is
 *   **best-effort, not atomic**: `chrome.storage` offers no compare-and-set, so
 *   two concurrent `store` calls for the same provider can both observe
 *   "absent", both return `{ ok: true }`, and the later envelope silently
 *   supersedes the earlier one. Only `CredentialStorePort` (Phase 3) calls it,
 *   so the practical risk is low; a caller that needs the strict guarantee must
 *   serialise its own calls.
 * - **`replace` requires an existing credential** and returns
 *   `KEY_VAULT_NOT_CONFIGURED` otherwise — it never doubles as a first store.
 * - **`isConfigured` reports presence**, not validity: a corrupt stored value
 *   is still "something is stored" (recover with `replace` or `delete`).
 * - **`delete` is idempotent** — deleting an absent credential succeeds.
 * - **`inspectEnvelopeVersion` can never return plaintext**, only
 *   `{ present, version, providerId }`, and `version` is `null` when the
 *   stored value does not parse.
 *
 * ## Dependencies (injected, with production defaults)
 *
 * `extensionId` and the storage area default to `chrome.runtime.id` and
 * `chrome.storage.local`, resolved **per call** — never at module scope — so
 * the module is importable in every context (including a test environment with
 * neither) and fails closed with `KEY_VAULT_UNAVAILABLE` rather than
 * fabricating a key. `readInstallSecret` is typed as the exact union signature
 * `02-04`'s `Setting.readInstallSecret()` exports
 * (`() => Promise<{ ok: true; value: string } | { ok: false; code }>`), so the
 * production wiring is a direct pass-through with no adapter module between the
 * two plans. A secret-read failure fails the operation closed and persists
 * nothing — never a fallback secret, never an empty string.
 *
 * ## Storage
 *
 * Only the envelope is persisted, under one canonical per-provider key built
 * from `CREDENTIAL_KEY_PREFIX` and the validated `ProviderId`; no key is ever
 * built from arbitrary input. §15.1 lists `np_providers` (encrypted `apiKey`
 * fields) but names no key for a standalone encrypted credential, so
 * `np_credential_<providerId>` is locked here as an additive naming decision
 * (the D2-29 "record the follow-up, do not edit the spec" pattern) and
 * recorded in this module comment rather than in `PRODUCT_SPEC.md`.
 *
 * ## Redaction
 *
 * No catch returns or logs a credential value, a length, a fragment or a
 * derived value: every context goes through `redactSensitive` and every reason
 * through `redactErrorContext`, and only `SCREAMING_SNAKE` codes are logged.
 */

/**
 * The minimal storage-area surface the vault needs. `chrome.storage.local`
 * satisfies it structurally; tests pass a Map-backed fake.
 */
export interface StorageAreaLike {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

/** The install-secret provider signature `02-04`'s `Setting.readInstallSecret()` exports. */
export type InstallSecretReadResult = { ok: true; value: string } | { ok: false; code: string };

export interface KeyVaultDeps {
  /** Production default: `chrome.runtime.id` (resolved per call). */
  extensionId?: string;
  /** Production default: `chrome.storage.local` (resolved per call). */
  storage?: StorageAreaLike;
  readInstallSecret: () => Promise<InstallSecretReadResult>;
}

export type KeyVaultErrorCode =
  | 'KEY_VAULT_INVALID_PROVIDER'
  | 'KEY_VAULT_INVALID_CREDENTIAL'
  | 'KEY_VAULT_UNAVAILABLE'
  | 'KEY_VAULT_SECRET_UNAVAILABLE'
  | 'KEY_VAULT_ALREADY_CONFIGURED'
  | 'KEY_VAULT_NOT_CONFIGURED'
  | 'KEY_VAULT_READ_FAILED'
  | 'KEY_VAULT_WRITE_FAILED'
  | 'KEY_VAULT_DELETE_FAILED'
  | EncryptedStorageErrorCode;

export type KeyVaultResult = { ok: true } | { ok: false; code: KeyVaultErrorCode };

export type KeyVaultRetrieveResult =
  | { ok: true; credential: string }
  | { ok: false; code: KeyVaultErrorCode };

/** What `inspectEnvelopeVersion` may report — version metadata, never a value. */
export interface EnvelopeInspection {
  present: boolean;
  version: number | null;
  providerId: ProviderId;
}

export type KeyVaultInspectResult =
  | { ok: true; value: EnvelopeInspection }
  | { ok: false; code: KeyVaultErrorCode };

export interface KeyVault {
  store(providerId: ProviderId, credential: string): Promise<KeyVaultResult>;
  replace(providerId: ProviderId, credential: string): Promise<KeyVaultResult>;
  retrieve(providerId: ProviderId): Promise<KeyVaultRetrieveResult>;
  isConfigured(providerId: ProviderId): Promise<boolean>;
  delete(providerId: ProviderId): Promise<KeyVaultResult>;
  inspectEnvelopeVersion(providerId: ProviderId): Promise<KeyVaultInspectResult>;
}

/** The one canonical key-prefix constant. */
export const CREDENTIAL_KEY_PREFIX = 'np_credential_';

/**
 * The per-provider storage key. Takes the typed `ProviderId` — the runtime
 * membership check happens at the operation boundary, so no arbitrary string
 * can reach the key builder.
 */
export function credentialStorageKey(providerId: ProviderId): string {
  return `${CREDENTIAL_KEY_PREFIX}${providerId}`;
}

function resolveExtensionId(deps: KeyVaultDeps): string | null {
  if (typeof deps.extensionId === 'string' && deps.extensionId.length > 0) return deps.extensionId;
  const injected = typeof chrome !== 'undefined' ? chrome?.runtime?.id : undefined;
  return typeof injected === 'string' && injected.length > 0 ? injected : null;
}

function resolveStorageArea(deps: KeyVaultDeps): StorageAreaLike | null {
  if (deps.storage) return deps.storage;
  const area = typeof chrome !== 'undefined' ? chrome?.storage?.local : undefined;
  return area ? (area as unknown as StorageAreaLike) : null;
}

function isStorableCredential(credential: unknown): credential is string {
  return typeof credential === 'string' && credential.trim().length > 0;
}

export function createKeyVault(deps: KeyVaultDeps): KeyVault {
  /** Every log context is redacted before it is written (§16.5). */
  function logFailure(
    code: KeyVaultErrorCode,
    message: string,
    context: Record<string, unknown>,
  ): void {
    debugLog(code, message, redactSensitive(context) as Record<string, unknown>);
  }

  function invalidProvider(): { ok: false; code: 'KEY_VAULT_INVALID_PROVIDER' } {
    // The rejected value is never logged — only its type, because a caller
    // passing a credential where a provider id belongs must not leak.
    logFailure('KEY_VAULT_INVALID_PROVIDER', 'Credential operation rejected for a non-provider id', {
      reason: 'non-member',
    });
    return { ok: false, code: 'KEY_VAULT_INVALID_PROVIDER' };
  }

  function invalidCredential(providerId: ProviderId): { ok: false; code: 'KEY_VAULT_INVALID_CREDENTIAL' } {
    logFailure('KEY_VAULT_INVALID_CREDENTIAL', 'Credential operation rejected for an empty value', {
      providerId,
    });
    return { ok: false, code: 'KEY_VAULT_INVALID_CREDENTIAL' };
  }

  function unavailable(): { ok: false; code: 'KEY_VAULT_UNAVAILABLE' } {
    logFailure('KEY_VAULT_UNAVAILABLE', 'Credential vault unavailable in this context', {
      reason: 'missing-extension-id-or-storage',
    });
    return { ok: false, code: 'KEY_VAULT_UNAVAILABLE' };
  }

  function decryptFailed(providerId: ProviderId): { ok: false; code: 'CREDENTIAL_DECRYPT_FAILED' } {
    // One indistinguishable code for malformed, tampered, foreign and
    // wrong-key values alike; the reason is never a value.
    logFailure('CREDENTIAL_DECRYPT_FAILED', 'Stored credential failed to decrypt', { providerId });
    return { ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' };
  }

  async function readStoredValue(
    storage: StorageAreaLike,
    key: string,
  ): Promise<{ ok: true; value: unknown } | { ok: false; code: 'KEY_VAULT_READ_FAILED' }> {
    try {
      const stored = await storage.get(key);
      const value = stored?.[key];
      return { ok: true, value: value === undefined || value === null ? null : value };
    } catch (error) {
      logFailure('KEY_VAULT_READ_FAILED', 'Credential storage read failed', {
        reason: redactErrorContext(error).reason,
      });
      return { ok: false, code: 'KEY_VAULT_READ_FAILED' };
    }
  }

  /** The install secret, or `null` — a failed read is never an empty string. */
  async function readInstallSecretValue(): Promise<string | null> {
    try {
      const result = await deps.readInstallSecret();
      if (result?.ok === true && typeof result.value === 'string' && result.value.length > 0) {
        return result.value;
      }
    } catch (error) {
      logFailure('KEY_VAULT_SECRET_UNAVAILABLE', 'Install secret provider failed', {
        reason: redactErrorContext(error).reason,
      });
      return null;
    }

    logFailure('KEY_VAULT_SECRET_UNAVAILABLE', 'Install secret is unavailable', {
      reason: 'unusable-result',
    });
    return null;
  }

  /** Encrypt and persist one envelope. Shared by `store` and `replace`. */
  async function writeCredential(
    providerId: ProviderId,
    credential: string,
    context: { extensionId: string; storage: StorageAreaLike },
    key: string,
  ): Promise<KeyVaultResult> {
    const installSecret = await readInstallSecretValue();
    if (installSecret === null) return { ok: false, code: 'KEY_VAULT_SECRET_UNAVAILABLE' };

    const encrypted = await encryptCredential({
      providerId,
      plaintext: credential,
      installSecret,
      extensionId: context.extensionId,
    });
    if (!encrypted.ok) return { ok: false, code: encrypted.code };

    try {
      await context.storage.set({ [key]: encrypted.envelope });
    } catch (error) {
      logFailure('KEY_VAULT_WRITE_FAILED', 'Credential envelope write failed', {
        providerId,
        reason: redactErrorContext(error).reason,
      });
      return { ok: false, code: 'KEY_VAULT_WRITE_FAILED' };
    }

    debugLog('KEY_VAULT_CREDENTIAL_STORED', 'Credential envelope stored', {
      providerId,
      version: encrypted.envelope.v,
    });
    return { ok: true };
  }

  async function store(providerId: ProviderId, credential: string): Promise<KeyVaultResult> {
    const provider = parseProviderId(providerId);
    if (provider === null) return invalidProvider();
    if (!isStorableCredential(credential)) return invalidCredential(provider);

    const extensionId = resolveExtensionId(deps);
    const storage = resolveStorageArea(deps);
    if (extensionId === null || storage === null) return unavailable();

    const key = credentialStorageKey(provider);
    // Best-effort create-only (see the module semantics): read-then-write with
    // no CAS, so a concurrent `store` can race this check. Serialise callers if
    // the strict guarantee is ever needed.
    const existing = await readStoredValue(storage, key);
    if (!existing.ok) return existing;
    if (existing.value !== null) {
      debugLog(
        'KEY_VAULT_ALREADY_CONFIGURED',
        'A credential is already stored for this provider; use replace to supersede it',
        { providerId: provider },
      );
      return { ok: false, code: 'KEY_VAULT_ALREADY_CONFIGURED' };
    }

    return writeCredential(provider, credential, { extensionId, storage }, key);
  }

  async function replace(providerId: ProviderId, credential: string): Promise<KeyVaultResult> {
    const provider = parseProviderId(providerId);
    if (provider === null) return invalidProvider();
    if (!isStorableCredential(credential)) return invalidCredential(provider);

    const extensionId = resolveExtensionId(deps);
    const storage = resolveStorageArea(deps);
    if (extensionId === null || storage === null) return unavailable();

    const key = credentialStorageKey(provider);
    const existing = await readStoredValue(storage, key);
    if (!existing.ok) return existing;
    if (existing.value === null) {
      return { ok: false, code: 'KEY_VAULT_NOT_CONFIGURED' };
    }

    return writeCredential(provider, credential, { extensionId, storage }, key);
  }

  async function retrieve(providerId: ProviderId): Promise<KeyVaultRetrieveResult> {
    const provider = parseProviderId(providerId);
    if (provider === null) return invalidProvider();

    const extensionId = resolveExtensionId(deps);
    const storage = resolveStorageArea(deps);
    if (extensionId === null || storage === null) return unavailable();

    const existing = await readStoredValue(storage, credentialStorageKey(provider));
    if (!existing.ok) return existing;
    if (existing.value === null) return { ok: false, code: 'KEY_VAULT_NOT_CONFIGURED' };

    const parsed = parseCredentialEnvelope(existing.value);
    // A stored envelope must be the one for the requested provider: a value
    // copied under another provider's key must never be handed back.
    if (!parsed.ok || parsed.envelope.providerId !== provider) return decryptFailed(provider);

    const installSecret = await readInstallSecretValue();
    if (installSecret === null) return { ok: false, code: 'KEY_VAULT_SECRET_UNAVAILABLE' };

    const decrypted = await decryptCredential({
      envelope: parsed.envelope,
      installSecret,
      extensionId,
    });
    if (!decrypted.ok) return decryptFailed(provider);

    // The only path in this module that returns plaintext.
    return { ok: true, credential: decrypted.plaintext };
  }

  async function isConfigured(providerId: ProviderId): Promise<boolean> {
    const provider = parseProviderId(providerId);
    if (provider === null) return false;

    const storage = resolveStorageArea(deps);
    if (storage === null) return false;

    const existing = await readStoredValue(storage, credentialStorageKey(provider));
    return existing.ok && existing.value !== null;
  }

  async function deleteCredential(providerId: ProviderId): Promise<KeyVaultResult> {
    const provider = parseProviderId(providerId);
    if (provider === null) return invalidProvider();

    const storage = resolveStorageArea(deps);
    if (storage === null) return unavailable();

    try {
      // Idempotent: removing an absent key succeeds, so a second delete is a
      // success too.
      await storage.remove(credentialStorageKey(provider));
    } catch (error) {
      logFailure('KEY_VAULT_DELETE_FAILED', 'Credential delete failed', {
        providerId: provider,
        reason: redactErrorContext(error).reason,
      });
      return { ok: false, code: 'KEY_VAULT_DELETE_FAILED' };
    }

    debugLog('KEY_VAULT_CREDENTIAL_DELETED', 'Stored credential removed', { providerId: provider });
    return { ok: true };
  }

  async function inspectEnvelopeVersion(providerId: ProviderId): Promise<KeyVaultInspectResult> {
    const provider = parseProviderId(providerId);
    if (provider === null) return invalidProvider();

    const storage = resolveStorageArea(deps);
    if (storage === null) return unavailable();

    const existing = await readStoredValue(storage, credentialStorageKey(provider));
    if (!existing.ok) return existing;
    if (existing.value === null) {
      return { ok: true, value: { present: false, version: null, providerId: provider } };
    }

    const parsed = parseCredentialEnvelope(existing.value);
    return {
      ok: true,
      value: {
        present: true,
        // Version metadata only — this method has no path that can return a
        // credential value.
        version: parsed.ok ? parsed.envelope.v : null,
        providerId: provider,
      },
    };
  }

  return {
    store,
    replace,
    retrieve,
    isConfigured,
    delete: deleteCredential,
    inspectEnvelopeVersion,
  };
}
