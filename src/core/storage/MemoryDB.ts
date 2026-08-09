// src/core/storage/MemoryDB.ts — the long-term memory IndexedDB store
// (STORAGE-01). Data models VERBATIM §21.3 (lines 3391-3407 — MemoryMessage
// with composite keyPath [conversationId, seq]) and §21.4 (lines 3413-3419 —
// Fact); store layout per §15.1 (lines 1959-1962). Memory bodies live HERE —
// never chrome.storage.local (§0.2, Pitfall 4).
//
// Idb + strict DBSchema typing (RESEARCH Pattern 1): openMemoryDB() opens
// 'MemoryDB' at DB_VERSION with a NON-throwing upgrade (no migration history
// yet — future changes extend the 02-06 migration registry).
//
// The composite keyPath ['conversationId', 'seq'] IS the §20.2 idempotency key
// (save memory body = conversationId + seq) and the by-conversation index is
// what getMessagesForConversation reads — a cross-conversation leak would fail
// the interleaving ordering assertions (T-2-07-02).
//
// Every catch calls debugLog with a canonical STORE_READ/STORE_WRITE code
// (Golden Rule 9); write paths never throw (PATTERNS Shared Pattern 1).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

/**
 * §21.3 (lines 3401-3407) — verbatim MemoryMessage. role is the LLMMessage
 * role union (Appendix C line 4265: 'system'|'user'|'assistant'|'tool');
 * LLMMessage itself arrives with the Phase-3 AI layer, so the union is inlined.
 */
export interface MemoryMessage {
  conversationId: string;
  seq: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
}

/** §21.4 (lines 3413-3419) — verbatim Fact. */
export interface Fact {
  id: string;
  content: string;
  confidence: number;
  source: 'extracted' | 'explicit';
  created: number;
}

/** §15.1 conversationSummaries row — conversationId-keyed rolling summary. */
export interface ConversationSummary {
  conversationId: string;
  summary: string;
  updatedAt: number;
}

/** §15.1 MemoryDB stores + indexes (by-conversation on the composite key). */
export interface MemoryDBSchema extends DBSchema {
  messages: {
    key: [string, number];
    value: MemoryMessage;
    indexes: { 'by-conversation': string };
  };
  userFacts: { key: string; value: Fact };
  conversationSummaries: { key: string; value: ConversationSummary };
}

/** Store schema version — bumped by the 02-06 migrator on future changes. */
export const DB_VERSION = 1;

/**
 * Open the MemoryDB with a NON-throwing upgrade. Messages use the composite
 * keyPath ['conversationId','seq'] + by-conversation index (conversationId);
 * userFacts keyed by 'id'; conversationSummaries keyed by 'conversationId'.
 */
export function openMemoryDB(): Promise<IDBPDatabase<MemoryDBSchema>> {
  return openDB<MemoryDBSchema>('MemoryDB', DB_VERSION, {
    upgrade(db) {
      const messages = db.createObjectStore('messages', { keyPath: ['conversationId', 'seq'] });
      messages.createIndex('by-conversation', 'conversationId');
      db.createObjectStore('userFacts', { keyPath: 'id' });
      db.createObjectStore('conversationSummaries', { keyPath: 'conversationId' });
    },
  });
}

/** Upsert a memory message (write path — never throws; STORE_WRITE on failure). */
export async function putMemoryMessage(
  db: IDBPDatabase<MemoryDBSchema>,
  message: MemoryMessage,
): Promise<void> {
  try {
    await db.put('messages', message);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to put memory message', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryDB',
      extra: { conversationId: message.conversationId, seq: message.seq },
    });
  }
}

/**
 * All messages for one conversation via the by-conversation index, ordered by
 * seq (equal conversationId index keys fall back to the composite primary key
 * [conversationId, seq] — seq order). [] on read failure.
 */
export async function getMessagesForConversation(
  db: IDBPDatabase<MemoryDBSchema>,
  conversationId: string,
): Promise<MemoryMessage[]> {
  try {
    return await db.getAllFromIndex('messages', 'by-conversation', conversationId);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get messages for conversation', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryDB',
      extra: { conversationId },
    });
    return [];
  }
}

/** Upsert a fact (write path — never throws; STORE_WRITE on failure). */
export async function putFact(db: IDBPDatabase<MemoryDBSchema>, fact: Fact): Promise<void> {
  try {
    await db.put('userFacts', fact);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to put fact', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryDB',
      extra: { factId: fact.id },
    });
  }
}

/** Read a fact by id (undefined when absent or on read failure). */
export async function getFact(
  db: IDBPDatabase<MemoryDBSchema>,
  id: string,
): Promise<Fact | undefined> {
  try {
    return await db.get('userFacts', id);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get fact', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryDB',
      extra: { factId: id },
    });
    return undefined;
  }
}

/** All facts ([] on read failure). */
export async function listFacts(db: IDBPDatabase<MemoryDBSchema>): Promise<Fact[]> {
  try {
    return await db.getAll('userFacts');
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to list facts', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryDB',
    });
    return [];
  }
}

/** Upsert a conversation summary (write path — never throws). */
export async function putConversationSummary(
  db: IDBPDatabase<MemoryDBSchema>,
  summary: ConversationSummary,
): Promise<void> {
  try {
    await db.put('conversationSummaries', summary);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to put conversation summary', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryDB',
      extra: { conversationId: summary.conversationId },
    });
  }
}

/** Read a conversation summary (undefined when absent or on read failure). */
export async function getConversationSummary(
  db: IDBPDatabase<MemoryDBSchema>,
  conversationId: string,
): Promise<ConversationSummary | undefined> {
  try {
    return await db.get('conversationSummaries', conversationId);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get conversation summary', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryDB',
      extra: { conversationId },
    });
    return undefined;
  }
}
