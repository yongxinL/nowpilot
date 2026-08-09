// src/core/error/debugLog.ts — Golden Rule 9 single entry point for error
// observability. Every catch in the codebase calls debugLog(code, …) with a
// canonical §C.2 code from errorCodes.ts. There is NO direct console.error
// anywhere else (enforced by phase verify). All string content routes through
// TraceRedactor.redact before persist/UI/export (R-10). debugLog NEVER throws —
// a logging failure must never break the caller's error path.
import * as TraceRedactor from '@/core/security/TraceRedactor';
import { redactSensitive } from '@/core/security/redactSensitive';
import type { ErrorCode } from '@/core/error/errorCodes';

export interface DebugLogOptions {
  /** The original Error object, if one was caught. */
  error?: Error;
  /** Where the error occurred, e.g. 'EventBus.emit' or a component stack. */
  context?: string;
  /** Arbitrary structured detail. Strings inside are redacted on export. */
  extra?: Record<string, unknown>;
  /** Add-on id when the error originates in an add-on module. */
  addonId?: string;
  /** Module name for filtering, e.g. 'WorkspaceStore'. */
  module?: string;
  /** Suppress output entirely (sensitive flows; still routed through redact). */
  silent?: boolean;
}

export function debugLog(code: ErrorCode, message: string, options: DebugLogOptions = {}): void {
  try {
    if (options.silent) return;
    const parts = [`[${code}]`, TraceRedactor.redact(message)];
    if (options.context) parts.push(`(${TraceRedactor.redact(options.context)})`);
    if (options.module) parts.push(`module=${TraceRedactor.redact(options.module)}`);
    if (options.addonId) parts.push(`addon=${TraceRedactor.redact(options.addonId)}`);
    const errorDetail = options.error ? TraceRedactor.redact(options.error.message) : undefined;
    // WR-05: options.extra is routed through redactSensitive (values only —
    // keys kept) before the console call. R-10/O.13 demands redaction before
    // EVERY sink including the console; a future caller putting a secret in
    // `extra` must not land it verbatim in devtools.
    const safeExtra = options.extra ? redactSensitive(options.extra) : undefined;
    // This module is the ONLY permitted console.error in the codebase (plan truth).
    console.error(parts.join(' '), errorDetail ?? '', safeExtra ?? {});
  } catch {
    // debugLog must never throw (Golden Rule 9): a redact/console failure is
    // dropped silently rather than escaping into the caller's error path.
  }
}
