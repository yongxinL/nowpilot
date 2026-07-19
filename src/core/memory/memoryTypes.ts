import { z } from 'zod';

// ---------------------------------------------------------------------------
// Interfaces (no dedicated Zod schema)
// ---------------------------------------------------------------------------

export interface MemoryScore {
  fact: UserMemoryFact;
  keywordScore: number;
  finalScore: number;
}

export interface ConversationSummary {
  conversationId: string;
  summary: string;
  messageCount: number;
  created: number;
  updated: number;
  state: 'active' | 'archived';
  archivedAt?: number;
}

export interface MemoryAssembleResult {
  memory: Array<{ id: string; content: string; score: number }>;
  conversationContext: {
    summary?: string;
    recentTurns: Array<{ role: string; content: string }>;
  };
  preferences: PreferencePayload;
}

export interface MemoryExtractionResult {
  facts: Array<
    Partial<UserMemoryFact> & {
      fact: string;
      category: string;
      confidence: number;
      tags: string[];
    }
  >;
  summary?: string;
}

export interface MemoryWriteRequest {
  type: 'upsert-fact' | 'update-summary' | 'archive-conversation';
  payload: unknown;
  surfaceId: string;
  timestamp: number;
  idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Zod schemas + inferred types (dual export pattern)
// ---------------------------------------------------------------------------

export const userMemoryFactSchema = z.object({
  id: z.string(),
  fact: z.string(),
  category: z.string(),
  confidence: z.number().min(0).max(1),
  created: z.number(),
  updated: z.number(),
  source: z.string(),
  status: z.enum(['active', 'superseded']),
  tags: z.array(z.string()),
  useCount: z.number(),
  lastUsedAt: z.number(),
});
export type UserMemoryFact = z.infer<typeof userMemoryFactSchema>;

export const extractionResultSchema = z.object({
  facts: z.array(
    z.object({
      fact: z.string(),
      category: z.string(),
      confidence: z.number().min(0).max(1),
      tags: z.array(z.string()),
    }),
  ),
  summary: z.string().optional(),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export const preferenceSchema = z.object({
  responseStyle: z.string(),
  preferredLanguage: z.string(),
  preferStructuredOutput: z.boolean(),
  allowCloudFallbackFromLocal: z.boolean(),
  defaultProviderId: z.string(),
  toolAutonomy: z.enum(['manual', 'allow-safe', 'allow-all']),
  // Phase 7.4: Persona identity overrides (D-11, D-21)
  displayName: z.string().optional(),
  aiName: z.string().optional(),
  aiTone: z.enum(['professional', 'professional_approachable']).optional(),
  responseBrevity: z.enum(['concise', 'balanced', 'detailed']).optional(),
});
export type PreferencePayload = z.infer<typeof preferenceSchema>;

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

export class MemoryCapExceededError extends Error {
  public readonly code = 'MEMORY_CAP_EXCEEDED' as const;
  public readonly currentCount: number;
  public readonly cap: number;

  constructor(currentCount: number, cap: number) {
    super(`Memory fact cap (${cap}) exceeded (${currentCount} facts)`);
    this.name = 'MemoryCapExceededError';
    this.currentCount = currentCount;
    this.cap = cap;
  }
}
