/**
 * Tests for PageExtractor — Readability + turndown + DOM fallback extraction.
 *
 * Run: pnpm test -- PageExtractor
 *
 * Test behaviors (from PLAN.md Task 1):
 * 1. Readability article → extractionType='readability', extractionQuality='article'
 * 2. Non-article page → extractionType='visible-content', extractionQuality='generic'
 * 3. Readability throws → falls back to visible text, logs warning
 * 4. Markdown exceeds 100KB → truncates, extractionQuality='minimal'
 * 5. Meta tags (name, property, og:) → meta Record
 * 6. selectedText from window.getSelection()
 * 7. URL blocklist rejects sensitive protocols
 * 8. Password/hidden/credential fields stripped
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PageContext } from '../../../src/core/content/PageContext';

// We test the extraction logic via the PageExtractor module.
// The module imports @mozilla/readability and turndown.
// vitest/jsdom environment provides document/window globals.

// ---- Mock @mozilla/readability (vi.hoisted pattern per STATE.md convention) ----
const { mockReadabilityParse, mockIsProbablyReaderable } = vi.hoisted(() => ({
  mockReadabilityParse: vi.fn(),
  mockIsProbablyReaderable: vi.fn(),
}));

vi.mock('@mozilla/readability', () => {
  return {
    Readability: class {
      constructor(_doc: Document) {}
      parse() {
        return mockReadabilityParse();
      }
    },
    isProbablyReaderable: mockIsProbablyReaderable,
  };
});

// ---- Mock debugLog (vi.hoisted pattern) ----
const { mockDebugLog } = vi.hoisted(() => ({
  mockDebugLog: vi.fn(),
}));

vi.mock('../../../src/core/utils/debugLog', () => ({
  debugLog: mockDebugLog,
}));

import { PageExtractor, pageExtractor } from '../../../src/core/content/PageExtractor';

describe('PageExtractor', () => {
  let extractor: PageExtractor;

  beforeEach(() => {
    extractor = new PageExtractor();
    mockReadabilityParse.mockReset();
    mockIsProbablyReaderable.mockReset();
    mockDebugLog.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Test 1: Readability article extraction ----
  describe('readability article extraction', () => {
    it('returns extractionType=readability and extractionQuality=article for article pages', () => {
      mockIsProbablyReaderable.mockReturnValue(true);
      mockReadabilityParse.mockReturnValue({
        title: 'Test Article',
        content: '<h1>Hello</h1><p>World</p>',
        textContent: 'Hello World. This is a test article with sufficient content length to pass the readability threshold check.',
        excerpt: 'Test excerpt',
      });

      const dom = new DOMParser().parseFromString(
        `<html><head><title>Test Article</title></head><body><h1>Hello</h1><p>World</p></body></html>`,
        'text/html',
      );

      const result = extractor.extract(dom);

      expect(result.extractionType).toBe('readability');
      expect(result.extractionQuality).toBe('article');
      expect(result.url).toBe(dom.URL);
      expect(result.title).toBe('Test Article');
      expect(result.markdown).toBeTruthy();
    });
  });

  // ---- Test 2: Non-article fallback to visible text ----
  describe('visible-text fallback for non-article pages', () => {
    it('falls back to visible text when isProbablyReaderable returns false', () => {
      mockIsProbablyReaderable.mockReturnValue(false);

      const dom = new DOMParser().parseFromString(
        `<html><head><title>Dashboard</title></head><body><div>Metrics Panel</div><div>Revenue Charts</div><div>User Activity Trends</div><div>Recent Updates Overview</div></body></html>`,
        'text/html',
      );

      const result = extractor.extract(dom);

      expect(result.extractionType).toBe('visible-content');
      expect(result.extractionQuality).toBe('generic');
    });

    it('falls back to visible text when Readability content is too short (< 100 chars)', () => {
      mockIsProbablyReaderable.mockReturnValue(true);
      mockReadabilityParse.mockReturnValue({
        title: 'Short',
        content: '<p>Hi</p>',
        textContent: 'Hi',
        excerpt: '',
      });

      const dom = new DOMParser().parseFromString(
        `<html><head><title>Short</title></head><body><p>Hi there, this is some visible text fallback content that should be long enough to trigger generic quality</p></body></html>`,
        'text/html',
      );

      const result = extractor.extract(dom);

      expect(result.extractionType).toBe('visible-content');
      expect(result.extractionQuality).toBe('generic');
    });
  });

  // ---- Test 3: Readability throws → fallback ----
  describe('Readability error fallback', () => {
    it('falls back to visible text when Readability.parse throws', () => {
      mockIsProbablyReaderable.mockReturnValue(true);
      mockReadabilityParse.mockImplementation(() => {
        throw new Error('Readability parse failed');
      });

      const dom = new DOMParser().parseFromString(
        `<html><head><title>Error Page</title></head><body><div>Visible fallback content here with enough text to qualify as generic quality extraction from the DOM fallback path</div></body></html>`,
        'text/html',
      );

      const result = extractor.extract(dom);

      expect(result.extractionType).toBe('visible-content');
      expect(result.extractionQuality).toBe('generic');
      expect(mockDebugLog).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('Readability'),
        expect.any(Object),
      );
    });
  });

  // ---- Test 4: 100KB safety ceiling ----
  describe('100KB safety ceiling (D-07)', () => {
    it('truncates markdown exceeding ~100KB and sets extractionQuality=minimal', () => {
      mockIsProbablyReaderable.mockReturnValue(true);

      // Generate a large article content
      const largeParagraph = '<p>' + 'A'.repeat(500) + '</p>';
      const paragraphs = Array(300).fill(largeParagraph).join('\n');

      mockReadabilityParse.mockReturnValue({
        title: 'Large Article',
        content: paragraphs,
        textContent: 'A'.repeat(150000),
      });

      const dom = new DOMParser().parseFromString(
        `<html><head><title>Large</title></head><body>${paragraphs}</body></html>`,
        'text/html',
      );

      const result = extractor.extract(dom);

      expect(result.extractionQuality).toBe('minimal');
      // markdown should be truncated to under ~100KB (102400 bytes)
      expect(result.markdown).toBeTruthy();
      expect(result.markdown!.length).toBeLessThanOrEqual(110000); // generous upper bound
    });
  });

  // ---- Test 5: Meta tag extraction ----
  describe('meta tag extraction', () => {
    it('extracts meta[name] and meta[property] tags into meta Record', () => {
      mockIsProbablyReaderable.mockReturnValue(false);

      const dom = new DOMParser().parseFromString(
        `<html>
          <head>
            <title>Meta Page</title>
            <meta name="description" content="A test page" />
            <meta name="keywords" content="test, meta" />
            <meta property="og:title" content="Open Graph Title" />
            <meta property="og:description" content="OG Description" />
            <meta name="viewport" content="width=device-width" />
          </head>
          <body><p>Content</p></body>
        </html>`,
        'text/html',
      );

      const result = extractor.extract(dom);

      expect(result.meta).toBeDefined();
      expect(result.meta['description']).toBe('A test page');
      expect(result.meta['keywords']).toBe('test, meta');
      expect(result.meta['og:title']).toBe('Open Graph Title');
      expect(result.meta['og:description']).toBe('OG Description');
      expect(result.meta['viewport']).toBe('width=device-width');
    });
  });

  // ---- Test 6: Selected text capture ----
  describe('selectedText capture (D-08)', () => {
    it('captures selected text from window.getSelection()', () => {
      mockIsProbablyReaderable.mockReturnValue(false);

      // Mock window.getSelection
      const mockSelection = {
        toString: vi.fn().mockReturnValue('selected text range'),
        rangeCount: 1,
        removeAllRanges: vi.fn(),
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

      const dom = new DOMParser().parseFromString(
        `<html><head><title>Selection Test</title></head><body><p>Text</p></body></html>`,
        'text/html',
      );

      const result = extractor.extract(dom);

      expect(result.selectedText).toBe('selected text range');
    });

    it('returns undefined when no text is selected', () => {
      mockIsProbablyReaderable.mockReturnValue(false);

      const mockEmptySelection = {
        toString: vi.fn().mockReturnValue(''),
        rangeCount: 0,
        removeAllRanges: vi.fn(),
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockEmptySelection as any);

      const dom = new DOMParser().parseFromString(
        `<html><head><title>No Selection</title></head><body><p>Text</p></body></html>`,
        'text/html',
      );

      const result = extractor.extract(dom);

      expect(result.selectedText).toBeUndefined();
    });
  });

  // ---- Test 7: URL blocklist ----
  describe('URL blocklist (D-26)', () => {
    const blockedProtocols = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'view-source:', 'devtools://', 'file://'];

    it.each(blockedProtocols)('rejects %s protocol pages with metadata-only quality', (protocol) => {
      const url = `${protocol}some-page`;
      const dom = new DOMParser().parseFromString(
        `<html><head><title>Blocked</title></head><body><p>Secret</p></body></html>`,
        'text/html',
      );

      // Override the document URL via Object.defineProperty
      Object.defineProperty(dom, 'URL', { value: url, configurable: true });

      const result = extractor.extract(dom);

      expect(result.extractionType).toBe('metadata-only');
      expect(result.extractionQuality).toBe('minimal');
      expect(result.markdown).toBe('');
      expect(result.url).toBe(url);
    });

    it('rejects NowPilot-owned extension pages', () => {
      // chrome.runtime.id is not available in tests by default
      // We test the pattern matching logic
      const url = `chrome-extension://test-extension-id/sidepanel.html`;
      const dom = new DOMParser().parseFromString(
        `<html><head><title>NowPilot</title></head><body><p>Internal</p></body></html>`,
        'text/html',
      );
      Object.defineProperty(dom, 'URL', { value: url, configurable: true });

      // Mock chrome.runtime.id
      vi.stubGlobal('chrome', {
        runtime: { id: 'test-extension-id' },
      });

      const result = extractor.extract(dom);

      expect(result.extractionType).toBe('metadata-only');
      expect(result.extractionQuality).toBe('minimal');
    });
  });

  // ---- Test 8: Password/hidden field stripping (D-28) ----
  describe('field stripping (D-28)', () => {
    it('sanitizes password and hidden input fields', () => {
      mockIsProbablyReaderable.mockReturnValue(false);

      const dom = new DOMParser().parseFromString(
        `<html>
          <head><title>Login</title></head>
          <body>
            <p>Welcome</p>
            <input type="password" name="pass" value="secret123" />
            <input type="hidden" name="csrf" value="token-value" />
            <div class="credential-box">API key: abc123</div>
            <span id="token-display">Bearer xyz</span>
          </body>
        </html>`,
        'text/html',
      );

      const result = extractor.extract(dom);

      // Verify sanitization happened — markdown should not contain sensitive values
      if (result.markdown) {
        expect(result.markdown).not.toContain('secret123');
        expect(result.markdown).not.toContain('token-value');
      }
      // extraction should still succeed (not throw)
      expect(result.url).toBe(dom.URL);
      expect(result.title).toBe('Login');
    });
  });

  // ---- Edge Cases ----
  describe('edge cases', () => {
    it('always uses document.cloneNode(true) before Readability', () => {
      mockIsProbablyReaderable.mockReturnValue(true);
      mockReadabilityParse.mockReturnValue({
        title: 'Test',
        content: '<p>Content</p>',
        textContent: 'Test content with enough characters for the threshold check to pass.',
      });

      const dom = new DOMParser().parseFromString(
        `<html><head><title>Test</title></head><body><p>Original</p></body></html>`,
        'text/html',
      );

      // Spy on cloneNode
      const cloneSpy = vi.spyOn(dom, 'cloneNode');

      extractor.extract(dom);

      // Should have called cloneNode(true) on the document
      expect(cloneSpy).toHaveBeenCalledWith(true);
    });

    it('never throws from extract() — returns degraded PageContext on error', () => {
      mockIsProbablyReaderable.mockReturnValue(true);

      // Make Readability.parse throw (catastrophic failure)
      mockReadabilityParse.mockImplementation(() => {
        throw new Error('Catastrophic failure');
      });

      const dom = new DOMParser().parseFromString(
        `<html><head><title>Crash</title></head><body><p>Fallback content that is definitely long enough to trigger generic quality extraction</p></body></html>`,
        'text/html',
      );

      // Should not throw
      const result = extractor.extract(dom);

      expect(result).toBeDefined();
      expect(result.url).toBe(dom.URL);
      // Should fall back to visible text
      expect(result.extractionType).toBe('visible-content');
    });
  });

  // ---- Singleton export ----
  describe('singleton export', () => {
    it('exports pageExtractor as a singleton instance', () => {
      expect(pageExtractor).toBeInstanceOf(PageExtractor);
    });
  });
});
