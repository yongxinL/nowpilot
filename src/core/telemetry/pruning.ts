// =========================================================================
// pruning.ts — Tiered retention pruning with scheduled + debounced execution
//
// D-25: Hybrid retention (Time + Count), whichever exceeded first triggers pruning
// D-26: Tiered limits — transactions 30d/5000, normal traces 14d/2000, diag 7d/500, errors 30d/1000
// D-27: Failure-prioritized — failed/error records preserved, oldest successful pruned first
// D-29: Scheduled + Startup pruning — runs on startup and every 5 minutes
// D-33: Detailed success traces capped at 500, lightweight tx metadata retained longer
// D-36: Never blocks pipeline — runs asynchronously, debounced on transaction close
// =========================================================================

import { getDB } from '../storage/IndexedDBManager';
import { debugLog } from '../utils/debugLog';

// =========================================================================
// Retention config constants (D-26)
// =========================================================================
export const TRANSACTION_MAX = 5000;
export const TRANSACTION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const NORMAL_TRACE_MAX = 2000;
export const NORMAL_TRACE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export const DIAGNOSTIC_TRACE_MAX = 500;
export const DIAGNOSTIC_TRACE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const ERROR_MAX = 1000;
export const ERROR_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// =========================================================================
// Store configuration — maps store names to their retention policies
// =========================================================================
interface StoreConfig {
  name: string;
  maxCount: number;
  retentionMs: number;
}

const STORE_CONFIGS: StoreConfig[] = [
  // Transaction metadata: 30 days or 5,000 max
  { name: 'transaction_log_transactions', maxCount: TRANSACTION_MAX, retentionMs: TRANSACTION_RETENTION_MS },
  // Normal traces (prompt, tool, provider): 14 days or 2,000 max
  { name: 'transaction_log_promptTraces', maxCount: NORMAL_TRACE_MAX, retentionMs: NORMAL_TRACE_RETENTION_MS },
  { name: 'transaction_log_toolTraces', maxCount: NORMAL_TRACE_MAX, retentionMs: NORMAL_TRACE_RETENTION_MS },
  { name: 'transaction_log_providerTraces', maxCount: NORMAL_TRACE_MAX, retentionMs: NORMAL_TRACE_RETENTION_MS },
  // Extended trace stores: 14 days or 2,000 max
  { name: 'transaction_log_cacheTraces', maxCount: NORMAL_TRACE_MAX, retentionMs: NORMAL_TRACE_RETENTION_MS },
  { name: 'transaction_log_memoryTraces', maxCount: NORMAL_TRACE_MAX, retentionMs: NORMAL_TRACE_RETENTION_MS },
  { name: 'transaction_log_writeJournalTraces', maxCount: NORMAL_TRACE_MAX, retentionMs: NORMAL_TRACE_RETENTION_MS },
];

// =========================================================================
// Debounce state
// =========================================================================
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pruningInProgress = false;
let pendingPrune = false;
let pruneIntervalId: ReturnType<typeof setInterval> | null = null;

// =========================================================================
// Helper: check if a record should be preserved as a failure (D-27)
// =========================================================================
function isFailureRecord(record: Record<string, unknown>): boolean {
  const status = record.status;
  const severity = record.severity;
  return (
    status === 'failed' ||
    severity === 'ERROR' ||
    severity === 'CRITICAL'
  );
}

// =========================================================================
// Helper: get a comparable timestamp from a record (startedAt or timestamp)
// =========================================================================
function recordTime(record: Record<string, unknown>): number {
  return ((record as Record<string, unknown>).startedAt ?? (record as Record<string, unknown>).timestamp ?? 0) as number;
}

// =========================================================================
// pruneNow — Execute pruning for all trace stores
//
// For each store:
//   1. Count-limit check: if count > maxCount, sort by priority then timestamp,
//      keep failures + newest successes, delete the rest
//   2. Time-limit check: delete records older than retention period
//
// D-33: Success traces capped at maxCount (failures always preserved within limit)
// D-36: Runs asynchronously — never called synchronously from pipeline
// =========================================================================
export async function pruneNow(): Promise<void> {
  pruningInProgress = true;
  try {
    const db = await getDB();
    const now = Date.now();

    for (const config of STORE_CONFIGS) {
      try {
        // --- Step 1: Count-based pruning (failure-prioritized per D-27) ---
        const count = await db.count(config.name);
        if (count > config.maxCount) {
          const allRecords = await db.getAll(config.name);
          const records = allRecords as Array<Record<string, unknown>>;

          // Sort: failures first (preserved), then by timestamp ASC for failures (oldest first),
          // DESC for successes (newest first). This keeps failures + newest successes.
          records.sort((a, b) => {
            const aFail = isFailureRecord(a) ? 0 : 1;
            const bFail = isFailureRecord(b) ? 0 : 1;
            if (aFail !== bFail) return aFail - bFail;
            // For equal priority, sort by timestamp: failures ASC (oldest first in keep-group),
            // successes DESC (newest first in keep-group)
            if (aFail === 0) return recordTime(a) - recordTime(b);
            return recordTime(b) - recordTime(a);
          });

          // Keep the first maxCount records (failures + newest successes)
          const toDelete = records.slice(config.maxCount);
          if (toDelete.length > 0) {
            const idsToDelete = toDelete.map((r) => r.id as string);
            const tx = db.transaction(config.name, 'readwrite');
            for (const id of idsToDelete) {
              await tx.store.delete(id);
            }
            await tx.done;

            debugLog('debug', `[Pruning] Count-based: deleted ${idsToDelete.length} from ${config.name}`);
          }
        }

        // --- Step 2: Time-based pruning ---
        const allRecords = await db.getAll(config.name);
        const records = allRecords as Array<Record<string, unknown>>;
        const cutoff = now - config.retentionMs;
        const expired = records.filter((r) => recordTime(r) < cutoff);

        if (expired.length > 0) {
          const idsToDelete = expired.map((r) => r.id as string);
          const tx = db.transaction(config.name, 'readwrite');
          for (const id of idsToDelete) {
            await tx.store.delete(id);
          }
          await tx.done;

          debugLog('debug', `[Pruning] Time-based: deleted ${idsToDelete.length} from ${config.name}`);
        }
      } catch (storeErr) {
        // Per-store errors should not prevent pruning other stores
        debugLog('error', `[Pruning] Failed to prune store ${config.name}`, { error: storeErr });
      }
    }
  } finally {
    pruningInProgress = false;
    if (pendingPrune) {
      pendingPrune = false;
      // Schedule one additional run after current pruning completes
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        pruneNow();
      }, 0);
    }
  }
}

// =========================================================================
// scheduleDebouncedPrune — Debounced prune request
//
// D-36: Never blocks pipeline — runs asynchronously
// - If pruning is in progress: queues ONE additional run after completion
// - If debounce timer is active: resets the timer
// - If nothing is active: starts the debounce timer
// =========================================================================
export function scheduleDebouncedPrune(): void {
  if (pruningInProgress) {
    pendingPrune = true;
    return;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    pruneNow();
  }, 30_000);
}

// =========================================================================
// startPruning — Initialize the pruning lifecycle
//
// D-29: Runs immediately on startup, then every 5 minutes while active
// =========================================================================
export function startPruning(): void {
  // Run immediately on startup
  pruneNow();

  // Then every 5 minutes
  pruneIntervalId = setInterval(() => {
    pruneNow();
  }, 5 * 60 * 1000);
}

// =========================================================================
// Wire to AITransactionLog.schedulePrune hook (declared in 06-04)
//
// The export let schedulePrune from AITransactionLog is a mutable `let` binding.
// We use namespace import + property assignment to set it, since ESM direct
// import bindings are read-only. This works because `let` exports are mutable
// slots on the module namespace object in the JS engine.
// =========================================================================
import * as AITransactionLogModule from './AITransactionLog';
(AITransactionLogModule as unknown as { schedulePrune: (() => void) | null }).schedulePrune = scheduleDebouncedPrune;

// =========================================================================
// stopPruning — Clean up the pruning interval (for testing/cleanup)
// =========================================================================
export function stopPruning(): void {
  if (pruneIntervalId !== null) {
    clearInterval(pruneIntervalId);
    pruneIntervalId = null;
  }
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
