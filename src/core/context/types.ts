// Minimal input shapes for the Phase 5 context layer (plan 05-01, Task 1) +
// the shared strategy types ContextOptimizer/ContextCompressor depend on.
//
// These are SUPERSESSION POINTS — minimal local declarations whose canonical
// homes live in later owning phases (the Phase-3 UserPreferences precedent at
// src/core/ai/UserPreferences.ts:1-6):
//   - PageContext     → Phase 6 replaces in place at src/core/content/PageContext.ts (spec 4345)
//   - RetrievedMemory → Phase 8 replaces at src/core/memory/types.ts (spec 4571)
//   - ToolSchemaRef   → Phase 18 owns the real registry type at src/core/ai/toolSchemas.ts (spec 4600)
//
// The shapes are declared verbatim from PRODUCT_SPEC_v0_1.md Appendix C
// (spec 4346-4357, 4572-4578, 4601-4607). They are plain TS interfaces — the
// owning phases ship the zod versions. Phase 5 is create-only (D-69): it must
// not edit those owning files.
import type { PromptSection } from '../ai/types';

/** PageContext supersession point — Phase 6 owns src/core/content/PageContext.ts (spec 4346-4357). */
export interface PageContext {
  url: string;
  origin: string;
  hostname: string;
  title: string;
  html?: string;
  markdown?: string;
  meta: Record<string, string>;
  extractedAt: number;
  addonId?: string;
  addonFields?: Record<string, unknown>;
}

/** RetrievedMemory supersession point — Phase 8 owns src/core/memory/types.ts (spec 4572-4578). */
export interface RetrievedMemory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  score: number;
}

/** ToolSchemaRef supersession point — Phase 18 owns the registry type (spec 4601-4607). */
export interface ToolSchemaRef {
  name: string;
  description: string;
  jsonSchema: unknown;
  dangerous: boolean;
  source: 'builtin' | 'mcp' | 'skill' | 'servicenow';
}

/** §2.6 compressionApplied union (spec 537) — recorded per section in the manifest. */
export type CompressionType = 'summarise' | 'structural' | 'topk';

/**
 * D-75 summariser seam — declare-now/populate-later (D-46/D-64 precedent).
 * Phase 5 never calls the LLM; a consumer-owned LLM-backed summariser plugs in
 * later. When absent, history truncation falls back to dropping older turns
 * (recorded as truncation, never silence).
 */
export interface Summarizer {
  summarize(sections: PromptSection[]): { text: string; tokens: number };
}