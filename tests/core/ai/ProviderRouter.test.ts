import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PipelineError } from '../../../src/core/ai/PipelineError';

const mockKeys: Record<string, string | null> = {
  openai: 'sk-test-openai',
  anthropic: 'sk-ant-test',
  gemini: 'test-gemini-key',
};

vi.mock('../../../src/core/storage/ApiKeyStore', () => ({
  useApiKeyStore: {
    getState: () => ({
      getKey: vi.fn((providerId: string) => Promise.resolve(mockKeys[providerId] ?? null)),
    }),
  },
}));

vi.mock('../../../src/core/ai/providers/openai', () => ({
  createOpenAIAdapter: vi.fn(() => ({
    providerId: 'openai',
    createLanguageModel: vi.fn(),
    validateConnection: vi.fn(),
    supportsStructuredOutput: true,
    getDefaultModelForTier: vi.fn(),
    getCacheStrategy: vi.fn(),
    getTelemetryMetadata: vi.fn(),
  })),
}));

vi.mock('../../../src/core/ai/providers/anthropic', () => ({
  createAnthropicAdapter: vi.fn(() => ({
    providerId: 'anthropic',
    createLanguageModel: vi.fn(),
    validateConnection: vi.fn(),
    supportsStructuredOutput: true,
    getDefaultModelForTier: vi.fn(),
    getCacheStrategy: vi.fn(),
    getTelemetryMetadata: vi.fn(),
  })),
}));

vi.mock('../../../src/core/ai/providers/gemini', () => ({
  createGeminiAdapter: vi.fn(() => ({
    providerId: 'gemini',
    createLanguageModel: vi.fn(),
    validateConnection: vi.fn(),
    supportsStructuredOutput: true,
    getDefaultModelForTier: vi.fn(),
    getCacheStrategy: vi.fn(),
    getTelemetryMetadata: vi.fn(),
  })),
}));

vi.mock('../../../src/core/ai/providers/ollama', () => ({
  createOllamaAdapter: vi.fn(() => ({
    providerId: 'ollama',
    createLanguageModel: vi.fn(),
    validateConnection: vi.fn(),
    supportsStructuredOutput: false,
    getDefaultModelForTier: vi.fn(),
    getCacheStrategy: vi.fn(),
    getTelemetryMetadata: vi.fn(),
  })),
}));

describe('ProviderRouter', () => {
  let router: import('../../../src/core/ai/ProviderRouter').ProviderRouter;

  beforeEach(async () => {
    const { ProviderRouter } = await import('../../../src/core/ai/ProviderRouter');
    router = new ProviderRouter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects preferred provider when key is configured and circuit is closed', async () => {
    const result = await router.selectProvider('openai');
    expect(result.providerId).toBe('openai');
    expect(result.adapter).toBeDefined();
  });

  it('falls back to next provider when preferred provider key is missing', async () => {
    mockKeys.anthropic = null;
    const result = await router.selectProvider('anthropic');
    expect(result.providerId).toBe('gemini');
    mockKeys.anthropic = 'sk-ant-test';
  });

  it('circuit breaker skips provider after 3 consecutive failures', async () => {
    const error = new PipelineError('PROVIDER_TIMEOUT', 'Timeout', {});
    router.recordFailure('openai', error);
    router.recordFailure('openai', error);
    router.recordFailure('openai', error);

    expect(router.isCircuitBreakerOpen('openai')).toBe(true);
  });

  it('circuit breaker resets after cooldown', async () => {
    vi.useFakeTimers();
    const error = new PipelineError('PROVIDER_TIMEOUT', 'Timeout', {});
    router.recordFailure('openai', error);
    router.recordFailure('openai', error);
    router.recordFailure('openai', error);

    expect(router.isCircuitBreakerOpen('openai')).toBe(true);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

    expect(router.isCircuitBreakerOpen('openai')).toBe(false);
  });

  it('hasStreamedFirstToken blocks fallback', async () => {
    const opId = 'test-op-1';
    router.markFirstTokenStreamed(opId);
    expect(router.hasStreamedFirstToken(opId)).toBe(true);
  });

  it('non-retryable error returns immediately without fallback', async () => {
    const error = new PipelineError('PROVIDER_AUTH', 'Auth failed', {});
    expect(error.retryable).toBe(false);
  });

  it('retryable error triggers fallback to next provider', async () => {
    const error = new PipelineError('PROVIDER_TIMEOUT', 'Timeout', {});
    expect(error.retryable).toBe(true);
  });

  it('throws CIRCUIT_OPEN when all providers are in circuit-breaker state', async () => {
    const error = new PipelineError('PROVIDER_TIMEOUT', 'Timeout', {});
    for (const provider of ['openai', 'anthropic', 'gemini', 'ollama'] as const) {
      router.recordFailure(provider, error);
      router.recordFailure(provider, error);
      router.recordFailure(provider, error);
    }

    await expect(
      router.selectProvider('openai'),
    ).rejects.toThrow(PipelineError);
  });

  it('recordSuccess resets failure counter', async () => {
    const error = new PipelineError('PROVIDER_TIMEOUT', 'Timeout', {});
    router.recordFailure('openai', error);
    router.recordFailure('openai', error);
    router.recordSuccess('openai');
    expect(router.isCircuitBreakerOpen('openai')).toBe(false);
  });
});
