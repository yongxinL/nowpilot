import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptedStorage } from '../storage/EncryptedStorage';

/**
 * API keys encrypted at rest via EncryptedStorage (AES-GCM-256 with per-key salt/IV).
 * The store persists to chrome.storage.local with transparent encryption.
 *
 * T-05-KEY mitigation: API keys encrypted at rest. Input.Password component
 * masks the key on screen.
 */
export interface ProviderState {
  selectedProvider: string | null;
  apiKeys: Record<string, string>;
  setSelectedProvider: (provider: string | null) => void;
  setApiKey: (provider: string, key: string) => void;
}

const encryptedJSONStorage = createJSONStorage<ProviderState>(() => ({
  getItem: async (name: string) => {
    const value = await encryptedStorage.get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await encryptedStorage.set(name, JSON.parse(value));
  },
  removeItem: async (name: string) => {
    await encryptedStorage.remove(name);
  },
}));

export const useProviderStore = create<ProviderState>()(
  persist(
    (set) => ({
      selectedProvider: null,
      apiKeys: {},
      setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),
    }),
    {
      name: 'np_providers',
      storage: encryptedJSONStorage,
    },
  ),
);
