// src/core/context/contextReceipt.ts — D-4b-10/11/14 (04b-03 Task 2): the
// receipt BUILDER. The ContextReceiptEntry type + ContextProvenanceManifestSchema
// stay in the manifest module (R-1); the builder lives here next to the
// decisions it consumes (RESEARCH Open Question 2 resolution — recommended
// path src/core/context/contextReceipt.ts).
//
// Contract: one ContextReceiptEntry per input item (included AND excluded —
// D-4b-06 no-silent-drop; all kinds enumerated D-4b-01); ids + token counts
// only, NEVER raw text (R-10). estimateTokens (TokenBudget) is the ONLY token
// counter (RESEARCH Don't Hand-Roll — same-counter determinism).
//
// Pattern 2 token semantics (RESEARCH L272): originalTokens =
// estimateTokens(item.text) PRE-wrap; finalTokens = estimateTokens(wrappedText)
// when included, 0 when excluded. buildReceipt applies the O.3 wrap itself —
// the single wrap site for the feed path. The 04b-03 feed stamps
// instructionAuthority:false at conversion, so applyTrustPolicy's
// authority-strip wrap (04b-02) never fires on it — no double-wrap in the
// page-only pipeline; 04b-04 wires the stage ordering.
//
// contextText = the wrapped included items joined in DETERMINISTIC input order
// (TRUST-02 ordering probe — no dedup/merge) with the '\n\n' joinSections
// convention (ProviderRouter L105), so the context section 04b-04 emits is
// byte-identical to what the receipt reconstructs (D-4b-11 / Pitfall 3).
import type {
  ContextItem,
  ContextReceiptEntry,
  TrustLevel,
  TrustOmitReason,
} from '@/types/harness';
import { estimateTokens } from './TokenBudget';

/** O.3 wrap format (spec L6441-6452 verbatim) — the exact bytes buildReceipt emits. */
function wrapText(sourceId: string, text: string): string {
  return `<untrusted_data source="${sourceId}">\n${text}\n</untrusted_data>`;
}

/**
 * D-4b-10/11: the receipt + CTX-06 counters for one feed pass. contextText is
 * the packed context section (wrapped included items, deterministic order);
 * receipt enumerates EVERY input item; counters are pure counts.
 */
export interface TrustedFeedResult {
  contextText: string;
  receipt: ContextReceiptEntry[];
  counters: {
    screened: number;
    quarantined: number;
    byTrust: Record<TrustLevel, number>;
    totalIncludedTokens: number;
  };
}

/**
 * D-4b-10/11/14: derive one ContextReceiptEntry per input item from the trust
 * pipeline's decisions. `decisions.excluded` carries the SAME structured
 * `{ reason: TrustOmitReason }` map shape applySourceGates emits
 * ('trust_disabled') and the 04b-04 quarantine stage writes
 * ('prompt_injection') — one structured map, no conversion (D-4b-06/08
 * contract-aligned). `screened`/`quarantined` are the classifier counts the
 * optimizer supplies (CTX-06). `kindStable` is the cacheEligibility function
 * (CACHED_KINDS-driven — page→context section→false, memory→memory
 * section→true). Pure + deterministic.
 */
export function buildReceipt(
  items: ContextItem[],
  decisions: { excluded: Map<string, { reason: TrustOmitReason }> },
  kindStable: (kind: ContextItem['kind']) => boolean,
  screened: number,
  quarantined: number,
): TrustedFeedResult {
  const receipt: ContextReceiptEntry[] = [];
  const includedTexts: string[] = [];
  const byTrust: Record<TrustLevel, number> = {
    system: 0,
    user: 0,
    tool: 0,
    retrieved: 0,
    untrusted: 0,
  };
  for (const item of items) {
    byTrust[item.trust] += 1;
    const omitReason = decisions.excluded.get(item.id)?.reason;
    const included = omitReason === undefined;
    const wrappedText = wrapText(item.sourceId, item.text);
    receipt.push({
      sourceId: item.sourceId,
      included,
      originalTokens: estimateTokens(item.text), // Pattern 2: pre-wrap
      finalTokens: included ? estimateTokens(wrappedText) : 0, // Pattern 2: wrapped when included, 0 when excluded
      cacheEligible: kindStable(item.kind),
      ...(omitReason !== undefined ? { omitReason } : {}),
    });
    if (included) includedTexts.push(wrappedText);
  }
  return {
    contextText: includedTexts.join('\n\n'),
    receipt,
    counters: {
      screened,
      quarantined,
      byTrust,
      totalIncludedTokens: receipt.reduce((sum, r) => (r.included ? sum + r.finalTokens : sum), 0),
    },
  };
}
