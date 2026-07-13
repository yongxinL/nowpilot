import { traceRedactor } from '../telemetry/TraceRedactor';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function debugLog(level: LogLevel, message: string, data?: unknown): void {
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    const timestamp = new Date().toISOString();
    const prefix = `[NowPilot ${timestamp}] ${message}`;
    const safeData = data !== undefined ? traceRedactor.redactValue(data) : '';
    switch (level) {
      case 'debug':
        console.debug(prefix, safeData);
        break;
      case 'info':
        console.info(prefix, safeData);
        break;
      case 'warn':
        console.warn(prefix, safeData);
        break;
      case 'error':
        console.error(prefix, safeData);
        break;
    }
  }
}
