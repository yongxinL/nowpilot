import { APCLiteDocument, APCLiteNode, ExtractOptions, SelectOptions } from './apcLite.types';
import type { PageContext } from '@/core/content/PageContext';
import { normalize, prune, redact } from './transforms';
import { PageContentCache } from './PageContentCache';
import { PageIndexBuilder } from './PageIndexBuilder';
import { flattenMarkdown, budgetTrim, withAncestorHeadings, estimateTokens } from './PageContentSerializer';
import { countNodes, findNodeById } from './apcLite.types';
import { debugLog } from '../utils/debugLog';
import { EXTRACT_PAGE_CONTENT_TREE } from '../messaging/pageMessages';

const TAB_EXTRACT_TIMEOUT_MS = 5000;
const MAX_SAFE_MARKDOWN = 100 * 1024;

export class PageContentService {
  private cache = new PageContentCache();
  private inflight = new Map<number, Promise<APCLiteDocument>>();

  async extract(opts: ExtractOptions): Promise<APCLiteDocument> {
    if (this.inflight.has(opts.tabId)) return this.inflight.get(opts.tabId)!;
    const p = this.doExtract(opts).finally(() => this.inflight.delete(opts.tabId));
    this.inflight.set(opts.tabId, p);
    return p;
  }

  private async doExtract(opts: ExtractOptions): Promise<APCLiteDocument> {
    const started = performance.now();
    try {
      const raw = await this.requestContentScriptExtraction(opts.tabId);
      let root = normalize(raw.raw as import('./apcLite.types').RawNode);
      root = prune(root, { includeOutOfViewport: opts.includeOutOfViewport ?? true });
      root = redact(root);
      const doc: APCLiteDocument = {
        url: raw.url,
        title: raw.title,
        extractedAt: Date.now(),
        source: 'dom',
        root,
        stats: {
          nodeCount: countNodes(root),
          approxTokens: estimateTokens(flattenMarkdown(root)),
          durationMs: performance.now() - started,
          truncated: false,
        },
      };
      this.cache.set(opts.tabId, doc);
      return doc;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      debugLog('error', '[PageContentService] Extract failed', { msg, tabId: opts.tabId });
      throw e;
    }
  }

  async getForTab(tabId: number, opts: Partial<ExtractOptions> = {}): Promise<APCLiteDocument> {
    const cached = this.cache.get(tabId);
    if (cached) return cached;
    return this.extract({ tabId, mode: 'default', ...opts });
  }

  async getForTabAsPageContext(tabId: number, opts: Partial<ExtractOptions> = {}): Promise<PageContext> {
    debugLog('debug', '[PageContentService] getForTabAsPageContext', { tabId, hasCache: this.cache.get(tabId) !== undefined, inflight: this.inflight.has(tabId) });
    const doc = await this.getForTab(tabId, opts);
    const pageCtx = this.toPageContext(doc);
    debugLog('info', '[PageContentService] PageContext ready', { url: pageCtx.url, markdownLength: pageCtx.markdown?.length ?? 0, extractionType: pageCtx.extractionType });
    return pageCtx;
  }

  selectRelevant(doc: APCLiteDocument, query: string, opts: SelectOptions = {}): APCLiteNode[] {
    const index = PageIndexBuilder.getOrBuild(doc);
    const hits = index.search(query).map((h) => findNodeById(doc.root, String(h.id))).filter(Boolean) as APCLiteNode[];
    const withCtx = opts.expandParents ? withAncestorHeadings(doc.root, hits) : hits;
    return budgetTrim(withCtx, opts.maxTokens ?? 2000);
  }

  toPageContext(doc: APCLiteDocument): PageContext {
    let markdown = flattenMarkdown(doc.root);
    const truncated = markdown.length > MAX_SAFE_MARKDOWN;
    if (truncated) {
      markdown = markdown.slice(0, MAX_SAFE_MARKDOWN) + '\n\n[Content truncated \u2014 exceeds safety limit]';
    }
    return {
      url: doc.url,
      origin: safeOrigin(doc.url),
      hostname: safeHostname(doc.url),
      title: doc.title,
      markdown,
      meta: {},
      extractedAt: doc.extractedAt,
      extractionType: 'axdom',
      extractionQuality: truncated ? 'minimal' : 'tree',
    };
  }

  invalidate(tabId: number): void {
    this.cache.delete(tabId);
    PageIndexBuilder.drop(tabId);
  }

  private async requestContentScriptExtraction(
    tabId: number,
  ): Promise<{ raw: { id: string; role: string; type?: string; text?: string; children?: unknown[] }; url: string; title: string }> {
    const message = {
      type: EXTRACT_PAGE_CONTENT_TREE,
    };

    debugLog('debug', '[PageContentService] Sending EXTRACT_PAGE_CONTENT_TREE', { tabId });

    const call = chrome.tabs.sendMessage(tabId, message) as Promise<{
      ok: boolean;
      data?: { raw: { id: string; role: string; type?: string; text?: string; children?: unknown[] }; url: string; title: string };
      error?: { code: string; message: string };
    }>;

    const res = await Promise.race([
      call,
      new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' })),
          TAB_EXTRACT_TIMEOUT_MS,
        ),
      ),
    ]);

    if (!res || !res.ok) {
      const errMsg = res?.error?.message ?? 'EXTRACTION_FAILED';
      debugLog('error', '[PageContentService] Content script returned error', { tabId, error: errMsg, code: res?.error?.code });
      throw Object.assign(new Error(errMsg), {
        code: res?.error?.code ?? 'CONTENT_EXTRACT_FAILED',
      });
    }

    debugLog('info', '[PageContentService] Content script responded', { tabId, url: res.data?.url });
    return res.data!;
  }
}

function safeOrigin(u: string): string {
  try { return new URL(u).origin; } catch { return ''; }
}
function safeHostname(u: string): string {
  try { return new URL(u).hostname; } catch { return ''; }
}

export const pageContentService = new PageContentService();
