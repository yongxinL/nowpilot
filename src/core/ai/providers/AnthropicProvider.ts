// src/core/ai/providers/AnthropicProvider.ts — Source: PRODUCT_SPEC §10.2 four-provider
// table + AI-SPEC §3. createAnthropicProvider(config) builds an ILLMProvider for the
// 'anthropic' id via createAnthropic({ apiKey, baseURL }) — the @ai-sdk/anthropic
// package is NOT imported here (Seam 1): getAISDKModel in ILLMProvider.ts is the only
// import site.
import { getAISDKModel, type ILLMProvider } from '../ILLMProvider';
import type { ProviderConfig } from '../types';

export interface AnthropicProviderFactoryOptions {
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
}

export function createAnthropicProvider(config: AnthropicProviderFactoryOptions = {}): ILLMProvider {
  return {
    id: 'anthropic',
    name: 'Anthropic',
    getAISDKModel: (model: string) =>
      getAISDKModel('anthropic', model, {
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
      // (Pitfall 4). Anthropic requires an apiKey (x-api-key header).
      return (
        candidate.id === 'anthropic' &&
        typeof candidate.apiKey === 'string' &&
        candidate.apiKey.length > 0 &&
        typeof candidate.baseURL === 'string' &&
        candidate.baseURL.length > 0
      );
    },
  };
}
