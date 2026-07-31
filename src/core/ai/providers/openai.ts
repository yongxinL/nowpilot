import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ProviderAdapter } from './ProviderAdapter';
import type { PipelineProviderId, ModelTier } from '../types';

export function createOpenAIAdapter(apiKey: string, baseURL?: string): ProviderAdapter {
  const client = createOpenAI({ apiKey, baseURL });

  return {
    providerId: 'openai' as PipelineProviderId,

    createLanguageModel(modelId: string): LanguageModel {
      return client.chat(modelId);
    },

    get supportsStructuredOutput(): boolean {
      return true;
    },

    async validateConnection(): Promise<{ ok: boolean; models: string[] }> {
      try {
        const url = baseURL
          ? `${baseURL.replace(/\/+$/, '')}/models`
          : 'https://api.openai.com/v1/models';
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) return { ok: false, models: [] };
        const data = (await res.json()) as { data: Array<{ id: string }> };
        return { ok: true, models: (data.data ?? []).slice(0, 20).map((m: { id: string }) => m.id) };
      } catch {
        return { ok: false, models: [] };
      }
    },

    getDefaultModelForTier(tier: ModelTier): string {
      const mapping: Record<ModelTier, string> = {
        FAST: 'gpt-4o-mini',
        BALANCED: 'gpt-4o',
        ADVANCED: 'o3-mini',
      };
      return mapping[tier];
    },

    getCacheStrategy(): 'prefix-only' {
      return 'prefix-only';
    },

    getTelemetryMetadata(): Record<string, unknown> {
      return { provider: 'openai' };
    },
  };
}
