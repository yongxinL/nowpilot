import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogTransaction = vi.hoisted(() => vi.fn());
const mockGetTransaction = vi.hoisted(() => vi.fn());
const mockBegin = vi.hoisted(() => vi.fn());
const mockMarkStepStart = vi.hoisted(() => vi.fn());
const mockMarkStepComplete = vi.hoisted(() => vi.fn());
const mockMarkCompleted = vi.hoisted(() => vi.fn());
const mockMarkFailed = vi.hoisted(() => vi.fn());

vi.mock('../../../src/core/storage/stores/AITransactionLogDB', () => ({
  aiTransactionLogDB: {
    logTransaction: mockLogTransaction,
    getTransaction: mockGetTransaction,
  },
}));

import { afterEach } from 'vitest';

describe('AITransactionLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo('start() writes a minimal transaction record with status started');
  it.todo('complete() redacts traces and batch-writes via WriteJournal');
  it.todo('fail() records error, redacts, and batch-writes');
  it.todo('close() collects all events from TraceCollector before persisting');
  it.todo('computes severity as worst among all traces on close');
  it.todo('recoverOrphanedTransactions marks started/streaming as aborted');
  it.todo('late-arriving traces after close are handled gracefully');
});
