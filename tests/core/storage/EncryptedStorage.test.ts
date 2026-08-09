// tests/core/storage/EncryptedStorage.test.ts — AES-GCM vault primitive tests
// (STORAGE-03, D-03). Uses the shared vault-roundtrip fixture builder from
// 02-01 (D-20/21 — the SAME deterministic builder the integration paths use).
// Cases: §15.2 derivation + encrypt/decrypt round-trip under one installSecret;
// decrypt with a WRONG derived key rejects with the typed VAULT_DECRYPT_FAILED
// code (fail closed, D-03); a tampered ciphertext byte rejects with the SAME
// typed code — no separate corruption branch (D-03). Runs in the default
// jsdom-align environment — crypto.subtle is available with zero polyfills
// (RESEARCH Pattern 3).
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/core/error/errorCodes';
import {
  decrypt,
  deriveKey,
  decodeBase64Bytes,
  deserializeEnvelope,
  encodeBase64Bytes,
  encrypt,
  serializeEnvelope,
} from '@/core/storage/EncryptedStorage';
import { buildVaultRoundtripFixture, FIXED_INSTALL_SECRET_B } from '../../fixtures/index';

describe('EncryptedStorage — AES-GCM roundtrip (vault-roundtrip fixture)', () => {
  it('derives the §15.2 key and round-trips the fixture plaintext under one installSecret', async () => {
    const fixture = buildVaultRoundtripFixture();
    const key = await deriveKey(fixture.installSecret, fixture.extensionId, fixture.salt);

    const envelope = await encrypt(key, fixture.plaintext, fixture.salt);

    // §15.2 envelope shape: per-key salt carried, fresh 12-byte IV, ciphertext
    expect(envelope.salt).toEqual(fixture.salt);
    expect(envelope.iv).toHaveLength(12);
    expect(envelope.ciphertext.byteLength).toBeGreaterThan(0);

    await expect(decrypt(key, envelope)).resolves.toBe(fixture.plaintext);
  });

  it('rejects decrypt with a WRONG derived key using the typed VAULT_DECRYPT_FAILED code (fail closed, D-03)', async () => {
    const fixture = buildVaultRoundtripFixture();
    const key = await deriveKey(fixture.installSecret, fixture.extensionId, fixture.salt);
    const envelope = await encrypt(key, fixture.plaintext, fixture.salt);

    // Different installSecret → different derived key → auth-tag mismatch
    const wrongKey = await deriveKey(FIXED_INSTALL_SECRET_B, fixture.extensionId, fixture.salt);

    await expect(decrypt(wrongKey, envelope)).rejects.toMatchObject({
      code: ERROR_CODES.VAULT_DECRYPT_FAILED,
    });
  });

  it('rejects a tampered ciphertext byte with the SAME typed code — no separate corruption branch (D-03)', async () => {
    const fixture = buildVaultRoundtripFixture();
    const key = await deriveKey(fixture.installSecret, fixture.extensionId, fixture.salt);
    const envelope = await encrypt(key, fixture.plaintext, fixture.salt);

    const tampered = new Uint8Array(envelope.ciphertext);
    tampered[0] ^= 0xff; // flip one ciphertext byte
    const tamperedEnvelope = {
      salt: envelope.salt,
      iv: envelope.iv,
      ciphertext: tampered.buffer,
    };

    await expect(decrypt(key, tamperedEnvelope)).rejects.toMatchObject({
      code: ERROR_CODES.VAULT_DECRYPT_FAILED,
    });
  });
});

describe('EncryptedStorage — storage-serializable wire form (CR-02)', () => {
  it('serializeEnvelope → JSON round-trip → deserializeEnvelope is byte-lossless and still decrypts', async () => {
    const fixture = buildVaultRoundtripFixture();
    const key = await deriveKey(fixture.installSecret, fixture.extensionId, fixture.salt);
    const envelope = await encrypt(key, fixture.plaintext, fixture.salt);

    const wire = serializeEnvelope(envelope);
    // The wire form is plain base64 strings — JSON-serializable (chrome.storage
    // computes quota on JSON.stringify and the fakeBrowser mock JSON-round-trips
    // every write).
    expect(typeof wire.salt).toBe('string');
    expect(typeof wire.iv).toBe('string');
    expect(typeof wire.ciphertext).toBe('string');

    const roundTripped = JSON.parse(JSON.stringify(wire)) as typeof wire;
    expect(roundTripped).toEqual(wire);

    const restored = deserializeEnvelope(roundTripped);
    // Bytes survive the round-trip exactly.
    expect([...restored.salt]).toEqual([...envelope.salt]);
    expect([...restored.iv]).toEqual([...envelope.iv]);
    expect([...new Uint8Array(restored.ciphertext)]).toEqual([
      ...new Uint8Array(envelope.ciphertext),
    ]);
    await expect(decrypt(key, restored)).resolves.toBe(fixture.plaintext);
  });

  it('encodeBase64Bytes/decodeBase64Bytes are inverse for arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 0x7f, 0x80]);
    expect(encodeBase64Bytes(bytes)).toBeDefined();
    // decode(encode(b)) === b
    expect([...decodeBase64Bytes(encodeBase64Bytes(bytes))]).toEqual([...bytes]);
  });
});
