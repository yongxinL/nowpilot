import { OpenAIWireProvider, type OpenAIWireConfig } from './base';

/**
 * OpenAIProvider — OpenAI Chat Completions adapter (plan 03-03).
 *
 * Wire shape (COVERAGE.md row 1, §10.6): POST {base}/chat/completions with
 * Bearer auth, `stream: true` for SSE (`data:` lines + `[DONE]`, parsed by
 * StreamAdapter's OpenAI wire adapter), and `response_format:
 * {type:'json_object'}` as the native JSON-mode flag (Appendix L rule).
 *
 * All I/O goes through Requester.request — never raw fetch, never an SDK
 * (INTEGRATIONS.md). Errors carry canonical §21.6 codes only (D-38).
 */

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export interface OpenAIProviderConfig extends Omit<OpenAIWireConfig, 'baseUrl'> {
  /** §10.6 default https://api.openai.com/v1 — overridable via np_endpoint_overrides (D-50). */
  baseUrl?: string;
}

export class OpenAIProvider extends OpenAIWireProvider {
  readonly providerId = 'openai' as const;

  protected readonly jsonModeBody: Record<string, unknown> = {
    response_format: { type: 'json_object' },
  };

  constructor(config: OpenAIProviderConfig = {}) {
    super({ ...config, baseUrl: config.baseUrl ?? OPENAI_DEFAULT_BASE_URL });
  }
}

/** Singleton instance registered by ProviderRegistry at module load (D-51). */
export const openaiProvider = new OpenAIProvider();