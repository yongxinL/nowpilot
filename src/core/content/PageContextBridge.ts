// PageContextBridge — the content-script RuntimeEnvelope producer/consumer
// (D-84 wiring of the Phase-1 D-15 declared extraction types).
//
// Handles EXTRACT_PAGE_CONTENT from a surface (side panel / standalone): mode
// 'default' → ContentScriptHost.serializePage() responds { ok:true, payload }
// (the frozen PageHtmlPayload); mode 'actionable' → AxDomWalker.walkDom()
// responds { ok:true, raw } (the RawNode tree — D-86 gating: zero AX cost on
// the default read path). Non-extraction messages pass through untouched —
// the bridge never responds to messages it does not own (T-P6-03 / threat
// model: surface → content-script requests are gated by mode).
//
// On SPA navigation the wired SPANavigationWatcher fires: callbacks.onNavigate
// (the shell seam), SPA_NAVIGATION (feeds the 06-03 PageContentCache
// invalidation), and PAGE_LIVE_CONTEXT with the lightweight live context
// { url, title, meta } (D-89 — always on navigation; full extraction is on
// demand only).
//
// BackgroundRouter stays STATELESS (D-84 / §5.1): the round-trip flows
// content-script → surface directly via sendResponse / runtime messages — no
// background handler is registered for the extraction envelopes.
//
// Content-bundle constraints (Pitfall 8 / T-P6-03): imports ONLY the
// runtime-envelope module (types + createEnvelope + isEnvelope) and sibling
// content-side modules — never the panel-side extraction layer, never zod
// (ExtractResponse is a plain union; the panel validates via zod, 06-01).
import { createEnvelope, isEnvelope, type PageHtmlPayload } from '../runtime/RuntimeEnvelope';
import { serializePage } from './ContentScriptHost';
import { startWatcher, type ContentScriptContextLike } from './SPANavigationWatcher';
import { walkDom, type RawNode } from './AxDomWalker';

/** EXTRACT_PAGE_CONTENT request payload (surface → content script). */
export interface ExtractRequestPayload {
  tabId: number;
  url: string;
  mode: 'default' | 'actionable';
}

/** Typed response contract (zod-free — the panel validates, 06-01/06-02). */
export type ExtractResponse =
  | { ok: true; payload?: PageHtmlPayload; raw?: RawNode }
  | { ok: false; error: string };

/**
 * Wire the bridge: register the chrome.runtime.onMessage handler for
 * EXTRACT_PAGE_CONTENT and start the SPA navigation watcher (SPA_NAVIGATION +
 * PAGE_LIVE_CONTEXT producers). Returns a cleanup function (listener removal
 * + watcher cleanup).
 */
export function initBridge(
  ctx: ContentScriptContextLike,
  callbacks: { onNavigate(newUrl: string, oldUrl: string): void },
): () => void {
  const onMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean | undefined => {
    if (!isEnvelope(message) || message.type !== 'EXTRACT_PAGE_CONTENT') {
      return false; // pass through — never respond to non-extraction messages
    }
    const payload = message.payload as Partial<ExtractRequestPayload>;
    if (payload.mode === 'actionable') {
      const raw = walkDom(document.documentElement);
      sendResponse({ ok: true, raw } satisfies ExtractResponse);
    } else {
      const htmlPayload = serializePage();
      sendResponse({ ok: true, payload: htmlPayload } satisfies ExtractResponse);
    }
    return true; // keep the channel open until sendResponse is called (sync here)
  };
  chrome.runtime.onMessage.addListener(onMessage);

  const watcherCleanup = startWatcher(ctx, (newUrl, oldUrl) => {
    callbacks.onNavigate(newUrl, oldUrl);
    chrome.runtime
      .sendMessage(createEnvelope('SPA_NAVIGATION', { url: newUrl }, 'content'))
      .catch(() => {});
    chrome.runtime
      .sendMessage(
        createEnvelope('PAGE_LIVE_CONTEXT', { url: newUrl, title: document.title, meta: {} }, 'content'),
      )
      .catch(() => {});
  });

  return () => {
    chrome.runtime.onMessage.removeListener(onMessage);
    watcherCleanup();
  };
}

/** Object-form namespace export for callers (ProviderRegistry precedent). */
export const PageContextBridge = { initBridge };