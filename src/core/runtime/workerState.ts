// src/core/runtime/workerState.ts — canonical §18 path (spec line 2528; W-13:
// created in 01-09 so the RUNTIME-02 validation-map row and the 01-02
// MessageType/ResponseEnvelope contracts have a home). Source: §20.5
// BackgroundWorkerState (spec lines 3229-3233) + RESEARCH Pitfall 5 ("every
// background and content handler returns ResponseEnvelope via
// workerState.ok/workerState.fail").
//
// workerState.ok/fail are the ONLY reply builders in the codebase — handlers
// never hand-roll a ResponseEnvelope (Pitfall 5: replies are always envelope
// shaped, never a mutated request). They never throw (Golden Rule 9). The
// request `id` is threaded for correlation; when a caller has no request id
// (fire-and-forget), a fresh operationId is generated so the envelope is still
// valid and traceable. Dependency-free core (Pitfall 4): imports only sibling
// runtime modules + the error-code type.
import { createOperationId } from '@/core/runtime/OperationId';
import type { ResponseEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { ErrorCode } from '@/core/error/errorCodes';

/** §20.5 Background Worker State — the SW state shape (RUNTIME-02). */
export type BackgroundWorkerState =
  | { state: 'cold-starting'; startedAt: number }
  | { state: 'ready'; startedAt: number; alarmsReady: boolean; routerReady: boolean }
  | {
      state: 'degraded';
      reason: 'ALARMS_MISSING' | 'ROUTER_ERROR' | 'SESSION_UNAVAILABLE';
      message: string;
    }
  | { state: 'shutting-down'; reason: 'IDLE' | 'RELOAD' | 'UNKNOWN' };

export const workerState = {
  /**
   * Success reply builder. `id` correlates to the request envelope id; it
   * defaults to a fresh operationId when the caller has none.
   */
  ok<T>(data: T, id: string = createOperationId()): ResponseEnvelope<T> {
    return { id, ok: true, data };
  },

  /**
   * Error reply builder — the canonical { code, message } error shape. `id`
   * correlates to the request envelope id; `code` MUST be a canonical §C.2
   * ErrorCode (Golden Rule 9 — never free-form strings). Never throws.
   */
  fail(
    code: ErrorCode,
    message: string,
    id: string = createOperationId(),
  ): ResponseEnvelope<never> {
    return { id, ok: false, error: { code, message, retryable: false } };
  },
};
