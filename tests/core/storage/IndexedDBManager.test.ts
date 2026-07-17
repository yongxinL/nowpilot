import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted is hoisted above vi.mock, ensuring variables are initialized before use
const idbMock = vi.hoisted(() => {
  const mockCreateIndex = vi.fn();
  const mockStore = { createIndex: mockCreateIndex };
  const mockCreateObjectStore = vi.fn().mockReturnValue(mockStore);

  const captured: { config: unknown } = { config: null };

  const mockOpenDB = vi.fn().mockImplementation(
    async (_name: string, _version: number, config: unknown) => {
      captured.config = config;
      return { createObjectStore: mockCreateObjectStore };
    },
  );

  return { mockOpenDB, mockCreateObjectStore, mockCreateIndex, captured };
});

vi.mock('idb', () => ({
  openDB: idbMock.mockOpenDB,
}));

import { DB_VERSION, getDB } from '@/core/storage/IndexedDBManager';

describe('IndexedDBManager', () => {
  beforeEach(() => {
    idbMock.mockOpenDB.mockClear();
    idbMock.mockCreateObjectStore.mockClear();
    idbMock.mockCreateIndex.mockClear();
    idbMock.captured.config = null;
  });

  it('DB_VERSION is 4', () => {
    expect(DB_VERSION).toBe(4);
  });

  it('getDB() calls openDB with correct params', async () => {
    await getDB();
    expect(idbMock.mockOpenDB).toHaveBeenCalledWith(
      'nowpilot',
      4,
      expect.objectContaining({
        upgrade: expect.any(Function),
        blocked: expect.any(Function),
        blocking: expect.any(Function),
        terminated: expect.any(Function),
      }),
    );
  });

  it('getDB() caches the connection (singleton)', async () => {
    // dbInstance was set by previous test; mockOpenDB cleared in beforeEach
    const result = await getDB();
    expect(result).toEqual({ createObjectStore: idbMock.mockCreateObjectStore });
    expect(idbMock.mockOpenDB).not.toHaveBeenCalled();
  });

  it('getDB() returns same instance on second call', async () => {
    const result = await getDB();
    expect(result).toEqual({ createObjectStore: idbMock.mockCreateObjectStore });
  });

  describe('upgrade callback', () => {
    it('creates all 13 object stores when oldVersion < 1', async () => {
      vi.resetModules();
      idbMock.captured.config = null;
      idbMock.mockOpenDB.mockClear();
      idbMock.mockCreateObjectStore.mockClear();
      idbMock.mockCreateIndex.mockClear();

      // Re-import to get fresh module state (dbInstance = null)
      const { getDB: getDBFresh } = await import('@/core/storage/IndexedDBManager');
      await getDBFresh();

      expect(idbMock.captured.config).not.toBeNull();
      const config = idbMock.captured.config as {
        upgrade: (db: unknown, oldVersion: number, newVersion: number, transaction: unknown) => void;
      };
      const upgrade = config.upgrade;

      // Mock DB object with fresh spy instances
      const localCreateIndex = vi.fn();
      const localStore = { createIndex: localCreateIndex };
      const localCreateObjectStore = vi.fn().mockReturnValue(localStore);
      const localDb = { createObjectStore: localCreateObjectStore };

      // Mock transaction with objectStore for oldVersion < 3 index creation
      const mockObjectStore = vi.fn().mockReturnValue(localStore);
      const mockTransaction = { objectStore: mockObjectStore };

      // Invoke the upgrade callback as if oldVersion < 1 (triggers v1, v2, v3, and v4 blocks)
      upgrade(localDb, 0, 1, mockTransaction);

      // Verify 17 object stores were created (13 original + 3 new trace stores + notes_backup_config)
      expect(localCreateObjectStore).toHaveBeenCalledTimes(17);

      // Verify each store name and keyPath
      expect(localCreateObjectStore).toHaveBeenCalledWith('chat_history_sessions', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('chat_history_messages', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('notes_notes', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('notes_concepts', { keyPath: 'slug' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('memory_messages', {
        keyPath: ['conversationId', 'seq'],
      });
      expect(localCreateObjectStore).toHaveBeenCalledWith('memory_userFacts', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('memory_summaries', { keyPath: 'conversationId' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('errors', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('transaction_log_transactions', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('transaction_log_promptTraces', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('transaction_log_toolTraces', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('transaction_log_providerTraces', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('write_journal_entries', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('transaction_log_cacheTraces', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('transaction_log_memoryTraces', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('transaction_log_writeJournalTraces', { keyPath: 'id' });
      expect(localCreateObjectStore).toHaveBeenCalledWith('notes_backup_config', { keyPath: 'id' });

      // Verify createIndex calls via transaction.objectStore for v3 indexes
      expect(mockObjectStore).toHaveBeenCalledWith('transaction_log_transactions');
      expect(mockObjectStore).toHaveBeenCalledWith('transaction_log_promptTraces');
      expect(mockObjectStore).toHaveBeenCalledWith('transaction_log_toolTraces');
      expect(mockObjectStore).toHaveBeenCalledWith('transaction_log_providerTraces');

      // Verify createIndex on the transaction store object for by-operationId and others
      expect(localCreateIndex).toHaveBeenCalledWith('by-operationId', 'operationId');
      expect(localCreateIndex).toHaveBeenCalledWith('by-status', 'status');
      expect(localCreateIndex).toHaveBeenCalledWith('by-severity', 'severity');
      expect(localCreateIndex).toHaveBeenCalledWith('by-timestamp', 'startedAt');

      // Verify createIndex was called for by-session and by-status (original)
      const bySessionCalls = localCreateIndex.mock.calls.filter(
        (call: unknown[]) => call[0] === 'by-session' && call[1] === 'sessionId',
      );
      const byStatusCalls = localCreateIndex.mock.calls.filter(
        (call: unknown[]) => call[0] === 'by-status' && call[1] === 'status',
      );
      expect(bySessionCalls.length).toBeGreaterThanOrEqual(1);
      expect(byStatusCalls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
