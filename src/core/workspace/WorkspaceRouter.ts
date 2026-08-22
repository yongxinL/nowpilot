import { publish } from '../runtime/BroadcastBus';
import { useWorkspaceStore } from './WorkspaceStore';

const WORKSPACE_CHANNEL = 'np_workspace';

/**
 * D-04 / D-07: open the Standalone view in a new tab — or focus the
 * existing one if it's already open (REQ-F05 cross-surface handoff).
 *
 * Pre-fix this was `openFullApp` and pointed at a non-existent `app.html`.
 * The real surface is `entrypoints/standalone/index.html`, which WXT
 * outputs as `standalone.html`. The query string shape
 * (`workspaceId=&conversationId=&page=`) is what `hydrateFromURL` reads on
 * Standalone mount (H2 — the hydration stays in `WorkspaceRouter.ts`).
 *
 * Tab dedup is callback-style to match the file's established convention
 * (01-PATTERNS.md). The cross-window focus case (`chrome.windows.update`)
 * covers re-opening from a different browser window.
 */
export function openStandalone(
  workspaceId: string,
  conversationId?: string,
  page?: string,
  opts?: { onSettled?: (result: { ok: true } | { ok: false; error: string }) => void },
): void {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId);
  if (conversationId) params.set('conversationId', conversationId);
  if (page) params.set('page', page);

  const url = chrome.runtime.getURL(`standalone.html?${params.toString()}`);

  publish(WORKSPACE_CHANNEL, {
    type: 'STANDALONE_OPEN',
    workspaceId,
    conversationId,
    page,
  });

  chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html*') }, (tabs) => {
    if (chrome.runtime.lastError) {
      opts?.onSettled?.({ ok: false, error: String(chrome.runtime.lastError.message) });
      return;
    }
    if (tabs.length > 0 && tabs[0].id) {
      const tabId = tabs[0].id;
      const windowId = tabs[0].windowId;
      chrome.tabs.update(tabId, { active: true }, () => {
        if (chrome.runtime.lastError) {
          opts?.onSettled?.({ ok: false, error: String(chrome.runtime.lastError.message) });
          return;
        }
        if (windowId !== undefined) {
          chrome.windows.update(windowId, { focused: true }, () => {
            opts?.onSettled?.({ ok: true });
          });
        } else {
          opts?.onSettled?.({ ok: true });
        }
      });
      useWorkspaceStore.getState().setOpenedStandaloneTabId(tabId);
    } else {
      chrome.tabs.create({ url }, (tab) => {
        if (chrome.runtime.lastError) {
          opts?.onSettled?.({ ok: false, error: String(chrome.runtime.lastError.message) });
          return;
        }
        if (tab.id) {
          useWorkspaceStore.getState().setOpenedStandaloneTabId(tab.id);
        }
        opts?.onSettled?.({ ok: true });
      });
    }
  });
}

/**
 * H2: hydrate the WorkspaceStore from the Standalone view's `?workspaceId&`
 * `&conversationId&` query string (which `openStandalone` produced above).
 *
 * Both branches now route through zustand's `set()` (via the named store
 * actions), so persistence and subscriber notifications fire. The previous
 * `Object.assign(store, { workspaceId })` bypassed `set()` and silently
 * failed to trigger persist/subscribers — fixed in Plan 01-06.
 *
 * Empty/missing params set empty string / null respectively; downstream
 * empty-state UIs handle it.
 */
export function hydrateFromURL(searchParams: URLSearchParams): void {
  const wsId = searchParams.get('workspaceId');
  const convId = searchParams.get('conversationId');

  const store = useWorkspaceStore.getState();

  if (wsId) {
    store.setWorkspaceId(wsId);
  }
  if (convId) {
    store.setConversationId(convId);
  }
}
