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
 * GeminiProvider — Gemini generateContent adapter (plan 03-03).
 *
 * Wire shape (COVERAGE.md row 3, assumption A2):
 *   POST {base}/v1beta/models/{model}:streamGenerateContent?alt=sse
 *   POST {base}/v1beta/models/{model}:generateContent          (requestJson)
 * Streaming chunks are `data: {"candidates":[{"content":{"parts":
 * [{"text":"..."}]}}]}` inline chunks (no [DONE] marker) parsed by
 * StreamAdapter's gemini wire adapter; the last chunk carries a
 * `finishReason` — the wire terminator.
 *
 * Auth: `x-goog-api-key` HEADER, not the `key=` query param
 * (INTEGRATIONS.md documents key=, but CONCERNS.md flags query-param leakage
 * into proxies/logs — T-3-06; Gemini accepts the header). The key therefore
 * never appears in a URL, and no URL containing a key can reach a log call.
 *
 * JSON mode (Appendix L rule): `generationConfig.responseMimeType:
 * 'application/json'`.
 *
 * All I/O goes through Requester.request — never raw fetch, never an SDK.
 * Errors carry canonical §21.6 codes only (D-38).
 */

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';

export interface GeminiProviderConfig {
  /** §10.6 default https://generativelanguage.googleapis.com — overridable via np_endpoint_overrides (D-50). */
  baseUrl?: string;
  /** Operator API key (encrypted np_providers read, Phase 2). Sent as x-goog-api-key. */
  apiKey?: string;
  /** Resolved model for requestJson (D-47 interface carries no model there). */
  model?: string;
  /** Override Requester's 25s default timeout (D-35). */
  timeoutMs?: number;
}

interface GeminiMessage {
  role: string;
  content: string;
}

/** Map chat roles onto Gemini's user/model roles; system → systemInstruction. */
function buildContents(
  messages: LLMStreamRequest['messages'],
): { contents: GeminiMessage[]; systemInstruction?: { parts: Array<{ text: string }> } } {
  const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      content: m.content,
    }));
  return {
    contents,
    systemInstruction: systemText !== '' ? { parts: [{ text: systemText }] } : undefined,
  };
}

export class GeminiProvider implements ILLMProvider {
  readonly providerId: ProviderId = 'gemini';

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model?: string;
  private readonly timeoutMs?: number;

  constructor(config: GeminiProviderConfig = {}) {
    this.baseUrl = stripTrailingSlash(config.baseUrl ?? GEMINI_DEFAULT_BASE_URL);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
  }

  async *stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const { operationId } = request;
    if (signal?.aborted) {
      yield { type: 'STREAM_ABORTED', operationId };
      return;
    }
    const model = request.model ?? this.model;
    if (model === undefined) {
      // D-54a: a provider request never starts without a resolved model.
      yield {
        type: 'STREAM_ERROR',
        operationId,
        code: 'PROVIDER_MODEL_UNKNOWN',
        message: 'gemini: no model resolved for stream (TierResolver must supply it)',
      };
      return;
    }
    const { contents, systemInstruction } = buildContents(request.messages);
    const body = {
      contents,
      ...(systemInstruction !== undefined ? { systemInstruction } : {}),
      generationConfig: {
        ...request.options,
      },
    };
    debugLog('PROVIDER_STREAM_START', 'gemini streaming', { operationId, model });
    let response: Response;
    try {
      response = await httpRequest(
        this.generateUrl(model, true),
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
      debugLog('PROVIDER_STREAM_ERROR', 'gemini non-ok stream response', {
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
      yield { type: 'STREAM_ERROR', operationId, code: 'NETWORK', message: 'gemini response has no body' };
      return;
    }
    yield* streamBodyEvents(operationId, response.body, 'gemini', signal);
  }

  async requestJson(prompt: string, jsonSchema: unknown, signal?: AbortSignal): Promise<string> {
    if (this.model === undefined) {
      // D-54a: a provider request never starts without a resolved model.
      // WR-01: PROVIDER_MODEL_UNKNOWN (non-retryable) — same as stream().
      throw new ProviderError('PROVIDER_MODEL_UNKNOWN', 'gemini: no model resolved for requestJson (TierResolver must supply it)');
    }
    // Appendix L rule: native JSON-mode flag — responseMimeType application/json.
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    };
    let response: Response;
    try {
      response = await httpRequest(
        this.generateUrl(this.model, false),
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
    const parts = getPath(parsed, 'candidates', '0', 'content', 'parts');
    const text = (Array.isArray(parts) ? parts : [])
      .map((part) => asString(getPath(part, 'text')))
      .filter((t): t is string => t !== undefined)
      .join('');
    if (text === '') {
      throw new ProviderError('NETWORK', 'gemini: response had no candidate text');
    }
    return text;
  }

  /** {base}/v1beta/models/{model}:streamGenerateContent?alt=sse | :generateContent */
  private generateUrl(model: string, stream: boolean): string {
    const action = stream ? 'streamGenerateContent' : 'generateContent';
    const suffix = stream ? '?alt=sse' : '';
    return `${this.baseUrl}/v1beta/models/${encodeURIComponent(model)}:${action}${suffix}`;
  }

  /** x-goog-api-key header (T-3-06: header auth preferred over key= query param). */
  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey !== undefined) {
      headers['x-goog-api-key'] = this.apiKey;
    }
    return headers;
  }
}

/** Singleton instance registered by ProviderRegistry at module load (D-51). */
export const geminiProvider = new GeminiProvider();