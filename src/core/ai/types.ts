// src/core/ai/types.ts — Source: PRODUCT_SPEC Appendix C "Canonical Type Registry"
// (lines 4253-4313, 4570-4590) + §2.3 ContextOptimizer Contract (lines 455-477) +
// §21.4 BuiltinTool (line 3427). D-07/P-3: this file is the SINGLE canonical home for
// ProviderId, OptimizedContext, and PromptSection. R-1: exactly one declaration of
// each of these in the repo — no second copy anywhere (Phase-4 ContextOptimizer,
// PromptCacheAdapter (03-03), StructuredOutput (03-04), and ProviderRouter (03-05)
// all import from here).
//
// P-3b canonical homes: ModelContextTier/classifyModelContext,
// ContextProvenanceManifest, UserPreferences, and RetrievedMemory are seeded at
// their §8.5/Appendix-C homes and IMPORTED here — never re-declared (R-1).
//
// 03-09 (T-03-09-04, V5 Input Validation): ProviderConfigSchema is the Zod
// boundary gate the surface-mount wiring (runAIRuntimeInit) applies to every
// decrypted np_providers.<id> envelope BEFORE registerProvider — a tampered or
// non-config payload never reaches the registry as a raw provider.
import { z } from 'zod';

import type { ContextProvenanceManifest } from '../context/ContextProvenanceManifest';
import type { ModelContextTier } from '../context/ModelContextTier';
export { classifyModelContext } from '../context/ModelContextTier';
import type { RetrievedMemory, UserPreferences } from '../memory/types';
import type { PageContext } from '../content/PageContext';
import type { ToolSchemaRef } from './toolSchemas';

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  imageUrl?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
}

export interface LLMOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: BuiltinTool[];
  abortSignal?: AbortSignal;
}

export interface LLMStreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error';
  content: string;
  toolName?: string;
  toolInput?: unknown;
}

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow: number;
  supportsTools: boolean;
  group: 'local' | 'cloud';
}

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  apiKey?: string;
  baseURL: string;
  customBaseURL?: string;
  models: string[];
  contextWindow: number;
  supportsTools: boolean;
  enabled: boolean;
  priority: number;
  lastValidated?: number;
}

/**
 * T-03-09-04: the Zod boundary gate for decrypted np_providers.<id> envelopes.
 * Mirrors ProviderConfig exactly (R-1 — the interface stays the canonical
 * declaration; this schema is its runtime validator, co-located). The surface
 * wiring (runAIRuntimeInit, 03-09) runs every decrypted envelope through
 * safeParse BEFORE registerProvider — the four-ID rule, structural shape, and
 * apiKey presence are all enforced at the vault→registry boundary (V5 Input
 * Validation), never trusted from storage raw.
 */
export const ProviderConfigSchema = z.object({
  id: z.enum(['openai', 'anthropic', 'gemini', 'ollama']),
  label: z.string().min(1),
  apiKey: z.string().optional(),
  baseURL: z.string().min(1),
  customBaseURL: z.string().optional(),
  models: z.array(z.string().min(1)),
  contextWindow: z.number().int().positive(),
  supportsTools: z.boolean(),
  enabled: z.boolean(),
  priority: z.number().int().nonnegative(),
  lastValidated: z.number().optional(),
});

export type ProviderConfigInput = z.infer<typeof ProviderConfigSchema>;

// §21.4 Built-in Tool Descriptor (line 3427) — referenced by LLMOptions.tools.
// Spec-verbatim; declared here as the only home (no second copy, R-1).
export interface BuiltinTool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<unknown>;
  outputSchema: z.ZodSchema<unknown>;
  dangerous: boolean;
}

// Result returned by ExecutorService.execute() and consumed by AgentOrchestrator,
// OutcomeVerifier (Appendix O.2), and CandidateProposer evidence. Referenced across
// Appendix I/O — defined here as the single source of truth.
export interface ToolExecutionResult<T = unknown> {
  toolName: string; // used by OutcomeVerifier to pick a postcondition verifier
  ok: boolean;
  output?: T;
  error?: { code: string; message: string; retryable: boolean };
  evidence?: import('@/types/harness').CompletionEvidence; // set for side-effecting tools (§28.2)
  durationMs: number;
}

// P-3: PromptSection's canonical home is THIS file (moved here from the §8.5
// ContextOptimizer block; PromptCacheAdapter is a Phase-3 consumer). Phase-4
// ContextOptimizer imports it via `import type { PromptSection } from '../ai/types'`.
// 03a-01 (D-3a-11): the kind union gained 'tool_result' — the F-4 sections-in
// replan-feedback section kind (stable:false, per-turn). It maps to the provider
// `prompt` side via TASK_KINDS (BOTH ProviderRouter.ts and StructuredOutput.ts
// must list it — Pitfall 2) and NEVER enters CACHED_KINDS (cache-stability, F-4).
export interface PromptSection {
  kind:
    | 'system'
    | 'tool_schemas'
    | 'preferences'
    | 'memory'
    | 'context'
    | 'task'
    | 'user_input'
    | 'tool_result';
  text: string;
  tokens: number;
  stable: boolean;
  sourceId: string;
}

export interface ContextOptimizerInput {
  operationId: string;
  model: string;
  modelContextWindow: number;
  userInput: string;
  conversationId: string;
  workspaceId: string; // NEW in v0.1
  activeSurface: 'sidepanel' | 'standalone'; // NEW in v0.1
  pageContext?: PageContext;
  selectedToolSchemas: ToolSchemaRef[];
  memoryHints: RetrievedMemory[];
  preferences: UserPreferences;
  // 04-04 (flagged planner-discretion input extension, D-04-07 — additive only;
  // the OUTPUT shape is untouched): the §2.3 spec input omits these, but F-5's
  // byte-stable [SYSTEM] persona section requires personaBlock (Phase-3 bridged
  // via ContextHelperInput.personaBlock) and minimal mode needs the per-role
  // compact-prompt selection (D-04-11).
  /** Byte-stable block from PersonaInjector.buildPersonaBlock (D-10 seam). */
  personaBlock: string;
  /** Per-role compact-prompt selection (D-04-11): 'planner' | 'renderer'. */
  stage: 'planner' | 'renderer';
  /**
   * D-04-02 CTX-02 seam: a TYPED INPUT-ONLY re-pack signal — present when the
   * caller wants the optimizer to re-select/repack because context inputs
   * changed. StageEvent stays a TYPE, never an event bus (L1) — there is no
   * subscribe/publish/emit anywhere in the context layer. NO consumer in P4
   * (page/state-change triggers arrive with Phase 4a PageContextBridge /
   * Phase 7); the optimizer treats it as input-only and its output is identical
   * with or without it.
   */
  contextUpdate?: ContextUpdate;
}

/**
 * D-04-02 CTX-02: the typed re-pack signal vocabulary. Input-only by contract —
 * never published, never subscribed (L1); consumers arrive in Phase 4a/7.
 */
export type ContextUpdate = { type: 'page' | 'memory' | 'history' | 'state' };

export interface OptimizedContext {
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  sections: PromptSection[];
  provenance: ContextProvenanceManifest;
  minimalMode: boolean;
}
