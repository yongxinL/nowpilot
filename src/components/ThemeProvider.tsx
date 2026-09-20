import React, { useMemo, useEffect, useState } from 'react';
import { ConfigProvider } from 'antd';
import { XProvider } from '@ant-design/x';
import { useThemeStore } from '../core/theme/ThemeStore';
import { useThemeSync } from '../core/theme/ThemeSync';
import { getLightTheme, getDarkTheme } from '../theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const mode = useThemeStore((s) => s.mode);
  const colorTheme = useThemeStore((s) => s.colorTheme);

  const [systemIsDark, setSystemIsDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useThemeSync();

  const isDark = mode === 'dark' || (mode === 'auto' && systemIsDark);

  const activeTheme = useMemo(() => {
    return isDark ? getDarkTheme(colorTheme) : getLightTheme(colorTheme);
  }, [isDark, colorTheme]);

  return (
    <ConfigProvider theme={activeTheme}>
      <XProvider theme={activeTheme}>
        {children}
      </XProvider>
    </ConfigProvider>
  );
};

