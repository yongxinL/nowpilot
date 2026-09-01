/**
 * NoteQA.test.ts — LLM-WIKI-05/06, NMEM-01 (D-117).
 *
 * TDD RED phase: these tests define the expected behavior of NoteQA
 * before implementation. They cover:
 *   - Test 1 (LLM-WIKI-06): balanced-tier synthesis returns cited answer
 *   - Test 2 (LLM-WIKI-06): tiny mode falls back to plain MiniSearch
 *   - Test 3 (NMEM-01): memory hints included in RAG context
 *   - Test 4: MiniSearch top-5 retrieval feeds synthesis
 *   - Test 5 (LLM-WIKI-05): AI-enhanced rerank when <3 results
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDBPDatabase } from 'idb';
import type { NotesDBV1 } from '../../../src/core/storage/NotesDB';

// Mock dependencies before importing the module under test.
const mockQuery = vi.fn();
const mockRetrieveMemoryHints = vi.fn();
const mockRequestJson = vi.fn();
const mockResolveTier = vi.fn();

vi.mock('../../../src/core/search/MiniSearchIndex', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock('../../../src/core/memory/MemoryEngine', () => ({
  MemoryEngine: {
    retrieveMemoryHints: (...args: unknown[]) => mockRetrieveMemoryHints(...args),
  },
}));

vi.mock('../../../src/core/ai/StructuredOutput', () => ({
  requestJson: (...args: unknown[]) => mockRequestJson(...args),
}));

vi.mock('../../../src/core/ai/TierResolver', () => ({
  resolveTier: (...args: unknown[]) => mockResolveTier(...args),
}));

const { NoteQA } = await import('../../../src/core/notes/NoteQA');

function makeDb(): IDBPDatabase<NotesDBV1> {
  return {} as IDBPDatabase<NotesDBV1>;
}

function makeNoteHit(id: string, title: string, score: number) {
  return {
    id,
    score,
    title,
    content: `${title} content body`,
    tags: '',
    summary: '',
    updated: 1000,
  };
}

function makeMemoryHint(id: string, content: string) {
  return { id, content, type: 'fact' as const, tags: [], score: 0.9 };
}

describe('NoteQA', () => {
  let db: IDBPDatabase<NotesDBV1>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = makeDb();
  });

  it('(1) LLM-WIKI-06: balanced-tier synthesis returns cited answer with NoteQAResult shape', async () => {
    mockQuery.mockResolvedValue([
      makeNoteHit('n1', 'Note One', 0.9),
      makeNoteHit('n2', 'Note Two', 0.8),
      makeNoteHit('n3', 'Note Three', 0.7),
      makeNoteHit('n4', 'Note Four', 0.6),
      makeNoteHit('n5', 'Note Five', 0.5),
    ]);
    mockRetrieveMemoryHints.mockResolvedValue([]);
    mockResolveTier.mockReturnValue({ providerId: 'gemini', model: 'gemini-1.5-pro' });
    mockRequestJson.mockResolvedValue({
      answer: 'The answer is 42.',
      citations: [{ noteId: 'n1', title: 'Note One', snippet: 'Note One content body' }],
      confidence: 0.95,
    });

    const result = await NoteQA.ask('What is the answer?', db);

    expect(result.answer).toBe('The answer is 42.');
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toEqual({
      noteId: 'n1',
      title: 'Note One',
      snippet: 'Note One content body',
    });
    expect(result.confidence).toBe(0.95);
    expect(result.fallback).toBe(false);
    expect(result.mode).toBe('ai-enhanced');
    expect(mockRequestJson).toHaveBeenCalledTimes(1);
  });

  it('(2) LLM-WIKI-06: tiny mode falls back to plain MiniSearch when balanced tier unavailable', async () => {
    mockQuery.mockResolvedValue([makeNoteHit('n1', 'Note One', 0.9)]);
    mockRetrieveMemoryHints.mockResolvedValue([]);
    mockResolveTier.mockReturnValue(null); // balanced tier not configured

    const result = await NoteQA.ask('What is the answer?', db);

    expect(result.answer).toBeNull();
    expect(result.citations).toEqual([]);
    expect(result.fallback).toBe(true);
    expect(result.mode).toBe('keyword-only');
    expect(mockRequestJson).not.toHaveBeenCalled();
  });

  it('(3) NMEM-01: memory hints from MemoryEngine.retrieveMemoryHints included in RAG context', async () => {
    mockQuery.mockResolvedValue([makeNoteHit('n1', 'Note One', 0.9)]);
    mockRetrieveMemoryHints.mockResolvedValue([
      makeMemoryHint('m1', 'User prefers concise answers'),
    ]);
    mockResolveTier.mockReturnValue({ providerId: 'gemini', model: 'gemini-1.5-pro' });
    mockRequestJson.mockResolvedValue({
      answer: 'Concise answer.',
      citations: [{ noteId: 'n1', title: 'Note One', snippet: 'content' }],
      confidence: 0.9,
    });

    await NoteQA.ask('What is the answer?', db);

    // The synthesis prompt must include the memory hint content.
    const promptArg = mockRequestJson.mock.calls[0][1] as string;
    expect(promptArg).toContain('User prefers concise answers');
  });

  it('(4) MiniSearch top-5: only top-5 of 10 results feed synthesis', async () => {
    const hits = Array.from({ length: 10 }, (_, i) =>
      makeNoteHit(`n${i}`, `Note ${i}`, 1.0 - i * 0.05),
    );
    mockQuery.mockResolvedValue(hits);
    mockRetrieveMemoryHints.mockResolvedValue([]);
    mockResolveTier.mockReturnValue({ providerId: 'gemini', model: 'gemini-1.5-pro' });
    mockRequestJson.mockResolvedValue({
      answer: 'Answer.',
      citations: [],
      confidence: 0.8,
    });

    await NoteQA.ask('query', db);

    const promptArg = mockRequestJson.mock.calls[0][1] as string;
    // Top-5 (indices 0-4) should be present.
    expect(promptArg).toContain('Note 0');
    expect(promptArg).toContain('Note 4');
    // Note 5 (6th result) should NOT be in the synthesis context.
    expect(promptArg).not.toContain('Note 5');
  });

  it('(5) LLM-WIKI-05: AI-enhanced rerank activates when <3 MiniSearch results', async () => {
    mockQuery.mockResolvedValue([
      makeNoteHit('n1', 'Note One', 0.9),
      makeNoteHit('n2', 'Note Two', 0.8),
    ]); // only 2 results (< 3)
    mockRetrieveMemoryHints.mockResolvedValue([]);
    mockResolveTier.mockReturnValue({ providerId: 'gemini', model: 'gemini-1.5-pro' });
    // First: synthesis returns 2 citations (one per note).
    mockRequestJson.mockResolvedValueOnce({
      answer: 'Answer.',
      citations: [
        { noteId: 'n1', title: 'Note One', snippet: 'content one' },
        { noteId: 'n2', title: 'Note Two', snippet: 'content two' },
      ],
      confidence: 0.85,
    });
    // Second: fast-tier rerank reorders.
    mockRequestJson.mockResolvedValueOnce({
      order: ['n2', 'n1'],
    });

    const result = await NoteQA.ask('query', db);

    expect(result.reranked).toBe(true);
    expect(mockRequestJson).toHaveBeenCalledTimes(2);
  });
});
