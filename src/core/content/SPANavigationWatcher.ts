// src/core/content/SPANavigationWatcher.ts — D-4a-01 SPA-navigation detector (content-side).
// Watches the wxt 'wxt:locationchange' window event and signals the host when the SPA
// navigated, so the per-tab cache can be marked stale / re-extracted for subscribed tabs.
//
// Dependency-free core (Appendix G / RESEARCH Pitfall 4): no React, no antd, no zustand —
// the only runtime surface is the injected deps object. In production the deps object is
// the wxt content-script `ctx`; `ctx.addEventListener` auto-cleans the listener when the
// content-script context is invalidated, so a bare window.addEventListener (leak +
// invalidated-context) is NEVER used here (RESEARCH Common Op 5). Event-driven only —
// no polling, no observer-based watching (§5.6 'never polling').
//
// NAMESPACING (RESEARCH Pitfall 4): wxt namespaces the real event to
// `${runtime.id}:${entrypoint}:wxt:locationchange` (getUniqueEventName in
// node_modules/wxt/dist/client/content-scripts/custom-events.mjs). The default eventName
// stays 'wxt:locationchange' because wxt's ctx.addEventListener maps it to the unique name
// at runtime. Tests pass the resolved namespaced name explicitly
// (`${FIXED_EXTENSION_ID}:core:wxt:locationchange`) so the Pitfall 4 pin holds — a plain
// 'wxt:locationchange' event never triggers the watcher in tests or in production.
//
// The callback receives the POST-navigation URL (newUrl) — the D-4a-01 signal the host
// (04a-07) uses to rebuild the live context and mark the panel cache stale via the bridge
// (subscribed tabs re-extract, unsubscribed mark-stale only).

/**
 * wxt event shape: {newUrl, oldUrl} carried on the namespaced window event.
 * wxt 0.19.29's real WxtLocationChangeEvent carries URL INSTANCES (verified in
 * custom-events.mjs — `new WxtLocationChangeEvent(newUrl, oldUrl)` from
 * location-watcher.mjs); the host's callback contract is a plain string href,
 * so the watcher normalizes either shape (Rule 1 — a string-only guard would
 * never fire in production).
 */
export interface WxtLocationChangeLikeEvent extends Event {
  newUrl: string | URL;
  oldUrl?: string | URL;
}

/**
 * Minimal structural subset of the wxt ContentScriptContext (and of a plain Window) the
 * watcher needs. Production passes the wxt `ctx`; tests pass plain window functions.
 */
export interface SPANavigationWatcherDeps {
  addEventListener(target: Window, eventName: string, handler: (event: Event) => void): void;
  removeEventListener?(target: Window, eventName: string, handler: (event: Event) => void): void;
}

export interface SPANavigationWatcherOptions {
  /**
   * The event name to listen on. Defaults to 'wxt:locationchange' — wxt's ctx maps it to
   * the namespaced `${runtime.id}:${entrypoint}:wxt:locationchange`. Tests pass the
   * resolved namespaced name (RESEARCH Pitfall 4).
   */
  eventName?: string;
}

/**
 * Registers the wxt:locationchange handler on construction and exposes stop() to remove it
 * eagerly (beyond the wxt ctx auto-clean on context invalidation). `onNavigate(newUrl)` is
 * invoked with the post-navigation URL on every SPA nav.
 */
export class SPANavigationWatcher {
  private readonly deps: SPANavigationWatcherDeps;
  private readonly onNavigate: (newUrl: string) => void;
  private readonly eventName: string;
  private readonly handler: (event: Event) => void;
  private stopped = false;

  constructor(
    deps: SPANavigationWatcherDeps,
    onNavigate: (newUrl: string) => void,
    options: SPANavigationWatcherOptions = {},
  ) {
    this.deps = deps;
    this.onNavigate = onNavigate;
    this.eventName = options.eventName ?? 'wxt:locationchange';
    this.handler = (event: Event) => {
      const { newUrl } = event as WxtLocationChangeLikeEvent;
      // Normalize wxt's URL-instance event AND the string shape tests dispatch:
      // both carry the post-navigation URL, delivered to the host as a string href.
      const href = typeof newUrl === 'string' ? newUrl : newUrl?.href;
      if (typeof href === 'string') this.onNavigate(href);
    };
    // ctx.addEventListener (auto-cleans on context invalidation) — never a bare
    // window.addEventListener here (RESEARCH Common Op 5: leak + invalidated context).
    deps.addEventListener(window, this.eventName, this.handler);
  }

  /** Remove the listener — a later dispatch no-ops. Idempotent. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.deps.removeEventListener?.(window, this.eventName, this.handler);
  }
}
