import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';

export class ChatHistoryDB {
  async createSession(session: {
    id: string;
    title: string;
    created: number;
    updated: number;
    starred: boolean;
    preview: string;
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('chat_history_sessions', session);
    } catch (err) {
      debugLog('error', 'ChatHistoryDB.createSession failed', { error: err });
    }
  }

  async getSession(id: string): Promise<
    | {
        id: string;
        title: string;
        created: number;
        updated: number;
        starred: boolean;
        preview: string;
      }
    | undefined
  > {
    try {
      const db = await getDB();
      return db.get('chat_history_sessions', id);
    } catch (err) {
      debugLog('error', 'ChatHistoryDB.getSession failed', { error: err });
      return undefined;
    }
  }

  async getAllSessions(): Promise<
    Array<{
      id: string;
      title: string;
      created: number;
      updated: number;
      starred: boolean;
      preview: string;
    }>
  > {
    try {
      const db = await getDB();
      return db.getAll('chat_history_sessions');
    } catch (err) {
      debugLog('error', 'ChatHistoryDB.getAllSessions failed', { error: err });
      return [];
    }
  }

  async updateSession(
    id: string,
    updates: Partial<{ title: string; preview: string; updated: number; starred: boolean }>,
  ): Promise<void> {
    try {
      const db = await getDB();
      const existing = await db.get('chat_history_sessions', id);
      if (!existing) return;
      const merged = { ...existing, ...updates };
      await db.put('chat_history_sessions', merged);
    } catch (err) {
      debugLog('error', 'ChatHistoryDB.updateSession failed', { error: err });
    }
  }

  async addMessage(message: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    timestamp: number;
    metadata?: unknown;
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('chat_history_messages', message);
    } catch (err) {
      debugLog('error', 'ChatHistoryDB.addMessage failed', { error: err });
    }
  }

  async getMessagesBySession(sessionId: string): Promise<
    Array<{
      id: string;
      sessionId: string;
      role: string;
      content: string;
      timestamp: number;
      metadata?: unknown;
    }>
  > {
    try {
      const db = await getDB();
      const index = db.transaction('chat_history_messages').store.index('by-session');
      return index.getAll(sessionId);
    } catch (err) {
      debugLog('error', 'ChatHistoryDB.getMessagesBySession failed', { error: err });
      return [];
    }
  }

  async deleteSession(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('chat_history_sessions', id);
    } catch (err) {
      debugLog('error', 'ChatHistoryDB.deleteSession failed', { error: err });
    }
  }

  async deleteMessagesBySession(sessionId: string): Promise<void> {
    try {
      const db = await getDB();
      const messages = await this.getMessagesBySession(sessionId);
      const tx = db.transaction('chat_history_messages', 'readwrite');
      for (const msg of messages) {
        await tx.store.delete(msg.id);
      }
      await tx.done;
    } catch (err) {
      debugLog('error', 'ChatHistoryDB.deleteMessagesBySession failed', { error: err });
    }
  }
}

export const chatHistoryDB = new ChatHistoryDB();
