import { z } from 'zod';
import { PROVIDER_IDS, type ProviderId } from '../../types';
import { debugLog } from '../log/debugLog';

/**
 * EncryptedStorage — the credential envelope codec and the §15.2 WebCrypto
 * primitives (KeyVault's crypto layer).
 *
 * ## §15.2 parameters (pinned — do not re-derive)
 *
 * ```
 * installSecret: 32 random bytes, generated once -> np_install_secret
 * per-key:       random 16-byte salt + 12-byte IV
 * derivedKey:    PBKDF2(installSecret + extensionId, salt, 100000, SHA-256)
 *                -> AES-GCM-256
 * NEVER use navigator.userAgent or any value that changes on browser update.
 * ```
 *
 * ## The concatenation is golden (RESEARCH assumption A11)
 *
 * The PBKDF2 base key material is the UTF-8 bytes of
 * `installSecretBase64 + KDF_CONCATENATION_SEPARATOR + extensionId`. The
 * separator is deliberately the **empty string**: the spec's `+` is a direct
 * juxtaposition. `KDF_CONCATENATION_SEPARATOR` exists as a named constant so
 * the choice is pinned in one place and asserted by a golden test in this
 * module's suite — changing it (or either operand) silently orphans every
 * stored envelope, so it must never be "tidied" into a delimiter.
 *
 * ## Fail-closed decode (D2-06, T-02-13/T-02-14)
 *
 * AES-GCM authenticates the ciphertext, the IV **and** the additional data
 * (the version, providerId, algorithm and KDF parameters), so a tampered
 * version / provider / algorithm / iteration count / salt / IV / ciphertext /
 * tag or a wrong key all reject. Every rejection resolves to the single code
 * `'CREDENTIAL_DECRYPT_FAILED'` — deliberately indistinguishable between
 * "wrong key" and "tampered envelope" — and the caller never sees a
 * `DOMException`.
 *
 * ## Boundaries
 *
 * - Plaintext exists only inside `encryptCredential` / `decryptCredential`;
 *   the envelope schema has no plaintext field, so a persisted envelope
 *   structurally cannot carry one.
 * - Base64 is used only at the envelope-field boundary — never as obfuscation.
 * - `crypto.getRandomValues` is the only salt/IV source; never a clock or a
 *   counter (D2-06 "unique IV per operation").
 * - No module-level mutable crypto state exists.
 * - `extensionId` arrives from the caller; nothing here reads
 *   `navigator.userAgent` or any browser-version-dependent value.
 */

/** The envelope shape version. Bound into the authenticated data below. */
export const CREDENTIAL_ENVELOPE_VERSION = 1;

/** §15.2 PBKDF2 iteration count — part of the authenticated envelope metadata. */
export const KDF_ITERATIONS = 100_000;

/** §15.2 per-operation salt length in bytes. */
export const KDF_SALT_BYTES = 16;

/** §15.2 per-operation AES-GCM IV length in bytes. */
export const AES_GCM_IV_BYTES = 12;

/** AES-GCM key length in bits (§15.2 "AES-GCM-256"). */
export const AES_GCM_KEY_BITS = 256;

/** The GCM authentication tag length in bytes — the smallest valid ciphertext. */
export const AES_GCM_TAG_BYTES = 16;

/** The canonical algorithm name carried in the envelope and the AAD. */
export const CREDENTIAL_ALGORITHM = 'AES-GCM-256';

/** The pinned derivation separator — see the module note. Empty by design. */
export const KDF_CONCATENATION_SEPARATOR = '';

/** Upper bound on a persisted ciphertext field (a credential is small). */
export const CREDENTIAL_MAX_CIPHERTEXT_CHARS = 65_536;

/** The §15.2 KDF parameters, frozen and in one fixed key order. */
export const CREDENTIAL_KDF = Object.freeze({
  name: 'PBKDF2',
  hash: 'SHA-256',
  iterations: KDF_ITERATIONS,
} as const);

/** Every failure this module reports is one of these two redacted codes. */
export type EncryptedStorageErrorCode = 'CREDENTIAL_ENCRYPT_FAILED' | 'CREDENTIAL_DECRYPT_FAILED';

/** `reason` is an error NAME only (or a `typeof`) — never a message or a stack. */
function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return typeof error;
}

const PROVIDER_SCHEMA = z.enum(PROVIDER_IDS);

/**
 * Validate a canonical `ProviderId` at a runtime boundary. Returns `null` for
 * any non-member, so a caller cannot build a storage key or a namespace out of
 * arbitrary input.
 */
export function parseProviderId(value: unknown): ProviderId | null {
  const parsed = PROVIDER_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The exact PBKDF2 base key material: `installSecretBase64` and `extensionId`
 * juxtaposed (the separator is the pinned empty string — see the module note).
 */
export function buildKdfMaterialInput(installSecretBase64: string, extensionId: string): string {
  return `${installSecretBase64}${KDF_CONCATENATION_SEPARATOR}${extensionId}`;
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function isBase64Field(value: string): boolean {
  return value.length % 4 === 0 && BASE64_PATTERN.test(value);
}

/** Encode bytes for an envelope field. Used only at this boundary. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decode an envelope field; `null` for anything that is not canonical base64. */
export function base64ToBytes(value: string): Uint8Array | null {
  if (!isBase64Field(value)) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function base64FieldSchema(maxChars: number) {
  return z
    .string()
    .min(4)
    .max(maxChars)
    .refine(isBase64Field, { message: 'expected canonical base64' });
}

const kdfSchema = z
  .object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    iterations: z.literal(KDF_ITERATIONS),
  })
  .strict();

/**
 * The strict `CredentialEnvelopeV1` schema. `.strict()` is load-bearing: an
 * unrecognised field is a typed failure rather than accepted data.
 */
export const credentialEnvelopeSchema = z
  .object({
    v: z.literal(CREDENTIAL_ENVELOPE_VERSION),
    providerId: PROVIDER_SCHEMA,
    kdf: kdfSchema,
    alg: z.literal(CREDENTIAL_ALGORITHM),
    salt: base64FieldSchema(KDF_SALT_BYTES * 2),
    iv: base64FieldSchema(AES_GCM_IV_BYTES * 2),
    ciphertext: base64FieldSchema(CREDENTIAL_MAX_CIPHERTEXT_CHARS),
  })
  .strict();

/** The versioned §15.2 credential envelope. */
export type CredentialEnvelopeV1 = z.infer<typeof credentialEnvelopeSchema>;

/**
 * Validate an unknown value as an envelope. Never throws; every unrecognised
 * shape — including an unknown version — is the same redacted failure.
 */
export function parseCredentialEnvelope(
  candidate: unknown,
): { ok: true; envelope: CredentialEnvelopeV1 } | { ok: false; code: EncryptedStorageErrorCode } {
  const parsed = credentialEnvelopeSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' };
  return { ok: true, envelope: parsed.data };
}

/**
 * The canonical additional authenticated data: a fixed key order built from an
 * object literal — never `Object.entries` over an untyped record.
 */
function buildAdditionalData(providerId: ProviderId): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      v: CREDENTIAL_ENVELOPE_VERSION,
      providerId,
      alg: CREDENTIAL_ALGORITHM,
      kdf: CREDENTIAL_KDF,
    }),
  );
}

/**
 * §15.2 key derivation: PBKDF2(base-material, salt, 100000, SHA-256) → a
 * **non-extractable** AES-GCM-256 key usable only for encrypt and decrypt.
 */
export async function deriveKeyFromMaterial(
  installSecretBase64: string,
  extensionId: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(buildKdfMaterialInput(installSecretBase64, extensionId)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: AES_GCM_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptCredentialInput {
  providerId: string;
  plaintext: string;
  installSecret: string;
  extensionId: string;
}

/**
 * Encrypt one credential into a fresh envelope. A new 16-byte salt and a new
 * 12-byte IV are drawn per call, so encrypting identical plaintext twice
 * produces two different envelopes (D2-06).
 */
export async function encryptCredential(
  input: EncryptCredentialInput,
): Promise<
  { ok: true; envelope: CredentialEnvelopeV1 } | { ok: false; code: EncryptedStorageErrorCode }
> {
  const providerId = parseProviderId(input.providerId);
  if (providerId === null || typeof input.plaintext !== 'string') {
    return { ok: false, code: 'CREDENTIAL_ENCRYPT_FAILED' };
  }

  try {
    const salt = crypto.getRandomValues(new Uint8Array(KDF_SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
    const key = await deriveKeyFromMaterial(input.installSecret, input.extensionId, salt);
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: buildAdditionalData(providerId) },
        key,
        new TextEncoder().encode(input.plaintext),
      ),
    );

    const parsed = credentialEnvelopeSchema.safeParse({
      v: CREDENTIAL_ENVELOPE_VERSION,
      providerId,
      kdf: { ...CREDENTIAL_KDF },
      alg: CREDENTIAL_ALGORITHM,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertext),
    });
    if (!parsed.success) {
      debugLog('CREDENTIAL_ENCRYPT_FAILED', 'Encrypted envelope failed its own schema', {
        providerId,
      });
      return { ok: false, code: 'CREDENTIAL_ENCRYPT_FAILED' };
    }

    return { ok: true, envelope: parsed.data };
  } catch (error) {
    debugLog('CREDENTIAL_ENCRYPT_FAILED', 'Credential encryption failed', {
      providerId,
      reason: errorName(error),
    });
    return { ok: false, code: 'CREDENTIAL_ENCRYPT_FAILED' };
  }
}

export interface DecryptCredentialInput {
  envelope: unknown;
  installSecret: string;
  extensionId: string;
}

/**
 * Decrypt a stored envelope. Every failure — malformed, truncated, tampered,
 * foreign, wrong key — is the one redacted code, and a `DOMException` never
 * reaches the caller.
 */
export async function decryptCredential(
  input: DecryptCredentialInput,
): Promise<{ ok: true; plaintext: string } | { ok: false; code: EncryptedStorageErrorCode }> {
  const parsed = credentialEnvelopeSchema.safeParse(input.envelope);
  if (!parsed.success) return { ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' };

  const salt = base64ToBytes(parsed.data.salt);
  if (!salt || salt.length !== KDF_SALT_BYTES) return { ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' };

  const iv = base64ToBytes(parsed.data.iv);
  if (!iv || iv.length !== AES_GCM_IV_BYTES) return { ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' };

  const ciphertext = base64ToBytes(parsed.data.ciphertext);
  if (!ciphertext || ciphertext.length < AES_GCM_TAG_BYTES) {
    return { ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' };
  }

  try {
    const key = await deriveKeyFromMaterial(input.installSecret, input.extensionId, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: buildAdditionalData(parsed.data.providerId) },
      key,
      ciphertext,
    );
    return { ok: true, plaintext: new TextDecoder().decode(plaintext) };
  } catch (error) {
    debugLog('CREDENTIAL_DECRYPT_FAILED', 'Credential decrypt failed', {
      reason: errorName(error),
    });
    return { ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' };
  }
}
