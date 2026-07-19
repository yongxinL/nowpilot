import { debugLog } from '../../../core/utils/debugLog';

export interface CookieSession {
  jsessionId: string;
  domain: string;
  session: boolean;
  expiresAt?: number;
  secure: boolean;
  httpOnly: boolean;
}

export class CookieSessionStore {
  async getSession(instanceUrl: string): Promise<CookieSession | null> {
    try {
      const cookie = await chrome.cookies.get({
        url: instanceUrl,
        name: 'JSESSIONID',
      });
      if (!cookie) return null;
      return {
        jsessionId: cookie.value,
        domain: cookie.domain,
        session: cookie.session,
        expiresAt: cookie.expirationDate,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
      };
    } catch (err) {
      debugLog('error', '[CookieSessionStore] getSession failed', { error: err });
      return null;
    }
  }
}

export const cookieSessionStore = new CookieSessionStore();
