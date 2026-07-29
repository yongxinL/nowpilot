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

  describe('edge cases — large input', () => {
    it('should round-trip a 10KB string', async () => {
      const original = 'x'.repeat(10 * 1024);
      const { ciphertext, salt, iv } = await cryptoService.encrypt(original);
      const decrypted = await cryptoService.decrypt(ciphertext, salt, iv);
      expect(decrypted).toBe(original);
      expect(decrypted.length).toBe(10 * 1024);
    });
  });

  describe('edge cases — Unicode', () => {
    it('should round-trip emoji', async () => {
      const original = '🚀🔐✅🧪📦';
      const { ciphertext, salt, iv } = await cryptoService.encrypt(original);
      const decrypted = await cryptoService.decrypt(ciphertext, salt, iv);
      expect(decrypted).toBe(original);
    });

    it('should round-trip CJK characters', async () => {
      const original = '加密解密测试';
      const { ciphertext, salt, iv } = await cryptoService.encrypt(original);
      const decrypted = await cryptoService.decrypt(ciphertext, salt, iv);
      expect(decrypted).toBe(original);
    });

    it('should round-trip mixed Unicode including combining marks', async () => {
      const original = 'café résumé Jalapeño ñ 你好 🌍';
      const { ciphertext, salt, iv } = await cryptoService.encrypt(original);
      const decrypted = await cryptoService.decrypt(ciphertext, salt, iv);
      expect(decrypted).toBe(original);
    });
  });

  describe('edge cases — input validation', () => {
    it('should throw descriptive error when IV has wrong length (not 12 bytes)', async () => {
      const original = 'test-data';
      const { ciphertext, salt } = await cryptoService.encrypt(original);
      const wrongIv = new Uint8Array(8); // wrong length, should be 12
      await expect(
        cryptoService.decrypt(ciphertext, salt, wrongIv),
      ).rejects.toThrow('Invalid IV length');
    });

    it('should throw TypeError when ciphertext is not an ArrayBuffer', async () => {
      await expect(
        (cryptoService as any).decrypt('not-a-buffer', new Uint8Array(16), new Uint8Array(12)),
      ).rejects.toThrow(TypeError);
    });
  });

  describe('edge cases — storage unavailability', () => {
    it('should throw clear error when chrome.storage.local.get fails', async () => {
      // Temporarily break the chrome.storage.local mock
      const originalGet = chrome.storage.local.get;
      chrome.storage.local.get = vi.fn().mockRejectedValue(new Error('Storage unavailable'));

      await expect(
        cryptoService.getInstallSecret(),
      ).rejects.toThrow('chrome.storage.local is unavailable');

      // Restore
      chrome.storage.local.get = originalGet;
    });
  });

  describe('edge cases — base64 round-trip', () => {
    it('should round-trip various byte arrays through base64', async () => {
      const inputs = [
        new Uint8Array([]),                          // empty
        new Uint8Array([0x00]),                      // single zero byte
        new Uint8Array([0x42]),                      // single byte
        new Uint8Array([0x00, 0x01, 0x02, 0xFF]),    // mixed small
        new Uint8Array(256).map((_, i) => i % 256),  // 256-byte full range
      ];

      for (const input of inputs) {
        const b64 = cryptoService.bytesToBase64(input);
        const output = cryptoService.base64ToBytes(b64);
        expect(output).toEqual(input);
      }
    });
  });
});
