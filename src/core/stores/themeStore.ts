import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const chromeSyncStorage = createJSONStorage<ThemeState>(() => ({
  getItem: (name: string) =>
    chrome.storage.sync.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.sync.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.sync.remove(name),
}));

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'auto',
      setMode: (mode: ThemeMode) => set({ mode }),
    }),
    {
      name: 'nowpilot-theme',
      storage: chromeSyncStorage,
    },
  ),
);
