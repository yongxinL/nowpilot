// tests/core/registry/AddonRegistry.test.ts — WSPC-04 registry contract tests:
// the generic Registry base (idempotent register/replace, unregister, get, list,
// has, clear, invalid-entry skip without throwing), AddonRegistry over AddonEntry,
// and AddonSettingsStore (zustand store + chrome.storage.local np_addon_settings
// adapter with onChanged foreign-write merge — no zustand storage middleware,
// Pitfall 7). Pure Map logic + fakeBrowser chrome.storage — node env avoids the
// jsdom 30 TextEncoder/esbuild invariant break (01-01 Rule 3 precedent).
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { Registry } from '@/core/registry/Registry';
import { AddonRegistry } from '@/core/registry/AddonRegistry';
import type { AddonEntry } from '@/core/registry/AddonRegistry';
import {
  useAddonSettingsStore,
  NP_ADDON_SETTINGS_KEY,
} from '@/core/registry/AddonSettingsStore';

function makeAddon(overrides: Partial<AddonEntry> = {}): AddonEntry {
  return { id: 'addon-a', name: 'Addon A', version: '0.1.0', enabled: true, ...overrides };
}

describe('Registry base (WSPC-04)', () => {
  it('register + get roundtrip returns the registered entry', () => {
    const registry = new Registry<{ id: string; label: string }>();
    registry.register({ id: 'x', label: 'X' });
    expect(registry.get('x')).toMatchObject({ id: 'x', label: 'X' });
  });

  it('re-registering the same id is idempotent — get returns the new entry, list stays 1', () => {
    const registry = new Registry<{ id: string; label: string }>();
    registry.register({ id: 'x', label: 'old' });
    registry.register({ id: 'x', label: 'new' });
    expect(registry.get('x')).toMatchObject({ label: 'new' });
    expect(registry.list()).toHaveLength(1);
  });

  it('unregister removes the entry', () => {
    const registry = new Registry<{ id: string }>();
    registry.register({ id: 'x' });
    registry.unregister('x');
    expect(registry.has('x')).toBe(false);
    expect(registry.get('x')).toBeUndefined();
  });

  it('list() returns entries in insertion order', () => {
    const registry = new Registry<{ id: string }>();
    registry.register({ id: 'a' });
    registry.register({ id: 'b' });
    registry.register({ id: 'c' });
    expect(registry.list().map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('has() reflects presence true/false', () => {
    const registry = new Registry<{ id: string }>();
    expect(registry.has('x')).toBe(false);
    registry.register({ id: 'x' });
    expect(registry.has('x')).toBe(true);
  });

  it('clear() empties the registry', () => {
    const registry = new Registry<{ id: string }>();
    registry.register({ id: 'a' });
    registry.register({ id: 'b' });
    registry.clear();
    expect(registry.list()).toHaveLength(0);
    expect(registry.has('a')).toBe(false);
  });

  it('registering an invalid entry (missing id) logs and skips without throwing', () => {
    const registry = new Registry<{ id: string }>();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => registry.register({ id: '' } as { id: string })).not.toThrow();
    expect(registry.list()).toHaveLength(0);
    spy.mockRestore();
  });
});

describe('AddonRegistry (AddonEntry)', () => {
  it('register + get roundtrip returns the addon', () => {
    const registry = new AddonRegistry();
    const addon = makeAddon({ permissions: ['storage'], settings: { key: 'v' } });
    registry.register(addon);
    expect(registry.get('addon-a')).toMatchObject({
      id: 'addon-a',
      name: 'Addon A',
      version: '0.1.0',
      enabled: true,
    });
  });

  it('re-registering the same id replaces without throwing', () => {
    const registry = new AddonRegistry();
    registry.register(makeAddon({ name: 'old' }));
    registry.register(makeAddon({ name: 'new' }));
    expect(registry.get('addon-a')).toMatchObject({ name: 'new' });
    expect(registry.list()).toHaveLength(1);
  });

  it('starts empty (WSPC-04 — zero add-ons in Phase 1)', () => {
    expect(new AddonRegistry().list()).toHaveLength(0);
  });
});

describe('AddonSettingsStore', () => {
  it('setSetting + getSetting roundtrip', async () => {
    await useAddonSettingsStore.getState().init();
    useAddonSettingsStore.getState().setSetting('addon-a', 'theme', 'dark');
    expect(useAddonSettingsStore.getState().getSetting('addon-a', 'theme')).toBe('dark');
  });

  it('getSetting returns the fallback when unset', async () => {
    await useAddonSettingsStore.getState().init();
    expect(useAddonSettingsStore.getState().getSetting('addon-a', 'nope', 'default-v')).toBe(
      'default-v',
    );
    // Fallback for an entirely unknown addon too.
    expect(useAddonSettingsStore.getState().getSetting('ghost', 'x', 42)).toBe(42);
  });

  it('setSetting writes through to chrome.storage.local np_addon_settings', async () => {
    await useAddonSettingsStore.getState().init();
    useAddonSettingsStore.getState().setSetting('addon-a', 'k', 'v');
    const stored = await fakeBrowser.storage.local.get(NP_ADDON_SETTINGS_KEY);
    expect(stored.np_addon_settings).toMatchObject({ 'addon-a': { k: 'v' } });
  });

  it('chrome.storage.onChanged foreign write merges into state', async () => {
    await useAddonSettingsStore.getState().init();
    expect(useAddonSettingsStore.getState().getSetting('addon-a', 'k')).toBeUndefined();
    // A foreign surface writes storage directly.
    await fakeBrowser.storage.local.set({
      [NP_ADDON_SETTINGS_KEY]: { 'addon-a': { k: 'foreign' } },
    });
    expect(useAddonSettingsStore.getState().getSetting('addon-a', 'k')).toBe('foreign');
  });

  it('malformed stored values are never merged raw (T-1-13 style)', async () => {
    await fakeBrowser.storage.local.set({ [NP_ADDON_SETTINGS_KEY]: { 'bad': 'not-an-object' } });
    await useAddonSettingsStore.getState().init();
    expect(useAddonSettingsStore.getState().getSetting('bad', 'x', 'fb')).toBe('fb');
  });
});
