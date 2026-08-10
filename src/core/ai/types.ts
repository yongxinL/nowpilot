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
import type { z } from 'zod';

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
export interface PromptSection {
  kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input';
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
}

export interface OptimizedContext {
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  sections: PromptSection[];
  provenance: ContextProvenanceManifest;
  minimalMode: boolean;
}
