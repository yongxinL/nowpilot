import type { ActiveSurface } from '../workspace/WorkspaceStore';

export type ActiveStreamState =
  | { state: 'idle' }
  | { state: 'streaming'; sessionId: string; operationId: string; startedAt: number; surface: ActiveSurface }
  | { state: 'completed'; sessionId: string; operationId: string; surface: ActiveSurface }
  | {
      state: 'failed';
      sessionId: string;
      operationId: string;
      surface: ActiveSurface;
      code: string;
      message: string;
    };

let activeStream: ActiveStreamState = { state: 'idle' };

export function getWorkerState(): ActiveStreamState {
  return activeStream;
}

export function setWorkerState(next: ActiveStreamState): void {
  activeStream = next;
}

export function resetWorkerState(): void {
  activeStream = { state: 'idle' };
}
