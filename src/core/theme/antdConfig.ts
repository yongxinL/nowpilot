import { theme, type MappingAlgorithm, type ThemeConfig } from 'antd';
import enUS from 'antd/locale/en_US';
import type { ThemeMode } from './ThemeStore';
import { claudePlusLight, claudePlusDark } from '../../theme/packs/claudePlus';

/**
 * The canonical theme-pack identifiers (APPR-06 / D-15). Phase 1 is
 * **pack-ready, not pack-shipping**: only `default` carries token data, and
 * no pack-selector UI is rendered anywhere (§ Theme Contract).
 */
export type ThemePack = 'default' | 'liquid-glass' | 'claude-warm';

export interface AntdConfigInput {
  mode: ThemeMode;
  pack: ThemePack;
  /** Fixed per surface, never user-configurable in v0.2 (APPR-05). */
  compact: boolean;
}

/**
 * The shape both surface roots spread into their single `XProvider`.
 * `XProvider` extends AntD's `ConfigProvider`, so `theme` and `locale` are
 * passed straight through to it — a surface never mounts a separate
 * `ConfigProvider` (§5.5).
 */
export interface AntdSurfaceConfig {
  theme: ThemeConfig;
  locale: typeof enUS;
}

/**
 * Narrow the persisted `np_theme_pack` string to the canonical pack union
 * without a cast. `ThemeStore.pack` is a plain string (the persisted blob is
 * shape-detecting, not schema-validated), so normalisation happens here
 * rather than at the call site.
 */
export function resolveThemePack(pack: string): ThemePack {
  return pack === 'liquid-glass' || pack === 'claude-warm' ? pack : 'default';
}

/**
 * Pack lookup with a total fallback, mirroring `getColorTheme()` in
 * `ThemeConfig.ts`. Phase 1 ships exactly one pack, so every canonical pack
 * identifier resolves to the Claude Plus ("default") token blobs; APPR-06
 * (Phase 15) supplies the Liquid Glass and Claude Warm data behind the same
 * switch with no call-site change.
 */
function packTheme(pack: ThemePack, isDark: boolean): ThemeConfig {
  switch (pack) {
    case 'liquid-glass':
    case 'claude-warm':
    case 'default':
      return isDark ? claudePlusDark : claudePlusLight;
  }
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * The single theme derivation point (Appendix F / §5.5 / D-15).
 *
 * Always returns an object — never `undefined` — because AntD changes the
 * provider tree identity and remounts children when `theme` flips between
 * `undefined` and an object.
 *
 * The algorithm is always composed as an **array** so `compactAlgorithm` can
 * be appended; the Side Panel is compact and the Standalone workspace is
 * default, and density is never user-configurable (APPR-05).
 *
 * CSS-variable mode is on (`cssVar` inherited from the pack), which is what
 * makes a mode switch real-time with no remount. AntD v6 removed the
 * `cssVar: boolean` toggle — the field is now `{ prefix?, key? }` and CSS
 * variables are always used — so the packs' `{ key: 'antd' }` is passed
 * through verbatim instead of the v5-era `true`.
 */
export function getAntdConfig({ mode, pack, compact }: AntdConfigInput): AntdSurfaceConfig {
  const resolved = resolveMode(mode);
  const isDark = resolved === 'dark';

  const algorithms: MappingAlgorithm[] = [
    isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  ];
  if (compact) algorithms.push(theme.compactAlgorithm);

  const active = packTheme(pack, isDark);

  return {
    theme: {
      algorithm: algorithms,
      token: active.token,
      components: active.components,
      cssVar: active.cssVar,
    },
    // `enUS` is set explicitly so no AntD locale default is reachable
    // (§ Accessibility: "English only in v0.2").
    locale: enUS,
  };
}
