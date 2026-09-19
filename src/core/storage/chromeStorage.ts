import type { ZodType } from 'zod';
import type { StorageArea, StorageKey } from './storageKeys';
import { STORAGE_KEY_AREAS } from './storageKeys';

export type { StorageArea, StorageKey } from './storageKeys';

export interface ChromeStorageAreaLike {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface ChromeStorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export type ChromeStorageChangedListener = (
  changes: Record<string, ChromeStorageChange>,
  areaName: StorageArea,
) => void;

export interface ChromeStorageOnChangedLike {
  addListener(listener: ChromeStorageChangedListener): void;
  removeListener(listener: ChromeStorageChangedListener): void;
}

export interface ChromeStorageLike {
  local: ChromeStorageAreaLike;
  sync: ChromeStorageAreaLike;
  session: ChromeStorageAreaLike;
  onChanged: ChromeStorageOnChangedLike;
}

export function getChromeStorage(): ChromeStorageLike {
  const storage = (globalThis as { chrome?: { storage?: ChromeStorageLike } }).chrome?.storage;
  if (!storage) {
    throw new Error('chrome.storage is unavailable in this context');
  }
  return storage;
}

export type StorageReadResult<T> =
  { status: 'missing' } | { status: 'valid'; value: T } | { status: 'invalid' };

export interface ValidatedStorage {
  read<T>(key: StorageKey, schema: ZodType<T>): Promise<StorageReadResult<T>>;
  write<T>(key: StorageKey, schema: ZodType<T>, value: T): Promise<void>;
  remove(key: StorageKey): Promise<void>;
  subscribe<T>(
    key: StorageKey,
    schema: ZodType<T>,
    listener: (result: StorageReadResult<T>) => void,
  ): () => void;
}

function parse<T>(schema: ZodType<T>, raw: unknown): StorageReadResult<T> {
  const result = schema.safeParse(raw);
  return result.success ? { status: 'valid', value: result.data } : { status: 'invalid' };
}

export function createValidatedStorage(
  chromeStorage: ChromeStorageLike = getChromeStorage(),
): ValidatedStorage {
  function areaFor(key: StorageKey): ChromeStorageAreaLike {
    return chromeStorage[STORAGE_KEY_AREAS[key]];
  }

  return {
    async read<T>(key: StorageKey, schema: ZodType<T>): Promise<StorageReadResult<T>> {
      const record = await areaFor(key).get(key);
      if (!(key in record)) return { status: 'missing' };
      return parse(schema, record[key]);
    },
    async write<T>(key: StorageKey, schema: ZodType<T>, value: T): Promise<void> {
      const parsed = schema.parse(value);
      await areaFor(key).set({ [key]: parsed });
    },
    async remove(key: StorageKey): Promise<void> {
      await areaFor(key).remove(key);
    },
    subscribe<T>(
      key: StorageKey,
      schema: ZodType<T>,
      listener: (result: StorageReadResult<T>) => void,
    ): () => void {
      const areaName = STORAGE_KEY_AREAS[key];
      const handler: ChromeStorageChangedListener = (changes, changedArea) => {
        if (changedArea !== areaName || !(key in changes)) return;
        const change = changes[key]!;
        if (change.newValue === undefined) {
          listener({ status: 'missing' });
          return;
        }
        listener(parse(schema, change.newValue));
      };
      chromeStorage.onChanged.addListener(handler);
      return () => chromeStorage.onChanged.removeListener(handler);
    },
  };
}
