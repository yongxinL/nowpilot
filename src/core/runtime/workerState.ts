export type BackgroundWorkerState =
  | { state: 'cold-starting'; startedAt: number }
  | { state: 'ready'; startedAt: number; alarmsReady: boolean; routerReady: boolean }
  | { state: 'degraded'; reason: 'ALARMS_MISSING' | 'ROUTER_ERROR' | 'SESSION_UNAVAILABLE'; message: string }
  | { state: 'shutting-down'; reason: 'IDLE' | 'RELOAD' | 'UNKNOWN' };

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
