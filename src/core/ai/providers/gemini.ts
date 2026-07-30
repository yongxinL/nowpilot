import { createGoogle } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { ProviderAdapter } from './ProviderAdapter';
import type { PipelineProviderId, ModelTier } from '../types';

export function createGeminiAdapter(apiKey: string): ProviderAdapter {
  const google = createGoogle({ apiKey });

  return {
    providerId: 'gemini' as PipelineProviderId,

    createLanguageModel(modelId: string): LanguageModel {
      return google(modelId);
    },

    get supportsStructuredOutput(): boolean {
      return true;
    },

    async validateConnection(): Promise<{ ok: boolean; models: string[] }> {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        );
        if (!res.ok) return { ok: false, models: [] };
        const data = (await res.json()) as { models: Array<{ name: string }> };
        const models = (data.models ?? []).map((m) => m.name.replace(/^models\//, ''));
        return { ok: true, models };
      } catch {
        return { ok: false, models: [] };
      }
    },

    getDefaultModelForTier(tier: ModelTier): string {
      const mapping: Record<ModelTier, string> = {
        FAST: 'gemini-2.0-flash-lite',
        BALANCED: 'gemini-2.0-flash',
        ADVANCED: 'gemini-2.5-pro',
      };
      return mapping[tier];
    },

    getCacheStrategy(): 'prefix-only' {
      return 'prefix-only';
    },

    getTelemetryMetadata(): Record<string, unknown> {
      return { provider: 'gemini' };
    },
  };
}
