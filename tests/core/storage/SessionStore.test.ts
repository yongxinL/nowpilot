import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSessionStore } from '../../../src/core/storage/SessionStore';

describe('SessionStore', () => {
  beforeEach(() => {
    // Clear chrome.storage.session mock
    const sessionMap = (globalThis as any).__chromeSessionMap;
    if (sessionMap) sessionMap.clear();

    // Clear chrome.storage.local mock
    const localMap = (globalThis as any).__chromeStorageMap;
    if (localMap) localMap.clear();

    // Mock getToken to return null until state is hydrated
    vi.clearAllMocks();

    // Reset store state by clearing tokens
    useSessionStore.getState().clearTokens();
  });

  describe('setToken', () => {
    it('should store token in chrome.storage.session', async () => {
      useSessionStore.getState().setToken('jsessionid', 'abc123');

      // Wait for persist to flush
      await vi.waitFor(() => {
        const sessionMap = (globalThis as any).__chromeSessionMap;
        const storedRaw = sessionMap.get('np_session');
        expect(storedRaw).toBeDefined();
      });

      const sessionMap = (globalThis as any).__chromeSessionMap;
      const storedRaw = sessionMap.get('np_session');
      const parsed = JSON.parse(storedRaw);
      expect(parsed.state.tokens.jsessionid).toBe('abc123');
    });

    it('should NOT store session tokens in chrome.storage.local', async () => {
      useSessionStore.getState().setToken('jsessionid', 'abc123');

      // Wait a tick for persist to flush, then verify it's NOT in local storage
      await vi.waitFor(() => {
        const sessionMap = (globalThis as any).__chromeSessionMap;
        expect(sessionMap.has('np_session')).toBe(true);
      });

      const localMap = (globalThis as any).__chromeStorageMap;
      expect(localMap.has('np_session')).toBe(false);
    });

    it('should store multiple tokens', async () => {
      useSessionStore.getState().setToken('token-a', 'value-a');
      useSessionStore.getState().setToken('token-b', 'value-b');

      await vi.waitFor(() => {
        const sessionMap = (globalThis as any).__chromeSessionMap;
        const storedRaw = sessionMap.get('np_session');
        expect(storedRaw).toBeDefined();
      });

      expect(useSessionStore.getState().getToken('token-a')).toBe('value-a');
      expect(useSessionStore.getState().getToken('token-b')).toBe('value-b');
    });
  });

  describe('getToken', () => {
    it('should return the stored token value', () => {
      useSessionStore.getState().setToken('jsessionid', 'abc123');
      expect(useSessionStore.getState().getToken('jsessionid')).toBe('abc123');
    });

    it('should return null for a missing token', () => {
      expect(useSessionStore.getState().getToken('nonexistent')).toBeNull();
    });

    it('should return null after token is removed', () => {
      useSessionStore.getState().setToken('temp-token', 'temp-value');
      expect(useSessionStore.getState().getToken('temp-token')).toBe('temp-value');
      useSessionStore.getState().removeToken('temp-token');
      expect(useSessionStore.getState().getToken('temp-token')).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('should remove all tokens from session storage', () => {
      useSessionStore.getState().setToken('token-1', 'value-1');
      useSessionStore.getState().setToken('token-2', 'value-2');
      expect(useSessionStore.getState().getToken('token-1')).toBe('value-1');
      expect(useSessionStore.getState().getToken('token-2')).toBe('value-2');

      useSessionStore.getState().clearTokens();
      expect(useSessionStore.getState().getToken('token-1')).toBeNull();
      expect(useSessionStore.getState().getToken('token-2')).toBeNull();
    });
  });

  describe('storage isolation (STORAGE-02)', () => {
    it('session tokens should ONLY be in chrome.storage.session, never in chrome.storage.local', async () => {
      useSessionStore.getState().setToken('secret-token', 'supersecret123');

      await vi.waitFor(() => {
        const sessionMap = (globalThis as any).__chromeSessionMap;
        expect(sessionMap.has('np_session')).toBe(true);
      });

      const localMap = (globalThis as any).__chromeStorageMap;
      expect(localMap.has('np_session')).toBe(false);
    });
  });
});
