// src/core/ai/providers/OllamaProvider.ts — Source: PRODUCT_SPEC §10.2 four-provider
// table (line 1553) + RESEARCH (npm 404 verified). createOllamaProvider(config) builds
// an ILLMProvider for the 'ollama' id via createOpenAI({ apiKey: 'ollama',
// baseURL: 'http://localhost:11434/v1', compatibility: 'compatible' }) — there is NO
// @ai-sdk/ollama package (E404 verified); Ollama rides the OpenAI-compatible endpoint
// (§10.2). The @ai-sdk/openai package is NOT imported here (Seam 1): getAISDKModel in
// ILLMProvider.ts is the only import site. Default context is 2048 tokens — callers
// must warn the user (Flow 5); supportsTools is model-dependent.
import { getAISDKModel, type ILLMProvider } from '../ILLMProvider';
import type { ProviderConfig } from '../types';

export interface OllamaProviderFactoryOptions {
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
}

export function createOllamaProvider(config: OllamaProviderFactoryOptions = {}): ILLMProvider {
  return {
    id: 'ollama',
    name: 'Ollama (local)',
    getAISDKModel: (model: string) =>
      getAISDKModel('ollama', model, {
        baseURL: config.baseURL,
        fetch: config.fetch,
      }),
    async *chat() {
      // @implementation-tier stub (Golden Rule 10): streamText consumption is
      // owned by StreamAdapter (03-03, Seam 3) — never callable from an adapter.
      throw new Error('ILLMProvider.chat is wired by StreamAdapter (03-03, Seam 3)');
    },
    async getModels() {
      // @implementation-tier stub: provider model-list calls land with the
      // wiring layer; nothing in Phase 3 consumes this (Golden Rule 10).
      throw new Error('ILLMProvider.getModels is not wired in Phase 3');
    },
    async validateConfig(candidate: ProviderConfig): Promise<boolean> {
      // Structural validation only — never touches the network or the vault
      // (Pitfall 4). apiKey is always 'ollama' (§10.2) and never part of the
      // stored config — only the endpoint must be present.
      return (
        candidate.id === 'ollama' &&
        typeof candidate.baseURL === 'string' &&
        candidate.baseURL.length > 0
      );
    },
  };
}
