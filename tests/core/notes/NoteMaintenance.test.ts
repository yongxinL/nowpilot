import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notesDb, resetNotesDb } from '../../../src/core/notes/NotesDB';
import { resetJournalDb } from '../../../src/core/storage/WriteJournal';
import { resetLlmService } from '../../../src/core/ai/LlmService';
import { resetMemoryEngine } from '../../../src/core/memory/MemoryEngine';
import {
  getNoteMaintenance,
  resetNoteMaintenance,
} from '../../../src/core/notes/NoteMaintenance';
import { getNoteTagger, resetNoteTagger } from '../../../src/core/notes/NoteTagger';
import type { Note, NoteTaggerResult } from '../../../src/core/notes/NoteSchema';
import { on } from '../../../src/core/events/EventBus';
import type { ProviderAdapter } from '../../../src/core/ai/providers/ProviderAdapter';

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

function validTaggerResult(): NoteTaggerResult {
  return {
    enrichment: {
      tags: ['test'],
      categoryPath: 'Research',
      summary: 'A summary.',
      suggestedConcepts: [],
    },
    memoryFacts: [
      { type: 'semantic', content: 'User likes testing.', confidence: 0.9, reason: 'In content' },
    ],
  };
}

describe('NoteMaintenance', () => {
  beforeEach(async () => {
    await resetNotesDb();
    await resetJournalDb();
    resetLlmService();
    resetMemoryEngine();
    resetNoteTagger();
    resetNoteMaintenance();
    (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__ =
      'test-surface';
  });

  afterEach(() => {
    delete (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string })
      .__NOWPILOT_SURFACE_ID__;
    vi.restoreAllMocks();
  });

  describe('getStaleNotes', () => {
    it('returns notes where tagsGeneratedAt < updatedAt', async () => {
      const stale = makeNote({
        tagsGeneratedAt: 500,
        summaryGeneratedAt: 2000,
        updatedAt: 1000,
      });
      await notesDb.restore(stale);

      const result = await getNoteMaintenance().getStaleNotes();
      expect(result.map((n) => n.id)).toContain(stale.id);
    });

    it('excludes fresh notes', async () => {
      const fresh = makeNote({
        tagsGeneratedAt: 2000,
        summaryGeneratedAt: 2000,
        updatedAt: 1000,
      });
      await notesDb.restore(fresh);

      const result = await getNoteMaintenance().getStaleNotes();
      expect(result.map((n) => n.id)).not.toContain(fresh.id);
    });

    it('flags never-enriched notes edited beyond the grace period', async () => {
      const edited = makeNote({
        createdAt: 0,
        updatedAt: 1000 + 61 * 1000,
      });
      await notesDb.restore(edited);

      const result = await getNoteMaintenance().getStaleNotes();
      expect(result.map((n) => n.id)).toContain(edited.id);
    });

    it('excludes never-enriched brand-new notes within the grace period', async () => {
      const fresh = makeNote({
        createdAt: 0,
        updatedAt: 10 * 1000,
      });
      await notesDb.restore(fresh);

      const result = await getNoteMaintenance().getStaleNotes();
      expect(result.map((n) => n.id)).not.toContain(fresh.id);
    });
  });

  describe('getOrphanNotes', () => {
    it('returns notes with 0 wikilinks + 0 backlinks', async () => {
      const isolated = makeNote({ links: [] });
      await notesDb.restore(isolated);

      const result = await getNoteMaintenance().getOrphanNotes();
      expect(result.map((n) => n.id)).toContain(isolated.id);
    });

    it('excludes notes with wikilinks', async () => {
      const linked = makeNote({
        links: ['11111111-1111-4111-8111-111111111111'],
      });
      await notesDb.restore(linked);

      const result = await getNoteMaintenance().getOrphanNotes();
      expect(result.map((n) => n.id)).not.toContain(linked.id);
    });

    it('excludes notes with backlinks', async () => {
      const target = makeNote({ links: [] });
      const referrer = makeNote({ links: [target.id] });
      await notesDb.restore(target);
      await notesDb.restore(referrer);

      const result = await getNoteMaintenance().getOrphanNotes();
      expect(result.map((n) => n.id)).not.toContain(target.id);
    });
  });

  describe('reanalyzeAll', () => {
    it('processes all notes sequentially', async () => {
      const notes = [makeNote(), makeNote(), makeNote()];
      for (const n of notes) await notesDb.save(n);

      const analyzeSpy = vi
        .spyOn(getNoteTagger(), 'analyze')
        .mockResolvedValue(validTaggerResult());

      const result = await getNoteMaintenance().reanalyzeAll(createMockAdapter());
      expect(analyzeSpy).toHaveBeenCalledTimes(3);
      expect(result.total).toBe(3);
      expect(result.enriched).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('returns success/fail counts', async () => {
      const notes = [makeNote(), makeNote(), makeNote()];
      for (const n of notes) await notesDb.save(n);

      const analyzeSpy = vi.spyOn(getNoteTagger(), 'analyze');
      analyzeSpy
        .mockResolvedValueOnce(validTaggerResult())
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(validTaggerResult());

      const result = await getNoteMaintenance().reanalyzeAll(createMockAdapter());
      expect(result).toEqual({ total: 3, enriched: 2, failed: 1 });
    });

    it('emits note:enriched for each successful enrichment', async () => {
      const notes = [makeNote(), makeNote()];
      for (const n of notes) await notesDb.save(n);

      const enrichedListener = vi.fn();
      const unsubscribe = on('note:enriched', enrichedListener);
      try {
        vi.spyOn(getNoteTagger(), 'analyze').mockResolvedValue(validTaggerResult());
        await getNoteMaintenance().reanalyzeAll(createMockAdapter());
        expect(enrichedListener).toHaveBeenCalledTimes(2);
      } finally {
        unsubscribe();
      }
    });
  });
});
