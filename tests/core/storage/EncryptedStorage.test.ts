import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeStorageAdapter, flushPendingWrites, __test__ } from '../../../src/core/theme/chromeStorageAdapter';
import {
  encrypt,
  decrypt,
  encryptProviderConfig,
  decryptProviderConfig,
  type EncryptedBlob,
} from '../../../src/core/storage/EncryptedStorage';
import { ensureInstallSecret, deriveKey, getExtensionId } from '../../../src/core/security/KeyVault';
import type { ProviderConfig } from '../../../src/types';

// Helper: drive chromeStorageAdapter's trailing debounce to completion so
// the in-memory pending writes land in the underlying chrome.storage.local
// mock before assertions inspect the map.
async function flush() {
  await flushPendingWrites();
}

// Base64 helpers for comparing EncryptedBlob fields in assertions.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa !== 'undefined') return btoa(binary);
  // jsdom may not have btoa; use Buffer
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

describe('EncryptedStorage — spec §15.2 AES-GCM-256 round-trip', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    __test__.resetPendingState();
  });

  it('encrypts plaintext to an EncryptedBlob with salt+iv+ciphertext base64 fields and decrypt round-trips', async () => {
    const installSecret = await ensureInstallSecret();
    const key = await deriveKey(installSecret, getExtensionId(), base64ToBytes('AAAAAAAAAAAAAAAAAAAAAA=='));

    const blob: EncryptedBlob = await encrypt('hello-secret', key);

    expect(blob.salt).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(blob.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(blob.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // Salt is 16 bytes, IV is 12 bytes (base64-encoded).
    const saltBytes = base64ToBytes(blob.salt);
    const ivBytes = base64ToBytes(blob.iv);
    expect(saltBytes.length).toBe(16);
    expect(ivBytes.length).toBe(12);

    const decrypted = await decrypt(blob, key);
    expect(decrypted).toBe('hello-secret');
  });

  it('rejects tampered ciphertext (AES-GCM authentication failure)', async () => {
    const installSecret = await ensureInstallSecret();
    const key = await deriveKey(installSecret, getExtensionId(), base64ToBytes('AAAAAAAAAAAAAAAAAAAAAA=='));

    const blob: EncryptedBlob = await encrypt('integrity-test', key);

    // Tamper with ciphertext: flip the first byte.
    const tamperedBytes = base64ToBytes(blob.ciphertext);
    tamperedBytes[0] = tamperedBytes[0] ^ 0xff;
    const tampered: EncryptedBlob = { ...blob, ciphertext: bytesToBase64(tamperedBytes) };

    await expect(decrypt(tampered, key)).rejects.toBeDefined();
  });

  it('rejects decryption with a wrong key (AES-GCM authentication failure)', async () => {
    const installSecret = await ensureInstallSecret();
    const salt = base64ToBytes('AAAAAAAAAAAAAAAAAAAAAA==');
    const correctKey = await deriveKey(installSecret, getExtensionId(), salt);

    const blob: EncryptedBlob = await encrypt('wrong-key-test', correctKey);

    // Derive a key from a DIFFERENT installSecret — this simulates a
    // different extension install attempting to decrypt.
    const wrongSecret = new Uint8Array(32); // all zeros
    const wrongKey = await deriveKey(wrongSecret, getExtensionId(), salt);

    await expect(decrypt(blob, wrongKey)).rejects.toBeDefined();
  });

  it('encrpyts two ProviderConfigs and round-trips secrets through chrome.storage.local', async () => {
    const installSecret = await ensureInstallSecret();
    const salt = base64ToBytes('AAAAAAAAAAAAAAAAAAAAAA==');
    const key = await deriveKey(installSecret, getExtensionId(), salt);

    const cfg: ProviderConfig = {
      serviceProvider: 'Custom API Key',
      activeProvider: 'openai',
      providers: {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          isConfigured: true,
          enabled: true,
          apiKey: 'sk-test-plaintext-openai',
          useCustomProxy: true,
          proxyUrl: 'https://api.openai.com/v1',
          models: [],
        },
        gemini: {
          id: 'gemini',
          name: 'Google (Gemini)',
          isConfigured: false,
          enabled: false,
          apiKey: '',
          useCustomProxy: false,
          proxyUrl: '',
          models: [],
        },
        ollama: {
          id: 'ollama',
          name: 'Ollama',
          isConfigured: false,
          enabled: false,
          apiKey: '',
          useCustomProxy: false,
          proxyUrl: '',
          models: [],
        },
        claude: {
          id: 'claude',
          name: 'Anthropic (Claude)',
          isConfigured: false,
          enabled: false,
          apiKey: '',
          useCustomProxy: false,
          proxyUrl: '',
          models: [],
        },
      },
      openAiKey: 'sk-test-plaintext-openai',
      openAiBaseUrl: 'https://api.openai.com/v1',
      geminiKey: '',
      selectedModel: '',
      fontSize: 'Auto',
      themeMode: 'Auto',
      language: 'English',
      sidepanelPosition: 'Right',
      chatGptWebappEnabled: false,
    };

    const encrypted = await encryptProviderConfig(cfg, key, salt);
    // apiKey/openAiKey are non-empty → encrypted blobs; geminiKey is '' → stays ''.
    expect(encrypted.providers.openai.apiKey).not.toBe('sk-test-plaintext-openai');
    expect((encrypted.providers.openai.apiKey as unknown as EncryptedBlob).salt).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(encrypted.providers.gemini.apiKey).toBe('');
    expect(encrypted.openAiKey).not.toBe('sk-test-plaintext-openai');
    expect((encrypted.openAiKey as unknown as EncryptedBlob).salt).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(encrypted.geminiKey).toBe('');

    // Persist through chrome.storage.local and read back.
    await chromeStorageAdapter.setItem('np_providers_test', JSON.stringify(encrypted));
    await flush();
    const persisted = await chromeStorageAdapter.getItem('np_providers_test');
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!) as ProviderConfig;
    const decrypted = await decryptProviderConfig(parsed, key);

    expect(decrypted.providers.openai.apiKey).toBe('sk-test-plaintext-openai');
    expect(decrypted.openAiKey).toBe('sk-test-plaintext-openai');
    expect(decrypted.providers.gemini.apiKey).toBe('');
    expect(decrypted.geminiKey).toBe('');
  });

  it('ensureInstallSecret writes a 32-byte secret exactly once (idempotent)', async () => {
    const first = await ensureInstallSecret();
    const second = await ensureInstallSecret();
    const third = await ensureInstallSecret();

    expect(first.length).toBe(32);
    expect(second.length).toBe(32);
    expect(third.length).toBe(32);

    // Bytewise equality across calls.
    expect(Array.from(second)).toEqual(Array.from(first));
    expect(Array.from(third)).toEqual(Array.from(first));
  });

  it('two encryptions of the same plaintext with different salts produce different ciphertext', async () => {
    const installSecret = await ensureInstallSecret();
    const salt1 = base64ToBytes('AAAAAAAAAAAAAAAAAAAAAA==');
    const salt2 = base64ToBytes('BBBBBBBBBBBBBBBBBBBBBB==');
    const key1 = await deriveKey(installSecret, getExtensionId(), salt1);
    const key2 = await deriveKey(installSecret, getExtensionId(), salt2);

    const blob1 = await encrypt('same-plaintext', key1);
    const blob2 = await encrypt('same-plaintext', key2);

    expect(blob1.salt).not.toBe(blob2.salt);
    expect(blob1.ciphertext).not.toBe(blob2.ciphertext);
  });

  it('each encrypt() call generates a fresh 12-byte IV (different iv fields)', async () => {
    const installSecret = await ensureInstallSecret();
    const salt = base64ToBytes('AAAAAAAAAAAAAAAAAAAAAA==');
    const key = await deriveKey(installSecret, getExtensionId(), salt);

    const blob1 = await encrypt('p', key);
    const blob2 = await encrypt('p', key);
    const blob3 = await encrypt('p', key);

    expect(blob1.iv).not.toBe(blob2.iv);
    expect(blob2.iv).not.toBe(blob3.iv);
    expect(blob1.iv).not.toBe(blob3.iv);
    // All IVs must decode to 12 bytes.
    expect(base64ToBytes(blob1.iv).length).toBe(12);
    expect(base64ToBytes(blob2.iv).length).toBe(12);
    expect(base64ToBytes(blob3.iv).length).toBe(12);
  });
});
