import { describe, it, expect, vi, beforeEach } from 'vitest';

// =========================================================================
// Mock infrastructure modules (vi.hoisted() for variable references)
// =========================================================================
const mockLogTransaction = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetTransaction = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockLogPromptTrace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockLogToolTrace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockLogProviderTrace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockLogCacheTrace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockLogMemoryTrace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockLogWriteJournalTrace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const mockBegin = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'journal-1', steps: [] }));
const mockMarkStepStart = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockMarkStepComplete = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockMarkCompleted = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockMarkFailed = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const mockRedact = vi.hoisted(() => vi.fn((s: string) => s));
const mockRedactObject = vi.hoisted(() => vi.fn((o: Record<string, unknown>) => ({ ...o })));
const mockRedactValue = vi.hoisted(() => vi.fn((v: unknown) => v));

vi.mock('../../../src/core/storage/stores/AITransactionLogDB', () => ({
  aiTransactionLogDB: {
    logTransaction: mockLogTransaction,
    getTransaction: mockGetTransaction,
    logPromptTrace: mockLogPromptTrace,
    logToolTrace: mockLogToolTrace,
    logProviderTrace: mockLogProviderTrace,
    logCacheTrace: mockLogCacheTrace,
    logMemoryTrace: mockLogMemoryTrace,
    logWriteJournalTrace: mockLogWriteJournalTrace,
  },
}));

vi.mock('../../../src/core/storage/WriteJournal', () => ({
  writeJournal: {
    begin: mockBegin,
    markStepStart: mockMarkStepStart,
    markStepComplete: mockMarkStepComplete,
    markCompleted: mockMarkCompleted,
    markFailed: mockMarkFailed,
  },
}));

vi.mock('../../../src/core/telemetry/TraceRedactor', () => ({
  traceRedactor: {
    redact: mockRedact,
    redactObject: mockRedactObject,
    redactValue: mockRedactValue,
  },
}));

// Import the class under test (will FAIL in RED phase — file doesn't exist yet)
import { AITransactionLog } from '../../../src/core/telemetry/AITransactionLog';
import {
  DefaultTraceCollector,
  Severity,
  TraceVerbosity,
} from '../../../src/core/telemetry/types';

describe('AITransactionLog', () => {
  let log: AITransactionLog;
  let collector: DefaultTraceCollector;
  let execCtx: {
    operationId: string;
    verbosity: TraceVerbosity;
    privacyMode: boolean;
    traceCollector: DefaultTraceCollector;
    abortSignal: AbortSignal;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    collector = new DefaultTraceCollector();
    execCtx = {
      operationId: 'op-123',
      verbosity: TraceVerbosity.NORMAL,
      privacyMode: false,
      traceCollector: collector,
      abortSignal: new AbortController().signal,
    };
    log = new AITransactionLog(
      {
        logTransaction: mockLogTransaction,
        getTransaction: mockGetTransaction,
        logPromptTrace: mockLogPromptTrace,
        logToolTrace: mockLogToolTrace,
        logProviderTrace: mockLogProviderTrace,
        logCacheTrace: mockLogCacheTrace,
        logMemoryTrace: mockLogMemoryTrace,
        logWriteJournalTrace: mockLogWriteJournalTrace,
      } as any,
      {
        redact: mockRedact,
        redactObject: mockRedactObject,
        redactValue: mockRedactValue,
      } as any,
      {
        begin: mockBegin,
        markStepStart: mockMarkStepStart,
        markStepComplete: mockMarkStepComplete,
        markCompleted: mockMarkCompleted,
        markFailed: mockMarkFailed,
      } as any,
    );
  });

  // =========================================================================
  // Test 1: start() writes minimal transaction record
  // =========================================================================
  it('start() calls db.logTransaction with status:started and correct operationId', async () => {
    await log.start('op-123', execCtx);

    expect(mockLogTransaction).toHaveBeenCalledTimes(1);
    const tx = mockLogTransaction.mock.calls[0][0];
    expect(tx.id).toBe('op-123');
    expect(tx.status).toBe('started');
    expect(tx.verbosity).toBe(TraceVerbosity.NORMAL);
    expect(tx.privacyMode).toBe(false);
    expect(typeof tx.startedAt).toBe('number');
  });

  // =========================================================================
  // Test 2: complete() persists all traces and calls WriteJournal lifecycle
  // =========================================================================
  it('complete() sets status:completed, calls db to persist all traces, calls writeJournal lifecycle', async () => {
    // Emit a trace event during the transaction
    collector.onPlannerCall({
      promptHash: 'abc123',
      tokenBreakdown: {
        system: 100, memory: 0, tools: 0, context: 0,
        history: 0, user: 50, output: 200, total: 350,
      },
      contextTier: 'medium',
      truncated: false,
      minimalMode: false,
      cacheStats: { sectionsMarked: 2, estimatedSavings: 100 },
      timestamp: Date.now(),
      source: 'planner',
    });

    await log.start('op-123', execCtx);
    await log.complete('op-123', collector);

    // WriteJournal lifecycle should have been invoked
    expect(mockBegin).toHaveBeenCalledTimes(1);
    expect(mockBegin).toHaveBeenCalledWith(
      'transaction-log-batch',
      expect.objectContaining({ transaction_log_transactions: 'op-123' }),
      expect.any(Array),
    );
    expect(mockMarkStepStart).toHaveBeenCalled();
    expect(mockMarkStepComplete).toHaveBeenCalled();
    expect(mockMarkCompleted).toHaveBeenCalled();

    // Transaction update with completed status should have been persisted
    expect(mockLogTransaction).toHaveBeenCalledTimes(2); // start + complete
    const updateCall = mockLogTransaction.mock.calls[1][0];
    expect(updateCall.status).toBe('completed');
    expect(typeof updateCall.endedAt).toBe('number');
    expect(typeof updateCall.durationMs).toBe('number');
  });

  // =========================================================================
  // Test 3: fail() records error and persists traces
  // =========================================================================
  it('fail() sets status:failed with error details, still persists all traces', async () => {
    const error = new Error('Provider timeout');
    collector.onPlannerCall({
      promptHash: 'abc123',
      tokenBreakdown: {
        system: 100, memory: 0, tools: 0, context: 0,
        history: 0, user: 50, output: 200, total: 350,
      },
      contextTier: 'medium',
      truncated: false,
      minimalMode: false,
      cacheStats: { sectionsMarked: 0, estimatedSavings: 0 },
      timestamp: Date.now(),
      source: 'planner',
    });

    await log.start('op-123', execCtx);
    await log.fail('op-123', error, collector);

    // Error details in transaction
    const updateCall = mockLogTransaction.mock.calls[1][0];
    expect(updateCall.status).toBe('failed');
    expect(updateCall.errorCode).toBe('Provider timeout');

    // Traces still persisted via WriteJournal
    expect(mockBegin).toHaveBeenCalledTimes(1);
    expect(mockMarkCompleted).toHaveBeenCalled();
  });

  // =========================================================================
  // Test 4: Redaction before persistence (D-08 verification)
  // =========================================================================
  it('traces are redacted before db.put() — raw keys do NOT reach db mock', async () => {
    collector.onPlannerCall({
      promptHash: 'abc123',
      tokenBreakdown: {
        system: 100, memory: 0, tools: 0, context: 0,
        history: 0, user: 50, output: 200, total: 350,
      },
      contextTier: 'medium',
      truncated: false,
      minimalMode: false,
      cacheStats: { sectionsMarked: 0, estimatedSavings: 0 },
      timestamp: Date.now(),
      source: 'planner',
    });

    await log.start('op-123', execCtx);
    await log.complete('op-123', collector);

    // redactObject should have been called on events before db writes
    expect(mockRedactObject).toHaveBeenCalled();
  });

  // =========================================================================
  // Test 5: clear() empties TraceCollector after persistence
  // =========================================================================
  it('close() clears TraceCollector after persistence via collector.clear()', async () => {
    collector.onPlannerCall({
      promptHash: 'abc123',
      tokenBreakdown: {
        system: 100, memory: 0, tools: 0, context: 0,
        history: 0, user: 50, output: 200, total: 350,
      },
      contextTier: 'medium',
      truncated: false,
      minimalMode: false,
      cacheStats: { sectionsMarked: 0, estimatedSavings: 0 },
      timestamp: Date.now(),
      source: 'planner',
    });

    expect(collector.getAllEvents()).toHaveLength(1);

    await log.start('op-123', execCtx);
    await log.complete('op-123', collector);

    // After close, collector should be cleared
    expect(collector.getAllEvents()).toHaveLength(0);
  });

  // =========================================================================
  // Test 6: recoverOrphanedTransactions marks started/streaming as aborted
  // =========================================================================
  it('recoverOrphanedTransactions() marks started/streaming transactions as aborted', async () => {
    const mockGetAll = vi.fn();
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const mockDb = {
      getAll: mockGetAll,
      put: mockPut,
    };

    mockGetAll.mockResolvedValue([
      { id: 'tx-1', status: 'started', startedAt: 1000 },
      { id: 'tx-2', status: 'streaming', startedAt: 2000 },
      { id: 'tx-3', status: 'completed', startedAt: 3000 },
    ]);

    await AITransactionLog.recoverOrphanedTransactions(mockDb as any);

    // Only started/streaming should be updated (2 of 3)
    expect(mockPut).toHaveBeenCalledTimes(2);

    const updatedTx1 = mockPut.mock.calls[0][0];
    expect(updatedTx1.status).toBe('aborted');
    expect(updatedTx1.severity).toBe(Severity.WARNING);
    expect(typeof updatedTx1.endedAt).toBe('number');

    const updatedTx2 = mockPut.mock.calls[1][0];
    expect(updatedTx2.status).toBe('aborted');
    expect(updatedTx2.severity).toBe(Severity.WARNING);

    // completed transaction was skipped
    expect(mockPut.mock.calls.map((c: any[]) => c[0].id)).not.toContain('tx-3');
  });

  // =========================================================================
  // Test 7: severity computed as worst among all events (D-32)
  // =========================================================================
  it('severity is computed as worst among all collected trace events (D-32)', async () => {
    // Emit a failed tool execution — should result in at least ERROR severity
    collector.onToolExecution({
      toolName: 'test_tool',
      source: 'built-in',
      dangerous: false,
      permissionDecision: 'allowed',
      status: 'failed',
      errorMessage: 'Something went wrong',
      durationMs: 100,
      timestamp: Date.now(),
    });

    await log.start('op-123', execCtx);
    await log.complete('op-123', collector);

    const updateCall = mockLogTransaction.mock.calls[1][0];
    expect(updateCall.severity).toBeDefined();
    // CRITICAL > ERROR > WARNING > INFO > DEBUG
    const severityOrder = [Severity.CRITICAL, Severity.ERROR, Severity.WARNING, Severity.INFO, Severity.DEBUG];
    const sevIdx = severityOrder.indexOf(updateCall.severity);
    expect(sevIdx).toBeGreaterThanOrEqual(0);
    expect(sevIdx).toBeLessThanOrEqual(severityOrder.indexOf(Severity.ERROR));
  });

  // =========================================================================
  // Test 8: WriteJournal lifecycle ordering
  // =========================================================================
  it('batch-write uses WriteJournal begin/markStepStart/markStepComplete/markCompleted in order', async () => {
    collector.onPlannerCall({
      promptHash: 'abc123',
      tokenBreakdown: {
        system: 100, memory: 0, tools: 0, context: 0,
        history: 0, user: 50, output: 200, total: 350,
      },
      contextTier: 'medium',
      truncated: false,
      minimalMode: false,
      cacheStats: { sectionsMarked: 0, estimatedSavings: 0 },
      timestamp: Date.now(),
      source: 'planner',
    });

    // Track call order with a sequence counter
    const callSequence: string[] = [];
    mockBegin.mockImplementation(async () => {
      callSequence.push('begin');
      return { id: 'journal-1', steps: [] };
    });
    mockMarkStepStart.mockImplementation(async () => {
      callSequence.push('markStepStart');
    });
    mockMarkStepComplete.mockImplementation(async () => {
      callSequence.push('markStepComplete');
    });
    mockMarkCompleted.mockImplementation(async () => {
      callSequence.push('markCompleted');
    });
    mockLogTransaction.mockImplementation(async () => {
      callSequence.push('logTransaction');
    });

    await log.start('op-123', execCtx);
    await log.complete('op-123', collector);

    // Verify begin comes before markStepStart, etc.
    const beginIdx = callSequence.indexOf('begin');
    const markStepStartIdx = callSequence.indexOf('markStepStart');
    const markStepCompleteIdx = callSequence.indexOf('markStepComplete');
    const markCompletedIdx = callSequence.indexOf('markCompleted');

    expect(beginIdx).toBeLessThan(markStepStartIdx);
    expect(markStepStartIdx).toBeLessThan(markStepCompleteIdx);
    expect(markStepCompleteIdx).toBeLessThan(markCompletedIdx);
  });
});
