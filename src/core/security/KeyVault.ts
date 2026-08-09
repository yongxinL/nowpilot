// src/core/security/KeyVault.ts — installSecret lifecycle + the
// PROVIDER_KEY_UNREADABLE state machine (STORAGE-03, D-02/D-04).
//
// Security framing (D-01/D-02): the vault is AT-REST OBFUSCATION, install-bound,
// never exported. It protects against casual disk/backup/sync inspection, NOT
// against a process with the extension's storage access. Provider API keys are
// never exported, never plaintext at rest, and never written to
// chrome.storage.sync. np_install_secret is generated EXACTLY ONCE via
// read-then-write-if-absent (race-safe; 'already present' is authoritative)
// and is IMMUTABLE once set — NEVER auto-regenerated and NEVER auto-wiped
// (D-02/D-04). Wipe is USER-INITIATED only (wipeProviderKey, a future
// 'Remove provider' action), never a consequence of decrypt failure.
//
// Recovery UX (D-04): all three roads to unreadable — (a) restore on a new
// install, (b) installSecret cleared, (c) tampered ciphertext — converge on
// ONE shared state value PROVIDER_KEY_UNREADABLE with one recovery path: the
// provider surfaces as STR.storage.providerKeyRequired ('Key required —
// re-enter'), enabled=false, treated as unconfigured (routes to the
// ProviderRegistry onboarding 'configure later' gate).
//
// R-3: this module lives in Side Panel/Standalone only — the background SW
// never imports KeyVault/EncryptedStorage.
//
// Shape: lazy singleton + listener Set, following the ProviderRegistry
// precedent (src/core/ai/ProviderRegistry.ts). Chrome storage writes are
// never-throw adapters (Golden Rule 9). Key derivation delegates to
// EncryptedStorage.deriveKey with chrome.runtime.id — stable per install, and
// the deterministic 'test-extension-id' in the fakeBrowser test mock (RESEARCH
// Pattern 3).
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import {
  createVaultDecryptFailedError,
  decrypt,
  deriveKey,
  encrypt,
  isVaultDecryptFailed,
  type VaultEnvelope,
} from '@/core/storage/EncryptedStorage';

/** chrome.storage.local key for the install-bound secret (D-02; never sync, never exports). */
export const NP_INSTALL_SECRET_KEY = 'np_install_secret';

/**
 * ONE shared state value for all three unreadable roads (D-04). 'OK' is the
 * normal state; PROVIDER_KEY_UNREADABLE drives the 'Key required — re-enter'
 * unconfigured routing. No per-context divergent state is modeled (T-2-03-05).
 */
export const PROVIDER_KEY_STATE = {
  OK: 'OK',
  PROVIDER_KEY_UNREADABLE: 'PROVIDER_KEY_UNREADABLE',
} as const;

export type ProviderKeyState = (typeof PROVIDER_KEY_STATE)[keyof typeof PROVIDER_KEY_STATE];

/**
 * Diagnostic reason behind PROVIDER_KEY_UNREADABLE. Roads (a) restore-on-new-
 * install and (c) tampered-ciphertext are cryptographically indistinguishable
 * (D-03), so decryptSecret assigns the most likely road; the provider layer may
 * call setProviderKeyUnreadable('restore-on-new-install') explicitly when it
 * detects a restored vault during onboarding.
 */
export type ProviderKeyUnreadableReason =
  'restore-on-new-install' | 'install-secret-cleared' | 'tampered-ciphertext';

export type ProviderKeyListener = () => void;

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export class KeyVault {
  private providerKeyState: ProviderKeyState = PROVIDER_KEY_STATE.OK;
  private unreadableReason: ProviderKeyUnreadableReason | null = null;
  private listeners = new Set<ProviderKeyListener>();

  /**
   * Read chrome.storage.local[np_install_secret]; if absent, generate 32
   * random bytes (base64) and WRITE-IF-ABSENT (D-02 race safety: re-read
   * immediately before writing so a concurrent context's value wins —
   * 'already present' is authoritative). Two contexts must never both
   * generate/clobber. Immutable once set — never regenerated or overwritten.
   */
  async getInstallSecret(): Promise<string> {
    const firstRead = await chrome.storage.local.get(NP_INSTALL_SECRET_KEY);
    const existing = firstRead[NP_INSTALL_SECRET_KEY];
    if (typeof existing === 'string' && existing.length > 0) return existing;

    const generated = encodeBase64(crypto.getRandomValues(new Uint8Array(32)));
    const reRead = await chrome.storage.local.get(NP_INSTALL_SECRET_KEY);
    const raced = reRead[NP_INSTALL_SECRET_KEY];
    if (typeof raced === 'string' && raced.length > 0) return raced; // another context won
    try {
      await chrome.storage.local.set({ [NP_INSTALL_SECRET_KEY]: generated });
    } catch (err) {
      // Write-through adapter never throws (Golden Rule 9). A failed first
      // write means nothing was persisted — the next call regenerates, which
      // is correct (regeneration is only forbidden AFTER a secret is set).
      debugLog(ERROR_CODES.STORE_WRITE, 'failed to write np_install_secret', {
        error: err instanceof Error ? err : undefined,
        module: 'KeyVault',
      });
    }
    return generated;
  }

  /** Non-generating read — used by decrypt paths so a missing secret is NEVER auto-regenerated (D-04). */
  private async readInstallSecretOnly(): Promise<string | null> {
    const data = await chrome.storage.local.get(NP_INSTALL_SECRET_KEY);
    const value = data[NP_INSTALL_SECRET_KEY];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  /**
   * Per-key AES-GCM-256 key: PBKDF2(secret + chrome.runtime.id, salt, 100000,
   * SHA-256) → AES-GCM-256 (§15.2). chrome.runtime.id is stable per install —
   * never userAgent or anything browser-update-unstable.
   */
  async getDerivedKey(secret: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    return deriveKey(secret, chrome.runtime.id, salt);
  }

  /** Convenience: ensure installSecret, derive the per-key key, encrypt. */
  async encryptSecret(plaintext: string): Promise<VaultEnvelope> {
    const secret = await this.getInstallSecret();
    const salt = crypto.getRandomValues(new Uint8Array(16)); // per-key 16-byte salt (D-02)
    const key = await this.getDerivedKey(secret, salt);
    return encrypt(key, plaintext, salt);
  }

  /**
   * Convenience: read installSecret (NON-generating), derive, decrypt. Any
   * failure — missing installSecret, wrong key, tampered ciphertext, OR a
   * malformed/JSON-mangled envelope (CR-02: a storage-round-tripped envelope
   * whose byte arrays degraded into plain objects makes deriveKey throw a raw
   * TypeError) — converts into the single PROVIDER_KEY_UNREADABLE state (D-04)
   * and rethrows the typed VAULT_DECRYPT_FAILED so callers always match the
   * D-03 contract. Nothing is wiped and nothing is regenerated.
   */
  async decryptSecret(envelope: VaultEnvelope): Promise<string> {
    const secret = await this.readInstallSecretOnly();
    if (secret === null) {
      // Road (b) install-secret-cleared (D-04): ciphertext exists but the
      // secret is gone. NEVER auto-regenerate (would orphan every stored key).
      this.setProviderKeyUnreadable('install-secret-cleared');
      debugLog(
        ERROR_CODES.PROVIDER_KEY_UNREADABLE,
        'installSecret missing with ciphertext present',
        {
          module: 'KeyVault',
        },
      );
      throw createVaultDecryptFailedError();
    }
    try {
      // CR-02: the ENTIRE derive+decrypt sequence lives inside the typed-error
      // path — a malformed salt/IV/ciphertext (e.g. a JSON-mangled envelope
      // read back from chrome.storage) must converge on the SAME typed
      // VAULT_DECRYPT_FAILED + PROVIDER_KEY_UNREADABLE state, never a raw
      // crypto TypeError that bypasses the one shared unreadable state (D-04).
      const key = await this.getDerivedKey(secret, envelope.salt);
      return await decrypt(key, envelope);
    } catch (err) {
      // Roads (a) and (c) are cryptographically indistinguishable (D-03) —
      // one typed throw → ONE shared state (D-04). The reason records the
      // most likely road for diagnostics only.
      this.setProviderKeyUnreadable('tampered-ciphertext');
      debugLog(ERROR_CODES.PROVIDER_KEY_UNREADABLE, 'provider key decrypt failed', {
        error: err instanceof Error ? err : undefined,
        module: 'KeyVault',
      });
      if (isVaultDecryptFailed(err)) throw err;
      // A raw crypto/TypeError failure (malformed envelope) is normalized to
      // the typed code so callers can always match the D-03 contract.
      throw createVaultDecryptFailedError();
    }
  }

  /** Synchronous state getter (drives UI state; crypto is async, state is not). */
  getProviderKeyState(): ProviderKeyState {
    return this.providerKeyState;
  }

  /** Diagnostic reason behind the current PROVIDER_KEY_UNREADABLE state (null when OK). */
  getProviderKeyUnreadableReason(): ProviderKeyUnreadableReason | null {
    return this.unreadableReason;
  }

  /** Subscribe to state changes (T-1-18 shape — no cached UI flag). Returns unsubscribe. */
  subscribe(listener: ProviderKeyListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Converge on the ONE shared PROVIDER_KEY_UNREADABLE state (D-04). Public so
   * the provider layer can record the restore-on-new-install road it detects.
   */
  setProviderKeyUnreadable(reason: ProviderKeyUnreadableReason): void {
    this.providerKeyState = PROVIDER_KEY_STATE.PROVIDER_KEY_UNREADABLE;
    this.unreadableReason = reason;
    this.notify();
  }

  /**
   * USER-INITIATED wipe only (D-04): removes a provider's stored ciphertext.
   * Called by a future 'Remove provider' action — NEVER by any decrypt-failure
   * path. Re-entry overwrites stale ciphertext; nothing auto-wipes.
   */
  async wipeProviderKey(keyId: string): Promise<void> {
    try {
      await chrome.storage.local.remove(keyId);
    } catch (err) {
      debugLog(ERROR_CODES.STORE_WRITE, 'failed to remove provider ciphertext', {
        error: err instanceof Error ? err : undefined,
        module: 'KeyVault',
        extra: { keyId },
      });
    }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (err) {
        // A broken listener must never break the vault (Golden Rule 9).
        debugLog(ERROR_CODES.EVT_HANDLER, 'KeyVault listener error', {
          error: err instanceof Error ? err : undefined,
          module: 'KeyVault',
        });
      }
    }
  }
}

let singleton: KeyVault | null = null;

/** Lazy singleton (ProviderRegistry precedent) — one gate, no per-context divergence. */
export function getKeyVault(): KeyVault {
  if (singleton === null) singleton = new KeyVault();
  return singleton;
}
