import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';
import type { AITransaction, PromptTrace, ToolTrace, ProviderTrace, CacheTrace, MemoryTrace, WriteJournalTrace, TraceTree } from '../../telemetry/types';

export class AITransactionLogDB {
  async logTransaction(tx: AITransaction): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_transactions', tx as any);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logTransaction failed', { error: err });
    }
  }

  async logPromptTrace(trace: PromptTrace): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_promptTraces', trace as any);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logPromptTrace failed', { error: err });
    }
  }

  async logToolTrace(trace: ToolTrace): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_toolTraces', trace as any);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logToolTrace failed', { error: err });
    }
  }

  async logProviderTrace(trace: ProviderTrace): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_providerTraces', trace as any);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logProviderTrace failed', { error: err });
    }
  }

  async logCacheTrace(trace: CacheTrace): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_cacheTraces', trace as any);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logCacheTrace failed', { error: err });
    }
  }

  async logMemoryTrace(trace: MemoryTrace): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_memoryTraces', trace as any);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logMemoryTrace failed', { error: err });
    }
  }

  async logWriteJournalTrace(trace: WriteJournalTrace): Promise<void> {
    try {
      const db = await getDB();
      await db.put('transaction_log_writeJournalTraces', trace as any);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.logWriteJournalTrace failed', { error: err });
    }
  }

  async getTransaction(id: string): Promise<AITransaction | undefined> {
    try {
      const db = await getDB();
      const result = await db.get('transaction_log_transactions', id);
      return result as AITransaction | undefined;
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.getTransaction failed', { error: err });
      return undefined;
    }
  }

  async getTraceTree(operationId: string): Promise<TraceTree | undefined> {
    try {
      const db = await getDB();
      const tx = await db.get('transaction_log_transactions', operationId);
      if (!tx) return undefined;

      const [promptTraces, toolTraces, providerTraces, cacheTraces, memoryTraces, writeJournalTraces] = await Promise.all([
        db.getAllFromIndex('transaction_log_promptTraces', 'by-operationId', operationId),
        db.getAllFromIndex('transaction_log_toolTraces', 'by-operationId', operationId),
        db.getAllFromIndex('transaction_log_providerTraces', 'by-operationId', operationId),
        db.getAllFromIndex('transaction_log_cacheTraces', 'by-operationId', operationId),
        db.getAllFromIndex('transaction_log_memoryTraces', 'by-operationId', operationId),
        db.getAllFromIndex('transaction_log_writeJournalTraces', 'by-operationId', operationId),
      ]);

      return {
        transaction: tx as unknown as AITransaction,
        promptTraces: promptTraces as unknown as PromptTrace[],
        toolTraces: toolTraces as unknown as ToolTrace[],
        providerTraces: providerTraces as unknown as ProviderTrace[],
        cacheTraces: cacheTraces as unknown as CacheTrace[],
        memoryTraces: memoryTraces as unknown as MemoryTrace[],
        writeJournalTraces: writeJournalTraces as unknown as WriteJournalTrace[],
      };
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.getTraceTree failed', { error: err });
      return undefined;
    }
  }

  async queryTransactions(filters: {
    types?: string[];
    statuses?: string[];
    providers?: string[];
    severities?: string[];
    dateRange?: [number, number];
    searchQuery?: string;
    limit?: number;
  }): Promise<AITransaction[]> {
    try {
      const db = await getDB();
      let results = await db.getAll('transaction_log_transactions');

      if (filters.types && filters.types.length > 0) {
        results = results.filter(tx => filters.types!.includes(tx.type));
      }
      if (filters.statuses && filters.statuses.length > 0) {
        results = results.filter(tx => filters.statuses!.includes(tx.status));
      }
      if (filters.providers && filters.providers.length > 0) {
        results = results.filter(tx => filters.providers!.includes(tx.providerId));
      }
      if (filters.severities && filters.severities.length > 0) {
        results = results.filter(tx => tx.severity && filters.severities!.includes(tx.severity));
      }
      if (filters.dateRange) {
        results = results.filter(tx => tx.startedAt >= filters.dateRange![0] && tx.startedAt <= filters.dateRange![1]);
      }
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        results = results.filter(tx =>
          tx.id.toLowerCase().includes(q) ||
          (tx.model && tx.model.toLowerCase().includes(q)) ||
          (tx.providerId && tx.providerId.toLowerCase().includes(q)) ||
          (tx.errorCode && tx.errorCode.toLowerCase().includes(q))
        );
      }

      results.sort((a, b) => b.startedAt - a.startedAt);

      if (filters.limit && results.length > filters.limit) {
        results = results.slice(0, filters.limit);
      }

      return results as unknown as AITransaction[];
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.queryTransactions failed', { error: err });
      return [];
    }
  }

  async getTotalCount(storeName: string): Promise<number> {
    try {
      const db = await getDB();
      return db.count(storeName as any);
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.getTotalCount failed', { error: err });
      return 0;
    }
  }

  async deleteTraces(storeName: string, ids: string[]): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction(storeName as any, 'readwrite');
      for (const id of ids) {
        await tx.store.delete(id);
      }
      await tx.done;
    } catch (err) {
      debugLog('error', 'AITransactionLogDB.deleteTraces failed', { error: err });
    }
  }
}

export const aiTransactionLogDB = new AITransactionLogDB();
