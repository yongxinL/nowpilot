// src/core/context/trust/injectionScreener.ts — Phase 4b TRUST-02/CTX-02
// deterministic prompt-injection screen (D-4b-05 discretion; RESEARCH Code
// Example 1 L360-393 is the recommended starting set — flagged assumptions A1
// for the pattern set, A2 for the invisible-Unicode strip). OWASP GenAI LLM
// Top 10 2026 LLM01 prevention #5: strip invisible Unicode at every ingest
// boundary — zero-width (U+200B/200C/200D/2060), tag-block (U+E0000-U+E007F),
// variation selectors (U+FE00-FE0F) — these smuggle instruction/exfiltration
// bytes (M365 Copilot ASCII-smuggling PoC).
//
// This module is a SCREEN, not the security boundary: OWASP #3 filters are
// evadable by rephrasing/encoding, so the real boundary is applyTrustPolicy's
// authority strip (T-4b-01) + runtime wiring (04b-04). Even a classifier miss
// is rendered inert by the strip; a hit is quarantined-not-dropped (D-4b-06)
// and recorded in the receipt (omitReason 'prompt_injection').
//
// Contract: dependency-free, deterministic, zero model calls — identical input
// → identical verdict. No DOMPurify in the core context pipeline (D-4b-05;
// page markdown is text pre-optimizer; the §16.1 render-side XSS matrix
// covers UI).
//
// NOTE (04b-02 Rule 1 deviation): the tag block MUST use the ES2015
// `\u{...}` codepoint-escape form (U+E0000-U+E007F are astral — the 4-hex
// `\uE0000` form parses as `\uE000` + literal `0`, silently turning the
// class into a `0-U+E007` range that strips ordinary ASCII). The `u` flag
// is required for `\u{...}` to compile.
const INVISIBLE_UNICODE = /[\u200B\u200C\u200D\u2060\u{E0000}-\u{E007F}\uFE00-\uFE0F]/gu;

/** Deterministic sanitizer — always applied to retrieved text before classification. */
export function stripInvisibleUnicode(text: string): string {
  return text.replace(INVISIBLE_UNICODE, '');
}

export type ScreenVerdict = 'safe' | 'quarantine';

// High-precision, case-insensitive, word-bounded patterns (D-4b-05 discretion,
// RESEARCH Code Example 1 L379-387 — the exact pattern literals the fixtures
// pin). Precision over recall: a miss is still inert (O.3 authority strip); a
// false positive is auditable (quarantine-not-drop, D-4b-06).
const INSTRUCTION_OVERRIDE: RegExp[] = [
  /\bignore\s+(all|any|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|commands?)\b/i,
  /\bdisregard\s+(the\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)\b/i,
  /\byou\s+are\s+now\b/i,
  /\b(redefine|rewrite|update)\s+(your\s+)?(system\s+)?(prompt|instructions?)\b/i,
  /\b(you\s+)?(have|are\s+granted|now\s+have)\s+(permission|authority|access)\s+to\s+(use|call|execute|access)\s+(all\s+)?(tools?|commands?)\b/i,
  /\bignore\s+(your\s+)?(guidelines|safety|rules|protocols)\b/i,
  /\bdo\s+not\s+(mention|tell|reveal|report)\s+(the\s+)?(user|this|anyone)\b/i,
];

/**
 * Deterministic classifier — zero model calls; identical input → identical
 * verdict. Strips invisible Unicode FIRST (OWASP LLM01 #5), then tests the
 * cleaned text against the instruction-override set (OWASP #3 screen).
 */
export function classifyInjection(text: string): ScreenVerdict {
  const cleaned = stripInvisibleUnicode(text);
  return INSTRUCTION_OVERRIDE.some((re) => re.test(cleaned)) ? 'quarantine' : 'safe';
}
