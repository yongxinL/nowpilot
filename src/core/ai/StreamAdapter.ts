import type { StreamEvent, StreamErrorCode } from './types';

/**
 * StreamAdapter — incremental SSE parsing for the Phase 3 AI runtime (D-47).
 *
 * REQ-R09 rebuild target: the legacy `streamChatResponse` parser
 * (src/services/aiProvider.ts:405-446) reads only the private-proxy
 * `data.textChunk`/`data.thoughtChunk` fields and returns empty text on real
 * providers. This module replaces that with:
 *
 * 1. An incremental `TextDecoder({stream:true})` line buffer that handles
 *    CRLF and multi-byte UTF-8 boundaries (throttle-proxy discipline from
 *    RESEARCH Pitfall 1 / Don't Hand-Roll).
 * 2. Per-provider wire adapters that normalize raw SSE into the canonical
 *    `StreamEvent` union (D-47). OpenAI shipped in plan 03-01;
 *    Anthropic/Gemini/Ollama adapters land in plan 03-03.
 *
 * Contract: MISSING terminator = STREAM_ERROR (REQ-R09). Every adapter
 * terminates on its wire terminator — OpenAI `data: [DONE]`, Anthropic
 * `message_stop`, Gemini a `finishReason`-carrying chunk, Ollama `[DONE]` /
 * native `done: true` — and a stream that ends without it emits STREAM_ERROR
 * so callers never see a silently-truncated response.
 */

export type WireFormat = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface StreamAdapter {
  /** Feed raw wire bytes or a string chunk. Returns events emitted by this chunk. */
  push(chunk: Uint8Array | string): StreamEvent[];
  /** Signal end-of-stream. Flushes the line buffer; missing terminator → STREAM_ERROR. */
  end(): StreamEvent[];
}

/** Internal state shared across one stream's adapter. */
interface AdapterState {
  sawTerminator: boolean;
  sawError: boolean;
  /** Anthropic: the `event:` header awaiting its `data:` payload (persists across pushes). */
  pendingEventType: string | null;
}

const DEFAULT_ERROR_CODE: StreamErrorCode = 'NETWORK';

/** Strict-safe JSON.parse — malformed lines are ignored, never thrown. */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Read one field off an unknown JSON object (no `any`). */
function jsonField(obj: unknown, key: string): unknown {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>)[key] : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Parse a single SSE `data:` payload line from an OpenAI wire chunk.
 *
 * OpenAI chat.completions streaming emits:
 *   data: {"id":"...","choices":[{"index":0,"delta":{"content":"..."},"finish_reason":null}]}
 *   data: [DONE]
 *
 * Field path confirmed in-repo (CONCERNS.md:76-77); the envelope tolerates
 * extra/missing fields and keys on `choices[0].delta.content` (assumption A3).
 */
function parseOpenAIDataLine(line: string, state: AdapterState, operationId: string): StreamEvent[] {
  if (line === '[DONE]') {
    state.sawTerminator = true;
    return [{ type: 'STREAM_COMPLETE', operationId, fullText: '' }];
  }
  const parsed = safeJsonParse(line);
  if (typeof parsed !== 'object' || parsed === null) return [];
  const choices = jsonField(parsed, 'choices');
  if (!Array.isArray(choices) || choices.length === 0) return [];
  const delta = jsonField(choices[0], 'delta');
  if (typeof delta !== 'object' || delta === null) return [];
  const content = asString(jsonField(delta, 'content'));
  if (content === undefined || content.length === 0) return [];
  return [{ type: 'STREAM_DELTA', operationId, delta: content }];
}

/**
 * Parse one Anthropic `data:` payload (preceded by its `event:` header).
 *
 * Wire flow (RESEARCH Code Examples, [VERIFIED: platform.claude.com/docs]):
 *   message_start → content_block_start → content_block_delta* →
 *   content_block_stop → message_delta* → message_stop
 * with `ping` dispersed and `error` events possible.
 *
 *   event: content_block_delta
 *   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ello frien"}}
 *   event: message_stop
 *   data: {"type":"message_stop"}
 *
 * Dispatch keys on the payload's authoritative `type` field. WR-05: the
 * `event:` header (expectedEventType) is validated against that field — a
 * mismatch is a malformed wire and surfaces STREAM_ERROR instead of being
 * silently accepted. `error` events surface STREAM_ERROR; `message_stop` is
 * the terminator.
 */
function parseAnthropicDataLine(
  state: AdapterState,
  expectedEventType: string | null,
  payload: string,
  operationId: string,
): StreamEvent[] {
  const parsed = safeJsonParse(payload);
  if (typeof parsed !== 'object' || parsed === null) return [];
  const payloadType = asString(jsonField(parsed, 'type'));
  if (expectedEventType !== null && payloadType !== undefined && expectedEventType !== payloadType) {
    // WR-05: `event:` and `data.type` disagree — malformed wire, never silent.
    state.sawError = true;
    return [
      {
        type: 'STREAM_ERROR',
        operationId,
        code: DEFAULT_ERROR_CODE,
        message: `Anthropic wire mismatch: event: ${expectedEventType} vs data.type: ${payloadType}`,
      },
    ];
  }
  switch (payloadType) {
    case 'error': {
      state.sawError = true;
      const message = asString(jsonField(jsonField(parsed, 'error'), 'message'));
      return [{ type: 'STREAM_ERROR', operationId, code: DEFAULT_ERROR_CODE, message: message ?? 'Anthropic stream error' }];
    }
    case 'message_stop': {
      state.sawTerminator = true;
      return [{ type: 'STREAM_COMPLETE', operationId, fullText: '' }];
    }
    case 'content_block_delta': {
      const delta = jsonField(parsed, 'delta');
      if (jsonField(delta, 'type') !== 'text_delta') return [];
      const text = asString(jsonField(delta, 'text'));
      if (text === undefined || text.length === 0) return [];
      return [{ type: 'STREAM_DELTA', operationId, delta: text }];
    }
    default:
      // message_start, content_block_start/stop, message_delta, ping — no text.
      return [];
  }
}

/**
 * Parse one Gemini `data:` payload from `:streamGenerateContent?alt=sse`.
 *
 * Wire shape (assumption A2): inline chunks of
 *   data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
 * The last chunk carries `candidates[0].finishReason` (e.g. "STOP") — that is
 * the wire terminator (Gemini streams have no [DONE] marker). A stream that
 * ends without a finishReason chunk is truncated → STREAM_ERROR (REQ-R09).
 */
function parseGeminiDataLine(state: AdapterState, payload: string, operationId: string): StreamEvent[] {
  const parsed = safeJsonParse(payload);
  if (typeof parsed !== 'object' || parsed === null) return [];
  const candidates = jsonField(parsed, 'candidates');
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const candidate = candidates[0];
  // CR-04: parse parts FIRST — Gemini commonly delivers short completions as
  // a single chunk carrying BOTH the text parts and finishReason. Returning
  // STREAM_COMPLETE before reading parts would drop the co-located text and
  // render an empty answer.
  const parts = jsonField(jsonField(candidate, 'content'), 'parts');
  const events: StreamEvent[] = [];
  if (Array.isArray(parts)) {
    for (const part of parts) {
      const text = asString(jsonField(part, 'text'));
      if (text !== undefined && text.length > 0) {
        events.push({ type: 'STREAM_DELTA', operationId, delta: text });
      }
    }
  }
  const finishReason = asString(jsonField(candidate, 'finishReason'));
  if (finishReason !== undefined && finishReason.length > 0) {
    state.sawTerminator = true;
    events.push({ type: 'STREAM_COMPLETE', operationId, fullText: '' });
  }
  return events;
}

/**
 * Parse one Ollama `data:` payload (or bare NDJSON line).
 *
 * Production path (A4): the OpenAI-compatible `/v1/chat/completions` shape —
 * `data: {"choices":[{"delta":{"content":"..."}}]}` terminated by
 * `data: [DONE]` — identical to OpenAI. Native `/api/chat` NDJSON is a
 * fixtures-only alternative (COVERAGE OPT-OUT #5): bare JSON objects with
 * `{"message":{"content":"..."},"done":true}` — `done: true` is that wire's
 * terminator. Both shapes are tolerated here so conformance fixtures can
 * exercise the documented native wire without a production call site.
 */
function parseOllamaDataLine(state: AdapterState, payload: string, operationId: string): StreamEvent[] {
  if (payload === '[DONE]') {
    state.sawTerminator = true;
    return [{ type: 'STREAM_COMPLETE', operationId, fullText: '' }];
  }
  const parsed = safeJsonParse(payload);
  if (typeof parsed !== 'object' || parsed === null) return [];

  // OpenAI-compatible envelope (production path).
  const choices = jsonField(parsed, 'choices');
  if (Array.isArray(choices) && choices.length > 0) {
    const content = asString(jsonField(jsonField(choices[0], 'delta'), 'content'));
    if (content !== undefined && content.length > 0) {
      return [{ type: 'STREAM_DELTA', operationId, delta: content }];
    }
    return [];
  }

  // Native NDJSON shape (fixtures-only).
  const text = asString(jsonField(jsonField(parsed, 'message'), 'content'));
  if (jsonField(parsed, 'done') === true) {
    state.sawTerminator = true;
    const events: StreamEvent[] = [];
    if (text !== undefined && text.length > 0) {
      events.push({ type: 'STREAM_DELTA', operationId, delta: text });
    }
    events.push({ type: 'STREAM_COMPLETE', operationId, fullText: '' });
    return events;
  }
  if (text !== undefined && text.length > 0) {
    return [{ type: 'STREAM_DELTA', operationId, delta: text }];
  }
  return [];
}

/**
 * Create a wire-format-aware StreamAdapter for one operation.
 *
 * `push()` decodes chunks incrementally (TextDecoder stream mode), splits on
 * line boundaries, and parses `data:` payloads (plus Anthropic `event:`
 * headers and bare Ollama NDJSON lines). `end()` flushes any trailing partial
 * line and — per REQ-R09 — emits STREAM_ERROR when the stream ended without
 * its wire terminator.
 *
 * `wire` defaults to 'openai' so plan 03-01 consumers (FixtureProvider,
 * PlannerService) keep working unchanged.
 */
export function createStreamAdapter(operationId: string, wire: WireFormat = 'openai'): StreamAdapter {
  const decoder = new TextDecoder('utf-8');
  const state: AdapterState = { sawTerminator: false, sawError: false, pendingEventType: null };
  let buffer = '';
  let started = false;

  const emitDelta = (events: StreamEvent[]): StreamEvent[] => {
    // WR-05/CR-03: STREAM_START is emitted only when a STREAM_DELTA is
    // actually parsed — the contract "STREAM_START precedes the first delta"
    // must not fire on a chunk that produced zero deltas (Anthropic
    // message_start/ping, Gemini no-text chunks, role-only deltas). An
    // empty/truncated/error-first stream therefore yields STREAM_ERROR
    // WITHOUT a preceding STREAM_START, so the router never locks a provider
    // that produced zero tokens.
    const out: StreamEvent[] = [];
    for (const event of events) {
      if (!started && event.type === 'STREAM_DELTA') {
        out.push({ type: 'STREAM_START', operationId });
        started = true;
      }
      out.push(event);
    }
    return out;
  };

  const handleLine = (rawLine: string): StreamEvent[] => {
    const line = rawLine.trim();
    if (line === '') return [];
    if (wire === 'anthropic') {
      if (line.startsWith('event:')) {
        state.pendingEventType = line.slice(6).trim();
        return [];
      }
      if (line.startsWith('data:')) {
        // WR-05: the event header is consumed by exactly one data payload —
        // read + clear it so a data-only line is never validated against a
        // stale event.
        const expectedEventType = state.pendingEventType;
        state.pendingEventType = null;
        return parseAnthropicDataLine(state, expectedEventType, line.slice(5).trim(), operationId);
      }
      return [];
    }
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      if (wire === 'gemini') return parseGeminiDataLine(state, payload, operationId);
      if (wire === 'ollama') return parseOllamaDataLine(state, payload, operationId);
      return parseOpenAIDataLine(payload, state, operationId);
    }
    // Ollama native NDJSON lines are bare JSON objects (fixtures-only, A4).
    if (wire === 'ollama' && line.startsWith('{')) {
      return parseOllamaDataLine(state, line, operationId);
    }
    return [];
  };

  return {
    push(chunk: Uint8Array | string): StreamEvent[] {
      if (state.sawTerminator || state.sawError) return [];
      const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
      buffer += text;
      const lines = buffer.split(/\r?\n/);
      // Last element is a partial line (or empty at a clean line break) —
      // keep it in the buffer for the next push / end().
      buffer = lines.pop() ?? '';

      const events: StreamEvent[] = [];
      for (const rawLine of lines) {
        events.push(...handleLine(rawLine));
      }
      return emitDelta(events);
    },

    end(): StreamEvent[] {
      if (state.sawTerminator || state.sawError) return [];
      // Flush any remaining partial line (streams may end without trailing \n).
      const tail = buffer.trim();
      buffer = '';
      const events: StreamEvent[] = [];
      if (tail !== '') {
        events.push(...handleLine(tail));
      }
      if (!state.sawTerminator) {
        // REQ-R09: missing terminator = error.
        state.sawError = true;
        events.push({
          type: 'STREAM_ERROR',
          operationId,
          code: DEFAULT_ERROR_CODE,
          message: 'SSE stream ended without terminator',
        });
      }
      return emitDelta(events);
    },
  };
}

/**
 * Parse a complete wire-format SSE text into canonical events.
 *
 * Convenience for tests/fixtures that hold the full wire bytes in memory:
 * feeds every line through the same incremental parser as `createStreamAdapter`.
 */
function parseWireStream(operationId: string, lines: string[], wire: WireFormat): StreamEvent[] {
  const adapter = createStreamAdapter(operationId, wire);
  const events: StreamEvent[] = [];
  for (const line of lines) {
    events.push(...adapter.push(line + '\n'));
  }
  events.push(...adapter.end());
  return events;
}

export function parseOpenAIStream(operationId: string, lines: string[]): StreamEvent[] {
  return parseWireStream(operationId, lines, 'openai');
}

export function parseAnthropicStream(operationId: string, lines: string[]): StreamEvent[] {
  return parseWireStream(operationId, lines, 'anthropic');
}

export function parseGeminiStream(operationId: string, lines: string[]): StreamEvent[] {
  return parseWireStream(operationId, lines, 'gemini');
}

export function parseOllamaStream(operationId: string, lines: string[]): StreamEvent[] {
  return parseWireStream(operationId, lines, 'ollama');
}