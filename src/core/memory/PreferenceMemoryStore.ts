import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useThemeStore } from '../stores/themeStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { PreferencePayload } from './memoryTypes';

export interface PreferenceState extends PreferencePayload {
  setPreferences: (partial: Partial<PreferencePayload>) => void;
}

const chromeLocalStorage = createJSONStorage<PreferenceState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      // Stub defaults — will cause assertion failures in RED phase
      responseStyle: '',
      preferredLanguage: '',
      preferStructuredOutput: false,
      allowCloudFallbackFromLocal: false,
      defaultProviderId: '',
      toolAutonomy: 'manual' as const,
      setPreferences: (partial: Partial<PreferencePayload>) => set(partial),
    }),
    {
      name: 'np_preferences',
      storage: chromeLocalStorage,
    },
  ),
);

export const preferenceMemoryStore = {
  get: () => {
    const state = usePreferenceStore.getState();
    return {
      responseStyle: state.responseStyle,
      preferredLanguage: state.preferredLanguage,
      preferStructuredOutput: state.preferStructuredOutput,
      allowCloudFallbackFromLocal: state.allowCloudFallbackFromLocal,
      defaultProviderId: state.defaultProviderId,
      toolAutonomy: state.toolAutonomy,
      themeMode: useThemeStore.getState().mode,
      defaultSurface: useWorkspaceStore.getState().activeSurface,
    };
  },
};
