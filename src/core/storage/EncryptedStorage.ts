import { debugLog } from '../utils/debugLog';

export interface EncryptedPayload {
  alg: 'AES-GCM';
  salt: number[];
  iv: number[];
  ciphertext: number[];
}

export class EncryptedStorage {
  private masterKey: CryptoKey | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    const installSecret = await this.getOrCreateInstallSecret();
    const extensionId = chrome.runtime.id;
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(installSecret + extensionId),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const masterSalt = new TextEncoder().encode('np-master-' + extensionId);
    this.masterKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: masterSalt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    this.initialized = true;
    debugLog('info', '[EncryptedStorage] initialized');
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.ensureInitialized();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.masterKey!,
      plaintext,
    );
    const payload: EncryptedPayload = {
      alg: 'AES-GCM',
      salt: Array.from(new Uint8Array(salt)),
      iv: Array.from(new Uint8Array(iv)),
      ciphertext: Array.from(new Uint8Array(ciphertext)),
    };
    await chrome.storage.local.set({ [key]: payload });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    await this.ensureInitialized();
    const result = await chrome.storage.local.get(key);
    const payload = result[key] as EncryptedPayload | undefined;
    if (!payload) return null;
    const ivArray = new Uint8Array(payload.iv);
    const ciphertextArray = new Uint8Array(payload.ciphertext);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
      this.masterKey!,
      ciphertextArray,
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  private async getOrCreateInstallSecret(): Promise<string> {
    const result = await chrome.storage.local.get('np_install_secret');
    if (result.np_install_secret) return result.np_install_secret as string;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    await chrome.storage.local.set({ np_install_secret: secret });
    return secret;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }
}

export const encryptedStorage = new EncryptedStorage();
