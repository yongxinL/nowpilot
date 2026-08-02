import type { z } from 'zod';
import { generateWithRepair } from './StructuredOutput';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { ModelTier } from './types';

export interface LlmGenerateParams<T> {
  adapter: ProviderAdapter;
  tier: ModelTier;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  abortSignal?: AbortSignal;
}

/**
 * Shared structured-LLM facade (D-08) for non-orchestration consumers
 * (NoteTagger, NoteQA, NoteChatConverter, and future services).
 *
 * Wraps `generateWithRepair` from StructuredOutput.ts — the single JSON
 * repair pipeline (fence stripping, trailing-comma cleanup, brace
 * balancing, Zod validation). Error semantics are inherited unchanged:
 * PipelineError is re-thrown directly, AbortError maps to
 * PipelineError('ABORTED'), and anything else maps to
 * PipelineError('UNKNOWN').
 *
 * AgentOrchestrator remains the path for chat/agent tool-calling flows —
 * this facade is for structured-output calls only.
 */
export class LlmService {
  async generate<T>(params: LlmGenerateParams<T>): Promise<T> {
    const prompt = [params.systemPrompt, params.userPrompt].join('\n\n');
    return generateWithRepair(
      params.adapter,
      params.tier,
      prompt,
      params.schema,
      params.abortSignal,
    );
  }
}

// ── Singleton (module-level, MemoryEngine/ContextOptimizer pattern) ─────────
let _instance: LlmService | null = null;

export function getLlmService(): LlmService {
  if (!_instance) {
    _instance = new LlmService();
  }
  return _instance;
}

export function resetLlmService(): void {
  _instance = null;
}
