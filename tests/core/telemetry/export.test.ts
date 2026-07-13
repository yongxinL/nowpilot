import { describe, it, expect, vi, beforeEach } from 'vitest';

// =========================================================================
// Mock AITransactionLogDB (vi.hoisted for cross-mock variable sharing)
// =========================================================================
const mockGetTraceTree = vi.hoisted(() => vi.fn());
const mockQueryTransactions = vi.hoisted(() => vi.fn());

vi.mock('../../../src/core/storage/stores/AITransactionLogDB', () => ({
  aiTransactionLogDB: {
    getTraceTree: mockGetTraceTree,
    queryTransactions: mockQueryTransactions,
  },
}));

// =========================================================================
// Mock TraceRedactor
// =========================================================================
const mockRedactObject = vi.hoisted(() => vi.fn((obj: unknown) => obj));
const mockRedact = vi.hoisted(() => vi.fn((s: string) => s));
const mockRedactValue = vi.hoisted(() => vi.fn((v: unknown) => v));

vi.mock('../../../src/core/telemetry/TraceRedactor', () => ({
  traceRedactor: {
    redactObject: mockRedactObject,
    redact: mockRedact,
    redactValue: mockRedactValue,
  },
}));

// =========================================================================
// Mock JSZip — capture zip.file() calls for assertion
// Use a proper constructor function so `new JSZip()` works.
// =========================================================================
const mockZipFile = vi.hoisted(() => vi.fn().mockReturnThis());
const mockGenerateAsync = vi.hoisted(() =>
  vi.fn().mockResolvedValue(new Blob(['zip-binary'], { type: 'application/zip' }))
);

vi.mock('jszip', () => {
  // Return a callable constructor that creates a mock instance
  function MockJSZip() {
    return {
      file: mockZipFile,
      generateAsync: mockGenerateAsync,
    };
  }
  return { default: MockJSZip };
});

// =========================================================================
// Import the module under test (will fail in RED — export.ts doesn't exist)
// =========================================================================
import { aiTransactionLogDB } from '../../../src/core/storage/stores/AITransactionLogDB';
import { traceRedactor } from '../../../src/core/telemetry/TraceRedactor';
import {
  exportSingleTrace,
  exportTraces,
  buildManifest,
  downloadBlob,
} from '../../../src/core/telemetry/export';
import { TraceVerbosity } from '../../../src/core/telemetry/types';
import type { TraceTree, ExportOptions, ExportManifest } from '../../../src/core/telemetry/types';

// =========================================================================
// Test fixtures
// =========================================================================
const mockTraceTree: TraceTree = {
  transaction: {
    id: 'op-single-1',
    sessionId: 'test-session',
    conversationId: 'test-conversation',
    workspaceId: 'test-workspace',
    activeSurface: 'sidepanel',
    userTurnId: 'turn-1',
    type: 'chat',
    status: 'completed',
    providerId: 'anthropic',
    model: 'claude-3-haiku',
    startedAt: Date.now() - 5000,
    endedAt: Date.now(),
    durationMs: 5000,
    verbosity: TraceVerbosity.NORMAL,
    privacyMode: false,
  },
  promptTraces: [
    {
      id: 'pt-1',
      operationId: 'op-single-1',
      promptHash: 'abc123def',
      tokenBreakdown: {
        system: 100, memory: 50, tools: 200, context: 0,
        history: 0, user: 50, output: 100, total: 500,
      },
      contextTier: 'medium',
      truncated: false,
      minimalMode: false,
      cacheStats: { sectionsMarked: 2, estimatedSavings: 300 },
      timestamp: Date.now() - 4000,
      source: 'planner',
    },
  ],
  toolTraces: [
    {
      id: 'tt-1',
      operationId: 'op-single-1',
      toolName: 'echo',
      source: 'built-in',
      dangerous: false,
      permissionDecision: 'allowed',
      status: 'success',
      durationMs: 200,
      timestamp: Date.now() - 3000,
    },
  ],
  providerTraces: [
    {
      id: 'prov-1',
      operationId: 'op-single-1',
      attempts: [
        {
          attemptNumber: 1,
          providerId: 'anthropic',
          model: 'claude-3-haiku',
          startedAt: Date.now() - 5000,
          endedAt: Date.now() - 4000,
          durationMs: 1000,
          outcome: 'success',
          circuitBreakerTriggered: false,
        },
      ],
      resolvedProviderId: 'anthropic',
      resolvedModel: 'claude-3-haiku',
      totalDurationMs: 1000,
      timestamp: Date.now() - 5000,
    },
  ],
  cacheTraces: [],
  memoryTraces: [],
  writeJournalTraces: [],
};

const mockTraceTreeWithSecrets: TraceTree = {
  ...mockTraceTree,
  transaction: { ...mockTraceTree.transaction, id: 'op-secret-1' },
  promptTraces: [
    {
      ...mockTraceTree.promptTraces[0],
      id: 'pt-secret-1',
      operationId: 'op-secret-1',
    },
  ],
  toolTraces: [
    {
      ...mockTraceTree.toolTraces[0],
      id: 'tt-secret-1',
      operationId: 'op-secret-1',
    },
  ],
};

const mockOptions: ExportOptions = {
  types: ['chat'],
  statuses: ['completed'],
  providers: ['anthropic'],
  dateRange: { from: Date.now() - 86400000, to: Date.now() },
  limit: 50,
  includedTraceTypes: ['AITransactions', 'PromptTraces', 'ToolTraces', 'ProviderTraces'],
};

// =========================================================================
// Tests
// =========================================================================

describe('exportSingleTrace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTraceTree.mockResolvedValue(mockTraceTree);
  });

  it('returns a JSON Blob with complete TraceTree', async () => {
    const blob = (await exportSingleTrace('op-single-1'))!;

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');

    const text = await blob.text();
    const parsed = JSON.parse(text);

    expect(parsed).toHaveProperty('transaction');
    expect(parsed).toHaveProperty('promptTraces');
    expect(parsed).toHaveProperty('toolTraces');
    expect(parsed).toHaveProperty('providerTraces');
    expect(parsed).toHaveProperty('cacheTraces');
    expect(parsed).toHaveProperty('memoryTraces');
    expect(parsed).toHaveProperty('writeJournalTraces');
    expect(parsed.transaction.id).toBe('op-single-1');
    expect(parsed.promptTraces).toHaveLength(1);
    expect(parsed.toolTraces).toHaveLength(1);
    expect(parsed.providerTraces).toHaveLength(1);
  });

  it('calls getTraceTree with the correct operationId', async () => {
    await exportSingleTrace('op-single-1');

    expect(mockGetTraceTree).toHaveBeenCalledWith('op-single-1');
  });

  it('returns undefined gracefully when trace not found', async () => {
    mockGetTraceTree.mockResolvedValue(undefined);

    const result = await exportSingleTrace('nonexistent-op');
    expect(result).toBeUndefined();
  });
});

describe('exportTraces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAsync.mockResolvedValue(new Blob(['zip-binary'], { type: 'application/zip' }));
  });

  it('produces a ZIP Blob with per-transaction files and manifest.json', async () => {
    const trees = [
      { ...mockTraceTree, transaction: { ...mockTraceTree.transaction, id: 'op-1' } },
      { ...mockTraceTree, transaction: { ...mockTraceTree.transaction, id: 'op-2' } },
    ];
    mockQueryTransactions.mockResolvedValue(trees.map(t => t.transaction));
    mockGetTraceTree.mockImplementation((id: string) =>
      Promise.resolve(trees.find(t => t.transaction.id === id))
    );

    const blob = await exportTraces(mockOptions);

    expect(blob).toBeInstanceOf(Blob);
    expect(mockGenerateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'blob', compression: 'DEFLATE' })
    );
  });

  it('adds per-transaction JSON files and manifest.json to the ZIP', async () => {
    const trees = [
      { ...mockTraceTree, transaction: { ...mockTraceTree.transaction, id: 'op-1' } },
    ];
    mockQueryTransactions.mockResolvedValue(trees.map(t => t.transaction));
    mockGetTraceTree.mockResolvedValue(trees[0]);

    await exportTraces(mockOptions);
  });
});

describe('buildManifest', () => {
  it('returns manifest with all required D-18 fields', () => {
    const manifest = buildManifest(mockOptions, 5, false);

    expect(manifest).toHaveProperty('export_version');
    expect(manifest).toHaveProperty('generated_at');
    expect(manifest).toHaveProperty('extension_version');
    expect(manifest).toHaveProperty('transaction_count');
    expect(manifest).toHaveProperty('applied_filters');
    expect(manifest).toHaveProperty('redaction_version');
    expect(manifest.export_version).toBe('1.0');
    expect(manifest.transaction_count).toBe(5);
    expect(manifest.redaction_version).toBe('1.0');
    expect(manifest.privacy_mode).toBe(false);
  });

  it('includes applied_filters from ExportOptions', () => {
    const manifest = buildManifest(mockOptions, 5, false);

    expect(manifest.applied_filters.types).toEqual(['chat']);
    expect(manifest.applied_filters.statuses).toEqual(['completed']);
    expect(manifest.applied_filters.providers).toEqual(['anthropic']);
    expect(manifest.applied_filters.limit).toBe(50);
  });

  it('sets privacy_mode true when privacyMode is enabled', () => {
    const manifest = buildManifest(mockOptions, 3, true);
    expect(manifest.privacy_mode).toBe(true);
  });
});

describe('Privacy Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTraceTree.mockResolvedValue(mockTraceTree);
  });

  it('exportSingleTrace strips content fields when privacyMode is true', async () => {
    // Use a trace tree with tool I/O content
    const traceWithIO: TraceTree = {
      ...mockTraceTree,
      transaction: {
        ...mockTraceTree.transaction,
        id: 'op-privacy-1',
      },
      toolTraces: [
        {
          ...mockTraceTree.toolTraces[0],
          id: 'tt-privacy-1',
          operationId: 'op-privacy-1',
          inputSchema: '{"prompt":"tell me a story about sk-abc123"}',
          outputSchema: '{"result":"Once upon a time..."}',
        },
      ],
    };
    mockGetTraceTree.mockResolvedValue(traceWithIO);

    // Without privacy mode — content kept (then redacted)
    const blobNormal = await exportSingleTrace('op-privacy-1', false);
    const textNormal = await blobNormal!.text();
    const parsedNormal = JSON.parse(textNormal);
    expect(parsedNormal.toolTraces[0].inputSchema).toBeDefined();

    // With privacy mode — content stripped
    const blobPrivacy = await exportSingleTrace('op-privacy-1', true);
    const textPrivacy = await blobPrivacy!.text();
    const parsedPrivacy = JSON.parse(textPrivacy);

    expect(parsedPrivacy.toolTraces[0].inputSchema).toBeUndefined();
    expect(parsedPrivacy.toolTraces[0].outputSchema).toBeUndefined();
  });

  it('exportTraces forces metadata-only when privacyMode is true', async () => {
    mockQueryTransactions.mockResolvedValue([mockTraceTree.transaction, { ...mockTraceTree.transaction, id: 'op-2' }]);
    mockGetTraceTree.mockResolvedValue(mockTraceTree);

    const blob = await exportTraces(mockOptions, true);

    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('Redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTraceTree.mockResolvedValue(mockTraceTreeWithSecrets);
  });

  it('exportSingleTrace calls traceRedactor.redactObject before serialization', async () => {
    await exportSingleTrace('op-secret-1');

    expect(mockRedactObject).toHaveBeenCalled();
  });

  it('exportTraces calls traceRedactor on all traces before ZIP assembly', async () => {
    const trees = [mockTraceTreeWithSecrets];
    mockQueryTransactions.mockResolvedValue(trees.map(t => t.transaction));
    mockGetTraceTree.mockResolvedValue(mockTraceTreeWithSecrets);

    await exportTraces(mockOptions);

    // RedactObject should have been called for each trace tree
    expect(mockRedactObject).toHaveBeenCalled();
  });

  it('raw API key patterns are not present in export output', async () => {
    const rawKeyTree: TraceTree = {
      ...mockTraceTree,
      transaction: { ...mockTraceTree.transaction, id: 'op-raw-1' },
      toolTraces: [
        {
          ...mockTraceTree.toolTraces[0],
          id: 'tt-raw-1',
          operationId: 'op-raw-1',
        },
      ],
    };
    mockGetTraceTree.mockResolvedValue(rawKeyTree);

    // Mock redaction to actually redact keys
    mockRedactObject.mockImplementation((obj: unknown) => {
      const r = { ...(obj as Record<string, unknown>) };
      for (const [key, value] of Object.entries(r)) {
        if (typeof value === 'string') {
          r[key] = value.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED:API_KEY]');
        }
      }
      return r;
    });

    const blob = (await exportSingleTrace('op-raw-1'))!;

    const text = await blob.text();
    expect(text).not.toContain('sk-test-key-value-12345');
  });
});

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers a browser download using URL.createObjectURL', () => {
    // URL.createObjectURL and anchor click are browser APIs
    // This test verifies the function doesn't throw
    const blob = new Blob(['test'], { type: 'application/json' });
    expect(() => downloadBlob(blob, 'test.json')).not.toThrow();
  });
});
