import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderRouter } from '../../../../src/core/ai/router/ProviderRouter';
import type { ProviderRegistry } from '../../../../src/core/ai/providers/ProviderRegistry';
import type { CircuitBreaker } from '../../../../src/core/ai/router/CircuitBreaker';
import type { TierResolver } from '../../../../src/core/ai/router/TierResolver';

function createMockRegistry(providerMap: Record<string, { instance: unknown }>): Pick<ProviderRegistry, 'getProvider'> {
  return {
    getProvider(providerId: string) {
      const entry = providerMap[providerId];
      if (!entry) return undefined;
      return { instance: entry.instance, config: { id: providerId, name: providerId, type: 'openai', models: [], priority: 0, enabled: true } };
    },
  };
}

function createMockBreaker(): Pick<CircuitBreaker, 'isOpen' | 'recordSuccess' | 'recordFailure'> {
  return {
    isOpen: vi.fn().mockReturnValue(false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  };
}

function createMockTierResolver(chain: Array<{ providerId: string; modelId: string }>): Pick<TierResolver, 'resolve'> {
  return {
    resolve: vi.fn().mockReturnValue(chain),
  };
}

describe('ProviderRouter', () => {
  let breaker: ReturnType<typeof createMockBreaker>;
  let tierResolver: ReturnType<typeof createMockTierResolver>;
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selectModel returns first available provider+model from fallback chain', async () => {
    registry = createMockRegistry({
      openai: { instance: { name: 'openai-instance' } },
    });
    breaker = createMockBreaker();
    tierResolver = createMockTierResolver([
      { providerId: 'openai', modelId: 'gpt-4o-mini' },
    ]);

    const router = new ProviderRouter(
      registry as unknown as ProviderRegistry,
      breaker as unknown as CircuitBreaker,
      tierResolver as unknown as TierResolver,
    );

    const result = await router.selectModel('haiku', ['openai']);

    expect(result).not.toBeNull();
    expect(result!.providerId).toBe('openai');
    expect(result!.modelId).toBe('gpt-4o-mini');
    expect(result!.instance).toEqual({ name: 'openai-instance' });
    expect(breaker.recordSuccess).toHaveBeenCalledWith('openai');
  });

  it('skips providers with open circuit breakers and tries next in chain', async () => {
    registry = createMockRegistry({
      openai: { instance: { name: 'openai' } },
      anthropic: { instance: { name: 'anthropic' } },
    });
    breaker = createMockBreaker();
    breaker.isOpen = vi.fn((id: string) => id === 'openai'); // openai is open
    tierResolver = createMockTierResolver([
      { providerId: 'openai', modelId: 'gpt-4o-mini' },
      { providerId: 'anthropic', modelId: 'claude-3-haiku' },
    ]);

    const router = new ProviderRouter(
      registry as unknown as ProviderRegistry,
      breaker as unknown as CircuitBreaker,
      tierResolver as unknown as TierResolver,
    );

    const result = await router.selectModel('haiku', ['openai', 'anthropic']);

    expect(result).not.toBeNull();
    expect(result!.providerId).toBe('anthropic');
    expect(result!.modelId).toBe('claude-3-haiku');
    // Should NOT have recorded success for openai (skipped)
    expect(breaker.recordSuccess).not.toHaveBeenCalledWith('openai');
    expect(breaker.recordSuccess).toHaveBeenCalledWith('anthropic');
  });

  it('returns null when all providers in chain are skipped due to open circuits', async () => {
    registry = createMockRegistry({
      openai: { instance: { name: 'openai' } },
    });
    breaker = createMockBreaker();
    breaker.isOpen = vi.fn().mockReturnValue(true); // all open
    tierResolver = createMockTierResolver([
      { providerId: 'openai', modelId: 'gpt-4o-mini' },
    ]);

    const router = new ProviderRouter(
      registry as unknown as ProviderRegistry,
      breaker as unknown as CircuitBreaker,
      tierResolver as unknown as TierResolver,
    );

    const result = await router.selectModel('haiku', ['openai']);
    expect(result).toBeNull();
  });

  it('falls back when getProvider returns undefined', async () => {
    registry = createMockRegistry({
      // Only anthropic is registered
      anthropic: { instance: { name: 'anthropic' } },
    });
    breaker = createMockBreaker();
    tierResolver = createMockTierResolver([
      { providerId: 'openai', modelId: 'gpt-4o-mini' },  // not in registry
      { providerId: 'anthropic', modelId: 'claude-3-haiku' },  // available
    ]);

    const router = new ProviderRouter(
      registry as unknown as ProviderRegistry,
      breaker as unknown as CircuitBreaker,
      tierResolver as unknown as TierResolver,
    );

    const result = await router.selectModel('haiku', ['openai', 'anthropic']);

    expect(result).not.toBeNull();
    expect(result!.providerId).toBe('anthropic');
    expect(result!.modelId).toBe('claude-3-haiku');
  });

  it('fallback chain capped at 3 attempts total', async () => {
    registry = createMockRegistry({
      p1: { instance: { name: 'p1' } },
      p2: { instance: { name: 'p2' } },
      p3: { instance: { name: 'p3' } },
      p4: { instance: { name: 'p4' } },
    });
    breaker = createMockBreaker();
    tierResolver = createMockTierResolver([
      { providerId: 'p1', modelId: 'm1' },
      { providerId: 'p2', modelId: 'm2' },
      { providerId: 'p3', modelId: 'm3' },
      { providerId: 'p4', modelId: 'm4' },
    ]);

    const router = new ProviderRouter(
      registry as unknown as ProviderRegistry,
      breaker as unknown as CircuitBreaker,
      tierResolver as unknown as TierResolver,
    );

    // selectModel should iterate at most 3 items
    const result = await router.selectModel('haiku', ['p1', 'p2', 'p3', 'p4']);

    // Since all providers available, p1 should be selected
    expect(result).not.toBeNull();
    expect(result!.providerId).toBe('p1');
  });

  it('records failure on error and continues to next provider', async () => {
    let callCount = 0;
    registry = {
      getProvider(id: string) {
        callCount++;
        if (id === 'openai') return undefined; // not available
        return { instance: { name: id }, config: { id, name: id, type: 'openai' as const, models: [], priority: 0, enabled: true } };
      },
    } as unknown as Pick<ProviderRegistry, 'getProvider'>;
    breaker = createMockBreaker();
    tierResolver = createMockTierResolver([
      { providerId: 'openai', modelId: 'gpt-4o-mini' },
      { providerId: 'anthropic', modelId: 'claude-3-haiku' },
    ]);

    const router = new ProviderRouter(
      registry as unknown as ProviderRegistry,
      breaker as unknown as CircuitBreaker,
      tierResolver as unknown as TierResolver,
    );

    const result = await router.selectModel('haiku', ['openai', 'anthropic']);

    expect(result).not.toBeNull();
    expect(result!.providerId).toBe('anthropic');
  });

  it('records failure for providers that throw', async () => {
    registry = {
      getProvider(id: string) {
        if (id === 'openai') throw new Error('AI SDK init failed');
        return { instance: { name: id }, config: { id, name: id, type: 'openai' as const, models: [], priority: 0, enabled: true } };
      },
    } as unknown as Pick<ProviderRegistry, 'getProvider'>;
    breaker = createMockBreaker();
    tierResolver = createMockTierResolver([
      { providerId: 'openai', modelId: 'gpt-4o-mini' },
      { providerId: 'anthropic', modelId: 'claude-3-haiku' },
    ]);

    const router = new ProviderRouter(
      registry as unknown as ProviderRegistry,
      breaker as unknown as CircuitBreaker,
      tierResolver as unknown as TierResolver,
    );

    const result = await router.selectModel('haiku', ['openai', 'anthropic']);

    expect(result).not.toBeNull();
    expect(result!.providerId).toBe('anthropic');
    expect(breaker.recordFailure).toHaveBeenCalledWith('openai');
  });

  it('returns null when all providers in chain throw or are unavailable', async () => {
    registry = {
      getProvider() { throw new Error('All providers failed'); },
    } as unknown as Pick<ProviderRegistry, 'getProvider'>;
    breaker = createMockBreaker();
    tierResolver = createMockTierResolver([
      { providerId: 'openai', modelId: 'gpt-4o-mini' },
      { providerId: 'anthropic', modelId: 'claude-3-haiku' },
    ]);

    const router = new ProviderRouter(
      registry as unknown as ProviderRegistry,
      breaker as unknown as CircuitBreaker,
      tierResolver as unknown as TierResolver,
    );

    const result = await router.selectModel('haiku', ['openai', 'anthropic']);
    expect(result).toBeNull();
  });

  it('getRetryableErrors returns retryable error types', () => {
    const router = new ProviderRouter(
      {} as ProviderRegistry,
      {} as CircuitBreaker,
      {} as TierResolver,
    );
    const errors = router.getRetryableErrors();
    expect(errors).toContain('TIMEOUT');
    expect(errors).toContain('NETWORK');
    expect(errors).toContain('PROVIDER_5XX');
    expect(errors).toContain('RATE_LIMITED');
  });

  it('isRetryableError returns true for known error types', () => {
    const router = new ProviderRouter(
      {} as ProviderRegistry,
      {} as CircuitBreaker,
      {} as TierResolver,
    );
    expect(router.isRetryableError({ code: 'TIMEOUT' })).toBe(true);
    expect(router.isRetryableError({ message: 'NETWORK error occurred' })).toBe(true);
    expect(router.isRetryableError('RATE_LIMITED')).toBe(true);
  });

  it('isRetryableError returns false for unknown errors', () => {
    const router = new ProviderRouter(
      {} as ProviderRegistry,
      {} as CircuitBreaker,
      {} as TierResolver,
    );
    expect(router.isRetryableError({ code: 'BAD_REQUEST' })).toBe(false);
    expect(router.isRetryableError('some random string')).toBe(false);
  });

  it('selectModel cuts chain at 3 even if tierResolver returns more', async () => {
    registry = createMockRegistry({
      p1: { instance: { name: 'p1' } },
      p2: { instance: { name: 'p2' } },
      p3: { instance: { name: 'p3' } },
    });
    breaker = createMockBreaker();
    breaker.isOpen = vi.fn().mockReturnValue(true); // all open, exhaust chain
    tierResolver = createMockTierResolver([
      { providerId: 'p1', modelId: 'm1' },
      { providerId: 'p2', modelId: 'm2' },
      { providerId: 'p3', modelId: 'm3' },
      { providerId: 'p4', modelId: 'm4' }, // should not be reached
    ]);

    const router = new ProviderRouter(
      registry as unknown as ProviderRegistry,
      breaker as unknown as CircuitBreaker,
      tierResolver as unknown as TierResolver,
    );

    const result = await router.selectModel('haiku', ['p1', 'p2', 'p3', 'p4']);
    expect(result).toBeNull();
    // Only first 3 should have been checked
    expect(breaker.isOpen).toHaveBeenCalledTimes(3);
  });
});
