// ContextQualityMetrics — D-102 derived aggregate metrics (CTX-06).
//
// deriveContextQualityMetrics maps the verbatim §2.6 ContextProvenanceManifest +
// the D-95 ContextReceiptSurface + the D-93 ContextItem[] into a raw-text-free
// aggregate surface (UI-SPEC Contract B, LOCKED): section count, per-TrustLevel
// trust mix, truncation/omission/compression counts, token utilization ratio
// original→final, and the minimalMode flag. NO section bodies anywhere — the
// aggregates are computed by iterating records/entries/items; a section's text
// is never read into the metrics (D-102 hard boundary). This mirrors the D-77
// derived-trace surface (ContextOptimizer.manifestTruncatedSources — sourceIds
// only, never bodies; ContextOptimizer.ts:441-445) and Phase 11 lifts it
// additively into PromptTrace/DiagnosticsSection (UI-SPEC copy seeds).
//
// Pure function — never throws (RESEARCH Pitfall 2). No schema edits: the
// manifest, A8 PromptSection, and §1.3 canonical order stay byte-identical
// (D-72/D-77/D-95).
import type { ContextProvenanceManifest, ManifestSectionRecord } from '../ContextProvenanceManifest';
import type { ContextReceiptSurface } from './ContextReceipt';
import type { ContextItem, TrustLevel } from '@/types/harness';

/** CTX-06 derived aggregate metrics — UI-SPEC Contract B shape (D-102).
 * Aggregates ONLY: no section bodies, no raw sensitive text. */
export interface ContextQualityMetrics {
  /** §2.6 manifest section record count (includes the by-design system/task omissions). */
  sectionCount: number;
  /** Counts per TrustLevel over the D-93 item set — all five keys present, 0 for absent levels. */
  trustMix: Record<TrustLevel, number>;
  /** Manifest records truncated:true, EXCLUDING the by-design system/task omission records
   * (the manifestTruncatedSources filter precedent, ContextOptimizer.ts:441-445). */
  truncationCount: number;
  /** Receipt entries with included:false (by-design omissions + dropped debug/notes). */
  omissionCount: number;
  /** Manifest records carrying compressionApplied (summarise/structural/topk). */
  compressionCount: number;
  /** Σ finalTokens / Σ originalTokens over the receipt entries, rounded to 4dp;
   * 1 when the receipt has no entries (never NaN — zero-divisor guarded). */
  tokenUtilizationRatio: number;
  /** Manifest minimalMode flag. */
  minimalMode: boolean;
}

/** All five TrustLevel keys, zeroed — trustMix always carries every level so
 * consumers never see a missing key (absent levels report 0; D-102 contract). */
const ZERO_TRUST_MIX: Record<TrustLevel, number> = {
  system: 0,
  user: 0,
  tool: 0,
  retrieved: 0,
  untrusted: 0,
};

/** A genuine truncation excludes the by-design 'system'/'task' omission records
 * (they are truncated:true with 0 tokens but are not degradation events — the
 * manifestTruncatedSources filter precedent). */
function isGenuineTruncation(record: ManifestSectionRecord): boolean {
  return record.truncated && record.sourceId !== 'system' && record.sourceId !== 'task';
}

/**
 * Derive the CTX-06 aggregate metrics from the manifest + receipt + items.
 * Aggregates only — computed by iterating records/entries/items; a section's
 * text is never read into the output shape (D-102 hard boundary, UI-SPEC
 * Contract B). Pure; never throws.
 */
export function deriveContextQualityMetrics(
  manifest: ContextProvenanceManifest,
  receipt: ContextReceiptSurface,
  items: ContextItem[],
): ContextQualityMetrics {
  const trustMix: Record<TrustLevel, number> = { ...ZERO_TRUST_MIX };
  for (const item of items) {
    trustMix[item.trust] += 1;
  }

  const truncationCount = manifest.sections.filter(isGenuineTruncation).length;
  const omissionCount = receipt.entries.filter((entry) => !entry.included).length;
  const compressionCount = manifest.sections.filter(
    (record) => record.compressionApplied !== undefined,
  ).length;

  const originalTotal = receipt.entries.reduce((sum, entry) => sum + entry.originalTokens, 0);
  const finalTotal = receipt.entries.reduce((sum, entry) => sum + entry.finalTokens, 0);
  // Zero-divisor guard: an empty receipt (no entries) reports ratio 1 — never NaN.
  const tokenUtilizationRatio =
    originalTotal === 0 ? 1 : Math.round((finalTotal / originalTotal) * 10000) / 10000;

  return {
    sectionCount: manifest.sections.length,
    trustMix,
    truncationCount,
    omissionCount,
    compressionCount,
    tokenUtilizationRatio,
    minimalMode: manifest.minimalMode,
  };
}