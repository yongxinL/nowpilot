import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';

const Schema = z.object({ value: z.number() });

describe('createValidatedStorage', () => {
  it('returns missing when a key is absent', async () => {
    const storage = createValidatedStorage(createChromeStorageMock());
    await expect(storage.read('np_workspace_meta', Schema)).resolves.toEqual({ status: 'missing' });
  });

  it('returns a parsed value for valid stored data', async () => {
    const mock = createChromeStorageMock();
    mock.local._setRaw('np_workspace_meta', { value: 3 });
    const storage = createValidatedStorage(mock);
    await expect(storage.read('np_workspace_meta', Schema)).resolves.toEqual({
      status: 'valid',
      value: { value: 3 },
    });
  });

  it('returns invalid without throwing for malformed stored data', async () => {
    const mock = createChromeStorageMock();
    mock.local._setRaw('np_workspace_meta', { value: 'not-a-number' });
    const storage = createValidatedStorage(mock);
    await expect(storage.read('np_workspace_meta', Schema)).resolves.toEqual({ status: 'invalid' });
  });

  it('writes through the schema to the mapped area', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    await storage.write('np_theme', Schema, { value: 1 });
    expect(mock.sync.set).toHaveBeenCalledWith({ np_theme: { value: 1 } });
    expect(mock.local.set).not.toHaveBeenCalled();
  });

  it('rejects invalid values before writing', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    await expect(storage.write('np_theme', Schema, { value: 'bad' } as never)).rejects.toThrow();
    expect(mock.sync.set).not.toHaveBeenCalled();
  });

  it('removes a key from its mapped area', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    await storage.remove('np_workspace_election');
    expect(mock.session.remove).toHaveBeenCalledWith('np_workspace_election');
  });

  it('notifies subscribers only for the subscribed key and validates the value', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    const listener = vi.fn();
    const unsubscribe = storage.subscribe('np_theme', Schema, listener);
    mock.emitStorageChange({ np_theme: { newValue: { value: 9 } } }, 'sync');
    mock.emitStorageChange({ np_theme_pack: { newValue: 'other' } }, 'sync');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ status: 'valid', value: { value: 9 } });
    unsubscribe();
    mock.emitStorageChange({ np_theme: { newValue: { value: 10 } } }, 'sync');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports invalid on a change event with malformed data', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    const listener = vi.fn();
    storage.subscribe('np_theme', Schema, listener);
    mock.emitStorageChange({ np_theme: { newValue: 'bad' } }, 'sync');
    expect(listener).toHaveBeenCalledWith({ status: 'invalid' });
  });
});
