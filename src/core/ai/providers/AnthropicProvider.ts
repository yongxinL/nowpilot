import { request as httpRequest } from '../../http/Requester';
import type { ILLMProvider, LLMStreamRequest } from '../ILLMProvider';
import type { ProviderId, StreamEvent } from '../types';
import { debugLog } from '../../log/debugLog';
import {
  ProviderError,
  asString,
  buildErrorMessage,
  getPath,
  safeBodyText,
  safeJsonParse,
  statusToStreamError,
  streamBodyEvents,
  stripTrailingSlash,
  toStreamErrorCode,
} from './base';

/**
 * AnthropicProvider — Anthropic Messages adapter (plan 03-03).
 *
 * Wire shape (COVERAGE.md row 2, aiProvider.ts:78-88 auth pattern):
 *   POST {base}/v1/messages
 *   headers: x-api-key + anthropic-version: 2023-06-01
 * Streaming via `stream: true` — SSE `event:` / `data:` pairs parsed by
 * StreamAdapter's anthropic wire adapter (text from content_block_delta
 * text_delta, terminator message_stop, error events surfaced).
 *
 * JSON mode (A6 — chosen mechanism, confirmed against the live API docs at
 * implementation): Anthropic's current GA structured-output parameter is
 * `output_config.format: {type:'json_schema', schema}` on the Messages API
 * (moved from the beta `output_format` field; no beta header required). The
 * conformance fixture must match this implemented shape.
 *
 * All I/O goes through Requester.request — never raw fetch, never an SDK.
 * Errors carry canonical §21.6 codes only (D-38): 401/403 → PROVIDER_AUTH,
 * 5xx → PROVIDER_5XX, 400/404 model → PROVIDER_MODEL_UNKNOWN.
 */

export const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION_HEADER = '2023-06-01';
const DEFAULT_MAX_TOKENS = 1024;

export interface AnthropicProviderConfig {
  /** §10.6 default https://api.anthropic.com — overridable via np_endpoint_overrides (D-50). */
  baseUrl?: string;
  /** Operator API key (encrypted np_providers read, Phase 2). */
  apiKey?: string;
  /** Resolved model for requestJson (D-47 interface carries no model there). */
  model?: string;
  /** Override Requester's 25s default timeout (D-35). */
  timeoutMs?: number;
  /** Max output tokens — Anthropic requires this field. Default 1024. */
  maxTokens?: number;
}

/** Split `system` messages out of the content array (Anthropic top-level field). */
function splitSystem(
  messages: LLMStreamRequest['messages'],
): { system?: string; messages: Array<{ role: string; content: string }> } {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: messages.filter((m) => m.role !== 'system'),
  };
}

export class AnthropicProvider implements ILLMProvider {
  readonly providerId: ProviderId = 'anthropic';

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model?: string;
  private readonly timeoutMs?: number;
  private readonly maxTokens: number;

  constructor(config: AnthropicProviderConfig = {}) {
    this.baseUrl = stripTrailingSlash(config.baseUrl ?? ANTHROPIC_DEFAULT_BASE_URL);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async *stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const { operationId } = request;
    if (signal?.aborted) {
      yield { type: 'STREAM_ABORTED', operationId };
      return;
    }
    const { system, messages } = splitSystem(request.messages);
    const body = {
      model: request.model ?? this.model,
      max_tokens: this.maxTokens,
      ...(system !== undefined ? { system } : {}),
      messages,
      stream: true,
      ...request.options,
    };
    debugLog('PROVIDER_STREAM_START', 'anthropic streaming', { operationId, model: body.model });
    let response: Response;
    try {
      response = await httpRequest(
        `${this.baseUrl}/v1/messages`,
        { method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal },
        { timeoutMs: this.timeoutMs },
      );
    } catch (err) {
      if (signal?.aborted) {
        yield { type: 'STREAM_ABORTED', operationId };
      } else {
        yield {
          type: 'STREAM_ERROR',
          operationId,
          code: toStreamErrorCode(err),
          message: err instanceof Error ? err.message : String(err),
        };
      }
      return;
    }
    if (!response.ok) {
      const bodyText = await safeBodyText(response);
      debugLog('PROVIDER_STREAM_ERROR', 'anthropic non-ok stream response', {
        operationId,
        status: response.status,
      });
      yield {
        type: 'STREAM_ERROR',
        operationId,
        code: statusToStreamError(response.status, bodyText),
        message: buildErrorMessage(response.status, bodyText),
      };
      return;
    }
    if (!response.body) {
      yield { type: 'STREAM_ERROR', operationId, code: 'NETWORK', message: 'anthropic response has no body' };
      return;
    }
    yield* streamBodyEvents(operationId, response.body, 'anthropic', signal);
  }

  async requestJson(prompt: string, jsonSchema: unknown, signal?: AbortSignal): Promise<string> {
    if (this.model === undefined) {
      // D-54a: a provider request never starts without a resolved model.
      throw new ProviderError(
        'NETWORK',
        'anthropic: no model resolved for requestJson (TierResolver must supply it)',
      );
    }
    // A6: native JSON-mode flag — output_config.format json_schema (current GA
    // structured-output mechanism; the fixture must match this shape).
    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema: jsonSchema } },
    };
    let response: Response;
    try {
      response = await httpRequest(
        `${this.baseUrl}/v1/messages`,
        { method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal },
        { timeoutMs: this.timeoutMs },
      );
    } catch (err) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      throw new ProviderError(toStreamErrorCode(err), err instanceof Error ? err.message : String(err));
    }
    const bodyText = await safeBodyText(response);
    if (!response.ok) {
      throw new ProviderError(
        statusToStreamError(response.status, bodyText),
        buildErrorMessage(response.status, bodyText),
      );
    }
    const parsed = safeJsonParse(bodyText);
    const content = getPath(parsed, 'content');
    const text = (Array.isArray(content) ? content : [])
      .map((block) => asString(getPath(block, 'text')))
      .filter((t): t is string => t !== undefined)
      .join('');
    if (text === '') {
      throw new ProviderError('NETWORK', 'anthropic: response had no text content');
    }
    return text;
  }

  /** x-api-key + anthropic-version (aiProvider.ts:78-88 pattern). */
  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION_HEADER,
    };
    if (this.apiKey !== undefined) {
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }
}

/** Singleton instance registered by ProviderRegistry at module load (D-51). */
export const anthropicProvider = new AnthropicProvider();