/**
 * Ollama wire-byte conformance fixtures (plan 03-03, D-48 matrix seed).
 *
 * Two wire shapes (assumption A4):
 *
 * 1. PRODUCTION PATH — the OpenAI-compatible `/v1/chat/completions` shape
 *    (§10.6 / D-50: `http://localhost:11434/v1`):
 *      data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}
 *      data: [DONE]
 *
 * 2. FIXTURES-ONLY — the native `/api/chat` NDJSON shape (COVERAGE OPT-OUT #5:
 *    documented alternative, no production call site). Bare JSON objects per
 *    line; the last message carries `"done": true` — that wire's terminator:
 *      {"message":{"role":"assistant","content":"Hello"},"done":false}
 *      {"message":{"role":"assistant","content":""},"done":true,"done_reason":"stop"}
 *
 * StreamAdapter's ollama wire adapter tolerates both.
 */

/** Production path (OpenAI-compat): delta + [DONE] terminator. */
export const OLLAMA_COMPAT_STREAM = [
  'data: {"choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
  'data: [DONE]',
];

/** Production path accumulated across deltas. */
export const OLLAMA_COMPAT_STREAM_SPLIT = [
  'data: {"choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
  'data: {"choices":[{"index":0,"delta":{"content":" friend"},"finish_reason":null}]}',
  'data: [DONE]',
];

/** Native /api/chat NDJSON (fixtures-only): done:true is the terminator. */
export const OLLAMA_NATIVE_STREAM = [
  '{"message":{"role":"assistant","content":"Hello"},"done":false}',
  '{"message":{"role":"assistant","content":" friend"},"done":false}',
  '{"message":{"role":"assistant","content":""},"done":true,"done_reason":"stop"}',
];

/** Missing terminator — REQ-R09: no [DONE] before EOF ⇒ STREAM_ERROR. */
export const OLLAMA_MISSING_TERMINATOR_STREAM = [
  'data: {"choices":[{"index":0,"delta":{"content":"cut off"},"finish_reason":null}]}',
];

/** Empty stream (no lines at all, no terminator) — STREAM_ERROR. */
export const OLLAMA_EMPTY_STREAM: string[] = [];