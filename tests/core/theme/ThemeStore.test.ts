// tests/core/theme/ThemeStore.test.ts — ThemeStore D-13 contract tests: hydrate
// sync-first through Setting (np_theme/np_theme_pack, D-15 local shadow
// fallback), write-through setMode / setPack via settingWriteSync,
// chrome.storage.onChanged foreign-write propagation (sync + local areas), and
// 'auto' mode resolution via matchMedia. Uses the wxt fakeBrowser chrome.*
// stubs (WxtVitest extensionApiMock) and the tests/setup.ts matchMedia polyfill
// (Pitfall 6). Runs in the default jsdom-align environment. Fake timers drive
// the Setting.ts cosmetic debounce deterministically (100ms window, D-15).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useThemeStore } from '@/core/theme/ThemeStore';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function stubMatchMedia(matchesDark: boolean): void {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query === DARK_QUERY ? matchesDark : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  // Fake timers make the Setting.ts cosmetic debounce (D-15) deterministic;
  // useRealTimers in afterEach discards any pending timer (no cross-test leak).
  vi.useFakeTimers();
  originalMatchMedia = window.matchMedia;
  // Reset the store to its initial state for a clean per-test run.
  useThemeStore.setState({
    pack: 'default',
    mode: 'auto',
    resolved: 'light',
    isReady: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
  if (originalMatchMedia) window.matchMedia = originalMatchMedia;
});

describe('ThemeStore', () => {
  it('init with no stored values defaults to auto/default', async () => {
    await useThemeStore.getState().init();
    expect(useThemeStore.getState().mode).toBe('auto');
    expect(useThemeStore.getState().pack).toBe('default');
    expect(useThemeStore.getState().isReady).toBe(true);
  });

  it('init with np_theme=dark resolves dark', async () => {
    await fakeBrowser.storage.local.set({ np_theme: 'dark' });
    await useThemeStore.getState().init();
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(useThemeStore.getState().getResolved()).toBe('dark');
  });

  it('setMode(light) writes sync np_theme via Setting (D-15) and updates state', async () => {
    await useThemeStore.getState().init();
    const p = useThemeStore.getState().setMode('light');
    await vi.advanceTimersByTimeAsync(200); // fire the 100ms cosmetic debounce
    await p;
    const stored = await fakeBrowser.storage.sync.get('np_theme');
    expect(stored.np_theme).toBe('light');
    // No local shadow on the happy path — sync is the canonical store (D-15).
    const local = await fakeBrowser.storage.local.get('np_theme');
    expect(local.np_theme).toBeUndefined();
    expect(useThemeStore.getState().mode).toBe('light');
    expect(useThemeStore.getState().resolved).toBe('light');
  });

  it('setPack(liquid-glass) writes sync np_theme_pack via Setting (D-15) and updates state', async () => {
    await useThemeStore.getState().init();
    const p = useThemeStore.getState().setPack('liquid-glass');
    await vi.advanceTimersByTimeAsync(200); // fire the 100ms cosmetic debounce
    await p;
    const stored = await fakeBrowser.storage.sync.get('np_theme_pack');
    expect(stored.np_theme_pack).toBe('liquid-glass');
    expect(useThemeStore.getState().pack).toBe('liquid-glass');
  });

  it('chrome.storage.onChanged foreign write updates state', async () => {
    await useThemeStore.getState().init();
    expect(useThemeStore.getState().mode).toBe('auto');
    // A foreign writer (the other surface) writes storage directly.
    await fakeBrowser.storage.local.set({ np_theme: 'dark' });
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');
    // Foreign pack write propagates too.
    await fakeBrowser.storage.local.set({ np_theme_pack: 'claude-warm' });
    expect(useThemeStore.getState().pack).toBe('claude-warm');
  });

  it('auto mode + dark OS matchMedia resolves getResolved()=dark', async () => {
    stubMatchMedia(true);
    await useThemeStore.getState().init();
    expect(useThemeStore.getState().mode).toBe('auto');
    expect(useThemeStore.getState().getResolved()).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');
  });
});
