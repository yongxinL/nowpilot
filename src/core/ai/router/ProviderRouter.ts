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
  ): Promise<{ instance: unknown; modelId: string; providerId: string } | null> {
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
        return { instance: provider.instance, modelId, providerId };
      } catch (err) {
        debugLog('warn', '[ProviderRouter] provider selection failed', {
          providerId,
          modelId,
          error: err,
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
          errorCode: err instanceof Error ? err.message : String(err),
          circuitBreakerTriggered: false,
        });
        // Continue to next in fallback chain
      }
    }

    debugLog('warn', '[ProviderRouter] fallback chain exhausted', { tier });
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
