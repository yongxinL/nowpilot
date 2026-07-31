import { useApiKeyStore } from '../storage/ApiKeyStore';
import { PipelineError } from './PipelineError';
import { createOpenAIAdapter } from './providers/openai';
import { createAnthropicAdapter } from './providers/anthropic';
import { createGeminiAdapter } from './providers/gemini';
import { createOllamaAdapter } from './providers/ollama';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { PipelineProviderId } from './types';

const PROVIDER_ORDER: PipelineProviderId[] = ['openai', 'anthropic', 'gemini', 'ollama'];

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_WINDOW_MS = 60_000;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60_000;

interface CircuitState {
  failureCount: number;
  lastFailureTime: number;
  openUntil: number | null;
}

interface OperationState {
  hasStreamedFirstToken: boolean;
  attempts: Array<{ providerId: string; error?: PipelineError }>;
}

export class ProviderRouter {
  private circuitBreakers: Map<PipelineProviderId, CircuitState> = new Map();
  private operationStates: Map<string, OperationState> = new Map();

  private getCircuitState(providerId: PipelineProviderId): CircuitState {
    let state = this.circuitBreakers.get(providerId);
    if (!state) {
      state = { failureCount: 0, lastFailureTime: 0, openUntil: null };
      this.circuitBreakers.set(providerId, state);
    }
    return state;
  }

  isCircuitBreakerOpen(providerId: PipelineProviderId): boolean {
    const state = this.getCircuitState(providerId);
    if (state.openUntil === null) return false;
    if (Date.now() >= state.openUntil) {
      state.failureCount = 0;
      state.openUntil = null;
      return false;
    }
    return true;
  }

  recordFailure(providerId: PipelineProviderId, error: PipelineError): void {
    const state = this.getCircuitState(providerId);
    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      const recentCount = this.countRecentFailures(providerId);
      if (recentCount >= CIRCUIT_BREAKER_THRESHOLD) {
        state.openUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      }
    }
  }

  recordSuccess(providerId: PipelineProviderId): void {
    const state = this.getCircuitState(providerId);
    state.failureCount = 0;
    state.openUntil = null;
  }

  private countRecentFailures(providerId: PipelineProviderId): number {
    const state = this.getCircuitState(providerId);
    const windowStart = Date.now() - CIRCUIT_BREAKER_WINDOW_MS;
    return state.lastFailureTime >= windowStart ? state.failureCount : 0;
  }

  private getOperationState(operationId: string): OperationState {
    let state = this.operationStates.get(operationId);
    if (!state) {
      state = { hasStreamedFirstToken: false, attempts: [] };
      this.operationStates.set(operationId, state);
    }
    return state;
  }

  markFirstTokenStreamed(operationId: string): void {
    const state = this.getOperationState(operationId);
    state.hasStreamedFirstToken = true;
  }

  hasStreamedFirstToken(operationId: string): boolean {
    const state = this.operationStates.get(operationId);
    return state?.hasStreamedFirstToken ?? false;
  }

  async selectProvider(preferred: PipelineProviderId): Promise<{ adapter: ProviderAdapter; providerId: PipelineProviderId }> {
    const attemptedProviders: string[] = [];
    const startIndex = PROVIDER_ORDER.indexOf(preferred);
    const orderedProviders = [
      ...PROVIDER_ORDER.slice(startIndex),
      ...PROVIDER_ORDER.slice(0, startIndex),
    ];

    for (const providerId of orderedProviders) {
      if (this.isCircuitBreakerOpen(providerId)) {
        attemptedProviders.push(`${providerId} (circuit open)`);
        continue;
      }

      if (providerId !== 'ollama') {
        const apiKey = await useApiKeyStore.getState().getKey(providerId);
        if (!apiKey) {
          attemptedProviders.push(`${providerId} (no key)`);
          continue;
        }
      }

      const adapter = await this.buildAdapter(providerId);
      if (!adapter) {
        attemptedProviders.push(`${providerId} (unavailable)`);
        continue;
      }

      return { adapter, providerId };
    }

    throw new PipelineError(
      'CIRCUIT_OPEN',
      'All providers are temporarily unavailable. Please try again in a few minutes.',
      { attemptedProviders },
    );
  }

  /**
   * AI summarization overflow path (D-06, D-08): returns the cheapest
   * available summarization-capable provider adapter, independent of the
   * user's conversation tier. Iterates PROVIDER_ORDER skipping open
   * circuit breakers; for Ollama no API key is required. Returns null
   * when no provider is available — never throws; the caller
   * (ContextCompressor) falls through to CONTEXT_TOO_LARGE.
   */
  async getCompressionModel(): Promise<ProviderAdapter | null> {
    for (const providerId of PROVIDER_ORDER) {
      if (this.isCircuitBreakerOpen(providerId)) continue;

      if (providerId !== 'ollama') {
        const apiKey = await useApiKeyStore.getState().getKey(providerId);
        if (!apiKey) continue;
      }

      const adapter = await this.buildAdapter(providerId);
      if (adapter) return adapter;
    }

    return null;
  }

  private async buildAdapter(providerId: PipelineProviderId): Promise<ProviderAdapter | null> {
    switch (providerId) {
      case 'openai': {
        const key = await useApiKeyStore.getState().getKey('openai');
        return key ? createOpenAIAdapter(key) : null;
      }
      case 'anthropic': {
        const key = await useApiKeyStore.getState().getKey('anthropic');
        return key ? createAnthropicAdapter(key) : null;
      }
      case 'gemini': {
        const key = await useApiKeyStore.getState().getKey('gemini');
        return key ? createGeminiAdapter(key) : null;
      }
      case 'ollama':
        return createOllamaAdapter();
      default:
        return null;
    }
  }

  async executeWithFallback<T>(
    preferredProvider: PipelineProviderId,
    operation: (adapter: ProviderAdapter, providerId: PipelineProviderId) => Promise<T>,
    operationId?: string,
  ): Promise<T> {
    const opId = operationId ?? crypto.randomUUID();
    const state = this.getOperationState(opId);

    let lastError: PipelineError | undefined;

    const startIndex = PROVIDER_ORDER.indexOf(preferredProvider);
    const orderedProviders = [
      ...PROVIDER_ORDER.slice(startIndex),
      ...PROVIDER_ORDER.slice(0, startIndex),
    ];

    for (const providerId of orderedProviders) {
      if (this.isCircuitBreakerOpen(providerId)) continue;

      if (state.hasStreamedFirstToken && state.attempts.length > 1) {
        throw lastError ?? new PipelineError('UNKNOWN', 'Streaming fallback blocked.', {});
      }

      try {
        const { adapter } = await this.selectProvider(providerId);
        state.attempts.push({ providerId });
        const result = await operation(adapter, providerId);
        this.recordSuccess(providerId);
        return result;
      } catch (err) {
        const error = err instanceof PipelineError ? err : new PipelineError('UNKNOWN', String(err), {});
        state.attempts[state.attempts.length - 1] = { providerId, error };
        this.recordFailure(providerId, error);

        if (!error.retryable) {
          throw error;
        }

        if (state.hasStreamedFirstToken) {
          throw error;
        }

        lastError = error;
      }
    }

    throw lastError ?? new PipelineError(
      'CIRCUIT_OPEN',
      'All providers are temporarily unavailable. Please try again in a few minutes.',
      { attemptedProviders: orderedProviders },
    );
  }
}

export const providerRouter = new ProviderRouter();
