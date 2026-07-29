import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface DiagnosticsState {
  ready: boolean;
  logs: Array<{
    id: string;
    operationId: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    message: string;
    data?: unknown;
  }>;
}

export const useDiagnosticsStore = create<DiagnosticsState>()(
  immer((_set, _get) => ({
    ready: false,
    logs: [],
  })),
);
