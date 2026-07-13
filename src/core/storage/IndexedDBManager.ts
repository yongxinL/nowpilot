import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { debugLog } from '../utils/debugLog';

export interface NowPilotDB extends DBSchema {
  chat_history_sessions: {
    key: string;
    value: {
      id: string;
      title: string;
      created: number;
      updated: number;
      starred: boolean;
      preview: string;
    };
  };
  chat_history_messages: {
    key: string;
    value: {
      id: string;
      sessionId: string;
      role: string;
      content: string;
      timestamp: number;
      metadata?: unknown;
    };
    indexes: { 'by-session': string };
  };
  notes_notes: {
    key: string;
    value: {
      id: string;
      title: string;
      content: string;
      created: number;
      updated: number;
      tags: string[];
    };
  };
  notes_concepts: {
    key: string;
    value: {
      slug: string;
      label: string;
      description: string;
      linkedNoteIds: string[];
    };
  };
  memory_messages: {
    key: [string, number];
    value: {
      conversationId: string;
      seq: number;
      role: string;
      content: string;
      timestamp: number;
    };
  };
  memory_userFacts: {
    key: string;
    value: {
      id: string;
      fact: string;
      category: string;
      confidence: number;
      created: number;
      updated: number;
      source: string;
      status?: 'active' | 'superseded';
      tags?: string[];
      useCount?: number;
      lastUsedAt?: number;
    };
  };
  memory_summaries: {
    key: string;
    value: {
      conversationId: string;
      summary: string;
      messageCount: number;
      created: number;
      updated: number;
      state?: 'active' | 'archived';
      archivedAt?: number;
    };
  };
  errors: {
    key: string;
    value: {
      id: string;
      timestamp: number;
      level: string;
      message: string;
      stack?: string;
      context?: unknown;
    };
  };
  transaction_log_transactions: {
    key: string;
    value: {
      id: string;
      type: string;
      provider: string;
      model: string;
      startTime: number;
      endTime?: number;
      status: string;
      metadata?: unknown;
    };
  };
  transaction_log_promptTraces: {
    key: string;
    value: {
      id: string;
      transactionId: string;
      tokens: number;
      cached: boolean;
      truncated: boolean;
    };
  };
  transaction_log_toolTraces: {
    key: string;
    value: {
      id: string;
      transactionId: string;
      toolName: string;
      allowed: boolean;
      outcome: string;
      timestamp: number;
    };
  };
  transaction_log_providerTraces: {
    key: string;
    value: {
      id: string;
      transactionId: string;
      provider: string;
      attempts: number;
      circuitBreakerOpen: boolean;
      timestamp: number;
    };
  };
  write_journal_entries: {
    key: string;
    value: {
      id: string;
      operation: string;
      status: 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';
      createdAt: number;
      updatedAt: number;
      attempts: number;
      targetIds: Record<string, string>;
      steps: Array<{
        name: string;
        status: 'pending' | 'completed' | 'failed';
        error?: string;
      }>;
    };
    indexes: { 'by-status': string };
  };
}

export const DB_VERSION = 2;

let dbInstance: IDBPDatabase<NowPilotDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<NowPilotDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<NowPilotDB>('nowpilot', DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, _transaction) {
      if (oldVersion < 1) {
        db.createObjectStore('chat_history_sessions', { keyPath: 'id' });

        const messagesStore = db.createObjectStore('chat_history_messages', { keyPath: 'id' });
        messagesStore.createIndex('by-session', 'sessionId');

        db.createObjectStore('notes_notes', { keyPath: 'id' });
        db.createObjectStore('notes_concepts', { keyPath: 'slug' });

        db.createObjectStore('memory_messages', { keyPath: ['conversationId', 'seq'] });
        db.createObjectStore('memory_userFacts', { keyPath: 'id' });
        db.createObjectStore('memory_summaries', { keyPath: 'conversationId' });

        db.createObjectStore('errors', { keyPath: 'id' });

        db.createObjectStore('transaction_log_transactions', { keyPath: 'id' });
        db.createObjectStore('transaction_log_promptTraces', { keyPath: 'id' });
        db.createObjectStore('transaction_log_toolTraces', { keyPath: 'id' });
        db.createObjectStore('transaction_log_providerTraces', { keyPath: 'id' });

        const journalStore = db.createObjectStore('write_journal_entries', { keyPath: 'id' });
        journalStore.createIndex('by-status', 'status');
      }
      if (oldVersion < 2) {
        /* v2: schemaless stores — new fields (status, tags, useCount, lastUsedAt, state, archivedAt) are added via put() at runtime with defaults. No schema alteration needed. */
      }
    },
    blocked() {
      debugLog('warn', 'IndexedDB: open blocked by older connection');
    },
    blocking() {
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      debugLog('error', 'IndexedDB: connection terminated unexpectedly');
      dbInstance = null;
    },
  });

  return dbInstance;
}
