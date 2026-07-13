import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';

export class MemoryDB {
  async addMessage(msg: {
    conversationId: string;
    seq: number;
    role: string;
    content: string;
    timestamp: number;
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('memory_messages', msg);
    } catch (err) {
      debugLog('error', 'MemoryDB.addMessage failed', { error: err });
    }
  }

  async getMessages(conversationId: string): Promise<
    Array<{
      conversationId: string;
      seq: number;
      role: string;
      content: string;
      timestamp: number;
    }>
  > {
    try {
      const db = await getDB();
      const tx = db.transaction('memory_messages');
      const store = tx.store;
      return store.getAll(IDBKeyRange.bound([conversationId, 0], [conversationId, Infinity]));
    } catch (err) {
      debugLog('error', 'MemoryDB.getMessages failed', { error: err });
      return [];
    }
  }

  async putUserFact(fact: {
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
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('memory_userFacts', fact);
    } catch (err) {
      debugLog('error', 'MemoryDB.putUserFact failed', { error: err });
    }
  }

  async getAllUserFacts(): Promise<
    Array<{
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
    }>
  > {
    try {
      const db = await getDB();
      return db.getAll('memory_userFacts');
    } catch (err) {
      debugLog('error', 'MemoryDB.getAllUserFacts failed', { error: err });
      return [];
    }
  }

  async putSummary(summary: {
    conversationId: string;
    summary: string;
    messageCount: number;
    created: number;
    updated: number;
    state?: 'active' | 'archived';
    archivedAt?: number;
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('memory_summaries', summary);
    } catch (err) {
      debugLog('error', 'MemoryDB.putSummary failed', { error: err });
    }
  }

  async getSummary(conversationId: string): Promise<
    | {
        conversationId: string;
        summary: string;
        messageCount: number;
        created: number;
        updated: number;
        state?: 'active' | 'archived';
        archivedAt?: number;
      }
    | undefined
  > {
    try {
      const db = await getDB();
      return db.get('memory_summaries', conversationId);
    } catch (err) {
      debugLog('error', 'MemoryDB.getSummary failed', { error: err });
      return undefined;
    }
  }
}

export const memoryDB = new MemoryDB();
