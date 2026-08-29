// ApcLiteStrategy — the actionable-path strategy (mode 'actionable'), panel-side.
//
// Second tier of the §26.6 APC-lite split (Architectural Responsibility Map):
// AxDomWalker captures RawNode trees content-script-side (ISOLATED world,
// password values omitted at capture); this strategy normalizes
// RawNode → APCLiteNode and schema-validates the APCLiteDocument
// (source 'ax') panel-side — the zod validation happens HERE, never in the
// content bundle (Pitfall 8).
//
// D-86 gating: canHandle is true ONLY for mode:'actionable' — zero AX cost on
// the default read/summarize path (DefuddleStrategy owns 'default').
//
// Password invariant (D-86/D-90): the walker already omits password values at
// capture; APCLiteDocumentSchema.parse is the panel-side BACKSTOP — a
// password-carrying control trips the FormControlSchema.refine and the run()
// catches it into the failed shape. Never a silent empty result (D-91): a
// missing raw payload or a validation failure both return the failed
// fallback shape (source 'apc-lite', root undefined, truncated true) so
// PageContentService surfaces the typed CONTENT_EXTRACT_FAILED.
//
// v0.1 depth (§26.6): domNodeId and geometry stay undefined — a future
// measurement pass reads layout content-side, never in the panel.
import { debugLog } from '../../log/debugLog';
import { countTokensHeuristic } from '../../context/TokenBudget';
import { APCLiteDocumentSchema } from '../apcLite.types';
import type { APCLiteNode, RawNode } from '../apcLite.types';
import type { IExtractionStrategy, StrategyInput, StrategyResult } from './IExtractionStrategy';
import { registerStrategy } from '../PageContentService';

const SOURCE = 'apc-lite' as const;

/** Normalize a content-script RawNode tree into an APCLiteNode tree.
 * Role/text/type map verbatim; heading level (h1-h6) derives from `type`;
 * interaction/link/image/form/iframe map from the raw record; children
 * recurse. domNodeId + geometry deliberately left undefined (v0.1 §26.6). */
export function normalizeRawNode(raw: RawNode): APCLiteNode {
  const node: APCLiteNode = { id: raw.id, role: raw.role };
  if (raw.type !== undefined) node.type = raw.type;
  if (raw.text !== undefined) node.text = raw.text;

  if (raw.role === 'heading' && raw.type !== undefined) {
    const level = /^h([1-6])$/.exec(raw.type);
    if (level) node.textStyle = { level: Number(level[1]) };
  }

  if (raw.interaction !== undefined) node.interaction = raw.interaction;
  if (raw.link !== undefined) node.link = raw.link;
  if (raw.image !== undefined) node.image = raw.image;
  if (raw.form?.control !== undefined) {
    node.form = { control: raw.form.control };
  }
  if (raw.iframe !== undefined) node.iframe = raw.iframe;

  if (raw.children !== undefined && raw.children.length > 0) {
    node.children = raw.children.map(normalizeRawNode);
  }
  return node;
}

function countNodes(node: APCLiteNode): number {
  return 1 + (node.children?.reduce((sum, child) => sum + countNodes(child), 0) ?? 0);
}

export class ApcLiteStrategy implements IExtractionStrategy {
  readonly id = SOURCE;

  canHandle(i: { url: string; mode: 'default' | 'actionable' }): boolean {
    return i.mode === 'actionable';
  }

  async run(input: StrategyInput): Promise<StrategyResult> {
    if (input.raw === undefined) {
      // Actionable request without the walker payload (e.g. the bridge had no
      // content) — failed fallback shape; the service surfaces the typed
      // CONTENT_EXTRACT_FAILED. Never a silent empty result (D-91).
      return { source: SOURCE, markdown: undefined, approxTokens: 0, truncated: true };
    }
    try {
      const startedAt = Date.now();
      const root = normalizeRawNode(input.raw);
      const approxTokens = countTokensHeuristic(JSON.stringify(root));
      const doc = APCLiteDocumentSchema.parse({
        url: input.url,
        title: input.title,
        extractedAt: Date.now(),
        source: 'ax',
        root,
        stats: {
          nodeCount: countNodes(root),
          approxTokens,
          durationMs: Date.now() - startedAt,
          truncated: input.truncated ?? false,
        },
      });
      return {
        source: SOURCE,
        root: doc.root,
        meta: { nodeCount: String(doc.stats.nodeCount) },
        approxTokens: doc.stats.approxTokens,
        truncated: doc.stats.truncated,
      };
    } catch (error) {
      // Schema validation failed (e.g. a password-carrying control tripped the
      // FormControlSchema.refine backstop) — catch into the failed shape.
      debugLog('APC_LITE_VALIDATION_FAILED', 'APCLiteDocument validation failed', { error });
      return { source: SOURCE, markdown: undefined, approxTokens: 0, truncated: true };
    }
  }
}

/** Singleton registered into PageContentService at module load (D-51,
 * defuddleStrategy precedent) — the actionable path becomes live once this
 * module is imported by the service. */
export const apcLiteStrategy = new ApcLiteStrategy();
registerStrategy(apcLiteStrategy);