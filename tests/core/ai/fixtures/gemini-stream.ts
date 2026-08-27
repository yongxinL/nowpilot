/**
 * Gemini wire-byte conformance fixtures (plan 03-03, D-48 matrix seed).
 *
 * Wire shape (assumption A2 — ai.google.dev unreachable at research; re-verify
 * against the live API at implementation):
 *
 *   data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
 *
 * `:streamGenerateContent?alt=sse` emits one SSE `data:` line per inline
 * chunk. There is NO [DONE] marker — the last chunk carries
 * `candidates[0].finishReason` (e.g. "STOP"), which is the wire terminator.
 * A stream that ends without a finishReason chunk is truncated → STREAM_ERROR
 * (REQ-R09).
 */

/** Happy path: text part(s), terminated by the finishReason chunk. */
export const GEMINI_ANSWER_STREAM = [
  'data: {"candidates":[{"content":{"parts":[{"text":"Hello friend"}]}}]}',
  'data: {"candidates":[{"content":{},"finishReason":"STOP"}]}',
];

/** Happy path with multiple parts + split accumulation. */
export const GEMINI_ANSWER_STREAM_SPLIT = [
  'data: {"candidates":[{"content":{"parts":[{"text":"Hel"},{"text":"lo"}]}}]}',
  'data: {"candidates":[{"content":{"parts":[{"text":" friend"}]}}]}',
  'data: {"candidates":[{"content":{},"finishReason":"STOP"}]}',
];

/** Missing terminator — REQ-R09: no finishReason chunk before EOF ⇒ STREAM_ERROR. */
export const GEMINI_MISSING_TERMINATOR_STREAM = [
  'data: {"candidates":[{"content":{"parts":[{"text":"cut off"}]}}]}',
];

/** Empty stream (no lines at all, no terminator) — STREAM_ERROR. */
export const GEMINI_EMPTY_STREAM: string[] = [];