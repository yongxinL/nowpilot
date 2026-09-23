import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDb, getDb, __test__ } from '../../../src/core/storage/NowPilotDB';
import {
  readAllConversations,
  readConversation,
  writeConversationWithMessages,
  type ChatSessionRecord,
  type MessageRecord,
  type WriteConversationResult,
} from '../../../src/core/storage/ChatHistoryDB';
import {
  createJournalEntry,
  runJournaled,
  type JournalEntryStore,
} from '../../../src/core/storage/WriteJournal';
import { __test__ as migratorTest } from '../../../src/core/storage/IndexedDBMigrator';
import { clearLogs } from '../../../src/core/log/debugLog';

/**
 * ChatHistoryDB suite — plan 02-02 Task 1 (the tracer).
 *
 * One real path end to end: open `np_db` → migrate → journaled write of a
 * conversation and its message into `sessions`/`messages` → authoritative
 * read-back → proof that the body exists **only** inside IndexedDB.
 *
 * The body is a synthetic sentinel, never a real value. Two properties of the
 * end-to-end case are asserted so the case cannot pass vacuously:
 *   - the assertion reads the records the repository returned from the store
 *     (and mutating the argument after the write cannot change them), and
 *   - the body-absence assertion over both `chrome.storage` maps is shown to be
 *     live by a case that plants the sentinel and expects it to be found.
 *
 * Every case resets the IndexedDB double with `__resetIndexedDB()` and closes
 * every handle it opened (RESEARCH Pitfall 8, D2-35).
 */

const BODY = 'synthetic-body-DO-NOT-LEAK-7f3a9c';

const localMap = () =>
  (globalThis as unknown as { __chromeStorageMap: Map<string, unknown> }).__chromeStorageMap;
const sessionMap = () =>
  (globalThis as unknown as { __chromeStorageSessionMap: Map<string, unknown> })
    .__chromeStorageSessionMap;

/** The same serialisation the phase's storage-absence assertions use. */
function serialiseStorage(map: Map<string, unknown>): string {
  return JSON.stringify([...map.entries()]);
}

/** A journal store backed by the `entries` object store of `np_db`. */
function createEntryStore(): JournalEntryStore {
  return {
    async load(id) {
      const db = await getDb();
      return db.get('entries', id);
    },
    async persist(entry) {
      const db = await getDb();
      await db.put('entries', entry);
    },
  };
}

function conversation(id: string, updated: number): ChatSessionRecord {
  return { id, title: `Conversation ${id}`, created: 1_700_000_000_000, updated, starred: false };
}

beforeEach(() => {
  (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
  localMap().clear();
  sessionMap().clear();
  clearLogs();
  __test__.reset();
  migratorTest.resetLastMigrationResult();
});

afterEach(() => {
  closeDb();
});

describe('ChatHistoryDB — journaled write, read-back and body absence', () => {
  it('writes one conversation through the journal into np_db and reads it back with no body in chrome.storage', async () => {
    const session = conversation('session-e2e', 1_700_000_000_500);
    const message: MessageRecord = {
      sessionId: session.id,
      seq: 1,
      id: 'message-e2e-1',
      role: 'user',
      content: BODY,
      timestamp: 1_700_000_000_100,
    };

    const store = createEntryStore();
    const created = await createJournalEntry(
      {
        id: `${session.id}:${message.seq}`,
        operation: 'append-memory-message',
        targetIds: { sessionId: session.id, seq: String(message.seq) },
      },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    let applied: WriteConversationResult | undefined;
    await runJournaled(
      created.entry,
      [
        {
          name: 'destination-written',
          apply: async () => {
            applied = await writeConversationWithMessages(session, [message]);
          },
          rollback: async () => undefined,
        },
      ],
      store.persist,
    );

    expect(applied?.ok).toBe(true);
    if (!applied?.ok) return;
    // The success branch carries what the repository read back from the store.
    expect(applied.messages[0]).not.toBe(message);

    // The journal entry itself is `completed`.
    const persistedEntry = await store.load(created.entry.id);
    expect(persistedEntry?.status).toBe('completed');

    // The authoritative read-back: conversation, ordering and body survive.
    const read = await readConversation(session.id);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.session).toEqual(session);
    expect(read.messages).toHaveLength(1);
    expect(read.messages[0].seq).toBe(1);
    expect(read.messages[0].content).toBe(BODY);

    // Mutating the argument after the write cannot change what is persisted —
    // the read is a store read, not a view of the argument.
    session.title = 'mutated-after-write';
    const reread = await readConversation(session.id);
    expect(reread.ok).toBe(true);
    if (!reread.ok) return;
    expect(reread.session.title).toBe('Conversation session-e2e');

    // The body exists only inside the sessions/messages stores.
    expect(serialiseStorage(localMap())).not.toContain(BODY);
    expect(serialiseStorage(sessionMap())).not.toContain(BODY);
    expect(JSON.stringify(persistedEntry)).not.toContain(BODY);
  });

  it('the body-absence assertion detects a body placed in either storage area', () => {
    // Non-vacuity: the assertion above must be able to fail.
    localMap().set('np_store', JSON.stringify({ state: { sessions: [{ messages: [{ content: BODY }] }] } }));
    expect(serialiseStorage(localMap())).toContain(BODY);
    localMap().delete('np_store');

    sessionMap().set('np_workspace_primary', JSON.stringify({ note: BODY }));
    expect(serialiseStorage(sessionMap())).toContain(BODY);
    sessionMap().delete('np_workspace_primary');
  });

  it('orders messages by the integer [sessionId, seq] key, never by string comparison', async () => {
    const session = conversation('session-order', 20);
    const messages: MessageRecord[] = [10, 2, 1].map((seq) => ({
      sessionId: session.id,
      seq,
      id: `message-${seq}`,
      role: 'user',
      content: `body-${seq}`,
      timestamp: seq,
    }));

    const result = await writeConversationWithMessages(session, messages);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A string sort would yield [1, 10, 2].
    expect(result.messages.map((entry) => entry.seq)).toEqual([1, 2, 10]);

    const read = await readConversation(session.id);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.messages.map((entry) => entry.seq)).toEqual([1, 2, 10]);
  });

  it('rejects an unknown field with a typed failure and persists nothing', async () => {
    const session = conversation('session-strict', 30);
    const dirty = {
      sessionId: session.id,
      seq: 1,
      id: 'message-dirty',
      role: 'user',
      content: 'body',
      timestamp: 1,
      injected: 'unknown-field',
    } as unknown as MessageRecord;

    const result = await writeConversationWithMessages(session, [dirty]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CHAT_HISTORY_INVALID_RECORD');

    const read = await readConversation(session.id);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.code).toBe('CHAT_HISTORY_NOT_FOUND');
  });

  it('reads every conversation newest-updated first through the by-updated index', async () => {
    const older = conversation('session-older', 100);
    const newer = conversation('session-newer', 200);

    expect((await writeConversationWithMessages(newer, [])).ok).toBe(true);
    expect((await writeConversationWithMessages(older, [])).ok).toBe(true);

    const all = await readAllConversations();
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.sessions.map((entry) => entry.id)).toEqual(['session-newer', 'session-older']);
  });
});
