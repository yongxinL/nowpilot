import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetNotesDb, notesDb } from '../../../src/core/notes/NotesDB';
import { resetJournalDb } from '../../../src/core/storage/WriteJournal';
import { resetLlmService, getLlmService } from '../../../src/core/ai/LlmService';
import { getMemoryEngine, resetMemoryEngine } from '../../../src/core/memory/MemoryEngine';
import { getNoteQA, resetNoteQA, parseCitations } from '../../../src/core/notes/NoteQA';
import type { NoteQA } from '../../../src/core/notes/NoteQA';
import { NoteQAResultSchema } from '../../../src/core/notes/NoteSchema';
import type { NoteSearchResult } from '../../../src/core/notes/types';
import type { ContextItem } from '../../../src/core/context/ContextItem';
import type { ProviderAdapter } from '../../../src/core/ai/providers/ProviderAdapter';
import { noteSearchIndex } from '../../../src/core/notes/MiniSearchNoteIndex';
import type { Note } from '../../../src/core/notes/NoteSchema';

function createMockAdapter(): ProviderAdapter {
  return {
    providerId: 'openai',
    createLanguageModel: vi.fn(() => ({}) as any),
    validateConnection: vi.fn(),
    supportsStructuredOutput: true,
    getDefaultModelForTier: vi.fn(() => 'gpt-4o-mini'),
    getCacheStrategy: vi.fn((): 'prefix-only' => 'prefix-only'),
    getTelemetryMetadata: vi.fn(() => ({ provider: 'openai' })),
  };
}

function makeSnippet(noteId: string, title: string, snippet: string): NoteSearchResult {
  return {
    noteId,
    score: 1,
    matchedFields: ['content'],
    snippet,
  };
}

function makeMemoryItem(text: string, relevance = 0.9): ContextItem {
  return {
    kind: 'memory',
    text,
    tokens: text.length,
    stable: false,
    sourceId: `memory.user.fact.${text.slice(0, 8)}`,
    relevance,
    freshness: 0.9,
    trust: 0.8,
    sensitivity: 'private',
    instructionAuthority: 'data',
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    title: 'Test Note',
    content: 'Plain content without links',
    tags: ['work'],
    categoryPath: '',
    createdAt: 1000,
    updatedAt: 1000,
    version: 1,
    provenance: { source: 'user-created' },
    links: [],
    unresolvedLinks: [],
    ...overrides,
  };
}

async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('NoteQA', () => {
  let qa: NoteQA;

  beforeEach(async () => {
    await resetNotesDb();
    await resetJournalDb();
    resetLlmService();
    resetMemoryEngine();
    resetNoteQA();
    qa = getNoteQA();
    (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__ =
      'test-surface';
    // NoteQA resolves snippet titles from NotesDB — seed the notes used.
  });

  afterEach(() => {
    delete (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string })
      .__NOWPILOT_SURFACE_ID__;
    vi.restoreAllMocks();
  });

  describe('ask mode', () => {
    it('returns cited answer with correct citations', async () => {
      const noteA = '881fa28e-13ca-443e-b630-37af39b3ffac';
      const noteB = 'a7b48737-0066-4d26-8f8e-a898a28f4170';
      const snippets = [
        makeSnippet(noteA, 'Alpha', 'alpha content'),
        makeSnippet(noteB, 'Beta', 'beta content'),
      ];
      await notesDb.save(makeNote({ id: noteA, title: 'Alpha' }));
      await notesDb.save(makeNote({ id: noteB, title: 'Beta' }));
      const searchSpy = vi
        .spyOn(noteSearchIndex, 'search')
        .mockReturnValue(snippets);
      vi.spyOn(getMemoryEngine(), 'retrieve').mockResolvedValue({
        success: true,
        items: [makeMemoryItem('User prefers concise answers.')],
      });
      const generateSpy = vi
        .spyOn(getLlmService(), 'generate')
        .mockResolvedValue({
          answer: 'Answer with [1] and [2] references.',
          citations: [
            { noteId: noteA, title: 'Alpha', relevantSnippet: 'alpha content', referenceNumber: 1 },
            { noteId: noteB, title: 'Beta', relevantSnippet: 'beta content', referenceNumber: 2 },
          ],
        });

      const result = await qa.query(createMockAdapter(), {
        mode: 'ask',
        question: 'What is alpha?',
        tier: 'BALANCED',
      });
      expect(searchSpy).toHaveBeenCalledWith('What is alpha?', 5);
      expect(result).not.toBeNull();
      if (result && 'answer' in result) {
        expect(result.answer).toContain('[1]');
        expect(result.citations).toHaveLength(2);
        expect(result.citations[0]).toEqual({
          noteId: noteA,
          title: 'Alpha',
          relevantSnippet: 'alpha content',
          referenceNumber: 1,
        });
        expect(result.citations[1].referenceNumber).toBe(2);
      }
      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'BALANCED',
          schema: NoteQAResultSchema,
        }),
      );
    });

    it('retrieves top-5 MiniSearch snippets', async () => {
      const searchSpy = vi
        .spyOn(noteSearchIndex, 'search')
        .mockReturnValue([makeSnippet('note-a', 'Alpha', 'alpha content')]);
      vi.spyOn(getMemoryEngine(), 'retrieve').mockResolvedValue({
        success: true,
        items: [],
      });
      vi.spyOn(getLlmService(), 'generate').mockResolvedValue({
        answer: 'No relevant notes.',
        citations: [],
      });

      await qa.query(createMockAdapter(), { mode: 'ask', question: 'q', tier: 'BALANCED' });
      expect(searchSpy).toHaveBeenCalledWith('q', 5);
    });

    it('injects MemoryEngine context', async () => {
      vi.spyOn(noteSearchIndex, 'search').mockReturnValue([
        makeSnippet('note-a', 'Alpha', 'alpha content'),
      ]);
      const retrieveSpy = vi
        .spyOn(getMemoryEngine(), 'retrieve')
        .mockResolvedValue({
          success: true,
          items: [makeMemoryItem('User prefers concise answers.')],
        });
      vi.spyOn(getLlmService(), 'generate').mockResolvedValue({
        answer: 'ok',
        citations: [],
      });

      await qa.query(createMockAdapter(), { mode: 'ask', question: 'q', tier: 'BALANCED' });
      expect(retrieveSpy).toHaveBeenCalled();
    });

    it('returns "couldn\'t find" answer when no snippets are relevant', async () => {
      vi.spyOn(noteSearchIndex, 'search').mockReturnValue([
        makeSnippet('note-a', 'Alpha', 'alpha content'),
      ]);
      vi.spyOn(getMemoryEngine(), 'retrieve').mockResolvedValue({
        success: true,
        items: [],
      });
      vi.spyOn(getLlmService(), 'generate').mockResolvedValue({
        answer: "I couldn't find relevant notes to answer this question.",
        citations: [],
      });

      const result = await qa.query(createMockAdapter(), {
        mode: 'ask',
        question: 'unknown thing',
        tier: 'BALANCED',
      });
      expect(result).not.toBeNull();
      if (result && 'answer' in result) {
        expect(result.answer).toBe(
          "I couldn't find relevant notes to answer this question.",
        );
      }
    });
  });

  describe('search mode', () => {
    it('reranks top-10 via haiku', async () => {
      const results = [
        makeSnippet('note-b', 'Beta', 'beta'),
        makeSnippet('note-a', 'Alpha', 'alpha'),
      ];
      const searchSpy = vi.spyOn(noteSearchIndex, 'search').mockReturnValue(results);
      const generateSpy = vi
        .spyOn(getLlmService(), 'generate')
        .mockResolvedValue({ order: [2, 1] });

      const result = await qa.query(createMockAdapter(), {
        mode: 'search',
        question: 'q',
        tier: 'FAST',
      });
      expect(searchSpy).toHaveBeenCalledWith('q', 10);
      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 'FAST' }),
      );
      expect(result).toEqual([results[1], results[0]]);
    });

    it('falls back to BM25 order on LLM failure', async () => {
      const results = [
        makeSnippet('note-a', 'Alpha', 'alpha'),
        makeSnippet('note-b', 'Beta', 'beta'),
      ];
      vi.spyOn(noteSearchIndex, 'search').mockReturnValue(results);
      vi.spyOn(getLlmService(), 'generate').mockRejectedValue(
        new Error('LLM down'),
      );

      const result = await qa.query(createMockAdapter(), {
        mode: 'search',
        question: 'q',
        tier: 'FAST',
      });
      expect(result).toEqual(results);
    });
  });

  describe('tiny model tier (D-16)', () => {
    it('returns raw results without LLM call', async () => {
      const snippets = [makeSnippet('note-a', 'Alpha', 'alpha content')];
      vi.spyOn(noteSearchIndex, 'search').mockReturnValue(snippets);
      vi.spyOn(getMemoryEngine(), 'retrieve').mockResolvedValue({
        success: true,
        items: [makeMemoryItem('User prefers concise answers.')],
      });
      const generateSpy = vi.spyOn(getLlmService(), 'generate');

      const result = await qa.query(createMockAdapter(), {
        mode: 'ask',
        question: 'q',
        tier: 'TINY',
      });
      expect(generateSpy).not.toHaveBeenCalled();
      expect(result).not.toBeNull();
      if (result && Array.isArray(result)) {
        expect(result[0].noteId).toBe('note-a');
        expect(result[1].noteId).toContain('memory.user.fact');
      }
    });

    it('search mode returns raw BM25 order without LLM call', async () => {
      const snippets = [makeSnippet('note-a', 'Alpha', 'alpha')];
      vi.spyOn(noteSearchIndex, 'search').mockReturnValue(snippets);
      const generateSpy = vi.spyOn(getLlmService(), 'generate');

      const result = await qa.query(createMockAdapter(), {
        mode: 'search',
        question: 'q',
        tier: 'TINY',
      });
      expect(generateSpy).not.toHaveBeenCalled();
      expect(result).toEqual(snippets);
    });
  });

  describe('parseCitations', () => {
    it('validates reference range', () => {
      const snippets = [
        { noteId: 'a', title: 'A', snippet: 'aaa' },
        { noteId: 'b', title: 'B', snippet: 'bbb' },
        { noteId: 'c', title: 'C', snippet: 'ccc' },
      ];
      const citations = parseCitations('see [2] and [5]', snippets);
      expect(citations).toHaveLength(1);
      expect(citations[0].referenceNumber).toBe(2);
    });

    it('deduplicates repeated references', () => {
      const snippets = [{ noteId: 'a', title: 'A', snippet: 'aaa' }];
      const citations = parseCitations('[1] and again [1]', snippets);
      expect(citations).toHaveLength(1);
      expect(citations[0].noteId).toBe('a');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty question without MiniSearch call', async () => {
      const searchSpy = vi.spyOn(noteSearchIndex, 'search');
      const generateSpy = vi.spyOn(getLlmService(), 'generate');

      const result = await qa.query(createMockAdapter(), {
        mode: 'ask',
        question: '',
        tier: 'BALANCED',
      });
      expect(result).toBeNull();
      expect(searchSpy).not.toHaveBeenCalled();
      expect(generateSpy).not.toHaveBeenCalled();
    });
  });
});
