import type {
  ContextProvenanceEntry,
  ContextProvenanceManifest,
  ContextReceiptEntry,
  OmissionReason,
  PromptSection,
} from '../ai/types';

export type { ContextProvenanceEntry, ContextProvenanceManifest } from '../ai/types';

/**
 * Dot-separated hierarchical sourceId format per D-18:
 * `<domain>.<source>.<entity>[.<id>]`. Rejects IDs containing `..`, `/`,
 * or `\` before recording (T-04-03).
 */
const SOURCE_ID_PATTERN = /^[a-z0-9]+(\.[a-z0-9_\-]+)*(\.[a-zA-Z0-9_\-]+)?$/;

export function isValidSourceId(sourceId: string): boolean {
  return typeof sourceId === 'string' && sourceId.length > 0 && SOURCE_ID_PATTERN.test(sourceId);
}

export function createProvenanceManifest(
  workspaceId: string,
  activeSurface: 'sidepanel' | 'full-app',
): ContextProvenanceManifest {
  return { sections: [], totalTokens: 0, minimalMode: false, workspaceId, activeSurface };
}

/**
 * Append one provenance entry per distinct source (D-17). Throws on an
 * invalid sourceId — sourceIds are internal constants, so a violation is a
 * programming error that must surface loudly rather than corrupt the
 * manifest.
 *
 * Phase 4b (D-03): entries satisfy ContextReceiptEntry. Legacy path default
 * receipt fields (originalTokens === finalTokens, cacheEligible: false);
 * optimizeFromItems() uses recordSectionWithReceipt() with per-section
 * receipt data instead.
 */
export function recordSection(manifest: ContextProvenanceManifest, section: PromptSection): void {
  recordSectionWithReceipt(manifest, section, section.tokens, false);
}

/**
 * Record a provenance entry with full receipt metadata (D-03, CTX-T03):
 * originalTokens come from the source ContextItem (pre-transformation),
 * finalTokens from the post-compression PromptSection, and cacheEligible
 * reflects whether the final section is cache-stable. Receipt entries
 * never carry raw text — only sourceId and token counts (T-04b-03).
 */
export function recordSectionWithReceipt(
  manifest: ContextProvenanceManifest,
  section: PromptSection,
  originalTokens: number,
  cacheEligible: boolean,
): void {
  if (!isValidSourceId(section.sourceId)) {
    throw new Error(`ContextProvenanceManifest: invalid sourceId "${section.sourceId}".`);
  }
  manifest.sections.push({
    kind: section.kind,
    sourceId: section.sourceId,
    tokens: section.tokens,
    truncated: false,
    originalTokens,
    finalTokens: section.tokens,
    included: true,
    cacheEligible,
  });
  manifest.totalTokens += section.tokens;
}

export function markTruncated(manifest: ContextProvenanceManifest, sourceId: string): void {
  const entry = manifest.sections.find((s) => s.sourceId === sourceId);
  if (entry) entry.truncated = true;
}

/**
 * Record an omitted source in the receipt (CTX-T03, D-03): an item that was
 * filtered out BEFORE reaching the final PromptSection[] (freshness expiry,
 * degradation drops, policy exclusion) still gets a receipt entry so its
 * existence and size remain visible to the user and to diagnostics — with
 * `included: false`, `finalTokens: 0`, and the omission reason. Omitted
 * entries never contribute to `totalTokens` (the item produced no prompt
 * content). Receipt entries never carry raw text (T-04b-03).
 *
 * Guarded against duplicates: if an entry for the sourceId already exists
 * (e.g. the section survived degradation in a rewritten form), the omission
 * is not double-recorded — one receipt entry per source (D-17).
 */
export function markOmitted(
  manifest: ContextProvenanceManifest,
  sourceId: string,
  kind: PromptSection['kind'],
  reason: OmissionReason,
  originalTokens: number,
): void {
  if (!isValidSourceId(sourceId)) {
    throw new Error(`ContextProvenanceManifest: invalid sourceId "${sourceId}".`);
  }
  if (manifest.sections.some((s) => s.sourceId === sourceId)) return;
  manifest.sections.push({
    kind,
    sourceId,
    tokens: 0,
    truncated: false,
    originalTokens,
    finalTokens: 0,
    included: false,
    omissionReason: reason,
    cacheEligible: false,
  });
}

/**
 * Cross-check the receipt against the actual packed prompt (RESEARCH
 * Pitfall 4, CTX-T03): the sum of finalTokens over INCLUDED receipt entries
 * must equal the sum of tokens over the packed sections. Any nonzero delta
 * is a bug — the caller warns (never throws) so the inconsistency surfaces
 * in Phase 6 telemetry without invalidating the prompt (T-04b-14 accept).
 */
export function validateReceiptTotals(
  receipt: ContextReceiptEntry[],
  packedSections: PromptSection[],
): boolean {
  const receiptTotal = receipt
    .filter((e) => e.included)
    .reduce((sum, e) => sum + e.finalTokens, 0);
  const packedTotal = packedSections.reduce((sum, s) => sum + s.tokens, 0);
  return receiptTotal === packedTotal;
}

export function markCompression(
  manifest: ContextProvenanceManifest,
  sourceId: string,
  method: ContextProvenanceEntry['compressionApplied'],
): void {
  const entry = manifest.sections.find((s) => s.sourceId === sourceId);
  if (entry) entry.compressionApplied = method;
}
