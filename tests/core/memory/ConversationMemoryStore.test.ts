import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConversationMemoryStore,
  resetConversationMemoryDb,
} from '../../../src/core/memory/ConversationMemoryStore';
import { resetUserMemoryDb } from '../../../src/core/memory/UserMemoryStore';
import { resetPreferenceMemoryDb } from '../../../src/core/memory/PreferenceMemoryStore';
import type { ConversationSummary } from '../../../src/core/memory/MemoryRecord';

async function resetMemoryDb(): Promise<void> {
  await Promise.all([resetConversationMemoryDb(), resetUserMemoryDb(), resetPreferenceMemoryDb()]);
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('NotesDB');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function message(seq: number) {
  return {
    role: 'user' as const,
    content: `msg-${seq}`,
    timestamp: 1_000_000_000_000 + seq,
  };
}

describe('ConversationMemoryStore', () => {
  let store: ConversationMemoryStore;

  beforeEach(async () => {
    await resetMemoryDb();
    store = new ConversationMemoryStore();
  });

  it('appendMessage increments the per-conversation message count (Test 1)', async () => {
    for (let i = 1; i <= 5; i++) {
      const result = await store.appendMessage('conv-1', message(i));
      expect(result.messageCount).toBe(i);
      expect(await store.getMessageCount('conv-1')).toBe(i);
    }
    // counts are scoped per conversation
    expect(await store.getMessageCount('conv-other')).toBe(0);
  });

  it('emits the compact signal at the 12-message boundary, and only there (Test 1 / D-10)', async () => {
    for (let i = 1; i <= 11; i++) {
      const result = await store.appendMessage('conv-1', message(i));
      expect(result.shouldCompact).toBe(false);
    }
    const at12 = await store.appendMessage('conv-1', message(12));
    expect(at12.shouldCompact).toBe(true);
    expect(at12.messageCount).toBe(12);

    const at13 = await store.appendMessage('conv-1', message(13));
    expect(at13.shouldCompact).toBe(false);
    expect(at13.messageCount).toBe(13);
  });

  it('getContext returns tier-gated recent message counts (tiny=4, small=8, medium/large=12) (Test 2)', async () => {
    for (let i = 1; i <= 15; i++) {
      await store.appendMessage('conv-1', message(i));
    }
    const tiny = await store.getContext('conv-1', 'tiny');
    expect(tiny.recentMessages).toHaveLength(4);
    expect(tiny.recentMessages[0].content).toBe('msg-12');
    expect(tiny.recentMessages[3].content).toBe('msg-15');

    const small = await store.getContext('conv-1', 'small');
    expect(small.recentMessages).toHaveLength(8);
    expect(small.recentMessages[0].content).toBe('msg-8');

    const medium = await store.getContext('conv-1', 'medium');
    expect(medium.recentMessages).toHaveLength(12);
    expect(medium.recentMessages[0].content).toBe('msg-4');

    const large = await store.getContext('conv-1', 'large');
    expect(large.recentMessages).toHaveLength(12);
  });

  it('getContext returns summary=null when no summary exists; [] when no messages', async () => {
    const empty = await store.getContext('conv-empty', 'tiny');
    expect(empty.summary).toBeNull();
    expect(empty.recentMessages).toEqual([]);
  });

  it('saveSummary + getContext round-trips the summary (Test 6)', async () => {
    const summary: ConversationSummary = {
      id: crypto.randomUUID(),
      conversationId: 'conv-1',
      summary: 'User decided X and set goal Y',
      messageRange: { start: 0, end: 11 },
      createdAt: 1_000_000_000_000,
    };
    await store.saveSummary(summary);
    const ctx = await store.getContext('conv-1', 'tiny');
    expect(ctx.summary).toEqual(summary);
    expect(await store.getSummaries('conv-1')).toEqual([summary]);
    // other conversations unaffected
    expect((await store.getContext('conv-2', 'tiny')).summary).toBeNull();
  });

  it('evictConversation removes all messages and summaries for the conversation (D-11)', async () => {
    for (let i = 1; i <= 5; i++) {
      await store.appendMessage('conv-1', message(i));
    }
    await store.saveSummary({
      id: crypto.randomUUID(),
      conversationId: 'conv-1',
      summary: 'to be evicted',
      messageRange: { start: 0, end: 4 },
      createdAt: 1_000_000_000_000,
    });
    await store.appendMessage('conv-2', message(1));

    await store.evictConversation('conv-1');
    expect(await store.getMessageCount('conv-1')).toBe(0);
    const ctx = await store.getContext('conv-1', 'tiny');
    expect(ctx.summary).toBeNull();
    expect(ctx.recentMessages).toEqual([]);

    // sibling conversation untouched
    expect(await store.getMessageCount('conv-2')).toBe(1);
  });
});
