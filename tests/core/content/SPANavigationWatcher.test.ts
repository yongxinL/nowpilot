// tests/core/content/SPANavigationWatcher.test.ts — D-4a-01 SPA-nav detection pins.
// RESEARCH Pitfall 4: the real wxt event is NAMESPACED
// (`${runtime.id}:${entrypoint}:wxt:locationchange` — wxt getUniqueEventName) — tests
// dispatch the namespaced name (FIXED_EXTENSION_ID + entrypoint 'core'), never a plain
// 'wxt:locationchange' event. Default jsdom-align env (window required), same as
// ContentScriptHost.test.ts.
import { describe, expect, it } from 'vitest';
import { SPANavigationWatcher } from '@/core/content/SPANavigationWatcher';
import { FIXED_EXTENSION_ID } from '../../fixtures';

const ENTRYPOINT = 'core';
const NAMESPACED_EVENT = `${FIXED_EXTENSION_ID}:${ENTRYPOINT}:wxt:locationchange`;

/** Plain-window deps — the test registers on the resolved namespaced name directly. */
function windowDeps() {
  return {
    addEventListener: (target: Window, name: string, handler: (e: Event) => void) => {
      target.addEventListener(name, handler);
    },
    removeEventListener: (target: Window, name: string, handler: (e: Event) => void) => {
      target.removeEventListener(name, handler);
    },
  };
}

/** Dispatch a wxt-shaped locationchange event on the NAMESPACED name. */
function dispatchLocationChange(newUrl: string): void {
  const event = new Event(NAMESPACED_EVENT) as Event & { newUrl: string };
  event.newUrl = newUrl;
  window.dispatchEvent(event);
}

describe('SPANavigationWatcher (D-4a-01)', () => {
  it('fires the callback with newUrl on the NAMESPACED event (Pitfall 4)', () => {
    const urls: string[] = [];
    const watcher = new SPANavigationWatcher(windowDeps(), (newUrl) => urls.push(newUrl), {
      eventName: NAMESPACED_EVENT,
    });

    dispatchLocationChange('https://example.com/post-spa');
    expect(urls).toEqual(['https://example.com/post-spa']);
    watcher.stop();
  });

  it('ignores a plain "wxt:locationchange" event (Pitfall 4 pin)', () => {
    const urls: string[] = [];
    const watcher = new SPANavigationWatcher(windowDeps(), (newUrl) => urls.push(newUrl), {
      eventName: NAMESPACED_EVENT,
    });

    window.dispatchEvent(new Event('wxt:locationchange'));
    expect(urls).toEqual([]);
    watcher.stop();
  });

  it('stop() removes the listener — a second dispatch does not fire (cleanup)', () => {
    const urls: string[] = [];
    const watcher = new SPANavigationWatcher(windowDeps(), (newUrl) => urls.push(newUrl), {
      eventName: NAMESPACED_EVENT,
    });
    watcher.stop();

    dispatchLocationChange('https://example.com/after-stop');
    expect(urls).toEqual([]);
  });

  it('delivers the post-navigation newUrl to the callback (D-4a-01 invalidation signal)', () => {
    let received: string | undefined;
    const watcher = new SPANavigationWatcher(
      windowDeps(),
      (newUrl) => {
        received = newUrl;
      },
      { eventName: NAMESPACED_EVENT },
    );

    dispatchLocationChange('https://example.com/pages/42');
    expect(received).toBe('https://example.com/pages/42');
    watcher.stop();
  });
});
