// src/core/context/trust/TrustPolicy.ts — Source: PRODUCT_SPEC Appendix O.3
// "Trust-aware context — stripping instruction authority" (L6433-6459, VERBATIM)
// + Phase 4b CTX-02 / D-4b-02 / D-4b-04. This is the D-4b-02/04 trust boundary:
// it runs on ContextItem[] at the feed BEFORE section conversion (04b-04 wires
// it into ContextOptimizer); nothing else inspects trust/instructionAuthority
// (P4b-1 ownership rule).
//
// Contract: deterministic and pure — zero model calls, zero async, zero
// storage access (Pitfall 5), never mutates SYSTEM content (D-4b-03). The
// <untrusted_data> wrap must never enter CACHED_KINDS — the wrap lands only on
// the per-turn context section (F-5). Determinism rule: no Date.now/crypto.
// wrapText is the exported O.3 wrap builder (CR-02 sanitizer) — the ONE wrap
// implementation, shared with buildReceipt (contextReceipt.ts, feed-path wrap
// site) so the two wrap paths can never drift.
//
// D-4b-06: strip+wrap+quarantine IS the Phase-4b enforcement, so no code in
// Phase 4b raises ContextInjectionBlockedError. The typed carrier + guard are
// exported for defensive use — a future caller (e.g. Phase-6 diagnostics or a
// non-quarantine policy-redefinition path) can represent the O.3 error without
// inventing one.
import type { ContextItem, TrustLevel } from '@/types/harness';

/**
 * O.3 verbatim (L6435-6439): which trust levels may carry instruction
 * authority. Only system/user — tool/retrieved/untrusted MUST NOT (CTX-01).
 * Module-private: TrustPolicy owns ALL trust logic (P4b-1); tests exercise
 * the mapping through applyTrustPolicy.
 */
const AUTHORITY_BY_TRUST: Record<TrustLevel, boolean> = {
  system: true,
  user: true,
  tool: false,
  retrieved: false,
  untrusted: false,
};

/**
 * CR-02 (04b review): the O.3 wrap with delimiter-breakout neutralization —
 * the wrap's protective value (quoted DATA, OWASP LLM01 #6) must survive
 * attacker-controlled text, so the literal closing tag and any forged opening
 * tag are neutralized INSIDE the wrapped content BEFORE wrapping, and `"` in
 * the source id is escaped. A clean input produces byte-identical output to
 * the O.3 verbatim format (spec L6441-6452), so byte-pinned wrap tests hold.
 * Shared by applyTrustPolicy (authority-strip site) and buildReceipt
 * (feed-path site, contextReceipt.ts) — ONE sanitizer, never re-authored
 * (P4b-1: TrustPolicy owns ALL trust logic; the feed-path wrap site consumes
 * it). Deterministic and pure like the rest of this module.
 */
export function wrapText(sourceId: string, text: string): string {
  const safe = text
    .replace(/<\/untrusted_data>/gi, '<\\/untrusted_data>')
    .replace(/<untrusted_data/gi, '<untrusted_data\\u002D');
  return `<untrusted_data source="${sourceId.replace(/"/g, '&quot;')}">\n${safe}\n</untrusted_data>`;
}

/**
 * O.3 verbatim (L6441-6452): enforce CTX-02 — only system/user may carry
 * instruction authority. Any instructionAuthority:true item whose trust is
 * not allowed is force-set false and wrapped in <untrusted_data source=...>
 * so the model treats it as quoted DATA, not a directive (OWASP LLM01 #6
 * provenance-labeled channel). Items with trust system/user pass through
 * byte-identical; items already instructionAuthority:false pass through
 * unmodified (the wrap happens exactly once — no double-wrap). The wrap goes
 * through wrapText (CR-02: delimiter breakout neutralized + sourceId escaped).
 */
export function applyTrustPolicy(items: ContextItem[]): ContextItem[] {
  return items.map((it) => {
    const allowed = AUTHORITY_BY_TRUST[it.trust];
    if (it.instructionAuthority && !allowed) {
      return {
        ...it,
        instructionAuthority: false,
        text: wrapText(it.sourceId, it.text),
      };
    }
    return it;
  });
}

/**
 * O.3 (L6457-6458) typed carrier for CONTEXT_INSTRUCTION_INJECTION_BLOCKED —
 * the canonical §C.2 code (errorCodes.ts mirror, 04b-01) for an attempt to
 * redefine policy via retrieved content. Mirrors the ContextTooLargeError /
 * isContextTooLargeError pattern (ContextOptimizer.ts L64-74). Exported for
 * defensive use only — Phase 4b enforcement is strip+wrap+quarantine
 * (D-4b-06), so no 4b code raises it.
 */
export interface ContextInjectionBlockedError extends Error {
  code: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED';
}

/** Guard: distinguishes the O.3 carrier from other errors (ContextOptimizer.ts L72-74 precedent). */
export function isContextInjectionBlockedError(err: unknown): err is ContextInjectionBlockedError {
  return (
    err instanceof Error &&
    (err as ContextInjectionBlockedError).code === 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED'
  );
}

/** Build the typed carrier the same way contextTooLargeError() does (ContextOptimizer.ts L120-127). */
export function contextInjectionBlockedError(): ContextInjectionBlockedError {
  const err = new Error('CONTEXT_INSTRUCTION_INJECTION_BLOCKED') as ContextInjectionBlockedError;
  err.code = 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED';
  return err;
}
