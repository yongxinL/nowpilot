import type { LanguageModel } from 'ai';
import type { PipelineProviderId, ModelTier } from '../types';

export interface ProviderAdapter {
  providerId: PipelineProviderId;
  createLanguageModel(modelId: string): LanguageModel;
  validateConnection(): Promise<{ ok: boolean; models: string[] }>;
  supportsStructuredOutput: boolean;
  getDefaultModelForTier(tier: ModelTier): string;
  getCacheStrategy(): 'anthropic-ephemeral' | 'gemini-cachedContent' | 'prefix-only';
  getTelemetryMetadata(): Record<string, unknown>;
  /**
   * Optional provider-native token counting (D-09). Adapters whose SDK
   * exposes a standalone counter implement this; TokenBudget orchestrates
   * between the native counter and the character-heuristic fallback.
   */
  countTokens?(text: string): Promise<number>;
}

/**
 * Post-response cache signal normalized by the provider adapter/router per
 * D-15. recordResponse() consumes this; fields absent from a provider's
 * response default to false/undefined — unknown cache status is treated as
 * a miss by PromptCacheManager (§19.13 semantics).
 */
export interface CacheResponseMetadata {
  providerId: PipelineProviderId;
  cacheHit: boolean;
  cacheWrite: boolean;
  /**
   * Explicit cache-status signal (WR-09). When the provider adapter does
   * not report native cache usage, callers must pass `'unknown'` so the
   * response is recorded without feeding the §19.13 miss cascade —
   * fabricated misses would disable the cache permanently. When absent,
   * the status is derived from `cacheHit` (hit/miss), preserving the
   * legacy behavior for callers that do report real metadata.
   */
  cacheStatus?: 'hit' | 'miss' | 'unknown';
  providerCacheId?: string;
  estimatedSavedTokens?: number;
}
