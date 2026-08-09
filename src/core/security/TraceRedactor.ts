// src/core/security/TraceRedactor.ts — R-10 audit point (canonical body).
// This is the canonical R-10 redaction body sourced from Appendix O.13 of the
// product spec (lines 6686-6694, REDACTION_PATTERNS verbatim) and kept in sync
// with the spec. Every string debugLog logs already routes through this
// function, so the body swap is caller-invisible: the exported signature
// `redact(s: string): string` is stable and no caller file changes.
// §16.5: redaction MUST run before writing to AITransactionLogDB / ErrorStore /
// debugLog / DiagnosticsPanel / export; field-level redaction for storage-bound
// objects lives in ./redactSensitive.ts (D-16).
const REDACTION_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]+/g,
  /key-[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /JSESSIONID=[^;\s]+/gi,
  /sysparm_ck[=:]\s*[^&\s]+/gi,
  /g_ck[=:]\s*[^&\s]+/gi,
  // WR-04: broader API-key shapes — non-sk-/key- prefixed keys (e.g. Google's
  // AIza… 39-char key) previously survived redaction verbatim.
  /AIza[0-9A-Za-z_-]{20,}/g,
  /api[_-]?key[=:]\s*[A-Za-z0-9_-]{16,}/gi,
];

export function redact(s: string): string {
  return REDACTION_PATTERNS.reduce((out, re) => out.replace(re, '[REDACTED]'), s);
}
