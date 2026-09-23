import type { ProviderId } from '../../types';
import { debugLog } from '../../core/log/debugLog';
import { redactErrorContext } from '../../core/security/redactSensitive';

/**
 * CredentialStorePort — the D2-03 credential contract, frozen for Phase 3.
 *
 * Phase 1 shipped the declaration only (D-05): no implementation existed and no
 * call site read it. Phase 2 extends it in place to the full D2-03 surface and
 * supplies the vault-backed implementation, so Phase 3's re-entry flow validates
 * against one stable contract:
 *
 *   store · replace · retrieve (authorised consumer) · isConfigured · delete ·
 *   inspectEnvelopeVersion
 *
 * **The absences are part of the contract.** There is deliberately no
 * list-all-plaintext, no export, no reveal/preview, no masked-value return and
 * no generic arbitrary-secret setter — a credential is reachable only through
 * `retrieve`, and only for the provider it was stored under (D2-03). The
 * forbidden names are asserted absent from the created object's own keys.
 *
 * **This module never imports the vault.** `createCredentialStorePort` takes a
 * `CredentialVaultLike` parameter, so the port stays importable from a
 * presentation surface without pulling the crypto graph in — which is what makes
 * the `src/components/**` isolation scan meaningful rather than a convention.
 * The two leaf modules this file does import (`debugLog`, `redactSensitive`)
 * have no imports of their own.
 *
 * **No Phase 2 UI path calls this port** (D2-01, D2-02, D2-04): the contract
 * exists so Phase 3's production flow stores through it after real provider
 * validation succeeds, and so fixture-backed success can never write a real
 * credential.
 *
 * ## Failure surface
 *
 * Every expected runtime failure is a typed redacted code from
 * `CredentialStoreErrorCode`. Vault codes are translated at this boundary, so a
 * caller never reads the vault's internal vocabulary; a thrown vault call is
 * caught and reported as `CREDENTIAL_STORE_FAILED` with an error **name** only.
 * No credential value, fragment, length or derived value is logged or returned
 * by any method other than `retrieve`.
 */

/**
 * The canonical port failure codes.
 *
 * `CREDENTIAL_STORE_UNAVAILABLE` covers "no vault in this context" and "the
 * install secret could not be read" alike: both mean the same thing to a
 * caller, and neither is actionable differently.
 */
export type CredentialStoreErrorCode =
  | 'CREDENTIAL_STORE_INVALID_CREDENTIAL'
  | 'CREDENTIAL_STORE_INVALID_PROVIDER'
  | 'CREDENTIAL_STORE_ALREADY_CONFIGURED'
  | 'CREDENTIAL_STORE_NOT_CONFIGURED'
  | 'CREDENTIAL_STORE_UNAVAILABLE'
  | 'CREDENTIAL_STORE_DECRYPT_FAILED'
  | 'CREDENTIAL_STORE_FAILED';

export type CredentialStoreResult =
  | { ok: true }
  | { ok: false; code: CredentialStoreErrorCode };

/**
 * `retrieve` is the one method whose success arm can carry a credential
 * (D2-03). Its result is a distinct type so no other operation can return one
 * by accident.
 */
export type CredentialStoreRetrieveResult =
  | { ok: true; credential: string }
  | { ok: false; code: CredentialStoreErrorCode };

/** Envelope metadata only — never a value, never a fragment of one. */
export interface CredentialEnvelopeInspection {
  present: boolean;
  version: number | null;
  providerId: ProviderId;
}

export type CredentialStoreInspectResult =
  | { ok: true; value: CredentialEnvelopeInspection }
  | { ok: false; code: CredentialStoreErrorCode };

/**
 * The frozen credential contract.
 *
 * `isConfigured` and `store` keep their Phase-1 shapes; the four added
 * operations use the same result-union style. The code union is narrowed from
 * Phase 1's `string` — a caller that read `.code` as a string still typechecks.
 */
export interface CredentialStorePort {
  isConfigured(providerId: ProviderId): Promise<boolean>;
  store(providerId: ProviderId, credential: string): Promise<CredentialStoreResult>;
  replace(providerId: ProviderId, credential: string): Promise<CredentialStoreResult>;
  retrieve(providerId: ProviderId): Promise<CredentialStoreRetrieveResult>;
  delete(providerId: ProviderId): Promise<CredentialStoreResult>;
  inspectEnvelopeVersion(providerId: ProviderId): Promise<CredentialStoreInspectResult>;
}

/**
 * A vault result, structurally — `code` stays wide here so the real `KeyVault`
 * (whose codes are its own union) satisfies this type with no adapter module
 * and no import edge between the two files.
 */
export type CredentialVaultResult = { ok: true } | { ok: false; code: string };
export type CredentialVaultRetrieveResult =
  | { ok: true; credential: string }
  | { ok: false; code: string };
export type CredentialVaultInspectResult =
  | { ok: true; value: CredentialEnvelopeInspection }
  | { ok: false; code: string };

/**
 * The vault surface the port needs, and nothing more. `createKeyVault()`'s
 * return value satisfies it structurally (asserted at compile time by the
 * suite), so production wiring is `createCredentialStorePort(createKeyVault({
 * readInstallSecret }))` with no adapter in between.
 */
export interface CredentialVaultLike {
  store(providerId: ProviderId, credential: string): Promise<CredentialVaultResult>;
  replace(providerId: ProviderId, credential: string): Promise<CredentialVaultResult>;
  retrieve(providerId: ProviderId): Promise<CredentialVaultRetrieveResult>;
  isConfigured(providerId: ProviderId): Promise<boolean>;
  delete(providerId: ProviderId): Promise<CredentialVaultResult>;
  inspectEnvelopeVersion(providerId: ProviderId): Promise<CredentialVaultInspectResult>;
}

/**
 * Upper bound on a credential at this boundary. Provider API keys are short;
 * the cap exists so an accidental large paste (a document, a whole file) is
 * rejected rather than encrypted and persisted.
 */
export const CREDENTIAL_MAX_LENGTH = 4096;

/**
 * The vault-code translation table. A code this table does not know — including
 * a vault's future code — degrades to `CREDENTIAL_STORE_FAILED` rather than
 * leaking through, so the port's vocabulary stays closed.
 */
const VAULT_CODE_MAP: Record<string, CredentialStoreErrorCode> = {
  KEY_VAULT_INVALID_PROVIDER: 'CREDENTIAL_STORE_INVALID_PROVIDER',
  KEY_VAULT_INVALID_CREDENTIAL: 'CREDENTIAL_STORE_INVALID_CREDENTIAL',
  KEY_VAULT_ALREADY_CONFIGURED: 'CREDENTIAL_STORE_ALREADY_CONFIGURED',
  KEY_VAULT_NOT_CONFIGURED: 'CREDENTIAL_STORE_NOT_CONFIGURED',
  KEY_VAULT_UNAVAILABLE: 'CREDENTIAL_STORE_UNAVAILABLE',
  KEY_VAULT_SECRET_UNAVAILABLE: 'CREDENTIAL_STORE_UNAVAILABLE',
  KEY_VAULT_READ_FAILED: 'CREDENTIAL_STORE_FAILED',
  KEY_VAULT_WRITE_FAILED: 'CREDENTIAL_STORE_FAILED',
  KEY_VAULT_DELETE_FAILED: 'CREDENTIAL_STORE_FAILED',
  CREDENTIAL_DECRYPT_FAILED: 'CREDENTIAL_STORE_DECRYPT_FAILED',
  CREDENTIAL_ENCRYPT_FAILED: 'CREDENTIAL_STORE_FAILED',
};

/**
 * Is this a credential this boundary will pass to the vault?
 *
 * Rejects a non-string, an empty string, a whitespace-only string and an
 * over-long value (T-02-19). A blank field must never create or overwrite a
 * stored credential, so the check happens **before** any vault call and the
 * rejected value is never logged — only the reason.
 */
function isStorableCredential(credential: unknown): credential is string {
  return (
    typeof credential === 'string' &&
    credential.trim().length > 0 &&
    credential.length <= CREDENTIAL_MAX_LENGTH
  );
}

/**
 * Build the port over a vault.
 *
 * Delegation only: no crypto, no storage access and no vault import happen
 * here, so a caller can substitute any `CredentialVaultLike`.
 */
export function createCredentialStorePort(vault: CredentialVaultLike): CredentialStorePort {
  function logFailure(
    code: CredentialStoreErrorCode,
    message: string,
    context: Record<string, unknown>,
  ): void {
    debugLog(code, message, context);
  }

  /** Translate a vault failure without surfacing the vault's own code. */
  function failMapped(
    operation: string,
    vaultCode: string,
  ): { ok: false; code: CredentialStoreErrorCode } {
    const code = VAULT_CODE_MAP[vaultCode] ?? 'CREDENTIAL_STORE_FAILED';
    logFailure(code, 'Credential vault operation failed', { operation, reason: 'vault-code' });
    return { ok: false, code };
  }

  /** A vault that threw — reported with an error NAME only, never a message. */
  function failThrown(
    operation: string,
    error: unknown,
  ): { ok: false; code: 'CREDENTIAL_STORE_FAILED' } {
    logFailure('CREDENTIAL_STORE_FAILED', 'Credential vault call threw', {
      operation,
      reason: redactErrorContext(error).reason,
    });
    return { ok: false, code: 'CREDENTIAL_STORE_FAILED' };
  }

  function rejectCredential(
    operation: string,
  ): { ok: false; code: 'CREDENTIAL_STORE_INVALID_CREDENTIAL' } {
    // The rejected value is never logged — not its content, not its length.
    logFailure('CREDENTIAL_STORE_INVALID_CREDENTIAL', 'Credential rejected before storage', {
      operation,
      reason: 'blank-or-oversized',
    });
    return { ok: false, code: 'CREDENTIAL_STORE_INVALID_CREDENTIAL' };
  }

  async function store(
    providerId: ProviderId,
    credential: string,
  ): Promise<CredentialStoreResult> {
    if (!isStorableCredential(credential)) return rejectCredential('store');
    try {
      const result = await vault.store(providerId, credential);
      return result.ok ? { ok: true } : failMapped('store', result.code);
    } catch (error) {
      return failThrown('store', error);
    }
  }

  async function replace(
    providerId: ProviderId,
    credential: string,
  ): Promise<CredentialStoreResult> {
    if (!isStorableCredential(credential)) return rejectCredential('replace');
    try {
      const result = await vault.replace(providerId, credential);
      return result.ok ? { ok: true } : failMapped('replace', result.code);
    } catch (error) {
      return failThrown('replace', error);
    }
  }

  async function retrieve(providerId: ProviderId): Promise<CredentialStoreRetrieveResult> {
    try {
      const result = await vault.retrieve(providerId);
      // The only path in this module that returns a credential value.
      return result.ok ? { ok: true, credential: result.credential } : failMapped('retrieve', result.code);
    } catch (error) {
      return failThrown('retrieve', error);
    }
  }

  async function isConfigured(providerId: ProviderId): Promise<boolean> {
    try {
      return await vault.isConfigured(providerId);
    } catch (error) {
      // Fail closed: an unreadable vault is "not configured", never an
      // exception reaching a render path.
      failThrown('isConfigured', error);
      return false;
    }
  }

  async function deleteCredential(providerId: ProviderId): Promise<CredentialStoreResult> {
    try {
      const result = await vault.delete(providerId);
      return result.ok ? { ok: true } : failMapped('delete', result.code);
    } catch (error) {
      return failThrown('delete', error);
    }
  }

  async function inspectEnvelopeVersion(
    providerId: ProviderId,
  ): Promise<CredentialStoreInspectResult> {
    try {
      const result = await vault.inspectEnvelopeVersion(providerId);
      return result.ok ? { ok: true, value: result.value } : failMapped('inspectEnvelopeVersion', result.code);
    } catch (error) {
      return failThrown('inspectEnvelopeVersion', error);
    }
  }

  // Exactly these six — no list-all, export, preview, reveal or generic
  // arbitrary-secret setter exists on the returned object (D2-03).
  return {
    isConfigured,
    store,
    replace,
    retrieve,
    delete: deleteCredential,
    inspectEnvelopeVersion,
  };
}
