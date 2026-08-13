// src/core/error/errorCodes.ts — Source: PRODUCT_SPEC Appendix C.2 "Error Code
// Registry" Phase-1 block (lines 5058-5097, canonical additions from 01-02).
// Golden Rule 9: every catch calls debugLog(code, …) with one of these verbatim —
// never free-form strings. This file exports the Phase-1 subset; later phases
// extend the registry IN PLACE. Never duplicate or re-export these codes
// anywhere else (single source of truth).
export const ERROR_CODES = {
  // --- Runtime / messaging ---
  // 4a W-1 reconciliation (D-4a-22): CONTENT_EXTRACT → CONTENT_EXTRACT_FAILED —
  // canonical §16/§20.7 code; spec Appendix C.2 Phase-1 mirror updated in the
  // same commit (single source of truth). O.12's EXTRACTION_FAILED never added.
  MSG_UNKNOWN_TYPE: 'MSG_UNKNOWN_TYPE',
  MSG_DESERIALIZE: 'MSG_DESERIALIZE',
  MSG_SERIALIZE: 'MSG_SERIALIZE',
  PORT_DISCONNECTED: 'PORT_DISCONNECTED',
  CONNECT_FAILED: 'CONNECT_FAILED',
  TABS_QUERY: 'TABS_QUERY',
  CONTENT_EXTRACT_FAILED: 'CONTENT_EXTRACT_FAILED',
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
  // --- Storage / vault / journal (Phase 2) ---
  VAULT_DECRYPT_FAILED: 'VAULT_DECRYPT_FAILED',
  PROVIDER_KEY_UNREADABLE: 'PROVIDER_KEY_UNREADABLE',
  IDB_MIGRATION_FAILED: 'IDB_MIGRATION_FAILED',
  SYNC_QUOTA_EXCEEDED: 'SYNC_QUOTA_EXCEEDED',
  WRITE_JOURNAL_FAILED: 'WRITE_JOURNAL_FAILED',
  WRITE_JOURNAL_ROLLBACK_FAILED: 'WRITE_JOURNAL_ROLLBACK_FAILED',
  // --- AI runtime / provider / persona (Phase 3, canonical additions, 03-01 reconciliation) ---
  // Canonical 13-code Phase-3 block (03-RESEARCH line 626). Every debugLog(code, …)
  // in the Phase-3 AI layer uses one of these verbatim (Golden Rule 9). Canonical
  // mirror: spec Appendix C.2 Phase-3 block — the scoped line-anchored verify (W-1)
  // asserts each of these appears as a /^CODE$/m line inside the C.2 slice.
  TOOL_REJECTED: 'TOOL_REJECTED',
  PERSONA_LOAD_FAILED: 'PERSONA_LOAD_FAILED',
  // --- Agent harness (Phase 3a, canonical additions — spec Appendix C.2
  // harness block L5051-5053, 03a-01 reconciliation). Every debugLog in the
  // 3a reliability layer uses one of these verbatim (Golden Rule 9).
  AGENT_STATE_INVALID: 'AGENT_STATE_INVALID',
  TOOL_POSTCONDITION_FAILED: 'TOOL_POSTCONDITION_FAILED',
  COMPLETION_EVIDENCE_MISSING: 'COMPLETION_EVIDENCE_MISSING',
  STRUCTURED_OUTPUT_FAILED: 'STRUCTURED_OUTPUT_FAILED',
  PLANNER_FAILED: 'PLANNER_FAILED',
  STREAM_FAILED: 'STREAM_FAILED',
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  PROVIDER_5XX: 'PROVIDER_5XX',
  PROVIDER_AUTH: 'PROVIDER_AUTH',
  PROVIDER_MODEL_UNKNOWN: 'PROVIDER_MODEL_UNKNOWN',
  SCHEMA_INVALID: 'SCHEMA_INVALID',
  HOST_NOT_PERMITTED: 'HOST_NOT_PERMITTED',
  // --- Context-adaptive execution (Phase 4, canonical addition — spec Appendix
  // C.2 "Runtime / provider" block, line 3512 + line 5040, CONTEXT_TOO_LARGE
  // already canonical there). 04-04 (D-04-15): the typed honest terminal thrown
  // by ContextOptimizer when even minimal mode exceeds the model window — never
  // a silent truncation of user input (P4-10). W-1 gate (04-07) re-verifies the
  // spec mirror line-anchored.
  CONTEXT_TOO_LARGE: 'CONTEXT_TOO_LARGE',
  // --- Trust-aware context (Phase 4b, canonical addition — O.3 comment spec
  // L6457-6458, CTX-02/D-4b-04). The typed-error carrier thrown when a
  // retrieved source attempts to redefine the prompt policy (instruction
  // injection) — the trust boundary is enforced structurally (applyTrustPolicy
  // wraps + strips authority, O.3), and this code marks the redefinition
  // attempt. W-1 spec-mirror note: the C.2 mirror (spec Appendix C.2) is
  // re-verified line-anchored at the phase gate (04b-06), Phase-1/04 precedent.
  CONTEXT_INSTRUCTION_INJECTION_BLOCKED: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED',
  // --- Knowledge base / memory / notes / search (Phase 5, canonical
  // additions, KNW-01..05 — Open Q7 vocabulary). Every debugLog in the Phase-5
  // memory/notes/search layer uses one of these verbatim (Golden Rule 9); the
  // W-1 spec-mirror note: the C.2 mirror (spec Appendix C.2) is re-verified
  // line-anchored at the phase gate. Stores reuse STORE_READ/STORE_WRITE for
  // idb failures — never new codes for IndexedDB operations.
  MEMORY_RETRIEVAL_FAILED: 'MEMORY_RETRIEVAL_FAILED',
  MEMORY_EXTRACT_FAILED: 'MEMORY_EXTRACT_FAILED',
  NOTE_LINK_PARSE_FAILED: 'NOTE_LINK_PARSE_FAILED',
  NOTE_GRAPH_FAILED: 'NOTE_GRAPH_FAILED',
  SEARCH_INDEX_REBUILD_FAILED: 'SEARCH_INDEX_REBUILD_FAILED',
  // --- Fallback ---
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
