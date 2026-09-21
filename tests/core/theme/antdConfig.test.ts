import { describe, it, expect, vi } from 'vitest';
import { theme } from 'antd';
import enUS from 'antd/locale/en_US';
import { getAntdConfig } from '../../../src/core/theme/antdConfig';

/**
 * Wave 0 suite for `getAntdConfig` — the single theme derivation point
 * (APPR-04 / APPR-05 / D-15 / §5.5).
 *
 * Case map (01-05 Task 1 `<behavior>`):
 *   1. light · default · default-density  → 1-element algorithm array
 *   2. dark  · default · compact          → 2 elements, dark first
 *   3. light · default · compact          → 2 elements, default first
 *   4. dark  · default · default-density  → compact algorithm absent
 *   5. auto  · default                    → resolved through the system preference, persists nothing
 *   6. unknown pack                        → `default` pack, no throw
 *   7. claude-warm                         → pack overlay merged, config still complete
 *   8. `cssVar` + `locale`                 → CSS-variable mode on, `enUS` explicit
 *   9. determinism                         → structurally equal for equal inputs
 *  10. liquid-glass overlay                → the pack's `colorBgContainer` overlay is applied
 *  11. `.dark`-class independence          → AntD never reads the class (H-3 / OQ2)
 */

describe('getAntdConfig — the single theme derivation point (APPR-04/APPR-05)', () => {
  it('returns an object (never undefined) whose algorithm is an array of length 1 for light + default density', () => {
    const cfg = getAntdConfig({ mode: 'light', pack: 'default', compact: false });

    // APPR-04: AntD remounts provider children when `theme` flips between
    // `undefined` and an object, so "never undefined" is asserted explicitly.
    expect(typeof cfg).toBe('object');
    expect(cfg).not.toBeUndefined();
    expect(Array.isArray(cfg.theme.algorithm)).toBe(true);
    expect(cfg.theme.algorithm).toHaveLength(1);
    expect(cfg.theme.algorithm?.[0]).toBe(theme.defaultAlgorithm);
  });

  it('returns [darkAlgorithm, compactAlgorithm] for dark + compact (compact is always second)', () => {
    const cfg = getAntdConfig({ mode: 'dark', pack: 'default', compact: true });

    expect(cfg.theme.algorithm).toHaveLength(2);
    expect(cfg.theme.algorithm?.[0]).toBe(theme.darkAlgorithm);
    // Identity, not a string name: the compact split must be AntD's own
    // algorithm instance so the provider merge order is unambiguous.
    expect(cfg.theme.algorithm?.[1]).toBe(theme.compactAlgorithm);
  });

  it('returns [defaultAlgorithm, compactAlgorithm] for light + compact', () => {
    const cfg = getAntdConfig({ mode: 'light', pack: 'default', compact: true });

    expect(cfg.theme.algorithm).toHaveLength(2);
    expect(cfg.theme.algorithm?.[0]).toBe(theme.defaultAlgorithm);
    expect(cfg.theme.algorithm?.[1]).toBe(theme.compactAlgorithm);
  });

  it('omits compactAlgorithm for dark + default density', () => {
    const cfg = getAntdConfig({ mode: 'dark', pack: 'default', compact: false });

    expect(cfg.theme.algorithm).toHaveLength(1);
    expect(cfg.theme.algorithm).not.toContain(theme.compactAlgorithm);
  });

  it("resolves 'auto' through the system preference and persists nothing", () => {
    // jsdom's matchMedia mock reports `matches: false` (tests/setup.ts).
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');
    const localSetSpy = vi.spyOn(globalThis.localStorage, 'setItem');

    const cfg = getAntdConfig({ mode: 'auto', pack: 'default', compact: false });

    expect(cfg.theme.algorithm).toHaveLength(1);
    expect(cfg.theme.algorithm?.[0]).toBe(theme.defaultAlgorithm);
    // APPR-03: a derivation reads the mode; it never writes the single source.
    expect(syncSetSpy).not.toHaveBeenCalled();
    expect(localSetSpy).not.toHaveBeenCalled();

    syncSetSpy.mockRestore();
    localSetSpy.mockRestore();
  });

  it('resolves an unknown pack id to the default pack instead of throwing', () => {
    let cfg: ReturnType<typeof getAntdConfig> | undefined;
    expect(() => {
      cfg = getAntdConfig({ mode: 'dark', pack: 'not-a-pack' as never, compact: false });
    }).not.toThrow();

    expect(cfg).not.toBeUndefined();
    expect(cfg?.theme.token).toBeDefined();
    expect(cfg?.theme.components).toBeDefined();
    expect(cfg?.theme.algorithm).toHaveLength(1);
  });

  it("merges the claude-warm pack overlay over the seed tokens and stays complete", () => {
    const warm = getAntdConfig({ mode: 'light', pack: 'claude-warm', compact: false });
    const fallback = getAntdConfig({ mode: 'light', pack: 'default', compact: false });

    // UI-SPEC § Color: the Claude Warm overlay carries `colorBgBase: '#FAF7F2'`.
    expect(warm.theme.token?.colorBgBase).toBe('#FAF7F2');
    expect(fallback.theme.token?.colorBgBase).not.toBe('#FAF7F2');
    // Overlay merge, not replacement: the seed token blob survives.
    expect(warm.theme.token?.colorPrimary).toBe(fallback.theme.token?.colorPrimary);
    expect(warm.theme.components).toBeDefined();
  });

  it('merges the liquid-glass pack overlay (colorBgContainer) over the seed tokens', () => {
    const glass = getAntdConfig({ mode: 'light', pack: 'liquid-glass', compact: false });
    const fallback = getAntdConfig({ mode: 'light', pack: 'default', compact: false });

    // UI-SPEC § Color: the Liquid Glass overlay carries the translucent container.
    expect(glass.theme.token?.colorBgContainer).toBe('rgba(255,255,255,0.68)');
    expect(glass.theme.token?.colorBgContainer).not.toBe(fallback.theme.token?.colorBgContainer);
    expect(glass.theme.components).toBeDefined();
  });

  it('enables CSS-variable mode and pins the explicit enUS locale', () => {
    const cfg = getAntdConfig({ mode: 'light', pack: 'default', compact: false });

    // AntD v6 removed the `cssVar: boolean` toggle — `ThemeConfig.cssVar` is
    // `{ prefix?, key? }` and CSS variables are always used (recorded in
    // 01-02). What matters here is that the pack's cssVar is carried through
    // (truthy), never dropped to `undefined`.
    expect(cfg.theme.cssVar).toBeTruthy();
    expect(cfg.locale).toBe(enUS);
  });

  it('is deterministic: equal inputs produce structurally equal algorithm, token and components', () => {
    const input = { mode: 'dark', pack: 'default', compact: true } as const;
    const first = getAntdConfig(input);
    const second = getAntdConfig(input);

    expect(second.theme.algorithm).toEqual(first.theme.algorithm);
    expect(second.theme.token).toEqual(first.theme.token);
    expect(second.theme.components).toEqual(first.theme.components);
  });

  it('derives AntD config independently of the `.dark` class (H-3 / OQ2)', () => {
    document.documentElement.classList.remove('dark');
    const withoutClass = getAntdConfig({ mode: 'dark', pack: 'default', compact: true });

    document.documentElement.classList.add('dark');
    const withClass = getAntdConfig({ mode: 'dark', pack: 'default', compact: true });

    // The class exists only for the hand-written selectors in src/index.css;
    // it is never an input to the AntD derivation (§ Theme Contract).
    expect(withClass.theme.algorithm).toEqual(withoutClass.theme.algorithm);
    expect(withClass.theme.token).toEqual(withoutClass.theme.token);

    document.documentElement.classList.remove('dark');
  });
});
