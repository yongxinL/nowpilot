export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function debugLog(level: LogLevel, message: string, data?: unknown): void {
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    const timestamp = new Date().toISOString();
    const prefix = `[NowPilot ${timestamp}] ${message}`;
    switch (level) {
      case 'debug':
        console.debug(prefix, data ?? '');
        break;
      case 'info':
        console.info(prefix, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, data ?? '');
        break;
      case 'error':
        console.error(prefix, data ?? '');
        break;
    }
  }
}
