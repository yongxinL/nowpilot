import { describe, expect, it } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createEmptyWorkspaceMetadata } from '@/core/workspace/workspaceTypes';

describe('workspace store', () => {
  it('reports missing metadata and zero version for a fresh profile', async () => {
    const store = createWorkspaceStore(createValidatedStorage(createChromeStorageMock()));
    await expect(store.readMetadata()).resolves.toEqual({ status: 'missing' });
    await expect(store.readVersion()).resolves.toBe(0);
  });

  it('persists metadata and version to chrome.storage.local', async () => {
    const chromeStorage = createChromeStorageMock();
    const store = createWorkspaceStore(createValidatedStorage(chromeStorage));
    const metadata = createEmptyWorkspaceMetadata(1000);
    await store.writeMetadata(metadata);
    await expect(store.readMetadata()).resolves.toEqual({ status: 'valid', metadata });
    await expect(store.readVersion()).resolves.toBe(0);
    expect(chromeStorage.local.set).toHaveBeenCalled();
    expect(chromeStorage.sync.set).not.toHaveBeenCalled();
  });

  it('reports invalid metadata instead of throwing', async () => {
    const chromeStorage = createChromeStorageMock();
    chromeStorage.local._setRaw('np_workspace_meta', { schemaVersion: 'bad' });
    const store = createWorkspaceStore(createValidatedStorage(chromeStorage));
    await expect(store.readMetadata()).resolves.toEqual({ status: 'invalid' });
  });

  it('falls back to version zero for invalid version records', async () => {
    const chromeStorage = createChromeStorageMock();
    chromeStorage.local._setRaw('np_workspace_version', { committedVersion: 'nope' });
    const store = createWorkspaceStore(createValidatedStorage(chromeStorage));
    await expect(store.readVersion()).resolves.toBe(0);
  });
});
