import { debugLog } from '../../utils/debugLog';
import { fetchWithFallback } from '../../utils/fetchProxy';
import type { DiscoveredModel, ModelEntry, CostTierType, ModelCapabilities, ProviderConfig } from './providerTypes';

interface OpenAIModelsResponse {
  data: Array<{ id: string }>;
}

interface OllamaTagsResponse {
  models: Array<{ name: string }>;
}

interface AnthropicModelsResponse {
  data: Array<{ id: string; display_name?: string }>;
}

interface GoogleModelsResponse {
  models: Array<{ name: string; displayName?: string }>;
}

const PROVIDER_DISCOVERY_ENDPOINTS: Record<ProviderConfig['type'], string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1',
  ollama: 'http://localhost:11434/v1',
  'openai-compatible': '',
};

export function getDiscoveryEndpoint(provider: ProviderConfig): string | undefined {
  if (provider.baseURL) {
    return provider.baseURL.replace(/\/+$/, '');
  }
  const ep = PROVIDER_DISCOVERY_ENDPOINTS[provider.type];
  return ep || undefined;
}

export function classifyModelTier(modelId: string): CostTierType {
  const id = modelId.toLowerCase();

  if (id.includes('opus') || id.includes('o1') || id.includes('o3') || id.includes('ultra') || id.includes('max')) {
    return 'opus';
  }
  if (id.includes('sonnet') || id.includes('pro') || id.includes('turbo')) {
    return 'sonnet';
  }
  if ((id.includes('4o') && !id.includes('mini')) || (id.includes('4.1') && !id.includes('mini'))) {
    return 'sonnet';
  }
  if (id.includes('haiku') || id.includes('mini') || id.includes('light') || id.includes('small') || id.includes('tiny')) {
    return 'haiku';
  }
  if (id.includes('1.5') || id.includes('1.0')) {
    return 'haiku';
  }

  return 'flash';
}

export function estimateContextWindow(modelId: string): number {
  const id = modelId.toLowerCase();

  if (id.includes('gemini') && (id.includes('2.5') || id.includes('2.0'))) return 1048576;
  if (id.includes('gemini')) return 1048576;
  if (id.includes('claude') && id.includes('sonnet') && !id.includes('3.5')) return 200000;
  if (id.includes('claude')) return 200000;
  if (id.includes('gpt-4') || id.includes('gpt-3') || id.includes('o1') || id.includes('o3')) return 128000;
  if (id.includes('qwen') || id.includes('mistral')) return 32768;
  if (id.includes('llama') || id.includes('gemma')) return 8192;
  if (id.includes('deepseek')) return 128000;

  return 128000;
}

export function estimateCapabilities(modelId: string): ModelCapabilities {
  const id = modelId.toLowerCase();

  const supportsVision = id.includes('vision') ||
    (id.includes('gemini')) ||
    (id.includes('gpt-4') && !id.includes('turbo')) ||
    (id.includes('claude') && !id.includes('haiku')) ||
    id.includes('llama-3.2-11b') ||
    id.includes('llama-3.2-90b');

  const supportsStructuredOutput = !id.includes('vision') ||
    id.includes('gemini') ||
    id.includes('gpt-4') ||
    id.includes('gpt-3') ||
    id.includes('o1') ||
    id.includes('o3') ||
    id.includes('claude');

  const supportsToolUse = id.includes('gemini') ||
    id.includes('gpt-') ||
    id.includes('claude') ||
    id.includes('o1') ||
    id.includes('o3') ||
    id.includes('llama') ||
    id.includes('qwen') ||
    id.includes('mistral') ||
    id.includes('deepseek');

  return {
    text: true,
    image: supportsVision,
    toolUse: supportsToolUse,
    structuredOutput: supportsStructuredOutput,
  };
}

export function discoveredToModelEntries(
  discovered: DiscoveredModel[],
  providerId: string,
): ModelEntry[] {
  return discovered.map((d) => ({
    providerId,
    modelId: d.modelId,
    costTier: d.modelId ? classifyModelTier(d.modelId) : 'flash',
    contextWindow: d.contextWindow ?? estimateContextWindow(d.modelId),
    modalities: d.modelId ? estimateCapabilities(d.modelId) : { text: true, image: false, toolUse: false, structuredOutput: false },
  }));
}

export class ModelDiscovery {

  async discover(
    endpoint: string,
    apiKey: string,
    providerType: ProviderConfig['type'],
  ): Promise<DiscoveredModel[]> {
    const base = endpoint.replace(/\/+$/, '');

    if (providerType === 'google') {
      return this.discoverGoogle(base, apiKey);
    }

    if (providerType === 'anthropic') {
      const models = await this.discoverAnthropic(base, apiKey);
      if (models.length > 0) return models;
      // Fallback to OpenAI-compatible discovery for custom endpoints
      // that don't support Anthropic's /models route
      const fallback = await this.tryOpenAIDiscovery(base, apiKey);
      if (fallback !== null && fallback.length > 0) return fallback;
      // Some proxies (e.g. LiteLLM) serve OpenAI-compatible API at /v1/models
      // rather than /models. Try this path before giving up.
      const v1Fallback = await this.tryOpenAIDiscovery(`${base}/v1`, apiKey);
      if (v1Fallback !== null && v1Fallback.length > 0) return v1Fallback;
      return fallback ?? models;
    }

    if (providerType === 'openai' || providerType === 'openai-compatible' || providerType === 'ollama') {
      const models = await this.tryOpenAIDiscovery(base, apiKey);
      if (models !== null) {
        return models;
      }
    }

    if (providerType === 'ollama') {
      const models = await this.tryOllamaFallback(base);
      if (models !== null) {
        return models;
      }
    }

    return [];
  }

  private async tryOpenAIDiscovery(
    base: string,
    apiKey: string,
  ): Promise<DiscoveredModel[] | null> {
    try {
      const url = `${base}/models`;
      const result = await fetchWithFallback(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      });

      if (!result.ok) {
        if (result.status === 404) {
          debugLog('warn', '[ModelDiscovery] /v1/models returned 404, may trigger fallback', {
            url,
            status: result.status,
          });
          return null;
        }

        debugLog('warn', '[ModelDiscovery] /v1/models returned non-404 error', {
          url,
          status: result.status,
        });
        return [];
      }

      const body = JSON.parse(result.body) as OpenAIModelsResponse;

      if (!body.data || !Array.isArray(body.data)) {
        debugLog('warn', '[ModelDiscovery] unexpected /v1/models response format');
        return [];
      }

      const models: DiscoveredModel[] = body.data.map((item) => ({
        modelId: item.id,
      }));

      debugLog('info', `[ModelDiscovery] discovered ${models.length} models from OpenAI endpoint`);

      return models;
    } catch (err) {
      debugLog('warn', '[ModelDiscovery] OpenAI discovery failed', { error: err });
      return [];
    }
  }

  private async discoverAnthropic(
    base: string,
    apiKey: string,
  ): Promise<DiscoveredModel[]> {
    try {
      const url = `${base}/models`;
      const result = await fetchWithFallback(url, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!result.ok) {
        debugLog('warn', '[ModelDiscovery] Anthropic models endpoint returned error', { url, status: result.status });
        return [];
      }

      const body = JSON.parse(result.body) as AnthropicModelsResponse;

      if (!body.data || !Array.isArray(body.data)) {
        debugLog('warn', '[ModelDiscovery] unexpected Anthropic /v1/models response format');
        return [];
      }

      const models: DiscoveredModel[] = body.data.map((item) => ({
        modelId: item.id,
      }));

      debugLog('info', `[ModelDiscovery] discovered ${models.length} models from Anthropic endpoint`);

      return models;
    } catch (err) {
      debugLog('warn', '[ModelDiscovery] Anthropic discovery failed', { error: err });
      return [];
    }
  }

  private async discoverGoogle(
    base: string,
    apiKey: string,
  ): Promise<DiscoveredModel[]> {
    try {
      const url = `${base}/models?key=${encodeURIComponent(apiKey)}`;
      const result = await fetchWithFallback(url, {
        headers: { Accept: 'application/json' },
      });

      if (!result.ok) {
        debugLog('warn', '[ModelDiscovery] Google /v1/models returned error', {
          url,
          status: result.status,
        });
        return [];
      }

      const body = JSON.parse(result.body) as GoogleModelsResponse;

      if (!body.models || !Array.isArray(body.models)) {
        debugLog('warn', '[ModelDiscovery] unexpected Google /v1/models response format');
        return [];
      }

      const models: DiscoveredModel[] = body.models
        .map((item) => ({
          modelId: item.name.replace(/^models\//, ''),
        }))
        .filter((m) => m.modelId.startsWith('gemini'));

      debugLog('info', `[ModelDiscovery] discovered ${models.length} models from Google endpoint`);

      return models;
    } catch (err) {
      debugLog('warn', '[ModelDiscovery] Google discovery failed', { error: err });
      return [];
    }
  }

  private async tryOllamaFallback(base: string): Promise<DiscoveredModel[] | null> {
    try {
      const url = `${base}/api/tags`;
      const result = await fetchWithFallback(url, {});

      if (!result.ok) {
        debugLog('warn', '[ModelDiscovery] Ollama /api/tags returned error', {
          url,
          status: result.status,
        });
        return [];
      }

      const body = JSON.parse(result.body) as OllamaTagsResponse;

      if (!body.models || !Array.isArray(body.models)) {
        debugLog('warn', '[ModelDiscovery] unexpected Ollama /api/tags response format');
        return [];
      }

      const models: DiscoveredModel[] = body.models.map((item) => ({
        modelId: item.name,
      }));

      debugLog('info', `[ModelDiscovery] discovered ${models.length} models from Ollama endpoint`);

      return models;
    } catch (err) {
      debugLog('warn', '[ModelDiscovery] Ollama discovery failed', { error: err });
      return [];
    }
  }
}

export const modelDiscovery = new ModelDiscovery();
