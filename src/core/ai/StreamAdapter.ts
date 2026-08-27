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
 *    `StreamEvent` union (D-47). This file ships the OpenAI adapter;
 *    Anthropic/Gemini/Ollama adapters land in plan 03-03.
 *
 * Contract: MISSING terminator = STREAM_ERROR (REQ-R09). The OpenAI adapter
 * terminates on `data: [DONE]`; a stream that ends without its terminator
 * emits STREAM_ERROR so callers never see a silently-truncated response.
 */

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
}

const DEFAULT_ERROR_CODE: StreamErrorCode = 'NETWORK';

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
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null) return [];
    const choices = (parsed as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) return [];
    const delta = (choices[0] as { delta?: unknown } | undefined)?.delta;
    if (typeof delta !== 'object' || delta === null) return [];
    const content = (delta as { content?: unknown }).content;
    if (typeof content !== 'string' || content.length === 0) return [];
    return [{ type: 'STREAM_DELTA', operationId, delta: content }];
  } catch {
    // Non-JSON data lines (keep-alives, comments) are ignored, matching the
    // legacy parser's "Ignore parse errors on SSE boundary" behavior.
    return [];
  }
}

/**
 * Create an OpenAI-wired StreamAdapter for one operation.
 *
 * `push()` decodes chunks incrementally (TextDecoder stream mode), splits on
 * line boundaries, and parses `data:` payloads. `end()` flushes any trailing
 * partial line and — per REQ-R09 — emits STREAM_ERROR when the stream ended
 * without its `[DONE]` terminator.
 */
export function createStreamAdapter(operationId: string): StreamAdapter {
  const decoder = new TextDecoder('utf-8');
  const state: AdapterState = { sawTerminator: false, sawError: false };
  let buffer = '';
  let started = false;

  const emitDelta = (events: StreamEvent[]): StreamEvent[] => {
    // STREAM_START precedes the first delta (D-47).
    const out: StreamEvent[] = [];
    if (!started) {
      out.push({ type: 'STREAM_START', operationId });
      started = true;
    }
    out.push(...events);
    return out;
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
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        const parsed = parseOpenAIDataLine(payload, state, operationId);
        events.push(...parsed);
      }
      return emitDelta(events);
    },

    end(): StreamEvent[] {
      if (state.sawTerminator || state.sawError) return [];
      // Flush any remaining partial line (streams may end without trailing \n).
      const tail = buffer.trim();
      buffer = '';
      const events: StreamEvent[] = [];
      if (tail.startsWith('data:')) {
        events.push(...parseOpenAIDataLine(tail.slice(5).trim(), state, operationId));
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
 * Parse a complete OpenAI SSE text into canonical events.
 *
 * Convenience for tests/fixtures that hold the full wire bytes in memory:
 * feeds every line through the same incremental parser as `createStreamAdapter`.
 */
export function parseOpenAIStream(operationId: string, lines: string[]): StreamEvent[] {
  const adapter = createStreamAdapter(operationId);
  const events: StreamEvent[] = [];
  for (const line of lines) {
    events.push(...adapter.push(line + '\n'));
  }
  events.push(...adapter.end());
  return events;
}