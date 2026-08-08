// src/core/runtime/RuntimeEnvelope.ts — Source: Appendix C (verbatim, lines 4141-4153)
// The ONLY cross-context message shape (Pitfall 5). Phase 1 envelope has NO
// kind/trust/instructionAuthority fields — those live on ContextItem in Phase 4b
// (§C.1), not on the transport envelope. Dependency-free: imports only
// MessageTypeValue from sibling MessageType.ts (the canonical vocabulary).
import type { MessageTypeValue } from './MessageType';

export interface RuntimeEnvelope<T = unknown> {
  id: string;                    // operationId (crypto.randomUUID())
  type: MessageTypeValue;        // canonical MessageType only
  createdAt: number;
  source: 'sidepanel' | 'background' | 'content' | 'addon' | 'standalone';
  target?: 'sidepanel' | 'background' | 'content' | 'addon' | 'standalone';
  payload: T;
}

// Replies use ResponseEnvelope via workerState.ok/fail — never a mutated request.
export type ResponseEnvelope<T = unknown> =
  | { id: string; ok: true; data: T }
  | { id: string; ok: false; error: { code: string; message: string; retryable: boolean } };
