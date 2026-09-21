import { theme, type MappingAlgorithm, type ThemeConfig } from 'antd';
import enUS from 'antd/locale/en_US';
import type { ThemeMode } from './ThemeStore';
import { claudePlusLight, claudePlusDark } from '../../theme/packs/claudePlus';
import { getThemePack, type ThemePackId } from './ThemeConfig';

/**
 * The canonical theme-pack identifiers (APPR-06 / D-15). Re-exported from
 * `ThemeConfig.ts`, which owns the total pack lookup.
 */
export type ThemePack = ThemePackId;

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
 * Narrow the persisted `np_theme` pack string to the canonical pack union
 * without a cast, through the single total lookup. `ThemeStore.pack` is a
 * plain string (the persisted blob is shape-detecting, not schema-validated),
 * so normalisation happens here rather than at the call site.
 */
export function resolveThemePack(pack: string): ThemePack {
  return getThemePack(pack).id;
}

/**
 * Resolve the `auto` mode through the system preference (APPR-03).
 *
 * Guarded for a non-DOM environment (jsdom without `matchMedia`, the service
 * worker, SSR) and defaults to `light`, so the derivation is total everywhere.
 */
export function resolveSystem(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Seed token blob for the resolved mode, with the pack's overlay merged **over**
 * it. The overlay is token/components data only (never a second algorithm and
 * never a partial config), so every pack resolves to a complete `ThemeConfig`.
 */
function packTheme(pack: ThemePack, isDark: boolean): ThemeConfig {
  const seed = isDark ? claudePlusDark : claudePlusLight;
  const overlay = getThemePack(pack);

  return {
    ...seed,
    token: { ...seed.token, ...overlay.token },
    components: overlay.components
      ? { ...seed.components, ...overlay.components }
      : seed.components,
  };
}

/**
 * The single theme derivation point (Appendix F / §5.5 / D-15).
 *
 * Always returns an object — never `undefined` — because AntD changes the
 * provider tree identity and remounts children when `theme` flips between
 * `undefined` and an object (APPR-04).
 *
 * The algorithm is always composed as an **array** so `compactAlgorithm` can
 * be appended second: the Side Panel is compact and the Standalone workspace is
 * default, and density is never user-configurable (APPR-05).
 *
 * CSS-variable mode is on (`cssVar` inherited from the seed pack), which is
 * what makes a mode switch real-time with no remount. AntD v6 removed the
 * `cssVar: boolean` toggle — the field is now `{ prefix?, key? }` and CSS
 * variables are always used — so the pack's `{ key: 'antd' }` is passed
 * through verbatim instead of the v5-era `true` (recorded in 01-02).
 */
export function getAntdConfig({ mode, pack, compact }: AntdConfigInput): AntdSurfaceConfig {
  const resolved = mode === 'auto' ? resolveSystem() : mode;
  const isDark = resolved === 'dark';

  const algorithms: MappingAlgorithm[] = [
    isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  ];
  if (compact) algorithms.push(theme.compactAlgorithm);

  const active = packTheme(pack, isDark);

  return {
    theme: {
      ...active,
      algorithm: algorithms,
    },
    // `enUS` is set explicitly so no AntD locale default is reachable
    // (§ Accessibility: "English only in v0.2").
    locale: enUS,
  };
}
