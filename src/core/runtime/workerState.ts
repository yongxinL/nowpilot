export type BackgroundWorkerState =
  | { state: 'cold-starting'; startedAt: number }
  | { state: 'ready'; startedAt: number; alarmsReady: boolean; routerReady: boolean }
  | { state: 'degraded'; reason: 'ALARMS_MISSING' | 'ROUTER_ERROR' | 'SESSION_UNAVAILABLE'; message: string }
  | { state: 'shutting-down'; reason: 'IDLE' | 'RELOAD' | 'UNKNOWN' };

/**
 * Active stream state — §20.6 verbatim (PRODUCT_SPEC_v0_1.md:3168-3179).
 *
 * Added by plan 03-04 alongside the existing BackgroundWorkerState (existing
 * exports unchanged). The canonical stream events map onto it:
 * STREAM_START → preparing/streaming, STREAM_COMPLETE → completed,
 * STREAM_ERROR → failed (+ canonical §21.6 code), STREAM_ABORTED → aborting.
 * `ActiveSurface` comes from WorkspaceStore (line 11) — 'sidepanel' | 'standalone'.
 *
 * IN-01: reserved-for-later — no module consumes this type in Phase 3 (the
 * orchestrator/renderer emit canonical events; the event→state mapping that
 * would drive it is not yet wired). It type-checks as the §20.6 deliverable.
 */
import type { ActiveSurface } from '../workspace/WorkspaceStore';

export type ActiveStreamState =
  | { state: 'idle' }
  | { state: 'preparing'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'streaming'; sessionId: string; operationId: string; startedAt: number; surface: ActiveSurface }
  | {
      state: 'waiting-for-permission';
      sessionId: string;
      operationId: string;
      toolName: string;
      surface: ActiveSurface;
    }
  | { state: 'aborting'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'completed'; sessionId: string; operationId: string; surface: ActiveSurface }
  | {
      state: 'failed';
      sessionId: string;
      operationId: string;
      code: string;
      message: string;
      surface: ActiveSurface;
    };

let workerState: BackgroundWorkerState = { state: 'cold-starting', startedAt: Date.now() };

export function getWorkerState(): BackgroundWorkerState {
  return workerState;
}

export function setWorkerState(state: BackgroundWorkerState): void {
  workerState = state;
}

export function transitionWorkerState(
  state: BackgroundWorkerState['state'],
  extra?: Partial<BackgroundWorkerState>,
): void {
  workerState = { state, startedAt: Date.now(), ...extra } as BackgroundWorkerState;
}
