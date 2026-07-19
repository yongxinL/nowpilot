import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome.tabs.sendMessage
const mockTabsSendMessage = vi.hoisted(() => vi.fn());

vi.stubGlobal('chrome', {
  ...((globalThis as any).chrome ?? {}),
  tabs: {
    sendMessage: mockTabsSendMessage,
  },
});

// Mock debugLog
const mockDebugLog = vi.hoisted(() => vi.fn());

vi.mock('../../../src/core/utils/debugLog', () => ({
  debugLog: mockDebugLog,
}));

// Mock CookieSessionStore
const mockCookieSessionStoreGetSession = vi.hoisted(() => vi.fn());

vi.mock('../../../src/addons/servicenow/services/CookieSessionStore', () => ({
  cookieSessionStore: {
    getSession: mockCookieSessionStoreGetSession,
  },
}));

import { ServiceNowSessionAdapter } from '../../../src/addons/servicenow/services/ServiceNowSessionAdapter';
import type { ServiceNowSession } from '../../../src/addons/servicenow/services/ServiceNowSessionAdapter';

describe('ServiceNowSessionAdapter', () => {
  let adapter: ServiceNowSessionAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ServiceNowSessionAdapter();
  });

  it('acquireSession composes JSESSIONID from CookieSessionStore + sysparmCK from main world bridge', async () => {
    mockCookieSessionStoreGetSession.mockResolvedValue({
      jsessionId: 'jsession123',
      domain: '.service-now.com',
      session: false,
      expiresAt: 1_700_000_000,
      secure: true,
      httpOnly: true,
    });
    mockTabsSendMessage.mockResolvedValue({ value: 'sysparmCkValue' });

    const session = await adapter.acquireSession('https://acme.service-now.com', 42);

    expect(session).not.toBeNull();
    expect(session!.jsessionId).toBe('jsession123');
    expect(session!.sysparmCk).toBe('sysparmCkValue');
    expect(session!.instanceUrl).toBe('https://acme.service-now.com');
    expect(mockCookieSessionStoreGetSession).toHaveBeenCalledWith('https://acme.service-now.com');
    expect(mockTabsSendMessage).toHaveBeenCalledWith(42, { type: 'GET_MAIN_WORLD_VALUE', key: 'g_ck' });
  });

  it('acquireSession returns ServiceNowSession with jsessionId, sysparmCk, instanceUrl, expiresAt, acquiredAt', async () => {
    mockCookieSessionStoreGetSession.mockResolvedValue({
      jsessionId: 'jsession456',
      domain: '.service-now.com',
      session: false,
      expiresAt: 1_700_000_000,
      secure: true,
      httpOnly: true,
    });
    mockTabsSendMessage.mockResolvedValue({ value: 'sysparmCk456' });

    const session = await adapter.acquireSession('https://test.service-now.com', 42);

    expect(session).not.toBeNull();
    expect(session!.jsessionId).toBe('jsession456');
    expect(session!.sysparmCk).toBe('sysparmCk456');
    expect(session!.instanceUrl).toBe('https://test.service-now.com');
    expect(session!.expiresAt).toBe(1_700_000_000);
    expect(session!.acquiredAt).toBeGreaterThan(0);
  });

  it('isSessionFresh returns true for non-expired session', async () => {
    const session: ServiceNowSession = {
      jsessionId: 'jsession123',
      sysparmCk: 'ck123',
      instanceUrl: 'https://acme.service-now.com',
      expiresAt: Date.now() / 1000 + 3600, // 1 hour in the future
      acquiredAt: Date.now(),
    };

    const fresh = adapter.isSessionFresh(session);

    expect(fresh).toBe(true);
  });

  it('isSessionFresh returns false for expired session', async () => {
    const session: ServiceNowSession = {
      jsessionId: 'jsession123',
      sysparmCk: 'ck123',
      instanceUrl: 'https://acme.service-now.com',
      expiresAt: Date.now() / 1000 - 3600, // 1 hour in the past
      acquiredAt: Date.now(),
    };

    const fresh = adapter.isSessionFresh(session);

    expect(fresh).toBe(false);
  });

  it('acquireSession with expired session triggers re-extraction', async () => {
    // Use fake timers to control time
    vi.useFakeTimers();

    // First call: session cookie with no explicit expiry (session cookie)
    // DEFAULT_SESSION_TTL_MS = 30 min
    mockCookieSessionStoreGetSession.mockResolvedValue({
      jsessionId: 'jsession123',
      domain: '.service-now.com',
      session: true,
      // No expiresAt — treated as session cookie, uses DEFAULT_SESSION_TTL_MS
      secure: true,
      httpOnly: true,
    });
    mockTabsSendMessage.mockResolvedValue({ value: 'ckOld' });

    const session1 = await adapter.acquireSession('https://acme.service-now.com', 42);
    expect(session1!.jsessionId).toBe('jsession123');

    // Advance time past the 30 min DEFAULT_SESSION_TTL_MS
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);

    // Second call: stale cache → triggers re-extraction
    mockCookieSessionStoreGetSession.mockResolvedValue({
      jsessionId: 'jsessionNew',
      domain: '.service-now.com',
      session: true,
      secure: true,
      httpOnly: true,
    });
    mockTabsSendMessage.mockResolvedValue({ value: 'ckNew' });

    const session2 = await adapter.acquireSession('https://acme.service-now.com', 42);

    expect(session2!.jsessionId).toBe('jsessionNew');
    expect(session2!.sysparmCk).toBe('ckNew');
    expect(mockCookieSessionStoreGetSession).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('acquireSession with valid cached session returns cached (no re-extraction)', async () => {
    // Mock a fresh session
    const futureExpiry = Date.now() / 1000 + 3600;
    mockCookieSessionStoreGetSession.mockResolvedValue({
      jsessionId: 'jsession123',
      domain: '.service-now.com',
      session: false,
      expiresAt: futureExpiry,
      secure: true,
      httpOnly: true,
    });
    mockTabsSendMessage.mockResolvedValue({ value: 'ck123' });

    // First call: acquires from source
    const session1 = await adapter.acquireSession('https://acme.service-now.com', 42);

    // Second call: should return cached (same mock, but we want to verify no re-extraction)
    const session2 = await adapter.acquireSession('https://acme.service-now.com', 42);

    expect(session2!.jsessionId).toBe('jsession123');
    expect(session2!.sysparmCk).toBe('ck123');
    // CookieSessionStore.getSession should only have been called once (first time only)
    expect(mockCookieSessionStoreGetSession).toHaveBeenCalledTimes(1);
  });

  it('acquireSession returns null when no JSESSIONID cookie found', async () => {
    mockCookieSessionStoreGetSession.mockResolvedValue(null);

    const session = await adapter.acquireSession('https://acme.service-now.com', 42);

    expect(session).toBeNull();
  });
});
