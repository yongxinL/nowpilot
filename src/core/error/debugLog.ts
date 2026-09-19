import type { DiagnosticEvent, ErrorCode } from './errorCodes';

export const REDACTED_CONTEXT_KEYS = [
  'apiKey',
  'api_key',
  'authorization',
  'body',
  'caseContent',
  'clipboard',
  'content',
  'cookie',
  'password',
  'path',
  'prompt',
  'token',
] as const;

const REDACTED = '[REDACTED]';

export type DebugContext = Record<string, unknown>;

function isSensitiveKey(key: string): boolean {
  return (REDACTED_CONTEXT_KEYS as readonly string[]).includes(key);
}

export function redactContext(context: DebugContext): DebugContext {
  const out: DebugContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (isSensitiveKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) {
      out[key] = value;
      continue;
    }
    out[key] = REDACTED;
  }
  return out;
}

export interface ErrorLogRecord {
  level: 'error';
  code: ErrorCode;
  context?: DebugContext;
  timestamp: number;
}

export interface DiagnosticLogRecord {
  level: 'debug';
  event: DiagnosticEvent;
  context?: DebugContext;
  timestamp: number;
}

export type DebugRecord = ErrorLogRecord | DiagnosticLogRecord;

export interface DebugSink {
  debug(message: string): void;
}

export function createErrorRecord(code: ErrorCode, context?: DebugContext): ErrorLogRecord {
  return { level: 'error', code, context, timestamp: Date.now() };
}

export function createDiagnosticRecord(
  event: DiagnosticEvent,
  context?: DebugContext,
): DiagnosticLogRecord {
  return { level: 'debug', event, context, timestamp: Date.now() };
}

export function debugLog(record: DebugRecord, sink: DebugSink = console): void {
  const serialised = {
    ...record,
    context: record.context ? redactContext(record.context) : undefined,
  };
  sink.debug(JSON.stringify(serialised));
}
