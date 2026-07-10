import { vi, beforeAll } from 'vitest';

beforeAll(() => {
  const mockStorage = {
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
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  };

  vi.stubGlobal('chrome', {
    storage: mockStorage,
    runtime: {
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
    },
  });
});
