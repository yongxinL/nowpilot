// SPANavigationWatcher — SPA navigation detection for the content script
// (D-84/D-88 invalidation signal source; RESEARCH correction 2 embedded).
//
// The scaffold's document-level `wxt:locationchange` listener was DEAD CODE:
// WXT 0.20.x namespaces the event (`${runtime.id}:${ENTRYPOINT}:wxt:locationchange`)
// and dispatches it on window. The correct usage is
// ctx.addEventListener(window, 'wxt:locationchange', …) via the WXT
// content-script context — which translates the namespaced event name AND
// starts the LocationWatcher (Navigation API first, 1 s polling fallback).
// A MutationObserver URL-diff is kept as the belt-and-braces fallback for
// pre-0.20.27 parity (it is what the scaffold's dead listener masked).
//
// Signals drive CACHE INVALIDATION only (T-P6-18 — never trusted as
// instructions): a spoofed signal at worst forces a re-extract.
//
// Content-bundle constraints (Pitfall 8): zero imports — `ctx` is a minimal
// structural type so the module is testable with a stub (jsdom cannot run the
// real WXT context).
//
// Navigation event shape (WXT): { newUrl: URL; oldUrl: URL } — structurally
// compatible with the exported ContentScriptContextLike handler signature.

/** Navigation event delivered by WXT's translated `wxt:locationchange`. */
export interface WxtLocationChangeEvent {
  newUrl?: { href: string };
  oldUrl?: { href: string };
}

/** Minimal structural type for the WXT content-script context — the real
 * context additionally starts the LocationWatcher and translates the
 * namespaced event name; a stub satisfies this shape in tests. */
export interface ContentScriptContextLike {
  addEventListener(target: Window, type: string, handler: (event: WxtLocationChangeEvent) => void): void;
}

/**
 * Start SPA navigation detection: (a) the CORRECTED WXT listener via the
 * content-script context (RESEARCH correction 2 / Pitfall 2), plus (b) the
 * MutationObserver URL-diff fallback. Fires `onNavigate(newUrl, oldUrl)` on
 * navigation. Returns a cleanup function (observer disconnect; the ctx
 * listener lifetime is owned by the WXT context).
 */
export function startWatcher(
  ctx: ContentScriptContextLike,
  onNavigate: (newUrl: string, oldUrl: string) => void,
): () => void {
  let lastUrl = location.href;

  const emit = (newUrl: string, oldUrl: string): void => {
    if (newUrl === oldUrl) return;
    lastUrl = newUrl;
    onNavigate(newUrl, oldUrl);
  };

  // (a) Corrected WXT usage: the content-script context translates the
  // namespaced event name and starts the LocationWatcher (Navigation API
  // first, 1 s polling fallback). The handler receives URL objects.
  ctx.addEventListener(window, 'wxt:locationchange', (event) => {
    emit(event?.newUrl?.href ?? location.href, event?.oldUrl?.href ?? lastUrl);
  });

  // (b) Belt-and-braces URL-diff (scaffold parity): any DOM mutation triggers
  // a location.href comparison; a change fires onNavigate.
  const detectNavigation = (): void => {
    if (location.href !== lastUrl) {
      const oldUrl = lastUrl;
      lastUrl = location.href;
      onNavigate(location.href, oldUrl);
    }
  };
  const observer = new MutationObserver(detectNavigation);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return () => {
    observer.disconnect();
  };
}

/** Object-form namespace export for callers (ProviderRegistry precedent). */
export const SPANavigationWatcher = { startWatcher };