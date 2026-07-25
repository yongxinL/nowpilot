import type { RawNode } from './apcLite.types';
import type { PageContext } from '../content/PageContext';
import { normalize, prune, redact } from './transforms';
import { flattenMarkdown, estimateTokens } from './PageContentSerializer';

const MAX_SAFE_MARKDOWN = 100 * 1024;

export function hydratePageContext(raw: RawNode, url: string, title: string): PageContext {
  let root = normalize(raw);
  root = prune(root, { includeOutOfViewport: true });
  root = redact(root);

  let markdown = flattenMarkdown(root);
  const truncated = markdown.length > MAX_SAFE_MARKDOWN;
  if (truncated) {
    markdown = markdown.slice(0, MAX_SAFE_MARKDOWN) + '\n\n[Content truncated \u2014 exceeds safety limit]';
  }

  return {
    url,
    origin: safeOrigin(url),
    hostname: safeHostname(url),
    title,
    markdown,
    meta: {},
    extractedAt: Date.now(),
    extractionType: 'axdom',
    extractionQuality: truncated ? 'minimal' : 'tree',
  };
}

function safeOrigin(u: string): string {
  try { return new URL(u).origin; } catch { return ''; }
}
function safeHostname(u: string): string {
  try { return new URL(u).hostname; } catch { return ''; }
}
