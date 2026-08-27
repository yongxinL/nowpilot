/**
 * OpenAI wire-byte fixtures (D-48 golden matrix seed for this slice).
 *
 * Real OpenAI SSE chunk envelope (assumption A3):
 *   data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":...,"model":"...","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}
 *   data: [DONE]
 *
 * The delta content carries the JSON-mode response text. These fixtures feed
 * the incremental TextDecoder line-buffer parser (StreamAdapter) exactly like
 * live wire bytes — including CRLF line endings on one variant to prove the
 * boundary discipline.
 */

const CHUNK_ENVELOPE = {
  id: 'chatcmpl-8WzTqP6mTEST',
  object: 'chat.completion.chunk',
  created: 1_730_000_000,
  model: 'gpt-4o-mini',
};

function sseData(payload: string, crlf = false): string {
  return `data: ${payload}${crlf ? '\r\n' : '\n'}`;
}

function contentChunk(content: string, crlf = false): string {
  return sseData(
    JSON.stringify({
      ...CHUNK_ENVELOPE,
      choices: [{ index: 0, delta: { content }, finish_reason: null }],
    }),
    crlf,
  );
}

/** Happy path: valid answer decision JSON, terminated with [DONE]. */
export const OPENAI_ANSWER_STREAM = [
  contentChunk('{"action":"answer","reasonCode":"direct_answer"}'),
  sseData('[DONE]'),
];

/** Happy path with CRLF line endings (boundary discipline). */
export const OPENAI_ANSWER_STREAM_CRLF = [
  contentChunk('{"action":"answer","reasonCode":"direct_answer"}', true),
  sseData('[DONE]', true),
];

/** Happy path split across multiple deltas (incremental accumulation). */
export const OPENAI_ANSWER_STREAM_SPLIT = [
  contentChunk('{"action":"answer","re'),
  contentChunk('asonCode":"split_answer"}'),
  sseData('[DONE]'),
];

/** Malformed JSON decision — exercises the one-shot repair loop. */
export const OPENAI_MALFORMED_STREAM = [
  contentChunk('{"action":"answer","reasonCode": broken'),
  sseData('[DONE]'),
];

/** Repair-success response: valid JSON returned after the repair prompt. */
export const OPENAI_REPAIR_SUCCESS_STREAM = [
  contentChunk('{"action":"ask_clarification","question":"Which KB article?","options":["KB001","KB002"]}'),
  sseData('[DONE]'),
];

/** Repair-failure response: still malformed after the repair prompt. */
export const OPENAI_REPAIR_FAILURE_STREAM = [
  contentChunk('still not valid { json'),
  sseData('[DONE]'),
];

/** Missing terminator — REQ-R09: no [DONE] before EOF ⇒ STREAM_ERROR. */
export const OPENAI_MISSING_TERMINATOR_STREAM = [
  contentChunk('{"action":"answer","reasonCode":"cut_off"}'),
  // No [DONE] line.
];

/** Empty stream (no data lines at all, no terminator) — STREAM_ERROR. */
export const OPENAI_EMPTY_STREAM: string[] = [];