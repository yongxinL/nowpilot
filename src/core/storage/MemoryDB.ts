// src/core/storage/MemoryDB.ts — the long-term memory IndexedDB store
// (STORAGE-01). Data models VERBATIM §21.3 (lines 3391-3407 — MemoryMessage
// with composite keyPath [conversationId, seq]) and §21.4 (lines 3413-3419 —
// Fact); store layout per §15.1 (lines 1959-1962). Memory bodies live HERE —
// never chrome.storage.local (§0.2, Pitfall 4).
//
// D-14 registry open (Phase 5, 05-02): openMemoryDB() now routes through
// runMigrations (IndexedDBMigrator) with a registered DBVersionMigration.
//
// V2 schema change (MEMORY_DB_VERSION = 2, Open Q2 resolution — see
// 05-RESEARCH.md L516-519): userFacts value type upgrades from the §21.4 `Fact`
// shape to the §3.4 `UserMemoryFact` shape (spec §15.1 names `userFacts
// UserMemoryFact[]` — the code deviated). The v1→v2 migration is DATA-CARRY
// with default-fill: legacy rows map { id, content, confidence, source, created }
// → { type: 'fact', tags: [], createdAt: created, updatedAt: created,
// lastUsedAt: undefined, useCount: 0 }. Legacy sources map semantically —
// 'explicit' → 'explicit' (valid §3.4 source); 'extracted' → 'inferred' (the
// extraction pipeline's facts are system-inferred knowledge, not user-stated;
// 'extracted' is NOT in the §3.4 union 'explicit'|'inferred'|'system').
// Existing rows survive the migration (test-proven in UserMemoryStore.test.ts).
//
// The composite keyPath ['conversationId', 'seq'] IS the §20.2 idempotency key
// (save memory body = conversationId + seq) and the by-conversation index is
// what getMessagesForConversation reads — a cross-conversation leak would fail
// the interleaving ordering assertions (T-2-07-02).
//
// Every catch calls debugLog with a canonical STORE_READ/STORE_WRITE code
// (Golden Rule 9); write paths never throw (PATTERNS Shared Pattern 1).
import { unwrap, type DBSchema, type IDBPDatabase } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import {
  runMigrations,
  type DBVersionMigration,
  type IndexedDBMigration,
} from '@/core/storage/IndexedDBMigrator';
import type { UserMemoryFact } from '@/core/memory/types';

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

/** §21.4 (lines 3413-3419) — verbatim Fact. Kept exported: the v1→v2 migration
 * reads legacy rows Fact-shaped before conversion, and ImportExport validates
 * legacy backup rows against it (05-02 Task 2). */
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

/** §15.1 MemoryDB stores + indexes (by-conversation on the composite key).
 * userFacts holds §3.4 UserMemoryFact rows (v2 — upgraded from §21.4 Fact). */
export interface MemoryDBSchema extends DBSchema {
  messages: {
    key: [string, number];
    value: MemoryMessage;
    indexes: { 'by-conversation': string };
  };
  userFacts: { key: string; value: UserMemoryFact };
  conversationSummaries: { key: string; value: ConversationSummary };
}

/** Legacy v1 schema version (pre-userFacts-upgrade). Superseded by v2. */
export const DB_VERSION = 1;

/** Current MemoryDB schema version — userFacts holds UserMemoryFact (05-02). */
export const MEMORY_DB_VERSION = 2;

/**
 * The v1→v2 data-carry migration (Open Q2 resolution, Pitfall 2 closed).
 * Dispatched SYNCHRONOUSLY inside onupgradeneeded by runMigrations — never
 * awaits (Phase-2 Pitfall: an awaited non-IDB promise closes the upgrade tx).
 * The upgrade handler creates the userFacts store if absent (v0→v2 fresh-install
 * path) and only transforms rows when the old version < 2 (the runner only
 * fires migrations whose fromVersion is inside [oldVersion, newVersion)).
 * Legacy rows are read Fact-shaped and default-filled into UserMemoryFact.
 */
export const userFactsV2Migration: IndexedDBMigration = {
  fromVersion: 1,
  toVersion: 2,
  description: 'v1→v2 data-carry: userFacts Fact → UserMemoryFact (default-fill)',
  migrate(db, tx) {
    // Fresh-install path (v0→v2): create the full §15.1 store set. The runner
    // fires the fromVersion:1 step on a fresh open too (chain runs every step
    // in [oldVersion, newVersion)); without the guards a v1 DB would throw
    // 'store already exists' on the stores that are already there.
    if (!db.objectStoreNames.contains('messages')) {
      const messages = db.createObjectStore('messages', { keyPath: ['conversationId', 'seq'] });
      messages.createIndex('by-conversation', 'conversationId');
    }
    if (!db.objectStoreNames.contains('userFacts')) {
      db.createObjectStore('userFacts', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('conversationSummaries')) {
      db.createObjectStore('conversationSummaries', { keyPath: 'conversationId' });
    }
    // Data-carry: transform existing rows via RAW IDBRequest chaining on the
    // unwrapped upgrade tx (D-13 fixture shape — never await inside the
    // upgrade). On a fresh install the store is empty → no-op.
    const rawTx = unwrap(tx);
    const rowsRequest = rawTx.objectStore('userFacts').getAll();
    rowsRequest.onsuccess = () => {
      const target = rawTx.objectStore('userFacts');
      for (const legacy of rowsRequest.result as Fact[]) {
        target.put({
          id: legacy.id,
          content: legacy.content,
          type: 'fact',
          tags: [],
          confidence: legacy.confidence,
          source: legacy.source === 'explicit' ? 'explicit' : 'inferred',
          createdAt: legacy.created,
          updatedAt: legacy.created,
          lastUsedAt: undefined,
          useCount: 0,
        } satisfies UserMemoryFact);
      }
    };
    return Promise.resolve();
  },
};

/** D-14 registry entry: MemoryDB at v2 with the userFacts upgrade registered. */
export const memoryDBMigrations: DBVersionMigration = {
  dbName: 'MemoryDB',
  dbVersion: MEMORY_DB_VERSION,
  migrations: [userFactsV2Migration],
};

/**
 * Open the MemoryDB via the D-14 runMigrations runner (RESEARCH Pattern 2 —
 * raw indexedDB.open + sync dispatch; the exported name stays openMemoryDB so
 * existing Phase-2 callers compile unchanged). Messages use the composite
 * keyPath ['conversationId','seq'] + by-conversation index; userFacts keyed by
 * 'id'; conversationSummaries keyed by 'conversationId'. A migration failure
 * records IDB_MIGRATION_FAILED and degrades the DB read-only (D-12 contract).
 */
export function openMemoryDB(): Promise<IDBPDatabase<MemoryDBSchema>> {
  return runMigrations<MemoryDBSchema>(memoryDBMigrations);
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

/** Upsert a user memory fact (v2 §3.4 shape; write path — never throws). */
export async function putFact(
  db: IDBPDatabase<MemoryDBSchema>,
  fact: UserMemoryFact,
): Promise<void> {
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

/** Read a user memory fact by id (undefined when absent or on read failure). */
export async function getFact(
  db: IDBPDatabase<MemoryDBSchema>,
  id: string,
): Promise<UserMemoryFact | undefined> {
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

/** All user memory facts ([] on read failure). */
export async function listFacts(db: IDBPDatabase<MemoryDBSchema>): Promise<UserMemoryFact[]> {
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
