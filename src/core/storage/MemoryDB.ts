/**
 * MemoryDB — Phase 2 IDB foundation (D-41/D-42, §15.1).
 *
 * Persists per-conversation message bodies, user facts, and
 * conversation summaries. Bootstrap at v1 with the §15.1 store list.
 *
 * §15.1 store list (verbatim):
 *   - messages             keyPath [conversationId, seq]   (spec-explicit compound key)
 *   - userFacts            keyPath 'id' (UserMemoryFact records)
 *   - conversationSummaries keyPath 'conversationId'
 *
 * Spec note: `messages` uses a compound keyPath `[conversationId, seq]`
 * so range queries by conversationId are O(log n). Storing the
 * compound key on the value object is required by idb (the value MUST
 * carry `conversationId` + `seq` fields matching the keyPath tuple).
 *
 * Idb @jakearchibald/idb v8 — `DBSchema` typing + conditional migration
 * blocks (Pitfall 8). The store schema is a forward-compatible contract
 * (D-41 forward-migration contract).
 */

import type { DBSchema } from 'idb';
import { openVersionedDB } from './IndexedDBMigrator';

export const MEMORY_DB = 'MemoryDB';
export const MEMORY_DB_VERSION = 1;

export interface MemoryMessage {
  conversationId: string;
  seq: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface UserMemoryFact {
  id: string;
  userId: string;
  fact: string;
  category: string;
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationSummary {
  conversationId: string;
  summary: string;
  keyPoints: string[];
  updatedAt: number;
}

export interface MemoryDBV1 extends DBSchema {
  messages: {
    key: [string, number];
    value: MemoryMessage;
    indexes: { byConversation: string };
  };
  userFacts: {
    key: string;
    value: UserMemoryFact;
    indexes: { byUser: string };
  };
  conversationSummaries: {
    key: string;
    value: ConversationSummary;
  };
}

export async function openMemoryDB() {
  return openVersionedDB<MemoryDBV1>(MEMORY_DB, MEMORY_DB_VERSION, {
    upgrade(database, oldVersion) {
      // Conditional block per spec §20.4 / Pitfall 8 — fresh DB
      // (oldVersion === 0) creates the stores; existing v1 DB is
      // untouched.
      if (oldVersion < 1) {
        const messages = database.createObjectStore('messages', {
          keyPath: ['conversationId', 'seq'],
        });
        messages.createIndex('byConversation', 'conversationId');
        const userFacts = database.createObjectStore('userFacts', { keyPath: 'id' });
        userFacts.createIndex('byUser', 'userId');
        database.createObjectStore('conversationSummaries', { keyPath: 'conversationId' });
      }
      // Future: if (oldVersion < 2) { ... } — the forward-migration
      // contract (D-41).
    },
    blocked() {
      // IDB_BLOCKED — bootstrap() handles degraded-mode recording.
    },
  });
}
