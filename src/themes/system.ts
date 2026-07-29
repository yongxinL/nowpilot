import { liquidGlassTheme } from './liquid-glass';
import { NowPilotThemeDefinition } from './types';

export const systemTheme: NowPilotThemeDefinition = {
  ...liquidGlassTheme,
  id: 'liquid-glass',
  label: 'Liquid Glass',
  description: 'Default NowPilot theme with clean light and dark modes.',
};

