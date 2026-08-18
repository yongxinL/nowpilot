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
    primary: '#1ba1dd',
    darkPrimary: '#50c1fc',
    previewGradient: 'from-[#1ba1dd] to-[#50c1fc]',
    description: 'Default System theme with cyan-blue accents',
  },
];

export const DEFAULT_COLOR_THEME_ID = 'system';

export function getColorTheme(id?: string): ColorThemeOption {
  if (id === 'blue' || !id) {
    return COLOR_THEMES[0];
  }
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}



