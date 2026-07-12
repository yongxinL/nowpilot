import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';

const MAX_ERRORS = 100;

export class ErrorStore {
  async logError(error: {
    id: string;
    timestamp: number;
    level: string;
    message: string;
    stack?: string;
    context?: unknown;
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('errors', error);

      const count = await db.count('errors');
      if (count > MAX_ERRORS) {
        const all = await db.getAll('errors');
        all.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = count - MAX_ERRORS;
        for (let i = 0; i < toDelete; i++) {
          await db.delete('errors', all[i].id);
        }
      }
    } catch (err) {
      debugLog('error', 'ErrorStore.logError failed', { error: err });
    }
  }

  async getErrors(limit?: number): Promise<
    Array<{
      id: string;
      timestamp: number;
      level: string;
      message: string;
      stack?: string;
      context?: unknown;
    }>
  > {
    try {
      const db = await getDB();
      const all = await db.getAll('errors');
      all.sort((a, b) => b.timestamp - a.timestamp);
      return limit ? all.slice(0, limit) : all;
    } catch (err) {
      debugLog('error', 'ErrorStore.getErrors failed', { error: err });
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await getDB();
      await db.clear('errors');
    } catch (err) {
      debugLog('error', 'ErrorStore.clear failed', { error: err });
    }
  }
}

export const errorStore = new ErrorStore();
