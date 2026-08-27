import { describe, it, expect } from 'vitest';
import {
  createStreamAdapter,
  parseOpenAIStream,
  parseAnthropicStream,
  parseGeminiStream,
  parseOllamaStream,
  type StreamAdapter,
} from '../../../src/core/ai/StreamAdapter';
import type { StreamEvent } from '../../../src/core/ai/types';
import {
  ANTHROPIC_ANSWER_STREAM,
  ANTHROPIC_ANSWER_STREAM_SPLIT,
  ANTHROPIC_STREAM_WITH_PING,
  ANTHROPIC_MISSING_TERMINATOR_STREAM,
  ANTHROPIC_ERROR_STREAM,
  ANTHROPIC_EMPTY_STREAM,
} from './fixtures/anthropic-stream';
import {
  GEMINI_ANSWER_STREAM,
  GEMINI_ANSWER_STREAM_SPLIT,
  GEMINI_MISSING_TERMINATOR_STREAM,
  GEMINI_EMPTY_STREAM,
} from './fixtures/gemini-stream';
import {
  OLLAMA_COMPAT_STREAM,
  OLLAMA_COMPAT_STREAM_SPLIT,
  OLLAMA_NATIVE_STREAM,
  OLLAMA_MISSING_TERMINATOR_STREAM,
  OLLAMA_EMPTY_STREAM,
} from './fixtures/ollama-stream';
import { OPENAI_ANSWER_STREAM, OPENAI_MISSING_TERMINATOR_STREAM, OPENAI_EMPTY_STREAM } from './fixtures/openai-stream';

/**
 * StreamAdapter per-provider wire conformance (plan 03-03, Task 3).
 *
 * REQ-R09 contract per provider × case:
 *   happy path          → STREAM_START … STREAM_DELTA* … STREAM_COMPLETE (accumulated text)
 *   missing terminator  → STREAM_ERROR (NETWORK) — never a silent truncation
 *   empty stream        → STREAM_ERROR (NETWORK)
 *
 * The fixtures carry the EXACT wire bytes from RESEARCH Code Examples
 * (lines 437-452) and are replayed through the REAL incremental adapter —
 * never a mocked parser (D-48). Additional cases: multi-delta accumulation,
 * dispersed Anthropic ping/error events, CRLF + multi-byte UTF-8 boundary
 * discipline (T-3-07).
 */

function accumulate(events: StreamEvent[]): string {
  return events
    .filter((e): e is Extract<StreamEvent, { type: 'STREAM_DELTA' }> => e.type === 'STREAM_DELTA')
    .map((e) => e.delta)
    .join('');
}

function lastType(events: StreamEvent[]): StreamEvent['type'] | undefined {
  return events.length > 0 ? events[events.length - 1].type : undefined;
}

/** Assert the canonical happy-path shape: start → deltas → complete. */
function expectHappy(events: StreamEvent[], text: string): void {
  expect(events[0]).toMatchObject({ type: 'STREAM_START' });
  expect(lastType(events)).toBe('STREAM_COMPLETE');
  expect(accumulate(events)).toBe(text);
}

/** Assert the REQ-R09 error shape: canonical NETWORK code, no terminator. */
function expectStreamError(events: StreamEvent[]): void {
  expect(lastType(events)).toBe('STREAM_ERROR');
  const error = events[events.length - 1];
  if (error.type === 'STREAM_ERROR') {
    expect(error.code).toBe('NETWORK');
  }
}

describe('StreamAdapter — OpenAI wire (parseOpenAIStream)', () => {
  it('happy path: data delta + [DONE] → STREAM_COMPLETE with accumulated text', () => {
    const events = parseOpenAIStream('op-openai-happy', OPENAI_ANSWER_STREAM);
    expectHappy(events, '{"action":"answer","reasonCode":"direct_answer"}');
  });

  it('missing terminator → STREAM_ERROR (REQ-R09)', () => {
    const events = parseOpenAIStream('op-openai-missing', OPENAI_MISSING_TERMINATOR_STREAM);
    expectStreamError(events);
  });

  it('empty stream → STREAM_ERROR (REQ-R09)', () => {
    const events = parseOpenAIStream('op-openai-empty', OPENAI_EMPTY_STREAM);
    expectStreamError(events);
  });
});

describe('StreamAdapter — Anthropic wire (parseAnthropicStream)', () => {
  it('happy path: content_block_delta/text_delta + message_stop → STREAM_COMPLETE', () => {
    const events = parseAnthropicStream('op-anthropic-happy', ANTHROPIC_ANSWER_STREAM);
    expectHappy(events, 'ello frien');
  });

  it('multiple deltas accumulate; message_start/ping non-text events are ignored', () => {
    const events = parseAnthropicStream('op-anthropic-split', ANTHROPIC_ANSWER_STREAM_SPLIT);
    expectHappy(events, 'Hello, friend');
    const withPing = parseAnthropicStream('op-anthropic-ping', ANTHROPIC_STREAM_WITH_PING);
    expectHappy(withPing, 'Hello');
  });

  it('missing terminator → STREAM_ERROR (REQ-R09)', () => {
    const events = parseAnthropicStream('op-anthropic-missing', ANTHROPIC_MISSING_TERMINATOR_STREAM);
    expectStreamError(events);
  });

  it('server error event → STREAM_ERROR with the provider message', () => {
    const events = parseAnthropicStream('op-anthropic-error', ANTHROPIC_ERROR_STREAM);
    expectStreamError(events);
    const error = events[events.length - 1];
    if (error.type === 'STREAM_ERROR') {
      expect(error.message).toBe('Overloaded');
    }
  });

  it('empty stream → STREAM_ERROR (REQ-R09)', () => {
    const events = parseAnthropicStream('op-anthropic-empty', ANTHROPIC_EMPTY_STREAM);
    expectStreamError(events);
  });
});

describe('StreamAdapter — Gemini wire (parseGeminiStream)', () => {
  it('happy path: candidates[].content.parts[].text + finishReason → STREAM_COMPLETE', () => {
    const events = parseGeminiStream('op-gemini-happy', GEMINI_ANSWER_STREAM);
    expectHappy(events, 'Hello friend');
  });

  it('multi-part chunks accumulate across lines', () => {
    const events = parseGeminiStream('op-gemini-split', GEMINI_ANSWER_STREAM_SPLIT);
    expectHappy(events, 'Hello friend');
  });

  it('missing terminator (no finishReason chunk) → STREAM_ERROR (REQ-R09)', () => {
    const events = parseGeminiStream('op-gemini-missing', GEMINI_MISSING_TERMINATOR_STREAM);
    expectStreamError(events);
  });

  it('empty stream → STREAM_ERROR (REQ-R09)', () => {
    const events = parseGeminiStream('op-gemini-empty', GEMINI_EMPTY_STREAM);
    expectStreamError(events);
  });
});

describe('StreamAdapter — Ollama wire (parseOllamaStream)', () => {
  it('happy path (OpenAI-compat /v1): delta + [DONE] → STREAM_COMPLETE', () => {
    const events = parseOllamaStream('op-ollama-happy', OLLAMA_COMPAT_STREAM);
    expectHappy(events, 'Hello');
  });

  it('happy path (OpenAI-compat) accumulated across deltas', () => {
    const events = parseOllamaStream('op-ollama-split', OLLAMA_COMPAT_STREAM_SPLIT);
    expectHappy(events, 'Hello friend');
  });

  it('native /api/chat NDJSON (fixtures-only): done:true is the terminator', () => {
    const events = parseOllamaStream('op-ollama-native', OLLAMA_NATIVE_STREAM);
    expectHappy(events, 'Hello friend');
  });

  it('missing terminator → STREAM_ERROR (REQ-R09)', () => {
    const events = parseOllamaStream('op-ollama-missing', OLLAMA_MISSING_TERMINATOR_STREAM);
    expectStreamError(events);
  });

  it('empty stream → STREAM_ERROR (REQ-R09)', () => {
    const events = parseOllamaStream('op-ollama-empty', OLLAMA_EMPTY_STREAM);
    expectStreamError(events);
  });
});

describe('StreamAdapter — incremental discipline (T-3-07)', () => {
  it('multi-byte UTF-8 split across 1-byte pushes survives the TextDecoder line buffer', () => {
    const wire =
      'data: {"choices":[{"delta":{"content":"héllo 世界"},"finish_reason":null}]}\r\n' +
      'data: [DONE]\r\n';
    const bytes = new TextEncoder().encode(wire);
    const adapter: StreamAdapter = createStreamAdapter('op-utf8', 'openai');
    const events: StreamEvent[] = [];
    for (let i = 0; i < bytes.length; i += 1) {
      events.push(...adapter.push(bytes.subarray(i, i + 1)));
    }
    events.push(...adapter.end());
    expectHappy(events, 'héllo 世界');
  });

  it('CRLF line endings parse identically across the Anthropic wire', () => {
    const adapter: StreamAdapter = createStreamAdapter('op-crlf', 'anthropic');
    const events: StreamEvent[] = [];
    for (const line of ANTHROPIC_ANSWER_STREAM) {
      events.push(...adapter.push(line + '\r\n'));
    }
    events.push(...adapter.end());
    expectHappy(events, 'ello frien');
  });

  it('a delta split mid-line across pushes accumulates (no partial-line loss)', () => {
    const adapter: StreamAdapter = createStreamAdapter('op-split-line', 'gemini');
    const events: StreamEvent[] = [];
    // "Hel" + "lo frie" + "nd" + finishReason — the final chunk is complete.
    events.push(...adapter.push('data: {"candidates":[{"content":{"parts":[{"text":"Hel'));
    events.push(...adapter.push('lo frien"}]}}]}\n'));
    events.push(...adapter.push('data: {"candidates":[{"content":{},"finishReason":"STOP"}]}\n'));
    events.push(...adapter.end());
    expectHappy(events, 'Hello frien');
  });
});