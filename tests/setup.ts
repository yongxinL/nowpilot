import { vi } from 'vitest';

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
  get length() {
    return storage.size;
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
});

// --- ResizeObserver mock (required by antd Layout/Tabs in jsdom) ---
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// --- matchMedia mock (required by antd responsive components) ---
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// --- Chrome storage.local mock (Map-backed, same pattern as localStorage) ---
const chromeStorage = new Map<string, string>();

const chromeStorageLocal = {
  get: vi.fn(
    (keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> => {
      if (keys === undefined || keys === null) {
        return Promise.resolve(Object.fromEntries(chromeStorage));
      }
      if (typeof keys === 'string') {
        // The adapter expects the stored value as-is (already a JSON string).
        // chrome.storage.local in real Chrome API returns stored values as
        // their original JS type. Since our adapter passes strings, this mock
        // stores and returns them directly.
        const val = chromeStorage.get(keys) ?? null;
        return Promise.resolve({ [keys]: val });
      }
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          result[k] = chromeStorage.get(k) ?? null;
        }
        return Promise.resolve(result);
      }
      // Record-shaped keys: return default values from the input object
      // (not used by adapter, but mirrors real chrome.storage.local behavior)
      return Promise.resolve({ ...(keys as Record<string, unknown>) });
    },
  ),
  set: vi.fn((items: Record<string, unknown>): Promise<void> => {
    for (const [key, value] of Object.entries(items)) {
      chromeStorage.set(key, value as string);
    }
    return Promise.resolve();
  }),
  remove: vi.fn((keys: string | string[]): Promise<void> => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      chromeStorage.delete(k);
    }
    return Promise.resolve();
  }),
  clear: vi.fn((): Promise<void> => {
    chromeStorage.clear();
    return Promise.resolve();
  }),
};

// Expose helpers for tests to inspect/reset
(globalThis as any).__chromeStorageLocal = chromeStorageLocal;
(globalThis as any).__chromeStorageMap = chromeStorage;

// --- Chrome storage.sync mock (Map-backed, same pattern as local) ---
const chromeStorageSync = {
  get: vi.fn(
    (keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> => {
      if (keys === undefined || keys === null) {
        return Promise.resolve(Object.fromEntries(chromeStorage));
      }
      if (typeof keys === 'string') {
        const val = chromeStorage.get(keys) ?? null;
        return Promise.resolve({ [keys]: val });
      }
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          result[k] = chromeStorage.get(k) ?? null;
        }
        return Promise.resolve(result);
      }
      return Promise.resolve({ ...(keys as Record<string, unknown>) });
    },
  ),
  set: vi.fn((items: Record<string, unknown>): Promise<void> => {
    for (const [key, value] of Object.entries(items)) {
      chromeStorage.set(key, value as string);
    }
    return Promise.resolve();
  }),
  remove: vi.fn((keys: string | string[]): Promise<void> => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      chromeStorage.delete(k);
    }
    return Promise.resolve();
  }),
  clear: vi.fn((): Promise<void> => {
    chromeStorage.clear();
    return Promise.resolve();
  }),
};

(globalThis as any).__chromeStorageSync = chromeStorageSync;

if (!(globalThis as any).chrome) {
  (globalThis as any).chrome = {} as typeof chrome;
}
(globalThis as any).chrome.storage = {
  local: chromeStorageLocal as any,
  sync: chromeStorageSync as any,
};

// --- BroadcastChannel mock ---
const broadcastChannels = new Map<string, any[]>();

vi.stubGlobal('BroadcastChannel', class {
  readonly name: string;
  private _onmsg: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    if (!broadcastChannels.has(name)) {
      broadcastChannels.set(name, []);
    }
    broadcastChannels.get(name)!.push(this);
  }

  get onmessage(): ((event: MessageEvent) => void) | null {
    return this._onmsg;
  }

  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this._onmsg = handler;
  }

  postMessage(data: unknown): void {
    // Dispatch to other channel instances with the same name
    const instances = broadcastChannels.get(this.name) ?? [];
    for (const instance of instances) {
      if (instance !== this && instance.onmessage) {
        instance.onmessage(new MessageEvent('message', { data }));
      }
    }
  }

  close(): void {
    const instances = broadcastChannels.get(this.name);
    if (instances) {
      const idx = instances.indexOf(this);
      if (idx >= 0) instances.splice(idx, 1);
    }
  }
});

// Helper: simulate an incoming broadcast message on a specific channel
(globalThis as any).__broadcast = (channelName: string, data: unknown): void => {
  const instances = broadcastChannels.get(channelName) ?? [];
  for (const instance of instances) {
    if (instance.onmessage) {
      instance.onmessage(new MessageEvent('message', { data }));
    }
  }
};
