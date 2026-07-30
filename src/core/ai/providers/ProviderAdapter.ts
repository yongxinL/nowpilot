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
}
