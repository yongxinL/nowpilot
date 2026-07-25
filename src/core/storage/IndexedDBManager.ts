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
      summary?: string;
      categoryPath?: string;
      summaryGeneratedAt?: number;
      tagsGeneratedAt?: number;
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
  notes_backup_config: {
    key: string;
    value: {
      id: string;
      folderHandle: FileSystemDirectoryHandle;
      folderName: string;
      lastSyncTimestamp?: number;
      totalNotesBackedUp?: number;
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
      sessionId: string;
      conversationId: string;
      workspaceId: string;
      activeSurface: string;
      userTurnId: string;
      type: string;
      status: string;
      providerId: string;
      model: string;
      startedAt: number;
      endedAt?: number;
      durationMs?: number;
      errorCode?: string;
      severity?: string;
      parentOperationId?: string;
      verbosity: string;
      privacyMode: boolean;
    };
    indexes: {
      'by-operationId': string;
      'by-status': string;
      'by-severity': string;
      'by-timestamp': number;
    };
  };
  transaction_log_promptTraces: {
    key: string;
    value: {
      id: string;
      operationId: string;
      promptTemplateId?: string;
      promptHash: string;
      tokenBreakdown: {
        system: number; memory: number; tools: number; context: number;
        history: number; user: number; output: number; total: number;
      };
      contextTier: string;
      truncated: boolean;
      minimalMode: boolean;
      cacheStats: {
        sectionsMarked: number;
        estimatedSavings: number;
        hitRate?: number;
      };
      source: string;
      timestamp: number;
    };
    indexes: { 'by-operationId': string };
  };
  transaction_log_toolTraces: {
    key: string;
    value: {
      id: string;
      operationId: string;
      parentOperationId?: string;
      toolName: string;
      source: string;
      dangerous: boolean;
      permissionDecision: string;
      inputSchema?: string;
      outputSchema?: string;
      status: string;
      errorMessage?: string;
      durationMs: number;
      timestamp: number;
    };
    indexes: { 'by-operationId': string };
  };
  transaction_log_providerTraces: {
    key: string;
    value: {
      id: string;
      operationId: string;
      attempts: unknown[];
      resolvedProviderId: string;
      resolvedModel: string;
      totalDurationMs: number;
      timestamp: number;
    };
    indexes: { 'by-operationId': string };
  };
  transaction_log_cacheTraces: {
    key: string;
    value: {
      id: string;
      operationId: string;
      event: string;
      section?: string;
      providerId?: string;
      cacheKey?: string;
      estimatedTokenSavings?: number;
      timestamp: number;
    };
    indexes: { 'by-operationId': string };
  };
  transaction_log_memoryTraces: {
    key: string;
    value: {
      id: string;
      operationId: string;
      phase: string;
      conversationId: string;
      factsRetrieved?: number;
      factsExtracted?: number;
      extractionAttempt?: number;
      summarized: boolean;
      timestamp: number;
    };
    indexes: { 'by-operationId': string };
  };
  transaction_log_writeJournalTraces: {
    key: string;
    value: {
      id: string;
      operationId: string;
      journalId: string;
      operation: string;
      status: string;
      stepsCount: number;
      failedSteps?: number[];
      recovered: boolean;
      timestamp: number;
    };
    indexes: { 'by-operationId': string };
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
  extraction_log: {
    key: string;
    value: {
      id: string;
      url: string;
      trace: {
        steps: Array<{
          step: string;
          status: string;
          durationMs: number;
          detail?: string;
        }>;
        totalDurationMs: number;
        extractionType?: string;
        extractionQuality?: string;
      };
      timestamp: number;
    };
  };
}

export const DB_VERSION = 5;

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
      if (oldVersion < 3) {
        /* v3: Add 3 new trace stores (cache, memory, writeJournal) and indexes on all 7 stores */
        const cacheStore = db.createObjectStore('transaction_log_cacheTraces', { keyPath: 'id' });
        cacheStore.createIndex('by-operationId', 'operationId');

        const memoryStore = db.createObjectStore('transaction_log_memoryTraces', { keyPath: 'id' });
        memoryStore.createIndex('by-operationId', 'operationId');

        const journalStore = db.createObjectStore('transaction_log_writeJournalTraces', { keyPath: 'id' });
        journalStore.createIndex('by-operationId', 'operationId');

        // Add indexes to existing stores using the upgrade transaction
        _transaction.objectStore('transaction_log_transactions').createIndex('by-operationId', 'operationId');
        _transaction.objectStore('transaction_log_transactions').createIndex('by-status', 'status');
        _transaction.objectStore('transaction_log_transactions').createIndex('by-severity', 'severity');
        _transaction.objectStore('transaction_log_transactions').createIndex('by-timestamp', 'startedAt');

        _transaction.objectStore('transaction_log_promptTraces').createIndex('by-operationId', 'operationId');
        _transaction.objectStore('transaction_log_toolTraces').createIndex('by-operationId', 'operationId');
        _transaction.objectStore('transaction_log_providerTraces').createIndex('by-operationId', 'operationId');
      }
      if (oldVersion < 4) {
        db.createObjectStore('notes_backup_config', { keyPath: 'id' });
      }
      if (oldVersion < 5) {
        db.createObjectStore('extraction_log', { keyPath: 'id' });
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
