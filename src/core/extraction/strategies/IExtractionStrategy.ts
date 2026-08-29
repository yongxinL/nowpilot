// IExtractionStrategy contract — verbatim from PRODUCT_SPEC_v0_1.md Appendix
// extraction contract (spec 4667-4699) with ONE documented additive field:
// StrategyInput.baseUrl?. The §26.4 canonical call (spec 3726-3740) passes
// payload.baseUrl to Defuddle so the panel injects the payload's effective
// base URL into the detached doc; baseUrl falls back to `url` when absent.
//
// No barrel index.ts here — direct path imports only (mirror src/core/ai).
import type { APCLiteNode, RawNode } from '../apcLite.types';

export interface StrategyInput {
  url: string; title: string; mode: 'default' | 'actionable';
  html?: string;   // present for DefuddleStrategy (default/read mode)
  raw?: RawNode;   // present for ApcLiteStrategy (actionable mode)
  /** ADDITIVE (deviation from spec 4670-4674, documented above): the payload's
   * effective base URL — spec 3726-3740 passes payload.baseUrl to Defuddle;
   * the strategy falls back to `url` when absent. */
  baseUrl?: string;
}
export interface StrategyResult {
  source: 'defuddle' | 'readability' | 'apc-lite' | 'servicenow-api';
  markdown?: string;      // prose path (Defuddle/Readability)
  root?: APCLiteNode;     // structural path (APC-lite)
  meta?: Record<string, string>;
  approxTokens: number;
  truncated: boolean;
}
export interface IExtractionStrategy {
  id: StrategyResult['source'];
  canHandle(i: { url: string; mode: 'default' | 'actionable' }): boolean;
  run(i: StrategyInput): Promise<StrategyResult>;
}
// NOTE on the two enums (read before implementing): `IExtractionStrategy.id` enumerates the
// installed STRATEGIES; there is intentionally NO separate ReadabilityStrategy — Readability is
// Defuddle's internal fallback, so it appears in `StrategyResult.source` (result provenance) but
// NOT as its own strategy id. `PageContext.source` (the z.enum at §Appendix C page-context block)
// additionally carries 'dom'|'ax'|'hybrid' for the APC-lite walk provenance. Do not create a
// ReadabilityStrategy or a ServiceNow strategy in Phase 6 (ServiceNow strategy registers in Phase 17).

// §26.4a / §26.5 / §26.6 tunables (Phase 6). All ephemeral; none persisted.
export const PAGE_CACHE_MAX_TABS   = 20;         // per-tab PageContentCache LRU cap (§26.4a)
export const PAGE_HTML_MAX_BYTES   = 2_000_000;  // serialized HTML hard cap → truncate+flag (§26.6)
export const INDEX_CHUNK_MAX_TOKENS = 500;       // oversized heading-section split threshold (§26.5)
export const PAGE_EXTRACTION_TIMEOUT_MS = 5_000; // hard cap, single AbortController (§26.6, §13)