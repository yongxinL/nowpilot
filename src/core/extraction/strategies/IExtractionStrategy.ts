// src/core/extraction/strategies/IExtractionStrategy.ts — Source: Appendix C.1 (verbatim, lines 4680-4700) + §26.3 (L3772-3778). The 'servicenow-api' id is RESERVED (D-4a-17) — the core stays add-on-agnostic; the ServiceNow add-on registers its strategy in Phase 8.
// Rule-3 adjustment (documented): the spec block imports only APCLiteNode from './apcLite.types'
// but StrategyInput.raw references RawNode (same canonical home) — both are type-imported via
// the ../ path since this file lives in strategies/ (PATTERNS L161); contract otherwise verbatim.
import type { APCLiteNode, RawNode } from '../apcLite.types';
export interface StrategyInput {
  url: string;
  title: string;
  mode: 'default' | 'actionable';
  html?: string; // present for DefuddleStrategy (default/read mode)
  raw?: RawNode; // present for ApcLiteStrategy (actionable mode)
}
export interface StrategyResult {
  source: 'defuddle' | 'readability' | 'apc-lite' | 'servicenow-api';
  markdown?: string; // prose path (Defuddle/Readability)
  root?: APCLiteNode; // structural path (APC-lite)
  meta?: Record<string, string>;
  approxTokens: number;
  truncated: boolean;
}
export interface IExtractionStrategy {
  id: StrategyResult['source'];
  canHandle(i: { url: string; mode: 'default' | 'actionable' }): boolean;
  run(i: StrategyInput): Promise<StrategyResult>;
}
