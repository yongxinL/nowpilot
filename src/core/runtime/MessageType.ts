// src/core/runtime/MessageType.ts — Source: Appendix E (canonical) + D-17 additions
// (RESEARCH reconciliation #2). This is the ONLY allowed message-type vocabulary
// (Pitfall 5 — no throwaway contracts). MessageTypeValues feeds the whitelist in
// 01-03/01-07. Dependency-free: imports nothing outside the TS standard lib.
export const MessageType = {
  PROXY_FETCH:          'PROXY_FETCH',
  EXTRACT_PAGE_CONTENT: 'EXTRACT_PAGE_CONTENT',
  OPEN_SIDE_PANEL:      'OPEN_SIDE_PANEL',
  OPEN_STANDALONE:        'OPEN_STANDALONE',           //
  SESSION_TOKEN_UPDATE: 'SESSION_TOKEN_UPDATE',
  BACKGROUND_STATE:     'BACKGROUND_STATE',
  KEEPALIVE_PING:       'KEEPALIVE_PING',
  PORT_STREAM_START:    'PORT_STREAM_START',
  PORT_STREAM_CHUNK:    'PORT_STREAM_CHUNK',
  PORT_STREAM_END:      'PORT_STREAM_END',
  PORT_STREAM_ABORT:    'PORT_STREAM_ABORT',
  ADDON_EVENT:          'ADDON_EVENT',
  WORKSPACE_HANDOFF:    'WORKSPACE_HANDOFF',       //
  WORKSPACE_UPDATED:    'WORKSPACE_UPDATED',       //
  WORKSPACE_HEARTBEAT:  'WORKSPACE_HEARTBEAT',     //
  // D-17 additions — content bridge minimum subset (extensions to the canonical
  // enum per RESEARCH reconciliation #2, NOT a phase-local contract)
  PING: 'PING', PONG: 'PONG',
  GET_CONTENT_CAPABILITIES: 'GET_CONTENT_CAPABILITIES',
  CONTENT_CAPABILITIES: 'CONTENT_CAPABILITIES',
} as const;
export type MessageTypeValue = typeof MessageType[keyof typeof MessageType];
export const MessageTypeValues = Object.values(MessageType) as MessageTypeValue[];
