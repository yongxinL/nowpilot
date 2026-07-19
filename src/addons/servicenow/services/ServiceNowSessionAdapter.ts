import { debugLog } from '../../../core/utils/debugLog';
import { cookieSessionStore, type CookieSession } from './CookieSessionStore';

export interface ServiceNowSession {
  jsessionId: string;
  sysparmCk: string;
  instanceUrl: string;
  expiresAt?: number;
  acquiredAt: number;
}

// Default TTL: 30 minutes if cookie has no explicit expiry (session cookie)
const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;

export class ServiceNowSessionAdapter {
  #cache = new Map<string, ServiceNowSession>();

  async acquireSession(instanceUrl: string, tabId?: number): Promise<ServiceNowSession | null> {
    // Check cache first
    const cached = this.#cache.get(instanceUrl);
    if (cached && this.#isSessionFresh(cached)) {
      return cached;
    }

    try {
      // Acquire JSESSIONID from cookies
      const cookieSession = await cookieSessionStore.getSession(instanceUrl);
      if (!cookieSession) {
        debugLog('warn', '[ServiceNowSessionAdapter] No JSESSIONID cookie found', { instanceUrl });
        return null;
      }

      // Acquire sysparmCK from MAIN-world bridge (window.g_ck)
      // Uses chrome.tabs.sendMessage to content script for MAIN-world value
      let sysparmCk = '';
      if (tabId != null) {
        sysparmCk = await this.#requestMainWorldValue(tabId, 'g_ck');
      }

      const session: ServiceNowSession = {
        jsessionId: cookieSession.jsessionId,
        sysparmCk,
        instanceUrl,
        expiresAt: cookieSession.expiresAt,
        acquiredAt: Date.now(),
      };

      this.#cache.set(instanceUrl, session);
      return session;
    } catch (err) {
      debugLog('error', '[ServiceNowSessionAdapter] acquireSession failed', { error: err, instanceUrl });
      return null;
    }
  }

  isSessionFresh(session: ServiceNowSession): boolean {
    return this.#isSessionFresh(session);
  }

  invalidateSession(instanceUrl: string): void {
    this.#cache.delete(instanceUrl);
  }

  #isSessionFresh(session: ServiceNowSession): boolean {
    if (session.expiresAt != null) {
      return (session.expiresAt * 1000) > Date.now();
    }
    // Session cookie with no explicit expiry — use acquire time + default TTL
    return (session.acquiredAt + DEFAULT_SESSION_TTL_MS) > Date.now();
  }

  async #requestMainWorldValue(tabId: number, key: string): Promise<string> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'GET_MAIN_WORLD_VALUE',
        key,
      });
      return response?.value ?? '';
    } catch {
      debugLog('warn', '[ServiceNowSessionAdapter] MAIN world bridge unavailable', { tabId, key });
      return '';
    }
  }
}

export const serviceNowSessionAdapter = new ServiceNowSessionAdapter();
