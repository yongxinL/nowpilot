interface LogEntry {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

const MAX_LOG_ENTRIES = 200;
const logEntries: LogEntry[] = [];

export function debugLog(code: string, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    code,
    message,
    context,
    timestamp: Date.now(),
  };

  logEntries.push(entry);

  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.shift();
  }

  // eslint-disable-next-line no-console
  console.debug(`[${code}] ${message}`, context ?? '');
}

export function getRecentLogs(count = 50): LogEntry[] {
  return logEntries.slice(-count);
}

export function clearLogs(): void {
  logEntries.length = 0;
}
