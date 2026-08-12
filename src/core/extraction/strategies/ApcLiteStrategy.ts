// src/core/extraction/strategies/ApcLiteStrategy.ts — 04a-04 structural path
// (D-4a-11/13/14/20/21). Implements IExtractionStrategy for mode 'actionable':
//   RawNode (content-side AxDomWalker output) → normalized APCLiteNode tree →
//   APCLiteDocumentSchema.parse(...) as the GR-4 zod boundary gate → StrategyResult
//   { source: 'apc-lite', root, approxTokens, truncated }.
//
// D-4a-13: the layout field stays UNSET in v0.1 — never read (no
// getBoundingClientRect), never populated. The APCLiteNode type declares the
// optional field (spec verbatim); this strategy simply never assigns it, so
// every emitted node carries undefined for that key.
//
// D-4a-20 defense-in-depth: the password-omission invariant is enforced AT
// CAPTURE by the content-side AxDomWalker AND re-validated HERE by
// FormControlSchema.refine inside the schema parse — a password-bearing RawNode
// with a value FAILS the boundary (never merely redacted later).
//
// D-4a-21 provenance metrics: stats carry nodeCount / approxTokens / durationMs
// / truncated only — the Diagnostics (§4.5) contract. No raw page body.
import { estimateTokens } from '@/core/context/TokenBudget';
import { APCLiteDocumentSchema, type APCLiteNode, type RawNode } from '../apcLite.types';
import type { IExtractionStrategy, StrategyInput, StrategyResult } from './IExtractionStrategy';

/**
 * RawNode → APCLiteNode normalization (D-4a-11/13): keep roles/text/hierarchy/
 * interaction/link/image/form/iframe/children. The layout field and domNodeId
 * are NOT emitted (the fields stay optional + unset in v0.1).
 */
function normalize(raw: RawNode): APCLiteNode {
  const node: APCLiteNode = {
    id: raw.id,
    role: raw.role,
    type: raw.type,
    text: raw.text,
    interaction: raw.interaction,
    link: raw.link,
    image: raw.image,
    form: raw.form,
    iframe: raw.iframe,
  };
  if (raw.children) node.children = raw.children.map(normalize);
  return node;
}

/** Recursive node count (root + all descendants) — D-4a-21 stats.nodeCount. */
function countNodes(node: APCLiteNode): number {
  return 1 + (node.children?.reduce((sum, child) => sum + countNodes(child), 0) ?? 0);
}

/** Concatenated text of the tree — the approxTokens estimate source. */
function collectText(node: APCLiteNode): string {
  return [
    node.text ?? '',
    ...(node.children?.flatMap((child) => [collectText(child)]) ?? []),
  ]
    .filter(Boolean)
    .join(' ');
}

export class ApcLiteStrategy implements IExtractionStrategy {
  id = 'apc-lite' as const;

  /** D-4a-14 mode gating — structural path is requested explicitly, never default. */
  canHandle({ mode }: { url: string; mode: 'default' | 'actionable' }): boolean {
    return mode === 'actionable';
  }

  async run(input: StrategyInput): Promise<StrategyResult> {
    // Defensive check — canHandle gates the mode, but a bad call must not
    // silently emit an empty structural document.
    if (!input.raw) throw new Error('ApcLiteStrategy requires raw');
    const startedAt = Date.now();

    const root = normalize(input.raw);
    const nodeCount = countNodes(root);
    const doc = APCLiteDocumentSchema.parse({
      url: input.url,
      title: input.title,
      extractedAt: startedAt,
      source: 'dom',
      root,
      stats: {
        nodeCount,
        approxTokens: estimateTokens(collectText(root)),
        durationMs: Date.now() - startedAt,
        truncated: false,
      },
    });

    // The schema parse IS the boundary gate (GR-4) — a password-with-value
    // control throws here (D-4a-20), before any caller consumes the tree.
    return {
      source: 'apc-lite',
      root: doc.root,
      approxTokens: doc.stats.approxTokens,
      truncated: doc.stats.truncated,
    };
  }
}
