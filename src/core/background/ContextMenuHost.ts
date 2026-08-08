// src/core/background/ContextMenuHost.ts — context-menus owner (RESEARCH A6,
// line 494: "idempotent re-register per startup"). recreateAll() removes ALL
// existing items then creates the Phase-1 'nowpilot-summarize' page item, with
// an onClicked listener whose action is a no-op this phase (real summarization
// lands in its phase — only debugLog EVT_HANDLER fires, R-10-safe). The
// click-listener uses remove-then-add so exactly ONE onClicked listener is ever
// active even if recreateAll() runs twice in one SW life (T-1-11 pattern).
// Failures log EVT_HANDLER and never throw (Golden Rule 9). Dependency-free
// core (Pitfall 4): no UI libs.
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

export const SUMMARIZE_MENU_ID = 'nowpilot-summarize';

type ContextMenuClickHandler = (
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
) => void;

let clickedHandler: ContextMenuClickHandler | null = null;

export const ContextMenuHost = {
  recreateAll(): void {
    try {
      chrome.contextMenus.removeAll(() => {
        // remove-then-add keeps exactly one active onClicked listener (T-1-11).
        if (clickedHandler !== null) {
          chrome.contextMenus.onClicked.removeListener(clickedHandler);
        }
        clickedHandler = (info, tab) => {
          // No-op action this phase — summarization lands in its phase.
          debugLog(ERROR_CODES.EVT_HANDLER, 'context menu clicked', {
            silent: true,
            module: 'ContextMenuHost',
            extra: { menuItemId: info.menuItemId, tabId: tab?.id },
          });
        };
        chrome.contextMenus.onClicked.addListener(clickedHandler);
        chrome.contextMenus.create(
          { id: SUMMARIZE_MENU_ID, title: 'NowPilot — Summarize page', contexts: ['page'] },
          () => {
            if (chrome.runtime.lastError !== undefined) {
              debugLog(ERROR_CODES.EVT_HANDLER, 'context menu create failed', {
                module: 'ContextMenuHost',
                extra: { message: chrome.runtime.lastError.message },
              });
            }
          },
        );
      });
    } catch (err) {
      debugLog(ERROR_CODES.EVT_HANDLER, 'context menu recreate failed', {
        error: err instanceof Error ? err : undefined,
        module: 'ContextMenuHost',
      });
    }
  },
};
