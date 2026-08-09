// src/core/storage/ChatHistoryDB.ts — the sessions + messages IndexedDB store
// (STORAGE-01). Data models VERBATIM §21.1 (lines 3329-3353); store layout per
// §15.1 (lines 1950-1953). Message bodies live HERE — never chrome.storage.local
// (§0.2, Pitfall 4: 10MB quota; bodies are the ONLY permitted home in IndexedDB).
//
// Idb + strict DBSchema typing (RESEARCH Pattern 1): openChatHistoryDB() opens
// 'ChatHistoryDB' at DB_VERSION with a NON-throwing upgrade (no migration
// history yet — the migrator happy path per RESEARCH note; future schema
// changes register a DBVersionMigration with the 02-06 IndexedDBMigrator).
//
// Every catch calls debugLog with a canonical STORE_READ/STORE_WRITE code
// (Golden Rule 9); write paths never throw (PATTERNS Shared Pattern 1).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import type { ActiveSurface } from '@/types/workspace';

/** §21.1 (lines 3330-3337) — verbatim ChatSession. */
export interface ChatSession {
  id: string;
  title: string;
  created: number;
  updated: number;
  starred: boolean;
  preview: string;
}

/** §21.1 (lines 3338-3352) — verbatim ChatMessage. */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    skillId?: string;
    toolName?: string;
    surface?: ActiveSurface;
  };
}

/** §15.1 ChatHistoryDB stores + indexes (by-session / by-timestamp). */
export interface ChatHistoryDBSchema extends DBSchema {
  sessions: { key: string; value: ChatSession };
  messages: {
    key: string;
    value: ChatMessage;
    indexes: { 'by-session': string; 'by-timestamp': number };
  };
}

/** Store schema version — bumped by the 02-06 migrator on future changes. */
export const DB_VERSION = 1;

/**
 * Open the ChatHistoryDB with a NON-throwing upgrade (RESEARCH note: the
 * migrator happy path — no migration history yet). Sessions keyed by 'id',
 * messages keyed by 'id' with by-session (sessionId) and by-timestamp indexes.
 */
export function openChatHistoryDB(): Promise<IDBPDatabase<ChatHistoryDBSchema>> {
  return openDB<ChatHistoryDBSchema>('ChatHistoryDB', DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('sessions', { keyPath: 'id' });
      const messages = db.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('by-session', 'sessionId');
      messages.createIndex('by-timestamp', 'timestamp');
    },
  });
}

/** Upsert a session (write path — never throws; STORE_WRITE on failure). */
export async function putSession(
  db: IDBPDatabase<ChatHistoryDBSchema>,
  session: ChatSession,
): Promise<void> {
  try {
    await db.put('sessions', session);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to put session', {
      error: err instanceof Error ? err : undefined,
      module: 'ChatHistoryDB',
      extra: { sessionId: session.id },
    });
  }
}

/** Read a session by id (undefined when absent or on read failure). */
export async function getSession(
  db: IDBPDatabase<ChatHistoryDBSchema>,
  id: string,
): Promise<ChatSession | undefined> {
  try {
    return await db.get('sessions', id);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get session', {
      error: err instanceof Error ? err : undefined,
      module: 'ChatHistoryDB',
      extra: { sessionId: id },
    });
    return undefined;
  }
}

/** All sessions ([] on read failure). */
export async function listSessions(db: IDBPDatabase<ChatHistoryDBSchema>): Promise<ChatSession[]> {
  try {
    return await db.getAll('sessions');
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to list sessions', {
      error: err instanceof Error ? err : undefined,
      module: 'ChatHistoryDB',
    });
    return [];
  }
}

/** Upsert a message (write path — never throws; STORE_WRITE on failure). */
export async function putMessage(
  db: IDBPDatabase<ChatHistoryDBSchema>,
  message: ChatMessage,
): Promise<void> {
  try {
    await db.put('messages', message);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to put message', {
      error: err instanceof Error ? err : undefined,
      module: 'ChatHistoryDB',
      extra: { messageId: message.id, sessionId: message.sessionId },
    });
  }
}

/**
 * Messages for one session via the by-session index, ordered by timestamp
 * (the by-session index groups; timestamp sort gives the §21.1 sequence).
 * [] on read failure.
 */
export async function getMessagesForSession(
  db: IDBPDatabase<ChatHistoryDBSchema>,
  sessionId: string,
): Promise<ChatMessage[]> {
  try {
    const messages = await db.getAllFromIndex('messages', 'by-session', sessionId);
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get messages for session', {
      error: err instanceof Error ? err : undefined,
      module: 'ChatHistoryDB',
      extra: { sessionId },
    });
    return [];
  }
}

/**
 * Delete a session AND its messages (T-2-07-03: bodies are orphaned
 * otherwise). One readwrite transaction over both stores; the by-session
 * index cursor deletes every message row before the session row. Never throws.
 */
export async function deleteSession(
  db: IDBPDatabase<ChatHistoryDBSchema>,
  sessionId: string,
): Promise<void> {
  try {
    const tx = db.transaction(['sessions', 'messages'], 'readwrite');
    const index = tx.objectStore('messages').index('by-session');
    let cursor = await index.openCursor(sessionId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.objectStore('sessions').delete(sessionId);
    await tx.done;
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to delete session', {
      error: err instanceof Error ? err : undefined,
      module: 'ChatHistoryDB',
      extra: { sessionId },
    });
  }
}
