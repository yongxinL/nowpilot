import type { APCLiteNode, RawNode } from './apcLite.types';

/**
 * Core extraction domain types (D-11, D-12).
 *
 * - `ExtractionResult` is a discriminated union keyed on `ok`: operational
 *   failures return typed error results instead of throwing (D-11).
 * - `PageContext` is a discriminated union keyed on `mode`: type narrowing
 *   forces every consumer to handle both modes explicitly (D-12).
 */

export type ExtractionErrorCode = 'NO_CONTENT' | 'TIMEOUT' | 'PARSE_ERROR' | 'CAPTURE_FAILED';

export interface ExtractionError {
  code: ExtractionErrorCode;
  message: string;
  /** Strategy IDs attempted before the failure, in execution order. */
  strategiesAttempted: string[];
}

export type ExtractionResult =
  | { ok: true; pageContext: PageContext }
  | { ok: false; error: ExtractionError };

export type ExtractionMode = 'default' | 'actionable';

export type StrategySource = 'defuddle' | 'readability' | 'apc-lite';

export interface BaseMetadata {
  url: string;
  title: string;
  capturedAt: number;
  /** Serialized HTML size at capture time (bytes, pre-parsing). */
  size: number;
  source: StrategySource;
  extractionLevel: 'full' | 'truncated';
  truncated: boolean;
  compressionApplied?: 'topk';
  author?: string;
  publishDate?: string;
  language?: string;
  description?: string;
  siteName?: string;
}

export type PageContext =
  | ({ mode: 'default'; markdown: string } & BaseMetadata)
  | ({ mode: 'actionable'; apcLiteTree: APCLiteNode } & BaseMetadata);

export interface StrategyInput {
  url: string;
  title: string;
  mode: ExtractionMode;
  /** Serialized page HTML (present for HTML-based strategies). */
  html?: string;
  /** Raw DOM-derived tree (present for APCLite strategy). */
  raw?: RawNode;
}

export interface StrategyResult {
  source: StrategySource;
  markdown?: string;
  root?: APCLiteNode;
  meta?: Record<string, string>;
  approxTokens: number;
  truncated: boolean;
}
