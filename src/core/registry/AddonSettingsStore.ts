import { create } from 'zustand';

interface AddonSettingsState {
  settings: Record<string, unknown>;
  set(addonId: string, value: unknown): void;
  get(addonId: string): unknown;
  reset(): void;
}

export const useAddonSettingsStore = create<AddonSettingsState>((set, get) => ({
  settings: {},
  set: (addonId, value) => {
    set((s) => ({ settings: { ...s.settings, [addonId]: value } }));
  },
  get: (addonId) => get().settings[addonId],
  reset: () => set({ settings: {} }),
}));
