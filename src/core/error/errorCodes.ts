// src/core/error/errorCodes.ts — Source: PRODUCT_SPEC Appendix C.2 "Error Code
// Registry" Phase-1 block (lines 5058-5097, canonical additions from 01-02).
// Golden Rule 9: every catch calls debugLog(code, …) with one of these verbatim —
// never free-form strings. This file exports the Phase-1 subset; later phases
// extend the registry IN PLACE. Never duplicate or re-export these codes
// anywhere else (single source of truth).
export const ERROR_CODES = {
  // --- Runtime / messaging ---
  MSG_UNKNOWN_TYPE: 'MSG_UNKNOWN_TYPE',
  MSG_DESERIALIZE: 'MSG_DESERIALIZE',
  MSG_SERIALIZE: 'MSG_SERIALIZE',
  PORT_DISCONNECTED: 'PORT_DISCONNECTED',
  CONNECT_FAILED: 'CONNECT_FAILED',
  TABS_QUERY: 'TABS_QUERY',
  CONTENT_EXTRACT: 'CONTENT_EXTRACT',
  CONTENT_CAPABILITIES: 'CONTENT_CAPABILITIES',
  // --- Storage ---
  STORE_READ: 'STORE_READ',
  STORE_WRITE: 'STORE_WRITE',
  STORE_SYNC: 'STORE_SYNC',
  CHROME_ON_CHANGED: 'CHROME_ON_CHANGED',
  // --- Workspace ---
  WORKSPACE_INIT: 'WORKSPACE_INIT',
  WORKSPACE_START: 'WORKSPACE_START',
  WORKSPACE_STOP: 'WORKSPACE_STOP',
  WORKSPACE_SNAPSHOT: 'WORKSPACE_SNAPSHOT',
  WORKSPACE_HANDOFF: 'WORKSPACE_HANDOFF',
  WORKSPACE_MIRROR: 'WORKSPACE_MIRROR',
  WORKSPACE_ROUTER: 'WORKSPACE_ROUTER',
  WORKSPACE_SYNC: 'WORKSPACE_SYNC',
  // --- Registry ---
  REGISTRY_INIT: 'REGISTRY_INIT',
  ADDON_SETTINGS: 'ADDON_SETTINGS',
  // --- Theme ---
  THEME_INIT: 'THEME_INIT',
  THEME_WRITE: 'THEME_WRITE',
  THEME_ON_CHANGED: 'THEME_ON_CHANGED',
  THEME_MATCH_MEDIA: 'THEME_MATCH_MEDIA',
  // --- Cmd+K / onboarding ---
  CMDK_QUERY: 'CMDK_QUERY',
  CMDK_COMMAND: 'CMDK_COMMAND',
  ONBOARDING_WRITE: 'ONBOARDING_WRITE',
  ONBOARDING_DONE: 'ONBOARDING_DONE',
  // --- Events / bridge ---
  EVT_HANDLER: 'EVT_HANDLER',
  BRIDGE_PUBLISH: 'BRIDGE_PUBLISH',
  BRIDGE_SUBSCRIBE: 'BRIDGE_SUBSCRIBE',
  BRIDGE_LISTENER: 'BRIDGE_LISTENER',
  NETWORK_STATUS: 'NETWORK_STATUS',
  // --- Components ---
  COMPONENT_RENDER: 'COMPONENT_RENDER',
  COMPONENT_UNMOUNT: 'COMPONENT_UNMOUNT',
  PROMISE_REJECT: 'PROMISE_REJECT',
  // --- Lifecycle manager (01-09 setPanelBehavior catch) ---
  SIDEPANEL_BEHAVIOR: 'SIDEPANEL_BEHAVIOR',
  // --- Fallback ---
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
