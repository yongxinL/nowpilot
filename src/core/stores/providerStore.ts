import { create } from 'zustand';

/**
 * Phase 1 placeholder for provider configuration.
 *
 * Stores provider selections in-memory only (no persistence).
 * Phase 2 (STOR-02) will replace this with encrypted chrome.storage.local
 * using AES-GCM with per-key salt/IV via EncryptedStorage.
 *
 * T-05-KEY mitigation: API keys are held in memory only during Phase 1.
 * The Input.Password component masks the key on screen.
 */
export interface ProviderState {
  selectedProvider: string | null;
  apiKeys: Record<string, string>;
  setSelectedProvider: (provider: string | null) => void;
  setApiKey: (provider: string, key: string) => void;
}

export const useProviderStore = create<ProviderState>((set) => ({
  selectedProvider: null,
  apiKeys: {},
  setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
  setApiKey: (provider, key) =>
    set((state) => ({
      apiKeys: { ...state.apiKeys, [provider]: key },
    })),
}));
