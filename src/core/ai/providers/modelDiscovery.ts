import { debugLog } from '../../utils/debugLog';
import type { DiscoveredModel, ProviderConfig } from './providerTypes';

const DISCOVERY_TIMEOUT_MS = 10_000;

interface OpenAIModelsResponse {
  data: Array<{ id: string }>;
}

interface OllamaTagsResponse {
  models: Array<{ name: string }>;
}

export class ModelDiscovery {
  /**
   * Discover available models from a provider endpoint.
   *
   * Strategy:
   * 1. OpenAI-compatible: GET {endpoint}/models with Authorization header
   * 2. Ollama fallback: If /v1/models returns 404 and provider is ollama,
   *    try GET {endpoint}/api/tags
   * 3. Google: Skip discovery entirely (no public model list endpoint)
   * 4. On any error: return empty array (never throws)
   */
  async discover(
    endpoint: string,
    apiKey: string,
    providerType: ProviderConfig['type'],
  ): Promise<DiscoveredModel[]> {
    // Google provider has no public model list endpoint — skip discovery
    if (providerType === 'google') {
      debugLog('info', '[ModelDiscovery] Google provider has no discovery endpoint, returning empty');
      return [];
    }

    const base = endpoint.replace(/\/+$/, '');

    // Step 1: Try OpenAI-compatible /v1/models
    if (providerType === 'openai' || providerType === 'openai-compatible' || providerType === 'ollama') {
      const models = await this.tryOpenAIDiscovery(base, apiKey);
      if (models !== null) {
        return models;
      }
    }

    // Step 2: Ollama fallback — if /v1/models returned 404, try /api/tags
    if (providerType === 'ollama') {
      const models = await this.tryOllamaFallback(base);
      if (models !== null) {
        return models;
      }
    }

    // Step 3: All discovery paths exhausted — return empty
    return [];
  }

  /**
   * Try OpenAI-compatible discovery: GET {base}/models
   * Returns null if the endpoint returns 404 (to trigger Ollama fallback).
   * Returns empty array on any other error.
   */
  private async tryOpenAIDiscovery(
    base: string,
    apiKey: string,
  ): Promise<DiscoveredModel[] | null> {
    try {
      const url = `${base}/models`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      });

      if (!response.ok) {
        if (response.status === 404) {
          debugLog('warn', '[ModelDiscovery] /v1/models returned 404, may trigger fallback', {
            url,
            status: response.status,
          });
          return null; // Signal for fallback
        }

        debugLog('warn', '[ModelDiscovery] /v1/models returned non-404 error', {
          url,
          status: response.status,
        });
        return [];
      }

      const body = (await response.json()) as OpenAIModelsResponse;

      if (!body.data || !Array.isArray(body.data)) {
        debugLog('warn', '[ModelDiscovery] unexpected /v1/models response format');
        return [];
      }

      const models: DiscoveredModel[] = body.data.map((item) => ({
        modelId: item.id,
      }));

      debugLog('info', '[ModelDiscovery] discovered models from OpenAI endpoint', {
        count: models.length,
      });

      return models;
    } catch (err) {
      debugLog('warn', '[ModelDiscovery] OpenAI discovery failed', { error: err });
      return [];
    }
  }

  /**
   * Try Ollama fallback: GET {base}/api/tags
   * Returns null only on 404 (to indicate no more fallbacks).
   * Returns empty array on any other error.
   */
  private async tryOllamaFallback(base: string): Promise<DiscoveredModel[] | null> {
    try {
      const url = `${base}/api/tags`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      });

      if (!response.ok) {
        debugLog('warn', '[ModelDiscovery] Ollama /api/tags returned error', {
          url,
          status: response.status,
        });
        return [];
      }

      const body = (await response.json()) as OllamaTagsResponse;

      if (!body.models || !Array.isArray(body.models)) {
        debugLog('warn', '[ModelDiscovery] unexpected Ollama /api/tags response format');
        return [];
      }

      const models: DiscoveredModel[] = body.models.map((item) => ({
        modelId: item.name,
      }));

      debugLog('info', '[ModelDiscovery] discovered models from Ollama endpoint', {
        count: models.length,
      });

      return models;
    } catch (err) {
      debugLog('warn', '[ModelDiscovery] Ollama discovery failed', { error: err });
      return [];
    }
  }
}

export const modelDiscovery = new ModelDiscovery();
