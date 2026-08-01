import { z } from 'zod';

/**
 * Memory taxonomy (D-04): every memory record carries a memoryType.
 * Phase 5 stores/retrieves by type; Phase 5b adds lifecycle/governance.
 */
export const MemoryTypeSchema = z.enum(['working', 'episodic', 'semantic', 'preference', 'procedural']);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

/**
 * Confidence provenance (D-07): confidence is source-based and immutable —
 * assigned at creation, never modified by retrieval frequency.
 */
export const ConfidenceSourceSchema = z.enum(['explicit-user', 'verified-state', 'previous-explicit', 'inferred']);
export type ConfidenceSource = z.infer<typeof ConfidenceSourceSchema>;

/**
 * D-07 trust-gate mapping. The SINGLE mapping authority — UserMemoryStore.upsert
 * derives confidence exclusively from this table. Wrong values here corrupt
 * Phase 5b conflict resolution.
 */
export const CONFIDENCE_MAP: Record<ConfidenceSource, number> = {
  'explicit-user': 1.0,
  'verified-state': 0.8,
  'previous-explicit': 0.7,
  inferred: 0.5,
};

/**
 * Base memory record schema (D-04 taxonomy, D-07 immutable confidence).
 * `confidence` is assigned at creation and never mutated afterwards.
 */
export const MemoryRecordSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  memoryType: MemoryTypeSchema,
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  source: ConfidenceSourceSchema,
  useCount: z.number().int().nonnegative().default(0),
  sensitivity: z.enum(['public', 'private', 'confidential']),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastUsedAt: z.number().optional(),
  verifiedAt: z.number().optional(),
});

export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

/**
 * User memory facts are always semantic by taxonomy (D-04).
 */
export const UserMemoryFactSchema = MemoryRecordSchema.extend({
  memoryType: z.literal('semantic'),
});
export type UserMemoryFact = MemoryRecord & { memoryType: 'semantic' };

/**
 * LLM conversation summary artifact (D-10): 2-3 sentences capturing
 * decisions/goals/preferences/facts/open tasks over a message range.
 */
export const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string(),
  summary: z.string().min(1),
  messageRange: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  }),
  createdAt: z.number(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

/**
 * Behavioral preference record (persona config `np_persona` lives here,
 * never in UserMemoryStore — R2 reconciliation).
 */
export const PreferenceRecordSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: z.number(),
});
export type PreferenceRecord = z.infer<typeof PreferenceRecordSchema>;

/**
 * Scored retrieval result (UI-SPEC RetrievedMemory contract) — record plus
 * the D-08 composite score and human-readable match reasons.
 */
export const RetrievedMemorySchema = z.object({
  record: MemoryRecordSchema,
  retrievalScore: z.number().min(0).max(1),
  relevanceReasons: z.array(z.string()),
});
export type RetrievedMemory = z.infer<typeof RetrievedMemorySchema>;

/**
 * Conversation context assembly result (D-10): optional summary plus the
 * tier-gated tail of recent messages.
 */
export const ConversationContextSchema = z.object({
  summary: ConversationSummarySchema.nullable(),
  recentMessages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'tool']),
      content: z.string(),
      timestamp: z.number(),
    }),
  ),
});
export type ConversationContext = z.infer<typeof ConversationContextSchema>;
