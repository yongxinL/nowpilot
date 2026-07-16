if (typeof globalThis.chrome === 'undefined' || !globalThis.chrome.storage) {
  console.info('[chromePolyfill] Initializing chrome extension API mock');

  const listeners = new Set<(changes: Record<string, any>, areaName: string) => void>();

  const createStorageArea = (areaName: 'local' | 'sync' | 'session') => {
    // Session is in-memory only, local/sync use localStorage
    const sessionStore: Record<string, string> = {};

    const getStoreValue = (key: string): any => {
      if (areaName === 'session') {
        return sessionStore[key] ? JSON.parse(sessionStore[key]) : undefined;
      }
      try {
        const val = localStorage.getItem(`chrome_mock_${areaName}_${key}`);
        return val ? JSON.parse(val) : undefined;
      } catch {
        return undefined;
      }
    };

    const setStoreValue = (key: string, value: any): void => {
      const serialized = JSON.stringify(value);
      if (areaName === 'session') {
        sessionStore[key] = serialized;
      } else {
        try {
          localStorage.setItem(`chrome_mock_${areaName}_${key}`, serialized);
        } catch {}
      }
    };

    const removeStoreValue = (key: string): void => {
      if (areaName === 'session') {
        delete sessionStore[key];
      } else {
        try {
          localStorage.removeItem(`chrome_mock_${areaName}_${key}`);
        } catch {}
      }
    };

    return {
      get: async (keys?: string | string[] | Record<string, any> | null) => {
        const result: Record<string, any> = {};
        if (!keys) {
          // get all
          if (areaName === 'session') {
            for (const [k, v] of Object.entries(sessionStore)) {
              result[k] = JSON.parse(v);
            }
          } else {
            const prefix = `chrome_mock_${areaName}_`;
            for (let i = 0; i < localStorage.length; i++) {
              const fullKey = localStorage.key(i);
              if (fullKey && fullKey.startsWith(prefix)) {
                const k = fullKey.substring(prefix.length);
                result[k] = getStoreValue(k);
              }
            }
          }
        } else if (typeof keys === 'string') {
          result[keys] = getStoreValue(keys);
        } else if (Array.isArray(keys)) {
          for (const k of keys) {
            result[k] = getStoreValue(k);
          }
        } else {
          for (const [k, defaultVal] of Object.entries(keys)) {
            const val = getStoreValue(k);
            result[k] = val !== undefined ? val : defaultVal;
          }
        }
        return result;
      },
      set: async (items: Record<string, any>) => {
        const changes: Record<string, any> = {};
        for (const [k, v] of Object.entries(items)) {
          const oldVal = getStoreValue(k);
          setStoreValue(k, v);
          changes[k] = { oldValue: oldVal, newValue: v };
        }
        for (const listener of listeners) {
          try {
            listener(changes, areaName);
          } catch (err) {
            console.error('Error in chrome.storage.onChanged listener', err);
          }
        }
      },
      remove: async (keys: string | string[]) => {
        const changes: Record<string, any> = {};
        const keysArr = typeof keys === 'string' ? [keys] : keys;
        for (const k of keysArr) {
          const oldVal = getStoreValue(k);
          removeStoreValue(k);
          changes[k] = { oldValue: oldVal, newValue: undefined };
        }
        for (const listener of listeners) {
          try {
            listener(changes, areaName);
          } catch (err) {
            console.error('Error in chrome.storage.onChanged listener', err);
          }
        }
      },
      clear: async () => {
        if (areaName === 'session') {
          for (const key of Object.keys(sessionStore)) {
            delete sessionStore[key];
          }
        } else {
          const prefix = `chrome_mock_${areaName}_`;
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const fullKey = localStorage.key(i);
            if (fullKey && fullKey.startsWith(prefix)) {
              keysToRemove.push(fullKey);
            }
          }
          for (const k of keysToRemove) {
            localStorage.removeItem(k);
          }
        }
      }
    };
  };

  const mockChrome = {
    runtime: {
      id: 'nowpilot-mock-extension-id',
      getURL: (path: string) => path,
      getManifest: () => ({ version: '1.0.0-mock' }),
      openOptionsPage: () => {
        window.open('/options.html', '_blank');
      },
    },
    storage: {
      local: createStorageArea('local'),
      sync: createStorageArea('sync'),
      session: createStorageArea('session'),
      onChanged: {
        addListener: (callback: (changes: Record<string, any>, areaName: string) => void) => {
          listeners.add(callback);
        },
        removeListener: (callback: (changes: Record<string, any>, areaName: string) => void) => {
          listeners.delete(callback);
        },
      }
    },
    tabs: {
      query: async (queryInfo: any) => {
        return [];
      },
      update: async (tabId: number, updateProperties: any) => {
        return {};
      },
      create: async (createProperties: any) => {
        if (createProperties?.url) {
          window.open(createProperties.url, '_blank');
        }
        return { id: 9999 };
      },
    },
    windows: {
      update: async (windowId: number, updateInfo: any) => {
        return {};
      },
    },
    sidePanel: {
      open: async (options: any) => {
        window.open('/sidepanel.html', '_blank');
        return {};
      },
    },
  };

  (globalThis as any).chrome = mockChrome;
}

export {};
