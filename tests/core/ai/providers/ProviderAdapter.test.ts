import { describe, it, expect, vi } from 'vitest';
import { createOpenAIAdapter } from '../../../../src/core/ai/providers/openai';
import { createAnthropicAdapter } from '../../../../src/core/ai/providers/anthropic';
import { createGeminiAdapter } from '../../../../src/core/ai/providers/gemini';
import { createOllamaAdapter } from '../../../../src/core/ai/providers/ollama';
import type { ModelTier } from '../../../../src/core/ai/types';

vi.stubGlobal('fetch', vi.fn());

const mockLanguageModel = {
  specificationVersion: 'v1',
  provider: 'test',
  modelId: 'test-model',
  doGenerate: vi.fn(),
  doStream: vi.fn(),
};

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn((id: string) => ({ ...mockLanguageModel, modelId: id }))),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn((id: string) => ({ ...mockLanguageModel, modelId: id }))),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogle: vi.fn(() => vi.fn((id: string) => ({ ...mockLanguageModel, modelId: id }))),
}));

vi.mock('ollama-ai-provider', () => ({
  createOllama: vi.fn(() => vi.fn((id: string) => ({ ...mockLanguageModel, modelId: id }))),
}));

type AdapterFactory = (apiKey?: string) => ReturnType<typeof createOpenAIAdapter>;

interface AdapterTestCase {
  name: string;
  factory: AdapterFactory;
  providerId: string;
  expectsStructuredOutput: boolean;
  cacheStrategy: string;
  key?: string;
}

const adapters: AdapterTestCase[] = [
  { name: 'OpenAI', factory: () => createOpenAIAdapter('sk-test'), providerId: 'openai', expectsStructuredOutput: true, cacheStrategy: 'prefix-only' },
  { name: 'Anthropic', factory: () => createAnthropicAdapter('sk-ant-test'), providerId: 'anthropic', expectsStructuredOutput: true, cacheStrategy: 'anthropic-ephemeral' },
  { name: 'Gemini', factory: () => createGeminiAdapter('test-key'), providerId: 'gemini', expectsStructuredOutput: true, cacheStrategy: 'prefix-only' },
  { name: 'Ollama', factory: () => createOllamaAdapter(), providerId: 'ollama', expectsStructuredOutput: false, cacheStrategy: 'prefix-only' },
];

describe('ProviderAdapter Contract', () => {
  describe.each(adapters)('$name adapter', ({ name, factory, providerId, expectsStructuredOutput, cacheStrategy }) => {
    const adapter = factory();

    it('satisfies the ProviderAdapter interface (all 6 methods)', () => {
      expect(adapter).toBeDefined();
      expect(adapter.providerId).toBe(providerId);
      expect(typeof adapter.createLanguageModel).toBe('function');
      expect(typeof adapter.validateConnection).toBe('function');
      expect(typeof adapter.supportsStructuredOutput).toBe('boolean');
      expect(typeof adapter.getDefaultModelForTier).toBe('function');
      expect(typeof adapter.getCacheStrategy).toBe('function');
      expect(typeof adapter.getTelemetryMetadata).toBe('function');
    });

    it(`has providerId = '${providerId}'`, () => {
      expect(adapter.providerId).toBe(providerId);
    });

    it(`supportsStructuredOutput = ${expectsStructuredOutput}`, () => {
      expect(adapter.supportsStructuredOutput).toBe(expectsStructuredOutput);
    });

    it(`getCacheStrategy returns '${cacheStrategy}'`, () => {
      expect(adapter.getCacheStrategy()).toBe(cacheStrategy);
    });

    it('getDefaultModelForTier returns non-empty string for all 3 tiers', () => {
      const tiers: ModelTier[] = ['FAST', 'BALANCED', 'ADVANCED'];
      for (const tier of tiers) {
        const model = adapter.getDefaultModelForTier(tier);
        expect(model).toBeTruthy();
        expect(typeof model).toBe('string');
        expect(model.length).toBeGreaterThan(0);
      }
    });

    it('getTelemetryMetadata returns object with provider key', () => {
      const meta = adapter.getTelemetryMetadata();
      expect(meta).toBeDefined();
      expect(meta).toHaveProperty('provider');
      expect(meta.provider).toBe(providerId);
    });

    it('createLanguageModel returns a LanguageModel instance', () => {
      const model = adapter.createLanguageModel('test-model');
      expect(model).toBeDefined();
      expect(typeof model).toBe('object');
    });
  });

  describe('Ollama-specific', () => {
    it('supportsStructuredOutput is false', () => {
      const adapter = createOllamaAdapter();
      expect(adapter.supportsStructuredOutput).toBe(false);
    });
  });
});
