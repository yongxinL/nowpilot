// src/core/security/TraceRedactor.ts — R-10 audit point (placeholder).
// TODO(security-phase): the real redactor scrubs secrets, tokens, and prompt/
// tool bodies before persist/UI/export (R-10). Until the security phase lands,
// this is a thin pass-through so debugLog's redaction contract stays stable —
// every string debugLog logs already routes through this function, so enabling
// real redaction later requires no caller changes.
export function redact(s: string): string {
  return s;
}
