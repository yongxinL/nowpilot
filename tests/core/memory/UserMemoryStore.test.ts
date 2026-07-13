import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub IDBKeyRange for jsdom (used by MemoryDB.getMessages)
vi.hoisted(() => {
  globalThis.IDBKeyRange = {
    bound: vi.fn((lower, upper) => ({ lower, upper })),
  } as unknown as typeof IDBKeyRange;
});

const { mockGetDB, mockDb, mockMiniSearchIndex, mockMemoryScorer, mockResolve } =
  vi.hoisted(() => {
    const mockDbInstance = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(0),
      clear: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn(() => ({
        store: {
          getAll: vi.fn().mockResolvedValue([]),
          index: vi.fn(() => ({ getAll: vi.fn().mockResolvedValue([]) })),
        },
        done: Promise.resolve(undefined),
      })),
    };

    const mockGetDB = vi.fn().mockResolvedValue(mockDbInstance);

    const mockMiniSearchIndex = {
      search: vi.fn().mockReturnValue([]),
      addFact: vi.fn(),
      replaceFact: vi.fn(),
      removeFact: vi.fn(),
      rebuild: vi.fn(),
    };

    const mockMemoryScorer = {
      score: vi.fn().mockReturnValue(0),
      tieBreak: vi.fn().mockImplementation((results) => results),
    };

    const mockResolve = vi.fn().mockReturnValue([]);

    return {
      mockGetDB,
      mockDb: mockDbInstance,
      mockMiniSearchIndex,
      mockMemoryScorer,
      mockResolve,
    };
  });

vi.mock('../../../src/core/storage/IndexedDBManager', () => ({
  getDB: mockGetDB,
}));

vi.mock('../../../src/core/search/MiniSearchIndex', () => ({
  miniSearchIndex: mockMiniSearchIndex,
}));

vi.mock('../../../src/core/memory/MemoryScorer', () => ({
  memoryScorer: mockMemoryScorer,
}));

vi.mock('../../../src/core/memory/conflictResolver', () => ({
  resolve: mockResolve,
}));

import { userMemoryStore } from '../../../src/core/memory/UserMemoryStore';

function makeFact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fact-1',
    fact: 'User likes TypeScript',
    category: 'preference',
    confidence: 0.85,
    created: 1000,
    updated: 1000,
    source: 'chat',
    status: 'active' as const,
    tags: ['typescript', 'programming'],
    useCount: 5,
    lastUsedAt: 1000,
    ...overrides,
  };
}

// Reset constructor-side effects (rebuildIndex call) before each test
beforeEach(async () => {
  vi.clearAllMocks();
  // Re-create module-level singleton by re-importing won't work with Vi, so
  // we ensure the mock for rebuildIndex's underlying deps are reset cleanly:
  mockDb.getAll.mockResolvedValue([]);
  mockMiniSearchIndex.rebuild.mockClear();
});

describe('UserMemoryStore', () => {
  describe('search', () => {
    it('returns top-5 scored facts with keywordScore and finalScore', async () => {
      const facts = [
        makeFact({ id: 'f1', fact: 'User likes TypeScript', confidence: 0.9 }),
        makeFact({ id: 'f2', fact: 'User knows JavaScript', confidence: 0.7 }),
        makeFact({ id: 'f3', fact: 'User uses React', confidence: 0.8 }),
        makeFact({ id: 'f4', fact: 'User prefers VSCode', confidence: 0.6 }),
        makeFact({ id: 'f5', fact: 'User likes Python', confidence: 0.85 }),
        makeFact({ id: 'f6', fact: 'User writes CSS', confidence: 0.5 }),
      ];

      mockMiniSearchIndex.search.mockReturnValue(
        facts.map((f) => ({
          id: f.id,
          content: f.fact,
          score: 0.5,
          category: f.category,
          confidence: f.confidence,
          useCount: f.useCount,
          updatedAt: f.updated,
          status: f.status,
        })),
      );

      mockMemoryScorer.score.mockImplementation(
        (candidate: { fact: typeof facts[0]; keywordScore: number }) =>
          candidate.keywordScore * 0.45 + candidate.fact.confidence * 0.05,
      );

      mockMemoryScorer.tieBreak.mockImplementation(
        (results: Array<{ fact: typeof facts[0]; finalScore: number }>) =>
          results.sort((a, b) => b.finalScore - a.finalScore || a.fact.id.localeCompare(b.fact.id)),
      );

      const result = await userMemoryStore.search('typescript', 'small');

      expect(result).toHaveLength(5);
      for (const item of result) {
        expect(item).toHaveProperty('fact');
        expect(item).toHaveProperty('keywordScore');
        expect(item).toHaveProperty('finalScore');
      }
    });

    it('tiny tier returns at most 3 facts, others return at most 5', async () => {
      const facts = Array.from({ length: 8 }, (_, i) =>
        makeFact({ id: `f${i}`, fact: `Fact ${i}`, confidence: 0.5 }),
      );

      mockMiniSearchIndex.search.mockReturnValue(
        facts.map((f) => ({
          id: f.id,
          content: f.fact,
          score: 0.5,
          category: f.category,
          status: f.status,
        })),
      );

      mockMemoryScorer.score.mockReturnValue(0.5);
      mockMemoryScorer.tieBreak.mockImplementation((r) => r);

      const tinyResult = await userMemoryStore.search('fact', 'tiny');
      const smallResult = await userMemoryStore.search('fact', 'small');

      expect(tinyResult).toHaveLength(3);
      expect(smallResult).toHaveLength(5);
    });

    it('search excludes superseded facts', async () => {
      // Search returns mixed active/superseded; implementation must filter
      const mockResults = [
        { id: 'f1', content: 'Active fact', score: 0.9, status: 'active', category: 'pref' },
        { id: 'f2', content: 'Superseded fact', score: 0.8, status: 'superseded', category: 'pref' },
        { id: 'f3', content: 'Another active', score: 0.7, status: 'active', category: 'skill' },
      ];
      mockMiniSearchIndex.search.mockReturnValue(mockResults);
      mockMemoryScorer.score.mockReturnValue(0.5);
      mockMemoryScorer.tieBreak.mockImplementation((r) => r);

      const result = await userMemoryStore.search('fact', 'small');

      expect(result.every((r: { fact: { status: string } }) => r.fact.status === 'active')).toBe(
        true,
      );
    });

    it('returns empty array when no active facts exist', async () => {
      mockMiniSearchIndex.search.mockReturnValue([]);

      const result = await userMemoryStore.search('nothing', 'small');

      expect(result).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('adds a new fact to MemoryDB and MiniSearch index', async () => {
      const newFact = makeFact({ id: 'fact-new' });
      mockDb.getAll.mockResolvedValue([]);
      mockResolve.mockReturnValue([{ fact: newFact, status: 'active' }]);

      await userMemoryStore.upsert(newFact);

      expect(mockDb.put).toHaveBeenCalledWith('memory_userFacts', newFact);
      expect(mockMiniSearchIndex.replaceFact).toHaveBeenCalledWith(newFact);
    });

    it('calls conflictResolver for existing facts and marks old as superseded', async () => {
      const existingFact = makeFact({
        id: 'old-fact',
        fact: 'User likes Java',
        status: 'active',
        confidence: 0.5,
      });
      const newFact = makeFact({
        id: 'new-fact',
        fact: 'User likes TypeScript',
        status: 'active',
        confidence: 0.9,
      });
      const supersededResult = { fact: existingFact, status: 'superseded' };
      const activeResult = { fact: newFact, status: 'active' };

      mockDb.getAll.mockResolvedValue([existingFact]);
      mockResolve.mockReturnValue([supersededResult, activeResult]);
      mockMiniSearchIndex.replaceFact.mockClear();

      await userMemoryStore.upsert(newFact);

      expect(mockResolve).toHaveBeenCalled();
      expect(mockDb.put).toHaveBeenCalledTimes(2);
      expect(mockMiniSearchIndex.replaceFact).toHaveBeenCalledTimes(2);
    });

    it('validates fact against userMemoryFactSchema', async () => {
      const invalidFact = { id: 'bad', unknownField: 'should be stripped' };
      // @ts-expect-error testing runtime validation
      await expect(userMemoryStore.upsert(invalidFact)).rejects.toThrow();
    });
  });

  describe('rebuildIndex', () => {
    it('rebuilds MiniSearch with all active facts from MemoryDB', async () => {
      const activeFacts = [
        makeFact({ id: 'f1', status: 'active' }),
        makeFact({ id: 'f2', status: 'active' }),
      ];
      const supersededFact = makeFact({ id: 'f3', status: 'superseded' });
      mockDb.getAll.mockResolvedValue([...activeFacts, supersededFact]);

      await userMemoryStore.rebuildIndex();

      expect(mockDb.getAll).toHaveBeenCalledWith('memory_userFacts');
      expect(mockMiniSearchIndex.rebuild).toHaveBeenCalledWith(activeFacts);
    });
  });

  describe('getFact', () => {
    it('returns a single fact by ID', async () => {
      const facts = [makeFact({ id: 'f1' }), makeFact({ id: 'f2' })];
      mockDb.getAll.mockResolvedValue(facts);

      const result = await userMemoryStore.getFact('f1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('f1');
    });

    it('returns undefined for non-existent ID', async () => {
      mockDb.getAll.mockResolvedValue([]);

      const result = await userMemoryStore.getFact('nonexistent');

      expect(result).toBeUndefined();
    });
  });
});
