import { useApiKeyStore } from '../storage/ApiKeyStore';
import { PipelineError } from './PipelineError';
import { createOpenAIAdapter } from './providers/openai';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { PipelineProviderId } from './types';

export class ProviderRouter {
  async selectProvider(preferred: PipelineProviderId): Promise<ProviderAdapter> {
    const apiKey = await useApiKeyStore.getState().getKey(preferred);
    if (!apiKey) {
      throw new PipelineError(
        'PROVIDER_AUTH',
        `Authentication failed for ${preferred}. Check your API key in Options.`,
        { providerId: preferred },
      );
    }

    switch (preferred) {
      case 'openai':
        return createOpenAIAdapter(apiKey);
      case 'anthropic':
      case 'gemini':
      case 'ollama':
        throw new PipelineError(
          'PROVIDER_AUTH',
          `${preferred} is not yet configured. Only OpenAI is available in this version.`,
          { providerId: preferred },
        );
      default:
        throw new PipelineError(
          'PROVIDER_AUTH',
          `Unknown provider: ${preferred}.`,
          { providerId: preferred },
        );
    }
  }
}

export const providerRouter = new ProviderRouter();
