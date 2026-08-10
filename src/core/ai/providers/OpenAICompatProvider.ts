// src/core/ai/providers/OpenAICompatProvider.ts — Source: PRODUCT_SPEC §10.2
// ("For OpenAI-compatible providers (e.g. DeepSeek, Together AI), use `openai`
// with a custom `baseURL`") + D-12. createOpenAICompatProvider({ baseURL }) is a
// FACTORY/config variant of OpenAIProvider — NOT a 5th ProviderId (the four-ID
// enum stays 'openai' | 'anthropic' | 'gemini' | 'ollama', §0.2). The returned
// provider carries id: 'openai' with the custom baseURL bound into
// getAISDKModel; Appendix D already maps 'deepseek-chat' → providerId: 'openai'.
// @ai-sdk/* packages are NOT imported here (Seam 1).
import { getAISDKModel, type ILLMProvider } from '../ILLMProvider';
import type { ProviderConfig } from '../types';

export interface OpenAICompatProviderFactoryOptions {
  /** Custom baseURL — the point of the variant (D-12); required. */
  baseURL: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

export function createOpenAICompatProvider(config: OpenAICompatProviderFactoryOptions): ILLMProvider {
  return {
    id: 'openai', // D-12: identity stays 'openai' — never a 5th ProviderId
    name: `OpenAI-compatible (${config.baseURL})`,
    getAISDKModel: (model: string) =>
      getAISDKModel('openai', model, {
        apiKey: config.apiKey,
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
      // (Pitfall 4). apiKey is optional: local OpenAI-compatible endpoints
      // (F-1) may serve without one.
      return (
        candidate.id === 'openai' &&
        typeof candidate.baseURL === 'string' &&
        candidate.baseURL.length > 0
      );
    },
  };
}
