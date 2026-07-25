/**
 * OnDemandExtractor — reads a specific tab's PageContext even when that tab
 * was never focused, predates the extension's install/reload, or its
 * standing content script has otherwise gone quiet.
 *
 * ## Strategy
 * 1. Try the live path first (`GET_PAGE_CONTEXT_REQUEST` to the tab's
 *    already-running content script) — this covers the common case and
 *    needs no injection.
 * 2. On failure (`chrome.runtime.lastError` — no listener in that tab),
 *    re-inject the compiled content-script bundle via
 *    `chrome.scripting.executeScript`. The bundle self-extracts on load and
 *    pushes `PAGE_CONTEXT_UPDATED` (tab-keyed — see background.ts), so we
 *    wait on the workspace store rather than round-tripping a second
 *    message.
 * 3. Injection failures for genuinely restricted targets (chrome://, Chrome
 *    Web Store, PDF viewer, file:// without extra permission) are execution
 *    environment limits — swallow and return null, not a bug to work around.
 *
 * Requires the `scripting` permission + broad host_permissions (wxt.config.ts)
 * since `chrome.scripting.executeScript` on a tab outside a user gesture
 * needs its own host grant, not just the content_scripts `matches` pattern.
 */
import type { PageContext } from './PageContext';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { debugLog } from '../utils/debugLog';

const CONTENT_SCRIPT_BUNDLE = 'content-scripts/content.js';
const INJECTION_WAIT_TIMEOUT_MS = 3000;

export class OnDemandExtractor {
  async extractFromTab(tabId: number): Promise<PageContext | null> {
    const live = await this.tryLiveMessage(tabId);
    if (live) {
      return live;
    }

    const startedAt = Date.now();
    const injected = await this.tryInject(tabId);
    if (!injected) {
      return null;
    }

    return this.waitForCache(tabId, startedAt, INJECTION_WAIT_TIMEOUT_MS);
  }

  private tryLiveMessage(tabId: number): Promise<PageContext | null> {
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT_REQUEST' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          if (response && response.success && response.page) {
            resolve(response.page as PageContext);
          } else {
            resolve(null);
          }
        });
      } catch (err) {
        debugLog('debug', '[OnDemandExtractor] Live message failed', {
          tabId,
          error: err instanceof Error ? err.message : String(err),
        });
        resolve(null);
      }
    });
  }

  private async tryInject(tabId: number): Promise<boolean> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [CONTENT_SCRIPT_BUNDLE],
      });
      return true;
    } catch (err) {
      debugLog('debug', '[OnDemandExtractor] Injection failed (likely a restricted tab)', {
        tabId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /** Waits for the tab-keyed cache (background.ts's PAGE_CONTEXT_UPDATED handler) to update. */
  private waitForCache(tabId: number, startedAt: number, timeoutMs: number): Promise<PageContext | null> {
    const existing = useWorkspaceStore.getState().pageContextByTab[tabId];
    if (existing && existing.updatedAt >= startedAt) {
      return Promise.resolve(existing.page);
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (page: PageContext | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(page);
      };

      const timer = setTimeout(() => finish(null), timeoutMs);
      const unsubscribe = useWorkspaceStore.subscribe((state) => {
        const entry = state.pageContextByTab[tabId];
        if (entry && entry.updatedAt >= startedAt) {
          finish(entry.page);
        }
      });
    });
  }
}

export const onDemandExtractor = new OnDemandExtractor();
