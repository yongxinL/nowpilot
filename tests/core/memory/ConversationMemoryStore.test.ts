// tests/core/memory/ConversationMemoryStore.test.ts — D-05-03 KNW-04 (required
// by §18): per-conversation rolling summary + tiered recent turns over the
// MemoryDB substrate, the 12-message compactor with the injectable summarise
// seam, and the §15.3 LRU (10 active / 100 archived, 30-min idle archive,
// 'evict-conversation' WriteJournal op). Uses the fake-indexeddb harness
// (RESEARCH Pattern 8 — fresh IDBFactory per test, NotesDB.test.ts L10-14/
// 49-59) + fake chrome.storage (wxt fakeBrowser) so meta round-trips go
// through the REAL Setting layer (Pitfall 4 pin — np_conversation_meta is
// registered area:'local' in Setting.ts). Cases:
//   1. Per-tier turn counts: 8 seeded messages → getRecentTurns keeps the last
//      2 (tiny) / 4 (small) / 6 (medium|large) turns; system rows absent from
//      lastMessages; summary + summaryTokens + updatedAt attached.
//   2. Compactor trigger: messageCount 13 (13 % 12 = 1) → NOT triggered;
//      messageCount 24 → summary persisted ('[N messages compacted]' with
//      N = middle length) and the head/tail rule holds (system + first 2 +
//      last 4 retained as raw rows in MemoryDB, messageCount unchanged).
//   3. Custom summarise seam: opts.summarise returns a fixed string → the
//      conversationSummaries row carries exactly that string.
//   4. appendTurn round-trip: seq increments, meta.messageCount/lastAccessed
//      update, and a turn on an archived conversation reactivates it.
//   5. LRU archive: lastAccessed older than 30 min idle → archived; >10 active
//      → oldest archived; >100 archived → oldest evicted + a WriteJournal
//      entry with operation 'evict-conversation' (loadPendingEntries).
//   6. Setting round-trip (Pitfall 4 pin): meta written via settingWrite is
//      readable back through settingRead with status/messageCount intact.
//   7. Write-never-throws: appendTurn against a CLOSED db resolves (GR-9).
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { IDBPDatabase } from 'idb';
import {
  ACTIVE_CONVERSATION_LIMIT,
  ARCHIVED_CONVERSATION_LIMIT,
  appendTurn,
  archiveIdleConversations,
  enforceLimits,
  getRecentTurns,
  NP_CONVERSATION_META_KEY,
  summariseIfNeeded,
} from '@/core/memory/ConversationMemoryStore';
import {
  openMemoryDB,
  putConversationSummary,
  putMemoryMessage,
  getConversationSummary,
  getMessagesForConversation,
  type MemoryDBSchema,
  type MemoryMessage,
} from '@/core/storage/MemoryDB';
import { settingRead, settingWrite } from '@/core/storage/Setting';
import { loadPendingEntries } from '@/core/storage/WriteJournal';
import { estimateTokens } from '@/core/context/TokenBudget';
import type { ConversationMeta } from '@/core/memory/types';

// WR-05: whole-module mock of MemoryDB (importOriginal spread — real exports
// preserved, RendererService.test.ts L50-53 pattern). A vi.spyOn on the ESM
// namespace cannot replace the live binding appendTurn imports, so the
// getMessagesForConversation seam lives here: the factory defaults to the REAL
// function, and the WR-05 test swaps in a once-rejecting wrapper to exercise
// the seq fallback. The source module's `import * as MemoryDBModule` style is
// what this mirrors — the mock replaces the module for the whole file, so the
// real default keeps every other test byte-identical.
const { memoryDbGetMessagesMock } = vi.hoisted(() => ({
  memoryDbGetMessagesMock: {
    impl: null as
      | null
      | ((db: IDBPDatabase<MemoryDBSchema>, conversationId: string) => Promise<MemoryMessage[]>),
    real: null as
      | null
      | ((db: IDBPDatabase<MemoryDBSchema>, conversationId: string) => Promise<MemoryMessage[]>),
  },
}));

vi.mock('@/core/storage/MemoryDB', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/storage/MemoryDB')>();
  memoryDbGetMessagesMock.real = actual.getMessagesForConversation;
  return {
    ...actual,
    getMessagesForConversation: (async (
      db: IDBPDatabase<MemoryDBSchema>,
      conversationId: string,
    ) => {
      if (memoryDbGetMessagesMock.impl !== null) {
        return memoryDbGetMessagesMock.impl(db, conversationId) as Promise<MemoryMessage[]>;
      }
      return actual.getMessagesForConversation(db, conversationId);
    }) as typeof actual.getMessagesForConversation,
  };
});

const NOW_MS = 1_752_000_000_000; // fixed literal — deterministic

function seedMeta(record: Record<string, ConversationMeta>): Promise<void> {
  return settingWrite(NP_CONVERSATION_META_KEY, record);
}

function metaFor(
  conversationId: string,
  overrides: Partial<ConversationMeta> = {},
): ConversationMeta {
  return {
    conversationId,
    status: 'active',
    messageCount: 0,
    lastAccessed: NOW_MS,
    updatedAt: NOW_MS,
    ...overrides,
  };
}

/** Seed N turns (optional leading system row) into MemoryDB with ascending seqs. */
async function seedMessages(
  db: IDBPDatabase<MemoryDBSchema>,
  conversationId: string,
  turnCount: number,
  opts: { system?: boolean; startSeq?: number } = {},
): Promise<void> {
  let seq = opts.startSeq ?? 0;
  if (opts.system === true) {
    await putMemoryMessage(db, {
      conversationId,
      seq: seq++,
      role: 'system',
      content: 'system prompt',
      timestamp: NOW_MS + seq,
    });
  }
  for (let i = 1; i <= turnCount; i++) {
    await putMemoryMessage(db, {
      conversationId,
      seq: seq++,
      role: i % 2 === 1 ? 'user' : 'assistant',
      content: `turn-${i}`,
      timestamp: NOW_MS + seq,
    });
  }
}

describe('ConversationMemoryStore — per-tier recent turns (§3.3)', () => {
  let db: IDBPDatabase<MemoryDBSchema>;

  beforeEach(() => {
    indexedDB = new IDBFactory(); // RESEARCH Pattern 8: fresh IndexedDB per test
  });

  afterEach(() => {
    db?.close();
  });

  it('keeps the last 2/4/6 turns per tier and filters system rows from lastMessages', async () => {
    db = await openMemoryDB();
    await seedMessages(db, 'c1', 7, { system: true }); // 1 system + 7 turns = 8 messages
    await putConversationSummary(db, {
      conversationId: 'c1',
      summary: 'rolling summary',
      updatedAt: 500,
    });
    await seedMeta({ c1: metaFor('c1', { messageCount: 8, lastAccessed: NOW_MS + 8 }) });

    const tiny = await getRecentTurns(db, 'c1', 'tiny');
    expect(tiny.lastMessages).toHaveLength(2);
    const small = await getRecentTurns(db, 'c1', 'small');
    expect(small.lastMessages).toHaveLength(4);
    const medium = await getRecentTurns(db, 'c1', 'medium');
    expect(medium.lastMessages).toHaveLength(6);
    const large = await getRecentTurns(db, 'c1', 'large');
    expect(large.lastMessages).toHaveLength(6);

    // system rows are never part of lastMessages (§3.3 role union)
    for (const m of large.lastMessages) {
      expect(['user', 'assistant', 'tool']).toContain(m.role);
    }
    // the retained turns are the LAST 6 of the 7 turns (turn-2..turn-7)
    expect(large.lastMessages.map((m) => m.content)).toEqual([
      'turn-2',
      'turn-3',
      'turn-4',
      'turn-5',
      'turn-6',
      'turn-7',
    ]);
    expect(large.lastMessages.map((m) => m.tokens)).toEqual(
      large.lastMessages.map((m) => estimateTokens(m.content)),
    );

    // summary attaches from conversationSummaries + updatedAt = max(meta, last message)
    expect(tiny.summary).toBe('rolling summary');
    expect(tiny.summaryTokens).toBe(estimateTokens('rolling summary'));
    expect(large.summary).toBe('rolling summary');
    expect(large.updatedAt).toBe(NOW_MS + 8); // meta.updatedAt wins over last message ts
  });

  it('falls back to np_conversation_meta.summary when no summary row exists', async () => {
    db = await openMemoryDB();
    await seedMessages(db, 'c2', 3);
    await seedMeta({ c2: metaFor('c2', { messageCount: 3, summary: 'meta summary' }) });

    const memory = await getRecentTurns(db, 'c2', 'tiny');
    expect(memory.summary).toBe('meta summary');
    expect(memory.summaryTokens).toBe(estimateTokens('meta summary'));
  });

  it('returns an empty ConversationMemory for a conversation with no rows (never crashes)', async () => {
    db = await openMemoryDB();
    const memory = await getRecentTurns(db, 'missing', 'medium');
    expect(memory.lastMessages).toEqual([]);
    expect(memory.summary).toBe('');
    expect(memory.summaryTokens).toBe(0);
  });
});

describe('ConversationMemoryStore — 12-message compactor (§3.3/§15.3)', () => {
  let db: IDBPDatabase<MemoryDBSchema>;

  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  afterEach(() => {
    db?.close();
  });

  it('does NOT trigger at messageCount 13 (13 % 12 = 1)', async () => {
    db = await openMemoryDB();
    await seedMessages(db, 'c1', 13);
    await seedMeta({ c1: metaFor('c1', { messageCount: 13 }) });

    await summariseIfNeeded(db, 'c1');

    expect(await getConversationSummary(db, 'c1')).toBeUndefined();
    const meta = await settingRead(NP_CONVERSATION_META_KEY, (v) => v, undefined);
    expect((meta as Record<string, ConversationMeta>).c1?.summary).toBeUndefined();
  });

  it('triggers at messageCount 24: persists the structural summary + head/tail rule', async () => {
    db = await openMemoryDB();
    await seedMessages(db, 'c1', 23, { system: true }); // 1 system + 23 turns = 24 messages
    await seedMeta({ c1: metaFor('c1', { messageCount: 24 }) });

    await summariseIfNeeded(db, 'c1');

    // middle = turns.slice(2, -4) of 23 turns = 17 messages
    const summaryRow = await getConversationSummary(db, 'c1');
    expect(summaryRow?.summary).toBe('[17 messages compacted]');
    const meta = await settingRead(NP_CONVERSATION_META_KEY, (v) => v, undefined);
    const metaEntry = (meta as Record<string, ConversationMeta>).c1;
    expect(metaEntry?.summary).toBe('[17 messages compacted]');
    expect(metaEntry?.messageCount).toBe(24); // messageCount unchanged

    // head/tail rule: system + first 2 + last 4 retained as raw rows in MemoryDB
    const rows = await getMessagesForConversation(db, 'c1');
    expect(rows).toHaveLength(24);
    expect(rows[0].role).toBe('system');
    expect(rows[1].content).toBe('turn-1');
    expect(rows[2].content).toBe('turn-2');
    expect(rows[20].content).toBe('turn-20');
    expect(rows[21].content).toBe('turn-21');
    expect(rows[22].content).toBe('turn-22');
    expect(rows[23].content).toBe('turn-23');
  });

  it('routes the middle through the injectable summarise seam', async () => {
    db = await openMemoryDB();
    await seedMessages(db, 'c1', 24);
    await seedMeta({ c1: metaFor('c1', { messageCount: 24 }) });

    let seamInput: readonly MemoryMessage[] | undefined;
    await summariseIfNeeded(db, 'c1', {
      summarise: async (middle) => {
        seamInput = middle;
        return 'CUSTOM SUMMARY';
      },
    });

    expect(seamInput).toHaveLength(18); // 24 turns - 2 head - 4 tail
    const summaryRow = await getConversationSummary(db, 'c1');
    expect(summaryRow?.summary).toBe('CUSTOM SUMMARY');
  });
});

describe('ConversationMemoryStore — appendTurn round-trip', () => {
  let db: IDBPDatabase<MemoryDBSchema>;

  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  afterEach(() => {
    db?.close();
  });

  it('appends sequenced turns and updates np_conversation_meta', async () => {
    db = await openMemoryDB();
    await appendTurn(db, { conversationId: 'c1', role: 'user', content: 'hello', timestamp: 1000 });
    await appendTurn(db, {
      conversationId: 'c1',
      role: 'assistant',
      content: 'hi there',
      timestamp: 2000,
    });

    const memory = await getRecentTurns(db, 'c1', 'tiny');
    expect(memory.lastMessages).toEqual([
      { role: 'user', content: 'hello', tokens: estimateTokens('hello'), timestamp: 1000 },
      {
        role: 'assistant',
        content: 'hi there',
        tokens: estimateTokens('hi there'),
        timestamp: 2000,
      },
    ]);
    const meta = await settingRead(NP_CONVERSATION_META_KEY, (v) => v, undefined);
    expect((meta as Record<string, ConversationMeta>).c1).toMatchObject({
      status: 'active',
      messageCount: 2,
      lastAccessed: 2000,
      updatedAt: 2000,
    });
  });

  it('reactivates an archived conversation on a fresh turn', async () => {
    db = await openMemoryDB();
    await seedMeta({ c1: metaFor('c1', { status: 'archived', messageCount: 5 }) });

    await appendTurn(db, { conversationId: 'c1', role: 'user', content: 'new', timestamp: 3000 });

    const meta = await settingRead(NP_CONVERSATION_META_KEY, (v) => v, undefined);
    expect((meta as Record<string, ConversationMeta>).c1?.status).toBe('active');
    expect((meta as Record<string, ConversationMeta>).c1?.messageCount).toBe(6);
  });

  it('WR-05: a failed index read must not overwrite the seq-1 message', async () => {
    db = await openMemoryDB();
    // Seed one turn normally → seq 1, meta.messageCount 1.
    await appendTurn(db, { conversationId: 'c1', role: 'user', content: 'hello', timestamp: 1000 });

    // Force the NEXT index read to fail — the store's catch converts the
    // rejection to [] (getMessagesForConversation swallows into []), exercising
    // the WR-05 seq fallback. The wrapper rejects once (mirroring the idb
    // failure INSIDE the real read, which the real function's own catch would
    // swallow to []), then delegates back to the real read so the post-condition
    // assertions read the true rows.
    const real = memoryDbGetMessagesMock.real!;
    let failed = false;
    memoryDbGetMessagesMock.impl = async (d, conversationId) => {
      if (!failed) {
        failed = true;
        try {
          await real(d, conversationId);
        } catch {
          // fall through — the real function's STORE_READ catch swallows the
          // rejection to [] (GR-9); the WR-05 fallback path is what's under test
        }
        return [];
      }
      return real(d, conversationId);
    };

    try {
      await appendTurn(db, {
        conversationId: 'c1',
        role: 'assistant',
        content: 'second turn',
        timestamp: 2000,
      });
    } finally {
      memoryDbGetMessagesMock.impl = null;
    }

    // BOTH rows must exist: seq 1 'hello' (byte-intact — never overwritten by a
    // reused composite key) and seq 2 'second turn'; meta.messageCount === 2.
    const rows = await getMessagesForConversation(db, 'c1');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ seq: 1, content: 'hello', role: 'user' });
    expect(rows[1]).toMatchObject({ seq: 2, content: 'second turn', role: 'assistant' });
    const meta = await settingRead(NP_CONVERSATION_META_KEY, (v) => v, undefined);
    expect((meta as Record<string, ConversationMeta>).c1?.messageCount).toBe(2);
  });
});

describe('ConversationMemoryStore — §15.3 LRU archive/evict', () => {
  let db: IDBPDatabase<MemoryDBSchema>;

  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  afterEach(() => {
    db?.close();
  });

  it('archives an active conversation idle longer than 30 min', async () => {
    db = await openMemoryDB();
    const nowMs = NOW_MS;
    await seedMeta({
      stale: metaFor('stale', { lastAccessed: nowMs - 31 * 60_000 }),
      fresh: metaFor('fresh', { lastAccessed: nowMs - 60_000 }),
    });

    await archiveIdleConversations(db, nowMs);

    const meta = await settingRead(NP_CONVERSATION_META_KEY, (v) => v, undefined);
    const record = meta as Record<string, ConversationMeta>;
    expect(record.stale?.status).toBe('archived');
    expect(record.fresh?.status).toBe('active');
  });

  it('archives the OLDEST active conversation when > 10 active', async () => {
    db = await openMemoryDB();
    const record: Record<string, ConversationMeta> = {};
    for (let i = 0; i < ACTIVE_CONVERSATION_LIMIT + 1; i++) {
      record[`conv-${i}`] = metaFor(`conv-${i}`, { lastAccessed: NOW_MS + i });
    }
    await seedMeta(record);

    await enforceLimits(db);

    const meta = await settingRead(NP_CONVERSATION_META_KEY, (v) => v, undefined);
    const after = meta as Record<string, ConversationMeta>;
    expect(after['conv-0']?.status).toBe('archived'); // oldest by lastAccessed
    expect(after['conv-10']?.status).toBe('active');
    expect(Object.values(after).filter((m) => m.status === 'active')).toHaveLength(
      ACTIVE_CONVERSATION_LIMIT,
    );
  });

  it('evicts the OLDEST archived conversation above 100 and journals the evict-conversation op', async () => {
    db = await openMemoryDB();
    const record: Record<string, ConversationMeta> = {};
    for (let i = 0; i < ARCHIVED_CONVERSATION_LIMIT + 1; i++) {
      record[`conv-${i}`] = metaFor(`conv-${i}`, { status: 'archived', lastAccessed: NOW_MS + i });
    }
    await seedMeta(record);

    await enforceLimits(db);

    // the oldest archived entry (conv-0) is removed from the meta record
    const meta = await settingRead(NP_CONVERSATION_META_KEY, (v) => v, undefined);
    const after = meta as Record<string, ConversationMeta>;
    expect(after['conv-0']).toBeUndefined();
    expect(after['conv-100']).not.toBeUndefined();
    expect(Object.keys(after)).toHaveLength(ARCHIVED_CONVERSATION_LIMIT);

    // the eviction is journaled via WriteJournal operation 'evict-conversation'
    const entries = await loadPendingEntries();
    expect(
      entries.some(
        (e) => e.operation === 'evict-conversation' && e.targetIds.conversationId === 'conv-0',
      ),
    ).toBe(true);
  });
});

describe('ConversationMemoryStore — Setting round-trip + write-never-throws', () => {
  let db: IDBPDatabase<MemoryDBSchema>;

  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  afterEach(() => {
    db?.close();
  });

  it('round-trips np_conversation_meta through settingWrite/settingRead (Pitfall 4 pin)', async () => {
    const meta = metaFor('c1', { status: 'archived', messageCount: 7, lastAccessed: 123 });
    await settingWrite(NP_CONVERSATION_META_KEY, { c1: meta });

    const back = await settingRead(NP_CONVERSATION_META_KEY, (v) => v, undefined);
    expect(back).toEqual({ c1: meta }); // fails if the key were unregistered (→ undefined)
  });

  it('appendTurn against a CLOSED db resolves instead of rejecting (GR-9)', async () => {
    db = await openMemoryDB();
    db.close();

    await expect(
      appendTurn(db, { conversationId: 'c1', role: 'user', content: 'hi', timestamp: 1 }),
    ).resolves.toBeUndefined();
  });
});
