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
import { CONFIDENCE_MAP } from '../../../src/core/memory/MemoryRecord';
import {
  MIN_CONFIDENCE,
  MAX_MEMORY_FACTS,
} from '../../../src/core/notes/NoteTagger';

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

  describe('enrichment behaviors (D-04 / D-06 / D-03 / error handling)', () => {
    it('filters memoryFacts with confidence < 0.3', () => {
      const result = validTaggerResult({
        memoryFacts: [
          { type: 'semantic', content: 'low', confidence: 0.1, reason: 'uncertain' },
          { type: 'semantic', content: 'mid', confidence: 0.45, reason: 'ok' },
          { type: 'semantic', content: 'edge', confidence: 0.3, reason: 'exactly at threshold' },
          { type: 'semantic', content: 'high', confidence: 0.9, reason: 'confident' },
        ],
      });

      const filtered = getNoteTagger().filterMemoryFacts(result.memoryFacts);

      expect(filtered.map((f) => f.content)).toEqual(['mid', 'edge', 'high']);
      expect(filtered.every((f) => f.confidence >= MIN_CONFIDENCE)).toBe(true);
    });

    it('caps memoryFacts at 3 after filtering', () => {
      const facts = Array.from({ length: 5 }, (_, i) => ({
        type: 'semantic' as const,
        content: `fact ${i}`,
        confidence: 0.9,
        reason: 'confident',
      }));

      const filtered = getNoteTagger().filterMemoryFacts(facts);

      expect(filtered).toHaveLength(MAX_MEMORY_FACTS);
      expect(filtered.map((f) => f.content)).toEqual(['fact 0', 'fact 1', 'fact 2']);
    });

    it('skips the LLM call entirely when all enrichment toggles are off (D-06)', async () => {
      const generateSpy = vi.spyOn(getLlmService(), 'generate').mockResolvedValue(validTaggerResult());
      getNoteTagger().setAdapter(createMockAdapter());
      getNoteTagger().setToggles({ autoTag: false, autoCategorize: false, autoSummary: false });
      getNoteTagger().initNoteTagger();

      const enrichedListener = vi.fn();
      const unsubscribe = on('note:enriched', enrichedListener);
      try {
        await notesDb.save(makeNote());
        await flushAsync();

        expect(generateSpy).not.toHaveBeenCalled();
        expect(enrichedListener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    });

    it('still calls the LLM but discards memoryFacts when memory extraction is off (D-06)', async () => {
      const generateSpy = vi
        .spyOn(getLlmService(), 'generate')
        .mockResolvedValue(validTaggerResult({ memoryFacts: [{ type: 'semantic', content: 'x', confidence: 0.9, reason: 'r' }] }));
      getNoteTagger().setAdapter(createMockAdapter());
      getNoteTagger().setToggles({ memoryExtraction: false });
      getNoteTagger().initNoteTagger();

      const enrichedListener = vi.fn();
      const unsubscribe = on('note:enriched', enrichedListener);
      try {
        await notesDb.save(makeNote());
        await flushAsync();

        expect(generateSpy).toHaveBeenCalledTimes(1);
        expect(enrichedListener).toHaveBeenCalledTimes(1);
        const payload = enrichedListener.mock.calls[0][0] as { memoryFacts: unknown[] };
        expect(payload.memoryFacts).toEqual([]);
      } finally {
        unsubscribe();
      }
    });

    it('emits note:enriched with both partitions on success (D-05 in-memory suggestions)', async () => {
      const generated = validTaggerResult({
        memoryFacts: [
          { type: 'semantic', content: 'a', confidence: 0.8, reason: 'r1' },
          { type: 'semantic', content: 'b', confidence: 0.95, reason: 'r2' },
        ],
      });
      vi.spyOn(getLlmService(), 'generate').mockResolvedValue(generated);
      getNoteTagger().setAdapter(createMockAdapter());
      getNoteTagger().initNoteTagger();

      const enrichedListener = vi.fn();
      const unsubscribe = on('note:enriched', enrichedListener);
      try {
        const note = makeNote();
        await notesDb.save(note);
        await flushAsync();

        expect(enrichedListener).toHaveBeenCalledTimes(1);
        const payload = enrichedListener.mock.calls[0][0] as {
          noteId: string;
          enrichment: NoteTaggerResult['enrichment'];
          memoryFacts: NoteTaggerResult['memoryFacts'];
        };
        expect(payload.noteId).toBe(note.id);
        expect(payload.enrichment.tags).toEqual(generated.enrichment.tags);
        expect(payload.enrichment.categoryPath).toBe(generated.enrichment.categoryPath);
        expect(payload.enrichment.summary).toBe(generated.enrichment.summary);
        expect(payload.memoryFacts).toEqual(generated.memoryFacts);
      } finally {
        unsubscribe();
      }
    });

    it('silently discards on PipelineError — no event emitted, no throw propagated', async () => {
      vi.spyOn(getLlmService(), 'generate').mockRejectedValue(
        new PipelineError('SCHEMA_INVALID', 'AI response did not match expected schema.'),
      );
      getNoteTagger().setAdapter(createMockAdapter());
      getNoteTagger().initNoteTagger();

      const enrichedListener = vi.fn();
      const unsubscribe = on('note:enriched', enrichedListener);
      try {
        const result = await notesDb.save(makeNote());
        expect(result.success).toBe(true);
        await flushAsync();

        expect(enrichedListener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    });

    it('maps accepted memory facts to inferred confidence 0.5 via toMemoryFactInput (D-03)', () => {
      const fact = { type: 'semantic' as const, content: 'User prefers hiking.', confidence: 0.9, reason: 'stated' };

      const input = getNoteTagger().toMemoryFactInput(fact, fact.confidence);

      expect(input.memoryType).toBe('semantic');
      expect(input.content).toBe('User prefers hiking.');
      // D-03: the LLM self-score is NEVER the system tier — the store derives
      // confidence from `source` via the immutable CONFIDENCE_MAP.
      expect(input.source).toBe('inferred');
      expect(CONFIDENCE_MAP[input.source]).toBe(0.5);
      expect(input).not.toHaveProperty('confidence');
    });

    it('uses the payload version from note:saved when present (D-07)', async () => {
      let resolveGenerate: ((value: NoteTaggerResult) => void) | null = null;
      vi.spyOn(getLlmService(), 'generate').mockReturnValue(
        new Promise<NoteTaggerResult>((resolve) => {
          resolveGenerate = resolve;
        }),
      );
      getNoteTagger().setAdapter(createMockAdapter());
      getNoteTagger().initNoteTagger();

      const enrichedListener = vi.fn();
      const unsubscribe = on('note:enriched', enrichedListener);
      try {
        const note = makeNote();
        await notesDb.save(note); // payload carries version: 1
        // Version bumped while LLM in flight (raw put, no re-emit)
        await notesDb.restore({ ...note, version: 2 });

        resolveGenerate!(validTaggerResult());
        await flushAsync();

        expect(enrichedListener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
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
