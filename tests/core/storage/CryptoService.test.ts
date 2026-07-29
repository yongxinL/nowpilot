import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cryptoService } from '../../../src/core/storage/CryptoService';

describe('CryptoService', () => {
  beforeEach(() => {
    // Reset chrome storage between tests
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should encrypt and decrypt a known string', async () => {
      const original = 'test-key-123';
      const { ciphertext, salt, iv } = await cryptoService.encrypt(original);
      const decrypted = await cryptoService.decrypt(ciphertext, salt, iv);
      expect(decrypted).toBe(original);
    });

    it('should handle special characters', async () => {
      const original = 'sk-abc!@#$%^&*()_+-=[]{}|;:,.<>?';
      const { ciphertext, salt, iv } = await cryptoService.encrypt(original);
      const decrypted = await cryptoService.decrypt(ciphertext, salt, iv);
      expect(decrypted).toBe(original);
    });

    it('should handle an empty string', async () => {
      const original = '';
      const { ciphertext, salt, iv } = await cryptoService.encrypt(original);
      const decrypted = await cryptoService.decrypt(ciphertext, salt, iv);
      expect(decrypted).toBe(original);
    });
  });

  describe('install secret', () => {
    it('should generate install secret once and return the same value', async () => {
      const first = await cryptoService.getInstallSecret();
      const second = await cryptoService.getInstallSecret();
      expect(first).toEqual(second);
      expect(first.length).toBe(32);
    });

    it('should persist install secret across getInstallSecret calls', async () => {
      await cryptoService.getInstallSecret();
      // Verify it's stored in chrome.storage.local
      const map = (globalThis as any).__chromeStorageMap;
      expect(map.has('np_install_secret')).toBe(true);
      // Second call should read from storage
      const value = await cryptoService.getInstallSecret();
      expect(value.length).toBe(32);
    });
  });

  describe('unique salt and IV', () => {
    it('should produce unique salt for each encrypt call', async () => {
      const result1 = await cryptoService.encrypt('test-1');
      const result2 = await cryptoService.encrypt('test-2');
      // Salts should differ (16 bytes each)
      expect(result1.salt).not.toEqual(result2.salt);
      expect(result1.salt.length).toBe(16);
    });

    it('should produce unique IV for each encrypt call', async () => {
      const result1 = await cryptoService.encrypt('test-1');
      const result2 = await cryptoService.encrypt('test-2');
      // IVs should differ (12 bytes each)
      expect(result1.iv).not.toEqual(result2.iv);
      expect(result1.iv.length).toBe(12);
    });
  });

  describe('decrypt error handling', () => {
    it('should throw when decrypting with wrong salt', async () => {
      const original = 'secret-key-456';
      const { ciphertext, iv } = await cryptoService.encrypt(original);
      const wrongSalt = crypto.getRandomValues(new Uint8Array(16));
      await expect(
        cryptoService.decrypt(ciphertext, wrongSalt, iv),
      ).rejects.toThrow('Decryption failed');
    });

    it('should throw when decrypting corrupted ciphertext', async () => {
      const original = 'secret-key-789';
      const { ciphertext, salt, iv } = await cryptoService.encrypt(original);
      // Corrupt the ciphertext by modifying a byte
      const corrupted = new Uint8Array(ciphertext);
      corrupted[0] ^= 0xff;
      await expect(
        cryptoService.decrypt(corrupted.buffer, salt, iv),
      ).rejects.toThrow('Decryption failed');
    });
  });
});
