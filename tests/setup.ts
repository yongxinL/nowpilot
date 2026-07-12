import { vi } from 'vitest';

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

if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = MockResizeObserver;
}

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      getBytesInUse: vi.fn().mockResolvedValue(0),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn((path: string) => path),
    onInstalled: {
      addListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
    },
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({}),
  },
  windows: {
    update: vi.fn().mockResolvedValue({}),
  },
  sidePanel: {
    open: vi.fn().mockResolvedValue(undefined),
    setPanelBehavior: vi.fn().mockResolvedValue(undefined),
  },
});

if (typeof globalThis.crypto === 'undefined' || !(globalThis.crypto as any).subtle) {
  vi.stubGlobal('crypto', {
    getRandomValues: vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    }),
    subtle: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      deriveKey: vi.fn(),
      importKey: vi.fn(),
      generateKey: vi.fn(),
    },
  });
}
