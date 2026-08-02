import { z } from 'zod';

/**
 * Provenance metadata for every note (D-16). `source` is always present;
 * the remaining fields describe import/chat-conversion provenance.
 */
export const NoteProvenanceSchema = z.object({
  source: z.enum(['user-created', 'import', 'chat-conversion', 'ai-generated']),
  importedAt: z.number().optional(),
  originalPath: z.string().optional(),
  conversationId: z.string().optional(),
  importSessionId: z.string().optional(),
});

export type NoteProvenance = z.infer<typeof NoteProvenanceSchema>;

/**
 * Atomic note schema (D-01, D-02, D-03, D-17).
 *
 * `content` is the single source of truth — `links[]` (resolved note IDs)
 * and `unresolvedLinks[]` (raw titles) are derived on every save by the
 * LinkParser and never edited by hand.
 */
export const NoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()),
  categoryPath: z.string().default(''),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number().int().nonnegative().default(1),
  provenance: NoteProvenanceSchema,
  links: z.array(z.string()).default([]),
  unresolvedLinks: z.array(z.string()).default([]),
  // ── Phase 5a additions (all optional — existing Phase 5 notes/tests unchanged) ──
  summary: z.string().optional(),
  lastSyncedAt: z.number().optional(), // D-11: NoteFileSync external-change detection
  summaryGeneratedAt: z.number().optional(), // NoteMaintenance staleness (D-21)
  tagsGeneratedAt: z.number().optional(), // NoteMaintenance staleness (D-21)
});

export type Note = z.infer<typeof NoteSchema>;

/**
 * NoteTagger structured output — single haiku-tier LLM call with two
 * explicit partitions (D-01): `enrichment` (note display suggestions) and
 * `memoryFacts` (memory extraction candidates). LLM-reported `confidence`
 * is display-only metadata (D-03); accepted facts are stored with
 * confidence 0.5 (inferred).
 */
export const NoteTaggerResultSchema = z.object({
  enrichment: z.object({
    tags: z.array(z.string()).max(5),
    categoryPath: z.string().nullable(),
    summary: z.string(),
    suggestedConcepts: z.array(
      z.object({
        slug: z.string(),
        label: z.string(),
        summary: z.string(),
      }),
    ).default([]),
  }),
  memoryFacts: z.array(
    z.object({
      type: z.enum(['semantic']),
      content: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    }),
  ).max(5),
});

export type NoteTaggerResult = z.infer<typeof NoteTaggerResultSchema>;
export type NoteEnrichment = NoteTaggerResult['enrichment'];
export type MemoryFact = NoteTaggerResult['memoryFacts'][number];

/**
 * NoteQA structured output — flash-tier RAG synthesis with numbered
 * citation markers (D-13). `citations` are post-processed from the LLM's
 * inline `[1]`, `[2]` reference markers.
 */
export const NoteQAResultSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      noteId: z.string(),
      title: z.string(),
      relevantSnippet: z.string(),
      referenceNumber: z.number().int().positive(),
    }),
  ),
});

export type NoteQAResult = z.infer<typeof NoteQAResultSchema>;

/**
 * NoteChatConverter structured output — haiku-tier pre-filled note draft
 * (D-20). Wikilinks remain proposals until the user accepts and saves.
 */
export const NoteDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  categoryPath: z.string(),
  wikilinks: z.array(z.string()),
});

export type NoteDraft = z.infer<typeof NoteDraftSchema>;

/**
 * Concept schema — schema-only in Phase 5 (D-14). Phase 5a NoteTagger
 * populates concepts with extraction logic.
 */
export const ConceptSchema = z.object({
  slug: z.string(),
  label: z.string(),
  summary: z.string(),
  noteIds: z.array(z.string()),
  aliases: z.array(z.string()),
  updatedAt: z.number(),
});

export type Concept = z.infer<typeof ConceptSchema>;
