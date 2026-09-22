import { debugLog } from '../log/debugLog';
import { useWorkspaceStore } from './WorkspaceStore';
import {
  buildHandoffUrl,
  createHandoffRequestId,
  parseHandoffUrl,
  HANDOFF_DRAFT_MAX_CHARS,
  type HandoffResult,
} from './handoff/protocol';
import { useHandoffComposerDraftStore } from './handoff/composerDraft';
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

interface StandaloneTargetPlan {
  /** The correlation id this attempt introduces and every message carries. */
  requestId: string;
  /** Focuses the existing tab (re-establishing it) or creates the one tab. */
  open: () => Promise<void>;
}

function activateTab(
  tabId: number,
  windowId: number | undefined,
  update: chrome.tabs.UpdateProperties,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    chrome.tabs.update(tabId, update, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(String(chrome.runtime.lastError.message)));
        return;
      }
      useWorkspaceStore.getState().setOpenedStandaloneTabId(tabId);
      if (windowId === undefined) {
        resolve();
        return;
      }
      chrome.windows.update(windowId, { focused: true }, () => {
        resolve();
      });
    });
  });
}

function createStandaloneTab(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
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
  });
}

/**
 * Resolve the single Standalone surface for this handoff (D-12, D-13).
 *
 * The callback-style `chrome.tabs.query` → `chrome.tabs.update` /
 * `chrome.windows.update` focus path and the `chrome.tabs.create` fallback are
 * preserved verbatim, including every `chrome.runtime.lastError` branch, and
 * the cross-window focus case covers re-opening from another browser window.
 *
 * Warm path: when a Standalone tab already exists it is focused and
 * **re-pointed at this attempt's bootstrap** rather than left listening on a
 * correlation id whose readiness announcement has already passed —
 * `BroadcastBus` has no replay, so a stale tab can never answer a new request.
 * The same tab is reused (never duplicated), and the target re-establishes
 * itself under the fresh correlation id and announces readiness on load. This
 * is `01-07`'s reading of D-13's warm-path rule "focus it, use the same
 * protocol, verify workspace ID and supported schema before transferring": the
 * verification happens on the target side, where the projection is matched
 * against the bootstrap before anything is applied (T-1-30).
 *
 * The URL carries only the approved bootstrap identifiers, built by
 * `buildHandoffUrl` — never a draft, a credential or the workspace state.
 */
function planStandaloneTarget(args: {
  workspaceId: string;
  conversationId: string | null;
  page: string | null;
}): Promise<StandaloneTargetPlan> {
  return new Promise<StandaloneTargetPlan>((resolve, reject) => {
    chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html*') }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(String(chrome.runtime.lastError.message)));
        return;
      }

      const requestId = createHandoffRequestId();
      const url = chrome.runtime.getURL(
        buildHandoffUrl({
          workspaceId: args.workspaceId,
          requestId,
          conversationId: args.conversationId,
          route: args.page,
          sourceSurface: 'sidepanel',
          targetSurface: 'standalone',
        }),
      );

      const existing = tabs.length > 0 ? tabs[0] : undefined;
      if (existing?.id) {
        const tabId = existing.id;
        const windowId = existing.windowId;
        resolve({
          requestId,
          open: () => activateTab(tabId, windowId, { url, active: true }),
        });
        return;
      }

      resolve({
        requestId,
        open: () => createStandaloneTab(url),
      });
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
  planStandaloneTarget({
    workspaceId,
    conversationId: conversationId ?? null,
    page: page ?? null,
  }).then(
    (plan) => {
      const source = createWorkspaceHandoffSource({
        requestId: plan.requestId,
        openTarget: () => plan.open(),
        sourceSurface: 'sidepanel',
        targetSurface: 'standalone',
      });

      void source.start({
        workspaceId,
        conversationId: conversationId ?? null,
        page: page ?? null,
        composerDraft: opts?.composerDraft ?? '',
      }).then(
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
    },
    (error: unknown) => {
      opts?.onSettled?.({
        ok: false,
        code: 'STANDALONE_OPEN_FAILED',
        error: error instanceof Error && error.message ? error.message : String(error),
      });
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

  // WR-06: a `chrome.tabs.query` URL pattern is matched against the tab URL's
  // *path*, so the query string is not part of the comparison. The old pattern
  // (`standalone.html?page=options*`) either never matched a real tab — the
  // focus branch was dead and every `Open Options` created a duplicate tab,
  // which D-12 forbids — or, with the query dropped, matched *every* Standalone
  // tab and would focus a Chat/Write tab instead. Query by path (exactly as
  // `planStandaloneTarget` does) and compare the route in the callback.
  chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html*') }, (tabs) => {
    if (chrome.runtime.lastError) {
      opts?.onSettled?.({ ok: false, error: String(chrome.runtime.lastError.message) });
      return;
    }

    const existing = tabs.find((tab) => {
      if (!tab.url) return false;
      try {
        return new URL(tab.url).searchParams.get('page') === 'options';
      } catch {
        return false;
      }
    });

    if (existing?.id) {
      const tabId = existing.id;
      const windowId = existing.windowId;
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
      // WR-07: the projection's draft is consumed by the Standalone composer
      // instead of being dropped on the floor. The bound is re-applied here at
      // the consumption boundary; the strict projection schema already rejects
      // an over-long draft on receipt.
      useHandoffComposerDraftStore
        .getState()
        .setDraft(projection.composerDraft.slice(0, HANDOFF_DRAFT_MAX_CHARS));
    },
  });

  target.start();
  return () => target.dispose();
}
