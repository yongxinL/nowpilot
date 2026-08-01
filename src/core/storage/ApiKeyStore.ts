/** ApiKeyStore — Zustand store for encrypted provider API keys
 *
 * Per D-04/D-05:
 * - setKey encrypts the plaintext key via CryptoService before persisting
 * - getKey decrypts on read, never caches plaintext in persisted state
 * - Persisted payload contains only base64-encoded ciphertext+salt+iv (no plaintext)
 * - Zustand persist middleware uses chromeStorageAdapter (chrome.storage.local)
 * - partialize ensures only the keys record is persisted (no action methods)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from './chromeStorageAdapter';
import { cryptoService } from './CryptoService';

/** Binary-to-base64 conversion for chrome.storage.local compatibility */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array<ArrayBufferLike>): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Base64-to-binary conversion */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export interface ProviderKeyRecord {
  providerId: string;
  ciphertext: string;
  salt: string;
  iv: string;
}

interface ApiKeyState {
  keys: Record<string, ProviderKeyRecord>;
}

interface ApiKeyActions {
  setKey: (providerId: string, plaintext: string) => Promise<void>;
  getKey: (providerId: string) => Promise<string | null>;
  removeKey: (providerId: string) => void;
  reset: () => void;
}

type ApiKeyStore = ApiKeyState & ApiKeyActions;

const initialState: ApiKeyState = {
  keys: {},
};

export const useApiKeyStore = create<ApiKeyStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      setKey: async (providerId: string, plaintext: string) => {
        const { ciphertext, salt, iv } = await cryptoService.encrypt(plaintext);
        set((state) => {
          state.keys[providerId] = {
            providerId,
            ciphertext: arrayBufferToBase64(ciphertext),
            salt: arrayBufferToBase64(salt),
            iv: arrayBufferToBase64(iv),
          };
        });
      },

      getKey: async (providerId: string): Promise<string | null> => {
        const record = get().keys[providerId];
        if (!record) return null;
        const ciphertextBuf = base64ToArrayBuffer(record.ciphertext);
        const saltBuf = cryptoService.base64ToBytes(record.salt);
        const ivBuf = cryptoService.base64ToBytes(record.iv);
        return cryptoService.decrypt(ciphertextBuf, saltBuf, ivBuf);
      },

      removeKey: (providerId: string) => {
        set((state) => {
          delete state.keys[providerId];
        });
      },

      reset: () => {
        set((state) => {
          state.keys = {};
        });
      },
    })),
    {
      name: 'np_api_keys',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({ keys: state.keys }),
    },
  ),
);
