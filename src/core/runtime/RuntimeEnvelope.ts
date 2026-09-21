import { generateOperationId } from './OperationId';

/**
 * Canonical cross-context message-type registry (PRODUCT_SPEC Appendix E).
 *
 * ONE source for the message-type list: `MessageTypeValues` is derived from
 * this object, never hand-maintained beside it. The prototype's reversed
 * side-panel / standalone open spellings are replaced by the canonical
 * `OPEN_SIDE_PANEL` / `OPEN_STANDALONE` literals below (OQ7).
 *
 * This module stays zod-free on purpose: the content script imports
 * `createEnvelope` from here, and the payload schemas live in
 * `RuntimeEnvelopeValidation.ts` so the zod runtime never enters the
 * content-script bundle (§22 content bundle budget). They are re-exported at
 * the bottom so the canonical import path is unchanged.
 */
export const MessageType = {
  PROXY_FETCH: 'PROXY_FETCH',
  EXTRACT_PAGE_CONTENT: 'EXTRACT_PAGE_CONTENT',
  OPEN_SIDE_PANEL: 'OPEN_SIDE_PANEL',
  OPEN_STANDALONE: 'OPEN_STANDALONE',
  SESSION_TOKEN_UPDATE: 'SESSION_TOKEN_UPDATE',
  BACKGROUND_STATE: 'BACKGROUND_STATE',
  KEEPALIVE_PING: 'KEEPALIVE_PING',
  PORT_STREAM_START: 'PORT_STREAM_START',
  PORT_STREAM_CHUNK: 'PORT_STREAM_CHUNK',
  PORT_STREAM_END: 'PORT_STREAM_END',
  PORT_STREAM_ABORT: 'PORT_STREAM_ABORT',
  ADDON_EVENT: 'ADDON_EVENT',
  WORKSPACE_HANDOFF: 'WORKSPACE_HANDOFF',
  WORKSPACE_UPDATED: 'WORKSPACE_UPDATED',
  WORKSPACE_HEARTBEAT: 'WORKSPACE_HEARTBEAT',
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

export const MessageTypeValues = Object.values(MessageType) as MessageTypeValue[];

/**
 * Scaffold-local literals — NOT part of Appendix E and NOT canonical.
 *
 * These belong to capabilities no Phase-1 requirement owns: the content-script
 * lifecycle notices (`CONTENT_SCRIPT_READY`, `SPA_NAVIGATION`) and the frozen
 * extraction pipeline (`PAGE_LIVE_CONTEXT`, `PAGE_EXTRACTION_REQUESTED`,
 * `PAGE_HTML_PAYLOAD`). They are declared here, unimplemented: no Phase-1
 * handler is registered for any of them, so no surface can claim a capability
 * the runtime does not have (T-1-29). Phase 6 (extraction) and Phase 17
 * (ServiceNow strategy registration) claim them and move them into the
 * canonical registry at that point.
 */
export const ScaffoldMessageType = {
  CONTENT_SCRIPT_READY: 'CONTENT_SCRIPT_READY',
  SPA_NAVIGATION: 'SPA_NAVIGATION',
  PAGE_LIVE_CONTEXT: 'PAGE_LIVE_CONTEXT',
  PAGE_EXTRACTION_REQUESTED: 'PAGE_EXTRACTION_REQUESTED',
  PAGE_HTML_PAYLOAD: 'PAGE_HTML_PAYLOAD',
} as const;

export type ScaffoldMessageTypeValue =
  (typeof ScaffoldMessageType)[keyof typeof ScaffoldMessageType];

export const ScaffoldMessageTypeValues = Object.values(
  ScaffoldMessageType,
) as ScaffoldMessageTypeValue[];

/** Every type a `RuntimeEnvelope` may carry: canonical plus the two registries' union. */
export type EnvelopeType = MessageTypeValue | ScaffoldMessageTypeValue;

/**
 * D-15 / REQ-R04: payload shape for the frozen extraction envelope.
 *
 * Phase 1 declares this shape only — no production code constructs or
 * consumes a `PageHtmlPayload` yet. Phase 6 imports this exact shape
 * (per finding M8) when wiring `PageContentService` (Defuddle/Readability
 * decision is settled by the Phase 6 spike in RESEARCH.md). The optional
 * `strategyId` field is reserved for Phase 17's ServiceNow strategy
 * registration; leaving it `undefined` in Phase 1 is correct.
 */
export interface PageHtmlPayload {
  html: string;
  baseUrl: string;
  truncated: boolean;
  /** Reserved for Phase 17 ServiceNow strategy registration. */
  strategyId?: string;
}

export const ENVELOPE_SOURCES = [
  'background',
  'sidepanel',
  'standalone',
  'content',
  'popup',
] as const;

export type EnvelopeSource = (typeof ENVELOPE_SOURCES)[number];

export interface RuntimeEnvelope<T = unknown> {
  type: EnvelopeType;
  operationId: string;
  timestamp: number;
  source: EnvelopeSource;
  payload: T;
}

export function createEnvelope<T>(
  type: EnvelopeType,
  payload: T,
  source: RuntimeEnvelope['source'],
): RuntimeEnvelope<T> {
  return {
    type,
    operationId: generateOperationId(),
    timestamp: Date.now(),
    source,
    payload,
  };
}

export type { RuntimeEnvelopeValidation } from './RuntimeEnvelopeValidation';

// `validateEnvelope` and `isEnvelope` live in `RuntimeEnvelopeValidation.ts`
// and are deliberately NOT re-exported here: a re-export keeps the zod graph
// reachable from this module, and the content script imports `createEnvelope`
// from this module (measured: re-exporting grew the content bundle from
// 4.1 kB to 73.7 kB). Import them from `./RuntimeEnvelopeValidation` wherever
// envelope validation is needed (the background message path and the suites).
