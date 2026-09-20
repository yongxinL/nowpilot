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



