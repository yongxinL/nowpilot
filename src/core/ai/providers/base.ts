import { request as httpRequest, RequesterError } from '../../http/Requester';
import { createStreamAdapter, type StreamAdapter, type WireFormat } from '../StreamAdapter';
import type { ILLMProvider, LLMStreamRequest } from '../ILLMProvider';
import type { ProviderId, StreamErrorCode, StreamEvent } from '../types';
import { debugLog } from '../../log/debugLog';

/**
 * Shared provider-side HTTP + wire plumbing for the five provider adapters
 * (plan 03-03).
 *
 * Everything in this module exists to enforce three locked contracts:
 *
 * 1. Canonical error codes only (D-38 / §21.6): provider adapters surface
 *    `RATE_LIMITED | TIMEOUT | NETWORK | PROVIDER_5XX | PROVIDER_AUTH |
 *    PROVIDER_MODEL_UNKNOWN` — never invented codes. RequesterError codes
 *    (RATE_LIMITED/TIMEOUT/NETWORK) pass through; HTTP statuses map via
 *    `statusToStreamError`.
 * 2. T-01-10 error-text discipline: error strings are built from status +
 *    server body only — an API key never reaches a log or error surface.
 * 3. All provider I/O goes through `Requester.request` (Phase 2) — never raw
 *    fetch (Don't Hand-Roll; INTEGRATIONS.md "client-side fetch, no SDKs").
 *
 * `OpenAIWireProvider` is the shared implementation of the OpenAI chat
 * completions wire shape used by OpenAI / OpenAICompat / Ollama: identical
 * `{model, messages, stream}` body, SSE `data:` lines + `[DONE]` streaming,
 * one non-stream `chat/completions` call for JSON-mode structured output.
 * The JSON-mode request field is the ONLY per-provider difference
 * (Appendix L rule — "the provider adapter must set the provider's JSON mode
 * flag natively"): OpenAI/OpenAICompat use `response_format:
 * {type:'json_object'}`, Ollama uses `format: 'json'`.
 */

// ---------------------------------------------------------------------------
// Canonical error mapping (§20.10 / §21.6, D-38)
// ---------------------------------------------------------------------------

/** Error thrown by provider adapters; carries the canonical stream-error code. */
export class ProviderError extends Error {
  readonly code: StreamErrorCode;
  constructor(code: StreamErrorCode, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}

/**
 * Map an HTTP status (plus optional server body text) onto the canonical
 * §20.10 code set. MODEL_UNKNOWN on 404 or on a 400 whose body names the
 * model; AUTH on 401/403; RATE_LIMITED on 429; PROVIDER_5XX on 5xx.
 * Anything else falls back to NETWORK (callers treat it as retryable).
 */
export function statusToStreamError(status: number, bodyText?: string): StreamErrorCode {
  if (status === 401 || status === 403) return 'PROVIDER_AUTH';
  if (status === 404) return 'PROVIDER_MODEL_UNKNOWN';
  if (status === 400 && bodyText !== undefined && /model/i.test(bodyText)) {
    return 'PROVIDER_MODEL_UNKNOWN';
  }
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'PROVIDER_5XX';
  return 'NETWORK';
}

/**
 * T-01-10 contract: build the human-readable error from the HTTP status and
 * the server-provided body ONLY — never a key, never a request URL.
 * Prefers a structured `error.message` when the body is JSON; otherwise caps
 * the raw body so a huge server payload cannot blow up a log line.
 */
export function buildErrorMessage(status: number, bodyText?: string): string {
  const trimmed = bodyText?.trim() ?? '';
  if (trimmed === '') return `HTTP ${status}`;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const err = (parsed as { error?: unknown } | null)?.error;
    if (typeof err === 'string') return `HTTP ${status}: ${err}`;
    if (typeof err === 'object' && err !== null) {
      const message = (err as Record<string, unknown>).message;
      if (typeof message === 'string') return `HTTP ${status}: ${message}`;
    }
  } catch {
    // Non-JSON body — fall through to the raw cap.
  }
  return `HTTP ${status}: ${trimmed.slice(0, 300)}`;
}

/**
 * Map a thrown error to a canonical code: RequesterError codes pass through
 * (RATE_LIMITED/TIMEOUT/NETWORK); anything else is a NETWORK failure.
 */
export function toStreamErrorCode(err: unknown): StreamErrorCode {
  if (err instanceof RequesterError) return err.code;
  return 'NETWORK';
}

// ---------------------------------------------------------------------------
// Small strict-safe JSON readers (no `any`)
// ---------------------------------------------------------------------------

/** Read a nested path from unknown JSON (array indices are string keys). */
export function getPath(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const key of keys) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export async function safeBodyText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Stream raw response-body bytes through the canonical wire adapter, emitting
 * canonical events. Shared by all five providers (D-47): caller aborts surface
 * as STREAM_ABORTED, mid-stream failures as STREAM_ERROR.
 */
export async function* streamBodyEvents(
  operationId: string,
  body: ReadableStream<Uint8Array>,
  wire: WireFormat,
  signal?: AbortSignal,
): AsyncIterable<StreamEvent> {
  const adapter: StreamAdapter = createStreamAdapter(operationId, wire);
  const reader = body.getReader();
  try {
    for (;;) {
      if (signal?.aborted) {
        yield { type: 'STREAM_ABORTED', operationId };
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        for (const event of adapter.push(value)) yield event;
      }
    }
    for (const event of adapter.end()) yield event;
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
  }
}

// ---------------------------------------------------------------------------
// Shared OpenAI-wire provider base
// ---------------------------------------------------------------------------

export interface OpenAIWireConfig {
  /** Provider base URL (no trailing slash handling needed — normalized here). */
  baseUrl: string;
  /** Operator API key. Absent → no Authorization header (Ollama, keyless self-hosted). */
  apiKey?: string;
  /**
   * Resolved model for `requestJson` — the D-47 interface carries no model on
   * `requestJson(prompt, jsonSchema, signal)`, so the instance holds the
   * tier-resolved model (03-05 registry constructs per-resolved-route
   * instances). `stream()` uses `request.model` and falls back to this.
   */
  model?: string;
  /** Override Requester's 25s default timeout (D-35). */
  timeoutMs?: number;
}

export abstract class OpenAIWireProvider implements ILLMProvider {
  abstract readonly providerId: ProviderId;

  /**
   * JSON-mode request field, set natively per provider (Appendix L rule):
   * OpenAI/OpenAICompat `{ response_format: { type: 'json_object' } }`,
   * Ollama `{ format: 'json' }`.
   */
  protected abstract readonly jsonModeBody: Record<string, unknown>;

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model?: string;
  private readonly timeoutMs?: number;

  constructor(config: OpenAIWireConfig) {
    this.baseUrl = stripTrailingSlash(config.baseUrl);
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
    const body = {
      model: request.model ?? this.model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      ...request.options,
    };
    debugLog('PROVIDER_STREAM_START', `${this.providerId} streaming`, {
      operationId,
      model: body.model,
    });
    let response: Response;
    try {
      response = await httpRequest(
        this.chatCompletionsUrl(),
        {
          method: 'POST',
          headers: this.authHeaders(),
          body: JSON.stringify(body),
          signal,
        },
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
      debugLog('PROVIDER_STREAM_ERROR', `${this.providerId} non-ok stream response`, {
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
      yield { type: 'STREAM_ERROR', operationId, code: 'NETWORK', message: `${this.providerId} response has no body` };
      return;
    }
    yield* streamBodyEvents(operationId, response.body, 'openai', signal);
  }

  async requestJson(prompt: string, jsonSchema: unknown, signal?: AbortSignal): Promise<string> {
    if (this.model === undefined) {
      // D-54a: a provider request never starts without a resolved model.
      throw new ProviderError(
        'NETWORK',
        `${this.providerId}: no model resolved for requestJson (TierResolver must supply it)`,
      );
    }
    const body = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      ...this.jsonModeBody,
    };
    let response: Response;
    try {
      response = await httpRequest(
        this.chatCompletionsUrl(),
        {
          method: 'POST',
          headers: this.authHeaders(),
          body: JSON.stringify(body),
          signal,
        },
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
    const content = asString(getPath(parsed, 'choices', '0', 'message', 'content'));
    if (content === undefined) {
      throw new ProviderError('NETWORK', `${this.providerId}: response had no choices[0].message.content`);
    }
    return content;
  }

  private chatCompletionsUrl(): string {
    return `${this.baseUrl}/chat/completions`;
  }

  protected authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey !== undefined) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }
}