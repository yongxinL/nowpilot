/**
 * Anthropic wire-byte conformance fixtures (plan 03-03, D-48 matrix seed).
 *
 * Exact wire bytes from RESEARCH Code Examples (lines 437-446) +
 * [VERIFIED: platform.claude.com/docs/en/build-with-claude/streaming]:
 *
 *   event: content_block_delta
 *   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ello frien"}}
 *
 *   event: message_stop
 *   data: {"type":"message_stop"}
 *
 * Stream flow: message_start → content_block_start → content_block_delta* →
 * content_block_stop → message_delta* → message_stop; `ping` dispersed;
 * `error` events possible. StreamAdapter's anthropic wire adapter keys on the
 * payload's `type` field (content_block_delta/text_delta → STREAM_DELTA,
 * message_stop → STREAM_COMPLETE, error → STREAM_ERROR).
 */

/** Happy path: text delta terminated by message_stop (exact RESEARCH bytes). */
export const ANTHROPIC_ANSWER_STREAM = [
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ello frien"}}',
  'event: message_stop',
  'data: {"type":"message_stop"}',
];

/** Happy path accumulated across multiple deltas. */
export const ANTHROPIC_ANSWER_STREAM_SPLIT = [
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello, "}}',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"friend"}}',
  'event: message_stop',
  'data: {"type":"message_stop"}',
];

/** Full documented event flow with a dispersed ping — non-text events ignored. */
export const ANTHROPIC_STREAM_WITH_PING = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[]}}',
  'event: ping',
  'data: {"type":"ping"}',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
  'event: message_stop',
  'data: {"type":"message_stop"}',
];

/** Missing terminator — REQ-R09: no message_stop before EOF ⇒ STREAM_ERROR. */
export const ANTHROPIC_MISSING_TERMINATOR_STREAM = [
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"cut off"}}',
];

/** Server-side error event → STREAM_ERROR. */
export const ANTHROPIC_ERROR_STREAM = [
  'event: error',
  'data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
];

/** Empty stream (no lines at all, no terminator) — STREAM_ERROR. */
export const ANTHROPIC_EMPTY_STREAM: string[] = [];