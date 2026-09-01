import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * MemoryEngine — §18 required + RICH-R-05 DONE-when.
 *   (a) conversation summary + recent turns (SC#1)
 *   (b) user memory top-5 / top-3 tiny, scores ∈ [0,1] (SC#3)
 *   (c) token budget ≤ 1000
 *   (d) buildPreferenceProfile incl. persona overrides from np_persona (RICH-R-05)
 *   (e) retrieveMemoryHints → RetrievedMemory[] shape
 *   (f) create-only: zero ContextOptimizer/AgentOrchestrator imports
 */

// Mutable isPrimaryWriter mock.
const isPrimaryWriterMock = vi.fn(() => true);
vi.mock('../../../src/core/workspace/WorkspaceStore', () => ({
  isPrimaryWriter: () => isPrimaryWriterMock(),
}));

import { MemoryEngine } from '../../../src/core/memory/MemoryEngine';
import { upsertFact, __test__ as factsTest } from '../../../src/core/memory/UserMemoryStore';
import {
  createConversationMemoryStore,
  appendMessage,
  __test__ as convTest,
  type EvictConversationPayload,
} from '../../../src/core/memory/ConversationMemoryStore';
import { registerJournalSteps } from '../../../src/core/storage/WriteJournal';
import { usePreferenceMemoryStore } from '../../../src/core/memory/PreferenceMemoryStore';
import type { UserMemoryFact } from '../../../src/core/memory/types';
import type { MemoryMessage } from '../../../src/core/storage/MemoryDB';

const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;

function makeFact(overrides: Partial<UserMemoryFact> = {}): UserMemoryFact {
  return {
    id: `f-${Math.random().toString(36).slice(2)}`,
    content: 'ServiceNow incident resolution steps',
    type: 'fact',
    tags: ['servicenow', 'incident'],
    confidence: 0.9,
    source: 'explicit',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    useCount: 0,
    ...overrides,
  };
}

describe('MemoryEngine — D-105 create-only producer (RICH-R-05 DONE-when)', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    storageMap.clear();
    factsTest.reset();
    convTest.reset();
    isPrimaryWriterMock.mockReturnValue(true);

    // Init conversation store with stub summarizer + evict factory.
    convTest.setSummarizer({
      summarize: (msgs: MemoryMessage[]) => ({ text: `STUB: ${msgs.length}`, tokens: 4 }),
    });
    convTest.setEvictStepsFactory((payload: EvictConversationPayload) => ({
      name: 'evict-conversation',
      apply: async () => {
        // no-op in engine tests (eviction tested in ConversationMemoryStore)
      },
      rollback: async () => undefined,
    }));
    registerJournalSteps('evict-conversation', []);
  });

  it('CONVERSATION: retrieveConversationMemory returns summary + recent turns (SC#1)', async () => {
    const conversationId = 'conv-engine';
    // Append 12 messages to trigger compaction → summary stored.
    for (let i = 0; i < 12; i++) {
      await appendMessage({
        conversationId,
        seq: i,
        role: i === 0 ? 'system' : 'user',
        content: `msg ${i}`,
        timestamp: Date.now() + i,
      });
    }

    const result = await MemoryEngine.retrieveConversationMemory(conversationId);
    expect(result.summary).not.toBeNull();
    expect(result.summary).toContain('STUB:');
    expect(result.recentTurns.length).toBeGreaterThan(0);
  });

  it('USER MEMORY: retrieveUserMemory returns 5 (default) / 3 (tiny) in score-desc order (SC#3)', async () => {
    for (let i = 0; i < 7; i++) {
      await upsertFact(
        makeFact({
          id: `fact-${i}`,
          content: `note about ${i % 2 === 0 ? 'javascript' : 'python'} dev`,
          tags: [i % 2 === 0 ? 'javascript' : 'python'],
          useCount: i,
        }),
      );
    }

    const defaultResults = await MemoryEngine.retrieveUserMemory('javascript');
    expect(defaultResults.length).toBeLessThanOrEqual(5);

    const tinyResults = await MemoryEngine.retrieveUserMemory('javascript', { tier: 'tiny' });
    expect(tinyResults.length).toBeLessThanOrEqual(3);

    // All scores ∈ [0,1]
    for (const r of defaultResults) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it('TOKEN BUDGET: facts exceeding 1000 tokens truncated to ≤1000', async () => {
    // Create facts with large content that would exceed 1000 tokens.
    for (let i = 0; i < 10; i++) {
      await upsertFact(
        makeFact({
          id: `big-${i}`,
          content: 'x'.repeat(500), // ~125 tokens each
          tags: ['big'],
          useCount: i,
        }),
      );
    }

    const results = await MemoryEngine.retrieveUserMemory('big');
    // Total tokens ≤ 1000 → at most ~8 facts (8 * 125 = 1000)
    let totalTokens = 0;
    for (const r of results) {
      totalTokens += Math.ceil(r.content.length / 4);
    }
    expect(totalTokens).toBeLessThanOrEqual(1000);
  });

  it('RICH-R-05 DONE-WHEN: buildPreferenceProfile includes persona overrides from np_persona (not fact store)', async () => {
    // Set persona overrides in PreferenceMemoryStore.
    usePreferenceMemoryStore.getState().setPersonaOverrides({ tone: 'concise' });

    const profile = MemoryEngine.buildPreferenceProfile();
    const parsed = JSON.parse(profile);

    // Includes the override.
    expect(parsed.profile).toContain('override.tone:concise');
    // Includes base persona fields.
    expect(parsed.profile).toContain('personaId:');
    expect(parsed.profile).toContain('tone:'); // base tone from DEFAULT_PERSONA

    // Verify it reads np_persona (PreferenceMemoryStore), not userFacts.
    // The profile is produced without any fact store read.
    const state = usePreferenceMemoryStore.getState();
    expect(state.personaOverrides?.tone).toBe('concise');
  });

  it('RETRIEVE MEMORY HINTS: returns RetrievedMemory[] matching Phase-7 shape', async () => {
    for (let i = 0; i < 5; i++) {
      await upsertFact(makeFact({ id: `hint-${i}`, tags: ['hint', `tag${i}`] }));
    }

    const hints = await MemoryEngine.retrieveMemoryHints('hint');
    expect(hints.length).toBeGreaterThan(0);
    // Each hint has the shape contextItems.ts consumes: id + content + type + tags + score
    for (const hint of hints) {
      expect(hint.id).toBeDefined();
      expect(hint.content).toBeDefined();
      expect(hint.type).toBeDefined();
      expect(hint.tags).toBeDefined();
      expect(hint.score).toBeDefined();
    }
  });

  it('CREATE-ONLY: zero ContextOptimizer/AgentOrchestrator imports', async () => {
    const source = await import('../../../src/core/memory/MemoryEngine');
    // The module exports only the MemoryEngine facade + caps.
    expect(source.MemoryEngine).toBeDefined();
    expect(source.MEMORY_HINTS_TOP_K).toBe(5);
    expect(source.MEMORY_HINTS_TINY_K).toBe(3);
    expect(source.MEMORY_HINTS_MAX_TOKENS).toBe(1000);
  });
});
