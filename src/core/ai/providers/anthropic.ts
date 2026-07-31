import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import type { ProviderAdapter } from './ProviderAdapter';
import type { PipelineProviderId, ModelTier } from '../types';

export function createAnthropicAdapter(apiKey: string): ProviderAdapter {
  const client = createAnthropic({ apiKey });

  return {
    providerId: 'anthropic' as PipelineProviderId,

    createLanguageModel(modelId: string): LanguageModel {
      return client.chat(modelId);
    },

    get supportsStructuredOutput(): boolean {
      return true;
    },

    async validateConnection(): Promise<{ ok: boolean; models: string[] }> {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-latest',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        if (res.ok || res.status === 400) {
          return {
            ok: true,
            models: [
              'claude-haiku-4-latest',
              'claude-sonnet-4-latest',
              'claude-opus-4-latest',
            ],
          };
        }
        return { ok: false, models: [] };
      } catch {
        return { ok: false, models: [] };
      }
    },

    getDefaultModelForTier(tier: ModelTier): string {
      const mapping: Record<ModelTier, string> = {
        FAST: 'claude-haiku-4-latest',
        BALANCED: 'claude-sonnet-4-latest',
        ADVANCED: 'claude-opus-4-latest',
      };
      return mapping[tier];
    },

    getCacheStrategy(): 'anthropic-ephemeral' {
      return 'anthropic-ephemeral';
    },

    getTelemetryMetadata(): Record<string, unknown> {
      return { provider: 'anthropic' };
    },
  };
}
