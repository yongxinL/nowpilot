/**
 * PageContextBridge — dual-channel serialization bridge.
 *
 * Primary channel: chrome.storage.session (always available in ISOLATED
 * content scripts, survive SW restarts).
 * Secondary channel: chrome.runtime.sendMessage (fast path, SW must be
 * active — failures are silently swallowed).
 *
 * Background SW picks up page context updates from BOTH channels:
 *   - chrome.storage.onChanged('session') primary watcher
 *   - chrome.runtime.onMessage PAGE_CONTEXT_UPDATED handler (fast path)
 */
import type { PageContext } from './PageContext';
import { PAGE_CONTEXT_UPDATED } from '../messaging/pageMessages';
import { debugLog } from '../utils/debugLog';

/** chrome.storage.session key for active page context */
const SESSION_KEY = 'np_pc_active';

export class PageContextBridge {
  async sendPageContextUpdate(pageContext: PageContext): Promise<void> {
    const payload = {
      pageContext,
      timestamp: Date.now(),
    };

    // Primary: write to chrome.storage.session (reliable, cross-context)
    try {
      await chrome.storage.session.set({ [SESSION_KEY]: payload });
      debugLog('debug', '[PageContextBridge] Page context written to session storage', {
        url: pageContext.url,
        extractionType: pageContext.extractionType,
      });
    } catch (storageErr) {
      debugLog('warn', '[PageContextBridge] Failed to write page context to session storage', {
        url: pageContext.url,
        markdownLength: pageContext.markdown?.length,
      });
    }

    // Secondary (fast path): send via runtime message to wake SW immediately
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await chrome.runtime.sendMessage({
          type: PAGE_CONTEXT_UPDATED,
          source: 'content-script' as const,
          payload: pageContext,
          timestamp: Date.now(),
        });
        return;
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }
  }
}
