import { createOllama } from 'ollama-ai-provider';
import type { LanguageModel } from 'ai';
import type { ProviderAdapter } from './ProviderAdapter';
import type { PipelineProviderId, ModelTier } from '../types';

export function createOllamaAdapter(baseURL?: string): ProviderAdapter {
  const client = createOllama({ baseURL });

  return {
    providerId: 'ollama' as PipelineProviderId,

    createLanguageModel(modelId: string): LanguageModel {
      return client(modelId) as unknown as LanguageModel;
    },

    get supportsStructuredOutput(): boolean {
      return false;
    },

    async validateConnection(): Promise<{ ok: boolean; models: string[] }> {
      try {
        const url = baseURL
          ? `${baseURL.replace(/\/+$/, '')}/tags`
          : 'http://localhost:11434/api/tags';
        const res = await fetch(url);
        if (!res.ok) return { ok: false, models: [] };
        const data = (await res.json()) as { models: Array<{ name: string }> };
        const models = (data.models ?? []).map((m) => m.name);
        return { ok: true, models };
      } catch {
        return { ok: false, models: [] };
      }
    },

    getDefaultModelForTier(tier: ModelTier): string {
      const mapping: Record<ModelTier, string> = {
        FAST: 'llama3.2:3b',
        BALANCED: 'llama3.2',
        ADVANCED: 'llama3.2:70b',
      };
      return mapping[tier];
    },

    getCacheStrategy(): 'prefix-only' {
      return 'prefix-only';
    },

    getTelemetryMetadata(): Record<string, unknown> {
      return { provider: 'ollama', baseURL: baseURL ?? 'http://localhost:11434' };
    },
  };
}
