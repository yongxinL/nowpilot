export const MessageTypeValues = [
  'GET_ACTIVE_TAB_CONTEXT',
  'EXTRACT_PAGE_CONTENT',
  'PROXY_FETCH',
  'SIDE_PANEL_OPEN',
  'FULL_APP_OPEN',
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
] as const;

export type MessageType = (typeof MessageTypeValues)[number];

export interface RuntimeEnvelope<T = unknown> {
  type: MessageType;
  operationId: string;
  timestamp: number;
  source: 'background' | 'sidepanel' | 'full-app' | 'content' | 'popup';
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
