import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';

export interface ExtractionLogEntry {
  id: string;
  url: string;
  trace: {
    steps: Array<{
      step: string;
      status: 'start' | 'ok' | 'skip' | 'fail';
      durationMs: number;
      detail?: string;
    }>;
    totalDurationMs: number;
    extractionType?: string;
    extractionQuality?: string;
  };
  timestamp: number;
}

export class ExtractionLogDB {
  async log(entry: ExtractionLogEntry): Promise<void> {
    try {
      const db = await getDB();
      await db.put('extraction_log', entry as any);
    } catch (err) {
      debugLog('error', 'ExtractionLogDB.log failed', { error: err });
    }
  }

  async getAll(limit = 200): Promise<ExtractionLogEntry[]> {
    try {
      const db = await getDB();
      const all = await db.getAll('extraction_log');
      all.sort((a, b) => b.timestamp - a.timestamp);
      return all.slice(0, limit) as unknown as ExtractionLogEntry[];
    } catch (err) {
      debugLog('error', 'ExtractionLogDB.getAll failed', { error: err });
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await getDB();
      await db.clear('extraction_log');
    } catch (err) {
      debugLog('error', 'ExtractionLogDB.clear failed', { error: err });
    }
  }
}

export const extractionLogDB = new ExtractionLogDB();
