import { debugLog } from '../../utils/debugLog';
import type { ProviderRegistry } from '../providers/ProviderRegistry';
import type { CircuitBreaker } from './CircuitBreaker';
import type { TierResolver } from './TierResolver';
import type { CostTierType } from '../providers/providerTypes';
import type { ExecutionContext } from '../../telemetry/types';

// Singleton imports — used only at module level for the shared providerRouter export
import { providerRegistry } from '../providers/ProviderRegistry';
import { CircuitBreaker as CircuitBreakerClass } from './CircuitBreaker';
import { TierResolver as TierResolverClass } from './TierResolver';

const RETRYABLE_ERROR_TYPES = ['TIMEOUT', 'NETWORK', 'PROVIDER_5XX', 'RATE_LIMITED'] as const;

export class ProviderRouter {
  constructor(
    private registry: ProviderRegistry,
    private breaker: CircuitBreaker,
    private tierResolver: TierResolver,
  ) {}

  async selectModel(
    tier: CostTierType,
    preferredProviders: string[],
    execCtx?: ExecutionContext,
    specificModelId?: string,
  ): Promise<{ instance: unknown; modelId: string; providerId: string } | null> {
    // Ensure the registry is initialized (uses cached init if already done
    // — avoids re-discovering all models on every selectModel call)
    await this.registry.initialize();

    // If a specific model ID is requested, try it first
    if (specificModelId) {
      let foundAnyProvider = false;
      for (const providerId of preferredProviders) {
        const provider = this.registry.getProvider(providerId);
        if (!provider) continue;
        foundAnyProvider = true;
        const hasModel = provider.config.models.some(m => m.modelId === specificModelId);
        if (!hasModel) {
          debugLog('warn', '[ProviderRouter] model not found in preferred provider', { providerId, modelId: specificModelId, availableModels: provider.config.models.map(m => m.modelId) });
          continue;
        }

        const circuitOpen = this.breaker.isOpen(providerId);
        if (circuitOpen) continue;

        try {
          this.breaker.recordSuccess(providerId);
          debugLog('info', '[ProviderRouter] selected specific model', { providerId, modelId: specificModelId });
          return { instance: (provider.instance as any)(specificModelId), modelId: specificModelId, providerId };
        } catch (err) {
          debugLog('warn', '[ProviderRouter] specific model selection failed', { providerId, modelId: specificModelId, error: err });
          this.breaker.recordFailure(providerId);
          // Fall through to tier-based fallback
        }
      }
      if (!foundAnyProvider && preferredProviders.length > 0) {
        debugLog('warn', '[ProviderRouter] preferred providers not available for specific model lookup', { preferredProviders, modelId: specificModelId });
      }

      // Fallback: search across ALL enabled providers.
      // This handles the case where modelEntries.providerId doesn't match the registry's
      // provider ID (e.g., "custom-1" vs "custom") due to stale persisted modelEntries,
      // or when the preferred provider failed to discover models but the model is
      // still available via loadManualModels fallback.
      const allModels = this.registry.listModels();
      const fallbackModel = allModels.find(m => m.modelId === specificModelId);
      if (fallbackModel) {
        const provider = this.registry.getProvider(fallbackModel.providerId);
        if (provider) {
          const circuitOpen = this.breaker.isOpen(fallbackModel.providerId);
          if (!circuitOpen) {
            try {
              this.breaker.recordSuccess(fallbackModel.providerId);
              debugLog('info', '[ProviderRouter] selected specific model via all-providers fallback', { providerId: fallbackModel.providerId, modelId: specificModelId });
              return { instance: (provider.instance as any)(specificModelId), modelId: specificModelId, providerId: fallbackModel.providerId };
            } catch (err) {
              debugLog('warn', '[ProviderRouter] fallback model selection failed', { providerId: fallbackModel.providerId, modelId: specificModelId, error: err });
              this.breaker.recordFailure(fallbackModel.providerId);
            }
          }
        }
      }
    }

    // Get fallback chain from tier resolver, capped at 3
    const chain = this.tierResolver.resolve(tier, preferredProviders);

    for (let i = 0; i < Math.min(chain.length, 3); i++) {
      const { providerId, modelId } = chain[i];
      const attemptNumber = i + 1;
      const startedAt = Date.now();

      // Check circuit breaker before attempting
      const circuitOpen = this.breaker.isOpen(providerId);
      if (circuitOpen) {
        debugLog('debug', '[ProviderRouter] skipping open circuit', { providerId });
        execCtx?.traceCollector.onProviderAttempt({
          attemptNumber,
          providerId,
          model: modelId,
          startedAt,
          endedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          outcome: 'circuit_open',
          circuitBreakerTriggered: true,
        });
        continue;
      }

      try {
        const provider = this.registry.getProvider(providerId);
        if (!provider) {
          debugLog('warn', '[ProviderRouter] provider not found in registry', { providerId });
          continue;
        }

        // Success — record success and return
        this.breaker.recordSuccess(providerId);
        debugLog('info', '[ProviderRouter] selected model', { providerId, modelId });
        execCtx?.traceCollector.onProviderAttempt({
          attemptNumber,
          providerId,
          model: modelId,
          startedAt,
          endedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          outcome: 'success',
          circuitBreakerTriggered: false,
        });
        return { instance: (provider.instance as any)(modelId), modelId, providerId };
      } catch (err) {
        debugLog('warn', '[ProviderRouter] provider selection failed', {
          providerId,
          modelId,
          error: err instanceof Error ? err.message : JSON.stringify(err),
        });
        this.breaker.recordFailure(providerId);
        execCtx?.traceCollector.onProviderAttempt({
          attemptNumber,
          providerId,
          model: modelId,
          startedAt,
          endedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          outcome: 'error',
          errorCode: err instanceof Error ? err.message : JSON.stringify(err),
          circuitBreakerTriggered: false,
        });
        // Continue to next in fallback chain
      }
    }

    debugLog('warn', `[ProviderRouter] fallback chain exhausted for tier ${tier}`);
    return null;
  }

  getRetryableErrors(): string[] {
    return [...RETRYABLE_ERROR_TYPES];
  }

  isRetryableError(error: unknown): boolean {
    if (typeof error === 'string') {
      return RETRYABLE_ERROR_TYPES.some(t => error === t);
    }
    if (error && typeof error === 'object') {
      const obj = error as Record<string, unknown>;
      const code = obj.code;
      const message = obj.message;
      if (typeof code === 'string' && RETRYABLE_ERROR_TYPES.some(t => code === t)) {
        return true;
      }
      if (typeof message === 'string') {
        return RETRYABLE_ERROR_TYPES.some(t => message.includes(t));
      }
    }
    return false;
  }
}

// Singleton wiring
const sharedBreaker = new CircuitBreakerClass();
const tierResolverInstance = new TierResolverClass(providerRegistry);
export const providerRouter = new ProviderRouter(providerRegistry, sharedBreaker, tierResolverInstance);
