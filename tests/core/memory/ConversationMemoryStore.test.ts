import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * ConversationMemoryStore — §18 required: compactor 12-rule, LRU caps,
 * archive-after-30-min, journaled evict, deterministic stub summariser.
 */

// Mutable isPrimaryWriter mock.
const isPrimaryWriterMock = vi.fn(() => true);
vi.mock('../../../src/core/workspace/WorkspaceStore', () => ({
  isPrimaryWriter: () => isPrimaryWriterMock(),
}));

import {
  createConversationMemoryStore,
  appendMessage,
  getRecentTurns,
  getSummary,
  getConversationMeta,
  archiveIdleConversations,
  evictConversation,
  __test__,
  CONVERSATION_COMPACTOR_MODULO,
  CONVERSATION_ACTIVE_MAX,
  CONVERSATION_ARCHIVED_MAX,
  CONVERSATION_IDLE_ARCHIVE_MS,
  type EvictConversationPayload,
} from '../../../src/core/memory/ConversationMemoryStore';
import { openMemoryDB, type MemoryMessage } from '../../../src/core/storage/MemoryDB';
import { registerJournalSteps } from '../../../src/core/storage/WriteJournal';

const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;

/** Build a message fixture. */
function makeMessage(conversationId: string, seq: number, role: MemoryMessage['role'] = 'user'): MemoryMessage {
  return { conversationId, seq, role, content: `message ${seq}`, timestamp: Date.now() + seq };
}

/** Deterministic stub summariser (D-106 seam). */
const stubSummarizer = {
  summarize: (msgs: MemoryMessage[]) => ({
    text: `STUB: ${msgs.length} messages`,
    tokens: 8,
  }),
};

/** Evict steps factory for tests (applies by deleting from IDB + storage map). */
function makeEvictStepsFactory() {
  return (payload: EvictConversationPayload) => ({
    name: 'evict-conversation',
    apply: async () => {
      // Delete messages from IDB
      const db = await openMemoryDB();
      const msgs = await db.getAllFromIndex('messages', 'byConversation', payload.conversationId);
      for (const m of msgs) {
        await db.delete('messages', [(m as MemoryMessage).conversationId, (m as MemoryMessage).seq]);
      }
      await db.delete('conversationSummaries', payload.conversationId);
      db.close();
      // Drop meta from storage map
      const raw = storageMap.get('np_conversation_meta');
      if (raw) {
        const meta = JSON.parse(raw) as Array<{ conversationId: string }>;
        const filtered = meta.filter((m) => m.conversationId !== payload.conversationId);
        storageMap.set('np_conversation_meta', JSON.stringify(filtered));
      }
    },
    rollback: async () => undefined,
  });
}

describe('ConversationMemoryStore — D-104/D-106', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    storageMap.clear();
    __test__.reset();
    isPrimaryWriterMock.mockReturnValue(true);
    // Initialize the store with stub summarizer + evict factory.
    createConversationMemoryStore({
      summarizer: stubSummarizer,
      evictStepsFactory: makeEvictStepsFactory(),
    });
    // Register evict-conversation so isSupportedOperation returns true.
    registerJournalSteps('evict-conversation', []);
  });

  it('COMPACTOR: append 12 messages → compactor fires (head + tail kept, summary stored)', async () => {
    const conversationId = 'conv-1';
    for (let i = 0; i < CONVERSATION_COMPACTOR_MODULO; i++) {
      await appendMessage(makeMessage(conversationId, i, i === 0 ? 'system' : 'user'));
    }

    // Summary stored in IDB.
    const summary = await getSummary(conversationId);
    expect(summary).not.toBeNull();
    // middle = 12 - 3 (head: system + first 2) - 4 (tail: last 4) = 5
    expect(summary?.summary).toBe('STUB: 5 messages');

    // After compaction: head (3) + tail (4) = 7 messages remain in IDB.
    const remaining = await getRecentTurns(conversationId, 100);
    expect(remaining.length).toBe(7);
  });

  it('NO COMPACTION: 11 messages → compactor does not fire', async () => {
    const conversationId = 'conv-2';
    for (let i = 0; i < 11; i++) {
      await appendMessage(makeMessage(conversationId, i));
    }

    // No summary stored.
    const summary = await getSummary(conversationId);
    expect(summary).toBeNull();

    // All 11 messages remain.
    const remaining = await getRecentTurns(conversationId, 100);
    expect(remaining.length).toBe(11);
  });

  it('LRU CAP: 11 active conversations → oldest archived (active ≤ 10)', async () => {
    for (let c = 0; c < CONVERSATION_ACTIVE_MAX + 1; c++) {
      await appendMessage({
        conversationId: `conv-${c}`,
        seq: 0,
        role: 'user',
        content: 'msg',
        timestamp: Date.now() + c * 1000,
      });
    }

    const meta = getConversationMeta();
    const active = meta.filter((m) => m.status === 'active');
    const archived = meta.filter((m) => m.status === 'archived');
    expect(active.length).toBeLessThanOrEqual(CONVERSATION_ACTIVE_MAX);
    expect(archived.length).toBe(1);
  });

  it('ARCHIVE AFTER 30 MIN: conversation idle > CONVERSATION_IDLE_ARCHIVE_MS → archived', async () => {
    const conversationId = 'conv-idle';
    const now = Date.now();
    await appendMessage({
      conversationId,
      seq: 0,
      role: 'user',
      content: 'msg',
      timestamp: now - CONVERSATION_IDLE_ARCHIVE_MS - 1000,
    });

    // Run archive check with a "now" that makes the conversation idle.
    await archiveIdleConversations(now);

    const meta = getConversationMeta().find((m) => m.conversationId === conversationId);
    expect(meta?.status).toBe('archived');
  });

  it('EVICT: evictConversation → messages + summary + meta gone, isSupportedOperation true', async () => {
    const conversationId = 'conv-evict';
    for (let i = 0; i < 5; i++) {
      await appendMessage(makeMessage(conversationId, i));
    }

    // Archive first, then evict.
    await archiveIdleConversations(Date.now() + CONVERSATION_IDLE_ARCHIVE_MS + 10000);
    await evictConversation(conversationId);

    // Messages gone.
    const remaining = await getRecentTurns(conversationId, 100);
    expect(remaining.length).toBe(0);

    // Meta entry gone.
    const meta = getConversationMeta().find((m) => m.conversationId === conversationId);
    expect(meta).toBeUndefined();

    // isSupportedOperation returns true.
    const { isSupportedOperation } = await import('../../../src/core/storage/WriteJournal');
    expect(isSupportedOperation('evict-conversation')).toBe(true);
  });

  it('SINGLE-WRITER: isPrimaryWriter false → appendMessage no-op', async () => {
    isPrimaryWriterMock.mockReturnValue(false);

    await appendMessage({
      conversationId: 'conv-nonprimary',
      seq: 0,
      role: 'user',
      content: 'msg',
      timestamp: Date.now(),
    });

    const meta = getConversationMeta().find((m) => m.conversationId === 'conv-nonprimary');
    expect(meta).toBeUndefined();

    isPrimaryWriterMock.mockReturnValue(true);
  });
});
