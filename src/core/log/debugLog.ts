export function debugLog(code: string, message: string, context?: unknown): void {
  if (typeof console === 'undefined') return;
  if (context !== undefined) {
    console.debug(`[nowpilot:${code}] ${message}`, context);
  } else {
    console.debug(`[nowpilot:${code}] ${message}`);
  }
}
