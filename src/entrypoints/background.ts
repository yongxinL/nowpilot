import '../core/utils/chromePolyfill';
import { defineBackground } from 'wxt/utils/define-background';
import { debugLog } from '../core/utils/debugLog';
import { validateEnvelope } from '../core/messaging/runtimeEnvelope';
import { PAGE_CONTEXT_UPDATED, GET_PAGE_CONTEXT_REQUEST } from '../core/messaging/pageMessages';
import { useWorkspaceStore } from '../core/stores/workspaceStore';
import { initProviderSync } from '../core/stores/providerStore';
import type { PageContext } from '../core/content/PageContext';

export default defineBackground(() => {
  initProviderSync();
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    debugLog('info', 'command received', { command });
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // --- Page extraction message routing (D-04) ---
    // Validate as typed envelope first; non-envelope messages
    // (e.g., FETCH_PROXY raw objects) fall through to existing handlers.
    if (message && typeof message === 'object') {
      try {
        const env = validateEnvelope(message);

        // D-15: Content script publishes PAGE_CONTEXT_UPDATED
        // → SW updates workspaceStore (single source of truth)
        if (env.type === PAGE_CONTEXT_UPDATED) {
          const ctx = env.payload as PageContext;
          useWorkspaceStore.getState().setCurrentPageContext(ctx);
          sendResponse({ success: true });
          return true;
        }

        // D-03/D-04: Panel/Agent requests fresh extraction
        // → SW relays to active tab's content script
        if (env.type === GET_PAGE_CONTEXT_REQUEST) {
          chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab?.id) {
              chrome.tabs.sendMessage(tab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                  sendResponse({
                    success: false,
                    error: chrome.runtime.lastError.message,
                  });
                } else {
                  sendResponse(response);
                }
              });
            } else {
              sendResponse({ success: false, error: 'No active tab' });
            }
          });
          return true; // async — keep message channel open (Pitfall 3)
        }
      } catch {
        // Invalid envelope — not a page extraction message,
        // fall through to existing handlers below.
      }
    }

    if (message && typeof message === 'object' && message.type === 'FETCH_PROXY') {
      const { url, options } = message as { type: string; url: string; options?: RequestInit };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      fetch(url, { ...options, signal: controller.signal })
        .then(async (response) => {
          clearTimeout(timeoutId);
          const body = await response.text();
          sendResponse({ ok: response.ok, status: response.status, body });
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          sendResponse({ ok: false, status: 0, body: err instanceof Error ? err.message : String(err) });
        });
      return true; // Keep channel open for async response
    }
    debugLog('debug', 'message received', { message });
    return true;
  });
});
