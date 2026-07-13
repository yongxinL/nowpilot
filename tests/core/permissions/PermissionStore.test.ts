import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionStore } from '../../../src/core/permissions/PermissionStore';

const PERMISSIONS_KEY = 'np_mcp_permissions';

describe('PermissionStore', () => {
  let store: PermissionStore;
  let localGetMock: ReturnType<typeof vi.fn>;
  let localSetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localGetMock = vi.mocked(chrome.storage.local.get) as unknown as ReturnType<typeof vi.fn>;
    localSetMock = vi.mocked(chrome.storage.local.set) as unknown as ReturnType<typeof vi.fn>;
    store = new PermissionStore();
  });

  it('getPermission returns null for unknown tool (no stored permission)', async () => {
    localGetMock.mockResolvedValue({});
    const result = await store.getPermission('unknown-tool');
    expect(result).toBeNull();
  });

  it('setPermission then getPermission returns stored decision', async () => {
    localGetMock
      .mockResolvedValueOnce({}) // first read — empty
      .mockResolvedValueOnce({ [PERMISSIONS_KEY]: { echo: 'allow-always' } }); // second read — after write
    localSetMock.mockResolvedValue(undefined);

    await store.setPermission('echo', 'allow-always');
    const result = await store.getPermission('echo');
    expect(result).toBe('allow-always');
  });

  it('setPermission with deny then getPermission returns deny', async () => {
    localGetMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ [PERMISSIONS_KEY]: { counter: 'deny' } });
    localSetMock.mockResolvedValue(undefined);

    await store.setPermission('counter', 'deny');
    const result = await store.getPermission('counter');
    expect(result).toBe('deny');
  });

  it('clearPermission removes stored permission; getPermission returns null', async () => {
    localGetMock
      .mockResolvedValueOnce({ [PERMISSIONS_KEY]: { echo: 'allow-always' } }) // initial state
      .mockResolvedValueOnce({ [PERMISSIONS_KEY]: {} }); // after clear
    localSetMock.mockResolvedValue(undefined);

    await store.clearPermission('echo');
    const result = await store.getPermission('echo');
    expect(result).toBeNull();
  });

  it('persistence survives multiple instances — new store reads same key', async () => {
    localGetMock.mockResolvedValue({ [PERMISSIONS_KEY]: { echo: 'allow-always' } });
    const store2 = new PermissionStore();
    const result = await store2.getPermission('echo');
    expect(result).toBe('allow-always');
  });

  it('clearPermission for non-existent tool does not throw', async () => {
    localGetMock.mockResolvedValue({});
    localSetMock.mockResolvedValue(undefined);

    await expect(store.clearPermission('nonexistent')).resolves.toBeUndefined();
  });
});
