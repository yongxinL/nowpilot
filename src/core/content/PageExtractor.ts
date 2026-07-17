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
   */
  extract(doc: Document): PageContext {
    const url = doc.URL;
    const meta = this.extractMeta(doc);
    const selectedText = this.getSelectedText();

    // URL blocklist check (D-26)
    if (this.isBlockedUrl(url)) {
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

    const { markdown, extractionType, extractionQuality } = this.extractContent(doc);

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
  private extractContent(doc: Document): {
    markdown?: string;
    extractionType: PageContext['extractionType'];
    extractionQuality: PageContext['extractionQuality'];
  } {
    try {
      if (isProbablyReaderable(doc)) {
        // Pitfall 1: ALWAYS clone before Readability (mutates DOM)
        const clone = doc.cloneNode(true) as Document;
        const article = new Readability(clone).parse();

        if (article?.content && (article.textContent?.length ?? 0) >= 100) {
          const rawMarkdown = this.turndown.turndown(article.content);

          // D-07: Safety ceiling
          if (rawMarkdown.length > MAX_SAFE_MARKDOWN) {
            debugLog('warn', '[PageExtractor] Markdown exceeds safety ceiling, truncating', {
              url: doc.URL,
              size: rawMarkdown.length,
            });
            return {
              markdown: rawMarkdown.slice(0, MAX_SAFE_MARKDOWN) + '\n\n[Content truncated — exceeds safety limit]',
              extractionType: 'readability',
              extractionQuality: 'minimal',
            };
          }

          return {
            markdown: this.sanitizeMarkdown(rawMarkdown),
            extractionType: 'readability',
            extractionQuality: 'article',
          };
        }
      }
    } catch (err) {
      debugLog('warn', '[PageExtractor] Readability extraction failed, falling back to visible text', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Fallback: extract visible text from body (D-06)
    return this.extractVisibleText(doc);
  }

  /**
   * Fallback extraction: visible DOM text.
   * Uses body.innerText with safety cap.
   */
  private extractVisibleText(doc: Document): {
    markdown?: string;
    extractionType: PageContext['extractionType'];
    extractionQuality: PageContext['extractionQuality'];
  } {
    const bodyText = doc.body?.textContent?.slice(0, MAX_SAFE_MARKDOWN) || '';

    if (bodyText.length > 50) {
      return {
        markdown: bodyText,
        extractionType: 'visible-content',
        extractionQuality: 'generic',
      };
    }

    return {
      markdown: bodyText || undefined,
      extractionType: 'visible-content',
      extractionQuality: 'minimal',
    };
  }

  /**
   * Extract meta tags (name, property, og:).
   */
  private extractMeta(doc: Document): Record<string, string> {
    const meta: Record<string, string> = {};
    doc.querySelectorAll('meta[name], meta[property]').forEach((el) => {
      const name = el.getAttribute('name') || el.getAttribute('property');
      const content = el.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });
    return meta;
  }

  /**
   * Capture selected text from window.getSelection() (D-08).
   * Empty string → undefined.
   */
  private getSelectedText(): string | undefined {
    try {
      const selection = window.getSelection()?.toString() || '';
      return selection.length > 0 ? selection : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Sanitize markdown: strip password/hidden/credential patterns (D-28).
   * Since @mozilla/readability already strips non-content markup,
   * this provides a secondary defense against sensitive data leakage.
   */
  private sanitizeMarkdown(markdown: string): string {
    // Strip common credential patterns
    let sanitized = markdown
      // Password fields (value="...")
      .replace(/type\s*=\s*["']password["'][^>]*>/gi, '[password field removed]')
      // Hidden input values
      .replace(/type\s*=\s*["']hidden["'][^>]*>/gi, '[hidden field removed]');

    // Strip lines containing token/credential/secret/auth patterns
    sanitized = sanitized
      .split('\n')
      .filter((line) => {
        const lowered = line.toLowerCase();
        return !(
          lowered.includes('token=') ||
          lowered.includes('csrf') ||
          lowered.includes('apikey') ||
          lowered.includes('api_key') ||
          lowered.includes('secret=') ||
          lowered.includes('credential')
        );
      })
      .join('\n');

    return sanitized;
  }

  /**
   * URL blocklist check (D-26).
   * Rejects sensitive protocols and NowPilot-owned pages.
   */
  private isBlockedUrl(url: string): boolean {
    if (!url) return true;

    // Block sensitive protocols
    if (BLOCKED_PROTOCOLS.test(url)) return true;

    // Block NowPilot-owned pages
    try {
      const extId = chrome?.runtime?.id;
      if (extId && url.startsWith(`chrome-extension://${extId}`)) {
        return true;
      }
    } catch {
      // chrome.runtime not available (test environment) — skip
    }

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
