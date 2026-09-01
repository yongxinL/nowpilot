/**
 * NoteMaintenance.test.ts — LLM-WIKI-08/09/10, D-06, LLM-WIKI-02 (D-122).
 *
 * TDD RED phase: these tests define the expected behavior of
 * NoteMaintenance before implementation. They cover:
 *   - Test 1 (LLM-WIKI-08): staleness detected when updated > summaryGeneratedAt
 *   - Test 2 (LLM-WIKI-08): not stale when summaryGeneratedAt >= updated
 *   - Test 3 (LLM-WIKI-09): orphan = 0 links + 0 backlinks (algorithmic, no LLM)
 *   - Test 4 (LLM-WIKI-10): bulk re-analyze is sequential with progress callback
 *   - Test 5 (LLM-WIKI-10): bulk re-analyze respects abortSignal (stops mid-batch)
 *   - Test 6 (D-06): no MV3 alarms/background timers used
 *   - Test 7 (LLM-WIKI-02): when all features false, NoteTagger.analyze not called
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test.
const mockComputeBacklinks = vi.fn();
const mockAnalyze = vi.fn();
const mockEmit = vi.fn();
const mockDebugLog = vi.fn();
const mockGet = vi.fn();

vi.mock('../../../src/core/notes/NoteGraph', () => ({
  computeBacklinks: (...args: unknown[]) => mockComputeBacklinks(...args),
}));

vi.mock('../../../src/core/notes/NoteTagger', () => ({
  NoteTagger: {
    analyze: (...args: unknown[]) => mockAnalyze(...args),
  },
}));

vi.mock('../../../src/core/events/EventBus', () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

vi.mock('../../../src/core/log/debugLog', () => ({
  debugLog: (...args: unknown[]) => mockDebugLog(...args),
}));

// Mock chrome.storage.local for LLM feature gating.
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: (...args: unknown[]) => mockGet(...args),
      set: vi.fn(),
    },
  },
});

import type { Note } from '../../../src/types/notes';

// Import the module under test AFTER mocks are set up.
const {
  detectStaleness,
  detectOrphans,
  reanalyzeAllNotes,
  NP_NOTES_LLM_FEATURES_KEY,
} = await import('../../../src/core/notes/NoteMaintenance');

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Test Note',
    content: 'This is a test note about ServiceNow incidents.',
    created: 1700000000000,
    updated: 1700000000001,
    tags: [],
    links: [],
    unresolvedLinks: [],
    source: { kind: 'manual' },
    aiMeta: { suggestedLinks: [], concepts: [] },
    version: 1,
    ...overrides,
  };
}

describe('detectStaleness (LLM-WIKI-08)', () => {
  it('detects staleness when updated > summaryGeneratedAt', () => {
    const note = makeNote({
      updated: 1700000005000,
      summaryGeneratedAt: 1700000002000,
    });
    const result = detectStaleness(note);
    expect(result.isStale).toBe(true);
    expect(result.noteId).toBe('note-1');
    expect(result.lastGeneratedAt).toBe(1700000002000);
    expect(result.noteUpdatedAt).toBe(1700000005000);
  });

  it('is not stale when summaryGeneratedAt >= updated', () => {
    const note = makeNote({
      updated: 1700000002000,
      summaryGeneratedAt: 1700000003000,
    });
    const result = detectStaleness(note);
    expect(result.isStale).toBe(false);
  });

  it('is not stale when no generation timestamp exists (lastGeneratedAt=0)', () => {
    const note = makeNote({ updated: 1700000005000 });
    const result = detectStaleness(note);
    expect(result.isStale).toBe(false);
    expect(result.lastGeneratedAt).toBe(0);
  });

  it('uses max of summaryGeneratedAt and tagsGeneratedAt', () => {
    const note = makeNote({
      updated: 1700000005000,
      summaryGeneratedAt: 1700000001000,
      tagsGeneratedAt: 1700000003000,
    });
    const result = detectStaleness(note);
    expect(result.lastGeneratedAt).toBe(1700000003000);
    expect(result.isStale).toBe(true);
  });
});

describe('detectOrphans (LLM-WIKI-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects orphan = 0 links + 0 backlinks (algorithmic, no LLM)', () => {
    const notes = [
      makeNote({ id: 'n1', links: [] }),
      makeNote({ id: 'n2', links: ['n1'] }),
    ];
    // n1 has backlinks from n2; n2 has no backlinks and has links.
    mockComputeBacklinks.mockReturnValue(
      new Map([['n1', ['n2']]]),
    );

    const results = detectOrphans(notes);
    expect(results).toHaveLength(2);

    const n1Result = results.find((r) => r.noteId === 'n1');
    const n2Result = results.find((r) => r.noteId === 'n2');

    // n1: has backlinks → not orphan
    expect(n1Result?.isOrphan).toBe(false);
    // n2: has links → not orphan
    expect(n2Result?.isOrphan).toBe(false);

    // Algorithmic — no LLM call made.
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('detects true orphan (0 links + 0 backlinks)', () => {
    const notes = [
      makeNote({ id: 'n1', links: [] }),
      makeNote({ id: 'n2', links: [] }),
    ];
    // No backlinks for anyone.
    mockComputeBacklinks.mockReturnValue(new Map());

    const results = detectOrphans(notes);
    expect(results.every((r) => r.isOrphan)).toBe(true);
  });
});

describe('reanalyzeAllNotes (LLM-WIKI-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({});
    mockAnalyze.mockResolvedValue({
      tags: [{ value: 'svc', confidence: 0.9 }],
      categoryPath: 'ServiceNow',
      summary: 'Summary',
      memoryFacts: [],
    });
  });

  it('runs sequentially with progress callback', async () => {
    const notes = [
      makeNote({ id: 'n1' }),
      makeNote({ id: 'n2' }),
      makeNote({ id: 'n3' }),
    ];
    const progressCalls: number[] = [];
    const onProgress = vi.fn((stats: { processed: number }) => {
      progressCalls.push(stats.processed);
    });

    const result = await reanalyzeAllNotes(notes, onProgress);

    expect(result.processed).toBe(3);
    expect(result.total).toBe(3);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(progressCalls).toEqual([1, 2, 3]);
    expect(mockAnalyze).toHaveBeenCalledTimes(3);
  });

  it('respects abortSignal — stops mid-batch', async () => {
    const notes = [
      makeNote({ id: 'n1' }),
      makeNote({ id: 'n2' }),
      makeNote({ id: 'n3' }),
      makeNote({ id: 'n4' }),
    ];
    const controller = new AbortController();
    let callCount = 0;
    mockAnalyze.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) controller.abort(); // abort after 2nd call
      return {
        tags: [{ value: 'svc', confidence: 0.9 }],
        categoryPath: null,
        summary: '',
        memoryFacts: [],
      };
    });

    const result = await reanalyzeAllNotes(notes, undefined, controller.signal);

    // Should have stopped at 2 (aborted during 3rd iteration check)
    expect(result.processed).toBe(2);
    expect(mockAnalyze).toHaveBeenCalledTimes(2);
  });

  it('counts tagged/categorized/summarized stats', async () => {
    const notes = [
      makeNote({ id: 'n1' }),
      makeNote({ id: 'n2' }),
    ];
    mockAnalyze
      .mockResolvedValueOnce({
        tags: [{ value: 'svc', confidence: 0.9 }],
        categoryPath: 'ServiceNow',
        summary: 'Summary',
        memoryFacts: [],
      })
      .mockResolvedValueOnce({
        tags: [],
        categoryPath: null,
        summary: '',
        memoryFacts: [],
      });

    const result = await reanalyzeAllNotes(notes);
    expect(result.tagged).toBe(1);
    expect(result.categorized).toBe(1);
    expect(result.summarized).toBe(1);
    expect(result.errors).toBe(0);
  });

  it('counts errors when analyze throws', async () => {
    const notes = [
      makeNote({ id: 'n1' }),
      makeNote({ id: 'n2' }),
    ];
    mockAnalyze
      .mockResolvedValueOnce({
        tags: [{ value: 'svc', confidence: 0.9 }],
        categoryPath: null,
        summary: '',
        memoryFacts: [],
      })
      .mockRejectedValueOnce(new Error('LLM call failed'));

    const result = await reanalyzeAllNotes(notes);
    expect(result.processed).toBe(2);
    expect(result.errors).toBe(1);
  });
});

describe('LLM-WIKI-02 gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when all features false, NoteTagger.analyze is NOT called', async () => {
    mockGet.mockResolvedValue({
      [NP_NOTES_LLM_FEATURES_KEY]: {
        autoTag: false,
        autoCategorize: false,
        autoSummary: false,
        aiSearch: false,
      },
    });

    const notes = [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })];
    const result = await reanalyzeAllNotes(notes);

    expect(mockAnalyze).not.toHaveBeenCalled();
    expect(result.processed).toBe(2);
    expect(result.tagged).toBe(0);
    expect(result.categorized).toBe(0);
    expect(result.summarized).toBe(0);
  });

  it('when autoTag=false, tags are not counted', async () => {
    mockGet.mockResolvedValue({
      [NP_NOTES_LLM_FEATURES_KEY]: {
        autoTag: false,
        autoCategorize: true,
        autoSummary: true,
        aiSearch: true,
      },
    });
    mockAnalyze.mockResolvedValue({
      tags: [{ value: 'svc', confidence: 0.9 }],
      categoryPath: 'ServiceNow',
      summary: 'Summary',
      memoryFacts: [],
    });

    const notes = [makeNote({ id: 'n1' })];
    const result = await reanalyzeAllNotes(notes);

    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(result.tagged).toBe(0);
    expect(result.categorized).toBe(1);
    expect(result.summarized).toBe(1);
  });
});

describe('D-06 no background jobs', () => {
  it('NoteMaintenance.ts does not use setInterval or chrome.alarms', async () => {
    // Read the source file and assert no background-timer APIs are used.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const srcPath = path.resolve(
      __dirname,
      '../../../src/core/notes/NoteMaintenance.ts',
    );
    const src = await fs.readFile(srcPath, 'utf-8');
    expect(src).not.toMatch(/setInterval\s*\(/);
    expect(src).not.toMatch(/chrome\.alarms/);
    expect(src).not.toMatch(/setTimeout\s*\(/);
  });
});
