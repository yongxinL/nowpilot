import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ThemePack = 'default' | 'liquid-glass' | 'claude-warm';

export interface ThemeState {
  mode: ThemeMode;
  pack: ThemePack;
  effectiveDark: boolean;
  setMode(mode: ThemeMode): void;
  setPack(pack: ThemePack): void;
  recomputeAuto(): void;
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

const chromeSyncStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const v = await chrome.storage.sync.get(name);
    return (v[name] as string | undefined) ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await chrome.storage.sync.set({ [name]: value });
  },
  removeItem: async (name: string): Promise<void> => {
    await chrome.storage.sync.remove(name);
  },
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'auto',
      pack: 'default',
      effectiveDark: resolveDark('auto'),
      setMode: (mode) => set({ mode, effectiveDark: resolveDark(mode) }),
      setPack: (pack) => set({ pack }),
      recomputeAuto: () => {
        if (get().mode === 'auto') set({ effectiveDark: resolveDark('auto') });
      },
    }),
    {
      name: 'np_theme',
      storage: createJSONStorage(() => chromeSyncStorage),
    },
  ),
);

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const change = changes.np_theme;
    if (!change) return;
    const stored = change.newValue as { state?: { mode?: ThemeMode; pack?: ThemePack } } | undefined;
    const nextMode = stored?.state?.mode;
    const nextPack = stored?.state?.pack;
    const current = useThemeStore.getState();
    if (nextMode && nextMode !== current.mode) current.setMode(nextMode);
    if (nextPack && nextPack !== current.pack) current.setPack(nextPack);
  });
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => useThemeStore.getState().recomputeAuto());
}
