/**
 * PageExtractor — Readability + turndown + DOM fallback extraction.
 *
 * Extracts PageContext from a live Document, using @mozilla/readability
 * for article pages and falling back to visible DOM text for non-articles.
 *
 * ## Key invariants
 * - ALWAYS document.cloneNode(true) before passing to Readability (Pitfall 1)
 * - Never throw from extract() — return degraded PageContext on error
 * - Enforces ~100KB safety ceiling on markdown (D-07)
 * - Strips password/hidden/credential fields (D-28)
 * - URL blocklist rejects sensitive protocols (D-26)
 *
 * Pattern: Class+singleton from ContextCompressor.ts
 */
import { Readability, isProbablyReaderable } from '@mozilla/readability';
import TurndownService from 'turndown';
import { debugLog } from '../utils/debugLog';
import type { PageContext } from './PageContext';
import type { ExtractionTraceStep } from '../messaging/pageMessages';

/** Safety ceiling for markdown output (~100KB per D-07) */
const MAX_SAFE_MARKDOWN = 100 * 1024; // 100KB

/** Blocked URL protocols (D-26) */
const BLOCKED_PROTOCOLS = /^(chrome|chrome-extension|edge|about|view-source|devtools|file):/i;

export class PageExtractor {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });
  }

  /**
   * Public extraction API — stateless, pure function over input document.
   * Never throws — returns degraded PageContext on any error.
   * Collects trace steps for diagnostics (D-44).
   */
  extract(doc: Document, traceSteps?: ExtractionTraceStep[]): PageContext {
    const url = doc.URL;
    const meta = this.extractMeta(doc, traceSteps);
    const selectedTextStart = performance.now();
    const selectedText = this.getSelectedText(traceSteps);
    traceSteps?.push({ step: 'get_selected_text', status: 'ok', durationMs: Math.round(performance.now() - selectedTextStart), detail: selectedText ? `selected ${selectedText.length} chars` : 'no selection', url });

    // URL blocklist check (D-26)
    const blockedStart = performance.now();
    if (this.isBlockedUrl(url, traceSteps)) {
      traceSteps?.push({ step: 'url_blocklist', status: 'ok', durationMs: Math.round(performance.now() - blockedStart), detail: 'blocked', url });
      debugLog('info', '[PageExtractor] URL blocked, returning metadata-only', { url });
      return {
        url,
        origin: this.tryGetOrigin(doc, url),
        hostname: this.tryGetHostname(doc, url),
        title: doc.title || '',
        markdown: '',
        meta,
        extractedAt: Date.now(),
        selectedText,
        extractionType: 'metadata-only',
        extractionQuality: 'minimal',
      };
    }
    traceSteps?.push({ step: 'url_blocklist', status: 'ok', durationMs: Math.round(performance.now() - blockedStart), detail: 'allowed', url });

    const contentStart = performance.now();
    const { markdown, extractionType, extractionQuality } = this.extractContent(doc, traceSteps);
    traceSteps?.push({ step: 'extract_content', status: 'ok', durationMs: Math.round(performance.now() - contentStart), detail: `${extractionType}/${extractionQuality}`, url });

    return {
      url,
      origin: this.tryGetOrigin(doc, url),
      hostname: this.tryGetHostname(doc, url),
      title: doc.title || '',
      markdown,
      meta,
      extractedAt: Date.now(),
      selectedText,
      extractionType,
      extractionQuality,
    };
  }

  // ---- Private methods ----

  /**
   * Core extraction: try Readability first, fall back to visible text.
   */
  private extractContent(doc: Document, traceSteps?: ExtractionTraceStep[]): {
    markdown?: string;
    extractionType: PageContext['extractionType'];
    extractionQuality: PageContext['extractionQuality'];
  } {
    try {
      const readableStart = performance.now();
      const readerable = isProbablyReaderable(doc);
      traceSteps?.push({ step: 'readability_check', status: 'ok', durationMs: Math.round(performance.now() - readableStart), detail: readerable ? 'readerable' : 'not-readerable', url: doc.URL });
      debugLog('debug', '[PageExtractor] Readability check', { url: doc.URL, readerable });

      if (readerable) {
        // Pitfall 1: ALWAYS clone before Readability (mutates DOM)
        const cloneStart = performance.now();
        const clone = doc.cloneNode(true) as Document;
        const article = new Readability(clone).parse();
        const cloneDuration = Math.round(performance.now() - cloneStart);
        traceSteps?.push({ step: 'readability_parse', status: article?.content ? 'ok' : 'skip', durationMs: cloneDuration, detail: article?.textContent ? `${article.textContent.length} chars` : 'no content', url: doc.URL });
        debugLog('debug', '[PageExtractor] Readability parse result', { url: doc.URL, hasContent: !!article?.content, textLength: article?.textContent?.length });

        if (article?.content && (article.textContent?.length ?? 0) >= 100) {
          const mdStart = performance.now();
          const rawMarkdown = this.turndown.turndown(article.content);
          const mdDuration = Math.round(performance.now() - mdStart);
          traceSteps?.push({ step: 'markdown_conversion', status: 'ok', durationMs: mdDuration, detail: `${rawMarkdown.length} chars`, url: doc.URL });
          debugLog('debug', '[PageExtractor] Markdown conversion', { url: doc.URL, markdownLength: rawMarkdown.length });

          // D-07: Safety ceiling
          if (rawMarkdown.length > MAX_SAFE_MARKDOWN) {
            debugLog('warn', '[PageExtractor] Markdown exceeds safety ceiling, truncating', {
              url: doc.URL,
              size: rawMarkdown.length,
            });
            traceSteps?.push({ step: 'safety_ceiling', status: 'ok', durationMs: 0, detail: `truncated ${rawMarkdown.length} → ${MAX_SAFE_MARKDOWN}`, url: doc.URL });
            return {
              markdown: rawMarkdown.slice(0, MAX_SAFE_MARKDOWN) + '\n\n[Content truncated — exceeds safety limit]',
              extractionType: 'readability',
              extractionQuality: 'minimal',
            };
          }
          traceSteps?.push({ step: 'safety_ceiling', status: 'ok', durationMs: 0, detail: `within limit (${rawMarkdown.length} <= ${MAX_SAFE_MARKDOWN})`, url: doc.URL });

          const sanitizeStart = performance.now();
          const sanitized = this.sanitizeMarkdown(rawMarkdown, traceSteps, doc.URL);
          traceSteps?.push({ step: 'sanitize', status: 'ok', durationMs: Math.round(performance.now() - sanitizeStart), detail: `from ${rawMarkdown.length} to ${sanitized.length} chars`, url: doc.URL });

          return {
            markdown: sanitized,
            extractionType: 'readability',
            extractionQuality: 'article',
          };
        }

        if (article?.content) {
          debugLog('debug', '[PageExtractor] Readability content too short, falling back', { url: doc.URL, textLength: article.textContent?.length });
          traceSteps?.push({ step: 'readability_too_short', status: 'skip', durationMs: 0, detail: `textContent only ${article.textContent?.length ?? 0} chars (min 100)`, url: doc.URL });
        }
      }
    } catch (err) {
      debugLog('warn', '[PageExtractor] Readability extraction failed, falling back to visible text', {
        error: err instanceof Error ? err.message : String(err),
        url: doc.URL,
      });
      traceSteps?.push({ step: 'readability_error', status: 'fail', durationMs: 0, detail: err instanceof Error ? err.message : String(err), url: doc.URL });
    }

    // Fallback: extract visible text from body (D-06)
    return this.extractVisibleText(doc, traceSteps);
  }

  /**
   * Fallback extraction: visible DOM text.
   * Uses body.innerText with safety cap.
   */
  private extractVisibleText(doc: Document, traceSteps?: ExtractionTraceStep[]): {
    markdown?: string;
    extractionType: PageContext['extractionType'];
    extractionQuality: PageContext['extractionQuality'];
  } {
    const fallbackStart = performance.now();
    const bodyText = doc.body?.textContent?.slice(0, MAX_SAFE_MARKDOWN) || '';
    const fallbackDuration = Math.round(performance.now() - fallbackStart);
    debugLog('debug', '[PageExtractor] Visible text fallback', { url: doc.URL, bodyTextLength: bodyText.length });

    if (bodyText.length > 50) {
      traceSteps?.push({ step: 'visible_text_fallback', status: 'ok', durationMs: fallbackDuration, detail: `${bodyText.length} chars (generic)`, url: doc.URL });
      return {
        markdown: bodyText,
        extractionType: 'visible-content',
        extractionQuality: 'generic',
      };
    }

    traceSteps?.push({ step: 'visible_text_fallback', status: 'ok', durationMs: fallbackDuration, detail: `${bodyText.length} chars (minimal)`, url: doc.URL });
    debugLog('info', '[PageExtractor] Minimal content extracted', { url: doc.URL, bodyTextLength: bodyText.length });
    return {
      markdown: bodyText || undefined,
      extractionType: 'visible-content',
      extractionQuality: 'minimal',
    };
  }

  /**
   * Extract meta tags (name, property, og:).
   */
  private extractMeta(doc: Document, traceSteps?: ExtractionTraceStep[]): Record<string, string> {
    const metaStart = performance.now();
    const meta: Record<string, string> = {};
    doc.querySelectorAll('meta[name], meta[property]').forEach((el) => {
      const name = el.getAttribute('name') || el.getAttribute('property');
      const content = el.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });
    traceSteps?.push({ step: 'extract_meta', status: 'ok', durationMs: Math.round(performance.now() - metaStart), detail: `${Object.keys(meta).length} tags found`, url: doc.URL });
    debugLog('debug', '[PageExtractor] Meta extraction', { url: doc.URL, metaCount: Object.keys(meta).length });
    return meta;
  }

  /**
   * Capture selected text from window.getSelection() (D-08).
   * Empty string → undefined.
   */
  private getSelectedText(traceSteps?: ExtractionTraceStep[]): string | undefined {
    try {
      const selection = window.getSelection()?.toString() || '';
      const result = selection.length > 0 ? selection : undefined;
      debugLog('debug', '[PageExtractor] Selected text capture', { hasSelection: !!result, length: selection.length });
      return result;
    } catch (err) {
      debugLog('warn', '[PageExtractor] Failed to get selected text', { error: err });
      return undefined;
    }
  }

  /**
   * Sanitize markdown: strip password/hidden/credential patterns (D-28).
   * Since @mozilla/readability already strips non-content markup,
   * this provides a secondary defense against sensitive data leakage.
   */
  private sanitizeMarkdown(markdown: string, traceSteps?: ExtractionTraceStep[], url?: string): string {
    const beforeLength = markdown.length;

    // Strip common credential patterns
    let sanitized = markdown
      // Password fields (value="...")
      .replace(/type\s*=\s*["']password["'][^>]*>/gi, '[password field removed]')
      // Hidden input values
      .replace(/type\s*=\s*["']hidden["'][^>]*>/gi, '[hidden field removed]');

    // Track how many lines are removed by credential filtering
    const lines = sanitized.split('\n');
    const beforeFilterCount = lines.length;
    const filtered = lines.filter((line) => {
      const lowered = line.toLowerCase();
      return !(
        lowered.includes('token=') ||
        lowered.includes('csrf') ||
        lowered.includes('apikey') ||
        lowered.includes('api_key') ||
        lowered.includes('secret=') ||
        lowered.includes('credential')
      );
    });
    const removedCount = beforeFilterCount - filtered.length;
    sanitized = filtered.join('\n');

    if (removedCount > 0) {
      debugLog('info', '[PageExtractor] Sanitization removed credential lines', { url, removedCount, beforeLength, afterLength: sanitized.length });
    } else {
      debugLog('debug', '[PageExtractor] Sanitization — no credential lines removed', { url, length: sanitized.length });
    }
    traceSteps?.push({ step: 'sanitize_credential_filter', status: 'ok', durationMs: 0, detail: `removed ${removedCount} lines, ${beforeLength}→${sanitized.length} chars`, url });

    return sanitized;
  }

  /**
   * URL blocklist check (D-26).
   * Rejects sensitive protocols and NowPilot-owned pages.
   */
  private isBlockedUrl(url: string, traceSteps?: ExtractionTraceStep[]): boolean {
    if (!url) {
      debugLog('debug', '[PageExtractor] URL blocklist: empty URL', { url });
      traceSteps?.push({ step: 'url_block_check', status: 'skip', durationMs: 0, detail: 'empty URL' });
      return true;
    }

    // Block sensitive protocols
    if (BLOCKED_PROTOCOLS.test(url)) {
      debugLog('debug', '[PageExtractor] URL blocklist: blocked protocol', { url });
      traceSteps?.push({ step: 'url_block_check', status: 'skip', durationMs: 0, detail: `blocked protocol: ${url.slice(0, 30)}...` });
      return true;
    }

    // Block NowPilot-owned pages
    try {
      const extId = chrome?.runtime?.id;
      if (extId && url.startsWith(`chrome-extension://${extId}`)) {
        debugLog('debug', '[PageExtractor] URL blocklist: own extension page', { url });
        traceSteps?.push({ step: 'url_block_check', status: 'skip', durationMs: 0, detail: 'own extension page' });
        return true;
      }
    } catch {
      // chrome.runtime not available (test environment) — skip
    }

    debugLog('debug', '[PageExtractor] URL blocklist: allowed', { url });
    traceSteps?.push({ step: 'url_block_check', status: 'ok', durationMs: 0, detail: 'allowed' });
    return false;
  }

  /**
   * Safely extract origin from document or URL string.
   */
  private tryGetOrigin(doc: Document, fallbackUrl: string): string {
    try {
      return doc.location?.origin || new URL(fallbackUrl).origin;
    } catch {
      return '';
    }
  }

  /**
   * Safely extract hostname from document or URL string.
   */
  private tryGetHostname(doc: Document, fallbackUrl: string): string {
    try {
      return doc.location?.hostname || new URL(fallbackUrl).hostname;
    } catch {
      return '';
    }
  }
}

/** Singleton export following the ContextCompressor pattern */
export const pageExtractor = new PageExtractor();
