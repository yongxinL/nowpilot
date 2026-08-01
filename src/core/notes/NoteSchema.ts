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
});

export type Note = z.infer<typeof NoteSchema>;

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
