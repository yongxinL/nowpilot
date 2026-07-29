import type { StateStorage } from 'zustand/middleware';

const hasChromeStorage = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);

export const chromeStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (hasChromeStorage) {
      const result = await chrome.storage.local.get(name);
      return (result[name] as string | undefined) ?? null;
    }
    return localStorage.getItem(name);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (hasChromeStorage) {
      await chrome.storage.local.set({ [name]: value });
    } else {
      localStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (hasChromeStorage) {
      await chrome.storage.local.remove(name);
    } else {
      localStorage.removeItem(name);
    }
  },
};
