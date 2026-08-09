// tests/core/storage/MemoryDB.test.ts — STORAGE-01 MemoryDB contract tests
// (§21.3 composite-keyed messages + §21.4 facts, §15.1 userFacts +
// conversationSummaries). Uses the fake-indexeddb harness (RESEARCH Pattern 8):
// a fresh IDBFactory per test so the 'MemoryDB' database starts empty. Cases:
//   1. Composite keyPath [conversationId, seq] — two conversations interleave;
//      getMessagesForConversation returns ONLY the requested conversation,
//      ordered by seq (T-2-07-02: a cross-conversation leak would fail these
//      ordering assertions)
//   2. putFact/getFact/listFacts round-trip (§21.4 verbatim shape)
//   3. putConversationSummary/getConversationSummary round-trip
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { IDBPDatabase } from 'idb';
import {
  getConversationSummary,
  getFact,
  getMessagesForConversation,
  listFacts,
  openMemoryDB,
  putConversationSummary,
  putFact,
  putMemoryMessage,
  type Fact,
  type MemoryDBSchema,
  type MemoryMessage,
} from '@/core/storage/MemoryDB';

function makeMemoryMessage(
  conversationId: string,
  seq: number,
  content: string,
  role: 'system' | 'user' | 'assistant' | 'tool' = 'user',
): MemoryMessage {
  return { conversationId, seq, role, content, timestamp: seq * 10 };
}

function makeFact(id: string, content: string): Fact {
  return { id, content, confidence: 0.9, source: 'extracted', created: 42 };
}

describe('MemoryDB — composite-keyed messages + facts + summaries', () => {
  let db: IDBPDatabase<MemoryDBSchema>;

  beforeEach(() => {
    // RESEARCH Pattern 8: fresh factory per test — documented fake-indexeddb reset.
    indexedDB = new IDBFactory();
  });

  afterEach(() => {
    db?.close();
  });

  it('isolates conversations under the composite key [conversationId, seq] and orders by seq (T-2-07-02)', async () => {
    db = await openMemoryDB();

    // Two conversations interleave — the composite keyPath + by-conversation
    // index must keep them strictly separate.
    await putMemoryMessage(db, makeMemoryMessage('c1', 1, 'c1-first'));
    await putMemoryMessage(db, makeMemoryMessage('c2', 1, 'c2-first'));
    await putMemoryMessage(db, makeMemoryMessage('c1', 2, 'c1-second'));
    await putMemoryMessage(db, makeMemoryMessage('c2', 2, 'c2-second'));
    await putMemoryMessage(db, makeMemoryMessage('c1', 3, 'c1-third'));

    const c1 = await getMessagesForConversation(db, 'c1');
    expect(c1.map((m) => m.seq)).toEqual([1, 2, 3]);
    expect(c1.map((m) => m.content)).toEqual(['c1-first', 'c1-second', 'c1-third']);
    expect(c1.every((m) => m.conversationId === 'c1')).toBe(true);

    const c2 = await getMessagesForConversation(db, 'c2');
    expect(c2.map((m) => m.seq)).toEqual([1, 2]);
    expect(c2.map((m) => m.content)).toEqual(['c2-first', 'c2-second']);
    expect(c2.every((m) => m.conversationId === 'c2')).toBe(true);
  });

  it('round-trips putFact/getFact/listFacts with the §21.4 verbatim shape', async () => {
    db = await openMemoryDB();

    await putFact(db, makeFact('f1', 'user prefers concise answers'));
    await putFact(db, makeFact('f2', 'works on NowPilot'));

    expect(await getFact(db, 'f1')).toEqual(makeFact('f1', 'user prefers concise answers'));
    expect(await getFact(db, 'absent')).toBeUndefined();

    const all = await listFacts(db);
    expect(all.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    expect(all[0]).toMatchObject({ confidence: 0.9, source: 'extracted', created: 42 });
  });

  it('round-trips putConversationSummary/getConversationSummary keyed by conversationId', async () => {
    db = await openMemoryDB();

    await putConversationSummary(db, { conversationId: 'c1', summary: 'c1 summary', updatedAt: 7 });

    expect(await getConversationSummary(db, 'c1')).toEqual({
      conversationId: 'c1',
      summary: 'c1 summary',
      updatedAt: 7,
    });
    expect(await getConversationSummary(db, 'missing')).toBeUndefined();
  });
});
