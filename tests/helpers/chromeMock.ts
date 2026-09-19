import { vi } from 'vitest';
import type {
  ChromeStorageAreaLike,
  ChromeStorageChange,
  ChromeStorageChangedListener,
  ChromeStorageLike,
  StorageArea,
} from '@/core/storage/chromeStorage';

export interface StorageAreaMock extends ChromeStorageAreaLike {
  _data: Map<string, unknown>;
  _setRaw(key: string, value: unknown): void;
}

export function createStorageAreaMock(): StorageAreaMock {
  const data = new Map<string, unknown>();
  const area: StorageAreaMock = {
    _data: data,
    _setRaw(key, value) {
      data.set(key, value);
    },
    get: vi.fn(async (keys: string | string[] | null) => {
      if (keys === null) return Object.fromEntries(data);
      const list = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of list) if (data.has(key)) result[key] = data.get(key);
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) data.set(key, value);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
    }),
  };
  return area;
}

export interface ChromeStorageMock extends ChromeStorageLike {
  local: StorageAreaMock;
  sync: StorageAreaMock;
  session: StorageAreaMock;
  emitStorageChange(changes: Record<string, ChromeStorageChange>, areaName: StorageArea): void;
}

export function createChromeStorageMock(): ChromeStorageMock {
  const listeners = new Set<ChromeStorageChangedListener>();
  return {
    local: createStorageAreaMock(),
    sync: createStorageAreaMock(),
    session: createStorageAreaMock(),
    onChanged: {
      addListener(listener) {
        listeners.add(listener);
      },
      removeListener(listener) {
        listeners.delete(listener);
      },
    },
    emitStorageChange(changes, areaName) {
      for (const listener of listeners) listener(changes, areaName);
    },
  };
}
