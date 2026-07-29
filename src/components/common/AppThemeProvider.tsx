import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { useExtensionStore } from '../../store/useExtensionStore';
import { useThemeStore } from '../../core/theme/ThemeStore';
import { useThemeSync } from '../../core/theme/ThemeSync';
import { resolveNowPilotTheme } from '../../themes/theme-resolver';
import { DisplayMode, ThemeId, ResolvedThemeMode } from '../../themes/types';

interface ThemeContextType {
  displayMode: DisplayMode;
  themeId: ThemeId;
  resolvedMode: ResolvedThemeMode;
  setDisplayMode: (mode: DisplayMode) => void;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  displayMode: 'auto',
  themeId: 'liquid-glass',
  resolvedMode: 'light',
  setDisplayMode: () => {},
  setThemeId: () => {},
});

export const useAppTheme = () => useContext(ThemeContext);

export interface AppThemeProviderProps {
  children: React.ReactNode;
}

export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({ children }) => {
  const config = useExtensionStore((s) => s.config);
  const updateConfig = useExtensionStore((s) => s.updateConfig);
  const storeMode = useThemeStore((s) => s.mode);
  const storeThemeId = useThemeStore((s) => s.themeId);

  // System dark preference state
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

  // Sync BroadcastChannel theme changes
  useThemeSync();

  // Normalize displayMode and themeId
  const displayMode: DisplayMode = useMemo(() => {
    const raw = (config.displayMode || config.themeMode || storeMode || 'auto').toLowerCase();
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw as DisplayMode;
    return 'auto';
  }, [config.displayMode, config.themeMode, storeMode]);

  const themeId: ThemeId = useMemo(() => {
    const raw = config.themeId || config.appTheme || storeThemeId || 'liquid-glass';
    if (raw === 'claude' || raw === 'Claude') return 'claude';
    return 'liquid-glass';
  }, [config.themeId, config.appTheme, storeThemeId]);

  const { config: antdThemeConfig, resolvedMode } = useMemo(() => {
    return resolveNowPilotTheme({
      displayMode,
      themeId,
      systemPrefersDark: systemIsDark,
    });
  }, [displayMode, themeId, systemIsDark]);

  const handleSetDisplayMode = (mode: DisplayMode) => {
    updateConfig({ displayMode: mode, themeMode: mode as any });
    useThemeStore.getState().setMode(mode as any);
  };

  const handleSetThemeId = (id: ThemeId) => {
    updateConfig({ themeId: id, appTheme: id as any });
    useThemeStore.getState().setThemeId(id);
  };

  const contextValue = useMemo(
    () => ({
      displayMode,
      themeId,
      resolvedMode,
      setDisplayMode: handleSetDisplayMode,
      setThemeId: handleSetThemeId,
    }),
    [displayMode, themeId, resolvedMode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider theme={antdThemeConfig}>
        <AntdApp className="h-full w-full min-h-screen font-sans bg-[var(--np-bg,#f4f5f7)] text-[var(--np-fg,#0c121a)] transition-colors duration-200">
          {children}
        </AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};
