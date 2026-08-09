// tests/core/storage/ChatHistoryDB.test.ts — STORAGE-01 ChatHistoryDB contract
// tests (§21.1 sessions + messages, §15.1). Uses the fake-indexeddb harness
// (RESEARCH Pattern 8): a fresh IDBFactory per test so the 'ChatHistoryDB'
// database starts empty every time. Cases:
//   1. putSession + putMessage round-trip (getSession / getMessagesForSession)
//   2. getMessagesForSession returns ONLY that session's messages, ordered by
//      timestamp (T-2-07-01 — the by-session + by-timestamp contract)
//   3. deleteSession removes the session AND its orphaned messages via the
//      by-session index iteration (T-2-07-03 — no body leaks after delete)
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { IDBPDatabase } from 'idb';
import {
  deleteSession,
  getMessagesForSession,
  getSession,
  listSessions,
  openChatHistoryDB,
  putMessage,
  putSession,
  type ChatHistoryDBSchema,
} from '@/core/storage/ChatHistoryDB';

function makeSession(id: string, title: string, created = 1, updated = 1): ChatHistoryDBSchema['sessions']['value'] {
  return { id, title, created, updated, starred: false, preview: '' };
}

function makeMessage(
  id: string,
  sessionId: string,
  content: string,
  timestamp: number,
  role: 'system' | 'user' | 'assistant' | 'tool' = 'user',
): ChatHistoryDBSchema['messages']['value'] {
  return { id, sessionId, role, content, timestamp };
}

describe('ChatHistoryDB — sessions + messages stores', () => {
  let db: IDBPDatabase<ChatHistoryDBSchema>;

  beforeEach(() => {
    // RESEARCH Pattern 8: fresh factory per test — documented fake-indexeddb reset.
    indexedDB = new IDBFactory();
  });

  afterEach(() => {
    db?.close();
  });

  it('round-trips putSession + putMessage through getSession and getMessagesForSession', async () => {
    db = await openChatHistoryDB();

    await putSession(db, makeSession('s1', 'First chat'));
    await putMessage(db, makeMessage('m1', 's1', 'hello world', 10));

    const session = await getSession(db, 's1');
    expect(session).toEqual(makeSession('s1', 'First chat'));

    const messages = await getMessagesForSession(db, 's1');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(makeMessage('m1', 's1', 'hello world', 10));
  });

  it('lists sessions in insertion order', async () => {
    db = await openChatHistoryDB();

    await putSession(db, makeSession('s1', 'First'));
    await putSession(db, makeSession('s2', 'Second'));

    const sessions = await listSessions(db);
    expect(sessions.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('getMessagesForSession returns only that session\u2019s messages ordered by timestamp', async () => {
    db = await openChatHistoryDB();

    // Two sessions interleave: s1 gets timestamps 30/10/20 (inserted out of
    // order), s2 gets its own messages — the by-session index must isolate.
    await putMessage(db, makeMessage('m1', 's1', 'third', 30));
    await putMessage(db, makeMessage('m2', 's2', 'other-1', 5));
    await putMessage(db, makeMessage('m3', 's1', 'first', 10));
    await putMessage(db, makeMessage('m4', 's2', 'other-2', 15));
    await putMessage(db, makeMessage('m5', 's1', 'second', 20));

    const messages = await getMessagesForSession(db, 's1');
    expect(messages.map((m) => m.id)).toEqual(['m3', 'm5', 'm1']);
    expect(messages.map((m) => m.timestamp)).toEqual([10, 20, 30]);
    expect(messages.every((m) => m.sessionId === 's1')).toBe(true);
  });

  it('deleteSession removes the session AND its orphaned messages via index iteration (T-2-07-03)', async () => {
    db = await openChatHistoryDB();

    await putSession(db, makeSession('s1', 'To delete'));
    await putSession(db, makeSession('s2', 'Kept'));
    await putMessage(db, makeMessage('m1', 's1', 'orphan-1', 1));
    await putMessage(db, makeMessage('m2', 's1', 'orphan-2', 2));
    await putMessage(db, makeMessage('m3', 's2', 'kept-msg', 3));

    await deleteSession(db, 's1');

    // Session row gone, sibling session untouched.
    expect(await getSession(db, 's1')).toBeUndefined();
    expect(await getSession(db, 's2')).toEqual(makeSession('s2', 'Kept'));

    // Orphaned messages gone; the sibling's messages survive.
    expect(await getMessagesForSession(db, 's1')).toEqual([]);
    const s2messages = await getMessagesForSession(db, 's2');
    expect(s2messages.map((m) => m.id)).toEqual(['m3']);
  });
});
