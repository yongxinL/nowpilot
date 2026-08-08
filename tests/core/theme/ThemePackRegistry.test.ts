// tests/core/theme/ThemePackRegistry.test.ts — First WSPC-04 registry instance:
// register (idempotent) / get / list / has / isReady + D-12 readiness + invalid
// id skip. Pure synchronous Map logic — node env avoids the jsdom 30
// TextEncoder/esbuild invariant break (01-01 Rule 3 precedent).
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { ThemePackRegistry, getThemePackRegistry } from '@/core/registry/ThemePackRegistry';
import { THEME_PACKS } from '@/core/theme/themePacks';
import type { ThemePack, ThemePackDef } from '@/core/theme/themePacks';

const SEED_TOKENS = {
  colorPrimary: '#3B82F6',
  borderRadius: 8,
  fontFamily: 'sans-serif',
};

function makePack(id: ThemePack, overrides: Partial<ThemePackDef> = {}): ThemePackDef {
  return { id, label: id, ready: false, algorithm: 'default', tokens: SEED_TOKENS, ...overrides };
}

describe('ThemePackRegistry', () => {
  it('register + get roundtrip returns the registered pack', () => {
    const registry = new ThemePackRegistry();
    registry.register(makePack('default', { ready: true }));
    expect(registry.get('default')).toMatchObject({ id: 'default', ready: true });
  });

  it('re-registering the same id is idempotent — get returns the new pack', () => {
    const registry = new ThemePackRegistry();
    registry.register(makePack('default', { ready: true }));
    registry.register(makePack('default', { label: 'Replaced', ready: false }));
    const def = registry.get('default');
    expect(def).toMatchObject({ id: 'default', label: 'Replaced', ready: false });
    // No duplicate entries — list length stays 1.
    expect(registry.list()).toHaveLength(1);
  });

  it('has() reflects presence', () => {
    const registry = new ThemePackRegistry();
    expect(registry.has('default')).toBe(false);
    registry.register(makePack('default'));
    expect(registry.has('default')).toBe(true);
    expect(registry.has('liquid-glass')).toBe(false);
  });

  it('isReady() reflects D-12 readiness: default true, liquid-glass/claude-warm false', () => {
    const registry = new ThemePackRegistry();
    registry.registerAll([
      makePack('default', { ready: true }),
      makePack('liquid-glass'),
      makePack('claude-warm'),
    ]);
    expect(registry.isReady('default')).toBe(true);
    expect(registry.isReady('liquid-glass')).toBe(false);
    expect(registry.isReady('claude-warm')).toBe(false);
    expect(registry.isReady('bogus' as ThemePack)).toBe(false);
  });

  it('list() returns registrations in insertion order', () => {
    const registry = new ThemePackRegistry();
    registry.registerAll([makePack('default'), makePack('liquid-glass'), makePack('claude-warm')]);
    expect(registry.list().map((p) => p.id)).toEqual(['default', 'liquid-glass', 'claude-warm']);
  });

  it('registering an invalid id shape does not throw and is skipped', () => {
    const registry = new ThemePackRegistry();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => registry.register(makePack('bogus' as ThemePack))).not.toThrow();
    expect(registry.has('bogus' as ThemePack)).toBe(false);
    spy.mockRestore();
  });

  it('singleton is pre-registered with THEME_PACKS so D-12 readiness is known from startup', () => {
    const registry = getThemePackRegistry();
    expect(
      registry
        .list()
        .map((p) => p.id)
        .sort(),
    ).toEqual(Object.keys(THEME_PACKS).sort());
    expect(registry.isReady('default')).toBe(true);
    expect(registry.isReady('liquid-glass')).toBe(false);
    expect(registry.isReady('claude-warm')).toBe(false);
  });
});
