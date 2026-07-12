import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';

export class AITransactionLogDB {
  async logTransaction(tx: {
    id: string;
    type: string;
    provider: string;
    model: string;
    startTime: number;
    endTime?: number;
    status: string;
    metadata?: unknown;
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_transactions', tx);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logTransaction failed', { error: err });
    }
  }

  async getTransaction(id: string): Promise<
    | {
        id: string;
        type: string;
        provider: string;
        model: string;
        startTime: number;
        endTime?: number;
        status: string;
        metadata?: unknown;
      }
    | undefined
  > {
    try {
      const db = await getDB();
      return db.get('transaction_log_transactions', id);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.getTransaction failed', { error: err });
      return undefined;
    }
  }

  async logPromptTrace(trace: {
    id: string;
    transactionId: string;
    tokens: number;
    cached: boolean;
    truncated: boolean;
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_promptTraces', trace);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logPromptTrace failed', { error: err });
    }
  }

  async logToolTrace(trace: {
    id: string;
    transactionId: string;
    toolName: string;
    allowed: boolean;
    outcome: string;
    timestamp: number;
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_toolTraces', trace);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logToolTrace failed', { error: err });
    }
  }

  async logProviderTrace(trace: {
    id: string;
    transactionId: string;
    provider: string;
    attempts: number;
    circuitBreakerOpen: boolean;
    timestamp: number;
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_providerTraces', trace);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logProviderTrace failed', { error: err });
    }
  }
}

export const aiTransactionLogDB = new AITransactionLogDB();
