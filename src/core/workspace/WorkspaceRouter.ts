// src/core/workspace/WorkspaceRouter.ts — Source: Appendix M.2 (lines 5926-5959) +
// RESEARCH Pattern 3 (crbug 1478648, lines 304-317). Surface routing with the
// Pitfall 1 guard: chrome.sidePanel is opened inside a CALLBACK-STYLE
// chrome.tabs.query chain — never awaited, never split across an async boundary
// (Chrome 127+ drops the user-gesture flag when any await precedes open()).
// openStandalone follows the Flow 11 / M.2 update-or-create tab dedupe (W-12:
// NEVER a second standalone surface) and records the opened tab id on the store.
// Every failure path calls debugLog with a canonical §C.2 code
// (TABS_QUERY / CONNECT_FAILED / WORKSPACE_ROUTER) and never throws (Golden Rule 9).
//
// The raw `chrome` global is used (callback-typed by @types/chrome) rather than the
// wxt/browser polyfill — the polyfill is promise-only, and callback-style
// tabs.query → side panel opening is exactly what preserves the user gesture. In tests
// the global chrome is the wxt fakeBrowser (WxtVitest extensionApiMock).
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';

const standaloneUrl = (): string => chrome.runtime.getURL('standalone.html');

export const WorkspaceRouter = {
  /**
   * Open the side panel from a user gesture. Callback-style tabs.query keeps the
   * gesture flag alive into the side panel open call (Pitfall 1 / crbug 1478648):
   * no await between the gesture and the open, and the chain never detaches into
   * a promise.
   */
  async openSidePanel(triggerTabId?: number): Promise<void> {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        try {
          const tab = tabs[0];
          // side panel open takes EITHER tabId OR windowId (OpenOptions is a
          // discriminated union — passing both throws), so build the options here.
          const options: chrome.sidePanel.OpenOptions | null =
            tab?.id !== undefined
              ? { tabId: tab.id }
              : triggerTabId !== undefined
                ? { tabId: triggerTabId }
                : tab?.windowId !== undefined
                  ? { windowId: tab.windowId }
                  : null;
          if (options !== null) {
            void chrome.sidePanel.open(options);
          } else {
            debugLog(ERROR_CODES.TABS_QUERY, 'openSidePanel: no resolvable tab or window', {
              module: 'WorkspaceRouter',
            });
          }
        } catch (err) {
          debugLog(ERROR_CODES.SIDEPANEL_BEHAVIOR, 'openSidePanel: side panel open failed', {
            error: err instanceof Error ? err : undefined,
            module: 'WorkspaceRouter',
          });
        }
      });
    } catch (err) {
      debugLog(ERROR_CODES.TABS_QUERY, 'openSidePanel: tabs.query failed', {
        error: err instanceof Error ? err : undefined,
        module: 'WorkspaceRouter',
      });
    }
  },

  /**
   * Open (or focus) the standalone surface — Flow 11 / M.2. Dedupe via
   * update-or-create: when a standalone tab already exists it is activated and its
   * window focused (W-12: never a second standalone surface, no popup window).
   * The opened tab id is recorded on the store (WORKSPACE_ROUTER on error).
   */
  async openStandalone(): Promise<void> {
    try {
      chrome.tabs.query({ url: standaloneUrl() + '*' }, (tabs) => {
        try {
          const existing = tabs[0];
          if (existing?.id !== undefined) {
            void chrome.tabs.update(existing.id, { active: true });
            if (existing.windowId !== undefined) {
              void chrome.windows.update(existing.windowId, { focused: true });
            }
            useWorkspaceStore.getState().setOpenedStandaloneTabId(existing.id);
          } else {
            void chrome.tabs
              .create({ url: standaloneUrl() })
              .then((tab) => {
                if (tab?.id !== undefined) {
                  useWorkspaceStore.getState().setOpenedStandaloneTabId(tab.id);
                }
              })
              .catch((err: unknown) => {
                debugLog(ERROR_CODES.CONNECT_FAILED, 'openStandalone: tabs.create failed', {
                  error: err instanceof Error ? err : undefined,
                  module: 'WorkspaceRouter',
                });
              });
          }
        } catch (err) {
          debugLog(ERROR_CODES.WORKSPACE_ROUTER, 'openStandalone: surface open failed', {
            error: err instanceof Error ? err : undefined,
            module: 'WorkspaceRouter',
          });
        }
      });
    } catch (err) {
      debugLog(ERROR_CODES.TABS_QUERY, 'openStandalone: tabs.query failed', {
        error: err instanceof Error ? err : undefined,
        module: 'WorkspaceRouter',
      });
    }
  },
};
