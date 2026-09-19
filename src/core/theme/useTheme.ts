import { useEffect, useState } from 'react';
import type { ThemeConfig } from 'antd';
import { getAntdConfig } from './antdConfig';
import type { ThemeStore } from './ThemeStore';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PACK,
  type ThemeMode,
  type ThemePack,
} from './themeTypes';

export interface UseThemeOptions {
  compact: boolean;
  prefersDark?: boolean;
}

export interface UseThemeResult {
  config: ThemeConfig;
  mode: ThemeMode;
  pack: ThemePack;
}

export function useTheme(store: ThemeStore, options: UseThemeOptions): UseThemeResult {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [pack, setPack] = useState<ThemePack>(DEFAULT_THEME_PACK);

  useEffect(() => {
    let active = true;
    const unsubscribe = store.subscribe((preferences) => {
      if (!active) return;
      setMode(preferences.mode);
      setPack(preferences.pack);
    });
    void store.read().then((preferences) => {
      if (!active) return;
      setMode(preferences.mode);
      setPack(preferences.pack);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [store]);

  return {
    config: getAntdConfig({
      mode,
      pack,
      compact: options.compact,
      prefersDark: options.prefersDark ?? false,
    }),
    mode,
    pack,
  };
}
