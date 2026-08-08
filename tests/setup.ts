// tests/setup.ts — Source: RESEARCH A5 + Pattern 4 (lines 342-343)
// Two responsibilities:
// (a) polyfill window.matchMedia (jsdom lacks it — Pitfall 6/A5) with a mock
//     implementing matches/onchange and a stable query result
// (b) reset fakeBrowser per test so chrome.* mocks are clean
import { beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

// --- (a) window.matchMedia polyfill (jsdom lacks it) ---
type MatchMediaListener = (event: MediaQueryListEvent) => void;

class MockMediaQueryList implements MediaQueryList {
  readonly media: string;
  private listener: MatchMediaListener | null = null;
  private _matches: boolean;

  constructor(media: string) {
    this.media = media;
    this._matches = false; // stable query result: light scheme by default
  }

  get matches(): boolean {
    return this._matches;
  }

  get onchange(): MatchMediaListener | null {
    return this.listener;
  }

  set onchange(listener: MatchMediaListener | null) {
    this.listener = listener;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (type === 'change' && typeof listener === 'function')
      this.listener = listener as MatchMediaListener;
  }

  removeEventListener(type: string, _listener: EventListenerOrEventListenerObject | null): void {
    if (type === 'change') this.listener = null;
  }

  addListener(listener: MatchMediaListener | null): void {
    this.listener = listener;
  }

  removeListener(listener: MatchMediaListener | null): void {
    if (this.listener === listener) this.listener = null;
  }

  dispatchEvent(event: Event): boolean {
    if (this.listener) this.listener(event as MediaQueryListEvent);
    return true;
  }
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => new MockMediaQueryList(query);
}
// --- (b) fakeBrowser reset per test ---
beforeEach(() => {
  fakeBrowser.reset();
});
