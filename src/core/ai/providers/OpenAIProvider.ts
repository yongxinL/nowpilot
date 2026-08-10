// src/core/ai/providers/OpenAIProvider.ts — Source: PRODUCT_SPEC §10.2 four-provider
// table + AI-SPEC §3 (F-1). createOpenAIProvider(config) builds an ILLMProvider for
// the 'openai' id using createOpenAI({ apiKey, baseURL, compatibility: 'compatible' })
// — F-1: 'compatible' everywhere (local/OpenAI-compatible endpoints only; the
// official OpenAI endpoint is not targeted). The @ai-sdk/openai package is NOT
// imported here (Seam 1): getAISDKModel in ILLMProvider.ts is the only import site.
import { getAISDKModel, type ILLMProvider } from '../ILLMProvider';
import type { LLMStreamChunk, ProviderConfig } from '../types';

export interface OpenAIProviderFactoryOptions {
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
}

export function createOpenAIProvider(config: OpenAIProviderFactoryOptions = {}): ILLMProvider {
  return {
    id: 'openai',
    name: 'OpenAI / OpenAI-compatible',
    getAISDKModel: (model: string) =>
      getAISDKModel('openai', model, {
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        fetch: config.fetch,
      }),
    chat(): AsyncIterable<LLMStreamChunk> {
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
      // (Pitfall 4). apiKey is optional: local/OpenAI-compatible endpoints
      // (F-1) may serve without one.
      return (
        candidate.id === 'openai' &&
        typeof candidate.baseURL === 'string' &&
        candidate.baseURL.length > 0
      );
    },
  };
}
