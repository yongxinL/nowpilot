import type { IDBPDatabase } from 'idb';
import type { IndexedDBMigration } from '../IndexedDBMigrator';
import type { NowPilotDB } from '../IndexedDBManager';

export const migrationV1: IndexedDBMigration = {
  fromVersion: 0,
  toVersion: 1,
  description: 'Initial schema: create all 13 object stores with keyPaths and indexes',
  migrate: async (db: IDBPDatabase<NowPilotDB>, oldVersion: number, _newVersion: number) => {
    if (oldVersion >= 1) {
      return;
    }

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
  },
};
