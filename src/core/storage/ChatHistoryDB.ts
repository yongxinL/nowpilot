import { z } from 'zod';
import { getDb, NowPilotDbOpenError } from './NowPilotDB';
import { debugLog } from '../log/debugLog';

/**
 * ChatHistoryDB — the authoritative repository for persisted conversations and
 * message bodies (D2-17/D2-21), over the shared `np_db` handle.
 *
 * **Message bodies live only here.** They never enter `chrome.storage.local`,
 * the WriteJournal, the ErrorStore or a log line (D2-08/D2-11/D2-21). The
 * end-to-end suite proves the absence by serialising both storage areas.
 *
 * **Write discipline (RESEARCH Pitfall 3, D2-20).** Every record is validated
 * *before* a transaction opens; an `await` on anything that is not an `idb`
 * request inside a `readwrite` transaction auto-commits it and the next request
 * throws `InvalidStateError`. A conversation and its messages commit in **one**
 * `readwrite` transaction, and no success is reported before an authoritative
 * `readonly` read-back matches what was written (D2-10 step 7).
 *
 * **Ordering.** Messages are ordered by the composite integer key
 * `['sessionId', 'seq']` — never by string comparison — and timestamps and
 * counters are integer milliseconds (D2-25).
 *
 * **Boundary validation.** Every record read out of the database is re-validated
 * by the strict schema below, so a malformed or tampered record is a typed
 * failure rather than silently accepted data. A malformed record is identified
 * by its safe id only — never by its content (D2-13). The conversation-list
 * read applies D2-20's partial-failure policy: a malformed record is excluded
 * and reported in `invalidIds` (safe id only) while the remaining conversations
 * still hydrate; a database-level failure stays the typed whole-read failure.
 *
 * **`preview` is deliberately absent.** The prototype derived
 * `sessions[].preview` from message content (`msg.content.slice(0, 50)`), which
 * makes it a body excerpt; it has no canonical home and must not survive in
 * `chrome.storage.local` (RESEARCH Pitfall 7). `title` is metadata and belongs
 * to `np_conversation_meta` (a later plan in this phase).
 */

/** A conversation record. `updated` is the numeric index key (`by-updated`). */
export interface ChatSessionRecord {
  id: string;
  title: string;
  created: number;
  updated: number;
  starred: boolean;
}

/** A message record. The store key is the composite `['sessionId', 'seq']`. */
export interface MessageRecord {
  sessionId: string;
  seq: number;
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** The message body — this field never leaves the `messages` store. */
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export const chatSessionRecordSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    starred: z.boolean(),
  })
  .strict();

export const messageRecordSchema = z
  .object({
    sessionId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    id: z.string().min(1),
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string(),
    timestamp: z.number().int().nonnegative(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type ChatHistoryFailureCode =
  | 'CHAT_HISTORY_INVALID_RECORD'
  | 'CHAT_HISTORY_UNAVAILABLE'
  | 'CHAT_HISTORY_NOT_FOUND'
  | 'CHAT_HISTORY_WRITE_FAILED'
  | 'CHAT_HISTORY_READ_FAILED'
  | 'CHAT_HISTORY_READ_BACK_MISMATCH';

export type WriteConversationResult =
  | { ok: true; session: ChatSessionRecord; messages: MessageRecord[] }
  | { ok: false; code: ChatHistoryFailureCode };

export type ReadConversationResult =
  | { ok: true; session: ChatSessionRecord; messages: MessageRecord[] }
  | { ok: false; code: ChatHistoryFailureCode };

/**
 * The conversation-list read. A malformed record never enters `sessions` and is
 * never silently dropped: it is excluded and identified by safe id only in
 * `invalidIds` (D2-20's partial-failure policy), so the remaining conversations
 * still hydrate.
 */
export type ReadAllConversationsResult =
  | { ok: true; sessions: ChatSessionRecord[]; invalidIds: string[] }
  | { ok: false; code: ChatHistoryFailureCode };

const INVALID_RECORD_CODE: ChatHistoryFailureCode = 'CHAT_HISTORY_INVALID_RECORD';

/**
 * The redacted reason string for a caught error. IndexedDB rejects with a
 * `DOMException`, which is not `instanceof Error` in every environment, so the
 * name is read structurally — never the message, which can carry a body.
 */
function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return typeof error;
}

function unavailableCode(error: unknown): ChatHistoryFailureCode {
  return error instanceof NowPilotDbOpenError ? 'CHAT_HISTORY_UNAVAILABLE' : 'CHAT_HISTORY_READ_FAILED';
}

/** Integer sequence order — never a string comparison (D2-25). */
function bySequence(a: MessageRecord, b: MessageRecord): number {
  return a.seq - b.seq;
}

function sameSession(a: ChatSessionRecord, b: ChatSessionRecord): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.created === b.created &&
    a.updated === b.updated &&
    a.starred === b.starred
  );
}

/** In-memory comparison of the read-back against what was written (D2-10 step 7). */
function readBackMatches(
  expectedSession: ChatSessionRecord,
  expectedMessages: readonly MessageRecord[],
  actualSession: ChatSessionRecord,
  actualMessages: readonly MessageRecord[],
): boolean {
  if (!sameSession(expectedSession, actualSession)) return false;
  if (actualMessages.length !== expectedMessages.length) return false;

  for (let index = 0; index < expectedMessages.length; index += 1) {
    const expected = expectedMessages[index];
    const actual = actualMessages[index];
    if (
      actual.seq !== expected.seq ||
      actual.id !== expected.id ||
      actual.sessionId !== expected.sessionId ||
      actual.role !== expected.role ||
      actual.content !== expected.content ||
      actual.timestamp !== expected.timestamp
    ) {
      return false;
    }
  }

  return true;
}

/** Validate one record read out of the database. Never logs record content. */
function validateReadRecord<T>(
  candidate: unknown,
  schema: z.ZodType<T>,
  kind: 'session' | 'message',
): { ok: true; value: T } | { ok: false; code: ChatHistoryFailureCode } {
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    debugLog(INVALID_RECORD_CODE, 'ChatHistoryDB record failed schema validation on read', {
      kind,
      issueCount: parsed.error.issues.length,
    });
    return { ok: false, code: INVALID_RECORD_CODE };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Write one conversation and its messages inside a single `readwrite`
 * transaction, then read both back and only report success when the read-back
 * matches.
 *
 * Validation and ordering happen **before** the transaction opens; every
 * request after that is an `idb` request or `tx.done`.
 */
export async function writeConversationWithMessages(
  session: ChatSessionRecord,
  messages: readonly MessageRecord[],
): Promise<WriteConversationResult> {
  const parsedSession = chatSessionRecordSchema.safeParse(session);
  if (!parsedSession.success) {
    debugLog(INVALID_RECORD_CODE, 'ChatHistoryDB rejected an invalid session record', {
      kind: 'session',
      issueCount: parsedSession.error.issues.length,
    });
    return { ok: false, code: INVALID_RECORD_CODE };
  }

  const validated: MessageRecord[] = [];
  for (const message of messages) {
    const parsed = messageRecordSchema.safeParse(message);
    if (!parsed.success) {
      debugLog(INVALID_RECORD_CODE, 'ChatHistoryDB rejected an invalid message record', {
        kind: 'message',
        issueCount: parsed.error.issues.length,
      });
      return { ok: false, code: INVALID_RECORD_CODE };
    }
    if (parsed.data.sessionId !== parsedSession.data.id) {
      debugLog(INVALID_RECORD_CODE, 'ChatHistoryDB rejected a message from another conversation', {
        kind: 'message',
      });
      return { ok: false, code: INVALID_RECORD_CODE };
    }
    validated.push(parsed.data);
  }

  if (new Set(validated.map((message) => message.seq)).size !== validated.length) {
    debugLog(INVALID_RECORD_CODE, 'ChatHistoryDB rejected duplicate message sequence numbers', {
      kind: 'message',
    });
    return { ok: false, code: INVALID_RECORD_CODE };
  }

  const ordered = [...validated].sort(bySequence);

  let db;
  try {
    db = await getDb();
  } catch (error) {
    return { ok: false, code: unavailableCode(error) };
  }

  try {
    const tx = db.transaction(['sessions', 'messages'], 'readwrite');
    await tx.objectStore('sessions').put(parsedSession.data);
    for (const message of ordered) {
      await tx.objectStore('messages').put(message);
    }
    await tx.done;
  } catch (error) {
    debugLog('CHAT_HISTORY_WRITE_FAILED', 'ChatHistoryDB conversation write failed', {
      reason: errorName(error),
    });
    return { ok: false, code: 'CHAT_HISTORY_WRITE_FAILED' };
  }

  // Authoritative read-back: success is never reported before it matches.
  const readBack = await readConversation(parsedSession.data.id);
  if (!readBack.ok) {
    debugLog('CHAT_HISTORY_READ_BACK_MISMATCH', 'ChatHistoryDB read-back could not be read', {
      code: readBack.code,
    });
    return { ok: false, code: 'CHAT_HISTORY_READ_BACK_MISMATCH' };
  }

  if (!readBackMatches(parsedSession.data, ordered, readBack.session, readBack.messages)) {
    debugLog('CHAT_HISTORY_READ_BACK_MISMATCH', 'ChatHistoryDB read-back did not match the write', {});
    return { ok: false, code: 'CHAT_HISTORY_READ_BACK_MISMATCH' };
  }

  return { ok: true, session: readBack.session, messages: readBack.messages };
}

/**
 * Read one conversation and its messages, ordered by the integer sequence key.
 * Every record is validated at the boundary before it is returned.
 */
export async function readConversation(sessionId: string): Promise<ReadConversationResult> {
  let db;
  try {
    db = await getDb();
  } catch (error) {
    return { ok: false, code: unavailableCode(error) };
  }

  try {
    const tx = db.transaction(['sessions', 'messages'], 'readonly');
    const rawSession = await tx.objectStore('sessions').get(sessionId);
    const rawMessages = await tx.objectStore('messages').index('by-session').getAll(sessionId);
    await tx.done;

    if (rawSession === undefined) {
      return { ok: false, code: 'CHAT_HISTORY_NOT_FOUND' };
    }

    const session = validateReadRecord(rawSession, chatSessionRecordSchema, 'session');
    if (!session.ok) return session;

    const messages: MessageRecord[] = [];
    for (const raw of rawMessages) {
      const message = validateReadRecord(raw, messageRecordSchema, 'message');
      if (!message.ok) return message;
      messages.push(message.value);
    }

    return { ok: true, session: session.value, messages: messages.sort(bySequence) };
  } catch (error) {
    debugLog('CHAT_HISTORY_READ_FAILED', 'ChatHistoryDB conversation read failed', {
      reason: errorName(error),
    });
    return { ok: false, code: 'CHAT_HISTORY_READ_FAILED' };
  }
}

/** A safe id for a record that failed validation: never a body, never a title. */
function safeRecordId(candidate: unknown, index: number): string {
  if (typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)) {
    const id = (candidate as { id?: unknown }).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return `session:${index}`;
}

/**
 * Read every conversation, newest `updated` first, via the `by-updated` index.
 *
 * A record that fails validation is excluded from the list, identified by safe
 * id only and reported in `invalidIds` — never returned, never silently
 * deleted, and never allowed to fail the whole read (D2-20 partial-failure
 * policy). A database-level failure is still the typed whole-read failure.
 */
export async function readAllConversations(): Promise<ReadAllConversationsResult> {
  let db;
  try {
    db = await getDb();
  } catch (error) {
    return { ok: false, code: unavailableCode(error) };
  }

  try {
    const tx = db.transaction('sessions', 'readonly');
    const raw = await tx.objectStore('sessions').index('by-updated').getAll();
    await tx.done;

    const sessions: ChatSessionRecord[] = [];
    const invalidIds: string[] = [];
    raw.forEach((candidate, index) => {
      const session = validateReadRecord(candidate, chatSessionRecordSchema, 'session');
      if (!session.ok) {
        const id = safeRecordId(candidate, index);
        invalidIds.push(id);
        debugLog(INVALID_RECORD_CODE, 'ChatHistoryDB excluded a malformed conversation record', {
          kind: 'session',
          conversationId: id,
        });
        return;
      }
      sessions.push(session.value);
    });

    // The index yields ascending `updated`; the list is newest-first.
    return { ok: true, sessions: sessions.reverse(), invalidIds };
  } catch (error) {
    debugLog('CHAT_HISTORY_READ_FAILED', 'ChatHistoryDB conversation list read failed', {
      reason: errorName(error),
    });
    return { ok: false, code: 'CHAT_HISTORY_READ_FAILED' };
  }
}
