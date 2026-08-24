import type { ProviderConfig, CustomProviderId } from '../../types';
import { chromeStorageAdapter } from '../theme/chromeStorageAdapter';

const IV_BYTES = 12;
const SALT_BYTES = 16;

/**
 * Spec §15.2 ciphertext envelope. Each EncryptedBlob is JSON-safe and
 * carries its own random salt + IV so the same key can encrypt many
 * secrets independently (no IV reuse, no shared per-key state).
 */
export interface EncryptedBlob {
  /** base64-encoded 16-byte random salt used to derive this blob's AES key. */
  salt: string;
  /** base64-encoded 12-byte random IV (AES-GCM nonce — FRESH per call). */
  iv: string;
  /** base64-encoded AES-GCM-256 ciphertext (includes GCM auth tag). */
  ciphertext: string;
}

/** AES-GCM authenticated encryption with a fresh 12-byte IV (MDN canonical). */
export async function encrypt(plaintext: string, key: CryptoKey, salt?: Uint8Array): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  // If salt is omitted, generate a fresh one (defensive default).
  const actualSalt = salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const enc = new TextEncoder().encode(plaintext);
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  return {
    salt: bytesToBase64(actualSalt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(buf)),
  };
}

/** AES-GCM authenticated decryption. Rejects on tamper or wrong key (GCM tag). */
export async function decrypt(blob: EncryptedBlob, key: CryptoKey): Promise<string> {
  const iv = base64ToBytes(blob.iv);
  const data = base64ToBytes(blob.ciphertext);
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(buf);
}

type ProviderSecretFields = 'apiKey' | 'openAiKey' | 'geminiKey';

interface ConfigWithSecrets {
  providers?: Record<CustomProviderId, { apiKey: unknown }>;
  openAiKey?: unknown;
  geminiKey?: unknown;
}

/**
 * Encrypt every non-empty secret field in a `ProviderConfig` to an
 * `EncryptedBlob`. Empty-string fields stay empty strings (preserves
 * "not configured" semantics). D-30/D-30a: keep the existing scaffold
 * `ProviderConfig` object shape — DO NOT normalize to a §15.1
 * `ProviderConfig[]` array form (that migration is Phase 3
 * ProviderRegistry's job).
 *
 * The `salt` parameter is the salt applied to every secret field in
 * this config — the caller (e.g. `persistProviderConfigEncrypted`) is
 * expected to derive fresh per-save salts. Tests pass the salt
 * directly so they can re-derive the same key on decrypt.
 */
export async function encryptProviderConfig(
  config: ProviderConfig,
  key: CryptoKey,
  salt: Uint8Array,
): Promise<ProviderConfig> {
  const saltB64 = bytesToBase64(salt);
  const result: ProviderConfig = { ...config };

  if (result.providers) {
    const nextProviders: ProviderConfig['providers'] = { ...result.providers };
    for (const id of Object.keys(nextProviders) as CustomProviderId[]) {
      const detail = nextProviders[id];
      if (!detail) continue;
      // Encrypt apiKey when non-empty.
      if (typeof detail.apiKey === 'string' && detail.apiKey.length > 0) {
        const blob = await encrypt(detail.apiKey, key, salt);
        nextProviders[id] = { ...detail, apiKey: blob as unknown as string };
      }
    }
    result.providers = nextProviders;
  }

  // Top-level legacy fields: openAiKey, geminiKey.
  // D-30 shape — these exist alongside `providers.*.apiKey`.
  const withOpenAi: ConfigWithSecrets = { ...result };
  if (typeof result.openAiKey === 'string' && result.openAiKey.length > 0) {
    const blob = await encrypt(result.openAiKey, key, salt);
    (withOpenAi as ProviderConfig).openAiKey = blob as unknown as string;
  }
  if (typeof result.geminiKey === 'string' && result.geminiKey.length > 0) {
    const blob = await encrypt(result.geminiKey, key, salt);
    (withOpenAi as ProviderConfig).geminiKey = blob as unknown as string;
  }

  // The salt is embedded in every EncryptedBlob.salt; we don't need a
  // separate per-config salt field — re-derivation uses per-blob salts.
  void saltB64;
  return withOpenAi as ProviderConfig;
}

/**
 * Inverse of `encryptProviderConfig`: decrypt every EncryptedBlob-shaped
 * field back to its plaintext string. Empty-string fields stay empty.
 *
 * Decryption is per-field — each blob carries its own salt. The `key`
 * is expected to be derived from the installSecret + extensionId (the
 * caller supplies it after re-deriving via the per-field salt).
 */
export async function decryptProviderConfig(
  config: ProviderConfig,
  key: CryptoKey,
): Promise<ProviderConfig> {
  const result: ProviderConfig = { ...config };

  if (result.providers) {
    const nextProviders: ProviderConfig['providers'] = { ...result.providers };
    for (const id of Object.keys(nextProviders) as CustomProviderId[]) {
      const detail = nextProviders[id];
      if (!detail) continue;
      if (isEncryptedBlob(detail.apiKey)) {
        const plain = await decrypt(detail.apiKey, key);
        nextProviders[id] = { ...detail, apiKey: plain };
      }
    }
    result.providers = nextProviders;
  }

  if (isEncryptedBlob(result.openAiKey)) {
    const plain = await decrypt(result.openAiKey, key);
    result.openAiKey = plain;
  }
  if (isEncryptedBlob(result.geminiKey)) {
    const plain = await decrypt(result.geminiKey, key);
    result.geminiKey = plain;
  }

  return result;
}

/** Type guard: EncryptedBlob has exactly 3 base64-ish string fields. */
export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.salt === 'string' && typeof v.iv === 'string' && typeof v.ciphertext === 'string';
}

// --- Helpers ---

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa !== 'undefined') return btoa(binary);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Uint8Array((globalThis as any).Buffer.from(b64, 'base64'));
}
