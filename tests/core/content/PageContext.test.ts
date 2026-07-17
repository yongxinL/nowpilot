/**
 * Type-level assertions and schema validation tests for PageContext, TabContext, and pageMessages.
 *
 * Tests:
 * - PageContext interface structural conformance
 * - pageContextPayloadSchema accepts valid and rejects invalid payloads
 * - TabContext shape includes all required fields
 * - extractionType enum validation
 */
import { describe, it, expect } from 'vitest';
import { pageContextPayloadSchema, getPageContextRequestSchema, GET_PAGE_CONTEXT_REQUEST } from '../../../src/core/messaging/pageMessages';
import type { PageContext, TabContext } from '../../../src/core/content/PageContext';

// Helper: valid PageContext fixture
function makeValidPageContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com/article',
    origin: 'https://example.com',
    hostname: 'example.com',
    title: 'Test Article',
    markdown: '# Test Article\n\nSome content.',
    meta: { description: 'A test article' },
    extractedAt: Date.now(),
    extractionType: 'readability',
    extractionQuality: 'article',
    ...overrides,
  };
}

describe('PageContext interface', () => {
  it('accepts a valid PageContext object with all required fields', () => {
    const ctx: PageContext = makeValidPageContext();
    expect(ctx.url).toBe('https://example.com/article');
    expect(ctx.origin).toBe('https://example.com');
    expect(ctx.hostname).toBe('example.com');
    expect(ctx.title).toBe('Test Article');
    expect(ctx.markdown).toBe('# Test Article\n\nSome content.');
    expect(ctx.meta).toEqual({ description: 'A test article' });
    expect(typeof ctx.extractedAt).toBe('number');
    expect(ctx.extractionType).toBe('readability');
    expect(ctx.extractionQuality).toBe('article');
  });

  it('allows optional fields to be undefined', () => {
    const ctx: PageContext = makeValidPageContext();
    expect(ctx.html).toBeUndefined();
    expect(ctx.selectedText).toBeUndefined();
    expect(ctx.addonId).toBeUndefined();
    expect(ctx.addonFields).toBeUndefined();
  });

  it('accepts all extractionType union values', () => {
    const types: Array<PageContext['extractionType']> = ['readability', 'visible-content', 'metadata-only'];
    for (const t of types) {
      const ctx = makeValidPageContext({ extractionType: t });
      expect(ctx.extractionType).toBe(t);
    }
  });

  it('accepts all extractionQuality union values', () => {
    const qualities: Array<PageContext['extractionQuality']> = ['article', 'generic', 'minimal'];
    for (const q of qualities) {
      const ctx = makeValidPageContext({ extractionQuality: q });
      expect(ctx.extractionQuality).toBe(q);
    }
  });

  it('accepts selectedText and addonId as optional fields', () => {
    const ctx = makeValidPageContext({
      selectedText: 'highlighted text',
      addonId: 'servicenow',
      addonFields: { incidentId: 'INC001' },
    });
    expect(ctx.selectedText).toBe('highlighted text');
    expect(ctx.addonId).toBe('servicenow');
    expect(ctx.addonFields).toEqual({ incidentId: 'INC001' });
  });

  it('accepts html field when provided', () => {
    const ctx = makeValidPageContext({ html: '<article><h1>Test</h1></article>' });
    expect(ctx.html).toBe('<article><h1>Test</h1></article>');
  });
});

describe('TabContext interface', () => {
  it('includes all required fields with valid PageContext', () => {
    const pageCtx = makeValidPageContext();
    const tab: TabContext = {
      tabId: 42,
      windowId: 1,
      page: pageCtx,
    };
    expect(tab.tabId).toBe(42);
    expect(tab.windowId).toBe(1);
    expect(tab.page.url).toBe('https://example.com/article');
  });

  it('includes optional pinnedAt, url, title fields', () => {
    const tab: TabContext = {
      tabId: 42,
      windowId: 1,
      page: makeValidPageContext(),
      pinnedAt: Date.now(),
      active: true,
      url: 'https://example.com/article',
      title: 'Test Article',
    };
    expect(typeof tab.pinnedAt).toBe('number');
    expect(tab.active).toBe(true);
    expect(tab.url).toBe('https://example.com/article');
    expect(tab.title).toBe('Test Article');
  });

  it('active defaults to undefined (inactive/closed pin per D-13)', () => {
    const tab: TabContext = {
      tabId: 42,
      windowId: 1,
      page: makeValidPageContext(),
    };
    expect(tab.active).toBeUndefined();
  });
});

describe('pageContextPayloadSchema', () => {
  it('accepts a valid PageContext payload', () => {
    const valid = {
      url: 'https://example.com',
      origin: 'https://example.com',
      hostname: 'example.com',
      title: 'Example',
      markdown: '# Hello',
      meta: { description: 'test' },
      extractedAt: 1700000000000,
      extractionType: 'readability',
      extractionQuality: 'article',
    };
    const result = pageContextPayloadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts a payload with optional fields', () => {
    const valid = {
      url: 'https://example.com',
      origin: 'https://example.com',
      hostname: 'example.com',
      title: 'Example',
      markdown: '# Hello',
      meta: { description: 'test' },
      extractedAt: 1700000000000,
      extractionType: 'metadata-only',
      extractionQuality: 'minimal',
      selectedText: 'some selection',
      addonId: 'test-addon',
      html: '<div>raw</div>',
    };
    const result = pageContextPayloadSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectedText).toBe('some selection');
      expect(result.data.addonId).toBe('test-addon');
    }
  });

  it('rejects payload missing required url field', () => {
    const invalid = {
      origin: 'https://example.com',
      hostname: 'example.com',
      title: 'Example',
      meta: {},
      extractedAt: 1700000000000,
      extractionType: 'readability',
      extractionQuality: 'article',
    };
    const result = pageContextPayloadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects payload missing required title field', () => {
    const invalid = {
      url: 'https://example.com',
      origin: 'https://example.com',
      hostname: 'example.com',
      title: undefined,
      meta: {},
      extractedAt: 1700000000000,
      extractionType: 'readability',
      extractionQuality: 'article',
    };
    const result = pageContextPayloadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid extractionType values', () => {
    const invalid = {
      url: 'https://example.com',
      origin: 'https://example.com',
      hostname: 'example.com',
      title: 'Example',
      meta: {},
      extractedAt: 1700000000000,
      extractionType: 'invalid-type',
      extractionQuality: 'article',
    };
    const result = pageContextPayloadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid extractionQuality values', () => {
    const invalid = {
      url: 'https://example.com',
      origin: 'https://example.com',
      hostname: 'example.com',
      title: 'Example',
      meta: {},
      extractedAt: 1700000000000,
      extractionType: 'readability',
      extractionQuality: 'invalid-quality',
    };
    const result = pageContextPayloadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('getPageContextRequestSchema', () => {
  it('accepts a valid request with timestamp', () => {
    const result = getPageContextRequestSchema.safeParse({
      type: GET_PAGE_CONTEXT_REQUEST,
      timestamp: 1700000000000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid request without timestamp', () => {
    const result = getPageContextRequestSchema.safeParse({
      type: GET_PAGE_CONTEXT_REQUEST,
    });
    expect(result.success).toBe(true);
  });

  it('rejects wrong type value', () => {
    const result = getPageContextRequestSchema.safeParse({
      type: 'WRONG_TYPE',
    });
    expect(result.success).toBe(false);
  });
});
