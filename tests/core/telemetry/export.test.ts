import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/core/storage/stores/AITransactionLogDB', () => ({
  aiTransactionLogDB: {
    getTraceTree: vi.fn(),
    queryTraces: vi.fn(),
  },
}));

describe('export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo('exportSingleTrace produces a JSON blob for one operation');
  it.todo('exportTraces assembles a ZIP bundle with manifest.json');
  it.todo('buildManifest creates manifest per D-18 spec');
  it.todo('privacy mode forces metadata-only export');
  it.todo('all export data passes through TraceRedactor before serialization');
  it.todo('export does not affect retention/pruning policy');
});
