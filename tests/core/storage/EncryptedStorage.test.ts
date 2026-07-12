import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncryptedStorage, type EncryptedPayload } from '../../../src/core/storage/EncryptedStorage';

describe('EncryptedStorage', () => {
  let storage: EncryptedStorage;
  let localGetMock: ReturnType<typeof vi.fn>;
  let localSetMock: ReturnType<typeof vi.fn>;
  let localRemoveMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    storage = new EncryptedStorage();

    // Capture local storage mock references for type-safe access
    localGetMock = vi.mocked(chrome.storage.local.get) as unknown as ReturnType<typeof vi.fn>;
    localSetMock = vi.mocked(chrome.storage.local.set) as unknown as ReturnType<typeof vi.fn>;
    localRemoveMock = vi.mocked(chrome.storage.local.remove) as unknown as ReturnType<typeof vi.fn>;

    // Stub crypto.subtle with vitest mocks — Node.js 20+ has native crypto.subtle
    // so the conditional stub in tests/setup.ts does NOT apply. We need our own.
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array): Uint8Array => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
      subtle: {
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
        importKey: vi.fn().mockResolvedValue({} as CryptoKey),
        deriveKey: vi.fn().mockResolvedValue({} as CryptoKey),
        generateKey: vi.fn(),
      },
    } as unknown as Crypto);

    // Re-establish chrome.storage mocks with fresh implementations
    localGetMock.mockResolvedValue({});
    localSetMock.mockResolvedValue(undefined);
    localRemoveMock.mockResolvedValue(undefined);
  });

  it('creates np_install_secret if not present', async () => {
    await storage.initialize();

    expect(localSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        np_install_secret: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it('reuses existing np_install_secret', async () => {
    const existingSecret = 'existing-secret-abc123';
    localGetMock.mockResolvedValue({
      np_install_secret: existingSecret,
    });

    await storage.initialize();

    // Should NOT have written a new np_install_secret
    const secretSetCalls = localSetMock.mock.calls.filter(
      (call: unknown[]) =>
        call[0] &&
        typeof call[0] === 'object' &&
        'np_install_secret' in (call[0] as Record<string, unknown>),
    );
    expect(secretSetCalls).toHaveLength(0);

    // importKey should have been called with key material derived from the existing secret
    const importKeyMock = vi.mocked(crypto.subtle.importKey) as unknown as ReturnType<typeof vi.fn>;
    expect(importKeyMock).toHaveBeenCalledTimes(1);
    expect(importKeyMock).toHaveBeenCalledWith(
      'raw',
      expect.anything(),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    // Verify the key material includes the existing secret
    const importKeyCall = importKeyMock.mock.calls[0];
    const keyMaterial = importKeyCall[1] as Uint8Array;
    const keyMaterialStr = new TextDecoder().decode(keyMaterial);
    expect(keyMaterialStr).toContain(existingSecret);
  });

  it('set() then get() round-trip preserves original value', async () => {
    const value = { foo: 'bar', num: 42 };
    const encryptedPayload: EncryptedPayload = {
      alg: 'AES-GCM',
      salt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      iv: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      ciphertext: Array.from({ length: 32 }, (_, i) => i),
    };

    // Set up chrome.storage.local.get chain WITHOUT mockReset:
    // Call 1: getOrCreateInstallSecret → no existing secret
    // Call 2: get() returns stored encrypted payload
    // Any subsequent calls fall back to default mockResolvedValue({})
    localGetMock.mockResolvedValueOnce({}); // for initialize -> getOrCreateInstallSecret
    localGetMock.mockResolvedValueOnce({ 'test-key': encryptedPayload }); // for get()

    // decrypt returns the encoded JSON of the original value
    const decryptMock = vi.mocked(crypto.subtle.decrypt) as unknown as ReturnType<typeof vi.fn>;
    decryptMock.mockResolvedValue(
      new Uint8Array(new TextEncoder().encode(JSON.stringify(value)).buffer),
    );

    await storage.set('test-key', value);
    const result = await storage.get<{ foo: string; num: number }>('test-key');

    expect(result).toEqual(value);

    // Verify the stored payload has the expected encrypted structure
    const storageCall = localSetMock.mock.calls.find(
      (call: unknown[]) =>
        call[0] &&
        typeof call[0] === 'object' &&
        'test-key' in (call[0] as Record<string, unknown>),
    );
    expect(storageCall).toBeDefined();
    const storedPayload = (storageCall![0] as Record<string, unknown>)['test-key'] as EncryptedPayload;
    expect(storedPayload).toBeDefined();
    expect(storedPayload.alg).toBe('AES-GCM');
    expect(Array.isArray(storedPayload.salt)).toBe(true);
    expect(storedPayload.salt.length).toBeGreaterThan(0);
    expect(Array.isArray(storedPayload.iv)).toBe(true);
    expect(storedPayload.iv.length).toBeGreaterThan(0);
    expect(Array.isArray(storedPayload.ciphertext)).toBe(true);
    expect(storedPayload.ciphertext.length).toBeGreaterThan(0);
  });

  it('generates unique salt and IV each call', async () => {
    await storage.set('key1', 'value1');
    await storage.set('key1', 'value1');

    // Filter to only the calls storing with 'key1' (exclude np_install_secret calls)
    const storageSetCalls = localSetMock.mock.calls.filter(
      (call: unknown[]) =>
        call[0] &&
        typeof call[0] === 'object' &&
        'key1' in (call[0] as Record<string, unknown>),
    );
    expect(storageSetCalls.length).toBeGreaterThanOrEqual(2);

    const payload1 = (storageSetCalls[0][0] as Record<string, unknown>)['key1'] as EncryptedPayload;
    const payload2 = (storageSetCalls[1][0] as Record<string, unknown>)['key1'] as EncryptedPayload;

    expect(payload1.alg).toBe('AES-GCM');
    expect(payload2.alg).toBe('AES-GCM');

    // At minimum one of salt or IV should differ between calls
    // (crypto.getRandomValues is mocked with Math.random(), so they should differ)
    const saltDiffers =
      payload1.salt.length !== payload2.salt.length ||
      payload1.salt.some((v, i) => v !== payload2.salt[i]);
    const ivDiffers =
      payload1.iv.length !== payload2.iv.length ||
      payload1.iv.some((v, i) => v !== payload2.iv[i]);
    expect(saltDiffers || ivDiffers).toBe(true);
  });

  it('returns null for non-existent key', async () => {
    const result = await storage.get('nonexistent');
    expect(result).toBeNull();
  });

  it('remove calls chrome.storage.local.remove', async () => {
    await storage.remove('key-to-delete');
    expect(localRemoveMock).toHaveBeenCalledWith('key-to-delete');
  });
});
