import type { ThemeConfig } from 'antd';
import type { ThemeMode } from './ThemeStore';

export interface ColorThemeOption {
  id: string;
  name: string;
  primary: string;
  darkPrimary: string;
  previewGradient: string;
  badgeColor?: string;
  description: string;
}

export const COLOR_THEMES: ColorThemeOption[] = [
  {
    id: 'system',
    name: 'System',
    primary: '#cc6b49',
    darkPrimary: '#da7756',
    previewGradient: 'from-[#cc6b49] to-[#da7756]',
    description: 'Default system theme with warm terracotta accent',
  },
];

export const DEFAULT_COLOR_THEME_ID = 'system';

export function getColorTheme(id?: string): ColorThemeOption {
  if (id === 'system' || id === 'claude-plus' || !id) {
    return COLOR_THEMES[0];
  }
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}

/**
 * The canonical theme-mode union guard (APPR-03 / D-15). One definition for
 * every reader: the `onChanged` shape detector, the store's persisted blob and
 * the (unmounted) `ThemeToggle` all narrow through this function rather than
 * casting an unknown value into `ThemeMode`.
 */
export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/**
 * The canonical theme-pack identifiers (APPR-06 / D-15). Phase 1 is
 * **pack-ready, not pack-shipping**: `default` is the only reachable pack and
 * no pack selector is rendered anywhere (§ Theme Contract).
 */
export type ThemePackId = 'default' | 'liquid-glass' | 'claude-warm';

/**
 * A pack definition: an identity plus the token/components overlay that
 * `getAntdConfig` merges **over** the seed token blob. A pack never replaces
 * the seed — it only overrides the keys it names, so every pack resolves to a
 * complete config (T-1-22).
 */
export interface ThemePackDefinition {
  id: ThemePackId;
  token?: ThemeConfig['token'];
  components?: ThemeConfig['components'];
}

export const THEME_PACKS: ThemePackDefinition[] = [
  { id: 'default' },
  // UI-SPEC § Color. Phase 1 declares both overlays but only `default` is
  // reachable (APPR-06 is Phase 15); nothing here imports or copies
  // `.planning/design/references/themes/` — the overlays are AntD tokens only
  // (T-1-23).
  {
    id: 'liquid-glass',
    token: { colorBgContainer: 'rgba(255,255,255,0.68)' },
  },
  {
    id: 'claude-warm',
    token: { colorBgBase: '#FAF7F2' },
  },
];

export const DEFAULT_THEME_PACK_ID: ThemePackId = 'default';

/**
 * Total pack lookup, mirroring the `COLOR_THEMES` / `getColorTheme` defensive
 * shape: an unknown id (or `undefined`) returns the `default` pack, never
 * `undefined`, and the function never throws (T-1-22). There is exactly one
 * lookup — every caller normalises through this function rather than keeping
 * its own switch.
 */
export function getThemePack(id?: string): ThemePackDefinition {
  return THEME_PACKS.find((pack) => pack.id === id) ?? THEME_PACKS[0];
}
