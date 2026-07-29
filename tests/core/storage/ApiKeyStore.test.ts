import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useApiKeyStore } from '../../../src/core/storage/ApiKeyStore';
import { cryptoService } from '../../../src/core/storage/CryptoService';

describe('ApiKeyStore', () => {
  beforeEach(async () => {
    // Reset chrome storage between tests
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();

    // Reset Zustand store state
    useApiKeyStore.getState().reset();

    vi.clearAllMocks();
  });

  describe('setKey', () => {
    it('should encrypt and store the key in chrome.storage.local', async () => {
      await useApiKeyStore.getState().setKey('test-provider', 'sk-test123');

      // Verify the key is stored in chrome.storage.local
      const map = (globalThis as any).__chromeStorageMap;
      const storedRaw = map.get('np_api_keys');
      expect(storedRaw).toBeDefined();
      const parsed = JSON.parse(storedRaw);
      expect(parsed.state.keys['test-provider']).toBeDefined();
      expect(parsed.state.keys['test-provider'].providerId).toBe('test-provider');

      // Verify ciphertext, salt, iv are base64 strings (not ArrayBuffer)
      const record = parsed.state.keys['test-provider'];
      expect(typeof record.ciphertext).toBe('string');
      expect(typeof record.salt).toBe('string');
      expect(typeof record.iv).toBe('string');
    });
  });

  describe('getKey', () => {
    it('should return the original plaintext after setKey', async () => {
      await useApiKeyStore.getState().setKey('openai', 'sk-abc123');
      const plaintext = await useApiKeyStore.getState().getKey('openai');
      expect(plaintext).toBe('sk-abc123');
    });

    it('should return null for a missing provider', async () => {
      const plaintext = await useApiKeyStore.getState().getKey('nonexistent');
      expect(plaintext).toBeNull();
    });
  });

  describe('no plaintext in storage', () => {
    it('should never store plaintext API keys in chrome.storage.local', async () => {
      await useApiKeyStore.getState().setKey('test-provider', 'sk-test123');

      // Read raw chrome storage
      const map = (globalThis as any).__chromeStorageMap;
      const storedRaw = map.get('np_api_keys');
      expect(storedRaw).toBeDefined();

      // Verify plaintext 'sk-test123' is NOT present anywhere in the stored value
      expect(storedRaw).not.toContain('sk-test123');
      expect(storedRaw).not.toContain('test123'); // partial match too
    });
  });

  describe('removeKey', () => {
    it('should remove the key from the store', async () => {
      await useApiKeyStore.getState().setKey('test-provider', 'sk-test123');
      expect(await useApiKeyStore.getState().getKey('test-provider')).toBe('sk-test123');

      useApiKeyStore.getState().removeKey('test-provider');
      const result = await useApiKeyStore.getState().getKey('test-provider');
      expect(result).toBeNull();
    });
  });
});
