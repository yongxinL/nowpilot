/**
 * PageContextBridge — serialization + chrome.runtime.sendMessage bridge.
 *
 * Wraps an extracted PageContext in a typed RuntimeEnvelope and sends it
 * to the Background Service Worker via chrome.runtime.sendMessage.
 *
 * ## Key invariants
 * - Send failures are logged but NOT re-thrown (extraction succeeds regardless)
 * - Uses PAGE_CONTEXT_UPDATED message type from pageMessages.ts
 * - Source is 'content-script' (added to MessageSource union in runtimeEnvelope.ts)
 *
 * Pattern: stateless messaging bridge (runtimeEnvelope.ts analog, D-02)
 */
import type { PageContext } from './PageContext';
import { PAGE_CONTEXT_UPDATED } from '../messaging/pageMessages';
import { debugLog } from '../utils/debugLog';

export class PageContextBridge {
  /**
   * Serialize PageContext and send to Background SW via chrome.runtime.sendMessage.
   * Does NOT throw on send failure — extraction succeeds regardless of messaging (D-02).
   */
  async sendPageContextUpdate(pageContext: PageContext): Promise<void> {
    const envelope = {
      type: PAGE_CONTEXT_UPDATED,
      source: 'content-script' as const,
      payload: pageContext,
      timestamp: Date.now(),
    };

    try {
      await chrome.runtime.sendMessage(envelope);
      debugLog('debug', '[PageContextBridge] Page context update sent', {
        url: pageContext.url,
        extractionType: pageContext.extractionType,
      });
    } catch (err) {
      debugLog('error', '[PageContextBridge] Failed to send page context update', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Do NOT throw — extraction succeeded, messaging is secondary
    }
  }
}
