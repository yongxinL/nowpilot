// src/core/storage/EncryptedStorage.ts — the AES-GCM at-rest vault primitive
// (STORAGE-03). Source: PRODUCT_SPEC §15.2 "API Key Encryption" (lines
// 1976-1984) — the derivation scheme is implemented verbatim:
//
//   installSecret: 32 random bytes, generated once → np_install_secret
//   per-key: random 16-byte salt + 12-byte IV
//   derivedKey: PBKDF2(installSecret + extensionId, salt, 100000, SHA-256) → AES-GCM-256
//   NEVER use navigator.userAgent or any value that changes on browser update.
//
// Security framing (D-01/D-02): the vault is AT-REST OBFUSCATION, install-bound,
// never exported. It protects against casual disk/backup/sync inspection, NOT
// against a process with the extension's storage access. Never hand-roll
// crypto — crypto.subtle exclusively. Fully async (crypto.subtle is
// async-only). R-3 confines the vault to Side Panel/Standalone; the background
// SW never imports this module.
//
// PBKDF2_ITERATIONS is LOCKED at 100 000 by §15.2 / D-02 (A-04). Informational:
// OWASP 2023 recommends >= 600k for PBKDF2-HMAC-SHA256 — flagged in
// 02-RESEARCH as a v0.2 hardening candidate, NOT a Phase-2 change.
import { ERROR_CODES } from '@/core/error/errorCodes';

/** PBKDF2 iteration count pinned by §15.2 / D-02 (see header). */
export const PBKDF2_ITERATIONS = 100_000;

/** The §15.2 envelope shape: per-key random 16-byte salt + 12-byte IV + ciphertext. */
export interface VaultEnvelope {
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}

/**
 * JSON-safe wire form of a §15.2 envelope (CR-02 review fix): chrome.storage
 * serializes every value via JSON.stringify (its quota is computed on the
 * serialized bytes) and the project's fakeBrowser mock JSON-round-trips every
 * write — raw `Uint8Array`/`ArrayBuffer` degrade into index-keyed plain
 * objects / `{}` under that round-trip. The base64 string form survives it
 * losslessly, so persisted envelopes can be decrypted on read-back. Use
 * serializeEnvelope BEFORE any chrome.storage write and deserializeEnvelope on
 * read.
 */
export interface SerializedVaultEnvelope {
  salt: string;
  iv: string;
  ciphertext: string;
}

/** Base64-encode raw bytes (browser-safe; used by the wire form, D-02). */
export function encodeBase64Bytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decode base64 → raw bytes (inverse of encodeBase64Bytes). */
export function decodeBase64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Serialize an in-memory envelope to its JSON-safe base64 wire form. */
export function serializeEnvelope(envelope: VaultEnvelope): SerializedVaultEnvelope {
  return {
    salt: encodeBase64Bytes(envelope.salt),
    iv: encodeBase64Bytes(envelope.iv),
    ciphertext: encodeBase64Bytes(new Uint8Array(envelope.ciphertext)),
  };
}

/** Deserialize a storage-round-tripped base64 wire form back to a live envelope. */
export function deserializeEnvelope(serialized: SerializedVaultEnvelope): VaultEnvelope {
  return {
    salt: decodeBase64Bytes(serialized.salt),
    iv: decodeBase64Bytes(serialized.iv),
    ciphertext: decodeBase64Bytes(serialized.ciphertext).buffer,
  };
}

/** True when `value` is a base64 wire-form envelope (CR-02 — JSON-safe shape). */
export function isSerializedVaultEnvelope(value: unknown): value is SerializedVaultEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.salt === 'string' &&
    typeof record.iv === 'string' &&
    typeof record.ciphertext === 'string'
  );
}

/**
 * Typed decrypt-failure error (D-03): carries `code ===
 * ERROR_CODES.VAULT_DECRYPT_FAILED`. Callers match the CODE, never a free-form
 * message — wrong key and tampered ciphertext are indistinguishable and both
 * surface as this single typed throw (no separate corruption branch).
 */
export interface VaultDecryptFailedError extends Error {
  code: typeof ERROR_CODES.VAULT_DECRYPT_FAILED;
}

/** Narrowing guard for D-03 typed throws. */
export function isVaultDecryptFailed(err: unknown): err is VaultDecryptFailedError {
  return (
    err instanceof Error && (err as { code?: unknown }).code === ERROR_CODES.VAULT_DECRYPT_FAILED
  );
}

/**
 * Factory for the D-03 typed decrypt-failure error — used by KeyVault when a
 * decrypt cannot even be attempted (e.g. installSecret missing with ciphertext
 * present, road (b) of D-04) so callers still see the single typed code.
 */
export function createVaultDecryptFailedError(): VaultDecryptFailedError {
  const err = new Error(
    'AES-GCM decryption failed — auth-tag mismatch or malformed envelope',
  ) as VaultDecryptFailedError;
  err.code = ERROR_CODES.VAULT_DECRYPT_FAILED;
  return err;
}

/**
 * Derive the per-key AES-GCM-256 key: PBKDF2(installSecret + extensionId,
 * salt, 100000, SHA-256) → AES-GCM-256 (§15.2). `extensionId` is
 * chrome.runtime.id — stable per install; `salt` is the per-key 16-byte salt
 * (KeyVault owns per-key storage and passes it in). Both inputs are stable
 * across browser updates, satisfying the §15.2 "NEVER derive from anything
 * that changes on browser update" invariant.
 */
export async function deriveKey(
  installSecret: string,
  extensionId: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const subtle = crypto.subtle;
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(installSecret + extensionId),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt `plaintext` under `derivedKey` → §15.2 envelope. A fresh 12-byte IV
 * is generated per call; the per-key salt is passed in because KeyVault owns
 * per-key storage and derived the key with it — the envelope MUST carry the
 * same salt so a later decrypt re-derives the identical key.
 */
export async function encrypt(
  derivedKey: CryptoKey,
  plaintext: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<VaultEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    new TextEncoder().encode(plaintext),
  );
  return { salt, iv, ciphertext };
}

/**
 * Decrypt an envelope → plaintext. AES-GCM fails closed (D-03): an auth-tag
 * mismatch — wrong key OR tampered ciphertext, which are indistinguishable —
 * or a malformed envelope throws the typed VAULT_DECRYPT_FAILED error. There
 * is NO separate corruption branch. Callers (KeyVault) convert this throw into
 * the PROVIDER_KEY_UNREADABLE state; nothing auto-wipes.
 */
export async function decrypt(derivedKey: CryptoKey, envelope: VaultEnvelope): Promise<string> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: envelope.iv },
      derivedKey,
      envelope.ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw createVaultDecryptFailedError();
  }
}
