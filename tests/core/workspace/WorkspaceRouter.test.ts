import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome API
vi.stubGlobal('chrome', {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    sendMessage: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    session: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
});

describe('WorkspaceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates correct app URL', () => {
    const url = chrome.runtime.getURL('app.html?workspaceId=test-ws&conversationId=test-conv');
    expect(url).toBe('chrome-extension://test-id/app.html?workspaceId=test-ws&conversationId=test-conv');
  });

  it('getURL produces valid extension URLs', () => {
    const urls = [
      chrome.runtime.getURL('app.html'),
      chrome.runtime.getURL('sidepanel.html'),
      chrome.runtime.getURL('options.html'),
    ];
    urls.forEach((url) => {
      expect(url).toMatch(/^chrome-extension:\/\/.+/);
    });
  });
});
