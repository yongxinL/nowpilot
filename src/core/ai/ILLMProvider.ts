// src/core/ai/ILLMProvider.ts — Source: PRODUCT_SPEC §10.1 Provider Interface
// (lines 1528-1544) + AI-SPEC §3 Entry Point (Seam 1). getAISDKModel() is the
// single factory switch and the ONLY import site of @ai-sdk/* packages in the
// codebase (Seam 1 — grep-verified by 03-02 Verify). ProviderId is imported
// from './types' (src/core/ai/types.ts canonical home, R-1): the §10.1
// reference block's inline four-ID enum is a shape sketch — the single
// canonical declaration is 03-01's ai/types.ts, never re-declared here.
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

import type { LLMMessage, LLMOptions, LLMStreamChunk, ModelInfo, ProviderConfig, ProviderId } from './types';

export interface ILLMProvider {
  id: ProviderId;
  name: string;
  chat(messages: LLMMessage[], options: LLMOptions): AsyncIterable<LLMStreamChunk>;
  getModels(): Promise<ModelInfo[]>;
  validateConfig(config: ProviderConfig): Promise<boolean>;
  getAISDKModel(model: string): LanguageModel;
}

/**
 * Optional per-call config for getAISDKModel. `fetch` is the documented test
 * seam (A6): provider tests inject a mock fetch so the REAL SDK runs against a
 * fake transport (RESEARCH Pattern 4 — verified live for createOpenAI). Keys
 * live only in this config object passed to the SDK factory; they are never
 * logged (T-03-02-01, R-10).
 */
export interface GetAISDKModelConfig {
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * §10.1 getAISDKModel — one factory switch, shared by all four adapters +
 * OpenAICompat (D-12). Model ids pass through to the provider factory callable
 * with the provider's own id naming (A4: 'deepseek-chat' via the openai
 * factory). The returned LanguageModel is the only handle every
 * generateObject/streamText/generateText call takes.
 */
export function getAISDKModel(providerId: ProviderId, model: string, cfg: GetAISDKModelConfig = {}): LanguageModel {
  switch (providerId) {
    case 'openai':
      // F-1: compatibility 'compatible' everywhere — local/OpenAI-compatible
      // endpoints only; the official OpenAI endpoint is not targeted. 'strict'
      // is never used (03-02 grep gate asserts zero occurrences).
      return createOpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, compatibility: 'compatible', fetch: cfg.fetch })(model);
    case 'anthropic':
      return createAnthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, fetch: cfg.fetch })(model);
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, fetch: cfg.fetch })(model);
    case 'ollama':
      // §10.2: no @ai-sdk/ollama package exists (npm 404, RESEARCH-verified) —
      // Ollama rides the OpenAI-compatible endpoint.
      return createOpenAI({
        apiKey: 'ollama',
        baseURL: cfg.baseURL ?? 'http://localhost:11434/v1',
        compatibility: 'compatible',
        fetch: cfg.fetch,
      })(model);
  }
}
