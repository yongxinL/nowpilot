import type { StateStorage } from 'zustand/middleware';

const hasSessionStorage = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.session);

export const sessionStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (hasSessionStorage) {
      const result = await chrome.storage.session.get(name);
      return (result[name] as string | undefined) ?? null;
    }
    return sessionStorage.getItem(name);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (hasSessionStorage) {
      await chrome.storage.session.set({ [name]: value });
    } else {
      sessionStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (hasSessionStorage) {
      await chrome.storage.session.remove(name);
    } else {
      sessionStorage.removeItem(name);
    }
  },
};
