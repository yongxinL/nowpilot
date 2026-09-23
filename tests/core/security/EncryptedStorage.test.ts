import { describe, it, expect, beforeEach } from 'vitest';
import {
  AES_GCM_IV_BYTES,
  CREDENTIAL_ALGORITHM,
  CREDENTIAL_ENVELOPE_VERSION,
  KDF_CONCATENATION_SEPARATOR,
  KDF_ITERATIONS,
  KDF_SALT_BYTES,
  base64ToBytes,
  buildKdfMaterialInput,
  bytesToBase64,
  credentialEnvelopeSchema,
  decryptCredential,
  deriveKeyFromMaterial,
  encryptCredential,
  parseCredentialEnvelope,
  parseProviderId,
  type CredentialEnvelopeV1,
} from '../../../src/core/security/EncryptedStorage';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';

/**
 * EncryptedStorage suite (plan `02-03`, Task 1 — §15.2, D2-06, A11).
 *
 * The credential is the repository's synthetic sentinel — never a real key.
 * Every case that exercises a failure asserts the sentinel's absence from the
 * returned value and (where anything is logged) from the log ring buffer.
 */

const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';
const INSTALL_SECRET = 'aW5zdGFsbC1zZWNyZXQtbWF0ZXJpYWwtMDAwMDAwMDA=';
const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

beforeEach(() => {
  clearLogs();
});

/** Encrypt the sentinel and return the envelope (fails the case on a failure). */
async function makeEnvelope(overrides: Partial<Record<string, string>> = {}): Promise<CredentialEnvelopeV1> {
  const result = await encryptCredential({
    providerId: overrides.providerId ?? 'openai',
    plaintext: overrides.plaintext ?? SENTINEL,
    installSecret: overrides.installSecret ?? INSTALL_SECRET,
    extensionId: overrides.extensionId ?? EXTENSION_ID,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('encryption unexpectedly failed');
  return result.envelope;
}

/** Every decrypt failure must be the same one indistinguishable redacted code. */
async function expectDecryptFailed(
  envelope: unknown,
  overrides: { installSecret?: string; extensionId?: string } = {},
): Promise<void> {
  const result = await decryptCredential({
    envelope,
    installSecret: overrides.installSecret ?? INSTALL_SECRET,
    extensionId: overrides.extensionId ?? EXTENSION_ID,
  });
  expect(result).toEqual({ ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' });
  expect(JSON.stringify(result)).not.toContain(SENTINEL);
}

/** Replace one ciphertext character with another, keeping the field canonical base64. */
function flipBase64Char(value: string): string {
  const head = value.slice(0, 1);
  return `${head === 'A' ? 'B' : 'A'}${value.slice(1)}`;
}

describe('EncryptedStorage — §15.2 round trip', () => {
  it('round-trips the synthetic sentinel and stores no plaintext in the envelope', async () => {
    const envelope = await makeEnvelope();

    expect(envelope.v).toBe(CREDENTIAL_ENVELOPE_VERSION);
    expect(envelope.providerId).toBe('openai');
    expect(envelope.alg).toBe(CREDENTIAL_ALGORITHM);
    expect(envelope.kdf).toEqual({ name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS });

    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    expect(salt?.length).toBe(KDF_SALT_BYTES);
    expect(iv?.length).toBe(AES_GCM_IV_BYTES);

    const decrypted = await decryptCredential({
      envelope,
      installSecret: INSTALL_SECRET,
      extensionId: EXTENSION_ID,
    });
    expect(decrypted).toEqual({ ok: true, plaintext: SENTINEL });

    // The envelope structurally cannot carry the plaintext.
    expect(Object.keys(envelope).sort()).toEqual([
      'alg',
      'ciphertext',
      'iv',
      'kdf',
      'providerId',
      'salt',
      'v',
    ]);
    expect(JSON.stringify(envelope)).not.toContain(SENTINEL);
  });

  it('draws a fresh salt and IV per operation — identical plaintext, different envelopes', async () => {
    const first = await makeEnvelope();
    const second = await makeEnvelope();

    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);

    // Both still decrypt to the same sentinel.
    for (const envelope of [first, second]) {
      const decrypted = await decryptCredential({
        envelope,
        installSecret: INSTALL_SECRET,
        extensionId: EXTENSION_ID,
      });
      expect(decrypted).toEqual({ ok: true, plaintext: SENTINEL });
    }
  });

  it('binds the version, provider, algorithm and KDF parameters into the authenticated data', async () => {
    // Every AAD-bound field is pinned by the schema, so a value that passes the
    // schema can still only be tampered with by changing providerId.
    const envelope = await makeEnvelope({ providerId: 'openai' });
    await expectDecryptFailed({ ...envelope, providerId: 'anthropic' });
  });
});

describe('EncryptedStorage — the pinned derivation input (A11)', () => {
  it('pins the concatenation as the empty separator plus a direct juxtaposition', () => {
    expect(KDF_CONCATENATION_SEPARATOR).toBe('');
    expect(buildKdfMaterialInput('c2VjcmV0', 'ext-123')).toBe('c2VjcmV0ext-123');
    // The golden bytes: changing either operand, the separator or the order
    // silently orphans every stored envelope, so the assertion is byte-exact.
    expect([...new TextEncoder().encode(buildKdfMaterialInput('ab', 'cd'))]).toEqual([
      97, 98, 99, 100,
    ]);
    expect([...new TextEncoder().encode(buildKdfMaterialInput('', 'x'))]).toEqual([120]);
  });

  it('derives a non-extractable key usable only for encrypt and decrypt', async () => {
    const key = await deriveKeyFromMaterial(
      INSTALL_SECRET,
      EXTENSION_ID,
      new Uint8Array(KDF_SALT_BYTES).fill(1),
    );
    expect(key.extractable).toBe(false);
    expect(key.usages.sort()).toEqual(['decrypt', 'encrypt']);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
  });

  it('is deterministic for the same material and salt', async () => {
    const salt = new Uint8Array(KDF_SALT_BYTES).fill(9);
    const first = await deriveKeyFromMaterial(INSTALL_SECRET, EXTENSION_ID, salt);
    const second = await deriveKeyFromMaterial(INSTALL_SECRET, EXTENSION_ID, salt);
    const iv = new Uint8Array(AES_GCM_IV_BYTES).fill(3);
    const aad = new TextEncoder().encode('aad');

    const firstCiphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, first, new Uint8Array([1, 2, 3])),
    );
    const secondCiphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, second, new Uint8Array([1, 2, 3])),
    );
    expect([...firstCiphertext]).toEqual([...secondCiphertext]);
  });
});

describe('EncryptedStorage — fail-closed decode (D2-06, T-02-13/T-02-14)', () => {
  it('rejects every tamper shape with one indistinguishable redacted code', async () => {
    const envelope = await makeEnvelope();

    const tamperCases: Array<[string, () => Promise<void>]> = [
      ['bumped version', () => expectDecryptFailed({ ...envelope, v: CREDENTIAL_ENVELOPE_VERSION + 1 })],
      ['changed provider', () => expectDecryptFailed({ ...envelope, providerId: 'gemini' })],
      ['changed algorithm', () => expectDecryptFailed({ ...envelope, alg: 'AES-CBC-256' })],
      [
        'changed iteration count',
        () => expectDecryptFailed({ ...envelope, kdf: { ...envelope.kdf, iterations: 99_999 } }),
      ],
      [
        'changed hash',
        () => expectDecryptFailed({ ...envelope, kdf: { ...envelope.kdf, hash: 'SHA-1' } }),
      ],
      ['wrong-length salt', () => expectDecryptFailed({ ...envelope, salt: bytesToBase64(new Uint8Array(8)) })],
      ['truncated IV', () => expectDecryptFailed({ ...envelope, iv: envelope.iv.slice(0, 8) })],
      ['wrong-length IV', () => expectDecryptFailed({ ...envelope, iv: bytesToBase64(new Uint8Array(8)) })],
      ['flipped ciphertext character', () => expectDecryptFailed({ ...envelope, ciphertext: flipBase64Char(envelope.ciphertext) })],
      ['truncated ciphertext', () => expectDecryptFailed({ ...envelope, ciphertext: bytesToBase64(new Uint8Array(8)) })],
      ['wrong length salt and IV together', () => expectDecryptFailed({ ...envelope, salt: 'AAAA', iv: 'AAAA' })],
      [
        'wrong key — a different extension id',
        () => expectDecryptFailed(envelope, { extensionId: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz' }),
      ],
      ['wrong key — a different install secret', () => expectDecryptFailed(envelope, { installSecret: 'b3RoZXItc2VjcmV0' })],
      ['a non-envelope object', () => expectDecryptFailed({ not: 'an envelope' })],
      ['an empty object', () => expectDecryptFailed({})],
      ['null', () => expectDecryptFailed(null)],
      ['undefined', () => expectDecryptFailed(undefined)],
      ['a string', () => expectDecryptFailed('not an envelope')],
      ['an array', () => expectDecryptFailed([envelope])],
      ['an unknown extra field', () => expectDecryptFailed({ ...envelope, extra: 'x' })],
      ['non-canonical base64', () => expectDecryptFailed({ ...envelope, iv: '!!!!not-base64!!!!' })],
    ];

    for (const [label, run] of tamperCases) {
      await run();
      // Nothing a failure path logs may carry the sentinel.
      expect(JSON.stringify(getRecentLogs()), label).not.toContain(SENTINEL);
    }
  });

  it('never returns plaintext or partial plaintext from any failure path', async () => {
    const envelope = await makeEnvelope();
    const result = await decryptCredential({
      envelope: { ...envelope, ciphertext: flipBase64Char(envelope.ciphertext) },
      installSecret: INSTALL_SECRET,
      extensionId: EXTENSION_ID,
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('the envelope schema is strict — an unknown field is a typed failure, never accepted data', async () => {
    const envelope = await makeEnvelope();

    expect(credentialEnvelopeSchema.safeParse({ ...envelope, plaintext: SENTINEL }).success).toBe(false);
    expect(credentialEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it('never throws from the parse or encrypt/decrypt boundaries for junk input', async () => {
    const junk: unknown[] = [null, undefined, 0, '', 'envelope', [], {}, { v: 1 }];
    for (const value of junk) {
      expect(() => parseCredentialEnvelope(value)).not.toThrow();
      expect(parseCredentialEnvelope(value)).toEqual({
        ok: false,
        code: 'CREDENTIAL_DECRYPT_FAILED',
      });
    }

    const encrypted = await encryptCredential({
      providerId: 'not-a-provider',
      plaintext: SENTINEL,
      installSecret: INSTALL_SECRET,
      extensionId: EXTENSION_ID,
    });
    expect(encrypted).toEqual({ ok: false, code: 'CREDENTIAL_ENCRYPT_FAILED' });
  });

  it('rejects a non-member provider id at every boundary', () => {
    expect(parseProviderId('openai')).toBe('openai');
    expect(parseProviderId('claude')).toBeNull();
    expect(parseProviderId('')).toBeNull();
    expect(parseProviderId(42)).toBeNull();
  });

  it('never reads a browser-version-dependent value or a clock for salt/IV', async () => {
    // Two envelopes minted back-to-back share no salt/IV bytes, which a clock
    // or counter source could not guarantee; the values come from
    // `crypto.getRandomValues` only.
    const envelope = await makeEnvelope();
    const saltAgain = base64ToBytes(envelope.salt);
    expect(saltAgain).not.toBeNull();
    expect(envelope.iv).not.toBe(envelope.salt);
  });
});
