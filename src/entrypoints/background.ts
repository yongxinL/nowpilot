import '../core/utils/chromePolyfill';
import { defineBackground } from 'wxt/utils/define-background';
import { debugLog } from '../core/utils/debugLog';
import { validateEnvelope } from '../core/messaging/runtimeEnvelope';
import { PAGE_CONTEXT_UPDATED, GET_PAGE_CONTEXT_REQUEST } from '../core/messaging/pageMessages';
import { useWorkspaceStore } from '../core/stores/workspaceStore';
import { initProviderSync } from '../core/stores/providerStore';
import { extractionLogDB } from '../core/storage/stores/ExtractionLogDB';
import type { PageContext } from '../core/content/PageContext';

/** Process a PageContext from any source (runtime message or session storage) */
function processPageContext(ctx: PageContext, tabId?: number): void {
  useWorkspaceStore.getState().setCurrentPageContext(ctx);
  if (tabId !== undefined) {
    useWorkspaceStore.getState().setPageContextForTab(tabId, ctx);
  }
}

/** Process an extraction trace from session storage */
async function processExtractionTrace(payload: Record<string, unknown>): Promise<void> {
  const { traceId, url, steps, totalDurationMs, extractionType, extractionQuality, timestamp } = payload;
  if (!traceId || !url) return;

  try {
    await extractionLogDB.log({
      id: String(traceId),
      url: String(url),
      trace: {
        steps: (steps as Array<Record<string, unknown>>)?.map((s) => ({
          step: String(s.step ?? ''),
          status: (s.status as 'start' | 'ok' | 'skip' | 'fail') ?? 'ok',
          durationMs: Number(s.durationMs ?? 0),
          detail: s.detail ? String(s.detail) : undefined,
        })) ?? [],
        totalDurationMs: Number(totalDurationMs ?? 0),
        extractionType: extractionType ? String(extractionType) : undefined,
        extractionQuality: extractionQuality ? String(extractionQuality) : undefined,
      },
      timestamp: Number(timestamp ?? Date.now()),
    });
    debugLog('debug', '[background] Extraction trace processed', {
      url,
      steps: Array.isArray(steps) ? steps.length : 0,
      durationMs: totalDurationMs,
    });
  } catch (err) {
    debugLog('error', '[background] Failed to log extraction trace', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

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

  // Evict the per-tab page-context cache when its tab closes
  chrome.tabs.onRemoved.addListener((tabId) => {
    useWorkspaceStore.getState().clearPageContextForTab(tabId);
  });

  // ─── Channel 1: chrome.storage.onChanged (session) — reliable fallback ───
  // Content scripts write to chrome.storage.session when runtime messages fail.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'session') return;

    for (const [key, { newValue }] of Object.entries(changes)) {
      if (!newValue) continue;

      // Page context update from session storage
      if (key === 'np_pc_active') {
        try {
          const { pageContext } = newValue as { pageContext: PageContext };
          if (pageContext?.url) {
            debugLog('debug', '[background] Page context from session storage', {
              url: pageContext.url,
            });
            processPageContext(pageContext);
          }
        } catch (err) {
          debugLog('error', '[background] Failed to process session page context', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
        continue;
      }

      // Extraction trace from session storage
      if (key.startsWith('np_ext_')) {
        processExtractionTrace(newValue as Record<string, unknown>);
        continue;
      }
    }
  });

  // ─── Channel 2: chrome.runtime.onMessage — fast path ───
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && typeof message === 'object') {
      try {
        const env = validateEnvelope(message);

        // D-15: Content script publishes PAGE_CONTEXT_UPDATED (fast path)
        if (env.type === PAGE_CONTEXT_UPDATED) {
          const ctx = env.payload as PageContext;
          debugLog('info', '[background] PAGE_CONTEXT_UPDATED received', {
            url: ctx.url,
            extractionType: ctx.extractionType,
            tabId: sender.tab?.id,
          });
          processPageContext(ctx, sender.tab?.id);
          sendResponse({ success: true });
          return true;
        }

        // D-03/D-04: Panel/Agent requests fresh extraction
        if (env.type === GET_PAGE_CONTEXT_REQUEST) {
          chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab?.id) {
              chrome.tabs.sendMessage(tab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  sendResponse(response);
                }
              });
            } else {
              sendResponse({ success: false, error: 'No active tab' });
            }
          });
          return true;
        }
      } catch {
        // Invalid envelope — fall through
      }
    }

    // FETCH_PROXY handler for add-on CORS proxying
    if (message && typeof message === 'object' && (message as Record<string, unknown>).type === 'FETCH_PROXY') {
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
      return true;
    }

    debugLog('debug', 'message received', { message });
    return true;
  });
});
