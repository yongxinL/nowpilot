/**
 * Tests for PageContextBridge — serialization + chrome.runtime.sendMessage bridge.
 *
 * Tests:
 * 1. sendPageContextUpdate wraps PageContext in RuntimeEnvelope and calls chrome.runtime.sendMessage
 * 2. send failure logs error via debugLog but does not throw
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock chrome.runtime.sendMessage ----
const { mockSendMessage } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
}));

// ---- Mock debugLog ----
const { mockDebugLog } = vi.hoisted(() => ({
  mockDebugLog: vi.fn(),
}));

vi.mock('../../../src/core/utils/debugLog', () => ({
  debugLog: mockDebugLog,
}));

// Stub chrome global
vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
  },
});

import { PageContextBridge } from '../../../src/core/content/PageContextBridge';
import type { PageContext } from '../../../src/core/content/PageContext';
import { PAGE_CONTEXT_UPDATED } from '../../../src/core/messaging/pageMessages';

// Helper: valid PageContext fixture
function makePageContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com/article',
    origin: 'https://example.com',
    hostname: 'example.com',
    title: 'Test Article',
    markdown: '# Test\n\nContent.',
    meta: { description: 'A test article' },
    extractedAt: Date.now(),
    extractionType: 'readability',
    extractionQuality: 'article',
    ...overrides,
  };
}

describe('PageContextBridge', () => {
  let bridge: PageContextBridge;

  beforeEach(() => {
    bridge = new PageContextBridge();
    mockSendMessage.mockReset();
    mockDebugLog.mockReset();
    // Default: sendMessage succeeds
    mockSendMessage.mockResolvedValue(undefined);
  });

  // ---- Test 1: sendPageContextUpdate wraps in RuntimeEnvelope ----
  it('wraps PageContext in RuntimeEnvelope and sends via chrome.runtime.sendMessage', async () => {
    const ctx = makePageContext();

    await bridge.sendPageContextUpdate(ctx);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    const envelope = mockSendMessage.mock.calls[0][0];
    expect(envelope).toMatchObject({
      type: PAGE_CONTEXT_UPDATED,
      source: 'content-script',
      payload: expect.objectContaining({
        url: 'https://example.com/article',
        title: 'Test Article',
        markdown: '# Test\n\nContent.',
        extractionType: 'readability',
        extractionQuality: 'article',
      }),
    });
    // Verify timestamp is present and numeric
    expect(typeof envelope.timestamp).toBe('number');
  });

  it('includes all PageContext fields in the envelope payload', async () => {
    const ctx = makePageContext({
      selectedText: 'user selected this',
      extractionType: 'visible-content',
      extractionQuality: 'generic',
    });

    await bridge.sendPageContextUpdate(ctx);

    const envelope = mockSendMessage.mock.calls[0][0];
    expect(envelope.payload.selectedText).toBe('user selected this');
    expect(envelope.payload.extractionType).toBe('visible-content');
  });

  // ---- Test 2: send failure logs error but does not throw ----
  it('logs error on send failure but does not throw', async () => {
    mockSendMessage.mockRejectedValue(new Error('Extension context invalidated'));

    const ctx = makePageContext();

    // Should NOT throw
    await expect(bridge.sendPageContextUpdate(ctx)).resolves.toBeUndefined();

    // Should log error
    expect(mockDebugLog).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('[PageContextBridge]'),
      expect.any(Object),
    );
  });
});
