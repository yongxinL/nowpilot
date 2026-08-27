import { OpenAIWireProvider, type OpenAIWireConfig } from './base';

/**
 * OpenAICompatProvider — OpenAI-wire-compatible self-hosted endpoint adapter
 * (plan 03-03, D-56).
 *
 * Wire shape is identical to OpenAIProvider (chat/completions, SSE `[DONE]`,
 * `response_format` JSON mode), but the endpoint and auth come from an
 * operator-supplied config — the `np_endpoint_overrides` key (D-50), merged
 * over the §10.6 defaults at ProviderRegistry hydrate (plan 03-05). Typical
 * targets: LM Studio, vLLM, and OpenAI-wire proxies.
 *
 * Registered with NO tier default (D-56): OpenAICompat is tier-mapped only
 * when the operator explicitly assigns fast/balanced models in Options —
 * `resolveTier` never returns this provider otherwise.
 */

export interface OpenAICompatProviderConfig extends OpenAIWireConfig {
  /** Operator-assigned endpoint (np_endpoint_overrides key). REQUIRED. */
  baseUrl: string;
  /** Optional operator auth (Bearer). Keyless self-hosted endpoints omit it. */
  apiKey?: string;
}

export class OpenAICompatProvider extends OpenAIWireProvider {
  readonly providerId = 'openai-compat' as const;

  protected readonly jsonModeBody: Record<string, unknown> = {
    response_format: { type: 'json_object' },
  };

  constructor(config: OpenAICompatProviderConfig) {
    super(config);
  }
}