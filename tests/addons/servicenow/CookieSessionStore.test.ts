import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome.cookies
const mockCookiesGet = vi.hoisted(() => vi.fn());

vi.stubGlobal('chrome', {
  ...((globalThis as any).chrome ?? {}),
  cookies: {
    get: mockCookiesGet,
  },
});

// Mock debugLog
const mockDebugLog = vi.hoisted(() => vi.fn());

vi.mock('../../../src/core/utils/debugLog', () => ({
  debugLog: mockDebugLog,
}));

import { CookieSessionStore } from '../../../src/addons/servicenow/services/CookieSessionStore';
import type { CookieSession } from '../../../src/addons/servicenow/services/CookieSessionStore';

describe('CookieSessionStore', () => {
  let store: CookieSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new CookieSessionStore();
  });

  it('getSession calls chrome.cookies.get with correct params', async () => {
    mockCookiesGet.mockResolvedValue({
      name: 'JSESSIONID',
      value: 'jsession123',
      domain: '.service-now.com',
      path: '/',
      session: false,
      expirationDate: 1_700_000_000,
      secure: true,
      httpOnly: true,
    });

    const result = await store.getSession('https://acme.service-now.com');

    expect(mockCookiesGet).toHaveBeenCalledWith({
      url: 'https://acme.service-now.com',
      name: 'JSESSIONID',
    });
    expect(result).not.toBeNull();
  });

  it('getSession returns CookieSession with jsessionId when cookie found', async () => {
    mockCookiesGet.mockResolvedValue({
      name: 'JSESSIONID',
      value: 'jsession123',
      domain: '.service-now.com',
      path: '/',
      session: false,
      expirationDate: 1_700_000_000,
      secure: true,
      httpOnly: true,
    });

    const result = await store.getSession('https://acme.service-now.com');

    expect(result).not.toBeNull();
    expect(result!.jsessionId).toBe('jsession123');
    expect(result!.domain).toBe('.service-now.com');
    expect(result!.session).toBe(false);
    expect(result!.expiresAt).toBe(1_700_000_000);
    expect(result!.secure).toBe(true);
    expect(result!.httpOnly).toBe(true);
  });

  it('getSession returns null when cookie not found (no error thrown)', async () => {
    mockCookiesGet.mockResolvedValue(null);

    const result = await store.getSession('https://acme.service-now.com');

    expect(result).toBeNull();
  });

  it('getSession handles chrome.cookies API errors gracefully (returns null)', async () => {
    mockCookiesGet.mockRejectedValue(new Error('chrome.cookies API error'));

    const result = await store.getSession('https://acme.service-now.com');

    expect(result).toBeNull();
    expect(mockDebugLog).toHaveBeenCalledWith('error', '[CookieSessionStore] getSession failed', expect.any(Object));
  });
});
