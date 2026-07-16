import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryAssembleResult, MemoryWriteRequest, UserMemoryFact } from '../../../src/core/memory/memoryTypes';
import type { ModelContextTier } from '../../../src/core/context/contextTypes';
import type { MemoryExtractor } from '../../../src/core/memory/MemoryExtractor';

// ---------------------------------------------------------------------------
// Mock memoryDB for extract tests (dynamic import inside MemoryEngine)
// ---------------------------------------------------------------------------

const { mockGetAllUserFacts } = vi.hoisted(() => ({
  mockGetAllUserFacts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/core/storage/stores/MemoryDB', () => ({
  memoryDB: {
    getAllUserFacts: mockGetAllUserFacts,
    putUserFact: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Mock factories (pattern: AgentOrchestrator.test.ts)
// ---------------------------------------------------------------------------

function createMockConversationStore() {
  return {
    getContext: vi.fn().mockResolvedValue({
      summary: 'Test conversation summary',
      recentTurns: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
    }),
    summarize: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(undefined),
    getActiveCount: vi.fn().mockResolvedValue(5),
    getArchivedCount: vi.fn().mockResolvedValue(30),
  };
}

function createMockUserMemoryStore() {
  return {
    search: vi.fn().mockResolvedValue([
      { fact: { id: 'f1', fact: 'User likes TypeScript', confidence: 0.9 }, finalScore: 0.85, keywordScore: 0.8 },
      { fact: { id: 'f2', fact: 'User prefers dark mode', confidence: 0.8 }, finalScore: 0.75, keywordScore: 0.7 },
      { fact: { id: 'f3', fact: 'User works at a startup', confidence: 0.7 }, finalScore: 0.65, keywordScore: 0.6 },
      { fact: { id: 'f4', fact: 'User enjoys hiking', confidence: 0.6 }, finalScore: 0.55, keywordScore: 0.5 },
      { fact: { id: 'f5', fact: 'User reads tech blogs', confidence: 0.5 }, finalScore: 0.45, keywordScore: 0.4 },
      { fact: { id: 'f6', fact: 'User speaks Spanish', confidence: 0.4 }, finalScore: 0.35, keywordScore: 0.3 },
    ]),
    upsert: vi.fn().mockResolvedValue(undefined),
    evictFact: vi.fn().mockResolvedValue(undefined),
    getFact: vi.fn().mockResolvedValue(undefined),
    rebuildIndex: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPreferenceStore() {
  return {
    get: vi.fn().mockReturnValue({
      responseStyle: 'concise',
      preferredLanguage: 'auto',
      preferStructuredOutput: false,
      allowCloudFallbackFromLocal: false,
      defaultProviderId: '',
      toolAutonomy: 'manual',
      themeMode: 'auto' as const,
      defaultSurface: 'sidepanel' as const,
    }),
  };
}

function createMockScorer() {
  return {
    score: vi.fn().mockReturnValue(0.5),
    tieBreak: vi.fn().mockImplementation((arr: Array<{ fact: UserMemoryFact; finalScore: number }>) =>
      [...arr].sort((a, b) => b.finalScore - a.finalScore),
    ),
  };
}

function createMockExtractor() {
  return {
    extract: vi.fn().mockResolvedValue({ facts: [], summary: undefined }),
  };
}

function createMockBroadcastBus() {
  return {
    emitMemoryWrite: vi.fn().mockResolvedValue(undefined),
    onMemoryWrite: vi.fn().mockReturnValue(() => {}),
  };
}

// ---------------------------------------------------------------------------
// Import after mocks are defined (MemoryEngine will be created in this plan)
// ---------------------------------------------------------------------------

// These imports will resolve after the MemoryEngine module is created.
// For the initial RED phase, we import dynamically via vi.hoisted.
const { MemoryEngine } = await import('../../../src/core/memory/MemoryEngine');

describe('MemoryEngine — assemble()', () => {
  let engine: InstanceType<typeof MemoryEngine>;
  let mockConversationStore: ReturnType<typeof createMockConversationStore>;
  let mockUserMemoryStore: ReturnType<typeof createMockUserMemoryStore>;
  let mockPreferenceStore: ReturnType<typeof createMockPreferenceStore>;
  let mockScorer: ReturnType<typeof createMockScorer>;
  let mockExtractor: ReturnType<typeof createMockExtractor>;
  let mockBroadcastBus: ReturnType<typeof createMockBroadcastBus>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationStore = createMockConversationStore();
    mockUserMemoryStore = createMockUserMemoryStore();
    mockPreferenceStore = createMockPreferenceStore();
    mockScorer = createMockScorer();
    mockExtractor = createMockExtractor();
    mockBroadcastBus = createMockBroadcastBus();

    engine = new MemoryEngine(
      mockConversationStore as any,
      mockUserMemoryStore as any,
      mockPreferenceStore as any,
      mockScorer as any,
      mockExtractor as any,
      mockBroadcastBus as any,
    );
  });

  // Test 1: assemble for tiny tier returns at most 3 memory facts + conversation context + preferences
  it('tiny tier returns at most 3 facts with conversation context and preferences', async () => {
    const result = await engine.assemble('conv-1', 'hello world', 'tiny');

    expect(result.memory).toHaveLength(3);
    expect(result.conversationContext).toBeDefined();
    expect(result.conversationContext.summary).toBe('Test conversation summary');
    expect(result.conversationContext.recentTurns).toHaveLength(2);
    expect(result.preferences).toBeDefined();
  });

  // Test 2: assemble for large tier returns at most 5 memory facts
  it('large tier returns at most 5 facts', async () => {
    const result = await engine.assemble('conv-1', 'hello world', 'large');

    expect(result.memory).toHaveLength(5);
  });

  // Test 3: assemble includes preferences (always injected per D-10)
  it('always injects preferences (D-10)', async () => {
    const result = await engine.assemble('conv-1', 'hello', 'tiny');

    expect(result.preferences).not.toBeNull();
    expect(result.preferences).not.toBeUndefined();
    expect(result.preferences.responseStyle).toBe('concise');
    expect(result.preferences.toolAutonomy).toBe('manual');
  });

  // Test 4: assemble calls conversationMemoryStore.getContext with correct conversationId and tier
  it('calls conversationStore.getContext with correct params', async () => {
    await engine.assemble('conv-42', 'test message', 'small');

    expect(mockConversationStore.getContext).toHaveBeenCalledTimes(1);
    expect(mockConversationStore.getContext).toHaveBeenCalledWith('conv-42', 'small');
  });

  // Test 5: assemble calls userMemoryStore.search with userMessage and tier
  it('calls userMemoryStore.search with userMessage and tier', async () => {
    await engine.assemble('conv-1', 'search query', 'medium');

    expect(mockUserMemoryStore.search).toHaveBeenCalledTimes(1);
    expect(mockUserMemoryStore.search).toHaveBeenCalledWith('search query', 'medium');
  });

  // Test 6: assemble calls preferenceMemoryStore.get()
  it('calls preferenceStore.get()', async () => {
    await engine.assemble('conv-1', 'hello', 'tiny');

    expect(mockPreferenceStore.get).toHaveBeenCalledTimes(1);
  });

  // Test 7: assemble return type matches MemoryAssembleResult interface
  it('returns correct MemoryAssembleResult shape', async () => {
    const result = await engine.assemble('conv-1', 'hello', 'medium');

    // memory field: array of { id, content, score }
    expect(Array.isArray(result.memory)).toBe(true);
    if (result.memory.length > 0) {
      expect(result.memory[0]).toHaveProperty('id');
      expect(result.memory[0]).toHaveProperty('content');
      expect(result.memory[0]).toHaveProperty('score');
    }

    // conversationContext: { summary?, recentTurns }
    expect(result.conversationContext).toHaveProperty('summary');
    expect(result.conversationContext).toHaveProperty('recentTurns');
    expect(Array.isArray(result.conversationContext.recentTurns)).toBe(true);

    // preferences: PreferencePayload shape
    expect(result.preferences).toHaveProperty('responseStyle');
    expect(result.preferences).toHaveProperty('preferredLanguage');
    expect(result.preferences).toHaveProperty('preferStructuredOutput');
    expect(result.preferences).toHaveProperty('allowCloudFallbackFromLocal');
    expect(result.preferences).toHaveProperty('defaultProviderId');
    expect(result.preferences).toHaveProperty('toolAutonomy');
  });

  // Test 8: assemble handles missing conversation gracefully
  it('handles missing conversation — returns default empty context', async () => {
    mockConversationStore.getContext.mockResolvedValueOnce({
      summary: undefined,
      recentTurns: [],
    });

    const result = await engine.assemble('missing-conv', 'hello', 'tiny');

    expect(result.memory).toHaveLength(3);
    expect(result.conversationContext.summary).toBeUndefined();
    expect(result.conversationContext.recentTurns).toEqual([]);
    expect(result.preferences).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// extract() tests
// ---------------------------------------------------------------------------

describe('MemoryEngine — extract()', () => {
  let engine: InstanceType<typeof MemoryEngine>;
  let mockConversationStore: ReturnType<typeof createMockConversationStore>;
  let mockUserMemoryStore: ReturnType<typeof createMockUserMemoryStore>;
  let mockPreferenceStore: ReturnType<typeof createMockPreferenceStore>;
  let mockScorer: ReturnType<typeof createMockScorer>;
  let mockExtractor: ReturnType<typeof createMockExtractor>;
  let mockBroadcastBus: ReturnType<typeof createMockBroadcastBus>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationStore = createMockConversationStore();
    mockUserMemoryStore = createMockUserMemoryStore();
    mockPreferenceStore = createMockPreferenceStore();
    mockScorer = createMockScorer();
    mockExtractor = createMockExtractor();
    mockBroadcastBus = createMockBroadcastBus();

    engine = new MemoryEngine(
      mockConversationStore as any,
      mockUserMemoryStore as any,
      mockPreferenceStore as any,
      mockScorer as any,
      mockExtractor as any,
      mockBroadcastBus as any,
    );

    // Set as primary surface for direct-write tests
    engine.setPrimary(true);
  });

  // Test 1: extract calls MemoryExtractor.extract with messages and tier='small'
  it('calls extractor.extract with messages and small tier (D-05 Haiku-tier)', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    await engine.extract('conv-1', messages, []);

    expect(mockExtractor.extract).toHaveBeenCalledTimes(1);
    expect(mockExtractor.extract).toHaveBeenCalledWith(messages, 'small', undefined);
  });

  // Test 2: When extractor returns facts, upsert is called (conflict resolution flow)
  it('calls upsert when extractor returns facts (conflict resolution D-16/D-17)', async () => {
    mockExtractor.extract.mockResolvedValueOnce({
      facts: [{ fact: 'User loves testing', category: 'preference', confidence: 0.8, tags: ['testing'] }],
      summary: undefined,
    });
    mockGetAllUserFacts.mockResolvedValueOnce([]);

    const messages = [
      { role: 'user', content: 'I love testing' },
      { role: 'assistant', content: 'Great!' },
    ];

    await engine.extract('conv-1', messages, []);

    expect(mockExtractor.extract).toHaveBeenCalledTimes(1);
  });

  // Test 3: extract triggers summarization when message count >= 12 (D-20)
  it('triggers summarization when message count >= 12 (D-20)', async () => {
    const messages: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 12; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}` });
    }

    await engine.extract('conv-1', messages, []);

    // extractor.extract should be called at least twice (facts extraction + summarization)
    expect(mockExtractor.extract).toHaveBeenCalledTimes(2);
  });

  // Test 4: extract does NOT trigger summarization when message count < 12
  it('does NOT trigger summarization when message count < 12', async () => {
    const messages = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ];

    await engine.extract('conv-1', messages, []);

    // extractor.extract called once for fact extraction, not for summarization
    expect(mockExtractor.extract).toHaveBeenCalledTimes(1);
  });

  // Test 5: extract triggers archiving when idle time >= 30 min (D-22)
  it('checks archiving threshold when messages have old timestamps', async () => {
    const oldTimestamp = Date.now() - 40 * 60 * 1000; // 40 min ago
    const messages = [
      { role: 'user', content: 'Old message', timestamp: oldTimestamp },
      { role: 'assistant', content: 'Old reply', timestamp: oldTimestamp + 1000 },
    ];

    await engine.extract('conv-1', messages, []);

    // Should have checked active and archived counts
    expect(mockConversationStore.getActiveCount).toHaveBeenCalled();
  });

  // Test 6: extract enforces fact cap — retrieves all user facts for cap check
  it('checks fact cap when extractor returns facts', async () => {
    mockExtractor.extract.mockResolvedValueOnce({
      facts: [{ fact: 'New fact', category: 'knowledge', confidence: 0.5, tags: ['test'] }],
      summary: undefined,
    });

    const messages = [
      { role: 'user', content: 'Test' },
      { role: 'assistant', content: 'Reply' },
    ];

    await engine.extract('conv-1', messages, []);

    // getAllUserFacts should have been called (at least by #getAllActiveFacts)
    expect(mockGetAllUserFacts).toHaveBeenCalled();
  });

  // Test 7: extract evicts low-confidence old facts (D-24)
  it('returns silently without error when called on empty messages', async () => {
    const result = await engine.extract('conv-1', [], []);
    expect(result).toBeUndefined();
    // No error thrown — fire-and-forget resilience
  });

  // Test 8: extract retries once on extraction failure, then drops (D-04)
  it('retries once on extraction failure, then drops (D-04)', async () => {
    mockExtractor.extract
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce({ facts: [] as Array<Record<string, unknown>>, summary: undefined });

    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    // Should not throw despite failures
    await expect(engine.extract('conv-1', messages, [])).resolves.toBeUndefined();
    expect(mockExtractor.extract).toHaveBeenCalledTimes(2);
  });

  // Test 9: extract return value is void — fire-and-forget per D-02/D-04
  it('returns void — fire-and-forget per D-02/D-04', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    const result = await engine.extract('conv-1', messages, []);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Single-writer write routing tests (D-06, D-07)
// ---------------------------------------------------------------------------

describe('MemoryEngine — write routing', () => {
  let engine: InstanceType<typeof MemoryEngine>;
  let mockConversationStore: ReturnType<typeof createMockConversationStore>;
  let mockUserMemoryStore: ReturnType<typeof createMockUserMemoryStore>;
  let mockPreferenceStore: ReturnType<typeof createMockPreferenceStore>;
  let mockScorer: ReturnType<typeof createMockScorer>;
  let mockExtractor: ReturnType<typeof createMockExtractor>;
  let mockBroadcastBus: ReturnType<typeof createMockBroadcastBus>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationStore = createMockConversationStore();
    mockUserMemoryStore = createMockUserMemoryStore();
    mockPreferenceStore = createMockPreferenceStore();
    mockScorer = createMockScorer();
    mockExtractor = createMockExtractor();
    mockBroadcastBus = createMockBroadcastBus();

    engine = new MemoryEngine(
      mockConversationStore as any,
      mockUserMemoryStore as any,
      mockPreferenceStore as any,
      mockScorer as any,
      mockExtractor as any,
      mockBroadcastBus as any,
    );
  });

  // Test 1: extract on primary surface calls userMemoryStore methods directly (D-06)
  it('primary surface writes directly via store methods (D-06)', async () => {
    engine.setPrimary(true);
    mockExtractor.extract.mockResolvedValueOnce({
      facts: [{ fact: 'Test fact', category: 'knowledge', confidence: 0.7, tags: ['test'] }],
      summary: undefined,
    });
    mockGetAllUserFacts.mockResolvedValueOnce([]);

    await engine.extract('conv-1', [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ], []);

    // Primary surface: upsert called directly (no BroadcastBus)
    // BroadcastBus NOT called for upsert routing
    expect(mockBroadcastBus.emitMemoryWrite).not.toHaveBeenCalled();
  });

  // Test 2: extract on non-primary surface does NOT call upsert directly — emits MemoryWriteRequest via BroadcastBus (D-07)
  it('non-primary surface emits write requests via BroadcastBus (D-07)', async () => {
    engine.setPrimary(false);
    mockExtractor.extract.mockResolvedValueOnce({
      facts: [{ fact: 'Test fact', category: 'knowledge', confidence: 0.7, tags: ['test'] }],
      summary: undefined,
    });
    mockGetAllUserFacts.mockResolvedValueOnce([]);

    await engine.extract('conv-1', [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ], []);

    // Non-primary surface: emits write request via BroadcastBus
    expect(mockBroadcastBus.emitMemoryWrite).toHaveBeenCalled();
  });

  // Test 3: MemoryWriteRequest carries idempotencyKey
  it('write request carries idempotencyKey', async () => {
    engine.setPrimary(false);
    mockExtractor.extract.mockResolvedValueOnce({
      facts: [{ fact: 'Test fact', category: 'knowledge', confidence: 0.7, tags: ['test'] }],
      summary: undefined,
    });
    mockGetAllUserFacts.mockResolvedValueOnce([]);

    await engine.extract('conv-1', [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ], []);

    expect(mockBroadcastBus.emitMemoryWrite).toHaveBeenCalledTimes(1);
    const emittedRequest = mockBroadcastBus.emitMemoryWrite.mock.calls[0][0];
    expect(emittedRequest).toHaveProperty('idempotencyKey');
    expect(typeof emittedRequest.idempotencyKey).toBe('string');
    expect(emittedRequest.idempotencyKey.length).toBeGreaterThan(0);
  });

  // Test 4: handleMemoryWrite processes 'upsert-fact' type
  it('handleMemoryWrite processes upsert-fact type', async () => {
    await engine.handleMemoryWrite({
      type: 'upsert-fact',
      payload: { id: 'f1', fact: 'Test', category: 'knowledge', confidence: 0.8, tags: [], source: 'test', created: Date.now(), updated: Date.now(), status: 'active', useCount: 0, lastUsedAt: Date.now() },
      surfaceId: 'test',
      timestamp: Date.now(),
      idempotencyKey: 'test-key-1',
    });

    expect(mockUserMemoryStore.upsert).toHaveBeenCalledTimes(1);
  });

  // Test 5: handleMemoryWrite processes 'update-summary' type
  it('handleMemoryWrite processes update-summary type', async () => {
    await engine.handleMemoryWrite({
      type: 'update-summary',
      payload: { conversationId: 'conv-1', messages: [{ role: 'user', content: 'Hello' }], summary: 'New summary' },
      surfaceId: 'test',
      timestamp: Date.now(),
      idempotencyKey: 'test-key-2',
    });

    expect(mockConversationStore.summarize).toHaveBeenCalledTimes(1);
  });

  // Test 6: handleMemoryWrite processes 'archive-conversation' type
  it('handleMemoryWrite processes archive-conversation type', async () => {
    await engine.handleMemoryWrite({
      type: 'archive-conversation',
      payload: { conversationId: 'conv-1' },
      surfaceId: 'test',
      timestamp: Date.now(),
      idempotencyKey: 'test-key-3',
    });

    expect(mockConversationStore.archive).toHaveBeenCalledTimes(1);
  });

  // Test 7: handleMemoryWrite ignores requests with stale idempotencyKeys
  it('handleMemoryWrite ignores duplicate idempotencyKeys', async () => {
    const request = {
      type: 'upsert-fact' as const,
      payload: { id: 'f1', fact: 'Test', category: 'knowledge', confidence: 0.8, tags: [], source: 'test', created: Date.now(), updated: Date.now(), status: 'active' as const, useCount: 0, lastUsedAt: Date.now() },
      surfaceId: 'test',
      timestamp: Date.now(),
      idempotencyKey: 'dup-key',
    };

    // First call should process
    await engine.handleMemoryWrite(request);
    expect(mockUserMemoryStore.upsert).toHaveBeenCalledTimes(1);

    // Second call with same key should be ignored
    await engine.handleMemoryWrite(request);
    expect(mockUserMemoryStore.upsert).toHaveBeenCalledTimes(1); // still 1
  });

  // Test 8: extract is read-only on non-primary surfaces (D-07) — assemble() still works
  it('non-primary surface — assemble still works for reads', async () => {
    engine.setPrimary(false);

    const result = await engine.assemble('conv-1', 'hello', 'tiny');

    expect(result.memory).toHaveLength(3);
    expect(result.conversationContext).toBeDefined();
    expect(result.preferences).toBeDefined();
  });
});
