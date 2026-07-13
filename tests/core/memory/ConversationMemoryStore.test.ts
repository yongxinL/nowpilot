import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub IDBKeyRange for jsdom (used by MemoryDB.getMessages)
vi.hoisted(() => {
  globalThis.IDBKeyRange = {
    bound: vi.fn((lower, upper) => ({ lower, upper })),
  } as unknown as typeof IDBKeyRange;
});

const { mockGetDB, mockDb } = vi.hoisted(() => {
  const mockStore = {
    getAll: vi.fn().mockResolvedValue([]),
    index: vi.fn(() => ({ getAll: vi.fn().mockResolvedValue([]) })),
  };

  const mockTransaction = vi.fn(() => ({
    store: mockStore,
    done: Promise.resolve(undefined),
  }));

  const mockDbInstance = {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    clear: vi.fn().mockResolvedValue(undefined),
    transaction: mockTransaction,
  };

  const mockGetDB = vi.fn().mockResolvedValue(mockDbInstance);

  return { mockGetDB, mockDb: mockDbInstance };
});

vi.mock('../../../src/core/storage/IndexedDBManager', () => ({
  getDB: mockGetDB,
}));

import { conversationMemoryStore } from '../../../src/core/memory/ConversationMemoryStore';

function makeMessage(conversationId: string, seq: number, role: string, content: string) {
  return { conversationId, seq, role, content, timestamp: 1000 + seq };
}

function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    conversationId: 'conv-1',
    summary: 'Existing summary text',
    messageCount: 10,
    created: 1000,
    updated: 2000,
    state: 'active' as const,
    ...overrides,
  };
}

describe('ConversationMemoryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getContext', () => {
    it('returns exactly 2 recent turns for tiny tier', async () => {
      // 8 messages = 4 turns
      const messages = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
        makeMessage('conv-1', n, n % 2 === 0 ? 'assistant' : 'user', `msg ${n}`),
      );
      mockDb.get.mockResolvedValue(undefined);
      mockDb.transaction.mockImplementation(() => {
        const store = {
          getAll: vi.fn().mockResolvedValue(messages),
          index: vi.fn(() => ({ getAll: vi.fn().mockResolvedValue([]) })),
        };
        return { store, done: Promise.resolve(undefined) };
      });

      const result = await conversationMemoryStore.getContext('conv-1', 'tiny');

      // 2 turns = 4 messages per plan definition (turn = user+assistant pair)
      expect(result.recentTurns).toHaveLength(4);
      expect(result.recentTurns[0].content).toBe('msg 5');
      expect(result.recentTurns[1].content).toBe('msg 6');
      expect(result.recentTurns[2].content).toBe('msg 7');
      expect(result.recentTurns[3].content).toBe('msg 8');
    });

    it('returns 4 recent turns for small tier', async () => {
      const messages = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
        makeMessage('conv-1', n, n % 2 === 0 ? 'assistant' : 'user', `msg ${n}`),
      );
      mockDb.get.mockResolvedValue(undefined);
      mockDb.transaction.mockImplementation(() => {
        const store = {
          getAll: vi.fn().mockResolvedValue(messages),
          index: vi.fn(() => ({ getAll: vi.fn().mockResolvedValue([]) })),
        };
        return { store, done: Promise.resolve(undefined) };
      });

      const result = await conversationMemoryStore.getContext('conv-1', 'small');

      // 4 turns = 8 messages
      expect(result.recentTurns).toHaveLength(8);
      expect(result.recentTurns[0].content).toBe('msg 1');
      expect(result.recentTurns[7].content).toBe('msg 8');
    });

    it('returns 6 recent turns for medium/large tier', async () => {
      const messages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) =>
        makeMessage('conv-1', n, n % 2 === 0 ? 'assistant' : 'user', `msg ${n}`),
      );
      mockDb.get.mockResolvedValue(undefined);
      mockDb.transaction.mockImplementation(() => {
        const store = {
          getAll: vi.fn().mockResolvedValue(messages),
          index: vi.fn(() => ({ getAll: vi.fn().mockResolvedValue([]) })),
        };
        return { store, done: Promise.resolve(undefined) };
      });

      const medium = await conversationMemoryStore.getContext('conv-1', 'medium');
      const large = await conversationMemoryStore.getContext('conv-1', 'large');

      // 6 turns = 12 messages
      expect(medium.recentTurns).toHaveLength(12);
      expect(large.recentTurns).toHaveLength(12);
    });

    it('includes summary when a summary exists for the conversation', async () => {
      const summary = makeSummary();
      mockDb.get.mockResolvedValue(summary);
      mockDb.transaction.mockImplementation(() => {
        const store = {
          getAll: vi.fn().mockResolvedValue([]),
          index: vi.fn(() => ({ getAll: vi.fn().mockResolvedValue([]) })),
        };
        return { store, done: Promise.resolve(undefined) };
      });

      const result = await conversationMemoryStore.getContext('conv-1', 'small');

      expect(result.summary).toBe('Existing summary text');
    });

    it('returns empty recentTurns and no summary on db error (graceful)', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const result = await conversationMemoryStore.getContext('conv-1', 'small');

      expect(result.recentTurns).toEqual([]);
      expect(result.summary).toBeUndefined();
    });

    it('excludes archived conversations from getContext', async () => {
      const archivedSummary = makeSummary({ state: 'archived' });
      mockDb.get.mockResolvedValue(archivedSummary);
      mockDb.transaction.mockImplementation(() => {
        const store = {
          getAll: vi.fn().mockResolvedValue([]),
          index: vi.fn(() => ({ getAll: vi.fn().mockResolvedValue([]) })),
        };
        return { store, done: Promise.resolve(undefined) };
      });

      const result = await conversationMemoryStore.getContext('conv-1', 'small');

      expect(result.recentTurns).toEqual([]);
      expect(result.summary).toBeUndefined();
    });
  });

  describe('summarize', () => {
    it('merges new messages into existing cumulative summary (rolling summary per D-19)', async () => {
      const existing = makeSummary({ summary: 'Previous summary' });
      mockDb.get.mockResolvedValue(existing);
      mockDb.put.mockResolvedValue(undefined);

      await conversationMemoryStore.summarize('conv-1', [
        { role: 'user', content: 'new msg' },
      ], 'New summary chunk');

      expect(mockDb.put).toHaveBeenCalledWith('memory_summaries', expect.objectContaining({
        conversationId: 'conv-1',
        summary: 'Previous summary\n---\nNew summary chunk',
        messageCount: 11,
      }));
    });

    it('creates a new summary when no existing summary exists', async () => {
      mockDb.get.mockResolvedValue(undefined);
      mockDb.put.mockResolvedValue(undefined);

      await conversationMemoryStore.summarize('conv-1', [
        { role: 'user', content: 'first msg' },
        { role: 'assistant', content: 'reply' },
      ], 'New summary');

      expect(mockDb.put).toHaveBeenCalledWith('memory_summaries', expect.objectContaining({
        conversationId: 'conv-1',
        summary: 'New summary',
        messageCount: 2,
        state: 'active',
      }));
    });

    it('sets state active and correct messageCount', async () => {
      mockDb.get.mockResolvedValue(undefined);
      mockDb.put.mockResolvedValue(undefined);

      await conversationMemoryStore.summarize('conv-1', [
        { role: 'user', content: 'hi' },
      ], 'Summary');

      expect(mockDb.put).toHaveBeenCalledWith('memory_summaries', expect.objectContaining({
        state: 'active',
        messageCount: 1,
      }));
    });
  });

  describe('archive', () => {
    it('sets state archived and archivedAt timestamp', async () => {
      const before = Date.now();
      const existing = makeSummary();
      mockDb.get.mockResolvedValue(existing);
      mockDb.put.mockResolvedValue(undefined);

      await conversationMemoryStore.archive('conv-1');

      expect(mockDb.put).toHaveBeenCalledWith('memory_summaries', expect.objectContaining({
        conversationId: 'conv-1',
        state: 'archived',
      }));
      const callArg = (mockDb.put as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callArg.archivedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getActiveCount / getArchivedCount', () => {
    it('getActiveCount returns count of active conversations', async () => {
      const summaries = [
        makeSummary({ conversationId: 'c1', state: 'active' }),
        makeSummary({ conversationId: 'c2', state: 'active' }),
        makeSummary({ conversationId: 'c3', state: 'archived' }),
      ];
      mockDb.getAll.mockResolvedValue(summaries);

      const count = await conversationMemoryStore.getActiveCount();

      expect(count).toBe(2);
    });

    it('getArchivedCount returns count of archived conversations', async () => {
      const summaries = [
        makeSummary({ conversationId: 'c1', state: 'active' }),
        makeSummary({ conversationId: 'c2', state: 'archived' }),
      ];
      mockDb.getAll.mockResolvedValue(summaries);

      const count = await conversationMemoryStore.getArchivedCount();

      expect(count).toBe(1);
    });
  });
});
