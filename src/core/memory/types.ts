/**
 * Canonical Phase-8 memory-type home — Appendix C.1 / §3.4/§3.5
 * (PRODUCT_SPEC_v0_1.md:4571-4595, 601-612), verbatim.
 *
 * This file is the SINGLE canonical declaration site for the memory types
 * (D-112/D-113): `RetrievedMemory`, `UserPreferences` (+ schema), and
 * `UserMemoryFact`. No parallel copies — alias targets are authoritative
 * (spec 4833 canonical-home rule).
 *
 * Supersession targets (re-export these from here):
 *   - src/core/context/types.ts — RetrievedMemory (replaces local declaration)
 *   - src/core/ai/UserPreferences.ts — UserPreferences + schema + enums
 *   - src/core/storage/MemoryDB.ts — UserMemoryFact (replaces bootstrap shape)
 *
 * Scope fence: memory governance records are Phase 10 (spec 4903-4915) —
 * do NOT declare memory-kind or memory-record types here.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// RetrievedMemory — spec 4572-4578 (verbatim)
// ---------------------------------------------------------------------------

/** A single retrieved memory item with relevance score. */
export interface RetrievedMemory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  score: number;
}

// ---------------------------------------------------------------------------
// UserPreferences — full §3.5 (spec 4579-4595) + additive D-54 fields
// ---------------------------------------------------------------------------

/** Locked §21.6 tone enum (D-58) — const array exported for reuse. */
export const PERSONA_TONE_ENUM = ['professional-warm', 'concise', 'friendly'] as const;
export type PersonaTone = (typeof PERSONA_TONE_ENUM)[number];

/** Locked §21.6 brevity enum (D-58) — const array exported for reuse. */
export const PERSONA_BREVITY_ENUM = ['brief', 'balanced', 'detailed'] as const;
export type PersonaBrevity = (typeof PERSONA_BREVITY_ENUM)[number];

/** Persona override fields (RICH-R-02 data-merge). */
export const personaOverridesSchema = z.object({
  name: z.string().min(1).optional(),
  tone: z.enum(PERSONA_TONE_ENUM).optional(),
  brevity: z.enum(PERSONA_BREVITY_ENUM).optional(),
});
export type PersonaOverrides = z.infer<typeof personaOverridesSchema>;

/**
 * Full §3.5 UserPreferences schema (spec 4579-4595) + additive D-54
 * fastModel/balancedModel fields. Canonical home (D-112).
 */
export const UserPreferencesSchema = z.object({
  /** §3.5: preferred response style. */
  responseStyle: z.enum(['bullet', 'paragraph', 'mixed']).default('mixed'),
  /** §3.5: preferred language for responses. */
  preferredLanguage: z.string().default('en'),
  /** §3.5: prefer structured (JSON) output when available. */
  preferStructuredOutput: z.boolean().default(true),
  /** §3.5: allow cloud fallback from local providers. */
  allowCloudFallbackFromLocal: z.boolean().default(false),
  /** §3.5: default provider ID (optional). */
  defaultProviderId: z.string().optional(),
  /** §3.5: tool autonomy level. */
  toolAutonomy: z.enum(['ask', 'auto', 'restricted']).default('ask'),
  /** §3.5: default surface. */
  defaultSurface: z.enum(['sidepanel', 'standalone']).default('sidepanel'),
  /** §3.5: active persona ID (links to np_persona). */
  personaId: z.string().optional(),
  /** RICH-R-02 data-merge overrides applied at render time by PersonaInjector. */
  personaOverrides: personaOverridesSchema.optional(),
  /** D-54 write-through target: fast-tier model the operator assigned. */
  fastModel: z.string().optional(),
  /** D-54 write-through target: balanced-tier model the operator assigned. */
  balancedModel: z.string().optional(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// ---------------------------------------------------------------------------
// UserMemoryFact — §3.4 canonical shape (spec 601-612, verbatim)
// ---------------------------------------------------------------------------

/**
 * Canonical §3.4 user memory fact. Replaces the Phase-2 bootstrap shape
 * at src/core/storage/MemoryDB.ts (D-104). Write-empty store = zero migration.
 */
export interface UserMemoryFact {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  confidence: number;
  source: 'explicit' | 'inferred' | 'system';
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
}
