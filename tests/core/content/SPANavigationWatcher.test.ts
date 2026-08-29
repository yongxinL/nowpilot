// SPANavigationWatcher tests — watcher proof (06-04, Task 3).
//
// Two behavior groups from Task 2's block: (5) the CORRECTED WXT usage —
// startWatcher registers ctx.addEventListener(window, 'wxt:locationchange',
// handler) (RESEARCH correction 2; the scaffold's document-level listener was
// dead code) and the handler fires onNavigate(newUrl.href, oldUrl.href); (6)
// the MutationObserver URL-diff fallback detects a URL change and fires
// onNavigate (belt-and-braces, scaffold parity).
import { describe, it, expect, vi } from 'vitest';

import { startWatcher, type ContentScriptContextLike } from '@/core/content/SPANavigationWatcher';

/** Stub WXT content-script context: captures addEventListener registrations so
 * tests can invoke the translated 'wxt:locationchange' handler directly
 * (jsdom cannot run the real WXT context). */
function makeStubCtx(): { ctx: ContentScriptContextLike; handlers: Map<string, (e: unknown) => void> } {
  const handlers = new Map<string, (e: unknown) => void>();
  const ctx: ContentScriptContextLike = {
    addEventListener: vi.fn((_target: Window, type: string, handler: (e: unknown) => void) => {
      handlers.set(type, handler);
    }),
  };
  return { ctx, handlers };
}

describe('SPANavigationWatcher', () => {
  it('(5) registers ctx.addEventListener(window, "wxt:locationchange", handler) — the corrected WXT usage — and fires onNavigate', () => {
    const { ctx, handlers } = makeStubCtx();
    const onNavigate = vi.fn();
    const cleanup = startWatcher(ctx, onNavigate);

    expect(ctx.addEventListener).toHaveBeenCalledWith(window, 'wxt:locationchange', expect.any(Function));

    const handler = handlers.get('wxt:locationchange')!;
    expect(handler).toBeDefined();
    const newUrl = new URL('https://support.servicenow.com/kb/123');
    const oldUrl = new URL('https://support.servicenow.com/kb/');
    handler({ newUrl, oldUrl });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(newUrl.href, oldUrl.href);

    cleanup();
  });

  it('(6) MutationObserver URL-diff fallback detects a URL change and fires onNavigate (belt-and-braces)', async () => {
    const { ctx, handlers } = makeStubCtx();
    const onNavigate = vi.fn();
    const cleanup = startWatcher(ctx, onNavigate);

    const oldHref = window.location.href;
    window.history.pushState({}, '', '/spa-route-123');
    expect(window.location.href).not.toBe(oldHref);

    // A DOM mutation triggers the observer's URL-diff check (observer
    // callbacks are delivered asynchronously).
    document.body.appendChild(document.createElement('p'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(window.location.href, oldHref);

    // The stub ctx's translated handler is not auto-fired by pushState — the
    // fallback did the work.
    expect(handlers.get('wxt:locationchange')).toBeDefined();

    cleanup();
  });
});