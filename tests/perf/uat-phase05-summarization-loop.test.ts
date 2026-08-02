import { describe, it, expect, vi } from 'vitest';
import { generateText } from 'ai';
import {
  ConversationMemoryStore,
  resetConversationMemoryDb,
} from '../../src/core/memory/ConversationMemoryStore';
import type { ProviderAdapter } from '../../src/core/ai/providers/ProviderAdapter';

vi.mock('ai', () => ({ generateText: vi.fn() }));

const llmResult = (text: string) => ({ text }) as unknown as Awaited<ReturnType<typeof generateText>>;

function makeAdapter(): { adapter: ProviderAdapter; requestedModels: string[] } {
  const requestedModels: string[] = [];
  const adapter = {
    providerId: 'openai',
    supportsStructuredOutput: true,
    getDefaultModelForTier: (tier: string) =>
      tier === 'FAST' ? 'haiku-test-model' : 'conversation-tier-model',
    createLanguageModel: (modelId: string) => {
      requestedModels.push(modelId);
      return {} as never;
    },
  } as unknown as ProviderAdapter;
  return { adapter, requestedModels };
}

const message = (n: number) => ({ role: 'user', content: `message ${n} content`, timestamp: 1_000_000_000_000 + n });

describe('UAT check: full summarization loop (simulated production call sequence)', () => {
  it('12 appends → shouldCompact=true → compactConversation stores ≤500-char summary, all messages preserved', async () => {
    await resetConversationMemoryDb();
    const store = new ConversationMemoryStore();
    const { adapter, requestedModels } = makeAdapter();
    (generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      llmResult('This is the automatically generated summary of the conversation.'),
    );

    let signal = false;
    for (let i = 1; i <= 12; i++) {
      const res = await store.appendMessage('conv-e2e', message(i));
      if (i === 12) signal = res.shouldCompact;
    }
    expect(signal).toBe(true);

    const result = await store.compactConversation('conv-e2e', adapter);
    expect(result.success).toBe(true);

    const summaries = await store.getSummaries('conv-e2e');
    expect(summaries).toHaveLength(1);
    expect(summaries[0].summary.length).toBeLessThanOrEqual(500);
    expect(requestedModels).toContain('haiku-test-model');

    const context = await store.getContext('conv-e2e', 'large');
    expect(context.recentMessages).toHaveLength(12);
    const bodies = context.recentMessages.map((m) => m.content);
    for (let i = 1; i <= 12; i++) {
      expect(bodies).toContain(`message ${i} content`);
    }
  }, 30000);
});
