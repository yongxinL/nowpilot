// tests/setup.ts — Source: RESEARCH A5 + Pattern 4 (lines 342-343)
// Responsibilities:
// (a) polyfill window.matchMedia (jsdom lacks it — Pitfall 6/A5) with a mock
//     implementing matches/onchange and a stable query result
// (b) reset fakeBrowser per test so chrome.* mocks are clean
// (c) RTL DOM cleanup per test — vitest runs WITHOUT globals (globals: false),
//     so @testing-library/react cannot auto-register its afterEach(cleanup);
//     without this, component-test DOM leaks across tests (01-04 Rule 3)
// (d) re-align the TextEncoder realm (01-04 Rule 3): vitest's jsdom setup
//     overrides globalThis.Uint8Array with the jsdom-window realm but leaves
//     globalThis.TextEncoder in Node's realm, so esbuild 0.25's load-time
//     invariant `TextEncoder.encode("") instanceof Uint8Array` fails whenever
//     esbuild loads after the environment is set up. Probing the encoder's
//     actual output constructor and pinning the global Uint8Array to it makes
//     the invariant hold for every later esbuild load in the worker.
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
// (f) fake-indexeddb harness (RESEARCH Pattern 1): registers global
// indexedDB/IDBKeyRange/IDBCursor for every test. crypto.subtle (AES-GCM,
// PBKDF2) and globalThis.structuredClone are already available in the
// jsdom-align env — zero additional polyfills required (verified).
import 'fake-indexeddb/auto';
// (e) register @testing-library/jest-dom matchers (toBeDisabled, toBeInTheDocument,
//     ...) — vitest runs WITHOUT globals, so jest-dom's auto-registration never
//     fires; the explicit vitest entry augments vitest's expect (01-08 Rule 3:
//     first component tests to use matcher-style assertions).
import '@testing-library/jest-dom/vitest';

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
// --- (c) RTL cleanup per test (vitest runs with globals disabled, so RTL's
// auto-registered afterEach(cleanup) never fires — without this, component-test
// DOM leaks across tests and getByText finds stale matches) ---
afterEach(() => {
  cleanup();
});
// --- (d) TextEncoder realm alignment (see header) ---
if (typeof globalThis.TextEncoder === 'function') {
  const probe = new globalThis.TextEncoder().encode('');
  const probeCtor = probe.constructor as typeof Uint8Array;
  if (typeof probeCtor === 'function') globalThis.Uint8Array = probeCtor;
}
