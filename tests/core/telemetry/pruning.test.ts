import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/core/storage/IndexedDBManager', () => ({
  getDB: vi.fn(),
}));

describe('pruning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo('pruneNow removes transactions exceeding count limit (5000)');
  it.todo('pruneNow removes transactions exceeding time limit (30 days)');
  it.todo('failure-prioritized pruning keeps failed records, prunes oldest successes');
  it.todo('pruneNow handles prompt/tool/provider trace stores with 14-day / 2000 limits');
  it.todo('pruneNow handles diagnostic traces with 7-day / 500 limits');
  it.todo('scheduleDebouncedPrune debounces to 30 seconds');
  it.todo('startPruning runs immediately and sets up 5-minute interval');
});
