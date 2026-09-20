export const MessageTypeValues = [
  'GET_ACTIVE_TAB_CONTEXT',
  'EXTRACT_PAGE_CONTENT',
  'PROXY_FETCH',
  'SIDE_PANEL_OPEN',
  'STANDALONE_OPEN',
  'WORKSPACE_HANDOFF',
  'WORKSPACE_UPDATED',
  'STREAM_STATE_CHANGED',
  // Scaffold-local runtime types (NOT part of spec Appendix E).
  // The content script sends these on page-load and on SPA navigation;
  // BackgroundRouter pre-registers advisory (console.debug-only) handlers
  // for them. They are scaffold-only — when the typed MessageType registry
  // (Appendix E) is wired in a later plan, these two values migrate there
  // and out of MessageTypeValues.
  'CONTENT_SCRIPT_READY',
  'SPA_NAVIGATION',
  // D-15 / REQ-R04: Phase 6 (extraction) consumes these; Phase 1 declares
  // types only — no runtime handler. Phase 17 reserves `strategyId` on the
  // PAGE_HTML_PAYLOAD shape for the ServiceNow strategy registration. Do
  // NOT register a BackgroundRouter/MessageBus handler here until the
  // Phase 6 spike (Defuddle-vs-Readability architecture decision) lands.
  'PAGE_LIVE_CONTEXT',
  'PAGE_EXTRACTION_REQUESTED',
  'PAGE_HTML_PAYLOAD',
] as const;

export type MessageType = (typeof MessageTypeValues)[number];

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

export interface RuntimeEnvelope<T = unknown> {
  type: MessageType;
  operationId: string;
  timestamp: number;
  source: 'background' | 'sidepanel' | 'standalone' | 'content' | 'popup';
  payload: T;
}

export function createEnvelope<T>(
  type: MessageType,
  payload: T,
  source: RuntimeEnvelope['source'],
): RuntimeEnvelope<T> {
  return {
    type,
    operationId: crypto.randomUUID(),
    timestamp: Date.now(),
    source,
    payload,
  };
}

export function isEnvelope(value: unknown): value is RuntimeEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'operationId' in value &&
    'timestamp' in value &&
    'source' in value &&
    MessageTypeValues.includes((value as RuntimeEnvelope).type as MessageType)
  );
}
