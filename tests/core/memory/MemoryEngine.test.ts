import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryAssembleResult, MemoryWriteRequest, UserMemoryFact } from '../../../src/core/memory/memoryTypes';
import type { ModelContextTier } from '../../../src/core/context/contextTypes';

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
      mockConversationStore,
      mockUserMemoryStore,
      mockPreferenceStore,
      mockScorer,
      mockExtractor,
      mockBroadcastBus,
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
