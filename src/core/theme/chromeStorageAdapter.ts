import type { StateStorage } from 'zustand/middleware';

const hasChromeStorageLocal = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
const hasChromeStorageSync = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.sync);

export const chromeStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (hasChromeStorageLocal) {
      const result = await chrome.storage.local.get(name);
      return (result[name] as string | undefined) ?? null;
    }
    return localStorage.getItem(name);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (hasChromeStorageLocal) {
      await chrome.storage.local.set({ [name]: value });
    } else {
      localStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (hasChromeStorageLocal) {
      await chrome.storage.local.remove(name);
    } else {
      localStorage.removeItem(name);
    }
  },
};

/**
 * chrome.storage.sync-backed StateStorage adapter (D-10).
 *
 * Used by ThemeStore so the active theme survives reload across surfaces and
 * (eventually) across devices via chrome.storage.sync. Falls back to
 * localStorage when chrome.storage.sync is unavailable (e.g. unit tests
 * without the mock). The pack field is persisted to a SEPARATE key
 * (`np_theme_pack`) per spec §15.1 / §17.1a APPR-06 — keeping it distinct
 * avoids a Phase-15 migration when pack-specific logic lands.
 */
export const syncStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (hasChromeStorageSync) {
      const result = await chrome.storage.sync.get(name);
      return (result[name] as string | undefined) ?? null;
    }
    return localStorage.getItem(name);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (hasChromeStorageSync) {
      await chrome.storage.sync.set({ [name]: value });
    } else {
      localStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (hasChromeStorageSync) {
      await chrome.storage.sync.remove(name);
    } else {
      localStorage.removeItem(name);
    }
  },
};
