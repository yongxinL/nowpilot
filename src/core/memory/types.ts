// src/core/memory/types.ts — Source: PRODUCT_SPEC Appendix C lines 4541-4567
// (verbatim) / Appendix C.1 canonical-home note (line 4775: "UserPreferences and
// RetrievedMemory remain in @/core/memory/types"). P-3b: canonical home for
// RetrievedMemory + UserPreferences. R-1: single declaration — src/core/ai/types.ts
// imports (never re-declares) them; Phase-5 PreferenceMemoryStore/UserMemoryStore
// consume these same shapes.
import { z } from 'zod';
import type { ProviderId } from '../ai/types';

export interface RetrievedMemory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  score: number;
}

export interface UserPreferences {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  preferredLanguage: string;
  preferStructuredOutput: boolean;
  allowCloudFallbackFromLocal: boolean;
  defaultProviderId?: ProviderId;
  toolAutonomy: 'ask_every_time' | 'allow_safe_tools' | 'manual_only';
  defaultSurface: 'sidepanel' | 'standalone';
  // theme is NOT here — display mode (np_theme) + theme pack (np_theme_pack) are the
  // single source of truth in chrome.storage.sync (§17.1a, §15.1, Appendix F).
  // --- RICH persona (reconciliation R2: user config, NOT a fact) ---
  personaId?: string;
  personaOverrides?: {
    name?: string;
    tone?: 'professional-warm' | 'concise' | 'friendly';
    brevity?: 'brief' | 'balanced' | 'detailed';
  };
}

// ---------------------------------------------------------------------------
// Phase 5 — Knowledge Base (KNW-04 / D-05-01, R-1 canonical additions)
// Source: PRODUCT_SPEC §3.3 ConversationMemory (L551-560), §3.4 UserMemoryFact
// (L578-586), §21.3 ConversationMeta (L3401-3419) + §15.1 LRU semantics, and
// Phase-5 RESEARCH Pattern 3 (MemoryInjection DTO). R-1: the C.1 home — stores
// (ConversationMemoryStore / UserMemoryStore / PreferenceMemoryStore 05-02..04)
// import these from here, never re-declare them anywhere else.
// ---------------------------------------------------------------------------

/** §3.4 verbatim (L578-586): one durable cross-session memory fact. */
export interface UserMemoryFact {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  confidence: number; // 0..1
  source: 'explicit' | 'inferred' | 'system';
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
}

/** §3.3 verbatim (L551-560): per-conversation rolling summary + recent turns. */
export interface ConversationMemory {
  conversationId: string;
  summary: string;
  summaryTokens: number;
  lastMessages: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string;
    tokens: number;
    timestamp: number;
  }>;
  updatedAt: number;
}

/** §21.3 (L3401-3419) + §15.1 LRU semantics: lightweight conversation metadata. */
export interface ConversationMeta {
  conversationId: string;
  status: 'active' | 'archived';
  messageCount: number;
  lastAccessed: number;
  updatedAt: number;
  summary?: string;
}

/** Phase-5 RESEARCH Pattern 3 (D-05-02/05-07): the MemoryEngine → surface DTO. */
export interface MemoryInjection {
  memories: RetrievedMemory[]; // top-5 (top-3 tiny), scores [0,1], ≤1000 tokens total
  workingMemoryBlock: string; // ≤300 tokens, injected BEFORE facts (D-05-09)
  preferences: UserPreferences; // compact JSON source for the preferences section (D-05-08)
}

/**
 * GR-4 / D-05-08: zod 3 boundary validator co-located beside UserPreferences
 * (harness.ts L211-251 co-location precedent). The np_persona write gate
 * PreferenceMemoryStore uses — mirrors UserPreferences EXACTLY.
 */
export const UserPreferencesSchema = z.object({
  responseStyle: z.enum(['concise', 'balanced', 'detailed']),
  preferredLanguage: z.string(),
  preferStructuredOutput: z.boolean(),
  allowCloudFallbackFromLocal: z.boolean(),
  defaultProviderId: z.string().optional(),
  toolAutonomy: z.enum(['ask_every_time', 'allow_safe_tools', 'manual_only']),
  defaultSurface: z.enum(['sidepanel', 'standalone']),
  personaId: z.string().optional(),
  personaOverrides: z
    .object({
      name: z.string().optional(),
      tone: z.enum(['professional-warm', 'concise', 'friendly']).optional(),
      brevity: z.enum(['brief', 'balanced', 'detailed']).optional(),
    })
    .optional(),
});
