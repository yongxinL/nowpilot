/** CryptoService — AES-GCM-256 encryption/decryption with PBKDF2 key derivation
 *
 * Established contracts (D-01/D-02/D-03):
 * - Install secret key name: 'np_install_secret'
 * - PBKDF2 params: 100000 iterations, SHA-256, per-key 16-byte salt
 * - Key material: base64(installSecret) + extensionId
 * - Encrypted payload shape: { ciphertext: ArrayBuffer, salt: Uint8Array, iv: Uint8Array }
 * - Derived key cache prefix in chrome.storage.session: 'np_derived_key_'
 *
 * D-03: Each encrypt() call produces unique 16-byte salt and 12-byte IV.
 */

export class CryptoService {
  private readonly INSTALL_SECRET_KEY = 'np_install_secret';
  private readonly SESSION_CACHE_PREFIX = 'np_derived_key_';

  /** Get or create the install secret (generated once, persisted forever) */
  async getInstallSecret(): Promise<Uint8Array> {
    const result = await chrome.storage.local.get(this.INSTALL_SECRET_KEY);
    if (result[this.INSTALL_SECRET_KEY]) {
      // stored as base64 in chrome.storage (only supports JSON-serializable values)
      return this.base64ToBytes(result[this.INSTALL_SECRET_KEY] as string);
    }
    const secret = crypto.getRandomValues(new Uint8Array(32));
    await chrome.storage.local.set({
      [this.INSTALL_SECRET_KEY]: this.bytesToBase64(secret),
    });
    return secret;
  }

  /** Derive AES-256 key from install secret + extensionId + per-key salt */
  async deriveKey(salt: Uint8Array): Promise<CryptoKey> {
    const installSecret = await this.getInstallSecret();
    const extensionId = chrome.runtime.id;
    const combined = new TextEncoder().encode(
      this.bytesToBase64(installSecret) + extensionId,
    );

    const keyMaterial = await crypto.subtle.importKey(
      'raw', combined, 'PBKDF2', false, ['deriveKey'],
    );

    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt'],
    );
  }

  /** Encrypt plaintext with a per-key random salt and IV */
  async encrypt(plaintext: string): Promise<{
    ciphertext: ArrayBuffer;
    salt: Uint8Array;
    iv: Uint8Array;
  }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(salt);
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, encoded,
    );
    return { ciphertext, salt, iv };
  }

  /** Decrypt ciphertext using stored salt and IV */
  async decrypt(
    ciphertext: ArrayBuffer,
    salt: Uint8Array,
    iv: Uint8Array,
  ): Promise<string> {
    try {
      const key = await this.deriveKey(salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv }, key, ciphertext,
      );
      return new TextDecoder().decode(decrypted);
    } catch (err) {
      throw new Error(
        `Decryption failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

/** Module-level singleton per PATTERNS.md Shared Patterns §Module-Scoped Singleton */
export const cryptoService = new CryptoService();
