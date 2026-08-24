/**
 * ChatHistoryDB — Phase 2 IDB foundation (D-41/D-42, §15.1).
 *
 * Persists chat session metadata + message bodies. Bootstrap at v1 with
 * the §15.1 store list. Production data migrations land in owning phases;
 * Phase 2 ships only the schema + open path.
 *
 * §15.1 store list (verbatim):
 *   - sessions  { id, title, created, updated, starred, preview }
 *   - messages  { sessionId, role, content, timestamp, metadata }
 *
 * Idb @jakearchibald/idb v8 — `DBSchema` typing + conditional migration
 * blocks (Pitfall 8). The store schema is a forward-compatible contract
 * (D-41 forward-migration contract) — renumbering DB_VERSION requires
 * a registered IndexedDBMigration.
 */

import type { DBSchema } from 'idb';
import { openVersionedDB } from './IndexedDBMigrator';

export const CHAT_HISTORY_DB = 'ChatHistoryDB';
export const CHAT_HISTORY_DB_VERSION = 1;

export interface ChatHistorySession {
  id: string;
  title: string;
  created: number;
  updated: number;
  starred: boolean;
  preview: string;
}

export interface ChatHistoryMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ChatHistoryDBV1 extends DBSchema {
  sessions: {
    key: string;
    value: ChatHistorySession;
  };
  messages: {
    key: string;
    value: ChatHistoryMessage;
    indexes: { sessionId: string };
  };
}

export async function openChatHistoryDB() {
  return openVersionedDB<ChatHistoryDBV1>(CHAT_HISTORY_DB, CHAT_HISTORY_DB_VERSION, {
    upgrade(database, oldVersion) {
      // Conditional block per spec §20.4 / Pitfall 8 — fresh DB
      // (oldVersion === 0) creates the stores; existing v1 DB is
      // untouched.
      if (oldVersion < 1) {
        const sessions = database.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('byUpdated', 'updated');
        const messages = database.createObjectStore('messages', { keyPath: 'id' });
        messages.createIndex('sessionId', 'sessionId');
      }
      // Future: if (oldVersion < 2) { ... } — the forward-migration
      // contract (D-41).
    },
    blocked() {
      // IDB_BLOCKED — caller records to ErrorStore (deferred to 02-05
      // wiring; bootstrap() handles the degraded-mode recording).
    },
  });
}