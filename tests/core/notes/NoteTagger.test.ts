import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB } from 'idb';
import { notesDb, resetNotesDb } from '../../../src/core/notes/NotesDB';
import { resetJournalDb } from '../../../src/core/storage/WriteJournal';
import { migrationRunner } from '../../../src/core/storage/MigrationRunner';
import { getLlmService, resetLlmService } from '../../../src/core/ai/LlmService';
import { getNoteTagger, resetNoteTagger } from '../../../src/core/notes/NoteTagger';
import {
  NoteTaggerResultSchema,
  type Note,
  type NoteTaggerResult,
} from '../../../src/core/notes/NoteSchema';
import { on } from '../../../src/core/events/EventBus';
import type { ProviderAdapter } from '../../../src/core/ai/providers/ProviderAdapter';
import { PipelineError } from '../../../src/core/ai/PipelineError';

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

function createMockAdapter(overrides?: Partial<ProviderAdapter>): ProviderAdapter {
  return {
    providerId: 'openai',
    createLanguageModel: vi.fn(() => ({}) as any),
    validateConnection: vi.fn(),
    supportsStructuredOutput: true,
    getDefaultModelForTier: vi.fn(() => 'gpt-4o-mini'),
    getCacheStrategy: vi.fn((): 'prefix-only' => 'prefix-only'),
    getTelemetryMetadata: vi.fn(() => ({ provider: 'openai' })),
    ...overrides,
  };
}

function validTaggerResult(overrides?: Partial<NoteTaggerResult>): NoteTaggerResult {
  return {
    enrichment: {
      tags: ['test', 'tagging'],
      categoryPath: 'Research',
      summary: 'A test note about tagging.',
      suggestedConcepts: [{ slug: 'tagging', label: 'Tagging', summary: 'Tagging concepts' }],
    },
    memoryFacts: [
      { type: 'semantic', content: 'User is testing note tagging.', confidence: 0.8, reason: 'Explicit in content' },
    ],
    ...overrides,
  };
}

/** Drain pending async handler work (IndexedDB + mocked promise chains). */
async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('NoteTagger', () => {
  beforeEach(async () => {
    await resetNotesDb();
    await resetJournalDb();
    resetLlmService();
    resetNoteTagger();
  });

  describe('end-to-end tracer (note:saved → handler → LlmService.generate → NoteTaggerResult)', () => {
    it('emits note:enriched with both partitions when a note is saved', async () => {
      const generateSpy = vi
        .spyOn(getLlmService(), 'generate')
        .mockResolvedValue(validTaggerResult());
      getNoteTagger().setAdapter(createMockAdapter());
      getNoteTagger().initNoteTagger();

      const enrichedListener = vi.fn();
      const unsubscribe = on('note:enriched', enrichedListener);
      try {
        const note = makeNote({ content: 'A note about camping and mountains.' });
        await notesDb.save(note);
        await flushAsync();

        expect(generateSpy).toHaveBeenCalledTimes(1);
        expect(generateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            tier: 'FAST',
            schema: NoteTaggerResultSchema,
          }),
        );
        expect(enrichedListener).toHaveBeenCalledTimes(1);
        const payload = enrichedListener.mock.calls[0][0] as {
          noteId: string;
          enrichment: NoteTaggerResult['enrichment'];
          memoryFacts: NoteTaggerResult['memoryFacts'];
        };
        expect(payload.noteId).toBe(note.id);
        expect(Array.isArray(payload.enrichment.tags)).toBe(true);
        expect(payload.enrichment.tags.length).toBeGreaterThan(0);
        expect(Array.isArray(payload.memoryFacts)).toBe(true);
        for (const fact of payload.memoryFacts) {
          expect(fact.confidence).toBeGreaterThanOrEqual(0);
          expect(fact.confidence).toBeLessThanOrEqual(1);
        }
      } finally {
        unsubscribe();
      }
    });

    it('discards stale suggestions when the note version changes before the response arrives', async () => {
      let resolveGenerate: ((value: NoteTaggerResult) => void) | null = null;
      const generateSpy = vi.spyOn(getLlmService(), 'generate').mockReturnValue(
        new Promise<NoteTaggerResult>((resolve) => {
          resolveGenerate = resolve;
        }),
      );
      getNoteTagger().setAdapter(createMockAdapter());
      getNoteTagger().initNoteTagger();

      const enrichedListener = vi.fn();
      const unsubscribe = on('note:enriched', enrichedListener);
      try {
        const note = makeNote({ content: 'first version' });
        await notesDb.save(note); // handler captures version 1, awaits generate
        // Bump the version WITHOUT re-emitting note:saved (D-07: the edit
        // happens while the LLM response is in flight — restore() is a raw
        // non-journaled put).
        await notesDb.restore({ ...note, content: 'edited while LLM in flight', version: 2 });
        expect(generateSpy).toHaveBeenCalledTimes(1);

        resolveGenerate!(validTaggerResult());
        await flushAsync();

        expect(enrichedListener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    });
  });

  describe('analyze()', () => {
    it('calls LlmService.generate with FAST tier and NoteTaggerResultSchema', async () => {
      const generateSpy = vi
        .spyOn(getLlmService(), 'generate')
        .mockResolvedValue(validTaggerResult());
      const adapter = createMockAdapter();

      const result = await getNoteTagger().analyze(adapter, 'note-1', 'content', 1);

      expect(generateSpy).toHaveBeenCalledTimes(1);
      const params = generateSpy.mock.calls[0][0];
      expect(params.tier).toBe('FAST');
      expect(params.schema).toBe(NoteTaggerResultSchema);
      expect(params.userPrompt).toContain('content');
      expect(result).toEqual(validTaggerResult());
    });

    it('returns Zod-validated output of the correct type through LlmService', async () => {
      // LlmService.generate itself validates via generateWithRepair → repairJSON.
      vi.spyOn(getLlmService(), 'generate').mockResolvedValue(validTaggerResult());
      const result = await getNoteTagger().analyze(createMockAdapter(), 'note-1', 'content', 1);
      const parsed = NoteTaggerResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.enrichment.tags).toBeInstanceOf(Array);
      }
    });

    it('silently discards PipelineError — returns null instead of throwing', async () => {
      vi.spyOn(getLlmService(), 'generate').mockRejectedValue(
        new PipelineError('SCHEMA_INVALID', 'AI response did not match expected schema.'),
      );

      const result = await getNoteTagger().analyze(createMockAdapter(), 'note-1', 'content', 1);
      expect(result).toBeNull();
    });
  });

  describe('initNoteTagger() idempotency', () => {
    it('second call is a no-op — a single save triggers exactly one LLM call', async () => {
      const generateSpy = vi
        .spyOn(getLlmService(), 'generate')
        .mockResolvedValue(validTaggerResult());
      getNoteTagger().setAdapter(createMockAdapter());

      getNoteTagger().initNoteTagger();
      getNoteTagger().initNoteTagger();

      const note = makeNote();
      await notesDb.save(note);
      await flushAsync();

      expect(generateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('NotesDB v5 + MigrationRunner v5', () => {
    it('migration v5 creates the backup_config store with keyPath id', async () => {
      await migrationRunner.migrate('NotesDB', 5);
      const db = await openDB('NotesDB', 5);
      try {
        expect(db.objectStoreNames.contains('backup_config')).toBe(true);
        const store = db.transaction('backup_config', 'readonly').objectStore('backup_config');
        expect(store.keyPath).toBe('id');
      } finally {
        db.close();
      }
    });

    it('notes DB opens at version 5', async () => {
      const note = makeNote();
      await notesDb.save(note);
      const db = await openDB('NotesDB', 5);
      try {
        expect(db.version).toBe(5);
        expect(db.objectStoreNames.contains('notes')).toBe(true);
      } finally {
        db.close();
      }
    });

    it('getByLastSyncedAt returns undefined for notes without the field', async () => {
      const note = makeNote();
      await notesDb.save(note);
      expect(await notesDb.getByLastSyncedAt(note.id)).toBeUndefined();
    });

    it('updateLastSyncedAt persists the timestamp', async () => {
      const note = makeNote();
      await notesDb.save(note);
      await notesDb.updateLastSyncedAt(note.id, 123456);
      expect(await notesDb.getByLastSyncedAt(note.id)).toBe(123456);
    });
  });
});
