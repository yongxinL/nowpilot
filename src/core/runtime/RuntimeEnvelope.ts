import { generateOperationId } from './OperationId';

export const MessageTypeValues = [
  'GET_ACTIVE_TAB_CONTEXT',
  'EXTRACT_PAGE_CONTENT',
  'PROXY_FETCH',
  'SIDE_PANEL_OPEN',
  'SPA_NAVIGATION',
  'FULL_APP_OPEN',
  'WORKSPACE_HANDOFF',
  'WORKSPACE_UPDATED',
  'STREAM_STATE_CHANGED',
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
    // WR-01: routed through generateOperationId so envelope construction never
    // throws on insecure origins (crypto.randomUUID is SecureContext-only).
    operationId: generateOperationId(),
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
