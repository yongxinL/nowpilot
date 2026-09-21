import { debugLog } from '../log/debugLog';
import { useWorkspaceStore } from './WorkspaceStore';
import {
  buildHandoffUrl,
  parseHandoffUrl,
  type HandoffResult,
} from './handoff/protocol';
import {
  createWorkspaceHandoffSource,
  createWorkspaceHandoffTarget,
} from './handoff/useWorkspaceHandoff';

export interface WorkspaceNavigationResult {
  ok: true;
}

export interface WorkspaceNavigationFailure {
  ok: false;
  error: string;
}

export interface OpenStandaloneOptions {
  onSettled?: (result: HandoffResult) => void;
  /**
   * The ephemeral composer draft. It travels through the validated handoff
   * projection only — never through the URL and never through storage.
   */
  composerDraft?: string;
}

/**
 * Resolve the Standalone tab: focus it when it exists, create exactly one when
 * it does not. Callback-style to match the file's established convention, with
 * every `chrome.runtime.lastError` branch preserved (01-PATTERNS.md); the
 * cross-window focus case covers re-opening from another browser window.
 *
 * The URL carries only the approved bootstrap identifiers, built by
 * `buildHandoffUrl` — never a draft, a credential or the workspace state.
 */
function focusOrCreateStandaloneTab(args: {
  requestId: string;
  workspaceId: string;
  conversationId: string | null;
  page: string | null;
}): Promise<void> {
  const url = chrome.runtime.getURL(
    buildHandoffUrl({
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      conversationId: args.conversationId,
      route: args.page,
      sourceSurface: 'sidepanel',
      targetSurface: 'standalone',
    }),
  );

  return new Promise<void>((resolve, reject) => {
    chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html*') }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(String(chrome.runtime.lastError.message)));
        return;
      }
      if (tabs.length > 0 && tabs[0].id) {
        const tabId = tabs[0].id;
        const windowId = tabs[0].windowId;
        chrome.tabs.update(tabId, { active: true }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(String(chrome.runtime.lastError.message)));
            return;
          }
          useWorkspaceStore.getState().setOpenedStandaloneTabId(tabId);
          if (windowId !== undefined) {
            chrome.windows.update(windowId, { focused: true }, () => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        chrome.tabs.create({ url }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(String(chrome.runtime.lastError.message)));
            return;
          }
          if (tab.id) {
            useWorkspaceStore.getState().setOpenedStandaloneTabId(tab.id);
          }
          resolve();
        });
      }
    });
  });
}

/**
 * D-13 / D-12: hand the workspace to the Standalone surface.
 *
 * Success is claimed **only** after a validated `HANDOFF_ACK` correlated on the
 * request id — never when `tabs.create` returns. On a missing ready or a
 * missing acknowledgement the Side Panel stays writable, the local draft is
 * untouched, and the caller receives a typed recoverable failure
 * (`WORKSPACE_HANDOFF_FAILED` / `STANDALONE_OPEN_FAILED`) that the UI turns into
 * the pinned `standalone.openFailed` copy plus `Retry`. No `MirrorBanner` is
 * displayed and no election, epoch, identity or demotion is claimed.
 */
export function openStandalone(
  workspaceId: string,
  conversationId?: string,
  page?: string,
  opts?: OpenStandaloneOptions,
): void {
  const source = createWorkspaceHandoffSource({
    openTarget: ({ requestId, workspaceId: targetWorkspaceId, page: targetPage }) =>
      focusOrCreateStandaloneTab({
        requestId,
        workspaceId: targetWorkspaceId,
        // The bootstrap identifier only — never the draft, which travels
        // through the validated ephemeral projection instead.
        conversationId: conversationId ?? null,
        page: targetPage,
      }),
    sourceSurface: 'sidepanel',
    targetSurface: 'standalone',
  });

  void source
    .start({
      workspaceId,
      conversationId: conversationId ?? null,
      page: page ?? null,
      composerDraft: opts?.composerDraft ?? '',
    })
    .then(
      (result) => {
        opts?.onSettled?.(result);
        source.dispose();
      },
      (error: unknown) => {
        opts?.onSettled?.({
          ok: false,
          code: 'WORKSPACE_HANDOFF_FAILED',
          error: error instanceof Error && error.message ? error.message : String(error),
        });
        source.dispose();
      },
    );
}

/**
 * Open the Options workspace — or focus the existing one.
 *
 * The prototype's `options.html` page no longer exists: §5.4 / §8.6 route
 * Options inside the Standalone shell at `?page=options`, so the URL target and
 * the dedupe match both use that route. Mirrors `openStandalone`'s
 * callback-style + dedupe shape.
 */
export function openOptions(
  opts?: { onSettled?: (result: WorkspaceNavigationResult | WorkspaceNavigationFailure) => void },
): void {
  const url = chrome.runtime.getURL('standalone.html?page=options');

  chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html?page=options*') }, (tabs) => {
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
    } else {
      chrome.tabs.create({ url }, (tab) => {
        if (chrome.runtime.lastError) {
          opts?.onSettled?.({ ok: false, error: String(chrome.runtime.lastError.message) });
          return;
        }
        opts?.onSettled?.({ ok: true });
      });
    }
  });
}

/**
 * Read this surface's URL bootstrap and become the handoff **target** (D-13).
 *
 * The bootstrap is normalised and validated by `parseHandoffUrl` before any
 * value is used; a rejected URL applies nothing at all and is logged by code
 * only. A validated bootstrap hydrates the canonical store fields and, when it
 * carries a request id, starts the target controller — which announces
 * readiness, applies at most one correlated projection and acknowledges it.
 *
 * Returns the disposer so the surface can unsubscribe on unmount; a rejected or
 * bootstrap-free URL returns a no-op disposer.
 */
export function hydrateFromURL(search: URLSearchParams | string): () => void {
  const parsed = parseHandoffUrl(search);
  if (!parsed.ok) {
    // Names and values are never logged — only the canonical rejection code.
    debugLog('WORKSPACE_HANDOFF_URL_REJECTED', 'Workspace handoff URL rejected', { code: parsed.code });
    return () => {};
  }

  const bootstrap = parsed.value;
  if (!bootstrap) return () => {};

  const store = useWorkspaceStore.getState();
  store.setWorkspaceId(bootstrap.workspaceId);
  if (bootstrap.conversationId) store.setConversationId(bootstrap.conversationId);
  store.setActiveSurface('standalone');

  const target = createWorkspaceHandoffTarget({
    bootstrap,
    apply: (projection) => {
      const state = useWorkspaceStore.getState();
      state.setWorkspaceId(projection.workspaceId);
      state.setConversationId(projection.conversationId);
      state.setActiveSurface('standalone');
    },
  });

  target.start();
  return () => target.dispose();
}
