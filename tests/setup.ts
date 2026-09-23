import { vi } from 'vitest';
// The deterministic IndexedDB test double. `fake-indexeddb/auto` installs the
// standard `indexedDB` / `IDBKeyRange` globals once per test file; the double
// keeps its state per `IDBFactory` instance, so every IndexedDB suite calls
// `(globalThis as any).__resetIndexedDB()` from `beforeEach` (alongside the
// existing storage-map clear) and closes its handles in `afterEach`.
// Registered BEFORE any module that could capture the global (plan 02-01).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

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

// --- IndexedDB reset seam (plan 02-01, Wave 0) ---
// A fresh `IDBFactory` per test is what stops test-order dependence: without
// the reset every test in a file shares one database (RESEARCH Pitfall 8).
const resetIndexedDB = (): void => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
};
(globalThis as any).__resetIndexedDB = resetIndexedDB;

// --- Shared chrome.storage.onChanged dispatcher (plan 02-01, Wave 0) ---
// ONE module-level registry that every simulated surface in a test file
// subscribes to through `chrome.storage.onChanged.addListener`. The local and
// session areas emit after each map update, so a write in one surface is
// observable by the other without a reload (D2-32 clause "completion in one
// surface updating the other"). The emitter is synchronous and fail-safe: a
// listener that throws never stops the remaining listeners.
type StorageOnChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void;

const storageOnChangedListeners: StorageOnChangedListener[] = [];

/** Emit one change event to every registered listener (area: `local` | `session`). */
function fireStorageChanged(
  areaName: 'local' | 'session',
  changes: Record<string, chrome.storage.StorageChange>,
): void {
  for (const listener of [...storageOnChangedListeners]) {
    try {
      listener(changes, areaName);
    } catch {
      // Fail-safe: one throwing listener must not stop the remaining listeners.
    }
  }
}

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
      const oldValue = chromeStorage.get(key);
      chromeStorage.set(key, value as string);
      fireStorageChanged('local', { [key]: { oldValue, newValue: value } });
    }
    return Promise.resolve();
  }),
  remove: vi.fn((keys: string | string[]): Promise<void> => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      const oldValue = chromeStorage.get(k);
      chromeStorage.delete(k);
      // Removal carries `oldValue` only — the same shape the real API emits.
      fireStorageChanged('local', { [k]: { oldValue } });
    }
    return Promise.resolve();
  }),
  clear: vi.fn((): Promise<void> => {
    const cleared = Object.fromEntries(chromeStorage);
    chromeStorage.clear();
    for (const [key, oldValue] of Object.entries(cleared)) {
      fireStorageChanged('local', { [key]: { oldValue } });
    }
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

// --- Chrome storage.session mock (Map-backed, same shape as local) ---
// The election record (`np_workspace_primary`) lives here; it is a separate
// area from local, its own map, and emits on the shared onChanged dispatcher
// with areaName `'session'`.
const chromeStorageSessionMap = new Map<string, string>();

const chromeStorageSession = {
  get: vi.fn(
    (keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> => {
      if (keys === undefined || keys === null) {
        return Promise.resolve(Object.fromEntries(chromeStorageSessionMap));
      }
      if (typeof keys === 'string') {
        const val = chromeStorageSessionMap.get(keys) ?? null;
        return Promise.resolve({ [keys]: val });
      }
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const k of keys) {
          result[k] = chromeStorageSessionMap.get(k) ?? null;
        }
        return Promise.resolve(result);
      }
      return Promise.resolve({ ...(keys as Record<string, unknown>) });
    },
  ),
  set: vi.fn((items: Record<string, unknown>): Promise<void> => {
    for (const [key, value] of Object.entries(items)) {
      const oldValue = chromeStorageSessionMap.get(key);
      chromeStorageSessionMap.set(key, value as string);
      fireStorageChanged('session', { [key]: { oldValue, newValue: value } });
    }
    return Promise.resolve();
  }),
  remove: vi.fn((keys: string | string[]): Promise<void> => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      const oldValue = chromeStorageSessionMap.get(k);
      chromeStorageSessionMap.delete(k);
      fireStorageChanged('session', { [k]: { oldValue } });
    }
    return Promise.resolve();
  }),
  clear: vi.fn((): Promise<void> => {
    const cleared = Object.fromEntries(chromeStorageSessionMap);
    chromeStorageSessionMap.clear();
    for (const [key, oldValue] of Object.entries(cleared)) {
      fireStorageChanged('session', { [key]: { oldValue } });
    }
    return Promise.resolve();
  }),
};

(globalThis as any).__chromeStorageSessionMap = chromeStorageSessionMap;

const chromeStorageOnChanged = {
  addListener: vi.fn((listener: StorageOnChangedListener): void => {
    if (!storageOnChangedListeners.includes(listener)) {
      storageOnChangedListeners.push(listener);
    }
  }),
  removeListener: vi.fn((listener: StorageOnChangedListener): void => {
    const index = storageOnChangedListeners.indexOf(listener);
    if (index >= 0) {
      storageOnChangedListeners.splice(index, 1);
    }
  }),
};

if (!(globalThis as any).chrome) {
  (globalThis as any).chrome = {} as typeof chrome;
}
(globalThis as any).chrome.storage = {
  local: chromeStorageLocal as any,
  sync: chromeStorageSync as any,
  session: chromeStorageSession as any,
  onChanged: chromeStorageOnChanged as any,
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
