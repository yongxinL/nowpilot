import type { ProviderId, StreamEvent } from './types';

/**
 * ILLMProvider — the canonical provider contract for the Phase 3 AI runtime
 * (D-47).
 *
 * Two methods:
 *
 * - `stream(request, signal)` — SSE streaming. Returns an async iterable of
 *   canonical `StreamEvent`s (STREAM_START/DELTA/COMPLETE/ERROR/ABORTED,
 *   D-47). The per-provider wire formats are normalized by StreamAdapter,
 *   NOT by the provider implementation.
 * - `requestJson(prompt, jsonSchema, signal)` — JSON-mode structured output
 *   (Appendix L). The provider sets its JSON-mode flag natively per provider
 *   (OpenAI `response_format`, Gemini `responseMimeType`, etc.) and returns
 *   the raw model text; StructuredOutput.requestJson parses/repairs it.
 *
 * The legacy onChunk/onDone callback surface is NOT part of this interface
 * (D-47 — the old `StreamChatParams` in src/services/aiProvider.ts is retired).
 */

export interface LLMStreamRequest {
  /** Phase-1 OperationId correlation (Flag C) — no new id scheme. */
  operationId: string;
  providerId: ProviderId;
  model: string;
  messages: Array<{ role: string; content: string }>;
  /** Provider-specific streaming options (temperature, maxTokens, etc.). */
  options?: Record<string, unknown>;
}

export interface LLMJsonRequest {
  /** Phase-1 OperationId correlation (Flag C). */
  operationId: string;
  providerId: ProviderId;
  model: string;
  prompt: string;
  /** JSON Schema (zodToJsonSchema output) for the provider's JSON mode. */
  jsonSchema: unknown;
}

export interface ILLMProvider {
  readonly providerId: ProviderId;
  stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent>;
  requestJson(prompt: string, jsonSchema: unknown, signal?: AbortSignal): Promise<string>;
}