import { OpenAIWireProvider, type OpenAIWireConfig } from './base';

/**
 * OllamaProvider — Ollama via the OpenAI-compatible /v1 endpoint
 * (plan 03-03, assumption A4).
 *
 * Production path per §10.6 / D-50: `http://localhost:11434/v1/chat/
 * completions` — the same OpenAI wire shape as OpenAIProvider (SSE `data:`
 * lines + `[DONE]`). JSON mode uses Ollama's native `format: 'json'` field
 * (Appendix L rule — set natively per provider), not OpenAI's
 * `response_format`. No auth (local service).
 *
 * The native `/api/chat` NDJSON shape is NOT a production call site (COVERAGE
 * OPT-OUT #5); the StreamAdapter's ollama wire parser tolerates it in
 * conformance fixtures only.
 */

export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';

export interface OllamaProviderConfig extends Omit<OpenAIWireConfig, 'baseUrl' | 'apiKey'> {
  /** §10.6 default http://localhost:11434/v1 — overridable via np_endpoint_overrides (D-50). */
  baseUrl?: string;
}

export class OllamaProvider extends OpenAIWireProvider {
  readonly providerId = 'ollama' as const;

  protected readonly jsonModeBody: Record<string, unknown> = {
    format: 'json',
  };

  constructor(config: OllamaProviderConfig = {}) {
    super({ ...config, baseUrl: config.baseUrl ?? OLLAMA_DEFAULT_BASE_URL });
  }
}

/** Singleton instance registered by ProviderRegistry at module load (D-51). */
export const ollamaProvider = new OllamaProvider();