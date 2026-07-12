import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptedStorage } from '../storage/EncryptedStorage';
import type { ModelEntry } from '../ai/providers/providerTypes';

/**
 * API keys encrypted at rest via EncryptedStorage (AES-GCM-256 with per-key salt/IV).
 * The store persists to chrome.storage.local with transparent encryption.
 *
 * T-05-KEY mitigation: API keys encrypted at rest. Input.Password component
 * masks the key on screen.
 *
 * Model registry fields (modelEntries, providerPriority, tierAssignments) are
 * consumed by ProviderRegistry for model list, provider priority, and tier
 * assignments. They share the same np_providers persistence key as API keys.
 */
export interface ProviderState {
  selectedProvider: string | null;
  apiKeys: Record<string, string>;
  setSelectedProvider: (provider: string | null) => void;
  setApiKey: (provider: string, key: string) => void;

  // Model registry fields (consumed by ProviderRegistry)
  modelEntries: ModelEntry[];
  providerPriority: string[];
  tierAssignments: Record<string, string>;
  setModelEntries: (entries: ModelEntry[]) => void;
  setProviderPriority: (priority: string[]) => void;
  setTierAssignments: (assignments: Record<string, string>) => void;
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
      modelEntries: [],
      providerPriority: [],
      tierAssignments: {},
      setModelEntries: (modelEntries) => set({ modelEntries }),
      setProviderPriority: (providerPriority) => set({ providerPriority }),
      setTierAssignments: (tierAssignments) => set({ tierAssignments }),
    }),
    {
      name: 'np_providers',
      storage: encryptedJSONStorage,
    },
  ),
);
