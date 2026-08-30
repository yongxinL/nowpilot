// ContextReceipt — D-95/D-96 derived context receipt (CTX-03).
//
// deriveContextReceipt maps the verbatim §2.6 ContextProvenanceManifest +
// retained per-section original token counts (D-96) + the A8 sections + the
// D-93 ContextItem[] into the C.1-verbatim ContextReceiptEntry[] (spec
// 4892-4900) plus the L6 user-disclosure signal `untrustedDataPresent`
// (UI-SPEC Contract A, D-98).
//
// The manifest schema, A8 PromptSection, and §1.3 canonical order stay
// byte-identical (D-72/D-77/D-95 — this module is a separate derived view,
// never manifest fields). Derivation rules (UI-SPEC Contract C, LOCKED):
//   sourceId      = manifest record sourceId
//   included      = true for shipped sections; false for by-design omission
//                   records (sourceId 'system'/'task') and for dropped
//                   debug/notes (sourceId 'debug'/'notes' when rungs 1-2 fired,
//                   i.e. record.truncated)
//   originalTokens= originalTokens[sourceId] ?? record.tokens (D-96)
//   finalTokens   = record.tokens
//   compression   = record.compressionApplied (only when present)
//   cacheEligible = the A8 stable flag of the section whose kind maps to
//                   record.kind via the inverted MANIFEST_KIND_MAP
//   omitReason    = 'no-input-source' (system/task) | 'debug-only' (debug) |
//                   'secondary-notes' (notes), only for omitted entries
//   untrustedDataPresent = items.some(trust ∈ {untrusted, retrieved}) — the L6
//                   signal is a boolean, never content (Contract A; D-95).
//
// Pure function — never throws (RESEARCH Pitfall 2).
import type { ContextProvenanceManifest, ManifestSectionRecord } from '../ContextProvenanceManifest';
import { MANIFEST_KIND_MAP } from '../ContextProvenanceManifest';
import type { ContextItem, ContextReceiptEntry } from '@/types/harness';
import type { PromptSection } from '../../ai/types';

/** Additive receipt surface attached to OptimizedContext (D-77 precedent). */
export interface ContextReceiptSurface {
  entries: ContextReceiptEntry[];
  untrustedDataPresent: boolean;
}

/** Inverted §2.6 casing table: manifest kind → A8 section kind (cacheEligible lookup). */
const A8_KIND_BY_MANIFEST_KIND: ReadonlyMap<string, string> = new Map(
  Object.entries(MANIFEST_KIND_MAP).map(([a8Kind, manifestKind]) => [manifestKind, a8Kind]),
);

/** included = shipped section (even degraded — truncation ≠ omission); false
 * for the by-design system/task omission records and for dropped debug/notes. */
function isIncluded(record: ManifestSectionRecord): boolean {
  if (record.sourceId === 'system' || record.sourceId === 'task') return false;
  if (record.sourceId === 'debug' || record.sourceId === 'notes') return !record.truncated;
  return true;
}

/** omitReason only for omitted entries: 'no-input-source' (system/task),
 * 'debug-only' (debug), 'secondary-notes' (notes). */
function omitReasonFor(record: ManifestSectionRecord, included: boolean): string | undefined {
  if (included) return undefined;
  switch (record.sourceId) {
    case 'system':
    case 'task':
      return 'no-input-source';
    case 'debug':
      return 'debug-only';
    case 'notes':
      return 'secondary-notes';
    default:
      return undefined;
  }
}

/** cacheEligible = the A8 stable flag of the section whose kind maps to
 * record.kind (manifest does not carry stable — pass sections in). CONTEXT-
 * multiplicity is safe: every CONTEXT section is stable:false. */
function cacheEligibleFor(record: ManifestSectionRecord, sections: PromptSection[]): boolean {
  const a8Kind = A8_KIND_BY_MANIFEST_KIND.get(record.kind);
  if (!a8Kind) return false;
  const section = sections.find((s) => s.kind === a8Kind);
  return section ? section.stable : false;
}

/**
 * Derive the context receipt from the verbatim manifest + D-96 original token
 * counts + the shipped A8 sections + the D-93 items. Pure; never throws.
 */
export function deriveContextReceipt(
  manifest: ContextProvenanceManifest,
  originalTokens: Record<string, number>,
  sections: PromptSection[],
  items: ContextItem[],
): ContextReceiptSurface {
  const entries: ContextReceiptEntry[] = manifest.sections.map((record) => {
    const included = isIncluded(record);
    return {
      sourceId: record.sourceId,
      included,
      originalTokens: originalTokens[record.sourceId] ?? record.tokens,
      finalTokens: record.tokens,
      compression: record.compressionApplied,
      cacheEligible: cacheEligibleFor(record, sections),
      omitReason: omitReasonFor(record, included),
    };
  });

  // L6 disclosure signal (UI-SPEC Contract A, D-98): a boolean over the item
  // trust mix — untrusted or retrieved data was present in the assembly.
  const untrustedDataPresent = items.some(
    (it) => it.trust === 'untrusted' || it.trust === 'retrieved',
  );

  return { entries, untrustedDataPresent };
}