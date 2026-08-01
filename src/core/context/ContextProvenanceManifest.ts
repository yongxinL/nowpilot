import type { ContextProvenanceEntry, ContextProvenanceManifest, PromptSection } from '../ai/types';

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
  if (!isValidSourceId(section.sourceId)) {
    throw new Error(`ContextProvenanceManifest: invalid sourceId "${section.sourceId}".`);
  }
  manifest.sections.push({
    kind: section.kind,
    sourceId: section.sourceId,
    tokens: section.tokens,
    truncated: false,
    originalTokens: section.tokens,
    finalTokens: section.tokens,
    included: true,
    cacheEligible: false,
  });
  manifest.totalTokens += section.tokens;
}

export function markTruncated(manifest: ContextProvenanceManifest, sourceId: string): void {
  const entry = manifest.sections.find((s) => s.sourceId === sourceId);
  if (entry) entry.truncated = true;
}

export function markCompression(
  manifest: ContextProvenanceManifest,
  sourceId: string,
  method: ContextProvenanceEntry['compressionApplied'],
): void {
  const entry = manifest.sections.find((s) => s.sourceId === sourceId);
  if (entry) entry.compressionApplied = method;
}
