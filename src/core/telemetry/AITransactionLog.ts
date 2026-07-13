// =========================================================================
// AITransactionLog — Orchestration class for the full transaction lifecycle
//
// Hybrid checkpoint + batch-write architecture (D-03):
//   - start()  writes a minimal transaction record (status:started)
//   - During execution, services emit typed traces to TraceCollector (in-memory)
//   - complete/fail call close(), which:
//       1. Collects all in-memory events
//       2. Truncates payload content per D-34
//       3. Redacts all event data via TraceRedactor middleware (D-08/D-09)
//       4. Batch-writes via WriteJournal for crash-safe consistency
//       5. Clears the collector
//       6. Schedules debounced prune
//
// Crash recovery (D-03):
//   - recoverOrphanedTransactions() scans for started/streaming → marks aborted
//
// Constructor DI pattern matching ContextOptimizer/MemoryEngine analog.
// =========================================================================

import { debugLog } from '../utils/debugLog';
import { aiTransactionLogDB } from '../storage/stores/AITransactionLogDB';
import { traceRedactor } from './TraceRedactor';
import { writeJournal } from '../storage/WriteJournal';
import type { AITransactionLogDB } from '../storage/stores/AITransactionLogDB';
import type { TraceRedactor } from './TraceRedactor';
import type { WriteJournal } from '../storage/WriteJournal';
import type {
  AITransaction,
  TraceCollector,
  TraceEvent,
  ExecutionContext,
  PromptTrace,
  ToolTrace,
  ProviderTrace,
  CacheTrace,
  MemoryTrace,
  WriteJournalTrace,
} from './types';
import {
  Severity,
  TraceVerbosity,
} from './types';

// =========================================================================
// Severity ordering: lower index = more severe
// Used by computeSeverity() and worstOf()
// =========================================================================
const SEVERITY_ORDER: Severity[] = [
  Severity.CRITICAL,
  Severity.ERROR,
  Severity.WARNING,
  Severity.INFO,
  Severity.DEBUG,
];

// =========================================================================
// Payload truncation helper (D-34)
// Truncates a string to a maximum byte-length approximation.
// Currently uses character-length for simplicity; respects byte boundaries
// in future phases when multi-byte UTF-8 handling is needed.
// =========================================================================
function truncateToBytes(str: string, maxBytes: number): string {
  // Simple character-based truncation (conservative for ASCII-heavy content)
  return str.slice(0, maxBytes);
}

// =========================================================================
// schedulePrune hook — pruning.ts (06-05) will assign this
// =========================================================================
export let schedulePrune: (() => void) | null = null;

/**
 * Map a single TraceEvent to its Severity level per D-31 classification.
 *
 * Severity Classification (D-31):
 *   CRITICAL — storage/journal failures (not applicable at event level)
 *   ERROR    — tool validation failure, provider unreachable (all fallbacks exhausted)
 *   WARNING  — provider timeout (retried), rate limit hit, circuit breaker opened,
 *              tool timeout, tool aborted
 *   INFO     — cache hit/miss, degradation step applied, memory extraction completed,
 *              transaction completed, planner/renderer calls
 *   DEBUG    — raw trace detail (not used at this level)
 */
function eventSeverity(event: TraceEvent): Severity {
  switch (event.type) {
    case 'tool_execution': {
      const { status } = event.data;
      if (status === 'failed') return Severity.ERROR;
      if (status === 'timeout' || status === 'aborted') return Severity.WARNING;
      return Severity.INFO;
    }
    case 'provider_attempt': {
      const { outcome } = event.data;
      if (outcome === 'error') return Severity.ERROR;
      if (outcome === 'timeout' || outcome === 'rate_limited' || outcome === 'circuit_open') {
        return Severity.WARNING;
      }
      return Severity.INFO;
    }
    default:
      return Severity.INFO;
  }
}

/**
 * Return the more severe of two severity values.
 */
function worstOf(a: Severity, b: Severity): Severity {
  const aIdx = SEVERITY_ORDER.indexOf(a);
  const bIdx = SEVERITY_ORDER.indexOf(b);
  return aIdx <= bIdx ? a : b;
}

// =========================================================================
// AITransactionLog Class
// =========================================================================

export class AITransactionLog {
  constructor(
    private db: AITransactionLogDB,
    private redactor: TraceRedactor,
    private writeJournal: WriteJournal,
  ) {}

  /**
   * Start a transaction by writing a minimal record with status:started.
   * Full metadata (sessionId, conversationId, etc.) will be populated by
   * AgentOrchestrator (06-06) on completion.
   */
  async start(operationId: string, execCtx: ExecutionContext): Promise<void> {
    const tx: AITransaction = {
      id: operationId,
      sessionId: '',
      conversationId: '',
      workspaceId: '',
      activeSurface: 'sidepanel',
      userTurnId: '',
      type: 'chat',
      status: 'started',
      providerId: '',
      model: '',
      startedAt: Date.now(),
      verbosity: execCtx.verbosity,
      privacyMode: execCtx.privacyMode,
    };

    try {
      await this.db.logTransaction(tx);
      debugLog('debug', '[AITransactionLog] Transaction started', { operationId });
    } catch (err) {
      debugLog('error', '[AITransactionLog] Failed to start transaction', {
        operationId,
        error: err,
      });
      throw err;
    }
  }

  /**
   * Complete a transaction with status:completed.
   * Computes severity as the worst among all collected trace events,
   * then delegates to close() for redaction and batch-write.
   */
  async complete(operationId: string, collector: TraceCollector): Promise<void> {
    const existingTx = await this.db.getTransaction(operationId);
    const now = Date.now();
    const events = collector.getAllEvents();
    const severity = this.computeSeverity(events);

    const updates: Partial<AITransaction> = {
      status: 'completed' as const,
      endedAt: now,
      durationMs: existingTx ? now - existingTx.startedAt : 0,
      severity,
    };

    await this.close(operationId, collector, existingTx, updates);
  }

  /**
   * Fail a transaction with status:failed.
   * severity is at minimum ERROR (may be higher if events include critical traces).
   * Error details are recorded and all accumulated traces are still persisted.
   */
  async fail(
    operationId: string,
    error: unknown,
    collector: TraceCollector,
  ): Promise<void> {
    const existingTx = await this.db.getTransaction(operationId);
    const now = Date.now();
    const events = collector.getAllEvents();
    const eventsSeverity = this.computeSeverity(events);
    // fail() always reports at minimum ERROR
    const severity = worstOf(eventsSeverity, Severity.ERROR);

    const errorMessage = error instanceof Error ? error.message : String(error);

    const updates: Partial<AITransaction> = {
      status: 'failed' as const,
      endedAt: now,
      durationMs: existingTx ? now - existingTx.startedAt : 0,
      errorCode: errorMessage,
      severity,
    };

    await this.close(operationId, collector, existingTx, updates);
  }

  /**
   * Core close logic:
   * 1. Truncate payload content (D-34)
   * 2. Redact all events via TraceRedactor (D-08/D-09)
   * 3. Batch-write via WriteJournal
   * 4. Clear collector
   * 5. Schedule debounced prune
   */
  private async close(
    operationId: string,
    collector: TraceCollector,
    existingTx: AITransaction | undefined,
    finalTx: Partial<AITransaction>,
  ): Promise<void> {
    const events = collector.getAllEvents();

    // Step 1: Truncate payload content per D-34 before redaction
    const truncatedEvents = this.truncateEvents(events);

    // Step 2: Redact all events before persistence
    const redactedEvents: TraceEvent[] = truncatedEvents.map((event) => {
      const data = this.redactor.redactObject(event.data as unknown as Record<string, unknown>);
      return { ...event, data } as unknown as TraceEvent;
    });

    // Merge finalTx into existing transaction record for persistence
    const mergedTx: AITransaction = {
      ...(existingTx ?? {
        id: operationId,
        sessionId: '',
        conversationId: '',
        workspaceId: '',
        activeSurface: 'sidepanel' as const,
        userTurnId: '',
        type: 'chat' as const,
        status: 'started' as const,
        providerId: '',
        model: '',
        startedAt: Date.now(),
        verbosity: TraceVerbosity.NORMAL,
        privacyMode: false,
      }),
      ...finalTx,
      id: operationId,
    };

    // Categorize events into per-type batches
    const promptTraces = redactedEvents
      .filter((e): e is TraceEvent & { data: PromptTrace } =>
        e.type === 'planner_call' || e.type === 'renderer_call')
      .map((e) => e.data);

    const toolTraces = redactedEvents
      .filter((e): e is TraceEvent & { data: ToolTrace } =>
        e.type === 'tool_execution')
      .map((e) => e.data);

    const providerAttempts = redactedEvents
      .filter((e): e is TraceEvent & { data: import('./types').ProviderAttempt } =>
        e.type === 'provider_attempt')
      .map((e) => e.data);

    const cacheTraces = redactedEvents
      .filter((e): e is TraceEvent & { data: CacheTrace } =>
        e.type === 'cache_event')
      .map((e) => e.data);

    const memoryTraces = redactedEvents
      .filter((e): e is TraceEvent & { data: MemoryTrace } =>
        e.type === 'memory_event')
      .map((e) => e.data);

    const journalTraces = redactedEvents
      .filter((e): e is TraceEvent & { data: WriteJournalTrace } =>
        e.type === 'write_journal_event')
      .map((e) => e.data);

    // Build a single ProviderTrace from all attempts
    const providerTrace: ProviderTrace | undefined = providerAttempts.length > 0
      ? {
          id: crypto.randomUUID(),
          operationId,
          attempts: providerAttempts,
          resolvedProviderId: providerAttempts[providerAttempts.length - 1]?.providerId ?? '',
          resolvedModel: providerAttempts[providerAttempts.length - 1]?.model ?? '',
          totalDurationMs: providerAttempts.reduce((sum, a) => sum + a.durationMs, 0),
          timestamp: Date.now(),
        }
      : undefined;

    // Step 3: WriteJournal-coordinated batch write
    const journal = await this.writeJournal.begin(
      'transaction-log-batch' as any,
      { transaction_log_transactions: operationId },
      [
        { name: 'write-transaction' },
        { name: 'write-prompt-traces' },
        { name: 'write-tool-traces' },
        { name: 'write-provider-traces' },
        { name: 'write-cache-traces' },
        { name: 'write-memory-traces' },
        { name: 'write-journal-traces' },
      ],
    );

    try {
      // Step 0: Update transaction
      await this.writeJournal.markStepStart(journal.id, 0);
      await this.db.logTransaction(mergedTx);
      await this.writeJournal.markStepComplete(journal.id, 0);

      // Step 1: Write prompt traces
      if (promptTraces.length > 0) {
        await this.writeJournal.markStepStart(journal.id, 1);
        for (const pt of promptTraces) {
          await this.db.logPromptTrace(pt);
        }
        await this.writeJournal.markStepComplete(journal.id, 1);
      }

      // Step 2: Write tool traces
      if (toolTraces.length > 0) {
        await this.writeJournal.markStepStart(journal.id, 2);
        for (const tt of toolTraces) {
          await this.db.logToolTrace(tt);
        }
        await this.writeJournal.markStepComplete(journal.id, 2);
      }

      // Step 3: Write provider traces
      if (providerTrace) {
        await this.writeJournal.markStepStart(journal.id, 3);
        await this.db.logProviderTrace(providerTrace);
        await this.writeJournal.markStepComplete(journal.id, 3);
      }

      // Step 4: Write cache traces
      if (cacheTraces.length > 0) {
        await this.writeJournal.markStepStart(journal.id, 4);
        for (const ct of cacheTraces) {
          await this.db.logCacheTrace(ct);
        }
        await this.writeJournal.markStepComplete(journal.id, 4);
      }

      // Step 5: Write memory traces
      if (memoryTraces.length > 0) {
        await this.writeJournal.markStepStart(journal.id, 5);
        for (const mt of memoryTraces) {
          await this.db.logMemoryTrace(mt);
        }
        await this.writeJournal.markStepComplete(journal.id, 5);
      }

      // Step 6: Write write-journal traces
      if (journalTraces.length > 0) {
        await this.writeJournal.markStepStart(journal.id, 6);
        for (const jt of journalTraces) {
          await this.db.logWriteJournalTrace(jt);
        }
        await this.writeJournal.markStepComplete(journal.id, 6);
      }

      await this.writeJournal.markCompleted(journal.id);
      debugLog('info', '[AITransactionLog] Transaction closed', {
        operationId,
        status: finalTx.status,
        eventCount: events.length,
      });
    } catch (err) {
      await this.writeJournal.markFailed(journal.id);
      debugLog('error', '[AITransactionLog] Transaction close failed', {
        operationId,
        error: err,
      });
      throw err;
    } finally {
      // Step 4 & 5: Clear collector and schedule prune
      collector.clear();
      try {
        schedulePrune?.();
      } catch {
        // Pruning is best-effort; never throw from close()
      }
    }
  }

  /**
   * Compute the worst severity among all collected trace events (D-32).
   */
  private computeSeverity(events: TraceEvent[]): Severity {
    if (events.length === 0) return Severity.INFO;

    let worstIdx = SEVERITY_ORDER.length - 1; // Start at DEBUG (least severe)

    for (const event of events) {
      const sev = eventSeverity(event);
      const idx = SEVERITY_ORDER.indexOf(sev);
      if (idx < worstIdx) {
        worstIdx = idx;
      }
      if (worstIdx === 0) break; // CRITICAL is the worst possible
    }

    return SEVERITY_ORDER[worstIdx];
  }

  /**
   * Truncate event payload content per D-34 retention limits.
   * In the current implementation, PromptTrace and ToolTrace carry
   * metadata (hashes, breakdowns, schema shapes) rather than raw content,
   * so truncation is a no-op at this layer. The structure exists for
   * future phases when raw content fields are added.
   */
  private truncateEvents(events: TraceEvent[]): TraceEvent[] {
    return events;
  }

  /**
   * Recover orphaned transactions at startup.
   * Scans all transactions with status 'started' or 'streaming' and
   * marks them as 'aborted' with WARNING severity (D-03 crash recovery).
   *
   * @param db - An object with getAll and put methods (duck-typed for
   *             testability). In production, pass aiTransactionLogDB.
   */
  static async recoverOrphanedTransactions(db: {
    getAll(storeName?: string): Promise<unknown[]>;
    put(storeName: string, value: unknown): Promise<void>;
  }): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all = (await db.getAll()) as any[];
      const orphaned = all.filter(
        (tx: any) => tx.status === 'started' || tx.status === 'streaming',
      );

      for (const tx of orphaned) {
        tx.status = 'aborted';
        tx.endedAt = Date.now();
        tx.severity = Severity.WARNING;
        await db.put('transaction_log_transactions', tx);
      }

      if (orphaned.length > 0) {
        debugLog('warn', '[AITransactionLog] Recovered orphaned transactions', {
          count: orphaned.length,
          ids: orphaned.map((t: any) => t.id),
        });
      }
    } catch (err) {
      debugLog('error', '[AITransactionLog] recoverOrphanedTransactions failed', {
        error: err,
      });
    }
  }
}

// =========================================================================
// Singleton export for app-wide use
// =========================================================================
export const aiTransactionLog = new AITransactionLog(
  aiTransactionLogDB,
  traceRedactor,
  writeJournal,
);
