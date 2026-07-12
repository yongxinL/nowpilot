import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDB, mockStoreMap, clearMockStore } = vi.hoisted(() => {
  const storeMap = new Map<string, Record<string, unknown>>();

  const mockStore = {
    put: vi.fn((val: Record<string, unknown>) => {
      storeMap.set(val.id as string, val);
      return Promise.resolve(val.id);
    }),
    get: vi.fn((key: string) => Promise.resolve(storeMap.get(key))),
    getAll: vi.fn(() => Promise.resolve(Array.from(storeMap.values()))),
    delete: vi.fn((key: string) => {
      storeMap.delete(key);
      return Promise.resolve();
    }),
    index: vi.fn(() => ({
      getAll: vi.fn((query: string) =>
        Promise.resolve(
          Array.from(storeMap.values()).filter(
            (v: Record<string, unknown>) => v.status === query,
          ),
        ),
      ),
    })),
  };

  const mockGetDB = vi.fn(() =>
    Promise.resolve({
      transaction: vi.fn(() => ({
        store: mockStore,
        done: Promise.resolve(undefined),
      })),
    }),
  );

  return { mockGetDB, mockStoreMap: storeMap, clearMockStore: () => storeMap.clear() };
});

vi.mock('../../../src/core/storage/IndexedDBManager', () => ({
  getDB: mockGetDB,
}));

import { WriteJournal } from '../../../src/core/storage/WriteJournal';

describe('WriteJournal', () => {
  let journal: WriteJournal;

  beforeEach(() => {
    clearMockStore();
    vi.clearAllMocks();
    journal = new WriteJournal();
  });

  it('begin() creates entry with correct shape', async () => {
    const entry = await journal.begin(
      'update-workspace',
      { workspace: 'ws-1' },
      [{ name: 'persist' }, { name: 'broadcast' }],
    );

    expect(entry.operation).toBe('update-workspace');
    expect(entry.status).toBe('pending');
    expect(entry.targetIds).toEqual({ workspace: 'ws-1' });
    expect(entry.steps).toHaveLength(2);
    expect(entry.steps[0]).toEqual({ name: 'persist', status: 'pending' });
    expect(entry.steps[1]).toEqual({ name: 'broadcast', status: 'pending' });
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('markStepComplete() updates step status and increments attempts', async () => {
    const entry = await journal.begin('update-workspace', { workspace: 'ws-1' }, [
      { name: 'step-1' },
    ]);

    await journal.markStepComplete(entry.id, 0);

    const storedEntry = mockStoreMap.get(entry.id);
    expect(storedEntry).toBeDefined();
    expect((storedEntry!.steps as Array<Record<string, unknown>>)[0].status).toBe('completed');
    expect(storedEntry!.attempts).toBe(1);
  });

  it('markStepFailed() records error message on step', async () => {
    const entry = await journal.begin('update-workspace', { workspace: 'ws-1' }, [
      { name: 'step-1' },
    ]);

    await journal.markStepFailed(entry.id, 0, 'Network error');

    const storedEntry = mockStoreMap.get(entry.id);
    expect(storedEntry).toBeDefined();
    const step = (storedEntry!.steps as Array<Record<string, unknown>>)[0];
    expect(step.status).toBe('failed');
    expect(step.error).toBe('Network error');
  });

  it('markCompleted() transitions entry to completed', async () => {
    const entry = await journal.begin('update-workspace', { workspace: 'ws-1' }, [
      { name: 'step-1' },
    ]);

    await journal.markCompleted(entry.id);

    // Verify entry status in the mock store
    const storedEntry = mockStoreMap.get(entry.id);
    expect(storedEntry).toBeDefined();
    expect(storedEntry!.status).toBe('completed');
  });

  it('markFailed() transitions entry to failed', async () => {
    const entry = await journal.begin('update-workspace', { workspace: 'ws-1' }, [
      { name: 'step-1' },
    ]);

    await journal.markFailed(entry.id);

    const storedEntry = mockStoreMap.get(entry.id);
    expect(storedEntry).toBeDefined();
    expect(storedEntry!.status).toBe('failed');
  });

  it('recover() skips completed entries and replays pending ones', async () => {
    // Create two entries directly in the mock store
    const completedId = 'completed-uuid';
    const pendingId = 'pending-uuid';

    mockStoreMap.set(completedId, {
      id: completedId,
      operation: 'update-workspace',
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 1,
      targetIds: { workspace: 'ws-1' },
      steps: [{ name: 'persist', status: 'completed' }],
    });

    mockStoreMap.set(pendingId, {
      id: pendingId,
      operation: 'update-workspace',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 0,
      targetIds: { workspace: 'ws-2' },
      steps: [{ name: 'persist', status: 'pending' }],
    });

    const recoveredCount = await journal.recover();

    expect(recoveredCount).toBe(1);

    // The completed entry should still have status 'completed'
    const completedEntry = mockStoreMap.get(completedId);
    expect(completedEntry!.status).toBe('completed');

    // The pending entry should now be marked as applying
    const pendingEntry = mockStoreMap.get(pendingId);
    expect(pendingEntry!.status).toBe('applying');
  });
});
